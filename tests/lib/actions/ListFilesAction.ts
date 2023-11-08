import { execSync } from 'child_process';

import {
  Action,
  ActionFeedback,
  ActionOptions,
  InstructionOptions,
} from '../../../index';

type ListFilesActionParametersNames = 'directory';

export class ListFilesAction extends Action<ListFilesActionParametersNames> {
  public name = 'listFiles';
  public usage = 'list all files in a directory';
  public parameters = {
    directory: 'path of the directory to list',
  };

  protected async executeAction(
    parameters: Record<ListFilesActionParametersNames, string>
  ): Promise<ActionFeedback> {
    const { directory } = parameters;

    try {
      this.log(`ls -l ${directory}`);
      const result = execSync(`ls -l ${directory}`);

      return {
        message: `Files in ${directory}:\n${result.toString()}`,
        type: 'success',
      };
    } catch (error) {
      return {
        message: error.message as string,
        type: 'error',
      };
    }
  }
}
