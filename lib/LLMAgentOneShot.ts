import { PromptTemplate } from 'langchain/prompts';

import {
  LLMAgentOptions,
  LLMAgentBase,
  LLMAgentAvailableModels,
  ParsedAction,
} from './LLMAgentBase';

export abstract class LLMAgentOneShot<
  TParametersNames extends string
> extends LLMAgentBase {
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

  async run({
    modelName = 'gpt-4',
    temperature = 0.0,
  }: {
    modelName?: LLMAgentAvailableModels;
    temperature?: number;
  } = {}): Promise<ParsedAction<TParametersNames>[]> {
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
  }
}
