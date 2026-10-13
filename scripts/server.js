import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm'
};

function parseArgs() {
    const args = process.argv.slice(2);
    let port = parseInt(process.env.PORT, 10) || 8080;
    let dir = null;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--port' || arg === '-p') {
            port = parseInt(args[++i], 10) || port;
        } else if (arg === '--dir' || arg === '-d') {
            dir = args[++i];
        } else if (!arg.startsWith('-') && !dir) {
            dir = arg;
        }
    }

    if (!dir) {
        dir = '.';
    }

    return { port, dir: path.resolve(process.cwd(), dir) };
}

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null;
}

function startServer(rootDirectory, preferredPort) {
    const server = http.createServer((req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
            return;
        }

        // Parse requested path
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        let decodedPath = decodeURIComponent(urlObj.pathname);

        // Security: prevent directory traversal
        let safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
        let filePath = path.join(rootDirectory, safePath);

        // If not found in root, also check public/ directory
        if (!fs.existsSync(filePath)) {
            const publicPath = path.join(rootDirectory, 'public', safePath);
            if (fs.existsSync(publicPath)) {
                filePath = publicPath;
            }
        }

        // If directory, look for index.html
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        // SPA fallback: If file doesn't exist and has no extension, serve root index.html
        if (!fs.existsSync(filePath)) {
            if (!path.extname(safePath)) {
                const rootIndex = path.join(rootDirectory, 'index.html');
                if (fs.existsSync(rootIndex)) {
                    filePath = rootIndex;
                }
            }
        }

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`404 Not Found: ${decodedPath}`);
            return;
        }

        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const range = req.headers.range;

        // HTTP 206 Range requests (crucial for video/audio streaming and seeking)
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

            if (start >= stat.size || end >= stat.size || start > end) {
                res.writeHead(416, {
                    'Content-Range': `bytes */${stat.size}`
                });
                res.end();
                return;
            }

            const chunkSize = (end - start) + 1;
            const fileStream = fs.createReadStream(filePath, { start, end });

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            });

            if (req.method === 'HEAD') {
                res.end();
            } else {
                fileStream.pipe(res);
            }
            return;
        }

        // Standard 200 OK delivery
        res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache'
        });

        if (req.method === 'HEAD') {
            res.end();
        } else {
            fs.createReadStream(filePath).pipe(res);
        }
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${preferredPort} in use, trying ${preferredPort + 1}...`);
            startServer(rootDirectory, preferredPort + 1);
        } else {
            console.error('Server error:', err);
        }
    });

    server.listen(preferredPort, () => {
        const localIp = getLocalIp();
        console.log('\n' + '='.repeat(60));
        console.log('🚀 Servidor HTTP Independente (Node.js)');
        console.log('='.repeat(60));
        console.log(`📁 Diretório servido: ${rootDirectory}`);
        console.log(`📡 Local:             http://localhost:${preferredPort}/`);
        if (localIp) {
            console.log(`🌐 Rede local:        http://${localIp}:${preferredPort}/`);
        }
        console.log('⚡ Suporte a Range Requests (206) para vídeos MP4 habilitado');
        console.log('⚡ CORS e SPA fallback habilitados');
        console.log('='.repeat(60) + '\n');
    });

    return server;
}

const { port, dir } = parseArgs();
startServer(dir, port);
