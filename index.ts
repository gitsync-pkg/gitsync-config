import * as fs from 'fs';
import {promises as fsp} from "fs";
import git from "git-cli-wrapper";
import * as emptyDir from 'empty-dir';

export interface ConfigConfig {
  baseDir: string
  repos: ConfigRepo[]
}

export interface ConfigRepo {
  target: string
  sourceDir: string
  targetDir?: string
  repoDir?: string

  [key: string]: any;
}

export class Config {
  protected configFile = '.gitsync.json';

  protected config: ConfigConfig = {
    baseDir: '.git/gitsync',
    repos: [],
  };

  protected hasFile: boolean;

  constructor() {
    this.hasFile = fs.existsSync(this.configFile);
    if (this.hasFile) {
      this.config = Object.assign(this.config, JSON.parse(fs.readFileSync(this.configFile, 'utf-8')));
    }
  };

  checkFileExist() {
    if (!this.hasFile) {
      throw new Error('Config file ".gitsync.json" does not exist.');
    }
  }

  getRepos() {
    return this.config.repos;
  }

  getBaseDir() {
    return this.config.baseDir;
  }

  getRepoBySourceDir(sourceDir: string) {
    let found = null;
    this.config.repos.forEach((repo) => {
      if (repo.sourceDir === sourceDir) {
        found = repo;
        return false;
      }
    });

    if (!found) {
      throw new Error(`Source directory "${sourceDir}" does not exist in config file.`)
    }

    return found;
  }

  getReposByFiles(changedFiles: string[]): ConfigRepo[] {
    let changedRepos: Record<string, ConfigRepo> = {};
    changedFiles.forEach((file) => {
      this.getRepos().forEach((repo) => {
        if (file.startsWith(repo.sourceDir)) {
          changedRepos[repo.sourceDir] = repo;
        }
      });
    });
    return Object.values(changedRepos);
  }

  /**
   * Detect repository directory from config
   *
   * @param repo
   * @param clone
   * @todo sourceDir is not required
   */
  async getRepoDirByRepo(repo: ConfigRepo, clone: boolean = false): Promise<string> {
    if (repo.repoDir) {
      clone && await this.cloneIfNew(repo.target, repo.repoDir);
      return repo.repoDir;
    }

    // Load from existing directory
    if (await this.isDir(repo.target)) {
      const repoInstance = git(repo.target);
      const result = await repoInstance.run(['rev-parse', '--is-bare-repository']);
      if (result === 'false') {
        return repo.target;
      }
    }

    // Convert from bare repository or remote URL
    const repoDir = this.getBaseDir() + '/' + repo.target.replace(/[:@/\\]/g, '-');
    clone && await this.cloneIfNew(repo.target, repoDir);

    return repoDir;
  }

  private async cloneIfNew(url: string, dir: string) {
    if (!fs.existsSync(dir)) {
      await fsp.mkdir(dir, {recursive: true});
    }

    if (await emptyDir(dir)) {
      await fsp.mkdir(dir, {recursive: true});
      await git(dir).run(['clone', url, '.']);
    }
  }

  private async isDir(dir: string) {
    try {
      return (await fsp.stat(dir)).isDirectory();
    } catch (e) {
      return false;
    }
  }
}
