export enum ServerVersions {
  latest = '999.999.999', // set a really high max value
  earliest = '0.0.0'
}

export enum Topologies {
  ReplSet = 0,
  Standalone = 1,
  Sharded = 2
}

import { ReplPlatform } from '@mongosh/service-provider-core';

export const ALL_SERVER_VERSIONS = [ ServerVersions.earliest, ServerVersions.latest ];
export const ALL_TOPOLOGIES = [ Topologies.ReplSet, Topologies.Sharded, Topologies.Standalone ];
export const ALL_PLATFORMS = [ ReplPlatform.Compass, ReplPlatform.Browser, ReplPlatform.CLI ];

export enum DBQueryOption {
  tailable = 2,
  slaveOk = 4,
  oplogReplay = 8,
  noTimeout = 16,
  awaitData = 32,
  exhaust = 64,
  partial = 128
}

export const shellApiType = Symbol.for('@@mongosh.shellApiType');
export const asPrintable = Symbol.for('@@mongosh.asPrintable');
export const namespaceInfo = Symbol.for('@@mongosh.namespaceInfo');

export const ADMIN_DB = 'admin';
