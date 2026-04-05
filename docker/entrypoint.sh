#!/usr/bin/env bash
# entrypoint.sh — opencode launcher container entrypoint

set -euo pipefail

exec bun /app/bin/opencode.ts "$@"
