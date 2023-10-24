import { execSync } from "child_process";

import { Action, ActionFeedback } from "../lib/actions/Action";

type ListFilesActionParametersNames = "directory";

export class ListFilesAction extends Action<ListFilesActionParametersNames> {
  constructor() {
    super({
      name: "listFiles",
      usage: "list all files in a directory",
      parameters: [
        {
          name: "directory",
          usage: "path of the directory to list",
        },
      ],
    });
  }

  protected async executeAction(
    parameters: Record<ListFilesActionParametersNames, string>
  ): Promise<ActionFeedback> {
    const { directory } = parameters;

    try {
      console.log(`ls -l ${directory}`);
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
