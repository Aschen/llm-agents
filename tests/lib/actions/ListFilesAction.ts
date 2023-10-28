import { execSync } from "child_process";

import {
  LLMAction,
  ActionFeedback,
  LLMActionOptions,
} from "../../../lib/actions/LLMAction";

type ListFilesActionParametersNames = "directory";

export class ListFilesAction extends LLMAction<ListFilesActionParametersNames> {
  public name = "listFiles";
  public usage = "list all files in a directory";
  public parameters = [
    {
      name: "directory" as const,
      usage: "path of the directory to list",
    },
  ];
  constructor({ format }: { format?: LLMActionOptions["format"] } = {}) {
    super({ format });
  }

  protected async executeAction(
    parameters: Record<ListFilesActionParametersNames, string>
  ): Promise<ActionFeedback> {
    const { directory } = parameters;

    try {
      this.log(`ls -l ${directory}`);
      const result = execSync(`ls -l ${directory}`);

      return {
        message: `Files in ${directory}:\n${result.toString()}`,
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
