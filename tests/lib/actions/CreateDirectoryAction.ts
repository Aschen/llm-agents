import { execSync } from "child_process";

import { LLMAction, ActionFeedback } from "../../../lib/actions/LLMAction";

type CreateDirectoryActionParametersNames = "path";

export class CreateDirectoryAction extends LLMAction<CreateDirectoryActionParametersNames> {
  public name = "createDirectory";
  public usage = "create a directory";
  public parameters = [
    {
      name: "path" as const,
      usage: "path of the directory to create",
    },
  ];

  protected async executeAction(
    parameters: Record<CreateDirectoryActionParametersNames, string>
  ): Promise<ActionFeedback> {
    const { path } = parameters;

    try {
      this.log(`mkdir -p ${path}`);
      execSync(`mkdir -p ${path}`);

      return {
        message: `Created directory ${path}`,
        type: "success",
      };
    } catch (error) {
      return {
        message: error.message as string,
        type: "error",
      };
    }
  }
}
