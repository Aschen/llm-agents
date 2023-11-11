import * as Path from 'node:path';

import { OpenAI } from 'langchain/llms/openai';
import { PromptTemplate } from 'langchain/prompts';

import { CacheEngine } from './cache/CacheEngine';
import { LLMAnswer } from './instructions/LLMAnswer';
import { Instruction } from './instructions/Instruction';
import { EventEmitter } from './EventEmitter';
import { uuidv4 } from './helpers/uuid';
import { hashString } from './helpers/hash';
import { Action, ActionFeedback } from './instructions/Action';

const LOCAL_DEBUG = process.env.NODE_ENV !== 'production';

function kebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export type AgentOptions = {
  instructions?: Instruction[];
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
  'gpt-4-1106-preview': {
    input: 0.01,
    output: 0.03,
  },
} as const;

export type AgentAvailableModels = keyof typeof MODELS_COST;

type AgentListeners = {
  prompt: ({
    id,
    key,
    model,
    prompt,
    cost,
  }: {
    id: string;
    key: string;
    model: string;
    prompt: string;
    cost: number;
  }) => void;

  answer: ({
    id,
    key,
    model,
    answer,
    cost,
  }: {
    id: string;
    key: string;
    model: string;
    answer: string;
    cost: number;
  }) => void;
};

export abstract class AbstractAgent extends EventEmitter<AgentListeners> {
  public step = 0;
  public actionsCount = 0;
  public actionsErrorCount = 0;

  protected cacheInitialized = false;
  protected localDebug: boolean;
  protected promptStep = -1;
  protected tries: number;

  protected instructions: Instruction[];

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
    instructionsDescription,
    feedbackSteps = [],
  }: {
    instructionsDescription: string;
    feedbackSteps?: string[];
  }): Promise<string>;

  protected abstract run(...args: unknown[]): Promise<unknown>;

  constructor({
    instructions = [],
    verbose = true,
    cacheEngine = null,
    localDebug = LOCAL_DEBUG,
    tries = 1,
  }: AgentOptions = {}) {
    super();

    this.instructions = instructions;
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
    model: AgentAvailableModels;
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

    // We always need the cache key to emit them alongside prompt/answer events
    this.initCache();
    const answerCacheKey = this.cacheKey({ type: 'answer', prompt });
    const promptCacheKey = this.cacheKey({ type: 'prompt', prompt });

    if (this.cacheEngine && cache) {
      this.log(`Cache activated: ${this.cacheDir}`);

      await this.cacheEngine.set(promptCacheKey, prompt);

      if (await this.cacheEngine.has(answerCacheKey)) {
        this.log(`Using cached answer at "${answerCacheKey}"`);

        const answer = await this.cacheEngine.get(answerCacheKey);

        return answer;
      }
    }

    const id = uuidv4();
    const inputCost = this.computePromptCosts({ prompt, model });

    this.emit('prompt', {
      id,
      model,
      key: promptCacheKey,
      prompt,
      cost: inputCost,
    });

    const answer = await llm.call(prompt);

    const outputCost = this.computeAnswerCosts({ answer, model });

    this.emit('answer', {
      id,
      model,
      key: answerCacheKey,
      answer,
      cost: outputCost,
    });

    if (this.cacheEngine && cache) {
      await this.cacheEngine.set(answerCacheKey, answer);
    }

    return answer;
  }

  private computePromptCosts({
    prompt,
    model,
  }: {
    prompt: string;
    model: AgentAvailableModels;
  }): number {
    const promptTokens = prompt.length / 3;

    this.tokens.input += promptTokens;

    const inputCost = MODELS_COST[model].input * (promptTokens / 1000);

    this.cost += inputCost;

    return parseFloat(inputCost.toFixed(5));
  }

  private computeAnswerCosts({
    answer,
    model,
  }: {
    answer: string;
    model: AgentAvailableModels;
  }): number {
    const answerTokens = answer.length / 3;

    this.tokens.output += answerTokens;

    const outputCost = MODELS_COST[model].output * (answerTokens / 1000);

    this.cost += outputCost;

    return parseFloat(outputCost.toFixed(5));
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
    const promptHash = hashString(prompt);

    let filename = '';

    if (this.localDebug) {
      filename += `${this.promptStep}-`;
    }

    return Path.join(this.cacheDir, `${filename}${promptHash}-${type}.txt`);
  }

  /**
   * Must be called when the prompt is already formated.
   * The only place where we can assume this is the callModel method.
   */
  private initCache() {
    if (this.cacheInitialized) {
      return;
    }

    this.cacheHash = hashString(this.template.template).slice(0, 10);

    this.cacheDir = Path.join(kebabCase(this.constructor.name), this.cacheHash);

    this.cacheInitialized = true;
  }

  /**
   * todo: handle when there is no trailing "/"
   */
  protected extractInstructions({ answer }: { answer: string }): LLMAnswer[] {
    const answers: LLMAnswer[] = [];

    const lines = answer.split(/\r?\n/);
    let insideActionBlock = false;
    let insideParameterBlock = false;
    let currentAnswer: LLMAnswer | null = null;
    let currentParameterName: string | null = null;
    let currentParameterValue: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('<Action')) {
        insideActionBlock = true;
        currentAnswer = { name: '', parameters: {} };

        const nameMatch = trimmedLine.match(/name="([^"]+)"/);
        if (nameMatch) {
          currentAnswer.name = nameMatch[1];
        }

        const inlineParameters = trimmedLine.match(
          /parameter:([^=]+)="([^"]+)"/g
        );
        if (inlineParameters) {
          for (const inlineParameter of inlineParameters) {
            const [key, value] = inlineParameter
              .replace('parameter:', '')
              .split('=');
            currentAnswer.parameters[key.replace(/"/g, '')] = value.replace(
              /"/g,
              ''
            );
          }
        }

        if (trimmedLine.endsWith('/>')) {
          insideActionBlock = false;
          if (currentAnswer.name) {
            answers.push(currentAnswer);
          }
          currentAnswer = null;
        }
      } else if (trimmedLine.startsWith('</Action>')) {
        insideActionBlock = false;
        if (currentAnswer && currentAnswer.name) {
          answers.push(currentAnswer);
        }
        currentAnswer = null;
      } else if (insideActionBlock && trimmedLine.startsWith('<Parameter')) {
        insideParameterBlock = true;
        currentParameterValue = '';
        const nameMatch = trimmedLine.match(/name="([^"]+)"/);
        if (nameMatch) {
          currentParameterName = nameMatch[1];
        }
        const parameterMatch = trimmedLine.match(
          /<Parameter name="([^"]+)">(.*?)<\/Parameter>/
        );
        if (parameterMatch) {
          const [, paramName, paramValue] = parameterMatch;
          currentAnswer.parameters[paramName] = paramValue;
        }
      } else if (
        insideActionBlock &&
        insideParameterBlock &&
        trimmedLine.startsWith('</Parameter>')
      ) {
        insideParameterBlock = false;
        if (
          currentAnswer &&
          currentParameterName &&
          currentParameterValue !== null
        ) {
          currentAnswer.parameters[currentParameterName] =
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

    if (answers.length === 0) {
      throw new Error('Incorrect answer format. Cannot parse answers.');
    }

    for (const answer of answers) {
      if (
        !this.instructions.find(
          (instruction) => instruction.name === answer.name
        )
      ) {
        throw new Error(`Hallucinated instruction "${answer.name}"`);
      }
    }

    return answers;
  }

  protected async executeAction({
    answer,
  }: {
    answer: LLMAnswer;
  }): Promise<ActionFeedback> {
    const action = this.findAction({ answer });

    if (!action) {
      return {
        message: `Action "${answer.name}" not found`,
        type: 'error',
      };
    }

    return action.execute(answer.parameters);
  }

  protected describeFeedback({
    answer,
    feedback,
  }: {
    answer: LLMAnswer;
    feedback: ActionFeedback;
  }): string {
    const action = this.findAction({ answer });

    if (!action) {
      return `Action "${answer.name}" not found`;
    }

    return action.describeFeedback({ feedback, parameters: answer.parameters });
  }

  protected findAction({ answer }: { answer: LLMAnswer }): Action | null {
    const action = this.instructions.find(
      (instruction) =>
        instruction.name === answer.name && instruction instanceof Action
    );

    if (!(action instanceof Action)) {
      return null;
    }

    return action;
  }

  protected describeInstructions(): string {
    return this.instructions
      .map((instruction) => instruction.describe)
      .join('\n');
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

  /**
   * Use this in your prompt to improve it's performances
   *
   * @see https://arxiv.org/pdf/2307.11760.pdf
   *
   * @returns "The task I'm asking you is vital to my career, and I greatly value your thorough analysis."
   */
  get promptEnhancers() {
    return "The task I'm asking you is vital to my career, and I greatly value your thorough analysis.";
  }
}
