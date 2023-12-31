import { Action, ActionFeedback } from "./Action";

export class ActionDone extends Action {
  public usage = "indicate that your task is done";
  public parameters = {};
  public format = "singleline" as const;

  protected async executeAction(
    parameters: Record<string, string>
  ): Promise<ActionFeedback> {
    return {
      message: "task is done",
      type: "success",
    };
  }
}
