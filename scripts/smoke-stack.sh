#!/usr/bin/env bash
# Sobe um stack Docker isolado só para o smoke, roda o smoke e destrói tudo.
#
# O stack usa COMPOSE_PROJECT_NAME=thesis-smoke: volumes, bancos, filas e
# contêineres são distintos do sistema (`thesis-manager-ufvjm-backend`). Assim
# nenhum dado de teste aparece no banco de desenvolvimento e nada se acumula.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$(cd "$ROOT/../thesis-manager-ufvjm-backend" && pwd)"

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-thesis-smoke}"
export POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-5434}"
export BACKEND_PORT="${BACKEND_PORT:-9000}"
export FRONTEND_PORT="${FRONTEND_PORT:-9001}"
export MAILPIT_PORT="${MAILPIT_PORT:-9025}"
export RABBITMQ_PORT="${RABBITMQ_PORT:-5673}"
export RABBITMQ_UI_PORT="${RABBITMQ_UI_PORT:-15673}"

export E2E_API_URL="http://localhost:${BACKEND_PORT}/api/v1"
export E2E_BASE_URL="http://localhost:${FRONTEND_PORT}"
export MAILPIT_URL="http://localhost:${MAILPIT_PORT}"

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
else
  DOCKER=(sudo docker)
fi
COMPOSE=("${DOCKER[@]}" compose -f "$BACKEND_DIR/docker-compose.yml" --profile frontend)

cleanup() {
  echo "==> Destruindo o stack de smoke (incluindo volumes)"
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Subindo stack de smoke: projeto=${COMPOSE_PROJECT_NAME} backend=${BACKEND_PORT} frontend=${FRONTEND_PORT} mailpit=${MAILPIT_PORT}"
"${COMPOSE[@]}" up -d --build --wait

cd "$ROOT"
npx playwright test --config playwright.real.config.ts
