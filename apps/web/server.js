import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT) || 3000;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const requestedPath = normalize(join(root, pathname));
  const isSafePath = requestedPath.startsWith(root);
  const filePath = isSafePath && existsSync(requestedPath) && statSync(requestedPath).isFile()
    ? requestedPath
    : join(root, 'index.html');

  response.setHeader('Content-Type', mimeTypes[extname(filePath)] || 'application/octet-stream');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  createReadStream(filePath)
    .on('error', () => {
      response.statusCode = 500;
      response.end('Não foi possível carregar a aplicação.');
    })
    .pipe(response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Aplicação disponível na porta ${port}`);
});
