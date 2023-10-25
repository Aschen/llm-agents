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
  private verbose: boolean;
  private format: "singleline" | "multiline";

  constructor({
    name,
    usage,
    parameters,
    format = "singleline",
    feedbackSizeLimit = 500,
    feedbackSizeLimitMessage = "action feedback was truncated because it exceeded the size limit",
    verbose = true,
  }: {
    name: string;
    usage: string;
    parameters: ActionParameter<TParametersNames>[];
    /**
     * Maximum number of tokens in the feedback message.
     */
    feedbackSizeLimit?: number;
    feedbackSizeLimitMessage?: string;
    verbose?: boolean;
    format?: "singleline" | "multiline";
  }) {
    this.name = name;
    this.usage = usage;
    this.parameters = parameters;
    this.format = format;

    this.feedbackSizeLimit = feedbackSizeLimit * 4;
    this.feedbackSizeLimitMessage = feedbackSizeLimitMessage;
    this.verbose = verbose;
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
    if (this.format === "singleline") {
      return this.describeSingleLine;
    }

    return this.describeMultiLine;
  }

  private get describeMultiLine(): string {
    let result = `Use this action to: ${this.usage}\n<Action name="${this.name}">`;

    // result +=
    //   '\n  <Thought explanation="<explain here why you need to execute the action>"/>';

    for (const param of this.parameters) {
      result += `\n  <Parameter name="${param.name}">\n    // ${param.usage}\n  </Parameter>`;
    }

    result += "\n</Action>";

    return result;
  }

  private get describeSingleLine(): string {
    let result = `<Action name="${this.name}"`;
    // let result = `<Action thought="<explain here why you need to execute the action>" name="${this.name}"`;

    for (const param of this.parameters) {
      result += ` parameter:${param.name}="<${param.usage}>"`;
    }

    result += " />";

    return result;
  }

  describeFeedback({
    feedback,
    parameters,
  }: {
    feedback: ActionFeedback;
    parameters: Record<string, string>;
  }) {
    if (this.format === "singleline") {
      return this.describeFeedbackSingleline({ feedback, parameters });
    }
    return this.describeFeedbackMultiline({ feedback, parameters });
  }

  describeFeedbackSingleline({
    feedback,
    parameters,
  }: {
    feedback: ActionFeedback;
    parameters: Record<string, string>;
  }): string {
    let result = `<Action name="${this.name}" `;
    for (const param of this.parameters) {
      result += `parameter:${param.name}="${parameters[param.name]}" `;
    }
    result += `feedback:type="${feedback.type}" feedback:message="${feedback.message}" />`;
    return result;
  }
  describeFeedbackMultiline({
    feedback,
    parameters,
  }: {
    feedback: ActionFeedback;
    parameters: Record<string, string>;
  }): string {
    let result = `  <Action name="${this.name}">`;
    for (const param of this.parameters) {
      result += `\n    <Parameter name="${param.name}">\n      ${
        parameters[param.name]
      }\n    </Parameter>`;
    }
    result += `\n    <Feedback type="${feedback.type}">\n      ${feedback.message}\n    </Feedback>`;
    result += "\n  </Action>";
    return result;
  }

  protected log(...chunks: string[]) {
    if (this.verbose) {
      console.log(...chunks.map((c) => `${this.constructor.name}: ${c}`));
    }
  }
}
