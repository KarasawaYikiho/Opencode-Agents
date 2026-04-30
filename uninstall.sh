#!/usr/bin/env bash
# OpenCode Agents Uninstaller
# Usage: ./uninstall.sh

set -e

OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
OPENCODE_AGENTS_DIR="$OPENCODE_CONFIG_DIR/agents/opencode-agents"

echo "=== OpenCode Agents Uninstaller ==="

# 1. Remove agent prompts
if [ -d "$OPENCODE_AGENTS_DIR" ]; then
    rm -rf "$OPENCODE_AGENTS_DIR"
    echo "Removed $OPENCODE_AGENTS_DIR"
fi

# 2. Restore default agent
echo ""
echo "Uninstall complete. Manual steps:"
echo " 1. Remove 'brain', 'planner', 'coding', 'tester' blocks from your opencode.jsonc agent section"
echo " 2. Set \"default_agent\" back to \"build\" in opencode.jsonc"
echo " 3. Remove the 'opencode-agents' entry from your plugins directory"
