import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';
import semver, { Range } from 'semver';
import type { AliasResult, Result } from 'npm-package-arg';

import type { PackageVersionRepository } from '../../repository/PackageVersionRepository.js';
import { getScopeAndName } from '../../common/PackageUtil.js';
import { SqlRange } from '../entity/SqlRange.js';
import type { BugVersionService } from './BugVersionService.js';
import type {
  PackageJSONType,
  PackageRepository,
} from '../../repository/PackageRepository.js';
import type { DistRepository } from '../../repository/DistRepository.js';
import type { BugVersionAdvice } from '../entity/BugVersion.js';
import type { PackageVersionBlockRepository } from '../../repository/PackageVersionBlockRepository.js';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionService {
  @Inject()
  private packageVersionRepository: PackageVersionRepository;

  @Inject()
  private packageRepository: PackageRepository;

  @Inject()
  private packageVersionBlockRepository: PackageVersionBlockRepository;

  @Inject()
  private readonly bugVersionService: BugVersionService;

  @Inject()
  private readonly distRepository: DistRepository;

  async readManifest(
    pkgId: string,
    spec: Result,
    isFullManifests: boolean,
    withBugVersion = true
  ): Promise<PackageJSONType | undefined> {
    const realSpec = this.findRealSpec(spec);
    let version = await this.getVersion(realSpec, false);
    if (!version) {
      return undefined;
    }
    let bugVersionAdvice:
      | {
          advice: BugVersionAdvice;
          version: string;
        }
      | undefined;
    if (withBugVersion) {
      const bugVersion = await this.bugVersionService.getBugVersion();
      if (bugVersion) {
        const advice = bugVersion.fixVersion(spec.name as string, version);
        if (advice) {
          bugVersionAdvice = {
            advice,
            version,
          };
          version = advice.version;
        }
      }
    }
    let manifest;
    if (isFullManifests) {
      manifest = await this.distRepository.findPackageVersionManifest(
        pkgId,
        version
      );
    } else {
      manifest = await this.distRepository.findPackageAbbreviatedManifest(
        pkgId,
        version
      );
    }
    if (manifest && bugVersionAdvice) {
      manifest.deprecated = `[WARNING] Use ${bugVersionAdvice.advice.version} instead of ${bugVersionAdvice.version}, reason: ${bugVersionAdvice.advice.reason}`;
      manifest.version = bugVersionAdvice.version;
    }
    return manifest;
  }

  private findRealSpec(spec: Result) {
    let realSpec: Result;
    switch (spec.type) {
      case 'alias':
        realSpec = (spec as AliasResult).subSpec;
        break;
      case 'version':
      case 'tag':
      case 'range':
        realSpec = spec;
        break;
      default:
        throw new Error(`cnpmcore not support spec: ${spec.raw}`);
    }
    return realSpec;
  }

  async getVersion(
    spec: Result,
    withBugVersion = true
  ): Promise<string | undefined | null> {
    let version: string | undefined | null;
    const [scope, name] = getScopeAndName(spec.name as string);
    const fetchSpec = spec.fetchSpec as string;
    // 优先通过 tag 来进行判断
    if (spec.type === 'tag') {
      version = await this.packageVersionRepository.findVersionByTag(
        scope,
        name,
        fetchSpec
      );
    } else if (spec.type === 'version') {
      // 1.0.0
      // '=1.0.0' => '1.0.0'
      // https://github.com/npm/npm-package-arg/blob/main/lib/npa.js#L392
      version = semver.valid(fetchSpec, true);
    } else if (spec.type === 'range') {
      // a@1.1 情况下，1.1 会解析为 range，如果有对应的 distTag 时会失效
      // 这里需要进行兼容
      // 仅当 spec 不为 version 时才查询，减少请求次数
      const versionMatchTag =
        await this.packageVersionRepository.findVersionByTag(
          scope,
          name,
          fetchSpec
        );
      if (versionMatchTag) {
        version = versionMatchTag;
      } else {
        const range = new Range(fetchSpec);
        const paddingSemVer = new SqlRange(range);
        if (paddingSemVer.containPreRelease) {
          const versions =
            await this.packageVersionRepository.findSatisfyVersionsWithPrerelease(
              scope,
              name,
              paddingSemVer
            );
          version = semver.maxSatisfying(versions, range);
        } else {
          version = await this.packageVersionRepository.findMaxSatisfyVersion(
            scope,
            name,
            paddingSemVer
          );
        }
      }
    }
    if (version && withBugVersion) {
      const bugVersion = await this.bugVersionService.getBugVersion();
      if (bugVersion) {
        const advice = bugVersion.fixVersion(spec.name as string, version);
        if (advice) {
          version = advice.version;
        }
      }
    }
    return version;
  }

  async findBlockInfo(fullname: string) {
    const [scope, name] = getScopeAndName(fullname);
    const packageId = await this.packageRepository.findPackageId(scope, name);
    if (!packageId) {
      return null;
    }
    return await this.packageVersionBlockRepository.findPackageBlock(packageId);
  }
}
