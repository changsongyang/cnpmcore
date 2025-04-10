import assert from 'node:assert/strict';
import { app, mock } from '@eggjs/mock/bootstrap';

import { BUG_VERSIONS } from '../../../app/common/constants.js';
import { CacheService } from '../../../app/core/service/CacheService.js';
import { BugVersionFixHandler } from '../../../app/core/event/BugVersionFixHandler.js';
import { BugVersion } from '../../../app/core/entity/BugVersion.js';
import { BugVersionService } from '../../../app/core/service/BugVersionService.js';

describe('test/core/event/BugVersionFixHandler.test.ts', () => {
  let cacheService: CacheService;
  let bugVersionService: BugVersionService;
  const fullnames: string[] = [];

  beforeEach(async () => {
    cacheService = await app.getEggObject(CacheService);
    bugVersionService = await app.getEggObject(BugVersionService);
    mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
    mock(cacheService, 'removeCache', async (fullname: string) => {
      fullnames.push(fullname);
    });
    mock(bugVersionService, 'getBugVersion', async () => {
      return new BugVersion({
        faker: {
          '6.6.6': {
            version: '5.5.3',
            reason:
              'Please use https://github.com/MilosPaunovic/community-faker instead',
          },
        },
      });
    });
  });

  it('should clean packages cache', async () => {
    const bugVersionFixHandler = await app.getEggObject(BugVersionFixHandler);
    await bugVersionFixHandler.handle(BUG_VERSIONS);
    assert.deepStrictEqual(fullnames, ['faker']);
  });
});
