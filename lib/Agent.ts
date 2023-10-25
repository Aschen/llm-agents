import * as Path from "node:path";

import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";

import { CacheEngine } from "./cache/CacheEngine";
import { Action, ActionFeedback } from "./actions/Action";
import { DoneAction } from "./actions/DoneAction";

const LOCAL_DEBUG = process.env.NODE_ENV !== "production";

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
  localDebug?: boolean;
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
  protected localDebug: boolean;
  protected localStep = -1;

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

  constructor({
    actions = [],
    verbose = true,
    cacheEngine = null,
    localDebug = LOCAL_DEBUG,
  }: AgentOptions) {
    this.actions = [...actions, new DoneAction()];
    this.verbose = verbose;
    this.cacheEngine = cacheEngine;
    this.localDebug = localDebug;

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
    this.localStep++;

    if (this.cacheEngine && cache) {
      this.initCache();

      const cacheKey = this.cacheKey({ type: "answer", prompt });
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
        this.cacheKey({ type: "prompt", prompt }),
        prompt
      );
      await this.cacheEngine.set(
        this.cacheKey({ type: "answer", prompt }),
        answer
      );
    }

    return answer;
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
    type: "prompt" | "answer";
    prompt: string;
  }) {
    const promptHash = this.cacheEngine.hash(prompt);

    let filename = "";

    if (this.localDebug) {
      filename += `${this.localStep}-`;
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

  protected extractActions(
    answer: string
  ): Array<{ name: string; parameters: any }> {
    const actions: Array<{ name: string; parameters: any }> = [];
    const lines = answer.split(/\r?\n/);
    let insideActionBlock = false;
    let insideParameterBlock = false;
    let currentAction: { name: string; parameters: any } | null = null;
    let currentParameterName: string | null = null;
    let currentParameterValue: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("<Action")) {
        insideActionBlock = true;
        currentAction = { name: "", parameters: {} };

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
              .replace("parameter:", "")
              .split("=");
            currentAction.parameters[key.replace(/"/g, "")] = value.replace(
              /"/g,
              ""
            );
          }
        }

        if (trimmedLine.endsWith("/>")) {
          insideActionBlock = false;
          if (currentAction.name) {
            actions.push(currentAction);
          }
          currentAction = null;
        }
      } else if (trimmedLine.startsWith("</Action>")) {
        insideActionBlock = false;
        if (currentAction && currentAction.name) {
          actions.push(currentAction);
        }
        currentAction = null;
      } else if (insideActionBlock && trimmedLine.startsWith("<Parameter")) {
        insideParameterBlock = true;
        currentParameterValue = "";
        const nameMatch = trimmedLine.match(/name="([^"]+)"/);
        if (nameMatch) {
          currentParameterName = nameMatch[1];
        }
      } else if (
        insideActionBlock &&
        insideParameterBlock &&
        trimmedLine.startsWith("</Parameter>")
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
          currentParameterValue += currentParameterValue ? "\n" + line : line;
        }
      }
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

  protected describeFeedback({
    actionName,
    feedback,
  }: {
    actionName: string;
    feedback: ActionFeedback;
  }): string {
    const action = this.actions.find((action) => action.name === actionName);

    if (!action) {
      return `Action "${actionName}" does not exist.`;
    }

    return action.describeFeedback({ feedback });
  }

  protected describeActions(): string {
    return this.actions.map((action) => action.describe).join("\n");
  }
}
