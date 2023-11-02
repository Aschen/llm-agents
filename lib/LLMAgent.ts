import { PromptTemplate } from 'langchain/prompts';

import { LLMAgentOptions, LLMAgentBase } from './LLMAgentBase';

export abstract class LLMAgent extends LLMAgentBase {
  protected abstract template: PromptTemplate;

  protected abstract formatPrompt({
    actions,
    feedbackSteps = [],
  }: {
    actions: string;
    feedbackSteps?: string[];
  }): Promise<string>;

  constructor(options: LLMAgentOptions = {}) {
    super(options);
  }

  async run() {
    let done: boolean = false;
    let feedbackSteps: string[][] = [];

    while (!done) {
      this.log(`Step ${this.step}`);

      const prompt = await this.formatPrompt({
        actions: this.describeActions(),
        feedbackSteps: this.describeFeedbackSteps({ feedbackSteps }),
      });

      const answer = await this.callModel({
        model: 'gpt-4',
        prompt,
      });

      const actions = this.extractActions({ answer });

      feedbackSteps[this.step] = [];
      let error = false;
      for (const action of actions) {
        const feedback = await this.executeAction(action);

        feedbackSteps[this.step].push(
          this.describeFeedback({
            actionName: action.name,
            feedback,
            parameters: action.parameters,
          })
        );

        if (feedback.type === 'error') {
          error = true;
          this.actionsErrorCount++;
        } else {
          this.actionsCount++;
        }

        if (action.name === 'done') {
          done = true;
        }
      }

      // End the loop only if there were no error
      done = done && !error;

      this.log(`Step ${this.step} done\n\n`);
      this.step++;
    }
  }
}
