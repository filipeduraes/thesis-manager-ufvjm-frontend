#!/usr/bin/env bash
# Executa a suíte E2E com portas, banco, mídia e diretórios de saída únicos.
# Permite que dois agentes rodem a suíte ao mesmo tempo sem conflito.
set -euo pipefail

cd "$(dirname "$0")/.."

RUN_ID="${E2E_RUN_ID:-$$-$(date +%s%N)}"
mapfile -t PORTS < <(python3 - <<'PY'
import socket
sockets = [socket.socket() for _ in range(3)]
ports = []
for sock in sockets:
    sock.bind(("127.0.0.1", 0))
    ports.append(sock.getsockname()[1])
print("\n".join(str(port) for port in ports))
for sock in sockets:
    sock.close()
PY
)

export E2E_RUN_ID="$RUN_ID"
export E2E_BACKEND_PORT="${PORTS[0]}"
export E2E_FRONTEND_PORT="${PORTS[1]}"
export E2E_WORKER_PORT="${PORTS[2]}"
export E2E_DB_NAME="/tmp/opencode/e2e-${RUN_ID}.sqlite3"
export E2E_MEDIA_ROOT="/tmp/opencode/e2e-media-${RUN_ID}"

echo "E2E isolada: runId=${RUN_ID} portas=${E2E_BACKEND_PORT}/${E2E_FRONTEND_PORT}/${E2E_WORKER_PORT}"
npm run test:e2e
