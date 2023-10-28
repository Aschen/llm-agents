import { PromptTemplate } from "langchain/prompts";

import { LLMAgent } from "../../../lib/LLMAgent";
import { FileCache } from "../../../lib/cache/FileCache";
import { ListFilesAction } from "../../lib/actions/ListFilesAction";
import { CopyFileAction } from "../../lib/actions/CopyFileAction";
import { CreateDirectoryAction } from "../../lib/actions/CreateDirectoryAction";

export class BackupAgent extends LLMAgent {
  private source: string;
  private destination: string;

  protected template = new PromptTemplate({
    template: `You are a backup agent capable of moving files from one place to another.

You task is to backup the files containing the typescript code of a project.
You need to copy the files containing the code into a backup directory.
You can only move one file after another.

You can use the following actions:
# BEGIN ACTIONS DEFINITION
{actions}
# END ACTIONS DEFINITION

The last action result was:
# BEGIN LAST ACTION RESULT
{feedback}
# END LAST ACTION RESULT

Ensure you are copying every files in every directories from the source.
The source directory is {source} and the destination directory is {destination}.
Skip node_modules directories.

Start by a sentence summarizing the current state of your task according to the last action result.
Then, answer with the actions you want to execute.
`,
    inputVariables: ["source", "destination", "actions", "feedback"],
  });

  constructor({
    source,
    destination,
  }: {
    source: string;
    destination: string;
  }) {
    super({
      actions: [
        new ListFilesAction(),
        new CopyFileAction(),
        new CreateDirectoryAction(),
      ],
      cacheEngine: new FileCache(),
    });

    this.source = source;
    this.destination = destination;
  }

  protected async formatPrompt({
    actions,
    feedbackSteps,
  }: {
    actions: string;
    feedbackSteps: string[];
  }) {
    return this.template.format({
      source: this.source,
      destination: this.destination,
      actions,
      feedback: feedbackSteps.join("\n\n"),
    });
  }
}
