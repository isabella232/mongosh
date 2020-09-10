export enum ServerVersions {
  latest = '4.4.0',
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
// TODO: Would require changes to java-shell
// export const asPrintable = Symbol('asPrintable');
export const asShellResult = Symbol.for('@@mongosh.asShellResult');

export const ADMIN_DB = 'admin';
