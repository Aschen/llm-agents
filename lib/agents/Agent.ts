import * as Path from "node:path";

import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";

import { CacheEngine } from "../cache/CacheEngine";

function kebabCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export type AgentOptions = {
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
  private cacheInitialized = false;

  protected verbose: boolean;
  protected cacheEngine: CacheEngine | null;
  protected cacheHash: string;
  protected cacheDir: string;

  public characters: {
    input: number;
    output: number;
  };
  public cost: number;

  protected abstract template: PromptTemplate;

  private models = new Map<keyof typeof MODELS_COST, OpenAI>();

  private model(name: keyof typeof MODELS_COST): OpenAI {
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

  constructor({ verbose, cacheEngine }: AgentOptions) {
    this.verbose = verbose || true;
    this.cacheEngine = cacheEngine || null;

    this.characters = {
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
        `answer-${this.cacheEngine.hash(prompt)}.txt`
      );

      const cached = await this.cacheEngine.tryGet(cacheKey);
      if (cached) {
        this.log("Using cached answer");
        return cached;
      }
    }

    const answer = await this.model(model).call(prompt);
    this.characters.input += prompt.length;
    this.characters.output += answer.length;
    this.cost += MODELS_COST[model].input * (prompt.length / 3 / 1000);
    this.cost += MODELS_COST[model].output * (answer.length / 3 / 1000);

    if (this.cacheEngine && cache) {
      const promptHash = this.cacheEngine.hash(prompt);

      this.log(`Caching prompt and answer ${promptHash}`);

      await this.cacheEngine.set(
        Path.join(this.cacheDir, `prompt-${promptHash}.txt`),
        prompt
      );
      await this.cacheEngine.set(
        Path.join(this.cacheDir, `answer-${promptHash}.txt`),
        prompt
      );
    }

    return answer;
  }

  private initCache() {
    if (this.cacheInitialized || this.cacheEngine === null) {
      return;
    }

    this.cacheHash = this.cacheEngine.hash(this.template.template).slice(0, 10);

    this.cacheDir = Path.join(kebabCase(this.constructor.name), this.cacheHash);

    this.log(`Cache activated: ${this.cacheDir}`);

    this.cacheInitialized = true;
  }
}
