#!/bin/sh

set -eu

test_cmd() {
    BIN_PATH=$(which "$1" 2>/dev/null)
    shift
    "$BIN_PATH" "$@" >/dev/null 2>/dev/null
}

if ! test_cmd opencode --version; then
    echo "OpenCode not installed, not available via \$PATH, or the installation is broken. Please (re)install OpenCode and try again."
    exit 1
fi

if ! test_cmd dotenv --version; then
    echo "dotenv not installed, not available via \$PATH, or the installation is broken. Please (re)install dotenv and try again."
    exit 1
fi

if ! test_cmd docker ps; then
    echo "docker not installed, not available via \$PATH, not running, or the installation is broken. Please (re)install docker and try again."
    exit 1
fi

SELF_PATH=$(readlink -f "$0")
SELF_DIR=$(dirname $SELF_PATH)
OPENCODE_CONFIG_DIR=$(readlink -f "$SELF_DIR/..")
OPENCODE_BIN=$(which opencode)
THEME_SOURCE_DIR="$OPENCODE_CONFIG_DIR/themes"
THEME_DEST_DIR=""

if [ -n "${XDG_CONFIG_HOME:-}" ]; then
    THEME_DEST_DIR="$XDG_CONFIG_HOME/opencode"
else
    THEME_DEST_DIR="$HOME/.config/opencode"
fi

cp -fLa "$THEME_SOURCE_DIR/" "$THEME_DEST_DIR/"

if [ ! -f "$OPENCODE_CONFIG_DIR/.env" ]; then
    cp -n "$OPENCODE_CONFIG_DIR/.env.example" "$OPENCODE_CONFIG_DIR/.env"

    printf ".env file missing.\n"
    printf "  We automatically created one from template.\n"
    printf "  Please open '%s' and insert config values, using the instructions in it\n" "$OPENCODE_CONFIG_DIR/.env"
    printf "\n"
    printf "You should now establish an alias for '%s' to run OpenCode with this configuration." "$SELF_PATH"
    printf "\n"
    printf "You need to run '%s' a few times afterwards, to log into remote MCP servers.\n" "$(basename $SELF_PATH) mcp auth"
    exit 1
fi

DOCKER_DIR="$OPENCODE_CONFIG_DIR/docker"

printf "⏳ Building tools...\n"

# Build images with GHCR remote cache (pulls cache layers if available, builds locally)
DOCKER_BUILDKIT=1 docker build -f "$DOCKER_DIR/mcp-flaresolverr.dockerfile" \
    -t decentm-opencode-flaresolverr "$DOCKER_DIR" 2>/dev/null &

DOCKER_BUILDKIT=1 docker build -f "$DOCKER_DIR/mcp-playwright.dockerfile" \
    -t decentm-opencode-playwright "$DOCKER_DIR" 2>/dev/null &

DOCKER_BUILDKIT=1 docker build -f "$DOCKER_DIR/tool-node.dockerfile" \
    -t decentm-opencode-node-sandbox "$DOCKER_DIR" 2>/dev/null &

DOCKER_BUILDKIT=1 docker build -f "$DOCKER_DIR/tool-python.dockerfile" \
    -t decentm-opencode-python-sandbox "$DOCKER_DIR" 2>/dev/null &

DOCKER_BUILDKIT=1 docker build -f "$DOCKER_DIR/tool-tesseract.dockerfile" \
    -t decentm-opencode-tesseract "$DOCKER_DIR" 2>/dev/null &

wait

printf "\r✅ %-30s\n" 'Launching!'

OPENCODE_CONFIG_DIR="$OPENCODE_CONFIG_DIR" \
    OPENCODE_EXPERIMENTAL_LSP_TOOL=true \
    dotenv -f "$OPENCODE_CONFIG_DIR/.env" run -- "$OPENCODE_BIN" "$@"
