import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import {Config, ConfigRepo, config as defaultConfig} from '..';
import {catchError, catchErrorSync, createRepo} from '@gitsync/test';
import git from "git-cli-wrapper";
import * as tmp from 'tmp-promise'

async function writeGitSyncConfig(config: {}) {
  return await util.promisify(fs.writeFile)('.gitsync.json', JSON.stringify(config));
}

async function unlinkGitSyncConfig() {
  if (await fs.existsSync('.gitsync.json')) {
    return await util.promisify(fs.unlink)('.gitsync.json');
  }
}

function withRealSourceDir(repos: ConfigRepo[]) {
  for (let repo of repos) {
    repo.realSourceDir = repo.sourceDir;
  }
  return repos;
}

afterEach(async () => {
  return await unlinkGitSyncConfig();
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
    expect(config.getRepos()).toEqual(withRealSourceDir(repos));
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

  test('filterReposBySourceDir', async () => {
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

    expect(config.filterReposBySourceDir(['packages/1'])).toEqual(withRealSourceDir([repos[0]]));
    expect(config.filterReposBySourceDir(['packages/*'])).toEqual(withRealSourceDir(repos));
    expect(config.filterReposBySourceDir([], ['packages/2'])).toEqual([repos[0]]);
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
    ])).toEqual(withRealSourceDir([repos[0]]));
  });

  test('getReposByFiles not exists', async () => {
    const config = new Config;
    const repos = config.getReposByFiles([]);
    expect(repos).toEqual([]);
  });

  test('getReposByFiles sourceDir contains custom name', async () => {
    const repos = [
      {
        sourceDir: 'packages/1#squash',
        target: 'packages-1'
      }
    ];
    await writeGitSyncConfig({repos: repos});
    const config = new Config();
    expect(config.getRepos()[0]).toEqual({
      sourceDir: 'packages/1#squash',
      realSourceDir: 'packages/1',
      target: 'packages-1'
    });
  });

  test('getReposByFiles sourceDir contains #', async () => {
    const repos = [
      {
        sourceDir: 'packages/1##squash',
        target: 'packages-1'
      }
    ];
    await writeGitSyncConfig({repos: repos});
    const config = new Config();
    expect(config.getRepos()[0]).toEqual({
      sourceDir: 'packages/1#squash',
      realSourceDir: 'packages/1#squash',
      target: 'packages-1'
    });
  });

  test('getReposByFiles sourceDir contains # and custom name', async () => {
    const repos = [
      {
        sourceDir: 'packages##/1#custom-name',
        target: 'packages-1'
      }
    ];
    await writeGitSyncConfig({repos: repos});
    const config = new Config();
    expect(config.getRepos()[0]).toEqual({
      sourceDir: 'packages#/1#custom-name',
      realSourceDir: 'packages#/1',
      target: 'packages-1'
    });
  });

  test('getReposByFiles sourceDir contains # and custom name', async () => {
    const repos = [
      {
        sourceDir: 'packages##/1#custom-name',
        target: 'packages-1'
      }
    ];
    await writeGitSyncConfig({repos: repos});
    const config = new Config();
    expect(config.getRepos()[0]).toEqual({
      sourceDir: 'packages#/1#custom-name',
      realSourceDir: 'packages#/1',
      target: 'packages-1'
    });
  });

  test('getReposByFiles sourceDir mix # and custom name', async () => {
    const repos = [
      {
        sourceDir: 'packages###custom-name',
        target: 'packages-1'
      }
    ];
    await writeGitSyncConfig({repos: repos});
    const config = new Config();
    expect(config.getRepos()[0]).toEqual({
      sourceDir: 'packages##custom-name',
      realSourceDir: 'packages#',
      target: 'packages-1'
    });
  });

  test('getRepoDirByRepo returns target repository', async () => {
    const target = await createRepo();

    const config = new Config;
    const repoDir = await config.getRepoDirByRepo({
      target: target.dir,
    }, true);

    expect(repoDir).toBe(target.dir);
  });

  test('getRepoDirByRepo returns repoDir property', async () => {
    const target = await createRepo();

    const config = new Config;
    const repoDir = await config.getRepoDirByRepo({
      target: target.dir,
      repoDir: target.dir + 'repoDir'
    }, true);

    expect(repoDir).toBe(target.dir + 'repoDir');
    expect(fs.existsSync(path.join(repoDir, '.git'))).toBeTruthy();
  });

  test('getRepoDirByRepo returns repoDir property when repoDir exists', async () => {
    const target = await createRepo();

    const repoDir = target.dir + 'repoDir';
    await fs.promises.mkdir(repoDir);

    const config = new Config;
    const result = await config.getRepoDirByRepo({
      target: target.dir,
      repoDir: target.dir + 'repoDir'
    }, true);

    expect(result).toBe(repoDir);
    expect(fs.existsSync(path.join(result, '.git'))).toBeTruthy();
  });

  test('getRepoDirByRepo returns target repository', async () => {
    const target = await createRepo();

    const config = new Config;
    const repoDir = await config.getRepoDirByRepo({
      target: target.dir,
    }, true);

    expect(repoDir).toBe(target.dir);
  });

  test('getRepoDirByRepo returns new directory', async () => {
    const target = await createRepo(true);

    const config = new Config;
    config.setBaseDir((await tmp.dir()).path);

    const repoDir = await config.getRepoDirByRepo({
      target: target.dir,
    }, true);

    expect(repoDir).toBe(path.join(config.getBaseDir(), path.basename(target.dir)));
    expect(fs.existsSync(path.join(repoDir, '.git'))).toBeTruthy();
  });

  test('getRepoDirByRepo target directory remote URL not matched', async () => {
    const targetBare = await createRepo(true);

    const config = new Config;
    config.setBaseDir((await tmp.dir()).path);

    const repoDir = await config.getRepoDirByRepo({
      target: targetBare.dir,
    }, true);

    const target = git(repoDir);
    await target.run(['remote', 'set-url', 'origin', 'https://github.com/user/repo.git']);

    const error = await catchError(async () => {
      return await config.getRepoDirByRepo({
        target: targetBare.dir,
      }, true);
    });

    expect(error).toEqual(new Error(`Expected repository remote URL of directory "${repoDir}" is "${targetBare.dir}"`
      + `, but got "https://github.com/user/repo.git", please specified \`repoDir\` or delete directory "${repoDir}"`));
  });

  test('getRepoDirByRepo repoDir not match target url', async () => {
    const targetBare = await createRepo(true);

    const config = new Config;
    config.setBaseDir((await tmp.dir()).path);

    const repoDir = await config.getRepoDirByRepo({
      target: targetBare.dir,
    }, true);

    const target = git(repoDir);
    await target.run(['remote', 'set-url', 'origin', 'https://github.com/user/repo.git']);

    const error = await catchError(async () => {
      return await config.getRepoDirByRepo({
        repoDir: repoDir,
        target: targetBare.dir,
      }, true);
    });

    expect(error).toEqual(new Error(`Expected repository remote URL of directory "${repoDir}" is "${targetBare.dir}"`
      + `, but got "https://github.com/user/repo.git", please specified another \`repoDir\` or delete directory "${repoDir}"`));
  });

  test('set baseDir from config', async () => {
    expect(defaultConfig.baseDir).toBe('');

    defaultConfig.baseDir = 'abc';
    const config = new Config();
    expect(config.getBaseDir()).toBe('abc');

    defaultConfig.baseDir = '';
  });
});
