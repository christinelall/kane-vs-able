#!/bin/sh
set -eu

# Kane receives CI credentials per run, so no persistent login is required.
# Codex CLI needs a non-interactive auth cache before `codex exec` can run.
if [ -n "${OPENAI_API_KEY:-}" ]; then
  printf '%s' "$OPENAI_API_KEY" | codex login --with-api-key >/dev/null
elif [ -n "${CODEX_ACCESS_TOKEN:-}" ]; then
  printf '%s' "$CODEX_ACCESS_TOKEN" | codex login --with-access-token >/dev/null
fi

exec "$@"
