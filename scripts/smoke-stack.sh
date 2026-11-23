#!/usr/bin/env bash
# Sobe um stack Docker isolado só para o smoke, roda o smoke e destrói tudo.
#
# O stack usa COMPOSE_PROJECT_NAME=thesis-smoke: volumes, bancos, filas e
# contêineres são distintos do sistema (`thesis-manager-ufvjm-backend`). Assim
# nenhum dado de teste aparece no banco de desenvolvimento e nada se acumula.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$(cd "$ROOT/../thesis-manager-ufvjm-backend" && pwd)"
FRONTEND_LOG="$(mktemp /tmp/opencode/smoke-frontend.XXXXXX)"

# O sudo descarta variáveis de ambiente; o Compose lê --env-file no processo
# root, então as portas chegam corretamente sem precisar de sudo -E/SETENV.
ENV_FILE="$(mktemp /tmp/opencode/smoke-ports.XXXXXX)"

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
else
  DOCKER=(sudo docker)
fi

cat "$BACKEND_DIR/.env" > "$ENV_FILE"
cat >> "$ENV_FILE" <<EOF
COMPOSE_PROJECT_NAME=thesis-smoke
POSTGRES_HOST_PORT=5434
BACKEND_PORT=9000
FRONTEND_PORT=9001
MAILPIT_PORT=9025
RABBITMQ_PORT=5673
RABBITMQ_UI_PORT=15673
EOF

export COMPOSE_PROJECT_NAME=thesis-smoke
export BACKEND_PORT=9000 FRONTEND_PORT=9001 MAILPIT_PORT=9025
export E2E_API_URL="http://127.0.0.1:${BACKEND_PORT}/api/v1"
export E2E_BASE_URL="http://127.0.0.1:${FRONTEND_PORT}"
export MAILPIT_URL="http://127.0.0.1:${MAILPIT_PORT}"

COMPOSE=("${DOCKER[@]}" compose --env-file "$ENV_FILE" -f "$BACKEND_DIR/docker-compose.yml")
# O down precisa do profile para remover também o serviço frontend.
COMPOSE_ALL=("${COMPOSE[@]}" --profile frontend)

cleanup() {
  echo "==> Destruindo o stack de smoke (incluindo volumes)"
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill -TERM -- "-${FRONTEND_PID}" 2>/dev/null || kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  "${COMPOSE_ALL[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$ENV_FILE" "$FRONTEND_LOG"
}
trap cleanup EXIT

echo "==> Subindo stack de smoke: backend=${BACKEND_PORT} frontend=${FRONTEND_PORT} mailpit=${MAILPIT_PORT}"
"${COMPOSE_ALL[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
"${COMPOSE[@]}" up -d --build --wait

# O frontend do Compose roda npm install na subida (lento); use o local, que já
# tem node_modules, apontando para o backend isolado.
cd "$ROOT"
setsid env PORT=9001 REACT_APP_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" BROWSER=none npm start > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

echo "==> Aguardando frontend em 127.0.0.1:${FRONTEND_PORT}"
for _ in $(seq 1 90); do
  if curl --noproxy '*' -sf -o /dev/null "http://127.0.0.1:${FRONTEND_PORT}/"; then
    break
  fi
  sleep 2
done
if ! curl --noproxy '*' -sf -o /dev/null "http://127.0.0.1:${FRONTEND_PORT}/"; then
  echo "Frontend não ficou pronto; log:"
  tail -20 "$FRONTEND_LOG"
  exit 1
fi

npx playwright test --config playwright.real.config.ts
