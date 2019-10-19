import * as fs from 'fs';
import * as path from 'path';
import {promises as fsp} from "fs";
import git from "git-cli-wrapper";
import * as emptyDir from 'empty-dir';
import * as micromatch from 'micromatch';
import log from "@gitsync/log";

export interface ConfigConfig {
  baseDir: string
  repos: ConfigRepo[]
}

export interface ConfigRepo {
  target: string
  sourceDir: string
  targetDir?: string
  repoDir?: string
  addTagPrefix?: string
  removeTagPrefix?: string
  squash?: boolean

  realSourceDir?: string

  [key: string]: any;
}

export interface TargetDirConfig {
  target: string
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
      this.config.repos.forEach((repo) => {
        repo.realSourceDir = this.getRealSourceDir(repo.sourceDir);
      });
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

  setBaseDir(baseDir: string) {
    this.config.baseDir = baseDir;
    return this;
  }

  filterReposBySourceDir(include: string[], exclude: string[] = []) {
    if (!include.length && !exclude.length) {
      return this.config.repos;
    }

    const patterns = this.createPatterns(include, exclude);

    // @ts-ignore patterns: string[]
    const repos = this.config.repos.filter(repo => micromatch.isMatch(repo.sourceDir, patterns));
    if (!repos.length) {
      log.warn(`No directories found after filtering "${patterns}"`);
    }
    return repos;
  }

  getReposByFiles(changedFiles: string[]): ConfigRepo[] {
    let changedRepos: Record<string, ConfigRepo> = {};
    changedFiles.forEach((file) => {
      this.getRepos().forEach((repo) => {
        if (file.startsWith(repo.realSourceDir)) {
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
   */
  async getRepoDirByRepo(repo: TargetDirConfig, clone: boolean = false): Promise<string> {
    if (repo.repoDir) {
      await this.checkRepoDirUrl(repo.repoDir, repo.target, true);
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
    const repoName = this.getRepoName(repo.target);
    const repoDir = path.join(this.getBaseDir(), repoName);
    await this.checkRepoDirUrl(repoDir, repo.target);
    clone && await this.cloneIfNew(repo.target, repoDir);

    return repoDir;
  }

  private async checkRepoDirUrl(repoDir: string, url: string, hasRepoDir: boolean = false) {
    if (await this.isDir(repoDir) && !await emptyDir(repoDir)) {
      const repoInstance = git(repoDir);
      const configUrl = await repoInstance.run(['config', '--get', 'remote.origin.url']);
      if (configUrl !== url) {
        throw new Error(`Expected repository remote URL of directory "${repoDir}" is "${url}"`
          + `, but got "${configUrl}", `
          + `please specified ${hasRepoDir ? 'another ' : ''}\`repoDir\` or delete directory "${repoDir}"`);
      }
    }
  }

  private getRepoName(url: string) {
    let name = url.substr(url.lastIndexOf('/') + 1);
    if (name.endsWith('.git')) {
      name = name.substr(0, name.length - 4);
    }
    return name;
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

  private createPatterns(include: string[], exclude: string[]): string[] {
    return include.concat(exclude.map(item => '!' + item));
  }

  private getRealSourceDir(dir: string) {
    return dir.replace(/\\#/g, '//').split('#')[0].replace(/\/\//g, '#');
  }
}
