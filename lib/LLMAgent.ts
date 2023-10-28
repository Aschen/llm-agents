import * as Path from "node:path";

import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";

import { CacheEngine } from "./cache/CacheEngine";
import { LLMAction, ActionFeedback } from "./actions/LLMAction";
import { DoneAction } from "./actions/DoneAction";

const LOCAL_DEBUG = process.env.NODE_ENV !== "production";

function kebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export type AgentOptions = {
  actions?: LLMAction[];
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

export abstract class LLMAgent {
  protected cacheInitialized = false;
  protected localDebug: boolean;
  protected promptStep = -1;
  public step = 0;
  public actionsCount = 0;
  public actionsErrorCount = 0;

  private actions: LLMAction[];

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

  protected abstract formatPrompt({
    actions,
    feedbackSteps,
  }: {
    actions: string;
    feedbackSteps: string[];
  }): Promise<string>;

  constructor({
    actions = [],
    verbose = true,
    cacheEngine = null,
    localDebug = LOCAL_DEBUG,
  }: AgentOptions = {}) {
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
        model: "gpt-4",
        prompt,
      });

      const actions = this.extractActions(answer);

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

        if (feedback.type === "error") {
          error = true;
          this.actionsErrorCount++;
        } else {
          this.actionsCount++;
        }

        if (action.name === "done") {
          done = true;
        }
      }

      // End the loop only if there were no error
      done = done && !error;

      this.log(`Step ${this.step} done\n\n`);
      this.step++;
    }

    return done as any;
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
    this.promptStep++;

    if (this.cacheEngine && cache) {
      this.initCache();

      const promptCacheKey = this.cacheKey({ type: "prompt", prompt });

      this.log(`Caching prompt at "${promptCacheKey}"`);

      await this.cacheEngine.set(promptCacheKey, prompt);

      const answerCacheKey = this.cacheKey({ type: "answer", prompt });
      if (await this.cacheEngine.has(answerCacheKey)) {
        this.log(`Using cached answer at "${answerCacheKey}"`);

        const answer = await this.cacheEngine.get(answerCacheKey);

        await this.computeCosts({ model, prompt, answer });

        return answer;
      }
    }
    const answer = await this.model(model).call(prompt);

    await this.computeCosts({ model, prompt, answer });

    if (this.cacheEngine && cache) {
      const answerCacheKey = this.cacheKey({ type: "answer", prompt });

      this.log(`Caching answer at "${answerCacheKey}"`);

      await this.cacheEngine.set(answerCacheKey, answer);
    }

    return answer;
  }

  private async computeCosts({
    model,
    prompt,
    answer,
  }: {
    model: "gpt-4" | "gpt-3.5-turbo-16k";
    prompt: string;
    answer: string;
  }) {
    const promptTokens = await this.model(model).getNumTokens(prompt);
    const answerTokens = await this.model(model).getNumTokens(answer);
    this.tokens.input += promptTokens;
    this.tokens.output += answerTokens;
    this.cost += MODELS_COST[model].input * (promptTokens / 1000);
    this.cost += MODELS_COST[model].output * (answerTokens / 1000);
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
    type: "prompt" | "answer";
    prompt: string;
  }) {
    const promptHash = this.cacheEngine.hash(prompt);

    let filename = "";

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
    return this.actions.map((action) => action.describe).join("\n");
  }

  protected describeFeedbackSteps({
    feedbackSteps,
  }: {
    feedbackSteps: string[][];
  }): string[] {
    let describedSteps = [];

    for (let i = 0; i < feedbackSteps.length; i++) {
      describedSteps.push(`<Step number="${i + 1}">
  ${feedbackSteps[i].join("\n  ")}
</Step>`);
    }

    return describedSteps;
  }
}
