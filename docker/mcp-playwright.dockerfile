# Custom Playwright MCP with stealth evasions
# Based on the official Microsoft Playwright MCP image
FROM mcr.microsoft.com/playwright/mcp:latest

# Copy the stealth init script
COPY mcp-playwright/stealth-init.js /app/stealth-init.js

# Copy the entrypoint script for display auto-detection
COPY --chmod=755 mcp-playwright/entrypoint.sh /app/entrypoint.sh

WORKDIR /app/screenshots
RUN chown -R node:node /app/screenshots

USER root
RUN mkdir -p /data/output /data/userdata && chown -R node:node /data/output /data/userdata
WORKDIR /app

# Use wrapper script that auto-detects ozone platform
# --headless removed to allow GUI display when DISPLAY/WAYLAND_DISPLAY is set
ENTRYPOINT ["/app/entrypoint.sh"]
