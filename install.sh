#!/usr/bin/env bash
# OpenCode Agents Installer (Linux/macOS)
# Usage: ./install.sh

set -e

OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
OPENCODE_CONFIG_FILE="$OPENCODE_CONFIG_DIR/opencode.jsonc"
OPENCODE_AGENTS_DIR="$OPENCODE_CONFIG_DIR/agents/opencode-agents"
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_FILE="$OPENCODE_CONFIG_DIR/opencode.jsonc.backup-$(date +%Y%m%d%H%M%S)"

echo "=== OpenCode Agents Installer ==="

# 1. Backup existing config
if [ -f "$OPENCODE_CONFIG_FILE" ]; then
    cp "$OPENCODE_CONFIG_FILE" "$BACKUP_FILE"
    echo "Backed up config to $BACKUP_FILE"
fi

# 2. Copy agent prompts
mkdir -p "$OPENCODE_AGENTS_DIR"
cp "$PLUGIN_DIR/src/agents/"*.md "$OPENCODE_AGENTS_DIR/"
echo "Copied agent prompts to $OPENCODE_AGENTS_DIR"

# 3. Install npm dependencies
echo "Installing dependencies..."
npm install
echo "Dependencies installed"

# 4. Build TypeScript
echo "Building..."
npm run build
echo "Build complete"

# 5. Instructions
echo ""
echo "To complete setup, add the agent definitions from opencode.jsonc to your opencode.jsonc"
echo "and set \"default_agent\": \"Brain\""
echo ""
echo "Your config is at: $OPENCODE_CONFIG_FILE"
echo "Backup file at: $BACKUP_FILE"
echo ""
echo "Installation complete!"
