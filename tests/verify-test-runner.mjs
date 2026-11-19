import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {defaultChecks, extendedChecks, runSuites} from '../verify.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'parus-test-runner-'));
const messages = [], report = text => messages.push(text);
const options = {cwd, log: report, error: report};
try {
  fs.writeFileSync(path.join(cwd, 'pass.mjs'), "import fs from 'node:fs';fs.appendFileSync('order','pass\\n');");
  fs.writeFileSync(path.join(cwd, 'fail.mjs'), 'process.exitCode=7;');
  fs.writeFileSync(path.join(cwd, 'hang.mjs'), "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);");
  assert.equal(runSuites(['pass.mjs', 'pass.mjs'], options), 0);
  assert.equal(fs.readFileSync(path.join(cwd, 'order'), 'utf8'), 'pass\npass\n', 'checks run sequentially in the requested directory');
  assert.ok(messages.some(text => text.startsWith('PASS all 2')));
  messages.length = 0;
  assert.equal(runSuites(['fail.mjs', 'pass.mjs'], options), 1, 'a failing child cannot be reported as a successful suite');
  assert.ok(messages.some(text => text.includes('exit 7')));
  assert.ok(!messages.some(text => text.startsWith('PASS all')));
  messages.length = 0;
  const start = performance.now();
  assert.equal(runSuites(['hang.mjs', 'pass.mjs'], {...options, budgetMs: 200}), 1);
  assert.ok(performance.now() - start < 3000, 'a hung check is forcibly stopped');
  assert.ok(messages.some(text => text.includes('1 suites not run')));
  assert.ok(!messages.some(text => text.startsWith('PASS all')));
  messages.length = 0;
  assert.equal(runSuites(['pass.mjs'], {...options, budgetMs: 0}), 1, 'an exhausted budget never silently drops checks');

  for (const checks of [defaultChecks, extendedChecks]) {
    assert.equal(new Set(checks).size, checks.length);
    for (const check of checks) assert.ok(fs.existsSync(path.join(root, check)), check);
  }
  for (const check of defaultChecks) assert.ok(extendedChecks.includes(check), check);
  assert.ok(extendedChecks.includes('tests/verify-stream.mjs'));
  assert.ok(extendedChecks.includes('tests/verify-composed.mjs'));
  assert.ok(extendedChecks.includes('tests/verify-runtime-performance.mjs'));
  const cli = args => spawnSync(process.execPath, [path.join(root, 'verify.mjs'), ...args], {cwd, encoding: 'utf8', timeout: 3000});
  for (const [args, checks] of [[['--list'], defaultChecks], [['--extended', '--list'], extendedChecks]]) {
    const result = cli(args);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split('\n'), checks);
  }
  assert.equal(cli(['--help']).status, 0);
  assert.equal(cli(['--extened']).status, 2, 'a mistyped profile cannot run a different suite');
} finally {
  fs.rmSync(cwd, {recursive: true, force: true});
}
console.log('PASS test runner preserves failures, bounds hung children, reports unfinished checks and selects explicit profiles from any directory');
