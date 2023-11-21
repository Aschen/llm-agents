import { Instruction, InstructionOptions } from "./Instruction";

export type ActionFeedback = {
  message: string;
  type: "error" | "success";
  metadata?: Record<string, string>;
};

export type ActionOptions = InstructionOptions & {
  /**
   * Maximum number of tokens in the feedback message.
   */
  feedbackSizeLimit?: number;
  feedbackSizeLimitMessage?: string;
};

export abstract class Action extends Instruction {
  /**
   * Maximum number of characters in the feedback message.
   */
  private feedbackSizeLimit: number;
  private feedbackSizeLimitMessage: string;

  constructor({
    feedbackSizeLimit = 500,
    feedbackSizeLimitMessage = "action feedback was truncated because it exceeded the size limit",
    verbose,
  }: ActionOptions = {}) {
    super({ verbose });

    this.feedbackSizeLimit = feedbackSizeLimit * 4;
    this.feedbackSizeLimitMessage = feedbackSizeLimitMessage;
  }

  protected abstract executeAction(
    parameters: Record<keyof Action["parameters"], string>
  ): Promise<ActionFeedback>;

  public async execute(
    parameters: Record<keyof Action["parameters"], string>
  ): Promise<ActionFeedback & { name: string }> {
    const feedback = await this.executeAction(parameters);

    if (feedback.message.length > this.feedbackSizeLimit) {
      return {
        name: this.name,
        message:
          feedback.message.slice(0, this.feedbackSizeLimit) +
          `[${this.feedbackSizeLimitMessage}]`,
        metadata: feedback.metadata,
        type: feedback.type,
      };
    }

    return { name: this.name, ...feedback };
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

    for (const [name] of Object.entries(this.parameters)) {
      result += `parameter:${name}="${parameters[name]}" `;
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

    for (const [name] of Object.entries(this.parameters)) {
      result += `\n    <Parameter name="${name}">\n      ${parameters[name]}\n    </Parameter>`;
    }

    result += `\n    <Feedback type="${feedback.type}">\n      ${feedback.message}\n    </Feedback>`;
    result += "\n  </Action>";

    return result;
  }
}
