#!/usr/bin/env bash
# ============================================================
#  Despliegue / actualización de EcoLoRa en el VPS
#  Uso:  ./scripts/deploy.sh
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> 1/5 Trayendo últimos cambios de GitHub..."
git pull --ff-only origin main

echo "==> 2/5 Construyendo imágenes..."
docker compose build

echo "==> 3/5 Levantando servicios..."
docker compose up -d --remove-orphans

echo "==> 4/5 Sincronizando esquema de base de datos (Prisma)..."
docker compose exec -T backend npx prisma db push --skip-generate

echo "==> 5/5 Estado final:"
docker compose ps

echo
echo "Despliegue completado. Frontend: http://$(hostname -I | awk '{print $1}')/"
