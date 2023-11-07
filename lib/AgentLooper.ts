import { PromptTemplate } from 'langchain/prompts';

import { AgentOptions, AbstractAgent, ParsedAction } from './AbstractAgent';

export abstract class AgentLooper extends AbstractAgent {
  protected abstract template: PromptTemplate;

  protected abstract formatPrompt({
    actions,
    feedbackSteps = [],
  }: {
    actions: string;
    feedbackSteps?: string[];
  }): Promise<string>;

  constructor(options: AgentOptions = {}) {
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

      let actions: ParsedAction[];

      try {
        actions = this.extractActions({ answer });
      } catch (error) {
        if (this.tries === 0) {
          throw error;
        }

        this.tries--;
        continue;
      }

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
