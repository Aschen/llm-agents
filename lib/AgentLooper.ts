import { PromptTemplate } from 'langchain/prompts';

import { AgentOptions, AbstractAgent } from './AbstractAgent';
import { LLMAnswer } from './instructions/LLMAnswer';
import { Action } from './instructions/Action';
import { ActionDone } from './instructions/ActionDone';

export abstract class AgentLooper extends AbstractAgent {
  protected abstract template: PromptTemplate;

  protected abstract formatPrompt({
    instructionsDescription,
    feedbackSteps = [],
  }: {
    instructionsDescription: string;
    feedbackSteps?: string[];
  }): Promise<string>;

  constructor(options: AgentOptions = {}) {
    super(options);

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

    while (!done) {
      this.log(`Step ${this.step}`);

      const prompt = await this.formatPrompt({
        instructionsDescription: this.describeInstructions(),
        feedbackSteps: this.describeFeedbackSteps({ feedbackSteps }),
      });

      const answer = await this.callModel({
        model: 'gpt-4-1106-preview',
        prompt,
      });

      let answers: LLMAnswer[];

      try {
        answers = this.extractInstructions({ answer });
      } catch (error) {
        if (this.tries === 0) {
          throw error;
        }

        this.tries--;
        continue;
      }

      feedbackSteps[this.step] = [];
      let error = false;
      // AgentLooper only have Action as instruction so we can execute them
      for (const answer of answers) {
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

        if (answer.name === 'done') {
          console.log('DONE');
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
