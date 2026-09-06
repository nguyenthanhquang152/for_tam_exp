import { execFileSync } from 'node:child_process';
import { root, runPython } from './runtime.mjs';

process.chdir(root);
runPython(['-m', 'unittest', 'discover', '-s', 'tests/python', '-v'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--test', 'tests/unit/model.test.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], { stdio: 'inherit' });
