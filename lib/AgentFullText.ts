import { PromptTemplate } from 'langchain/prompts';

import { AgentOptions, AbstractAgent } from './AbstractAgent';
import { OpenAIProvider } from './llm-providers/OpenAIProvider';
import { LLMProvider } from './llm-providers/LLMProvider';
import { FileCache } from './cache/FileCache';
import { CacheEngine } from './cache/CacheEngine';

/**
 * A very simple agent that only returns a raw text answer.
 *
 */
export abstract class AgentFullText<
  TProvider extends LLMProvider = LLMProvider
> extends AbstractAgent<TProvider> {
  protected abstract template: PromptTemplate;

  constructor(options: Partial<AgentOptions<TProvider>> = {}) {
    const cacheEngine =
      options.cacheEngine === undefined ? new FileCache() : options.cacheEngine;

    super({
      ...options,
      llmProvider:
        options.llmProvider ||
        // that's why I "love" typescript
        (new OpenAIProvider({
          cacheEngine,
        }) as unknown as TProvider),
    });
  }

  async run({
    modelName = 'gpt-4-1106-preview',
    temperature = 0.0,
  }: {
    modelName?: string;
    temperature?: number;
  } = {}): Promise<string> {
    const prompt = await this.formatPrompt();

    const answer = await this.llmProvider.call({
      agentName: this.name,
      model: modelName,
      prompt,
      temperature,
    });

    return answer;
  }

  async bombi({
    modelName = 'gpt-4-1106-preview',
    temperature = 0.0,
  }: {
    modelName?: string;
    temperature?: number;
  } = {}): Promise<string> {
    return this.run({ modelName, temperature });
  }
}
