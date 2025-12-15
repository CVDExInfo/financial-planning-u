#!/usr/bin/env bash
set -euo pipefail

echo "[finanzas-projects] Starting projects tests"

cd "$(dirname "$0")/../../../services/finanzas-api"

if [ ! -d node_modules ]; then
  echo "[finanzas-projects] Installing dependencies with npm ci"
  npm ci
else
  echo "[finanzas-projects] Using existing node_modules; skipping npm ci"
fi

echo "[finanzas-projects] Running backend unit tests"
npm test -- --runInBand

echo "[finanzas-projects] Projects tests completed"
