import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

import { root, runPython } from './runtime.mjs';

process.chdir(root);
const data = runPython(['-m', 'shrimp_microbiota', 'export', ...process.argv.slice(2)], { encoding: 'utf8' });
await mkdir('.build', { recursive: true });
await writeFile('.build/data.generated.json', data);
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { stdio: 'inherit' });
const bundle = await build({
  entryPoints: ['web/src/app.ts'], bundle: true, format: 'iife', target: 'es2022',
  minify: true, write: false, legalComments: 'none', charset: 'ascii',
});
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const { code: css } = await transform(await readFile('web/src/styles.css', 'utf8'), { loader: 'css', minify: true });
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
