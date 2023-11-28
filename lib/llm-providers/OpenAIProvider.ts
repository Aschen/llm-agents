import { OpenAI } from "langchain/llms/openai";

import { uuidv4 } from "../helpers/uuid";

import { LLMProvider, LLMProviderListeners } from "./LLMProvider";
import { CacheEngine } from "../cache/CacheEngine";
import { PromptCache } from "../cache/PromptCache";

export type OpenAIModels = keyof typeof OpenAIProvider.ModelsCost;

export class OpenAIProvider implements LLMProvider {
  static ModelsCost = {
    "gpt-4": {
      input: 0.03,
      output: 0.06,
    },
    "gpt-3.5-turbo-16k": {
      input: 0.003,
      output: 0.004,
    },
    "gpt-4-1106-preview": {
      input: 0.01,
      output: 0.03,
    },
  } as const;

  private promptCache: PromptCache;
  private listeners = new Map<
    keyof LLMProviderListeners,
    Array<LLMProviderListeners[keyof LLMProviderListeners]>
  >();

  public cost: number;
  public tokens: {
    input: number;
    output: number;
  };

  constructor({ cacheEngine }: { cacheEngine?: CacheEngine }) {
    this.tokens = {
      input: 0,
      output: 0,
    };
    this.cost = 0;
    this.promptCache = new PromptCache({ cacheEngine });
  }

  public async call({
    prompt,
    model = "gpt-4-1106-preview",
    temperature = 0.0,
    agentName,
  }: {
    prompt: string;
    model?: OpenAIModels;
    temperature?: number;
    agentName?: string;
  }): Promise<string> {
    this.promptCache.step();

    const id = uuidv4();
    const cachedAnswer = await this.promptCache.get({ agentName, prompt });
    if (cachedAnswer) {
      return cachedAnswer;
    }

    const cacheKey = this.promptCache.cacheKey({
      agentName,
      prompt,
      type: "prompt",
    });
    const inputCost = this.computeCost(prompt.length, model, "input");
    this.emit("prompt", {
      id,
      key: cacheKey,
      model,
      prompt,
      cost: inputCost,
    });

    const llm = new OpenAI({
      modelName: model,
      maxTokens: -1,
      temperature,
    });

    await this.promptCache.save({ agentName, prompt });

    const answer = await llm.call(prompt);

    const outputCost = this.computeCost(answer.length, model, "output");

    this.emit("answer", {
      id,
      key: cacheKey,
      model,
      answer,
      cost: outputCost,
    });

    await this.promptCache.save({ agentName, prompt, answer });

    return answer;
  }

  public on<K extends keyof LLMProviderListeners>(
    event: K,
    listener: LLMProviderListeners[K]
  ): void {
    const listeners = this.listeners.get(event) || [];

    listeners.push(listener);

    this.listeners.set(event, listeners);
  }

  private emit<K extends keyof LLMProviderListeners>(
    event: K,
    data: Parameters<LLMProviderListeners[K]>[0]
  ): void {
    const listeners = this.listeners.get(event) || [];

    for (const listener of listeners) {
      listener(data as any);
    }
  }

  private computeCost(
    length: number,
    model: OpenAIModels,
    type: "input" | "output"
  ): number {
    const tokens = length / 3;
    this.tokens[type] += tokens;

    const cost = OpenAIProvider.ModelsCost[model][type] * (tokens / 1000);
    this.cost += cost;

    return cost;
  }
}
