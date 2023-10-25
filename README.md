# LLM Agents

A minimalist framework to [create LLM Agents with Node.js](https://gen-ai.fr/large-language-model/creer-un-agent-llm-en-node-js-partie-1/)

## Usage

```
$ bun install llm-agents

# or the legacy way

$ npm install llm-agents
```

### Actions

Extends the [Action](lib/actions/Action.ts) class to define an action with:

- name
- usage
- parameters

```ts
import { execSync } from "child_process";

import { Action, ActionFeedback } from "llm-agents";

type ExecuteShellCommandActionParametersNames = "command";

export class ExecuteShellCommandAction extends Action<ExecuteShellCommandActionParametersNames> {
  constructor() {
    super({
      name: "executeShellCommand",
      usage: "execute a shell command",
      parameters: [
        {
          name: "command",
          usage: "command to execute",
        },
      ],
    });
  }

  protected async executeAction(
    parameters: Record<ExecuteShellCommandActionParametersNames, string>
  ): Promise<ActionFeedback> {
    const { command } = parameters;

    try {
      const result = execSync(command);
      return {
        message: `$ ${command}\n${result.toString()}`,
        type: "success",
      };
    } catch (error) {
      return {
        message: `$ ${command}\n${error.message}`,
        type: "error",
      };
    }
  }
}
```

Examples:

- [ListFilesActions]('tests/lib/actions/ListFilesActions.ts')
- [CopyFileActions]('tests/lib/actions/CopyFileActions.ts')
- [CreateDirectoryActions]('tests/lib/actions/CreateDirectoryActions.ts')

### Agents

Extends the [Agent](lib/Agent.ts) class to define an Agent with:

- template content
- template formating
- actions (optionnal)

```ts
import { PromptTemplate } from "langchain/prompts";

import { Action, FileCache, Agent } from "llm-agents";

export class BackupAgent extends Agent {
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
    actions,
  }: {
    source: string;
    destination: string;
    actions: Action[];
  }) {
    super({ actions, cacheEngine: new FileCache() });

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
```

Examples:

- [BackupAgent](tests/prompt-engineering/backup-agent/BackupAgent.ts)

### Cache

During development phase, it's advised to use the filesystem cache.

It will save both prompt and answer for each step.

The cache key is a hash of the prompt so if the prompt does not change, the cached answer will be used directly.

You can also debug your prompts and answers in the `.cache/` folder. In development mode, they will be prefixed by the step number (e.g. `0-92957a2b27-answer.txt`)

## Tests

Unit tests can be run with Bun: `bun test`

See [tests/unit](tests/unit)

Integration tests consist in a benchmark of LLMs agents:

- [BackupAgent](tests/prompt-engineering/backup-agent/run-backup-agent-test.ts): `bun tests/prompt-engineering/backup-agent/run-backup-agent-test.ts`
