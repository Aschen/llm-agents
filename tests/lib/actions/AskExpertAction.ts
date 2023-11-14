import { createInterface } from "readline";

import { Action, ActionFeedback } from "../../../index";

type AskExpertActionParametersNames = "question";

export class AskExpertAction extends Action {
  public usage =
    "ask a question to an expert when you need help or you are stuck";
  public parameters = {
    question: "question to ask to an expert",
  };

  protected async executeAction(
    parameters: Record<AskExpertActionParametersNames, string>
  ): Promise<ActionFeedback> {
    const { question } = parameters;

    try {
      const answer = await this.askQuestion({ question });

      return {
        message: `Answer: ${answer}`,
        type: "success",
      };
    } catch (error) {
      return {
        message: error.message as string,
        type: "error",
      };
    }
  }

  private askQuestion({ question }: { question: string }) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise<string>((resolve) => {
      rl.question(`I need you help.\n${question}\n`, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
}
