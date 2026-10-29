#!/bin/bash
# Chiude alla rete del locale (LAN/Wi-Fi) i servizi che devono essere usati solo dal server stesso.
# Tablet, telefoni e tunnel Cloudflare passano sempre da nginx (porta 80), che resta aperto.
#
#   Supabase (container Docker): 54321 API diretta, 54323 Studio (nessuna password!),
#                                54324 mail di test, 54327 analytics, 54332 Postgres
#   Agent (processi Node):       8787 stampa, 8788 POS/cassa, 8789 WhatsApp
#
# Per usare Studio o Postgres dal PC: tunnel SSH, es.
#   ssh -J root@<ip-proxmox> -L 54323:127.0.0.1:54323 root@192.168.1.250   → http://localhost:54323
#
# Applicato all'avvio da risto-firewall.service (e riapplicato se Docker si riavvia). Idempotente.
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

IFACE="${RISTO_LAN_IFACE:-eth0}"
DOCKER_PORTS="54321 54323 54324 54327 54332"
HOST_PORTS="8787,8788,8789"

# Porte pubblicate da Docker: il traffico è già stato rediretto (DNAT) al container quando
# attraversa DOCKER-USER, quindi si confronta la porta ORIGINALE tramite conntrack.
iptables -N RISTO-DOCKER 2>/dev/null || iptables -F RISTO-DOCKER
for p in $DOCKER_PORTS; do
  iptables -A RISTO-DOCKER -i "$IFACE" -p tcp -m conntrack --ctorigdstport "$p" -j DROP
done
iptables -N DOCKER-USER 2>/dev/null || true
iptables -C DOCKER-USER -j RISTO-DOCKER 2>/dev/null || iptables -I DOCKER-USER -j RISTO-DOCKER

# Processi sull'host (agent) + accesso IPv4/IPv6 diretto (docker-proxy)
iptables -N RISTO-INPUT 2>/dev/null || iptables -F RISTO-INPUT
iptables -A RISTO-INPUT -i "$IFACE" -p tcp -m multiport --dports "$HOST_PORTS,${DOCKER_PORTS// /,}" -j DROP
iptables -C INPUT -j RISTO-INPUT 2>/dev/null || iptables -I INPUT -j RISTO-INPUT

if command -v ip6tables >/dev/null; then
  ip6tables -N RISTO-INPUT 2>/dev/null || ip6tables -F RISTO-INPUT
  ip6tables -A RISTO-INPUT -i "$IFACE" -p tcp -m multiport --dports "$HOST_PORTS,${DOCKER_PORTS// /,}" -j DROP
  ip6tables -C INPUT -j RISTO-INPUT 2>/dev/null || ip6tables -I INPUT -j RISTO-INPUT
fi

echo "Firewall Risto applicato su $IFACE"
