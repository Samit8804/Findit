const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = path.join(__dirname, 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    let filePath = path.join(ROOT, urlPath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(ROOT, urlPath + '.html');
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(ROOT, '404.html');
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.writeHead(500);
    res.end('Server error: ' + e.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`FindIt static server running at http://localhost:${PORT}`);
  const fs2 = require('fs');
  fs2.writeFileSync(path.join(__dirname, 'server.log'), `Started at ${new Date().toISOString()}\n`);
});

process.on('uncaughtException', (e) => {
  require('fs').appendFileSync(path.join(__dirname, 'server.log'), 'Error: ' + e.message + '\n');
});