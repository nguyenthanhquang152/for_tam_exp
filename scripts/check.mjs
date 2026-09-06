import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const venv = path.resolve('.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.HEATMAP_PYTHON || (existsSync(venv) ? venv : 'python3');
execFileSync(python, ['test_plot_bacteria.py'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--test', 'tests/model.test.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], { stdio: 'inherit' });
