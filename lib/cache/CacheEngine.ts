import * as crypto from 'node:crypto';

export abstract class CacheEngine {
  abstract get(cacheKey: string): Promise<string>;
  abstract has(cacheKey: string): Promise<boolean>;
  abstract set(cacheKey: string, content: string): Promise<void>;
  abstract delete(cacheKey: string): Promise<void>;
}
