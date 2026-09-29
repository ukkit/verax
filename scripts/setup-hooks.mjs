// Runs on `npm install` (prepare). Points git at .githooks so the pre-commit scan is active.
// Does nothing outside a git checkout (e.g. a downloaded zip). A failure must not break the install, so it warns.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';

try {
  if (existsSync('.git') && existsSync('.githooks/pre-commit')) {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
    chmodSync('.githooks/pre-commit', 0o755);
  }
} catch (error) {
  console.warn(`setup-hooks: could not enable the pre-commit hook (${error.message}). Run \`git config core.hooksPath .githooks\` yourself.`);
}
