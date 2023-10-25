import { execSync } from "child_process";

import { Action, ActionFeedback } from "../lib/actions/Action";

type CopyFileActionParametersNames = "source" | "destination";

export class CopyFileAction extends Action<CopyFileActionParametersNames> {
  constructor() {
    super({
      name: "copyFile",
      usage: "copy a file from one place to another",
      parameters: [
        {
          name: "source",
          usage: "path of the file to copy",
        },
        {
          name: "destination",
          usage: "path of the destination file",
        },
      ],
    });
  }

  protected async executeAction(
    parameters: Record<CopyFileActionParametersNames, string>
  ): Promise<ActionFeedback> {
    const { source, destination } = parameters;

    try {
      this.log(`cp ${source} ${destination}`);
      execSync(`cp ${source} ${destination}`);

      return {
        message: `File copied from ${source} to ${destination}`,
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
