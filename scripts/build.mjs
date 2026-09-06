import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const venv = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.HEATMAP_PYTHON || (existsSync(venv) ? venv : 'python3');
const data = execFileSync(python, ['export_web_data.py', ...process.argv.slice(2)], { encoding: 'utf8' });
await writeFile('web/data.generated.json', data);
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { stdio: 'inherit' });
const bundle = await build({
  entryPoints: ['web/app.ts'], bundle: true, format: 'iife', target: 'es2022',
  minify: true, write: false, legalComments: 'none', charset: 'ascii',
});
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const { code: css } = await transform(await readFile('web/styles.css', 'utf8'), { loader: 'css', minify: true });
const hash = text => createHash('sha256').update(text).digest('base64');
const policy = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(css)}'; img-src data: blob:; base-uri 'none'; form-action 'none'; object-src 'none'`;
const html = (await readFile('web/index.html', 'utf8'))
  .replace('<!-- CSP -->', `<meta http-equiv="Content-Security-Policy" content="${policy}">`)
  .replace('<!-- STYLE -->', `<style>${css}</style>`)
  .replace('<!-- SCRIPT -->', `<script>${script}</script>`);
await mkdir('dist', { recursive: true });
await writeFile('dist/heatmap.html.tmp', html);
await rename('dist/heatmap.html.tmp', 'dist/heatmap.html');
await writeFile('dist/data.json', data + '\n');
console.log(`Built dist/heatmap.html (${Math.round(Buffer.byteLength(html) / 1024)} KB); ${JSON.parse(data).rows.length} validated records. Works offline.`);
