import { execSync } from 'child_process';

import { Action, ActionFeedback } from '../../../index';

export class CopyFileAction extends Action {
  public usage = 'copy a file from one place to another';
  public parameters = {
    source: 'path of the file to copy',
    destination: 'path of the destination file',
  };
  public format = 'singleline' as const;

  protected async executeAction(
    parameters: Record<keyof CopyFileAction['parameters'], string>
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
