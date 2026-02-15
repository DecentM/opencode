#!/bin/bash
set -e

# Ensure output directory exists and is writable
OUTPUT_DIR="${PLAYWRIGHT_MCP_OUTPUT_DIR:-/data/output}"
mkdir -p "$OUTPUT_DIR" 2>/dev/null || true

# Verify writability
if ! touch "$OUTPUT_DIR/.write-test" 2>/dev/null; then
    echo "[mcp-playwright] WARNING: Output directory not writable: $OUTPUT_DIR" >&2
else
    rm -f "$OUTPUT_DIR/.write-test"
fi

# Ensure userdata directory exists and is writable (for cookie/cache persistence)
USERDATA_DIR="/data/userdata"
mkdir -p "$USERDATA_DIR"
chmod 777 "$USERDATA_DIR"

# Headless mode: default to false (headed) if not set
# Set PLAYWRIGHT_HEADLESS=true for headless mode
HEADLESS="${PLAYWRIGHT_HEADLESS:-false}"

DEFAULT_FLAGS='"--window-size=1366,768", "--no-first-run", "--noerrdialogs", "--disable-infobars", "--disable-session-crashed-bubble", "--disable-features=Translate,PasswordManager,AutofillAddressProfile,AutofillCreditCard", "--disable-breakpad"'

# GPU/hardware acceleration flags for Chromium
GPU_FLAGS='"--enable-gpu-rasterization", "--enable-zero-copy", "--ignore-gpu-blocklist", "--enable-features=VaapiVideoDecoder,VaapiVideoEncoder", "--disable-software-rasterizer", "--use-gl=egl", "--enable-accelerated-video-decode"'

# Auto-detect ozone platform based on environment (only relevant for headed mode)
if [ "$HEADLESS" = "true" ]; then
    # Headless mode doesn't need ozone platform or GPU flags
    BROWSER_ARGS='['"${DEFAULT_FLAGS}"']'
elif [ -n "$WAYLAND_DISPLAY" ]; then
    BROWSER_ARGS='["--ozone-platform=wayland", '"${DEFAULT_FLAGS}"', '"${GPU_FLAGS}"']'
elif [ -n "$DISPLAY" ]; then
    BROWSER_ARGS='["--ozone-platform=x11", '"${DEFAULT_FLAGS}"', '"${GPU_FLAGS}"']'
else
    BROWSER_ARGS='['"${DEFAULT_FLAGS}"', '"${GPU_FLAGS}"']'
fi

# Generate runtime config with browser settings
# Note: userDataDir is passed via --user-data-dir CLI arg since config is ignored when --browser is used
cat > /tmp/mcp-browser-config.json << EOF
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": {
      "headless": ${HEADLESS},
      "args": ${BROWSER_ARGS}
    }
  }
}
EOF

# Run MCP server directly (not in background) so stdin is connected
# The MCP protocol requires stdin/stdout for JSON-RPC communication
exec node cli.js --browser chromium --no-sandbox --user-data-dir "${USERDATA_DIR}" --init-script /app/stealth-init.js --config /tmp/mcp-browser-config.json "$@"
