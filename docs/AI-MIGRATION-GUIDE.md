# Pokemon Battle AI 跨设备迁移与 AI 开发交接指南

本文用于把本项目迁移到新设备，并交给新的 AI 辅助开发工具继续工作。

适用范围：

- `pokemon-battle-ai`：主集成仓库；
- `foul-play-lab`：DualView 与 translated reference 开发仓库；
- `foul-play`：只读 baseline；
- `poke-engine`：固定版本的 engine 对照；
- `ps-sim`：可选的本地 Pokemon Showdown；
- 远程测试 PS 私服：`218.244.153.64:8000`。

本文不包含任何密码、token、API key 或本地凭据。

## 1. 项目角色和不可违反的边界

新 AI 开始工作前，必须先阅读：

```text
D:\Other\ai\pokemon-battle-ai\docs\AI-MIGRATION-GUIDE.md
D:\Other\ai\pokemon-battle-ai\SESSION-HANDOFF.md
D:\Other\ai\pokemon-battle-ai\platform\ps\benchmark\README.md
D:\Other\ai\foul-play-lab\WORKSPACE.md
D:\Other\ai\foul-play-lab\EXPERIMENT-MANIFEST.json
```

仓库职责：

```text
pokemon-battle-ai
    PS adapter、protocol replay、benchmark、live observer、集成层

foul-play-lab
    DualView、belief sampler、translated reference、oracle、实验测试

foul-play
    untouched upstream/baseline，只读对照，不修改源代码

poke-engine
    pinned engine 对照，不修改核心源码

ps-sim
    本地 Pokemon Showdown，可选；不要回滚 package-lock.json

pokemon-battle-experiments
    benchmark 和 replay 结果，不作为主要 GitHub 代码仓库
```

必须遵守：

1. 不修改 `D:\Other\ai\foul-play` 中的源代码。
2. 不修改 `D:\Other\ai\poke-engine`。
3. 不回滚或覆盖 `D:\Other\ai\ps-sim\package-lock.json` 的既有改动。
4. 不删除、清理或处理 `.dbg/`。
5. 不删除既有 benchmark、replay、summary 或 manifest。
6. 不执行 `git add -A`，必须逐文件选择性暂存。
7. 不提交密码、token、API key、虚拟环境、Rust target、缓存和临时日志。
8. 破坏性操作、删除、批量移动和重置前必须先确认。
9. 修改后先运行最小相关测试，再进行 live 对战。
10. 不把未验证的候选版本称为冻结版本。

## 2. 当前固定版本

迁移时应保留以下基线版本：

```text
Foul Play baseline:
    5bd041d62a6f4c8587699a598a9a92407383e4f3

poke-engine:
    7126ba7ba9029f24cbddefdd6e9dc6193ee72d33

Pokemon Showdown:
    a5df8274e85b0889bf2a9b3422a08b39732374fc

pokemon-battle-ai:
    main 分支，使用 GitHub 上最新已提交版本

foul-play-lab:
    codex/dual-view-foul-play 分支，使用 GitHub 上最新已提交版本
```

当前工程事实：

- Python 3.11.9；
- Node.js v24.18.0；
- 第一阶段只做 Gen 9 Random Battle；
- 当前 DualView 不是完整二阶 MCTS；
- `8094` 是 DualView 服务端口；
- `8093`、`8099` 是 translated/reference 候选端口，不能仅凭端口号判断进程版本；
- 8099 forced-recharge 修复候选在迁移前需要重新进行 live smoke；
- online win-rate 不是当前迁移后的第一验证目标。

## 3. 旧设备迁移前操作

### 3.1 检查 Git 状态

在旧设备执行：

```powershell
git -C D:\Other\ai\pokemon-battle-ai status --short --branch
git -C D:\Other\ai\foul-play-lab status --short --branch
git -C D:\Other\ai\foul-play status --short --branch
git -C D:\Other\ai\poke-engine status --short --branch
git -C D:\Other\ai\ps-sim status --short --branch
```

不要覆盖别人已有的未提交改动。baseline 的 `docs/` 未跟踪文件和
`ps-sim/package-lock.json` 的修改都必须保留。

### 3.2 选择性提交主集成仓库

只提交已经审查过的代码和文档。推荐先查看：

```powershell
Set-Location D:\Other\ai\pokemon-battle-ai
git diff --check
git status --short
git diff --stat
```

禁止使用：

```powershell
git add -A
git add .
```

提交前必须确认暂存列表中没有：

```text
.dbg/
platform/ps/__pycache__/
platform/ps/ps-credentials.json
po-pokellmon-tool/llm-credentials.json
po-pokellmon-tool/mify-credentials.json
*.log
benchmark result 临时目录
```

一个安全的选择性暂存示例：

```powershell
git add docs/AI-MIGRATION-GUIDE.md
git add docs/foul-play-decision-entry.md
git add SESSION-HANDOFF.md
git add platform/ps/adapter.js
git add platform/ps/client.js
git add platform/ps/decision-bridge.js
git add platform/ps/live-observer.js
git add platform/ps/protocol-replay.js
git add platform/ps/upstream-protocol-mirror.js
git add platform/ps/upstream_runner.py
git add platform/ps/run-upstream.ps1
git add platform/ps/benchmark/README.md
git add platform/ps/benchmark/battle-stats.js
git add platform/ps/benchmark/run-series.js
git add platform/ps/benchmark/summarize.js
git add platform/ps/benchmark/summarize-opponent-predictions.js
git add platform/ps/benchmark/test-battle-stats.js
git add po-pokellmon-tool/decision-router.js
git add po-pokellmon-tool/server.js
git add po-pokellmon-tool/rules-provider.js
git add po-pokellmon-tool/test-decision-router.js
git add po-pokellmon-tool/test-rules-provider.js
```

实际暂存前仍需根据 `git status` 和 `git diff` 审查，不要盲目照抄列表。

确认暂存内容：

```powershell
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
```

运行相关 Node 测试后再提交：

```powershell
node platform/ps/test-ps-adapter.js
node platform/ps/test-ps-client.js
node platform/ps/test-decision-bridge.js
node platform/ps/test-live-observer.js
node platform/ps/test-protocol-replay.js
node platform/ps/benchmark/test-battle-stats.js
```

提交并推送：

```powershell
git commit -m "docs: add AI migration and development handoff guide"
git push origin main
```

如果当前仓库还有其他已经审查并准备好的代码改动，可以和本文档一起提交，
但必须在 commit 前逐项检查，不得把 `.dbg/` 或凭据带入提交。

### 3.3 选择性提交 foul-play-lab

进入实验仓库：

```powershell
Set-Location D:\Other\ai\foul-play-lab
git diff --check
git status --short
```

应该提交的内容包括已经审查的：

```text
WORKSPACE.md
EXPERIMENT-MANIFEST.json
fp/
tools/
tests/
docs/
```

不要提交：

```text
.venv/
__pycache__/
.pytest_cache/
data/pkmn_sets_cache/
logs/
replays/
target/
credentials
临时实验输出
```

提交前运行：

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check
```

然后选择性暂存并检查：

```powershell
git add WORKSPACE.md EXPERIMENT-MANIFEST.json
git add fp tools tests docs
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
```

确认列表没有本地环境和缓存后：

```powershell
git commit -m "feat: continue DualView and translated reference development"
git push -u origin codex/dual-view-foul-play
```

如果 `origin` 指向公开 fork，而实验代码不希望公开，应先在 GitHub
创建私有仓库，再修改 remote。不要把 token 写入 remote URL。

## 4. GitHub 账户准备

新设备推荐使用 SSH：

```powershell
ssh-keygen -t ed25519 -C "your-github-email@example.com"
Get-Content $HOME\.ssh\id_ed25519.pub
ssh -T git@github.com
```

把公钥添加到 GitHub 的 `Settings -> SSH and GPG keys`。

也可以使用 GitHub CLI：

```powershell
gh auth login
gh auth status
```

不要把 Personal Access Token 写入：

- PowerShell 脚本；
- README；
- Git remote URL；
- manifest；
- 日志；
- AI 的 system prompt。

## 5. 新设备安装环境

安装：

```text
Git
PowerShell 7
Node.js 24.18.0
Python 3.11.9
Rust stable 和 cargo
Visual Studio C++ Build Tools
```

检查：

```powershell
git --version
node --version
npm --version
py -3.11 --version
rustc --version
cargo --version
```

Rust 和 C++ Build Tools 用于在没有可用 wheel 时构建 `poke-engine` Python
binding。不要因为安装失败就修改 `poke-engine` 或切换到未经记录的 engine 版本。

## 6. 新设备 clone

建议继续使用目录 `D:\Other\ai`，这样现有文档和脚本中的路径无需大范围修改：

```powershell
New-Item -ItemType Directory -Force D:\Other\ai | Out-Null
Set-Location D:\Other\ai

git clone git@github.com:mew980116/pokemon-battle-ai.git pokemon-battle-ai
git clone --branch codex/dual-view-foul-play --single-branch `
  git@github.com:mew980116/foul-play.git foul-play-lab
git clone https://github.com/pmariglia/foul-play.git foul-play
git clone https://github.com/mew980116/poke-engine.git poke-engine
```

baseline 和 engine 必须固定到记录的 commit：

```powershell
git -C D:\Other\ai\foul-play checkout 5bd041d62a6f4c8587699a598a9a92407383e4f3
git -C D:\Other\ai\poke-engine checkout 7126ba7ba9029f24cbddefdd6e9dc6193ee72d33
```

如果上述 commit 不在对应 remote，先检查 remote 和分支，不要随意选择其他
commit 代替。

本地 PS simulator 是可选的：

```powershell
git clone https://github.com/smogon/pokemon-showdown.git ps-sim
git -C D:\Other\ai\ps-sim checkout a5df8274e85b0889bf2a9b3422a08b39732374fc
```

## 7. 安装依赖和本地配置

### 7.1 Node 依赖

```powershell
Set-Location D:\Other\ai\pokemon-battle-ai
npm ci
```

如果使用本地 PS simulator：

```powershell
Set-Location D:\Other\ai\ps-sim
npm ci
```

### 7.2 Python 虚拟环境

```powershell
Set-Location D:\Other\ai\foul-play-lab
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

如果 `poke-engine` 安装需要本地构建，先确认 Rust 和 C++ 工具链，然后按照
`foul-play-lab\Makefile` 的 pinned engine 安装方式操作。

### 7.3 本地凭据

凭据只在新设备本地创建，不从旧设备上传到 GitHub：

```powershell
Set-Location D:\Other\ai\pokemon-battle-ai
Copy-Item platform\ps\ps-credentials.example.json platform\ps\ps-credentials.json
Copy-Item po-pokellmon-tool\llm-credentials.example.json po-pokellmon-tool\llm-credentials.json
Copy-Item po-pokellmon-tool\mify-credentials.example.json po-pokellmon-tool\mify-credentials.json
```

根据需要编辑：

```text
D:\Other\ai\pokemon-battle-ai\platform\ps\ps-credentials.json
D:\Other\ai\pokemon-battle-ai\po-pokellmon-tool\llm-credentials.json
D:\Other\ai\pokemon-battle-ai\po-pokellmon-tool\mify-credentials.json
```

不要在聊天、commit、日志或 issue 中粘贴真实 key。

### 7.4 Gen 9 Random Battle 数据

以下缓存被 `.gitignore` 排除，不会随 clone 迁移：

```text
D:\Other\ai\foul-play-lab\data\pkmn_sets_cache\gen9randombattle.json
```

新设备首次运行时重新下载或生成。也可以通过受控的文件复制迁移该单个缓存，
但不要把整个缓存目录提交到 GitHub。

## 8. 新设备第一次验证

不要直接开始线上对战。按以下顺序验证。

### 8.1 Git 和版本

```powershell
git -C D:\Other\ai\pokemon-battle-ai status --short --branch
git -C D:\Other\ai\foul-play-lab status --short --branch
git -C D:\Other\ai\foul-play status --short --branch
git -C D:\Other\ai\poke-engine status --short --branch
```

### 8.2 Python 测试

```powershell
Set-Location D:\Other\ai\foul-play-lab
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check
```

最近旧设备的参考结果为：

```text
pytest: 629 passed
ruff: passed
```

如果新设备结果不同，先记录失败测试和环境版本，不要直接修改测试让它通过。

### 8.3 Node 测试

```powershell
Set-Location D:\Other\ai\pokemon-battle-ai
node platform\ps\test-ps-adapter.js
node platform\ps\test-ps-client.js
node platform\ps\test-decision-bridge.js
node platform\ps\test-live-observer.js
node platform\ps\test-protocol-replay.js
node platform\ps\benchmark\test-battle-stats.js
```

### 8.4 远程 PS 网络

```powershell
Test-NetConnection 218.244.153.64 -Port 8000
```

网络可达不等于账号可登录。登录和挑战测试必须使用本地凭据，并且不能把
凭据写入实验结果。

## 9. 服务启动和第一个 live smoke

本地服务端口不是迁移资产。换设备后需要重新启动。

### 9.1 translated reference 候选

当前 8099 是 forced-recharge 修复候选，迁移后先进行 health 检查和 3 局
live smoke。它还没有因为迁移而自动变成冻结版本。

```powershell
Set-Location D:\Other\ai\foul-play-lab
& .\.venv\Scripts\python.exe .\tools\live_reference_server.py `
  --host 127.0.0.1 `
  --port 8099 `
  --particles 1 `
  --search-time-ms 100
```

另开终端检查：

```powershell
Invoke-WebRequest http://127.0.0.1:8099/health
```

然后运行 3 局 smoke，使用新的实验输出目录：

```powershell
New-Item -ItemType Directory -Force `
  D:\Other\ai\pokemon-battle-experiments\dual-view-v0\reference-8099-recharge-smoke-20261005 | Out-Null

pwsh -File D:\Other\ai\pokemon-battle-ai\platform\ps\run-upstream.ps1 `
  -RunCount 3 `
  -SettleMs 10000 `
  -ReferenceUrl http://127.0.0.1:8099/reference `
  -OutputRoot D:\Other\ai\pokemon-battle-experiments\dual-view-v0\reference-8099-recharge-smoke-20261005
```

重点检查：

- `reference error`；
- `selection fallback`；
- 非法动作；
- `recharge` 是否正确记录；
- 是否出现 `No Move`；
- 是否发生服务断连；
- 是否发生 battle timeout。

### 9.2 DualView

8094 只在 reference smoke 和离线测试通过后启动：

```powershell
Set-Location D:\Other\ai\foul-play-lab
& .\.venv\Scripts\python.exe .\tools\dual_view_server.py `
  --host 127.0.0.1 `
  --port 8094 `
  --particles 1 `
  --self-search-time-ms 5 `
  --opponent-search-time-ms 5 `
  --opponent-exploration 0.1 `
  --seed 17 `
  --strength 1.0
```

不要仅凭端口可访问就宣布 Dual 已经验证。需要检查 health、日志、合法动作、
reference 错误、fallback 和完整对局结果。

## 10. 新 AI 的启动提示词

将下面的内容作为 DeepSeek harness 的首条项目指令，或者保存为新设备上的
本地 prompt。路径和版本信息必须以仓库实际内容为准。

```text
你正在继续开发 D:\Other\ai 下的 Pokemon Battle AI 项目。

先阅读，不要立即修改代码：
1. D:\Other\ai\pokemon-battle-ai\docs\AI-MIGRATION-GUIDE.md
2. D:\Other\ai\pokemon-battle-ai\SESSION-HANDOFF.md
3. D:\Other\ai\pokemon-battle-ai\platform\ps\benchmark\README.md
4. D:\Other\ai\foul-play-lab\WORKSPACE.md
5. D:\Other\ai\foul-play-lab\EXPERIMENT-MANIFEST.json
6. D:\Other\ai\pokemon-battle-ai\docs\foul-play-decision-entry.md

先输出仓库审计：
- 所有仓库的 git status、当前分支和 HEAD；
- Python、Node、Rust、cargo 版本；
- 8093、8094、8099 是否在监听；
- 远程 PS 私服 218.244.153.64:8000 是否可达；
- Python 和 Node 测试是否能运行。

项目边界：
- 只做 Gen 9 Random Battle；
- D:\Other\ai\foul-play 是 untouched baseline，只读，不修改；
- 不修改 D:\Other\ai\poke-engine；
- 不回滚 ps-sim/package-lock.json；
- 不删除或处理 .dbg/；
- 不删除既有 benchmark/replay/summary；
- 不使用 git add -A；
- 不提交凭据、token、API key、虚拟环境、缓存、Rust target、临时日志；
- 任何删除、批量移动、git reset 或覆盖操作先停止并请求确认。

当前算法角色：
- 8095：历史上用于 untouched upstream Foul Play control；不要假设端口仍有服务；
- 8093/8099：translated/reference 候选；
- 8094：DualView；
- DualView 当前不是完整二阶 MCTS。

迁移后的第一任务：
1. 确认代码已从 GitHub clone，且版本和 manifest 一致；
2. 创建本地 .venv，安装 requirements-dev.txt；
3. 创建本地凭据文件，但不要输出凭据内容；
4. 运行 Python 和 Node 离线测试；
5. 启动并检查 8099；
6. 完成 8099 的 3 局 live smoke；
7. 只有 smoke 结果干净后，才评估是否更新 8093 或启动 8094；
8. 所有结论写明实验目录、commit、参数和失败样本。

在每次修改后报告：
- 修改文件；
- 修改原因；
- 测试命令和结果；
- 是否触及 baseline、poke-engine、ps-sim package-lock.json、.dbg/；
- 是否需要人工处理。

不要把“服务启动成功”描述成“算法冻结”，不要把小样本胜率描述成性能结论。
```

## 11. 迁移后的推荐开发顺序

1. 仓库和依赖版本审计；
2. 运行离线测试；
3. 8099 reference smoke；
4. 修复或归类 reference 的剩余错误；
5. 固化 translated reference contract；
6. 再做 8093/8095 对照；
7. 启动 8094 DualView；
8. 做 DualView 的离线 state/visibility/belief 测试；
9. 做 shadow comparison；
10. 最后再做批量线上性能实验。

不要在迁移后第一步直接跑 20 局或 100 局。先排除环境、版本、状态转译和
服务生命周期问题，否则对战结果无法解释。

## 12. 迁移完成定义

只有满足以下条件，才算迁移基本完成：

- 两个主要仓库已经从 GitHub clone；
- baseline 和 engine commit 正确；
- Python、Node、Rust 版本已记录；
- `.venv` 和 Node 依赖可用；
- 本地凭据已创建且未进入 Git；
- Gen 9 数据缓存可用；
- Python 测试通过；
- Node adapter/replay/benchmark 测试通过；
- 远程 PS 网络可达；
- 8099 health 可用；
- 8099 live smoke 有独立实验目录；
- smoke 中没有未解释的 reference error、非法动作或 `No Move`。

如果最后一项失败，应暂停线上 Dual 测试，保留完整日志并先定位根因。
