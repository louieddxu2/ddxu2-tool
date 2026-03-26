$ErrorActionPreference = 'Stop'

# Make console + PowerShell pipeline output UTF-8 (helps avoid mojibake in terminal output).
try { chcp 65001 | Out-Null } catch {}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8NoBom
try { [Console]::OutputEncoding = $utf8NoBom } catch {}

Write-Host "UTF-8 console output enabled for this session."

