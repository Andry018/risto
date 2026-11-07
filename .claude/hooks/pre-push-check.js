#!/usr/bin/env node
// PreToolUse(Bash): prima di un `git push` esegue build + test dell'app.
// Su questo repo push su main = deploy in produzione (autopull sul CT ogni 2 min),
// quindi un push con build rotta o test falliti non deve partire.
// Exit 2 = blocca il comando e mostra lo stderr a Claude.
const { execSync } = require('child_process');
const path = require('path');

let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = JSON.parse(raw).tool_input?.command || ''; } catch { process.exit(0); }
  if (!/(^|[;&|(\s])git\s+push\b/.test(cmd)) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
  const app = path.join(root, 'asporto-app');
  for (const [label, run] of [['build (tsc + vite)', 'npm run build'], ['test (vitest)', 'npm test']]) {
    try {
      execSync(run, { cwd: app, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      const out = `${e.stdout || ''}\n${e.stderr || ''}`.trim().split('\n').slice(-40).join('\n');
      process.stderr.write(`Push bloccato: ${label} fallito in asporto-app.\nPush su main = deploy in produzione: correggi prima.\n\n${out}\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
