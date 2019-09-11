import * as fs from 'fs';
import * as util from 'util';
import {Config} from '..';
import {catchError, catchErrorSync} from '@gitsync/test';

async function writeGitSyncConfig(config: {}) {
  return await util.promisify(fs.writeFile)('.gitsync.json', JSON.stringify(config));
}

async function unlinkGitSyncConfig() {
  if (await fs.existsSync('.gitsync.json')) {
    return await util.promisify(fs.unlink)('.gitsync.json');
  }
}

afterEach(async () => {
  await unlinkGitSyncConfig();
});

describe('gitsync-config', () => {
  test('checkFileExist exists', async () => {
    await writeGitSyncConfig({});
    const config = new Config;
    expect(catchErrorSync(config.checkFileExist.bind(config))).toBeUndefined();
  });

  test('checkFileExist not exists', async () => {
    const config2 = new Config;
    expect(catchErrorSync(config2.checkFileExist.bind(config2))).toEqual(new Error('Config file ".gitsync.json" does not exist.'));
  });

  test('getRepos empty', async () => {
    const config = new Config;
    expect(config.getRepos()).toEqual([]);
  });

  test('getRepos not empty', async () => {
    const repos = [
      {
        sourceDir: 'packages/1',
        target: '../packages-1'
      }
    ];
    await writeGitSyncConfig({repos: repos});
    const config = new Config();
    expect(config.getRepos()).toEqual(repos);
  });

  test('getRepoDir', () => {
    const config = new Config;

    expect(config.getRepoDir('git@github.com:gitsync-pkg/gitsync-config.git'))
      .toBe('.git/gitsync/git-github.com-gitsync-pkg-gitsync-config.git');

    expect(config.getRepoDir('https://github.com/gitsync-pkg/gitsync-config.git'))
      .toBe('.git/gitsync/https---github.com-gitsync-pkg-gitsync-config.git');
  });

  test('getBaseDir default', async () => {
    const config = new Config();
    expect(config.getBaseDir()).toBe('.git/gitsync');
  });

  test('getBaseDir custom', async () => {
    await writeGitSyncConfig({baseDir: 'gitsync'});
    const config = new Config();
    expect(config.getBaseDir()).toBe('gitsync');
  });

  test('getRepoBySourceDir exists', async () => {
    const repos = [
      {
        sourceDir: 'packages/1',
        target: '../packages-1'
      },
      {
        sourceDir: 'packages/2',
        target: '../packages-2'
      }
    ];
    await writeGitSyncConfig({repos: repos});
    const config = new Config();
    expect(config.getRepoBySourceDir('packages/2')).toEqual(repos[1]);
  });

  test('getRepoBySourceDir not exists', async () => {
    const config = new Config;
    const error = catchErrorSync(() => {
      config.getRepoBySourceDir('test')
    });
    expect(error).toEqual(new Error('Source directory "test" does not exist in config file.'));
  });

  test('getReposByFiles exists', async () => {
    const repos = [
      {
        sourceDir: 'packages/1',
        target: '../packages-1'
      },
      {
        sourceDir: 'packages/2',
        target: '../packages-2'
      }
    ];
    await writeGitSyncConfig({repos: repos});
    const config = new Config();
    expect(config.getReposByFiles([
      'packages/1/test.txt'
    ])).toEqual([repos[0]]);
  });

  test('getReposByFiles not exists', async () => {
    const config = new Config;
    const repos = config.getReposByFiles([]);
    expect(repos).toEqual([]);
  });
});
