import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = { '/': ['heatmap.html', 'text/html'], '/heatmap.html': ['heatmap.html', 'text/html'], '/data.json': ['data.json', 'application/json'] };
const port = Number(process.env.HEATMAP_PORT || 4173);
createServer(async (request, response) => {
  const file = files[new URL(request.url, 'http://localhost').pathname];
  if (!file || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const content = await readFile(new URL(`../dist/${file[0]}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(503).end('Run npm run build first.');
  }
}).listen(port, '127.0.0.1', () => console.log(`Heatmap: http://127.0.0.1:${port}`));
