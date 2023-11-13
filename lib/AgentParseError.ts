export class AgentParseError extends Error {
  public promptKey: string;
  public answerKey: string;

  constructor({
    message,
    error,
    promptKey,
    answerKey,
  }: {
    message: string;
    error?: Error;
    promptKey: string;
    answerKey: string;
  }) {
    super(message);

    this.promptKey = promptKey;
    this.answerKey = answerKey;

    if (error) {
      this.stack = error.stack;
    }
  }
}
