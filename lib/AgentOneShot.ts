import { PromptTemplate } from 'langchain/prompts';

import {
  AgentOptions,
  AbstractAgent,
  AgentAvailableModels,
  ParsedAction,
} from './AbstractAgent';

export abstract class AgentOneShot extends AbstractAgent {
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

  async run({
    modelName = 'gpt-4',
    temperature = 0.0,
  }: {
    modelName?: AgentAvailableModels;
    temperature?: number;
  } = {}): Promise<ParsedAction[]> {
    try {
      const prompt = await this.formatPrompt({
        actions: this.describeActions(),
      });

      const answer = await this.callModel({
        model: modelName,
        prompt,
        temperature,
      });

      const actions = this.extractActions({ answer });

      // If user registered actions, execute them
      if (
        this.actions.length > 1 ||
        (this.actions.length === 0 && this.actions[0].name !== 'done')
      ) {
        for (const action of actions) {
          const feedback = await this.executeAction(action);

          if (feedback.type === 'error') {
            this.actionsErrorCount++;
          } else {
            this.actionsCount++;
          }
        }
      }

      return actions;
    } catch (error) {
      if (this.tries === 0) {
        throw error;
      }

      this.tries--;
      return this.run({ modelName, temperature });
    }
  }
}
