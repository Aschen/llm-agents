import { mkdirSync } from "node:fs";
import {
  access,
  constants,
  writeFile,
  readFile,
  unlink,
  stat,
} from "node:fs/promises";
import * as Path from "path";

import { CacheEngine } from "./CacheEngine";

export class FileCache extends CacheEngine {
  public cacheDir: string;

  constructor({ cacheDir = ".cache" }: { cacheDir?: string } = {}) {
    super();

    this.cacheDir = cacheDir;

    mkdirSync(cacheDir, { recursive: true });
  }

  public async get(cacheKey: string) {
    return readFile(Path.join(this.cacheDir, cacheKey), "utf-8");
  }

  public async has(cacheKey: string) {
    try {
      await access(
        Path.join(this.cacheDir, cacheKey),
        constants.W_OK | constants.R_OK
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  public async set(cacheKey: string, content: string) {
    const dirname = Path.dirname(Path.join(this.cacheDir, cacheKey));

    if (!(await this.isDirectory(dirname))) {
      mkdirSync(dirname, { recursive: true });
    }

    return writeFile(Path.join(this.cacheDir, cacheKey), content);
  }

  public async delete(cacheKey: string) {
    await unlink(Path.join(this.cacheDir, cacheKey));
  }

  private async isDirectory(dirname: string) {
    try {
      const info = await stat(dirname);

      return info.isDirectory();
    } catch (error) {
      if (error.code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }
}
