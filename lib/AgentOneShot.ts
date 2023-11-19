import { PromptTemplate } from 'langchain/prompts';

import { AgentOptions, AbstractAgent } from './AbstractAgent';
import { LLMAnswer } from './instructions/LLMAnswer';
import { AgentParseError } from './AgentParseError';
import { OpenAIProvider } from './llm-providers/OpenAIProvider';
import { PromptCache } from './cache/PromptCache';
import { LLMProvider } from './llm-providers/LLMProvider';
import { kebabCase } from './helpers/string';

export abstract class AgentOneShot<
  TLLMAnswer extends LLMAnswer = LLMAnswer,
  TProvider extends LLMProvider = LLMProvider
> extends AbstractAgent<TProvider> {
  protected abstract template: PromptTemplate;

  constructor(options: Partial<AgentOptions<TProvider>>) {
    const promptCache = new PromptCache({
      cacheEngine: options.cacheEngine,
    });

    super({
      ...options,
      llmProvider:
        options.llmProvider ||
        // that's why I "love" typescript
        (new OpenAIProvider({
          cacheEngine: options.cacheEngine,
        }) as unknown as TProvider),
    });
  }

  async run({
    modelName = 'gpt-4-1106-preview',
    temperature = 0.0,
  }: {
    modelName?: string;
    temperature?: number;
  } = {}): Promise<TLLMAnswer[]> {
    const prompt = await this.formatPrompt({
      instructionsDescription: this.describeInstructions(),
    });

    const answer = await this.llmProvider.call({
      agentName: this.name,
      model: modelName,
      prompt,
      temperature,
    });

    let answers: LLMAnswer[];

    while (!answers) {
      try {
        answers = this.extractInstructions({ answer });
      } catch (error) {
        if (this.tries === 0) {
          throw new AgentParseError({
            message: error.message,
            answerKey: this.promptCache.cacheKey({ type: 'answer', prompt }),
            promptKey: this.promptCache.cacheKey({ type: 'prompt', prompt }),
          });
        }

        this.tries--;
        continue;
      }
    }

    // If user registered actions, execute them
    for (const answer of answers) {
      const action = this.findAction({ answer });

      if (!action) {
        continue;
      }

      const feedback = await this.executeAction({ answer });

      if (feedback.type === 'error') {
        this.actionsErrorCount++;
      } else {
        this.actionsCount++;
      }
    }

    return answers as TLLMAnswer[];
  }
}
