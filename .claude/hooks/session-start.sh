#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Ensure pnpm is available
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm@10.15.1
fi

cd "$CLAUDE_PROJECT_DIR"

# Install all workspace dependencies
pnpm install
