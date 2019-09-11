import * as fs from 'fs';
import * as path from 'path';

export interface ConfigConfig {
  baseDir: string
  repos: ConfigRepo[]
}

export interface ConfigRepo {
  target: string
  sourceDir: string
  targetDir?: string
  [key: string]: unknown;
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

  getRepoDir(target: string): string {
    if (fs.existsSync(target)) {
      return target;
    }

    return path.join(this.getBaseDir(), target.replace(/[:@/\\]/g, '-'));
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
}
