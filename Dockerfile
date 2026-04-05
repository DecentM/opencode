# opencode launcher — single-container image
#
# Base: debian:bookworm-slim (Debian 12 with glibc)
#   - real glibc — no compat shims needed
#   - opencode binary downloaded from GitHub releases
#   - no Node, no Python, no git in the base
#
# Layer order is intentional: system deps → opencode binary → bun → npm globals → app code.
# Changing system deps busts the cache from that point forward, but
# changing app source only busts the last few layers.

FROM debian:bookworm-slim

# ─────────────────────────────────────────────────────────────────────────────
# 1. System dependencies
# ─────────────────────────────────────────────────────────────────────────────

RUN apt-get update && apt-get install -y --no-install-recommends \
    # Runtime essentials
    bash \
    curl \
    ca-certificates \
    git \
    jq \
    dumb-init \
    unzip \
    # Node.js + npm (for MCP servers and Figma/Playwright npm packages)
    nodejs \
    npm \
    # Python (for direct python tool execution)
    python3 \
    python3-pip \
    # OCR tool
    tesseract-ocr \
    tesseract-ocr-eng \
    # Chromium for Playwright headless (system install avoids playwright download)
    chromium \
    && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────────────────────
# 2. opencode binary — download from GitHub releases
#
#    The release asset is a glibc tarball containing a single `opencode` binary.
#    We always pull latest; the /latest/download/ URL handles the redirect.
# ─────────────────────────────────────────────────────────────────────────────

RUN curl -fsSL "https://github.com/sst/opencode/releases/latest/download/opencode-linux-x64.tar.gz" \
        | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/opencode \
    && opencode --version

# ─────────────────────────────────────────────────────────────────────────────
# 3. Bun — not in Debian repos, install the glibc binary from GitHub releases
#
#    We use the glibc variant (not musl) because Debian uses glibc.
#    The zip contains a single `bun` binary; we extract it directly.
# ─────────────────────────────────────────────────────────────────────────────

ARG BUN_VERSION=bun-v1.3.11

RUN curl -fsSL "https://github.com/oven-sh/bun/releases/download/${BUN_VERSION}/bun-linux-x64.zip" \
        -o /tmp/bun.zip \
    && unzip -q /tmp/bun.zip -d /tmp/bun-extract \
    && install -m 755 /tmp/bun-extract/bun-linux-x64/bun /usr/local/bin/bun \
    && rm -rf /tmp/bun.zip /tmp/bun-extract \
    && bun --version

# ─────────────────────────────────────────────────────────────────────────────
# 4. Global npm packages — MCP servers
#
#    figma-developer-mcp: Framelink Figma MCP, spawned by opencode on demand
#    slack-mcp-server:    downloads a Go binary at install time (needs network)
#    @playwright/mcp:     Playwright MCP server; uses system Chromium via env var
# ─────────────────────────────────────────────────────────────────────────────

ENV NODE_ENV=production

RUN npm install -g --no-fund --no-audit \
    figma-developer-mcp \
    slack-mcp-server \
    @playwright/mcp

# ─────────────────────────────────────────────────────────────────────────────
# 5. Playwright — point at system Chromium so we don't download a second copy
#
#    Debian's chromium package installs the binary at /usr/bin/chromium.
#    PLAYWRIGHT_BROWSERS_PATH is set to a dummy path so playwright doesn't
#    try to manage its own browser store.
# ─────────────────────────────────────────────────────────────────────────────

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/playwright-browsers
ENV PLAYWRIGHT_HEADLESS=true

# ─────────────────────────────────────────────────────────────────────────────
# 6. App source — copy and install dependencies
#
#    bun.lock is included (frozen install) so the build is reproducible.
#    node_modules and other generated artifacts are excluded via .dockerignore.
# ─────────────────────────────────────────────────────────────────────────────

WORKDIR /app

COPY package.json bun.lock ./

# Install app dependencies with frozen lockfile for reproducibility
RUN bun install --frozen-lockfile

# Copy the rest of the source after installing deps so that source changes
# don't bust the dependency install layer
COPY . .

# Ensure the entrypoint is executable (COPY . . preserves local permissions,
# but be explicit in case the file was checked out without +x)
RUN chmod +x /app/docker/entrypoint.sh

# ─────────────────────────────────────────────────────────────────────────────
# 7. Runtime configuration
#
#    WORKDIR is /workspace — this is where opencode operates on user code.
#    Mount the target repo here at runtime:
#      docker run -v /path/to/repo:/workspace ...
# ─────────────────────────────────────────────────────────────────────────────

WORKDIR /workspace

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker/entrypoint.sh"]
