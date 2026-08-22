const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Config ──────────────────────────────────────────────
const PORT       = 4000;
const IS_WIN     = process.platform === 'win32';
const BASE       = process.env.RISTO_BASE || (IS_WIN ? 'C:\\risto' : '/opt/risto');
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const LOG_FILE   = path.join(BASE, IS_WIN ? 'log_git.txt' : 'logs/autopull.log');
const NGINX_DIR  = path.join(BASE, 'nginx');
// Script di avvio agenti: .bat su Windows, .sh su Linux
const AGENT_SCRIPT    = IS_WIN ? path.join(BASE, 'avvia_stampante.bat')       : path.join(BASE, 'linux', 'services', '_restart-print.sh');
const AUTOPULL_SCRIPT = IS_WIN ? path.join(BASE, 'autopull.bat')              : path.join(BASE, 'linux', 'autopull.sh');

// ── Auth ────────────────────────────────────────────────
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function authenticate(req) {
  if (!ADMIN_SECRET) return false;
  const header = req.headers['x-admin-secret'];
  return typeof header === 'string' && header.length > 0 && timingSafeEqual(header, ADMIN_SECRET);
}

function requireAuth(req, res) {
  if (!authenticate(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Accesso negato' }));
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
    // Windows: tasklist — Linux: pgrep
    const cmd = IS_WIN
      ? `tasklist /fi "IMAGENAME eq ${name}"`
      : `pgrep -x "${name.replace('.exe', '')}" > /dev/null 2>&1 && echo yes || echo no`;
    exec(cmd, { windowsHide: true }, (err, stdout) => {
      if (IS_WIN) {
        resolve(stdout ? stdout.toLowerCase().includes(name.toLowerCase()) : false);
      } else {
        resolve((stdout || '').trim() === 'yes');
      }
    });
  });
}

function isNodeScriptRunning(pattern) {
  return new Promise((resolve) => {
    const cmd = IS_WIN
      ? `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name='node.exe'\\" | Where-Object { $_.CommandLine -like '*${pattern}*' } | Measure-Object | Select-Object -ExpandProperty Count"`
      : `pgrep -f "${pattern}" | wc -l`;
    exec(cmd, { windowsHide: true }, (err, stdout) => {
      resolve(parseInt((stdout || '0').trim()) > 0);
    });
  });
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const cmd = IS_WIN
      ? `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty State"`
      : `ss -tlnp 2>/dev/null | grep -q ":${port} " && echo Listen || echo no`;
    exec(cmd, { windowsHide: true }, (err, stdout) => {
      resolve((stdout || '').trim() === 'Listen');
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

  // Non c'e' piu' una UI propria: il frontend e' la pagina "Pannello Sistema"
  // dentro la webapp (vedi src/components/SystemPanelView.tsx), che chiama
  // solo queste API JSON.
  // ── API routes (auth required) ────────────────
  if (!requireAuth(req, res)) return;

  // GET /api/status
  if (method === 'GET' && pathname === '/api/status') {
    const [nginx, webhook, adminServer, printAgent, ecrAgent] = await Promise.all([
      IS_WIN ? isRunning('nginx.exe')   : isRunning('nginx'),
      IS_WIN ? isRunning('webhook.exe') : isRunning('webhook'),
      isPortListening(4000),
      isNodeScriptRunning('print-agent'),
      isNodeScriptRunning('ecr-agent'),
    ]);
    return json(res, 200, { nginx, webhook, adminServer, printAgent, ecrAgent });
  }

  // GET /api/log
  if (method === 'GET' && pathname === '/api/log') {
    const lines = readTailLines(LOG_FILE, 200);
    return json(res, 200, { lines, total: lines.length });
  }

  // POST /api/restart-nginx
  if (method === 'POST' && pathname === '/api/restart-nginx') {
    let result;
    if (IS_WIN) {
      await runCmd('taskkill /f /im nginx.exe');
      spawn('cmd.exe', ['/c', 'start', '', 'cmd.exe', '/c', `${NGINX_DIR}\\nginx.exe`], { detached: true, stdio: 'ignore', cwd: NGINX_DIR, windowsHide: true }).unref();
      result = { ok: true };
    } else {
      result = await runCmd('systemctl reload-or-restart nginx');
    }
    return json(res, 200, { ok: true, message: 'Nginx riavviato', ...result });
  }

  // POST /api/autopull
  if (method === 'POST' && pathname === '/api/autopull') {
    const cmd = IS_WIN ? `"${AUTOPULL_SCRIPT}"` : `bash "${AUTOPULL_SCRIPT}"`;
    const result = await runCmd(cmd, { cwd: BASE });
    return json(res, 200, { ok: result.code === 0, ...result });
  }

  // POST /api/restart-print
  if (method === 'POST' && pathname === '/api/restart-print') {
    if (IS_WIN) {
      await runCmd(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name='node.exe'\\" | Where-Object { $_.CommandLine -like '*print-agent*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`);
      spawn('cmd.exe', ['/c', 'start', '', 'cmd.exe', '/c', AGENT_SCRIPT], { detached: true, stdio: 'ignore', cwd: BASE, windowsHide: true }).unref();
    } else {
      await runCmd('systemctl restart risto-print');
    }
    return json(res, 200, { ok: true, message: 'Print Agent riavviato' });
  }

  // POST /api/restart-webhook
  if (method === 'POST' && pathname === '/api/restart-webhook') {
    if (IS_WIN) {
      await runCmd('taskkill /f /im webhook.exe');
      const whPath = path.join(BASE, 'webhook.exe');
      if (fs.existsSync(whPath)) {
        spawn('cmd.exe', ['/c', 'start', '', whPath, '-hooks', path.join(BASE, 'hooks.json'), '-verbose', '-port', '9000'], { detached: true, stdio: 'ignore', cwd: BASE, windowsHide: true }).unref();
      }
    } else {
      await runCmd('systemctl restart risto-webhook');
    }
    return json(res, 200, { ok: true, message: 'Webhook riavviato' });
  }

  // POST /api/restart-admin
  if (method === 'POST' && pathname === '/api/restart-admin') {
    if (IS_WIN) {
      spawn('cmd.exe', ['/c', 'timeout', '/t', '1', '&', 'start', '', 'cmd.exe', '/c', path.join(BASE, 'avvia_pannello.bat')], { detached: true, stdio: 'ignore', cwd: BASE, windowsHide: true }).unref();
    } else {
      // Riavvio tramite systemd in background dopo la response
      setTimeout(() => runCmd('systemctl restart risto-admin'), 500);
    }
    setTimeout(() => { process.exit(0); }, 500);
    return json(res, 200, { ok: true, message: 'Admin server in riavvio...' });
  }

  // POST /api/restart-all
  if (method === 'POST' && pathname === '/api/restart-all') {
    if (IS_WIN) {
      await Promise.allSettled([
        runCmd('taskkill /f /im nginx.exe'),
        runCmd('taskkill /f /im webhook.exe'),
        runCmd(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name='node.exe'\\" | Where-Object { $_.CommandLine -like '*print-agent*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`),
      ]);
      spawn('cmd.exe', ['/c', 'start', '', 'cmd.exe', '/c', `${NGINX_DIR}\\nginx.exe`], { detached: true, stdio: 'ignore', cwd: NGINX_DIR, windowsHide: true }).unref();
      const whPath = path.join(BASE, 'webhook.exe');
      if (fs.existsSync(whPath)) {
        spawn('cmd.exe', ['/c', 'start', '', whPath, '-hooks', path.join(BASE, 'hooks.json'), '-verbose', '-port', '9000'], { detached: true, stdio: 'ignore', cwd: BASE, windowsHide: true }).unref();
      }
      spawn('cmd.exe', ['/c', 'start', '', 'cmd.exe', '/c', AGENT_SCRIPT], { detached: true, stdio: 'ignore', cwd: BASE, windowsHide: true }).unref();
    } else {
      await runCmd('systemctl reload-or-restart nginx risto-print risto-ecr risto-webhook');
    }
    return json(res, 200, { ok: true, message: 'Tutti i servizi riavviati' });
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
}

// ── Server ──────────────────────────────────────────────
if (!ADMIN_SECRET) {
  console.error('[ADMIN] ADMIN_SECRET non impostato: rifiuto di avviarmi per sicurezza.');
  console.error('[ADMIN] Imposta la variabile d\'ambiente ADMIN_SECRET (stessa stringa da inserire nella pagina "Pannello Sistema" della webapp) prima di avviare.');
  process.exit(1);
}

const server = http.createServer(router);

function tryListen(port) {
  server.listen(port, '127.0.0.1', () => {
    console.log(`[ADMIN] Pannello su http://127.0.0.1:${port}`);
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
