import { Action, ActionFeedback } from "./Action";

export class DoneAction extends Action {
  constructor() {
    super({
      name: "done",
      usage: "indicate that your task is done",
      parameters: [],
    });
  }

  protected async executeAction(): Promise<ActionFeedback> {
    return {
      message: "Done!",
      type: "success",
    };
  }
}
