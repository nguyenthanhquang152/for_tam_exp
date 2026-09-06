import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
const venv = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export const python = process.env.HEATMAP_PYTHON || (existsSync(venv) ? venv : 'python3');
export function runPython(args, options = {}) {
  return execFileSync(python, args, { cwd: root, ...options });
}
