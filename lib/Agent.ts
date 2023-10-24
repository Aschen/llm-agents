import * as Path from "node:path";

import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";

import { CacheEngine } from "./cache/CacheEngine";
import { Action, ActionFeedback } from "./Action";
import { DoneAction } from "./DoneAction";

function kebabCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export type AgentOptions = {
  actions?: Action[];
  verbose?: boolean;
  cacheEngine?: CacheEngine;
};

const MODELS_COST = {
  "gpt-4": {
    input: 0.03,
    output: 0.06,
  },
  "gpt-3.5-turbo-16k": {
    input: 0.003,
    output: 0.004,
  },
} as const;

export abstract class Agent<TOutput = any> {
  protected cacheInitialized = false;

  private actions: Action[];

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

  protected models = new Map<keyof typeof MODELS_COST, OpenAI>();

  protected model(name: keyof typeof MODELS_COST): OpenAI {
    if (!this.models.has(name)) {
      this.models.set(
        name,
        new OpenAI({
          modelName: name,
          temperature: 0.0,
          maxTokens: -1,
        })
      );
    }

    return this.models.get(name) as OpenAI;
  }

  abstract run(): Promise<TOutput>;

  constructor({ actions = [], verbose, cacheEngine }: AgentOptions) {
    this.actions = [...actions, new DoneAction()];
    this.verbose = verbose || false;
    this.cacheEngine = cacheEngine || null;

    this.tokens = {
      input: 0,
      output: 0,
    };
    this.cost = 0;
  }

  protected log(...chunks: string[]) {
    if (this.verbose) {
      console.log(...chunks.map((c) => `${this.constructor.name}: ${c}`));
    }
  }

  protected async callModel({
    model,
    prompt,
    cache = true,
  }: {
    model: keyof typeof MODELS_COST;
    prompt: string;
    cache?: boolean;
  }) {
    if (this.cacheEngine && cache) {
      this.initCache();

      const cacheKey = Path.join(
        this.cacheDir,
        `${this.cacheEngine.hash(prompt)}-answer.txt`
      );

      const cached = await this.cacheEngine.tryGet(cacheKey);
      if (cached) {
        this.log(`Using cached answer "${cacheKey}"`);
        return cached;
      }
    }
    const answer = await this.model(model).call(prompt);

    const promptTokens = await this.model(model).getNumTokens(prompt);
    const answerTokens = await this.model(model).getNumTokens(answer);
    this.tokens.input += promptTokens;
    this.tokens.output += answerTokens;
    this.cost += MODELS_COST[model].input * (promptTokens / 1000);
    this.cost += MODELS_COST[model].output * (answerTokens / 1000);

    if (this.cacheEngine && cache) {
      const promptHash = this.cacheEngine.hash(prompt);

      this.log(`Caching prompt and answer ${promptHash}`);

      await this.cacheEngine.set(
        Path.join(this.cacheDir, `${promptHash}-prompt.txt`),
        prompt
      );
      await this.cacheEngine.set(
        Path.join(this.cacheDir, `${promptHash}-answer.txt`),
        answer
      );
    }

    return answer;
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

  protected extractActions(answer: string) {
    const actions: Array<{ name: string; parameters: any }> = [];

    const actionRegex = /<Action\s+name="([^"]+)">(.*?)<\/Action>/gs;
    let match;

    while ((match = actionRegex.exec(answer)) !== null) {
      const actionName = match[1];
      const actionContent = match[2];

      const action: { name: string; parameters: any } = {
        name: actionName,
        parameters: {},
      };

      const parameterRegex = /<Parameter\s+name="([^"]+)">(.*?)<\/Parameter>/gs;
      let parameterMatch;

      while ((parameterMatch = parameterRegex.exec(actionContent)) !== null) {
        const paramName = parameterMatch[1];
        const paramValue = parameterMatch[2];
        action.parameters[paramName] = paramValue.replace(/\r?\n/g, "").trim();
      }

      actions.push(action);
    }

    if (actions.length === 0) {
      throw new Error("Incorrect answer format. Cannot parse actions.");
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
        type: "error",
      };
    }

    return action.execute(parameters);
  }

  protected describeActions(): string {
    return this.actions.map((action) => action.describe).join("\n");
  }
}
