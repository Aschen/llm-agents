import * as crypto from "node:crypto";

export abstract class CacheEngine {
  abstract get(cacheKey: string): Promise<string>;
  abstract has(cacheKey: string): Promise<boolean>;
  abstract set(cacheKey: string, content: string): Promise<void>;
  abstract delete(cacheKey: string): Promise<void>;

  public hash(data: string): string {
    const hash = crypto.createHash("sha512");
    hash.update(data);
    return hash.digest("hex").slice(0, 10);
  }
}
