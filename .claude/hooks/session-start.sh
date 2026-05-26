#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || npm install -g pnpm@10
fi

pnpm install --frozen-lockfile --prefer-offline
