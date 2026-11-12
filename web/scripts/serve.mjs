/**
 * serve.mjs — Servidor HTTP Estático Zero-Dependency para testar a versão Web (TypeScript)
 * Uso: node web/scripts/serve.mjs [porta]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const port = parseInt(process.argv[2] || process.env.PORT || '8000', 10);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.cardpack': 'application/json; charset=utf-8',
    '.sheetc': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const safeUrl = decodeURIComponent((req.url || '/').split('?')[0]);
    const relPath = safeUrl === '/' ? '/index.html' : safeUrl;
    const filePath = path.join(webRoot, relPath);

    // Previne Path Traversal fora de webRoot
    if (!filePath.startsWith(webRoot)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`404 Not Found: ${safeUrl}`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(port, '127.0.0.1', () => {
    console.log(`🚀 [RPG-SheetC Web] Servidor ativo em http://localhost:${port}`);
    console.log(`📂 Servindo diretório: ${webRoot}`);
});
