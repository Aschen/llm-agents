import { PromptTemplate } from 'langchain/prompts';

import { AgentParseError } from './AgentParseError';
import { AgentOptions, AbstractAgent } from './AbstractAgent';
import { LLMAnswer } from './instructions/LLMAnswer';
import { Action } from './instructions/Action';
import { ActionDone } from './instructions/ActionDone';
import { LLMProvider } from './llm-providers/LLMProvider';
import { OpenAIProvider } from './llm-providers/OpenAIProvider';
import { FileCache } from './cache/FileCache';

export abstract class AgentLooper<
  TProvider extends LLMProvider = LLMProvider
> extends AbstractAgent<TProvider> {
  protected abstract template: PromptTemplate;

  protected abstract formatPrompt({
    feedbackSteps = [],
  }: {
    feedbackSteps?: string[];
  }): Promise<string>;

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

    this.instructions.push(new ActionDone());

    for (const instruction of this.instructions) {
      if (!(instruction instanceof Action)) {
        throw new Error(
          `AgentLooper only accepts Actions instructions (${instruction.name} is not an Action)`
        );
      }
    }
  }

  async run() {
    let done: boolean = false;
    let feedbackSteps: string[][] = [];
    let previousCost = 0;

    while (!done) {
      this.log(`Step ${this.step}`);

      const prompt = await this.formatPrompt({
        feedbackSteps: this.describeFeedbackSteps({ feedbackSteps }),
      });

      const answer = await this.llmProvider.call({
        agentName: this.name,
        prompt,
      });

      const callCost = this.llmProvider.cost - previousCost;
      this.log(`cost ${callCost.toFixed(4)}$`);
      previousCost = this.llmProvider.cost;

      let answers: LLMAnswer[];

      try {
        answers = this.extractInstructions({ answer });
      } catch (error) {
        if (this.tries === 0) {
          throw new AgentParseError({
            message: error.message,
            answerKey: this.promptCache.cacheKey({
              agentName: this.name,
              type: 'answer',
              prompt,
            }),
            promptKey: this.promptCache.cacheKey({
              agentName: this.name,
              type: 'prompt',
              prompt,
            }),
          });
        }

        this.tries--;
        continue;
      }

      feedbackSteps[this.step] = [];
      let error = false;

      // AgentLooper only have Action as instruction so we can execute them
      for (const answer of answers.filter((a) => !ActionDone.is(a))) {
        const feedback = await this.executeAction({ answer });

        feedbackSteps[this.step].push(
          this.describeFeedback({
            answer,
            feedback,
          })
        );

        if (feedback.type === 'error') {
          error = true;
          this.actionsErrorCount++;
        } else {
          this.actionsCount++;
        }
      }

      // End the loop only if there were no error
      done = ActionDone.find(answers) && !error;

      this.log(`Step ${this.step} done\n\n`);
      this.step++;
    }

    this.log(`total cost ${this.llmProvider.cost.toFixed(4)}$`);
  }
}
