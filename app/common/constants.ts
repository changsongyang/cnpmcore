export const BUG_VERSIONS = 'bug-versions';
export const LATEST_TAG = 'latest';
export const GLOBAL_WORKER = 'GLOBAL_WORKER';
export const PROXY_CACHE_DIR_NAME = 'proxy-cache-packages';
export const ABBREVIATED_META_TYPE = 'application/vnd.npm.install-v1+json';
export const NOT_IMPLEMENTED_PATH = [ '/-/npm/v1/security/audits/quick', '/-/npm/v1/security/advisories/bulk' ];

export enum SyncMode {
  none = 'none',
  admin = 'admin',
  proxy = 'proxy',
  exist = 'exist',
  all = 'all',
}
export enum ChangesStreamMode {
  json = 'json',
  streaming = 'streaming',
}
export enum SyncDeleteMode {
  ignore = 'ignore',
  block = 'block',
  delete = 'delete',
}

export enum PresetRegistryName {
  default = 'default',
  self = 'self',
}

export enum PackageAccessLevel {
  write = 'write',
  read = 'read',
}
