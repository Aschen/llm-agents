import { execSync } from "child_process";

import { Action, ActionFeedback } from "../../../index";

export class ExecuteShellCommandAction extends Action {
  public usage = "execute a shell command";
  public parameters = {
    command: "command to execute",
  };

  protected async executeAction(
    parameters: Record<keyof ExecuteShellCommandAction["parameters"], string>
  ): Promise<ActionFeedback> {
    const { command } = parameters;

    try {
      console.log(`$ ${command}`);
      const result = execSync(command);
      return {
        message: `$ ${command}\n${result.toString()}`,
        type: "success",
      };
    } catch (error) {
      return {
        message: `$ ${command}\n${error.message}`,
        type: "error",
      };
    }
  }
}
