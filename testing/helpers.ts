import util from 'util';
import {expect} from 'chai';

const delay = util.promisify(setTimeout);
export const ensureMaster = async(cls, timeout, cfg): Promise<void> => {
  while (!(await cls.isMaster()).ismaster) {
    if (timeout > 32000) {
      return expect.fail(`Waited for ${cfg.members[0].host} to become master, never happened`);
    }
    await delay(timeout);
    timeout *= 2; // try again but wait double
  }
};

const localSessionIds = async(mongo) => {
  return (await (await mongo.getDB('config').aggregate([{ $listLocalSessions: {} }])).toArray()).map(k => JSON.stringify(k._id.id));
};

export const ensureSessionExists = async(mongo, timeout, sessionId): Promise<void> => {
  let ls = await localSessionIds(mongo);
  while (!ls.includes(sessionId)) {
    if (timeout > 32000) {
      throw new Error(`Waited for session id ${sessionId}, never happened ${ls}`);
    }
    await delay(timeout);
    timeout *= 2; // try again but wait double
    ls = await localSessionIds(mongo);
  }
};

