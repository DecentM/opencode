# Figma MCP server using Framelink (figma-developer-mcp)
# Lightweight Node.js container for API-only operations
FROM node:25-slim

# Install dumb-init for proper signal handling
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json and install dependencies
COPY mcp-figma/package.json ./
RUN npm install --omit=dev

ENV NODE_OPTIONS="--max-old-space-size=1536"

ENTRYPOINT ["/usr/bin/dumb-init", "--", "node", "/app/node_modules/figma-developer-mcp/dist/bin.js", "--stdio"]
