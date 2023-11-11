import { execSync } from 'child_process';

import { BackupAgent } from './BackupAgent';
import { AbstractAgent } from '../../../lib/AbstractAgent';

const BEST_ACTION_COUNT = 22;
const BEST_STEP_COUNT = 4;
const BEST_COST = 0.222;
const BEST_TIME = 84;

// Setup
execSync('rm -rf ./tests/prompt-engineering/backup-agent/destination');
execSync('mkdir -p ./tests/prompt-engineering/backup-agent/destination');

const backupAgent = new BackupAgent({
  source: './tests/prompt-engineering/backup-agent/source',
  destination: './tests/prompt-engineering/backup-agent/destination',
});

// Test
const now = Date.now();
await backupAgent.run();
const elapsed = Date.now() - now;

if (elapsed < BEST_TIME) {
  console.log(
    `You did it in ${Math.trunc(
      elapsed / 1000
    )}s, the best is ${BEST_TIME}s. (please update the score in the file)`
  );
} else {
  console.log(
    `You did it in ${Math.trunc(elapsed / 1000)}s, the best is ${BEST_TIME}s.`
  );
}

// Check
execSync(
  'diff -rq tests/prompt-engineering/backup-agent/source tests/prompt-engineering/backup-agent/destination'
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
