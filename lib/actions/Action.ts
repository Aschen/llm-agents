export type ActionParameter<TParametersNames extends string> = {
  name: TParametersNames;
  usage: string;
};

export type ActionFeedback = {
  message: string;
  type: "error" | "success";
};

export abstract class Action<TParametersNames extends string = any> {
  public name: string;
  public usage: string;
  public parameters: ActionParameter<TParametersNames>[];

  /**
   * Maximum number of characters in the feedback message.
   */
  private feedbackSizeLimit: number;
  private feedbackSizeLimitMessage: string;

  constructor({
    name,
    usage,
    parameters,
    feedbackSizeLimit = 500,
    feedbackSizeLimitMessage = "action feedback was truncated because it exceeded the size limit",
  }: {
    name: string;
    usage: string;
    parameters: ActionParameter<TParametersNames>[];
    /**
     * Maximum number of tokens in the feedback message.
     */
    feedbackSizeLimit?: number;
    feedbackSizeLimitMessage?: string;
  }) {
    this.name = name;
    this.usage = usage;
    this.parameters = parameters;

    this.feedbackSizeLimit = feedbackSizeLimit * 4;
    this.feedbackSizeLimitMessage = feedbackSizeLimitMessage;
  }

  protected abstract executeAction(
    parameters: Record<TParametersNames, string>
  ): Promise<ActionFeedback>;

  public async execute(
    parameters: Record<TParametersNames, string>
  ): Promise<ActionFeedback> {
    const feedback = await this.executeAction(parameters);

    if (feedback.message.length > this.feedbackSizeLimit) {
      return {
        message:
          feedback.message.slice(0, this.feedbackSizeLimit) +
          `[${this.feedbackSizeLimitMessage}]`,
        type: feedback.type,
      };
    }

    return feedback;
  }

  get describe(): string {
    let result = `Use this action to: ${this.usage}\n<Action name="${this.name}">`;
    result +=
      '\n  <Thought explanation="<explain here why you need to execute the action>"/>';
    for (const param of this.parameters) {
      result += `\n  <Parameter name="${param.name}">\n    // ${param.usage}\n  </Parameter>`;
    }
    result += "\n</Action>";
    return result;
  }
}
