import { expect } from 'chai';
import Session from './session';
import { ServiceProvider, ServiceProviderSession } from '@mongosh/service-provider-core';
import { StubbedInstance, stubInterface } from 'ts-sinon';
import ShellInternalState from './shell-internal-state';
import { signatures, toShellResult } from './index';
import Mongo from './mongo';
import {
  ADMIN_DB,
  ALL_PLATFORMS,
  ALL_SERVER_VERSIONS,
  ALL_TOPOLOGIES
} from './enums';
import { CliServiceProvider } from '../../service-provider-server';
import { startTestCluster } from '../../../testing/integration-testing-hooks';
import util from 'util';
import Database from './database';

describe('Session', () => {
  describe('help', () => {
    const apiClass = new Session({} as Mongo, {}, {} as ServiceProviderSession);
    it('calls help function', async() => {
      expect((await toShellResult(apiClass.help())).type).to.equal('Help');
      expect((await toShellResult(apiClass.help)).type).to.equal('Help');
    });
  });
  describe('signature', () => {
    it('signature for class correct', () => {
      expect(signatures.Session.type).to.equal('Session');
      expect(signatures.Session.hasAsyncChild).to.equal(true);
    });
    it('map signature', () => {
      expect(signatures.Session.attributes.endSession).to.deep.equal({
        type: 'function',
        returnsPromise: true,
        returnType: { type: 'unknown', attributes: {} },
        platforms: ALL_PLATFORMS,
        topologies: ALL_TOPOLOGIES,
        serverVersions: ALL_SERVER_VERSIONS
      });
    });
  });
  describe('instance', () => {
    let serviceProviderSession: StubbedInstance<ServiceProviderSession>;
    let mongo: StubbedInstance<Mongo>;
    let options;
    let session: Session;
    beforeEach(() => {
      options = {
        causalConsistency: false,
        readConcern: { level: 'majority' },
        writeConcern: { w: 1, j: false, wtimeout: 0 },
        readPreference: { mode: 'primary', tagSet: [] }
      };
      serviceProviderSession = stubInterface<ServiceProviderSession>();
      serviceProviderSession.id = { id: 1 };
      mongo = stubInterface<Mongo>();
      mongo._serviceProvider = stubInterface<ServiceProvider>();
      session = new Session(mongo, options, serviceProviderSession);
    });

    it('sets dynamic properties', async() => {
      expect((await toShellResult(session)).type).to.equal('Session');
      expect((await toShellResult(session)).printable).to.deep.equal(serviceProviderSession.id);
      expect((await toShellResult(session.help)).type).to.equal('Help');
    });
    it('getDatabase', () => {
      const db = session.getDatabase('test');
      expect(db).to.deep.equal(new Database(mongo, 'test', session));
      expect(session.getDatabase('test')).to.equal(db); // reuses db
    });
    it('advanceOperationTime', () => {
      const ts = { ts: 1 } as any;
      session.advanceOperationTime(ts);
      expect(serviceProviderSession.advanceOperationTime).to.have.been.calledOnceWith(ts);
    });
    it('advanceClusterTime', () => {
      try {
        session.advanceClusterTime();
      } catch (e) {
        return expect(e.name).to.equal('MongoshUnimplementedError');
      }
      expect.fail('Error not thrown');
    });
    it('endSession', () => {
      session.endSession();
      expect(serviceProviderSession.endSession).to.have.been.calledOnceWith();
    });
    it('getClusterTime', () => {
      serviceProviderSession.clusterTime = 100;
      expect(session.getClusterTime()).to.equal(100);
    });
    it('getOperationTime', () => {
      serviceProviderSession.operationTime = 200;
      expect(session.getOperationTime()).to.equal(200);
    });
    it('hasEnded', () => {
      serviceProviderSession.hasEnded = 100 as any; // mystery: testing with false makes this error bc of the spy
      expect(session.hasEnded()).to.equal(100);
    });
    it('startTransaction', () => {
      serviceProviderSession.startTransaction.returns();
      session.startTransaction({ readPreference: options.readPreference });
      expect(serviceProviderSession.startTransaction).to.have.been.calledOnceWith({ readPreference: options.readPreference });
    });
    it('commitTransaction', () => {
      serviceProviderSession.commitTransaction.resolves();
      session.commitTransaction();
      expect(serviceProviderSession.commitTransaction).to.have.been.calledOnceWith();
    });
    it('abortTransaction', () => {
      serviceProviderSession.abortTransaction.resolves();
      session.abortTransaction();
      expect(serviceProviderSession.abortTransaction).to.have.been.calledOnceWith();
    });
  });
  describe('integration', () => {
    const replId = 'rs0';

    const testServers = startTestCluster(
      ['--single', '--replSet', replId],
      ['--single', '--replSet', replId],
      ['--single', '--replSet', replId],
      ['--single', '--replSet', replId]
    );
    let cfg: {_id: string, members: {_id: number, host: string, priority: number}[]};
    let serviceProvider: CliServiceProvider;
    let internalState: ShellInternalState;
    let mongo: Mongo;
    let session: Session;

    const delay = util.promisify(setTimeout);
    const ensureMaster = async(timeout): Promise<void> => {
      while (!(await mongo.getDB(ADMIN_DB).isMaster()).ismaster) {
        if (timeout > 32000) {
          return expect.fail(`Waited for ${cfg.members[0].host} to become master, never happened`);
        }
        await delay(timeout);
        timeout *= 2; // try again but wait double
      }
    };

    const localSessionIds = async() => {
      return (await (await mongo.getDB('config').aggregate([{ $listLocalSessions: {} }])).toArray()).map(k => JSON.stringify(k._id.id));
    };

    const ensureSessionExists = async(timeout, sessionId): Promise<void> => {
      let ls = await localSessionIds();
      while (!ls.includes(sessionId)) {
        if (timeout > 32000) {
          throw new Error(`Waited for session id ${sessionId}, never happened ${ls}`);
        }
        await delay(timeout);
        timeout *= 2; // try again but wait double
        ls = await localSessionIds();
      }
    };

    before(async function() {
      this.timeout(100_000);
      const [ srv0, srv1, srv2 ] = await Promise.all(testServers);
      cfg = {
        _id: replId,
        members: [
          { _id: 0, host: `${srv0.host()}:${srv0.port()}`, priority: 1 },
          { _id: 1, host: `${srv1.host()}:${srv1.port()}`, priority: 0 },
          { _id: 2, host: `${srv2.host()}:${srv2.port()}`, priority: 0 }
        ]
      };
      serviceProvider = await CliServiceProvider.connect(srv0.connectionString());
      await serviceProvider.runCommand(ADMIN_DB, { replSetInitiate: cfg });
      internalState = new ShellInternalState(serviceProvider);
      mongo = new Mongo(internalState);
    });

    beforeEach(async() => {
      await ensureMaster(1000);
    });

    afterEach(async() => {
      await session.endSession();
    });

    after(() => {
      return serviceProvider.close(true);
    });

    describe('server starts and stops sessions', () => {
      it('starts a session', async() => {
        session = mongo.startSession();
        await session.getDatabase('test').getCollection('coll').insertOne({});
        await ensureSessionExists(1000, JSON.stringify(session.id.id));
        expect(session.hasEnded()).to.be.false;
        await session.endSession();
        expect(session.hasEnded()).to.be.true;
        try {
          await session.getDatabase('test').getCollection('coll').insertOne({});
        } catch (e) {
          return expect(e.message).to.include('expired sessions');
        }
        expect.fail('Error not thrown');
      });
      it('handles multiple sessions', async() => {
        const sessions = [
          mongo.startSession(),
          mongo.startSession(),
          mongo.startSession()
        ];
        for (const s of sessions) {
          await s.getDatabase('test').getCollection('coll').insertOne({});
          expect(s.hasEnded()).to.be.false;
          await ensureSessionExists(1000, JSON.stringify(s.id.id));
        }
        for (const s of sessions) {
          await s.endSession();
          expect(s.hasEnded()).to.be.true;
          try {
            await s.getDatabase('test').getCollection('coll').insertOne({});
          } catch (e) {
            expect(e.message).to.include('expired sessions');
            continue;
          }
          expect.fail('Error not thrown');
        }
      });
      it('errors if session expired', async() => {
        session = mongo.startSession();
        await session.endSession();
        try {
          await session.getDatabase('test').getCollection('coll').insertOne({});
        } catch (e) {
          return expect(e.message).to.include('expired');
        }
        expect.fail('Error not thrown');
      });
    });
    describe('transaction methods are called', () => {
      it('cannot call start transaction twice', async() => {
        session = mongo.startSession();
        session.startTransaction();
        try {
          session.startTransaction();
        } catch (e) {
          return expect(e.message).to.include('in progress');
        }
        expect.fail('Error not thrown');
      });
      it('cannot abort when not started', async() => {
        session = mongo.startSession();
        try {
          await session.abortTransaction();
        } catch (e) {
          return expect(e.message).to.include('transaction started');
        }
        expect.fail('Error not thrown');
      });
      it('cannot commit when not started', async() => {
        session = mongo.startSession();
        try {
          await session.commitTransaction();
        } catch (e) {
          return expect(e.message).to.include('transaction started');
        }
        expect.fail('Error not thrown');
      });
      it('commits a transaction', async() => {
        const doc = { value: 'test', count: 0 };
        const testColl = mongo.getDB('test').getCollection('coll');
        await testColl.drop();
        await testColl.insertOne(doc);
        expect((await testColl.findOne({ value: 'test' })).count).to.equal(0);
        session = mongo.startSession();
        session.startTransaction();
        const sessionColl = session.getDatabase('test').getCollection('coll');
        expect((await sessionColl.updateOne(
          { value: 'test' },
          { $inc: { count: 1 } }
        )).acknowledged).to.be.true;
        expect((await testColl.findOne({ value: 'test' })).count).to.equal(0);
        await session.commitTransaction();
        expect((await testColl.findOne({ value: 'test' })).count).to.equal(1);
      });
      it('aborts a transaction', async() => {
        const doc = { value: 'test', count: 0 };
        const testColl = mongo.getDB('test').getCollection('coll');
        await testColl.drop();
        await testColl.insertOne(doc);
        expect((await testColl.findOne({ value: 'test' })).count).to.equal(0);
        session = mongo.startSession();
        session.startTransaction();
        const sessionColl = session.getDatabase('test').getCollection('coll');
        expect((await sessionColl.updateOne(
          { value: 'test' },
          { $inc: { count: 1 } }
        )).acknowledged).to.be.true;
        expect((await testColl.findOne({ value: 'test' })).count).to.equal(0);
        await session.abortTransaction();
        expect((await testColl.findOne({ value: 'test' })).count).to.equal(0);
      });
    });
    describe('after resetting connection will error with expired session', () => {
      it('reset connection options', async() => {
        session = mongo.startSession();
        await mongo.setReadConcern('majority');
        try {
          await session.getDatabase('test').getCollection('coll').insertOne({});
        } catch (e) {
          return expect(e.message).to.include('expired');
        }
      });
      it('authentication', async() => {
        await mongo.getDB('test').createUser({ user: 'anna', pwd: 'pwd', roles: [] });
        session = mongo.startSession();
        await mongo.getDB('test').auth('anna', 'pwd');
        try {
          await session.getDatabase('test').getCollection('coll').insertOne({});
        } catch (e) {
          await mongo.getDB('test').logout();
          return expect(e.message).to.include('expired');
        }
      });
    });
  });
});

