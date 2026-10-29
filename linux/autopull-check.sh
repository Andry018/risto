#!/bin/bash
# Lanciato ogni 2 minuti da risto-autopull.timer: se su GitHub c'è un commit nuovo, aggiorna.
# Sostituisce il webhook GitHub (che doveva essere raggiungibile da internet e non lo era).
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

RISTO_BASE="${RISTO_BASE:-/opt/risto}"
cd "$RISTO_BASE"

git fetch --quiet origin
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$branch")" ]; then
  exec bash "$RISTO_BASE/linux/autopull.sh"
fi
