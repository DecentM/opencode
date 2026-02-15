# Chesscom OpenCode configuration

Internal configuration repository for opencode AI coding environment.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (running)
- [`opencode`](https://opencode.ai) CLI installed
- `dotenv` CLI (`apt install dotenv` on Debian/Ubuntu, `brew install dotenv` on [macOS](https://formulae.brew.sh/formula/dotenv))

## Quick Start

1. **Clone and configure**
   ```sh
   git clone https://github.com/ChessCom/opencode.git
   cd opencode
   bin/opencode.sh
   ```

   > During the first run, this script will provide instructions on setting up MCP servers.

0. **Fill `.env` with credentials**
   - See the comments in `.env.example` on how to obtain them 

0. **Launch**
   ```sh
   ./bin/opencode.sh [args]
   ```

The entry script handles environment creation, Docker builds, and launch automatically.

> TIP: Configure you shell to add an alias for this script.
> Example: `alias chess-opencode='~/chesscom/opencode/bin/opencode.sh'` - It will pass along arguments too!

## Development

If you're working on this repo (not just using it), you'll need to install [Bun](https://bun.sh). Easiest in this repo is to use `asdf-vm`, which will pick up the `.tool-versions` file automatically.

```bash
bun i
bun run test        # Run tests
bun run lint        # Check code quality
bun run lint:fix    # Auto-fix lint issues
bun run format      # Format code with Biome
```
