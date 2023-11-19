import { mkdirSync } from 'node:fs';
import {
  access,
  constants,
  writeFile,
  readFile,
  unlink,
  stat,
} from 'node:fs/promises';
import * as Path from 'path';

import { CacheEngine } from './CacheEngine';

export class FileCache extends CacheEngine {
  public async get(cacheKey: string) {
    return readFile(cacheKey, 'utf-8');
  }

  public async has(cacheKey: string) {
    try {
      await access(cacheKey, constants.W_OK | constants.R_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  public async set(cacheKey: string, content: string) {
    const dirname = Path.dirname(cacheKey);

    if (!(await this.isDirectory(dirname))) {
      mkdirSync(dirname, { recursive: true });
    }

    const fullPath = cacheKey;

    console.log(`FileCache: write ${fullPath}`);

    return writeFile(fullPath, content);
  }

  public async delete(cacheKey: string) {
    await unlink(cacheKey);
  }

  private async isDirectory(dirname: string) {
    try {
      const info = await stat(dirname);

      return info.isDirectory();
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }

      throw error;
    }
  }
}
