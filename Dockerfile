# opencode launcher — single-container image
#
# Base: debian:bookworm-slim (Debian 12 with glibc)
#   - real glibc — no compat shims needed
#   - opencode binary downloaded from GitHub releases
#   - no Node, no Python, no git in the base
#
# Layer order is intentional: system deps → asdf setup → tool installs → opencode binary → npm globals → app code.
# Changing system deps busts the cache from that point forward, but
# changing app source only busts the last few layers.

FROM debian:bookworm-slim

# ─────────────────────────────────────────────────────────────────────────────
# 1. System dependencies
# ─────────────────────────────────────────────────────────────────────────────

RUN apt-get update && apt-get install -y --no-install-recommends \
    # Runtime essentials
    bash \
    ca-certificates \
    dumb-init \
    # Build dependencies for asdf plugins
    git \
    curl \
    wget \
    build-essential \
    libssl-dev \
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    llvm \
    libncursesw5-dev \
    xz-utils \
    tk-dev \
    libxml2-dev \
    libxmlsec1-dev \
    libffi-dev \
    liblzma-dev \
    # OCR tool
    tesseract-ocr \
    tesseract-ocr-eng \
    # Chromium for Playwright headless (system install avoids playwright download)
    chromium \
    # Needed for manual bootstrapping
    gh ssh \
    # For models
    ansible apache2-utils aspell at bat bc biber binutils bsdmainutils btop cargo certbot cloc cowsay cron dc default-mysql-client dnsutils fd-find ffmpeg figlet file fortune-mod gdb gettext gfortran gnuplot gnupg graphviz hdf5-tools htop httpie hunspell hyperfine icu-devtools imagemagick iptables jq libimage-exiftool-perl libxml2-utils lldb lolcat lsof ltrace make maxima msmtp mtr mutt ncat net-tools nmap octave openssl openssh-client pandoc parallel pari-gp pass plantuml poppler-utils postgresql-client procps python3-csvkit redis-tools remind ripgrep rsync shellcheck sqlite3 strace sysstat tcpdump tesseract-ocr texlive-bibtex-extra texlive-latex-base texlive-luatex texlive-xetex tig traceroute tree ufw unzip valgrind wrk xsltproc xxd yq zip \
    && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────────────────────
# 2. asdf setup — install from git and configure environment
# ─────────────────────────────────────────────────────────────────────────────

ARG ASDF_VERSION=v0.14.0
ENV ASDF_DIR=/root/.asdf
ENV PATH="${ASDF_DIR}/bin:${ASDF_DIR}/shims:${PATH}"

RUN git clone --depth 1 --branch ${ASDF_VERSION} https://github.com/asdf-vm/asdf.git ${ASDF_DIR} \
    && echo '. ${ASDF_DIR}/asdf.sh' >> /root/.bashrc \
    && echo '. ${ASDF_DIR}/completions/asdf.bash' >> /root/.bashrc

# Source asdf in the current shell for subsequent RUN commands
SHELL ["/bin/bash", "-c", "-l"]

# ─────────────────────────────────────────────────────────────────────────────
# 3. Add asdf plugins and install tool versions
# ─────────────────────────────────────────────────────────────────────────────

# Add plugins
RUN asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git \
    && asdf plugin add python https://github.com/asdf-community/asdf-python.git \
    && asdf plugin add bun https://github.com/cometkim/asdf-bun.git

# Install versions (use .tool-versions if available, otherwise defaults)
ARG NODEJS_VERSION=22.12.0
ARG PYTHON_VERSION=3.12.7
ARG BUN_VERSION=1.3.6

RUN asdf install nodejs ${NODEJS_VERSION} \
    && asdf install python ${PYTHON_VERSION} \
    && asdf install bun ${BUN_VERSION}

# Set global versions
RUN asdf global nodejs ${NODEJS_VERSION} \
    && asdf global python ${PYTHON_VERSION} \
    && asdf global bun ${BUN_VERSION}

# Reshim to ensure shims are created
RUN asdf reshim

# Verify installations
RUN node --version && npm --version && python --version && bun --version

# ─────────────────────────────────────────────────────────────────────────────
# 4. opencode binary — download from GitHub releases
#
#    The release asset is a glibc tarball containing a single `opencode` binary.
#    We always pull latest; the /latest/download/ URL handles the redirect.
# ─────────────────────────────────────────────────────────────────────────────

RUN curl -fsSL "https://github.com/sst/opencode/releases/latest/download/opencode-linux-x64.tar.gz" \
        | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/opencode \
    && opencode --version

# ─────────────────────────────────────────────────────────────────────────────
# 5. Global npm packages — MCP servers
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
# 6. Playwright — point at system Chromium so we don't download a second copy
#
#    Debian's chromium package installs the binary at /usr/bin/chromium.
#    PLAYWRIGHT_BROWSERS_PATH is set to a dummy path so playwright doesn't
#    try to manage its own browser store.
# ─────────────────────────────────────────────────────────────────────────────

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/playwright-browsers
ENV PLAYWRIGHT_HEADLESS=true

# ─────────────────────────────────────────────────────────────────────────────
# 7. App source — copy and install dependencies
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
# 8. Runtime configuration
#
#    WORKDIR is /workspace — this is where opencode operates on user code.
#    Mount the target repo here at runtime:
#      docker run -v /path/to/repo:/workspace ...
# ─────────────────────────────────────────────────────────────────────────────

WORKDIR /workspace

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker/entrypoint.sh"]
