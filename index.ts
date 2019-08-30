import * as fs from 'fs';
import * as path from 'path';

export interface ConfigConfig {
  repos: ConfigRepo[]
  cacheDir: string
}

export interface ConfigRepo {
  dir: string
  remote: string
}

export class Config {
  protected configFile = '.git-sync.json';

  protected config: ConfigConfig = {
    repos: [],
    cacheDir: '.git-sync',
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

  getRepoDir(remote: string): string {
    if (fs.existsSync(remote)) {
      return remote;
    }

    return path.join(this.getBaseDir(), remote.replace(/:\/@/g, '-'));
  }

  getBaseDir() {
    return this.config.cacheDir || '.git-sync';
  }

  getRemoteByDir(dir: string) {
    let remote = null;
    this.config.repos.forEach((repo) => {
      if (repo.dir === dir) {
        remote = repo.remote;
        return false;
      }
    });

    if (!remote) {
      throw new Error(`Directory "${dir}" does not exist in config file.`)
    }

    return remote;
  }
}
