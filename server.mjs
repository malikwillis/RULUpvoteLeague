import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHandler } from './server/handler.mjs';
import { createFileStore } from './server/store.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
try { process.loadEnvFile(path.join(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const handler = createHandler({store: createFileStore(path.join(root, '.rul-data/season.json')), local: true});
const files = new Set(['index.html','styles.css','app.js','core.js','data.js','lineups.js','schedule.js','schedule-view.js','access.js','account-view.js','draft-capital.js','capital-data.js','trade-core.js','trade-view.js','season-seed.js','history-seed.js']);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const port = Number(process.env.PORT || 4173);
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/api/rul') return await handler(req, res);
    if ((pathname === '/' || pathname === '/index.html') && req.headers.host === `127.0.0.1:${port}`) {
      res.writeHead(302, {'Location':`http://localhost:${port}/`, 'Cache-Control':'no-store'}); res.end(); return;
    }
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!['GET','HEAD'].includes(req.method) || !files.has(name)) {res.writeHead(404); res.end('Not found'); return;}
    const body = await readFile(path.join(root, name));
    res.writeHead(200, {'Content-Type':types[path.extname(name)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {res.writeHead(404); res.end('Not found');}
}).listen(port, '127.0.0.1', () => console.log(`RUL local preview: http://127.0.0.1:${port}`));
