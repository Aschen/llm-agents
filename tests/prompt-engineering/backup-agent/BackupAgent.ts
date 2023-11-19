import { PromptTemplate } from 'langchain/prompts';

import { FileCache, AgentLooper } from '../../../index';
import { ListFilesAction } from '../../lib/actions/ListFilesAction';
import { CopyFileAction } from '../../lib/actions/CopyFileAction';
import { CreateDirectoryAction } from '../../lib/actions/CreateDirectoryAction';

export class BackupAgent extends AgentLooper {
  private source: string;
  private destination: string;

  protected template = new PromptTemplate({
    template: `You are a backup agent capable of moving files from one place to another.

You task is to backup the files of a project.
You need to copy the files into a backup directory.
You can use many actions at once. Optimize as much as possible the number of actions.
Ensure all files in all directories are copied.

{actionsBlock}

The last action result was:
# BEGIN LAST ACTION RESULT
{feedback}
# END LAST ACTION RESULT

Ensure you are copying every files in every directories from the source.
The source directory is {source} and the destination directory is {destination}.
Skip node_modules directories.

Start your answer by a sentence explaining what you are doing and why.
{promptEnhancersBlock}
`,
    inputVariables: [
      'source',
      'destination',
      'actionsBlock',
      'feedback',
      'promptEnhancersBlock',
    ],
  });

  constructor({
    source,
    destination,
  }: {
    source: string;
    destination: string;
  }) {
    super({
      instructions: [
        new ListFilesAction(),
        new CopyFileAction(),
        new CreateDirectoryAction(),
      ],
      cacheEngine: new FileCache(),
    });

    this.source = source;
    this.destination = destination;
  }

  protected async formatPrompt({ feedbackSteps }: { feedbackSteps: string[] }) {
    return this.template.format({
      source: this.source,
      destination: this.destination,
      actionsBlock: this.promptActionsBlock(),
      promptEnhancersBlock: this.promptEnhancersBlock(),
      feedback: feedbackSteps.join('\n\n'),
    });
  }
}
