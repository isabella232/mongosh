import { expect } from 'chai';
import sinon, { StubbedInstance, stubInterface } from 'ts-sinon';
import { EventEmitter } from 'events';
import { ALL_PLATFORMS, ALL_SERVER_VERSIONS, ALL_TOPOLOGIES, asShellResult } from './enums';
import { signatures } from './decorators';
import Database from './database';
import Collection from './collection';
import Mongo from './mongo';
import { Cursor as ServiceProviderCursor, ServiceProvider, bson } from '@mongosh/service-provider-core';
import ShellInternalState from './shell-internal-state';
import crypto from 'crypto';
import { ADMIN_DB } from './enums';


describe('Database', () => {
  const MD5_HASH = crypto.createHash('md5').update('anna:mongo:pwd').digest('hex');
  describe('help', () => {
    const apiClass: any = new Database({}, 'name');
    it('calls help function', async() => {
      expect((await apiClass.help()[asShellResult]()).type).to.equal('Help');
      expect((await apiClass.help[asShellResult]()).type).to.equal('Help');
    });
    it('calls help function for methods', async() => {
      expect((await apiClass.runCommand.help()[asShellResult]()).type).to.equal('Help');
      expect((await apiClass.runCommand.help[asShellResult]()).type).to.equal('Help');
    });
  });
  describe('collections', () => {
    it('allows to get a collection as property if is not one of the existing methods', () => {
      const database: any = new Database({}, 'db1');
      expect(database.someCollection).to.have.instanceOf(Collection);
      expect(database.someCollection._name).to.equal('someCollection');
    });

    it('reuses collections', () => {
      const database: any = new Database({}, 'db1');
      expect(database.someCollection).to.equal(database.someCollection);
    });

    it('does not return a collection starting with _', () => {
    // this is the behaviour in the old shell

      const database: any = new Database({}, 'db1');
      expect(database._someProperty).to.equal(undefined);
    });

    it('does not return a collection for symbols', () => {
      const database: any = new Database({}, 'db1');
      expect(database[Symbol('someProperty')]).to.equal(undefined);
    });

    it('does not return a collection with invalid name', () => {
      const database: any = new Database({}, 'db1');
      expect(database['   ']).to.equal(undefined);
    });

    it('allows to access _name', () => {
      const database: any = new Database({}, 'db1');
      expect(database._name).to.equal('db1');
    });

    it('allows to access collections', () => {
      const database: any = new Database({}, 'db1');
      expect(database._collections).to.deep.equal({});
    });
  });
  describe('signatures', () => {
    it('type', () => {
      expect(signatures.Database.type).to.equal('Database');
    });
    it('attributes', () => {
      expect(signatures.Database.attributes.aggregate).to.deep.equal({
        type: 'function',
        returnsPromise: true,
        returnType: 'AggregationCursor',
        platforms: ALL_PLATFORMS,
        topologies: ALL_TOPOLOGIES,
        serverVersions: ALL_SERVER_VERSIONS
      });
    });
    it('hasAsyncChild', () => {
      expect(signatures.Database.hasAsyncChild).to.equal(true);
    });
  });
  describe('Metadata', () => {
    describe('asShellResult', () => {
      const mongo = sinon.spy();
      const db = new Database(mongo, 'myDB');
      it('value', async() => {
        expect((await db[asShellResult]()).value).to.equal('myDB');
      });
      it('type', async() => {
        expect((await db[asShellResult]()).type).to.equal('Database');
      });
    });
  });
  describe('attributes', () => {
    const mongo = sinon.spy();
    const db = new Database(mongo, 'myDB') as any;
    it('creates new collection for attribute', async() => {
      expect((await db.coll[asShellResult]()).type).to.equal('Collection');
    });
  });
  describe('commands', () => {
    let mongo: Mongo;
    let serviceProvider: StubbedInstance<ServiceProvider>;
    let database: Database;
    let bus: StubbedInstance<EventEmitter>;
    let internalState: ShellInternalState;

    beforeEach(() => {
      bus = stubInterface<EventEmitter>();
      serviceProvider = stubInterface<ServiceProvider>();
      serviceProvider.initialDb = 'test';
      serviceProvider.bsonLibrary = bson;
      internalState = new ShellInternalState(serviceProvider, bus);
      mongo = new Mongo(internalState);
      database = new Database(mongo, 'db1');
    });
    describe('getCollectionInfos', () => {
      it('returns the result of serviceProvider.listCollections', async() => {
        const filter = { name: 'abc' };
        const options = { nameOnly: true };
        const result = [{ name: 'coll1' }];

        serviceProvider.listCollections.resolves(result);

        expect(await database.getCollectionInfos(
          filter,
          options)).to.deep.equal(result);

        expect(serviceProvider.listCollections).to.have.been.calledOnceWith('db1', filter, options);
      });
    });

    describe('getCollectionNames', () => {
      it('returns the result of serviceProvider.listCollections', async() => {
        const result = [{ name: 'coll1' }];

        serviceProvider.listCollections.resolves(result);

        expect(await database.getCollectionNames()).to.deep.equal(['coll1']);

        expect(serviceProvider.listCollections).to.have.been.calledOnceWith(
          'db1', {}, { nameOnly: true });
      });
    });

    describe('getName', () => {
      it('returns the name of the DB', async() => {
        expect(database.getName()).to.equal('db1');
      });
    });

    describe('getMongo', () => {
      it('returns the name of the DB', async() => {
        expect(database.getMongo()).to.equal(mongo);
      });
    });

    describe('runCommand', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.runCommand({ someCommand: 'someCollection' });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            someCommand: 'someCollection'
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.runCommand({ someCommand: 'someCollection' });
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.runCommand({ someCommand: 'someCollection' })
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });

    describe('adminCommand', () => {
      it('calls serviceProvider.runCommand with the admin database', async() => {
        await database.adminCommand({ someCommand: 'someCollection' });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          'admin',
          {
            someCommand: 'someCollection'
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.adminCommand({ someCommand: 'someCollection' });
        expect(result).to.deep.equal(expectedResult);
      });
      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.adminCommand({ someCommand: 'someCollection' })
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });

    describe('aggregate', () => {
      let serviceProviderCursor: StubbedInstance<ServiceProviderCursor>;

      beforeEach(() => {
        serviceProviderCursor = stubInterface<ServiceProviderCursor>();
      });

      it('calls serviceProvider.aggregateDb with pipleline and options', async() => {
        await database.aggregate(
          [{ $piplelineStage: {} }], { options: true });

        expect(serviceProvider.aggregateDb).to.have.been.calledWith(
          database._name,
          [{ $piplelineStage: {} }],
          { options: true }
        );
      });

      it('returns an AggregationCursor that wraps the service provider one', async() => {
        const toArrayResult = [];
        serviceProviderCursor.toArray.resolves(toArrayResult);
        serviceProvider.aggregateDb.returns(serviceProviderCursor);

        const cursor = await database.aggregate([{ $piplelineStage: {} }]);
        expect(await cursor.toArray()).to.equal(toArrayResult);
      });

      it('throws if serviceProvider.aggregateDb rejects', async() => {
        const expectedError = new Error();
        serviceProvider.aggregateDb.throws(expectedError);

        expect(
          await database.aggregate(
            [{ $piplelineStage: {} }]
          ).catch(e => e)
        ).to.equal(expectedError);
      });

      it('pass readConcern and writeConcern as dbOption', async() => {
        await database.aggregate(
          [],
          { otherOption: true, readConcern: { level: 'majority' }, writeConcern: { w: 1 } }
        );

        expect(serviceProvider.aggregateDb).to.have.been.calledWith(
          database._name,
          [],
          { otherOption: true },
          { readConcern: { level: 'majority' }, w: 1 }
        );
      });

      it('runs explain if explain true is passed', async() => {
        const expectedExplainResult = {};
        serviceProviderCursor.explain.resolves(expectedExplainResult);
        serviceProvider.aggregateDb.returns(serviceProviderCursor as any);

        const explainResult = await database.aggregate(
          [],
          { explain: true }
        );

        expect(explainResult).to.equal(expectedExplainResult);
        expect(serviceProviderCursor.explain).to.have.been.calledOnce;
      });

      it('wont run explain if explain is not passed', async() => {
        serviceProvider.aggregateDb.returns(serviceProviderCursor as any);

        const cursor = await database.aggregate(
          [],
          {}
        );

        expect((await cursor[asShellResult]()).type).to.equal('AggregationCursor');
        expect(serviceProviderCursor.explain).not.to.have.been.called;
      });
    });
    describe('getSiblingDB', () => {
      it('returns a database', async() => {
        const otherDb = await database.getSiblingDB('otherdb');
        expect(otherDb).to.be.instanceOf(Database);
        expect(otherDb._name).to.equal('otherdb');
      });

      it('throws if name is not a string', () => {
        expect(() => {
          database.getSiblingDB(undefined);
        }).to.throw('Missing required argument');
      });

      it('throws if name is empty', () => {
        expect(() => {
          database.getSiblingDB('');
        }).to.throw('Database name cannot be empty.');
      });

      it('reuses db instances', () => {
        const otherDb = database.getSiblingDB('otherdb');
        expect(
          database.getSiblingDB('otherdb')
        ).to.equal(otherDb);
      });
    });

    describe('getCollection', () => {
      it('returns a collection for the database', async() => {
        const coll = database.getCollection('coll');
        expect(coll).to.be.instanceOf(Collection);
        expect(coll._name).to.equal('coll');
        expect(coll._database).to.equal(database);
      });

      it('throws if name is not a string', () => {
        expect(() => {
          database.getCollection(undefined);
        }).to.throw('Missing required argument');
      });

      it('throws if name is empty', () => {
        expect(() => {
          database.getCollection('');
        }).to.throw('Collection name cannot be empty.');
      });

      it('allows to use collection names that would collide with methods', () => {
        const coll = database.getCollection('getCollection');
        expect(coll).to.be.instanceOf(Collection);
        expect(coll._name).to.equal('getCollection');
      });

      it('allows to use collection names that starts with _', () => {
        const coll = database.getCollection('_coll1');
        expect(coll).to.be.instanceOf(Collection);
        expect(coll._name).to.equal('_coll1');
      });

      it('reuses collections', () => {
        expect(
          database.getCollection('coll')
        ).to.equal(database.getCollection('coll'));
      });
    });

    describe('dropDatabase', () => {
      it('calls serviceProvider.dropDatabase on the database', async() => {
        await database.dropDatabase({ w: 1 });

        expect(serviceProvider.dropDatabase).to.have.been.calledWith(
          database._name,
          { w: 1 }
        );
      });

      it('returns whatever serviceProvider.dropDatabase returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.dropDatabase.resolves(expectedResult);
        const result = await database.dropDatabase();
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.dropDatabase rejects', async() => {
        const expectedError = new Error();
        serviceProvider.dropDatabase.rejects(expectedError);
        const catchedError = await database.dropDatabase()
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('createUser', () => {
      it('calls serviceProvider.runCommand on the database with extra fields but not digestPassword', async() => {
        await database.createUser({
          user: 'anna',
          pwd: 'pwd',
          customData: { anything: true },
          roles: []
        }, { w: 1 });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            createUser: 'anna',
            pwd: 'pwd',
            customData: { anything: true },
            roles: [],
            writeConcern: { w: 1 }
          }
        );
      });

      it('calls serviceProvider.runCommand on the database with extra fields and passwordDigestor=server', async() => {
        await database.createUser({
          user: 'anna',
          pwd: 'pwd',
          customData: { anything: true },
          roles: [],
          passwordDigestor: 'server'
        }, { w: 1 });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            createUser: 'anna',
            pwd: 'pwd',
            customData: { anything: true },
            roles: [],
            writeConcern: { w: 1 },
            digestPassword: true
          }
        );
      });

      it('calls serviceProvider.runCommand on the database with extra fields and passwordDigestor=client', async() => {
        await database.createUser({
          user: 'anna',
          pwd: 'pwd',
          customData: { anything: true },
          roles: [],
          passwordDigestor: 'client'
        }, { w: 1 });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            createUser: 'anna',
            pwd: MD5_HASH,
            customData: { anything: true },
            roles: [],
            writeConcern: { w: 1 },
            digestPassword: false
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.createUser({
          user: 'anna',
          pwd: 'pwd',
          customData: { anything: true },
          roles: []
        }, { w: 1 });
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.createUser({
          user: 'anna',
          pwd: 'pwd',
          customData: { anything: true },
          roles: []
        }, { w: 1 })
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('updateUser', () => {
      it('calls serviceProvider.runCommand on the database with extra fields and no passwordDigestor', async() => {
        await database.updateUser('anna', {
          pwd: 'pwd',
          customData: { anything: true },
          roles: []
        }, { w: 1 });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            updateUser: 'anna',
            pwd: 'pwd',
            customData: { anything: true },
            roles: [],
            writeConcern: { w: 1 }
          }
        );
      });
      it('calls serviceProvider.runCommand on the database with extra fields and passwordDigestor=client', async() => {
        await database.updateUser('anna', {
          pwd: 'pwd',
          customData: { anything: true },
          roles: [],
          passwordDigestor: 'client'
        }, { w: 1 });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            updateUser: 'anna',
            pwd: MD5_HASH,
            customData: { anything: true },
            roles: [],
            writeConcern: { w: 1 },
            digestPassword: false
          }
        );
      });

      it('calls serviceProvider.runCommand on the database with extra fields and passwordDigestor=server', async() => {
        await database.updateUser('anna', {
          pwd: 'pwd',
          customData: { anything: true },
          roles: [],
          passwordDigestor: 'server'
        }, { w: 1 });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            updateUser: 'anna',
            pwd: 'pwd',
            customData: { anything: true },
            roles: [],
            writeConcern: { w: 1 },
            digestPassword: true
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.updateUser('anna', {
          user: 'anna',
          pwd: 'pwd',
          customData: { anything: true },
          roles: []
        }, { w: 1 });
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.updateUser('anna', {
          user: 'anna',
          pwd: 'pwd',
          customData: { anything: true },
          roles: []
        }, { w: 1 })
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('changeUserPassword', () => {
      it('calls serviceProvider.runCommand on the database with extra fields', async() => {
        await database.changeUserPassword('anna', 'pwd');

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            updateUser: 'anna',
            pwd: 'pwd',
            writeConcern: {}
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.changeUserPassword('anna', 'pwd');
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.changeUserPassword('anna', 'pwd')
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('logout', () => {
      it('calls serviceProvider.runCommand on the database with extra fields', async() => {
        await database.logout();

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { logout: 1 }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.logout();
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.logout()
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('dropUser', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.dropUser('anna');

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { dropUser: 'anna', writeConcern: {} }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.dropUser('anna');
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.dropUser('anna')
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('dropAllUsers', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.dropAllUsers();

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { dropAllUsersFromDatabase: 1, writeConcern: {} }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.dropAllUsers();
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.dropAllUsers()
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('auth', () => {
      it('calls serviceProvider.authenticate on the database when one arg provided', async() => {
        await database.auth({
          user: 'anna',
          pwd: 'pwd',
          mechanism: 'mech'
        });

        expect(serviceProvider.authenticate).to.have.been.calledWith(
          {
            user: 'anna',
            pwd: 'pwd',
            mechanism: 'mech',
            authDb: 'db1'
          }
        );
      });
      it('calls serviceProvider.authenticate on the database when two args provided', async() => {
        await database.auth('anna', 'pwd');

        expect(serviceProvider.authenticate).to.have.been.calledWith(
          {
            user: 'anna',
            pwd: 'pwd',
            authDb: 'db1'
          }
        );
      });

      it('returns whatever serviceProvider.authenticate returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.authenticate.resolves(expectedResult);
        const result = await database.auth('anna', 'pwd');
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.authenticate.rejects(expectedError);
        const catchedError = await database.auth('anna', 'pwd')
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('grantRolesToUser', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.grantRolesToUser('anna', [ 'role1' ]);

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { grantRolesToUser: 'anna', roles: ['role1'], writeConcern: {} }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.grantRolesToUser('anna', [ 'role1' ]);
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.grantRolesToUser('anna', [ 'role1' ])
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('revokeRolesFromUser', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.revokeRolesFromUser('anna', [ 'role1' ]);

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { revokeRolesFromUser: 'anna', roles: ['role1'], writeConcern: {} }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.revokeRolesFromUser('anna', [ 'role1' ]);
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.revokeRolesFromUser('anna', [ 'role1' ])
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('getUser', () => {
      it('calls serviceProvider.runCommand on the database without options', async() => {
        const expectedResult = { ok: 1, users: [] };
        serviceProvider.runCommand.resolves(expectedResult);
        await database.getUser('anna');

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { usersInfo: { user: 'anna', db: 'db1' } }
        );
      });
      it('calls serviceProvider.runCommand on the database with options', async() => {
        const expectedResult = { ok: 1, users: [] };
        serviceProvider.runCommand.resolves(expectedResult);
        await database.getUser('anna', {
          showCredentials: false,
          showPrivileges: true,
          filter: { f: 1 }
        });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            usersInfo: { user: 'anna', db: 'db1' },
            showCredentials: false,
            showPrivileges: true,
            filter: { f: 1 }
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1, users: [ { user: 'anna' }] };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.getUser('anna');
        expect(result).to.deep.equal({ user: 'anna' });
      });
      it('returns whatever serviceProvider.runCommand returns if user does not exist', async() => {
        const expectedResult = { ok: 1, users: [] };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.getUser('anna');
        expect(result).to.deep.equal(null);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.getUser('anna')
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('getUsers', () => {
      it('calls serviceProvider.runCommand on the database without options', async() => {
        await database.getUsers();

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { usersInfo: 1 }
        );
      });
      it('calls serviceProvider.runCommand on the database with options', async() => {
        await database.getUsers({
          showCredentials: false,
          filter: {}
        });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            usersInfo: 1,
            showCredentials: false,
            filter: {}
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.getUsers();
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.getUsers()
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('createCollection', () => {
      it('calls serviceProvider.createCollection on the database without options', async() => {
        await database.createCollection('newcoll');

        expect(serviceProvider.createCollection).to.have.been.calledWith(
          database._name,
          'newcoll',
          {}
        );
      });
      it('calls serviceProvider.createCollection on the database with options', async() => {
        await database.createCollection('newcoll', {
          capped: false,
          max: 100,
          writeConcern: { w: 1 }
        });

        expect(serviceProvider.createCollection).to.have.been.calledWith(
          database._name,
          'newcoll',
          {
            capped: false,
            max: 100,
            writeConcern: { w: 1 }
          }
        );
      });

      it('returns whatever serviceProvider.createCollection returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.createCollection.resolves(expectedResult);
        const result = await database.createCollection('newcoll');
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.createCollection rejects', async() => {
        const expectedError = new Error();
        serviceProvider.createCollection.rejects(expectedError);
        const catchedError = await database.createCollection('newcoll')
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('createView', () => {
      it('calls serviceProvider.createCollection on the database without options', async() => {
        await database.createView('newcoll', 'sourcecoll', [{ $match: { x: 1 } }]);

        expect(serviceProvider.createCollection).to.have.been.calledWith(
          database._name,
          'newcoll',
          {
            viewOn: 'sourcecoll',
            pipeline: [{ $match: { x: 1 } }]
          }
        );
      });
      it('calls serviceProvider.createCollection on the database with options', async() => {
        await database.createView('newcoll', 'sourcecoll', [], { collation: { x: 1 } });

        expect(serviceProvider.createCollection).to.have.been.calledWith(
          database._name,
          'newcoll',
          {
            viewOn: 'sourcecoll',
            pipeline: [],
            collation: { x: 1 }
          }
        );
      });

      it('returns whatever serviceProvider.createCollection returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.createCollection.resolves(expectedResult);
        const result = await database.createView('newcoll', 'sourcecoll', []);
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.createCollection rejects', async() => {
        const expectedError = new Error();
        serviceProvider.createCollection.rejects(expectedError);
        const catchedError = await database.createView('newcoll', 'sourcecoll', [])
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('createRole', () => {
      it('calls serviceProvider.runCommand on the database with extra fields', async() => {
        await database.createRole({
          role: 'anna',
          roles: [ { role: 'clusterAdmin', db: 'db1' }, { role: 'hostManager' }],
          privileges: [ 'remove', 'update', 'find' ],
          authenticationRestrictions: [ 1, 2 ]
        }, { w: 2 });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            createRole: 'anna',
            roles: [ { role: 'clusterAdmin', db: 'db1' }, { role: 'hostManager' }],
            privileges: [ 'remove', 'update', 'find' ],
            authenticationRestrictions: [ 1, 2 ],
            writeConcern: { w: 2 }
          }
        );
      });

      it('calls serviceProvider.runCommand on the database without extra fields', async() => {
        await database.createRole({
          role: 'anna',
          roles: [],
          privileges: []
        }, { w: 3 });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            createRole: 'anna',
            roles: [],
            privileges: [],
            writeConcern: { w: 3 }
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.createRole({
          role: 'anna',
          roles: [],
          privileges: []
        }, { w: 1 });
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.createRole({
          role: 'anna',
          roles: [],
          privileges: []
        }, { w: 1 })
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('updateRole', () => {
      it('calls serviceProvider.runCommand on the database with no extra fields', async() => {
        await database.updateRole('anna', {
          roles: []
        }, { w: 1 });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            updateRole: 'anna',
            roles: [],
            writeConcern: { w: 1 }
          }
        );
      });
      it('calls serviceProvider.runCommand on the database with extra fields and passwordDigestor=server', async() => {
        await database.updateRole('anna', {
          roles: [ { role: 'dbAdmin', db: 'db1' }],
          privileges: [ 'find' ],
          authenticationRestrictions: [ 1 ]
        }, { w: 1 });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            updateRole: 'anna',
            roles: [ { role: 'dbAdmin', db: 'db1' }],
            privileges: [ 'find' ],
            authenticationRestrictions: [ 1 ],
            writeConcern: { w: 1 }
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.updateRole('anna', {
          role: 'anna',
          privileges: [],
          roles: []
        }, { w: 1 });
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.updateRole('anna', {
          role: 'anna',
          privileges: [],
          roles: []
        }, { w: 1 })
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('dropRole', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.dropRole('anna');

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { dropRole: 'anna', writeConcern: {} }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.dropRole('anna');
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.dropRole('anna')
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('dropAllRoles', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.dropAllRoles();

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { dropAllRolesFromDatabase: 1, writeConcern: {} }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.dropAllRoles();
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.dropAllRoles()
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('grantRolesToRole', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.grantRolesToRole('anna', [ 'role1' ]);

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { grantRolesToRole: 'anna', roles: ['role1'], writeConcern: {} }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.grantRolesToRole('anna', [ 'role1' ]);
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.grantRolesToRole('anna', [ 'role1' ])
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('revokeRolesFromRole', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.revokeRolesFromRole('anna', [ 'role1' ]);

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { revokeRolesFromRole: 'anna', roles: ['role1'], writeConcern: {} }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.revokeRolesFromRole('anna', [ 'role1' ]);
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.revokeRolesFromRole('anna', [ 'role1' ])
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });

    describe('grantPrivilegesToRole', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.grantPrivilegesToRole('anna', [ 'privilege1' ]);

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { grantPrivilegesToRole: 'anna', privileges: ['privilege1'], writeConcern: {} }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.grantPrivilegesToRole('anna', [ 'privilege1' ]);
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.grantPrivilegesToRole('anna', [ 'privilege1' ])
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('revokePrivilegesFromRole', () => {
      it('calls serviceProvider.runCommand on the database', async() => {
        await database.revokePrivilegesFromRole('anna', [ 'privilege1' ]);

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { revokePrivilegesFromRole: 'anna', privileges: ['privilege1'], writeConcern: {} }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.revokePrivilegesFromRole('anna', [ 'privilege1' ]);
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.revokePrivilegesFromRole('anna', [ 'privilege1' ])
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('getRole', () => {
      it('calls serviceProvider.runCommand on the database without options', async() => {
        const expectedResult = { ok: 1, roles: [] };
        serviceProvider.runCommand.resolves(expectedResult);
        await database.getRole('anna');

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { rolesInfo: { role: 'anna', db: 'db1' } }
        );
      });
      it('calls serviceProvider.runCommand on the database with options', async() => {
        const expectedResult = { ok: 1, roles: [] };
        serviceProvider.runCommand.resolves(expectedResult);
        await database.getRole('anna', {
          showBuiltinRoles: false,
          showPrivileges: true
        });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            rolesInfo: { role: 'anna', db: 'db1' },
            showBuiltinRoles: false,
            showPrivileges: true
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1, roles: [ { role: 'anna' }] };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.getRole('anna');
        expect(result).to.deep.equal({ role: 'anna' });
      });
      it('returns whatever serviceProvider.runCommand returns if role does not exist', async() => {
        const expectedResult = { ok: 1, roles: [] };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.getRole('anna');
        expect(result).to.deep.equal(null);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.getRole('anna')
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
    describe('getRoles', () => {
      it('calls serviceProvider.runCommand on the database without options', async() => {
        await database.getRoles();

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          { rolesInfo: 1 }
        );
      });
      it('calls serviceProvider.runCommand on the database with options', async() => {
        await database.getRoles({
          showCredentials: false,
          filter: {}
        });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          database._name,
          {
            rolesInfo: 1,
            showCredentials: false,
            filter: {}
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.getRoles();
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.getRoles()
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });

    describe('currentOp', () => {
      it('calls serviceProvider.runCommand on the database without options', async() => {
        await database.currentOp();

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          ADMIN_DB,
          { currentOp: 1 }
        );
      });
      it('calls serviceProvider.runCommand on the database with options', async() => {
        await database.currentOp({
          $ownOps: true,
          $all: true,
          filter: 1
        });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          ADMIN_DB,
          {
            currentOp: 1,
            $ownOps: true,
            $all: true,
            filter: 1
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.currentOp();
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.currentOp()
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });

    describe('killOp', () => {
      it('calls serviceProvider.runCommand on the database with options', async() => {
        await database.killOp(123);

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          ADMIN_DB,
          {
            killOp: 1, op: 123
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.killOp(123);
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.killOp(123)
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });

    describe('shutdownServer', () => {
      it('calls serviceProvider.runCommand on the database without options', async() => {
        await database.shutdownServer();

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          ADMIN_DB,
          { shutdown: 1 }
        );
      });
      it('calls serviceProvider.runCommand on the database with options', async() => {
        await database.shutdownServer({
          force: true,
          timeoutSecs: 1
        });

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          ADMIN_DB,
          {
            shutdown: 1,
            force: true,
            timeoutSecs: 1
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.shutdownServer();
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.shutdownServer()
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });

    describe('fsyncLock', () => {
      it('calls serviceProvider.runCommand on the database with options', async() => {
        await database.fsyncLock();

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          ADMIN_DB,
          {
            fsync: 1, lock: true
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.fsyncLock();
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.fsyncLock()
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });

    describe('fsyncUnlock', () => {
      it('calls serviceProvider.runCommand on the database with options', async() => {
        await database.fsyncUnlock();

        expect(serviceProvider.runCommand).to.have.been.calledWith(
          ADMIN_DB,
          {
            fsyncUnlock: 1
          }
        );
      });

      it('returns whatever serviceProvider.runCommand returns', async() => {
        const expectedResult = { ok: 1 };
        serviceProvider.runCommand.resolves(expectedResult);
        const result = await database.fsyncUnlock();
        expect(result).to.deep.equal(expectedResult);
      });

      it('throws if serviceProvider.runCommand rejects', async() => {
        const expectedError = new Error();
        serviceProvider.runCommand.rejects(expectedError);
        const catchedError = await database.fsyncUnlock()
          .catch(e => e);
        expect(catchedError).to.equal(expectedError);
      });
    });
  });
});

