import * as assert from "assert";
import { execSync } from "child_process";

import { CopyFileAction } from "../../lib/actions/CopyFileAction";
import { CreateDirectoryAction } from "../../lib/actions/CreateDirectoryAction";
import { ListFilesAction } from "../../lib/actions/ListFilesAction";
import { BackupAgent } from "./BackupAgent";

const BEST_ACTION_COUNT = 22;
const BEST_STEP_COUNT = 5;
const BEST_COST = 0.226;

// Setup
execSync("rm -rf ./tests/prompt-engineering/backup-agent/destination");
execSync("mkdir -p ./tests/prompt-engineering/backup-agent/destination");
const backupAgent = new BackupAgent({
  source: "./tests/prompt-engineering/backup-agent/source",
  destination: "./tests/prompt-engineering/backup-agent/destination",
  actions: [
    new ListFilesAction(),
    new CopyFileAction(),
    new CreateDirectoryAction(),
  ],
});

// Test
await backupAgent.run();

// Check
execSync(
  "diff -rq tests/prompt-engineering/backup-agent/source tests/prompt-engineering/backup-agent/destination"
);
if (backupAgent.actionsCount < BEST_ACTION_COUNT) {
  console.log(
    `You did it in ${backupAgent.actionsCount} actions, the best is ${BEST_ACTION_COUNT} actions. (please update the score in the file)`
  );
} else {
  console.log(
    `You did it in ${backupAgent.actionsCount} actions, the best is ${BEST_ACTION_COUNT} actions.`
  );
}

if (backupAgent.step < BEST_STEP_COUNT) {
  console.log(
    `You did it in ${backupAgent.step} steps, the best is ${BEST_STEP_COUNT} steps. (please update the score in the file)`
  );
} else {
  console.log(
    `You did it in ${backupAgent.step} steps, the best is ${BEST_STEP_COUNT} steps.`
  );
}

if (backupAgent.cost < BEST_COST) {
  console.log(
    `You did it in ${backupAgent.cost} cost, the best is ${BEST_COST} cost. (please update the score in the file)`
  );
} else {
  console.log(
    `You did it in ${backupAgent.cost} cost, the best is ${BEST_COST} cost.`
  );
}
