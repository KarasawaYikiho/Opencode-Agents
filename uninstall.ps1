# OpenCode Agents Uninstaller (Windows PowerShell)
# Usage: .\uninstall.ps1

$ErrorActionPreference = "Stop"

$OpencodeConfigDir = "$env:USERPROFILE\.config\opencode"
$OpencodeAgentsDir = "$OpencodeConfigDir\agents\opencode-agents"

Write-Host "=== OpenCode Agents Uninstaller ===" -ForegroundColor Cyan

# 1. Remove agent prompts
if (Test-Path $OpencodeAgentsDir) {
    Remove-Item $OpencodeAgentsDir -Recurse -Force
    Write-Host "Removed $OpencodeAgentsDir" -ForegroundColor Green
}

# 2. Instructions
Write-Host ""
Write-Host "Uninstall complete. Manual steps:" -ForegroundColor Yellow
Write-Host " 1. Remove 'Brain', 'Planner', 'Coding', 'Tester' blocks from your opencode.jsonc agent section"
Write-Host " 2. Set `"default_agent`" back to `"build`" in opencode.jsonc"
Write-Host " 3. Remove the 'opencode-agents' entry from your plugins directory"
