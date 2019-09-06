import * as fs from 'fs';
import * as path from 'path';

export interface ConfigConfig {
  baseDir: string
  repos: ConfigRepo[]
}

export interface ConfigRepo {
  sourceDir: string
  target: string
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

  getRepoDir(repo: string): string {
    if (fs.existsSync(repo)) {
      return repo;
    }

    return path.join(this.getBaseDir(), repo.replace(/[:@/\\]/g, '-'));
  }

  getBaseDir() {
    return this.config.baseDir;
  }

  getRepoByDir(path: string) {
    let repo = null;
    this.config.repos.forEach((config) => {
      if (config.sourceDir === path) {
        repo = config.target;
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
        if (file.startsWith(repo.sourceDir)) {
          changedRepos[repo.sourceDir] = repo;
        }
      });
    });
    return Object.values(changedRepos);
  }
}
