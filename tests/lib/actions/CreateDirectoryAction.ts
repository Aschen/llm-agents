import { execSync } from 'child_process';

import { Action, ActionFeedback } from '../../../index';

export class CreateDirectoryAction extends Action {
  public usage = 'create a directory';
  public parameters = {
    path: 'path of the directory to create',
  };
  public format = 'singleline' as const;

  protected async executeAction(
    parameters: Record<keyof CreateDirectoryAction['parameters'], string>
  ): Promise<ActionFeedback> {
    const { path } = parameters;

    try {
      this.log(`mkdir -p ${path}`);
      execSync(`mkdir -p ${path}`);

      return {
        message: `Created directory ${path}`,
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
