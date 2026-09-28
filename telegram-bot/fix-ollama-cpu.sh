#!/bin/bash
# fix-ollama-cpu.sh — Ottimizza Ollama su CPU-only (16 GB RAM)
# Esegui come root: sudo bash fix-ollama-cpu.sh

set -euo pipefail

echo "=== Fix Ollama CPU-only ==="

# 1. Crea override systemd
OVERRIDE_DIR="/etc/systemd/system/ollama.service.d"
mkdir -p "$OVERRIDE_DIR"

cat > "$OVERRIDE_DIR/override.conf" <<'EOF'
[Service]
# === CPU & Parallelismo ===
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_THREAD=4"
Environment="GOMAXPROCS=4"

# === Memoria & Cache ===
Environment="OLLAMA_FLASH_ATTENTION=0"
Environment="OLLAMA_KV_CACHE_TYPE=f16"
Environment="OLLAMA_KEEP_ALIVE=24h"

# === Limiti hard (evita swap) ===
MemoryMax=4G
MemorySwapMax=0
MemoryHigh=3.5G

# === I/O ===
Nice=5
IOSchedulingClass=2
IOSchedulingPriority=4
EOF

echo "✓ Override systemd creato in $OVERRIDE_DIR/override.conf"

# 2. Aumenta limiti memlock per mlock
LIMITS_FILE="/etc/security/limits.d/99-ollama.conf"
cat > "$LIMITS_FILE" <<'EOF'
# Ollama - memlock per use_mlock
ollama  soft  memlock  unlimited
ollama  hard  memlock  unlimited
# Se ollama gira come root, usa * invece
*       soft  memlock  unlimited
*       hard  memlock  unlimited
EOF

echo "✓ Limiti memlock aggiunti in $LIMITS_FILE"

# 3. Kernel params per transparent hugepages (migliora memcpy)
SYSCTL_FILE="/etc/sysctl.d/99-ollama.conf"
cat > "$SYSCTL_FILE" <<'EOF'
# Transparent Huge Pages - sempre attivo per LLM
vm.nr_hugepages = 0
vm.hugepages_treat_as_movable = 1
# Swappiness basso (usa swap solo se strettamente necessario)
vm.swappiness = 10
# Dirty ratio - scrivi su disco meno spesso
vm.dirty_ratio = 10
vm.dirty_background_ratio = 5
EOF

sysctl --system >/dev/null 2>&1
echo "✓ Sysctl applicato"

# 4. Disabilita THP defrag (evita latency spikes) - solo se scrivibile
if [ -w /sys/kernel/mm/transparent_hugepage/defrag ]; then
  echo never > /sys/kernel/mm/transparent_hugepage/defrag 2>/dev/null || true
  echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
  
  # Rendi persistente
  cat > /etc/systemd/system/disable-thp.service <<'EOF'
[Unit]
Description=Disable Transparent Huge Pages defrag
Before=ollama.service

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/defrag; echo never > /sys/kernel/mm/transparent_hugepage/enabled'

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable disable-thp.service >/dev/null 2>&1
  systemctl start disable-thp.service
  echo "✓ THP defrag disabilitato"
else
  echo "⚠ THP non scrivibile (container/VM), salto disabilitazione"
fi

# 5. Riavvia Ollama
systemctl daemon-reload
systemctl restart ollama
echo "✓ Ollama riavviato"

# 6. Attendi che sia pronto
echo -n "Attendo Ollama pronto..."
for i in {1..30}; do
  if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo " OK"
    break
  fi
  echo -n "."
  sleep 1
done

# 7. Pre-carica modello (keep-alive 24h)
MODEL="${OLLAMA_MODEL:-phi3.5:3.8b-mini-instruct-q4_K_M}"
echo "Pre-carico modello: $MODEL"
curl -s -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"stream\":false,\"keep_alive\":\"24h\"}" >/dev/null
echo "✓ Modello caricato e tenuto in RAM (24h)"

# 7. Test veloce
echo ""
echo "=== Test velocità ==="
START=$(date +%s%3N)
curl -s -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Rispondi solo: OK\"}],\"stream\":false,\"options\":{\"temperature\":0.1,\"num_ctx\":2048,\"num_thread\":4,\"num_batch\":512}}" >/dev/null
END=$(date +%s%3N)
ELAPSED=$((END - START))
TOKENS=3
RATE=$(echo "scale=2; $TOKENS * 1000 / $ELAPSED" | bc -l 2>/dev/null || echo "N/A")
echo "Latency: ${ELAPSED}ms  (~${RATE} tok/s per 3 token)"

echo ""
echo "=== Fix completato ==="
echo "Prossimo test con prompt reale:"
echo "  curl -X POST http://localhost:11434/api/chat -H 'Content-Type: application/json' -d '{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Ciao\"}],\"stream\":false,\"options\":{\"temperature\":0.1,\"num_ctx\":2048,\"num_thread\":4,\"num_batch\":512}}'"