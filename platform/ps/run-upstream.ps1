param(
    [string]$Format = 'gen9randombattle',
    [string]$PSUsername = 'BFP9u0410',
    [string]$Opponent = 'FoulPlayBot',
    [string]$WsUrl = 'ws://218.244.153.64:8000/showdown/websocket',
    [int]$SearchTimeMs = 100,
    [int]$SearchParallelism = 1,
    [int]$RunCount = 1,
    [int]$SettleMs = 10000,
    [int]$SetupTimeoutMs = 45000,
    [int]$BattleTimeoutMs = 180000,
    [string]$ReferenceUrl = 'http://127.0.0.1:8093/reference',
    [string]$OutputRoot = 'D:\Other\ai\pokemon-battle-experiments\dual-view-v0'
)

$ErrorActionPreference = 'Stop'
$clientRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$labRoot = (Resolve-Path (Join-Path $clientRoot '..\foul-play-lab')).Path
$python = Join-Path $labRoot '.venv\Scripts\python.exe'
$runner = Join-Path $clientRoot 'platform\ps\upstream_runner.py'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$output = Join-Path $OutputRoot ("upstream-$stamp")
$comparison = Join-Path $output 'upstream-comparison.jsonl'

if (-not (Test-Path $python)) {
    throw "Python environment not found: $python"
}
if (-not (Test-Path $runner)) {
    throw "Upstream runner not found: $runner"
}

New-Item -ItemType Directory -Force -Path $output | Out-Null
$env:PYTHONIOENCODING = 'utf-8'

& $python $runner `
    --reference-url $ReferenceUrl `
    --comparison-log $comparison `
    --result-dir $output `
    --websocket-uri $WsUrl `
    --ps-username $PSUsername `
    --bot-mode challenge_user `
    --user-to-challenge $Opponent `
    --pokemon-format $Format `
    --search-time-ms $SearchTimeMs `
    --search-parallelism $SearchParallelism `
    --run-count $RunCount `
    --save-replay never `
    --log-level WARNING `
    --mirror-quiet `
    --setup-timeout-ms $SetupTimeoutMs `
    --battle-timeout-ms $BattleTimeoutMs `
    --settle-ms $SettleMs

Write-Host "Output: $output"
