# Dockerfile for Tesseract OCR sandbox execution
# Standalone tool - spawns fresh container per execution
#
# Build: docker build -t opencode/tesseract -f tool-tesseract.dockerfile .
# Run:   echo "const code..." | docker run --rm -i opencode/tesseract -
#
# Language support:
#   Build with specific languages: --build-arg TESSERACT_LANGUAGES="eng+fra+deu"
#   Languages map to Debian packages: tesseract-ocr-{lang}
#   See: https://packages.debian.org/search?keywords=tesseract-ocr-

ARG NODE_VERSION="22"

FROM node:${NODE_VERSION}-slim

# Language packs to install (space or + separated, e.g., "eng fra" or "eng+fra")
# Common languages: eng, fra, deu, spa, ita, por, nld, pol, rus, chi-sim, chi-tra, jpn, kor, ara
ARG TESSERACT_LANGUAGES="eng"

# Install tesseract-ocr binary and requested language packs
# The language arg is converted from "eng+fra" format to "tesseract-ocr-eng tesseract-ocr-fra"
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        tesseract-ocr \
        # Convert language codes to package names and install
        $(echo "${TESSERACT_LANGUAGES}" | tr '+' ' ' | xargs -n1 printf 'tesseract-ocr-%s ') \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /home/sandbox

# Create sandbox user for security (non-root execution)
RUN useradd -m -s /bin/bash sandbox && \
    chown -R sandbox:sandbox /home/sandbox

# Switch to non-root user before npm operations
USER sandbox

# Initialize package.json with ESM support
RUN echo '{"type":"module"}' > package.json

# Pre-install the tesseractocr npm package
# This package provides a clean API for Tesseract OCR operations
RUN npm install tesseractocr

# Default: run Node reading from stdin
# Usage: echo "import { recognize } from 'tesseractocr'; ..." | docker run --rm -i opencode/tesseract -
ENTRYPOINT ["node"]
