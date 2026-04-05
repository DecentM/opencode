#!/bin/sh

set -eu

exec bun "$(dirname "$(readlink -f "$0")")/opencode.ts" "$@"
