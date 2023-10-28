import { execSync } from "child_process";

import { LLMAction, ActionFeedback } from "../../../lib/actions/LLMAction";

type ExecuteShellCommandActionParametersNames = "command";

export class ExecuteShellCommandAction extends LLMAction<ExecuteShellCommandActionParametersNames> {
  public name = "executeShellCommand";
  public usage = "execute a shell command";
  public parameters = [
    {
      name: "command" as const,
      usage: "command to execute",
    },
  ];

  protected async executeAction(
    parameters: Record<ExecuteShellCommandActionParametersNames, string>
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
