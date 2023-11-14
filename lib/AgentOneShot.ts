import { PromptTemplate } from 'langchain/prompts';

import {
  AgentOptions,
  AbstractAgent,
  AgentAvailableModels,
} from './AbstractAgent';
import { LLMAnswer } from './instructions/LLMAnswer';
import { AgentParseError } from './AgentParseError';

export abstract class AgentOneShot<
  TLLMAnswer extends LLMAnswer = LLMAnswer
> extends AbstractAgent {
  protected abstract template: PromptTemplate;

  constructor(options: AgentOptions = {}) {
    super(options);
  }

  async run({
    modelName = 'gpt-4-1106-preview',
    temperature = 0.0,
  }: {
    modelName?: AgentAvailableModels;
    temperature?: number;
  } = {}): Promise<TLLMAnswer[]> {
    const prompt = await this.formatPrompt({
      instructionsDescription: this.describeInstructions(),
    });

    const answer = await this.callModel({
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
            answerKey: this.cacheKey({ type: 'answer', prompt }),
            promptKey: this.cacheKey({ type: 'prompt', prompt }),
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
