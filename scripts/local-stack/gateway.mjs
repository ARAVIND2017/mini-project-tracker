// LOCAL STACK ONLY. A tiny stand-in for Supabase's API gateway:
//   /auth/v1/*            -> GoTrue
//   /rest/v1/*            -> PostgREST
//   /functions/v1/<name>  -> local Edge Function (Deno)
import http from 'node:http';

const [, , port, authPort, restPort, functionsPort] = process.argv;
const routes = [
  ['/auth/v1', Number(authPort)],
  ['/rest/v1', Number(restPort)],
  ['/functions/v1/admin-users', Number(functionsPort)],
];

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, x-client-info, apikey, content-type, prefer, range, accept-profile, content-profile, x-supabase-api-version, x-retry-count',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range, x-supabase-api-version',
};

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    const route = routes.find(([prefix]) => req.url.startsWith(prefix));
    if (!route) {
      res.writeHead(404, cors);
      return res.end('not found');
    }
    const [prefix, target] = route;
    const path = req.url.slice(prefix.length) || '/';
    const headers = { ...req.headers, host: `127.0.0.1:${target}` };
    const upstream = http.request(
      { host: '127.0.0.1', port: target, method: req.method, path, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
        up.pipe(res);
      },
    );
    upstream.on('error', (err) => {
      res.writeHead(502, cors);
      res.end(`upstream error: ${err.message}`);
    });
    req.pipe(upstream);
  })
  .listen(Number(port), '127.0.0.1', () => console.log(`gateway on :${port}`));
