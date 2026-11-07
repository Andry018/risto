#!/usr/bin/env node
// PreToolUse(Edit|Write): blocca le modifiche ai file delicati del progetto.
// - .env (segreti; i .env.example invece si possono modificare)
// - keystore Android / password (non devono stare nel repo pubblico)
// - package-lock.json: si aggiorna solo con npm install/ci, mai a mano
//   (sul CT `npm ci` si rompe se compaiono pacchetti obbligatori solo-win32)
// Exit 2 = blocca e spiega il motivo a Claude.
let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let file = '';
  try {
    const input = JSON.parse(raw).tool_input || {};
    file = String(input.file_path || input.path || '');
  } catch {
    // JSON non valido: non lasciar passare per errore, prova a estrarre il percorso a mano
    const m = /"(?:file_path|path)"\s*:\s*"([^"]*)"/.exec(raw);
    if (!m) process.exit(0);
    file = m[1];
  }
  const name = file.replace(/\\/g, '/').split('/').pop().toLowerCase();

  const rules = [
    [/^\.env(\..+)?$/, n => !n.endsWith('.example'), 'file .env con segreti: modificalo a mano sul server/PC, non da Claude'],
    [/keystore/, () => true, 'keystore/password di firma Android: non va modificato né committato'],
    [/^package-lock\.json$/, () => true, 'lockfile: si aggiorna solo con `npm install`/`npm ci`, mai a mano'],
  ];
  for (const [re, extra, why] of rules) {
    if (re.test(name) && extra(name)) {
      process.stderr.write(`Modifica bloccata su ${file}: ${why}.\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
