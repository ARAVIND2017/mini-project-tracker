// Serves dist/ the way the static hosts will: the headers from dist/_headers and the
// single-page-app fallback. Used to run the end-to-end tests against the production
// build with its Content-Security-Policy (PW_BASE_URL=http://localhost:4173).
//   node scripts/serve-dist.mjs [port]
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const port = Number(process.argv[2] ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

// Parse _headers: a path pattern line, then indented "Name: value" lines.
const rules = [];
for (const line of readFileSync(join(root, '_headers'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (!line.startsWith(' ')) rules.push({ pattern: line.trim(), headers: {} });
  else {
    const i = line.indexOf(':');
    rules.at(-1).headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
const matches = (pattern, path) =>
  pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern;

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  let served = path;
  try {
    if (!statSync(file).isFile()) throw new Error('dir');
  } catch {
    file = join(root, 'index.html'); // SPA fallback (_redirects: /* /index.html 200)
    served = '/index.html';
  }
  const headers = { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' };
  for (const r of rules)
    if (matches(r.pattern, path) || matches(r.pattern, served)) Object.assign(headers, r.headers);
  res.writeHead(200, headers).end(readFileSync(file));
}).listen(port, () => console.log(`serving dist on http://localhost:${port}`));
