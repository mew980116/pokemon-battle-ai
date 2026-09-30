# 一次性准备本地 Pokemon Showdown 服务器（供 po-pokellmon-tool 自打自 / 批量评测）
#
# 为什么需要它：官方服上天梯同 IP 不能互配（server/ladders.ts: matchmakingOK），
# 定向挑战又会被 IP 级反垃圾半锁；本地服关掉这些限制后可以随便自己打自己。
#
# 用法:
#   pwsh -File setup-server.ps1                 # 装到 $env:USERPROFILE\ps-sim
#   pwsh -File setup-server.ps1 -Dir D:\ps-sim  # 指定目录（放本机盘，别放网络盘）
#   pwsh -File setup-server.ps1 -Force          # 删掉重装
param(
    [string]$Dir = "$env:USERPROFILE\ps-sim",
    [switch]$Force
)
$ErrorActionPreference = 'Stop'
$repo = 'https://github.com/smogon/pokemon-showdown.git'

if (Test-Path $Dir) {
    if ($Force) { Remove-Item $Dir -Recurse -Force }
    else { throw "$Dir 已存在；要重装加 -Force" }
}

Write-Host "[1/4] clone -> $Dir"
git clone --depth 1 $repo $Dir

Push-Location $Dir
try {
    Write-Host '[2/4] npm install'
    npm install --no-audit --no-fund
    Write-Host '[3/4] node build'
    node build

    Write-Host '[4/4] 写入开发用 config 覆盖'
    $marker = '==== po-pokellmon 本地开发服覆盖 ===='
    $cfg = Join-Path $Dir 'config/config.js'
    if (-not (Select-String -Path $cfg -Pattern $marker -Quiet)) {
        Add-Content -Encoding UTF8 -Path $cfg -Value @"

// $marker
// 只用于本机开发：允许无登录服务器起名、关掉同 IP 检查与限流
exports.nothrottle = true;
exports.noipchecks = true;
exports.noguestsecurity = true;
exports.backdoor = false;
"@
    }
} finally {
    Pop-Location
}

Write-Host ''
Write-Host '[完成] 启动服务器（这个终端要一直开着）：'
Write-Host "  cd `"$Dir`""
Write-Host '  node pokemon-showdown start --skip-build'
Write-Host ''
Write-Host '再另开终端跑 selfplay.ps1，或用 run-shadow.js 手动起客户端。'
