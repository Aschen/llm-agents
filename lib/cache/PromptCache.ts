import * as Path from 'node:path';

import { hashString } from '../helpers/hash';
import { CacheEngine } from './CacheEngine';

export class PromptCache {
  private engine: CacheEngine | null;
  private promptStep: number = -1;
  private cachePath: string;

  constructor({
    cacheEngine,
    cachePath = '.cache',
  }: {
    cacheEngine?: CacheEngine;
    cachePath?: string;
  }) {
    this.engine = cacheEngine;
    this.cachePath = cachePath;
  }

  public step() {
    this.promptStep += 1;
  }

  public async get({
    prompt,
    agentName = '',
  }: {
    prompt: string;
    agentName?: string;
  }): Promise<string | null> {
    if (!this.engine) {
      return null;
    }

    const answerCacheKey = this.cacheKey({ agentName, type: 'answer', prompt });

    if (await this.engine.has(answerCacheKey)) {
      console.log(`PromptCache: use cached answer ${answerCacheKey}`);
      return this.engine.get(answerCacheKey);
    }

    return null;
  }

  public async save({
    prompt,
    answer,
    agentName = '',
  }: {
    prompt: string;
    answer: string;
    agentName?: string;
  }): Promise<void> {
    if (!this.engine) {
      return;
    }

    const answerCacheKey = this.cacheKey({ agentName, type: 'answer', prompt });
    const promptCacheKey = this.cacheKey({ agentName, type: 'prompt', prompt });

    await this.engine.set(promptCacheKey, prompt);
    await this.engine.set(answerCacheKey, answer);
  }

  public cacheKey({
    prompt,
    type,
    agentName,
  }: {
    prompt: string;
    type: 'prompt' | 'answer';
    agentName: string;
  }): string {
    const promptHash = hashString(prompt);

    return Path.join(
      this.cachePath,
      agentName,
      `${this.promptStep}-${promptHash}-${type}.txt`
    );
  }
}
