import { LLMAction, ActionFeedback } from "./LLMAction";

export class DoneAction extends LLMAction {
  public name = "done";
  public usage = "indicate that your task is done";
  public parameters = [];

  protected async executeAction(): Promise<ActionFeedback> {
    return {
      message: "Done!",
      type: "success",
    };
  }
}
