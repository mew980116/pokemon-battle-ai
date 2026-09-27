# 本地自打自：起两个客户端互相对打（AI 侧 + 陪练侧）
#
# 前提：本地 PS 服已在跑（setup-server.ps1 结尾给了启动命令），默认端口 8000
#
# 用法:
#   pwsh -File selfplay.ps1                    # 两侧都随机出招，先验证链路
#   pwsh -File selfplay.ps1 -AIDecision llm    # AI 侧走 8092 决策服务，陪练侧随机
param(
    [string]$Format = 'gen8randombattle',
    [ValidateSet('llm', 'random')][string]$AIDecision = 'random',
    [string]$AIPlayer = 'LocalAlpha',
    [string]$RivalPlayer = 'LocalBeta',
    [string]$PSUrl = 'ws://127.0.0.1:8000/showdown/websocket',
    [int]$ServerPort = 8000,
    [switch]$Shadow
)
$ErrorActionPreference = 'Stop'
$clientRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path

if (-not (Get-NetTCPConnection -LocalPort $ServerPort -State Listen -ErrorAction SilentlyContinue)) {
    throw "本地 PS 服没在端口 $ServerPort 上跑。先执行: cd <ps-sim>; node pokemon-showdown start --skip-build"
}

function Start-LocalPlayer {
    param([string]$Name, [string]$Rival, [string]$Decision, [switch]$AutoAccept, [switch]$ShadowMode)
    $env:PS_USERNAME = $Name
    $env:PS_SKIP_LOGIN = '1'
    $env:PS_WS_URL = $PSUrl
    $env:PS_CHALLENGE_FORMAT = $Format
    $env:PS_DECISION = $Decision
    $env:PS_RIVAL = if ($Rival) { $Rival } else { 'none' }
    if ($AutoAccept) { $env:PS_AUTO_ACCEPT = '1' } else { Remove-Item Env:PS_AUTO_ACCEPT -ErrorAction SilentlyContinue }
    if ($ShadowMode) { $env:PS_SHADOW = '1' } else { Remove-Item Env:PS_SHADOW -ErrorAction SilentlyContinue }
    Start-Process -FilePath 'node' -ArgumentList 'platform/ps/run-shadow.js' -WorkingDirectory $clientRoot
}

Write-Host "陪练 $RivalPlayer 先起（自动接受挑战、随机出招）..."
Start-LocalPlayer -Name $RivalPlayer -Rival '' -Decision 'random' -AutoAccept
Start-Sleep -Seconds 3

Write-Host "$AIPlayer 起（decision=$AIDecision），挑战 $RivalPlayer ..."
Start-LocalPlayer -Name $AIPlayer -Rival $RivalPlayer -Decision $AIDecision -ShadowMode:$Shadow

Write-Host ''
Write-Host '两个客户端在各自的新窗口里；协议与决策日志见 po-pokellmon-tool/platform/logs/ps-*.jsonl'
