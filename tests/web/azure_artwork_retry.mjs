// Execute the workflow's actual Bash wrapper against transient and persistent failures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const workflow = await readFile('.github/workflows/azure-static-web-apps.yml', 'utf8');
const block = workflow.split('      - name: Prepare and verify artwork')[1].split('      - name: Build the engine and website')[0];
const body = block.split('        run: |')[1].split('          retry_artwork node')[0].split('\n').map(s => s.replace(/^          /, '')).join('\n');
const script = `${body}
sleep() { printf '%s ' "$1"; }
attempts=0
transient() { attempts=$((attempts + 1)); [ "$attempts" -ge 3 ]; }
retry_artwork transient
[ "$attempts" -eq 3 ]
attempts=0
persistent() { attempts=$((attempts + 1)); return 1; }
if retry_artwork persistent; then exit 99; fi
[ "$attempts" -eq 4 ]
echo RETRY_CHECK_PASSED
`;
const run = spawnSync(process.env.BASH_EXECUTABLE || 'bash', ['--noprofile', '--norc'], { input: script, encoding: 'utf8' });
assert.ifError(run.error);
assert.equal(run.status, 0, run.stdout + run.stderr);
assert.match(run.stdout, /RETRY_CHECK_PASSED/);
assert.match(run.stdout, /retrying in 15s/); assert.match(run.stdout, /retrying in 30s/); assert.match(run.stdout, /retrying in 45s/);
assert.match(workflow, /key: personal-artwork-v1-.*hashFiles/);
console.log('Workflow retries transient failures, backs off, and stops after persistent failure.');
