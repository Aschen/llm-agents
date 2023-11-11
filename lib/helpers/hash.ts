import * as crypto from 'node:crypto';

export function hashString(data: string): string {
  const hash = crypto.createHash('md5');
  hash.update(data);
  return hash.digest('hex').slice(0, 10);
}
