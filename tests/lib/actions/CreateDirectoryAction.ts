import { execSync } from 'child_process';

import { Action, ActionFeedback } from '../../../index';

type CreateDirectoryActionParametersNames = 'path';

export class CreateDirectoryAction extends Action<CreateDirectoryActionParametersNames> {
  public name = 'createDirectory';
  public usage = 'create a directory';
  public parameters = {
    path: 'path of the directory to create',
  };

  protected async executeAction(
    parameters: Record<CreateDirectoryActionParametersNames, string>
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
