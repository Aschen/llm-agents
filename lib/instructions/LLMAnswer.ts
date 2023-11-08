export interface LLMAnswer<TParametersNames extends string = string> {
  name: string;
  parameters: Record<TParametersNames, string>;
}
