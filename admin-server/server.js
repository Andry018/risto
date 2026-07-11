const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Config ──────────────────────────────────────────────
const PORT = 4000;
const BASE = 'C:\\risto';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'ristorante123';
const LOG_FILE = path.join(BASE, 'log_git.txt');
const NGINX_DIR = path.join(BASE, 'nginx');
const AGENT_BAT = path.join(BASE, 'avvia_stampante.bat');
const AUTOPULL_BAT = path.join(BASE, 'autopull.bat');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

// ── Auth ────────────────────────────────────────────────
function authenticate(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) return false;
  const raw = Buffer.from(auth.slice(6), 'base64').toString('utf8');
  const [u, p] = raw.split(':');
  return u === ADMIN_USER && p === ADMIN_PASS;
}

function requireAuth(req, res) {
  if (!authenticate(req)) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="Pannello Amministrazione", charset="UTF-8"'
    });
    res.end('Accesso negato');
    return false;
  }
  return true;
}

// ── Helpers ─────────────────────────────────────────────
function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function runCmd(cmd, opts = {}) {
  return new Promise((resolve) => {
    exec(cmd, { ...opts, windowsHide: true }, (err, stdout, stderr) => {
      resolve({
        code: err ? err.code || 1 : 0,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        error: err ? err.message : null,
      });
    });
  });
}

function isRunning(name) {
  return new Promise((resolve) => {
    exec(`tasklist /fi "IMAGENAME eq ${name}"`, { windowsHide: true }, (err, stdout) => {
      resolve(stdout ? stdout.toLowerCase().includes(name.toLowerCase()) : false);
    });
  });
}

function readTailLines(filePath, n = 100) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    return lines.filter(Boolean).slice(-n);
  } catch {
    return [];
  }
}

// ── Routes ──────────────────────────────────────────────
async function router(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method;
  const pathname = url.pathname;

  // CORS per sicurezza (tanto passa da nginx)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // ── Static files ──────────────────────────────
  if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    const filePath = path.join(PUBLIC_DIR, 'index.html');
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    return fs.createReadStream(filePath).pipe(res);
  }

  if (method === 'GET' && pathname.startsWith('/static/')) {
    const filePath = path.join(PUBLIC_DIR, pathname.slice(1));
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    return fs.createReadStream(filePath).pipe(res);
  }

  // ── API routes (auth required) ────────────────
  if (!requireAuth(req, res)) return;

  // GET /api/status
  if (method === 'GET' && pathname === '/api/status') {
    const [nginx, printAgent] = await Promise.all([
      isRunning('nginx.exe'),
      isRunning('cmd.exe'),
    ]);
    const printRunning = printAgent; // window title check would need tasklist /v parsing
    return json(res, 200, { nginx, printAgent: printRunning });
  }

  // GET /api/log
  if (method === 'GET' && pathname === '/api/log') {
    const lines = readTailLines(LOG_FILE, 200);
    return json(res, 200, { lines, total: lines.length });
  }

  // POST /api/restart-nginx
  if (method === 'POST' && pathname === '/api/restart-nginx') {
    await runCmd('taskkill /f /im nginx.exe');
    const child = spawn('cmd.exe', ['/c', 'start', '', 'cmd.exe', '/c', `${NGINX_DIR}\\nginx.exe`], {
      detached: true,
      stdio: 'ignore',
      cwd: NGINX_DIR,
      windowsHide: true,
    });
    child.unref();
    return json(res, 200, { ok: true, message: 'Nginx riavviato' });
  }

  // POST /api/autopull
  if (method === 'POST' && pathname === '/api/autopull') {
    const result = await runCmd(`"${AUTOPULL_BAT}"`, { cwd: BASE });
    return json(res, 200, { ok: result.code === 0, ...result });
  }

  // POST /api/restart-print
  if (method === 'POST' && pathname === '/api/restart-print') {
    // Kill the print-agent cmd window (which kills the node child)
    await runCmd('taskkill /f /fi "WINDOWTITLE eq AGENTE STAMPANTE*"');
    // Backup: kill lingering node processes from the print-agent dir via PowerShell
    await runCmd(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name='node.exe'\\" | Where-Object { $_.CommandLine -like '*print-agent*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`);
    // Start fresh via the auto-restart batch
    const child = spawn('cmd.exe', ['/c', 'start', '', 'cmd.exe', '/c', AGENT_BAT], {
      detached: true,
      stdio: 'ignore',
      cwd: BASE,
      windowsHide: true,
    });
    child.unref();
    return json(res, 200, { ok: true, message: 'Print Agent riavviato' });
  }

  // POST /api/exec (raw command — per admin esperti)
  if (method === 'POST' && pathname === '/api/exec') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on('end', async () => {
      try {
        const { cmd } = JSON.parse(body || '{}');
        if (!cmd || cmd.length > 500) {
          return json(res, 400, { ok: false, error: 'Comando vuoto o troppo lungo' });
        }
        const result = await runCmd(cmd, { cwd: BASE });
        return json(res, 200, { ok: result.code === 0, ...result });
      } catch (e) {
        return json(res, 400, { ok: false, error: e.message });
      }
    });
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
}

// ── Server ──────────────────────────────────────────────
const server = http.createServer(router);

function tryListen(port) {
  server.listen(port, '127.0.0.1', () => {
    console.log(`[ADMIN] Pannello su http://127.0.0.1:${port}`);
    console.log(`[ADMIN] Auth: ${ADMIN_USER} / **** (imposta via ADMIN_PASS env)`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < PORT + 10) {
      console.log(`[ADMIN] Porta ${port} occupata, provo ${port + 1}...`);
      tryListen(port + 1);
    } else {
      console.error('[ADMIN] Errore avvio server:', err.message);
      process.exit(1);
    }
  });
}

tryListen(PORT);

process.on('SIGINT', () => { server.close(); process.exit(); });
process.on('SIGTERM', () => { server.close(); process.exit(); });
