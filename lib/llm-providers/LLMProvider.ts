export type LLMProviderListeners = {
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

export interface LLMProvider {
  cost: number;
  tokens: {
    input: number;
    output: number;
  };

  call(params: {
    agentName: string;
    prompt: string;
    model?: any;
    temperature?: number;
  }): Promise<string>;

  on<K extends keyof LLMProviderListeners>(
    event: K,
    listener: LLMProviderListeners[K]
  ): void;
}
