# Verify what is currently in the clipboard -- used to check the script that was
# copied OUT of PO's Script Window > Battle scripts editor (i.e. what PO really holds).
# Keep this file ASCII-only (PS 5.1 reads scripts as ANSI / UTF-8-without-BOM).
#
# Usage:  powershell -File verify-po-script-clipboard.ps1
function Test-Mojibake([string]$s) {
    return ($s.IndexOf([char]0x9225) -ge 0) -or ($s.IndexOf([char]0x951F) -ge 0)
}

$c = Get-Clipboard -Raw
if (-not $c) { "clipboard empty"; exit 1 }

$mv = [regex]::Match($c, 'PKLM_VERSION\s*=\s*"([^"]+)"')

"clipboard_chars      = " + $c.Length
"looks_like_po_script = " + ($c.Contains('pklmDecideAndAct') -and $c.Contains('onChoiceSelection'))
"pklm_version         = " + $(if ($mv.Success) { $mv.Groups[1].Value } else { 'NOT FOUND' })
"has_mojibake         = " + (Test-Mojibake $c)
"first_line           = " + (($c -split "`n")[0])
if ($mv.Success) { "version_line         = " + ($c.Substring($mv.Index, [Math]::Min(60, $c.Length - $mv.Index))) }
