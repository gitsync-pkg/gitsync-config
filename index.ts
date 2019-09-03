import * as fs from 'fs';
import * as path from 'path';

export interface ConfigConfig {
  baseDir: string
  repos: ConfigRepo[]
}

export interface ConfigRepo {
  paths: string
  repo: string
}

export class Config {
  protected configFile = '.gitsync.json';

  protected config: ConfigConfig = {
    baseDir: '.git/gitsync',
    repos: [],
  };

  constructor() {
    if (!fs.existsSync(this.configFile)) {
      throw new Error(`Config file "${this.configFile}" does not exist.`);
    }
    this.config = Object.assign(this.config, JSON.parse(fs.readFileSync(this.configFile, 'utf-8')));
  };

  getRepos() {
    return this.config.repos;
  }

  getRepoDir(repo: string): string {
    if (fs.existsSync(repo)) {
      return repo;
    }

    return path.join(this.getBaseDir(), repo.replace(/:\/@/g, '-'));
  }

  getBaseDir() {
    return this.config.baseDir;
  }

  getRepoByPath(path: string) {
    let repo = null;
    this.config.repos.forEach((config) => {
      if (config.paths === path) {
        repo = config.repo;
        return false;
      }
    });

    if (!repo) {
      throw new Error(`Path "${path}" does not exist in config file.`)
    }

    return repo;
  }

  getReposByFiles(changedFiles: string[]): ConfigRepo[] {
    let changedRepos: Record<string, ConfigRepo> = {};
    changedFiles.forEach((file) => {
      this.getRepos().forEach((repo) => {
        if (file.includes(repo.paths)) {
          changedRepos[repo.paths] = repo;
        }
      });
    });
    return Object.values(changedRepos);
  }
}
