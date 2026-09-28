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
    [string]$AIPlayer = 'VII.Sandrone',
    [string]$RivalPlayer = 'III.Columbina',
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
    $childEnv = @{}
    foreach ($key in [System.Environment]::GetEnvironmentVariables().Keys) {
        $childEnv[[string]$key] = [string][System.Environment]::GetEnvironmentVariable([string]$key)
    }
    $childEnv['PS_USERNAME'] = $Name
    $childEnv['PS_SKIP_LOGIN'] = '1'
    $childEnv['PS_WS_URL'] = $PSUrl
    $childEnv['PS_CHALLENGE_FORMAT'] = $Format
    $childEnv['PS_DECISION'] = $Decision
    $childEnv['PS_RIVAL'] = if ($Rival) { $Rival } else { 'none' }
    $childEnv['PS_EXIT_AFTER_BATTLE'] = '1'
    if ($AutoAccept) { $childEnv['PS_AUTO_ACCEPT'] = '1' } else { $childEnv.Remove('PS_AUTO_ACCEPT') }
    if ($ShadowMode) { $childEnv['PS_SHADOW'] = '1' } else { $childEnv['PS_SHADOW'] = '0' }
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = 'node'
    $startInfo.Arguments = 'platform/ps/run-shadow.js'
    $startInfo.WorkingDirectory = $clientRoot
    $startInfo.UseShellExecute = $false
    foreach ($key in $childEnv.Keys) {
        if ($null -ne $childEnv[$key]) { $startInfo.Environment[$key] = $childEnv[$key] }
    }
    [System.Diagnostics.Process]::Start($startInfo) | Out-Null
}

Write-Host "陪练 $RivalPlayer 先起（自动接受挑战、随机出招）..."
Start-LocalPlayer -Name $RivalPlayer -Rival '' -Decision 'random' -AutoAccept
Start-Sleep -Seconds 3

Write-Host "$AIPlayer 起（decision=$AIDecision），挑战 $RivalPlayer ..."
Start-LocalPlayer -Name $AIPlayer -Rival $RivalPlayer -Decision $AIDecision -ShadowMode:$Shadow

Write-Host ''
Write-Host '两个客户端在各自的新窗口里；协议与决策日志见 po-pokellmon-tool/platform/logs/ps-*.jsonl'
