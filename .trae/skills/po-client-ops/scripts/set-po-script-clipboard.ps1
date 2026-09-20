# Put a script file into the clipboard as proper UTF-8 text, then verify.
# WHY: this box runs Windows PowerShell 5.1, where `Get-Content -Raw` decodes a UTF-8
# file with the system ANSI codepage and turns Chinese comments into mojibake.
# Always read with an explicit UTF8 encoding, and keep this file ASCII-only.
#
# Usage:  powershell -File set-po-script-clipboard.ps1 -Path po-pokellmon\po-script.js
param(
    [Parameter(Mandatory = $true)][string]$Path
)

# keep the .ps1 itself ASCII-only: PS 5.1 reads scripts as ANSI/UTF-8-without-BOM
function Test-Mojibake([string]$s) {
    return ($s.IndexOf([char]0x9225) -ge 0) -or ($s.IndexOf([char]0x951F) -ge 0)
}

# .ProviderPath (not .Path): .Path returns a provider-qualified string that .NET rejects
$full = (Resolve-Path -LiteralPath $Path).ProviderPath
$raw = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
Set-Clipboard -Value $raw
Start-Sleep -Milliseconds 500

$c = Get-Clipboard -Raw
$mv = [regex]::Match($c, 'PKLM_VERSION\s*=\s*"([^"]+)"')
$sv = [regex]::Match($raw, 'PKLM_VERSION\s*=\s*"([^"]+)"')

"file            = $full"
"file_chars      = " + $raw.Length
"clipboard_chars = " + $c.Length
"length_match    = " + ($c.Length -eq $raw.Length)
"file_version    = " + $(if ($sv.Success) { $sv.Groups[1].Value } else { 'NOT FOUND' })
"clip_version    = " + $(if ($mv.Success) { $mv.Groups[1].Value } else { 'NOT FOUND' })
"has_mojibake    = " + (Test-Mojibake $c)
"lines           = " + (($c -split "`n").Count)
