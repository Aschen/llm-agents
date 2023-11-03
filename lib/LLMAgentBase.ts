import * as Path from 'node:path';

import { OpenAI } from 'langchain/llms/openai';
import { PromptTemplate } from 'langchain/prompts';

import { CacheEngine } from './cache/CacheEngine';
import { LLMAction, ActionFeedback } from './actions/LLMAction';
import { DoneAction } from './actions/DoneAction';
import { EventEmitter } from './EventEmitter';
import { uuidv4 } from './helpers/uuid';

const LOCAL_DEBUG = process.env.NODE_ENV !== 'production';

function kebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export type LLMAgentOptions = {
  actions?: LLMAction[];
  verbose?: boolean;
  cacheEngine?: CacheEngine;
  localDebug?: boolean;
  tries?: number;
};

const MODELS_COST = {
  'gpt-4': {
    input: 0.03,
    output: 0.06,
  },
  'gpt-3.5-turbo-16k': {
    input: 0.003,
    output: 0.004,
  },
} as const;

export type LLMAgentAvailableModels = keyof typeof MODELS_COST;

export type ParsedAction<TParametersNames extends string = string> = {
  name: string;
  parameters: Record<TParametersNames, string>;
};

type LLMAgentBaseListeners = {
  /**
   * Barfoo
   */
  prompt: ({
    id,
    prompt,
    cost,
  }: {
    id: string;
    prompt: string;
    cost: number;
  }) => void;

  /**
   * Foobar
   */
  answer: ({
    id,
    answer,
    cost,
  }: {
    id: string;
    answer: string;
    cost: number;
  }) => void;
};

export abstract class LLMAgentBase extends EventEmitter<LLMAgentBaseListeners> {
  public step = 0;
  public actionsCount = 0;
  public actionsErrorCount = 0;

  protected cacheInitialized = false;
  protected localDebug: boolean;
  protected promptStep = -1;
  protected tries: number;

  protected actions: LLMAction[];

  protected verbose: boolean;
  protected cacheEngine: CacheEngine | null;
  protected cacheHash: string;
  protected cacheDir: string;

  public tokens: {
    input: number;
    output: number;
  };
  public cost: number;

  protected abstract template: PromptTemplate;

  protected abstract formatPrompt({
    actions,
    feedbackSteps = [],
  }: {
    actions: string;
    feedbackSteps?: string[];
  }): Promise<string>;

  protected abstract run(...args: unknown[]): Promise<unknown>;

  constructor({
    actions = [],
    verbose = true,
    cacheEngine = null,
    localDebug = LOCAL_DEBUG,
    tries = 1,
  }: LLMAgentOptions = {}) {
    super();

    this.actions = [...actions, new DoneAction()];
    this.verbose = verbose;
    this.cacheEngine = cacheEngine;
    this.localDebug = localDebug;
    this.tries = tries;

    this.tokens = {
      input: 0,
      output: 0,
    };
    this.cost = 0;
  }

  protected async callModel({
    model,
    prompt,
    temperature = 0.0,
    cache = true,
  }: {
    model: LLMAgentAvailableModels;
    prompt: string;
    temperature?: number;
    cache?: boolean;
  }) {
    this.promptStep++;

    const llm = new OpenAI({
      modelName: model,
      maxTokens: -1,
      temperature,
    });

    if (this.cacheEngine && cache) {
      this.initCache();

      const promptCacheKey = this.cacheKey({ type: 'prompt', prompt });

      await this.cacheEngine.set(promptCacheKey, prompt);

      const answerCacheKey = this.cacheKey({ type: 'answer', prompt });

      if (await this.cacheEngine.has(answerCacheKey)) {
        this.log(`Using cached answer at "${answerCacheKey}"`);

        const answer = await this.cacheEngine.get(answerCacheKey);

        return answer;
      }
    }

    const id = uuidv4();
    const inputCost = this.computePromptCosts({ prompt });
    this.emit('prompt', { id, prompt, cost: inputCost });

    const answer = await llm.call(prompt);

    const outputCost = this.computeAnswerCosts({ answer });
    this.emit('answer', { id, answer, cost: outputCost });

    if (this.cacheEngine && cache) {
      const answerCacheKey = this.cacheKey({ type: 'answer', prompt });

      await this.cacheEngine.set(answerCacheKey, answer);
    }

    return answer;
  }

  private computePromptCosts({ prompt }: { prompt: string }): number {
    const promptTokens = prompt.length / 3;

    this.tokens.input += promptTokens;

    const inputCost = MODELS_COST['gpt-4'].input * (promptTokens / 1000);

    this.cost += inputCost;

    return inputCost;
  }

  private computeAnswerCosts({ answer }: { answer: string }): number {
    const answerTokens = answer.length / 3;

    this.tokens.output += answerTokens;

    const outputCost = MODELS_COST['gpt-4'].output * (answerTokens / 1000);

    this.cost += outputCost;

    return outputCost;
  }

  protected log(...chunks: string[]) {
    if (this.verbose) {
      console.log(...chunks.map((c) => `${this.constructor.name}: ${c}`));
    }
  }

  /**
   * Return the path to the corresponding cache file
   *
   * If localDebug is true, the cache file will prefixed by a incrementing number
   */
  private cacheKey({
    type,
    prompt,
  }: {
    type: 'prompt' | 'answer';
    prompt: string;
  }) {
    const promptHash = this.cacheEngine.hash(prompt);

    let filename = '';

    if (this.localDebug) {
      filename += `${this.promptStep}-`;
    }

    return Path.join(this.cacheDir, `${filename}${promptHash}-${type}.txt`);
  }

  private initCache() {
    if (this.cacheInitialized || this.cacheEngine === null) {
      this.log(`Cache activated: ${this.cacheDir}`);
      return;
    }

    this.cacheHash = this.cacheEngine.hash(this.template.template).slice(0, 10);

    this.cacheDir = Path.join(kebabCase(this.constructor.name), this.cacheHash);

    this.log(`Cache activated: ${this.cacheDir}`);

    this.cacheInitialized = true;
  }

  /**
   * todo: handle when there is no leading "/"
   */
  protected extractActions({ answer }: { answer: string }): ParsedAction[] {
    const actions: ParsedAction[] = [];
    const lines = answer.split(/\r?\n/);
    let insideActionBlock = false;
    let insideParameterBlock = false;
    let currentAction: ParsedAction | null = null;
    let currentParameterName: string | null = null;
    let currentParameterValue: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('<Action')) {
        insideActionBlock = true;
        currentAction = { name: '', parameters: {} };

        const nameMatch = trimmedLine.match(/name="([^"]+)"/);
        if (nameMatch) {
          currentAction.name = nameMatch[1];
        }

        const inlineParameters = trimmedLine.match(
          /parameter:([^=]+)="([^"]+)"/g
        );
        if (inlineParameters) {
          for (const inlineParameter of inlineParameters) {
            const [key, value] = inlineParameter
              .replace('parameter:', '')
              .split('=');
            currentAction.parameters[key.replace(/"/g, '')] = value.replace(
              /"/g,
              ''
            );
          }
        }

        if (trimmedLine.endsWith('/>')) {
          insideActionBlock = false;
          if (currentAction.name) {
            actions.push(currentAction);
          }
          currentAction = null;
        }
      } else if (trimmedLine.startsWith('</Action>')) {
        insideActionBlock = false;
        if (currentAction && currentAction.name) {
          actions.push(currentAction);
        }
        currentAction = null;
      } else if (insideActionBlock && trimmedLine.startsWith('<Parameter')) {
        insideParameterBlock = true;
        currentParameterValue = '';
        const nameMatch = trimmedLine.match(/name="([^"]+)"/);
        if (nameMatch) {
          currentParameterName = nameMatch[1];
        }
      } else if (
        insideActionBlock &&
        insideParameterBlock &&
        trimmedLine.startsWith('</Parameter>')
      ) {
        insideParameterBlock = false;
        if (
          currentAction &&
          currentParameterName &&
          currentParameterValue !== null
        ) {
          currentAction.parameters[currentParameterName] =
            currentParameterValue.trim();
        }
        currentParameterName = null;
        currentParameterValue = null;
      } else if (insideParameterBlock) {
        if (currentParameterValue !== null) {
          currentParameterValue += currentParameterValue ? '\n' + line : line;
        }
      }
    }

    if (actions.length === 0) {
      throw new Error('Incorrect answer format. Cannot parse actions.');
    }

    return actions;
  }

  protected async executeAction({
    name,
    parameters,
  }: {
    name: string;
    parameters: Record<string, string>;
  }): Promise<ActionFeedback> {
    const action = this.actions.find((action) => action.name === name);

    if (!action) {
      return {
        message: `Action "${name}" not found`,
        type: 'error',
      };
    }

    return action.execute(parameters);
  }

  protected describeFeedback({
    actionName,
    parameters,
    feedback,
  }: {
    actionName: string;
    parameters: Record<string, string>;
    feedback: ActionFeedback;
  }): string {
    const action = this.actions.find((action) => action.name === actionName);

    if (!action) {
      return `Action "${actionName}" does not exist.`;
    }

    return action.describeFeedback({ feedback, parameters });
  }

  protected describeActions(): string {
    return this.actions.map((action) => action.describe).join('\n');
  }

  protected describeFeedbackSteps({
    feedbackSteps,
  }: {
    feedbackSteps: string[][];
  }): string[] {
    let describedSteps = [];

    for (let i = 0; i < feedbackSteps.length; i++) {
      describedSteps.push(`<Step number="${i + 1}">
  ${feedbackSteps[i].join('\n  ')}
</Step>`);
    }

    return describedSteps;
  }
}
