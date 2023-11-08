import { execSync } from 'child_process';

import { Action, ActionFeedback } from '../../../index';

type CopyFileActionParametersNames = 'source' | 'destination';

export class CopyFileAction extends Action<CopyFileActionParametersNames> {
  public name = 'copyFile';
  public usage = 'copy a file from one place to another';
  public parameters = {
    source: 'path of the file to copy',
    destination: 'path of the destination file',
  };

  protected async executeAction(
    parameters: Record<CopyFileActionParametersNames, string>
  ): Promise<ActionFeedback> {
    const { source, destination } = parameters;

    try {
      this.log(`cp ${source} ${destination}`);
      execSync(`cp ${source} ${destination}`);

      return {
        message: `File copied from ${source} to ${destination}`,
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
