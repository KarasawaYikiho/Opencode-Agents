# OpenCode Agents Installer (Windows PowerShell)
# Usage: .\install.ps1

$ErrorActionPreference = "Stop"

$OpencodeConfigDir = "$env:USERPROFILE\.config\opencode"
$OpencodeConfigFile = "$OpencodeConfigDir\opencode.jsonc"
$OpencodeAgentsDir = "$OpencodeConfigDir\agents\opencode-agents"
$PluginDir = (Get-Location).Path
$BackupFile = "$OpencodeConfigDir\opencode.jsonc.backup-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "=== OpenCode Agents Installer ===" -ForegroundColor Cyan

# 1. Backup existing config
if (Test-Path $OpencodeConfigFile) {
    Copy-Item $OpencodeConfigFile $BackupFile
    Write-Host "Backed up config to $BackupFile" -ForegroundColor Green
}

# 2. Copy agent prompts
New-Item -ItemType Directory -Force -Path $OpencodeAgentsDir | Out-Null
Copy-Item "$PluginDir\src\agents\*.md" $OpencodeAgentsDir -Force
Write-Host "Copied agent prompts to $OpencodeAgentsDir" -ForegroundColor Green

# 3. Install npm dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install --production
Write-Host "Dependencies installed" -ForegroundColor Green

# 4. Merge agent config
Write-Host "To complete setup, add the agent definitions from opencode.jsonc to your opencode.jsonc"
Write-Host "and set `"default_agent`": `"brain`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "Your config is at: $OpencodeConfigFile" -ForegroundColor Cyan
Write-Host "Backup file at: $BackupFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
