# 会话交接记录（2026-10-02）

## 当前目标

按用户路线开发 PS BOT：

1. 修复 PS 对战协议/战况解析；
2. 建立无 LLM 对战算法，以 foul-play 为基线；
3. 评估无 timer 的 LLM 对战；
4. 适配 PO Gen8；
5. 评估限时环境下 LLM/规则算法路由。

用户确认远程环境：

- PS 私服：`218.244.153.64:8000`
- WebSocket：`ws://218.244.153.64:8000/showdown/websocket`
- 无密码登录，客户端发送 `/trn <name>,0,`
- Gen9 对手：`foulplaybot`
- Gen8 对手：`foulplaybot-g8`
- foul-play 与 PS 私服在同一服务器运行

## 已完成代码

### PS adapter / 生命周期

- `platform/ps/adapter.js`
  - 保留协议 `rawType`；
  - 扩展 start/end、sethp、formechange、terastallize、dynamax、boost 等事件；
  - 修复 team preview 的 active 标记语义；
  - 修复 poke/switch/request 的队伍重复归并；
  - 增加 battle 结果与形态状态。
- `platform/ps/client.js`
  - 修复 `win` 后同一消息中的 `deinit` 导致重建空 session、重复触发 battle_start。
- 对应回归测试在 `platform/ps/test-ps-adapter.js` 和 `platform/ps/test-ps-client.js`。

### 远程 benchmark

新增：

- `platform/ps/benchmark/run-series.js`
- `platform/ps/benchmark/summarize.js`
- `platform/ps/benchmark/README.md`

runner 支持 `random|rules|llm`、Gen8/Gen9 foul-play 账号映射、独立建房/对局超时、无 timer 对战、每场 JSONL 日志与摘要。

### rules provider

新增 `po-pokellmon-tool/rules-provider.js`，并接入：

- `po-pokellmon-tool/decision-router.js`
- `po-pokellmon-tool/server.js`（版本已更新至 `0.9.12`）
- `po-pokellmon-tool/test-decision-router.js`

当前规则算法是初版 baseline：图鉴招式威力/命中/属性、STAB、优先级、基本状态/回复/强化招式评分，以及有限的换人评分。不是完整 damage calculator 或搜索器。

## 验证结果

最近完整测试通过：

```text
decision router tests passed
PS adapter tests passed
PS client tests passed
PS decision bridge tests passed
```

规则 provider 曾通过本地 HTTP `/choice` 验证返回：

```json
{"type":"move","slot":1,"attackSlot":1,"decisionProvider":"rules"}
```

远程 rules smoke test：

- Gen9 Random Battle：3 次尝试，2 场完成、2 场败给 FoulPlayBot、1 次 `setup_timeout`；已完成对局 fallback=0、非法动作=0，决策 p50 约 6ms、p95 约 8ms。
- Gen8 Battle Factory：3 次尝试，2 场完成、2 场败给 FoulPlayBot-G8、1 次 `setup_timeout`；已完成对局 fallback=0、非法动作=0，决策 p50 约 6ms、p95 约 9ms。

测试输出在：

- `platform/ps/benchmark/results-smoke-rules-gen9/`
- `platform/ps/benchmark/results-smoke-rules-gen8/`
- random smoke 输出在 `platform/ps/benchmark/results-smoke-random-*/`

注意：`setup_timeout` 是挑战/建房未就绪，不算胜负。多个连打序列中间第 2 场出现过，说明 foul-play 接受挑战/恢复存在间歇性问题，尚未实现自动重试或 bot readiness 检测。

## 下一步

按用户此前同意的顺序：

1. 先稳定 benchmark 的连续对战：分析 setup timeout 根因，增加挑战/建房阶段诊断、有限重试与 foul-play 恢复等待；重试不得把超时计作输赢。
2. 稳定后跑更大样本的 random/rules 对比，暂不要把当前 2 场完成样本当作强弱结论。
3. 基于真实 Gen8/Gen9 request 和 protocol 增强规则算法（目前只有 smoke 测试，不足以代表实际强度）。
4. 再进行 LLM 无 timer 对比。

## 工作区注意事项

- 当前开发改动尚未提交。
- `git add` / `git commit` 曾失败：无法创建 `.git/index.lock`（权限拒绝）；不要假设改动已 commit。
- `git status` 还显示 `.dbg/` 下 3 个未跟踪文件，它们是先前调试文件，与当前任务无关，不要删除或纳入提交。
- benchmark 结果是本次验证新生成的本地数据，用户要求“存档当前状态”，因此保留。
- 工作区其他既有改动不要回滚。

## 2026-10-02 后续进展

### 状态同步修复

`platform/ps/decision-bridge.js` 新增了 request 权威快照合并：

- 以 `request.side.pokemon[].active` 确定当前出战槽位；
- 以 request 的 `condition` 覆盖 adapter 可能滞后的 HP；
- 在 active 切换后重新绑定 `state.me`，避免使用旧 Pokémon 或旧满血状态；
- 保留当前 request 的可用招式列表。

新增回归覆盖了 request HP 覆盖 stale active 的场景。

### 最新 benchmark

`platform/ps/benchmark/results-final-rules-gen8-state-sync-v26/` 已完成 50 场 Gen8 Battle Factory：

- 胜 5，负 45，胜率 10%；
- setup timeout 0，battle timeout 0；
- fallback 0，非法动作 0；
- 1664 次决策，p50 8ms，p95 12ms，最大 81ms。

该结果证明连续建房和无 timer 决策链路稳定，但规则算法尚未达到 50% 目标，不能作为达标结果。

`platform/ps/benchmark/results-smoke-rules-gen9-current-v29/`：

- 已记录 2 次 `setup_timeout`；
- 两次均有 login/challengeSent，但 foulplaybot 未返回建房响应；
- 未计入胜负。

### 规则算法最近改动

`po-pokellmon-tool/rules-provider.js` 最近加入：

- recovery 后能否存活的判断；
- 强化对手且当前招式不能击杀时的换人；
- 未知对手招式使用更保守的高威力代表招式估计；
- 命中率纳入期望伤害和 miss 风险；
- boost、速度顺序和低 HP 的 forced progress 处理。

最新 Gen8 10 场 smoke 结果在：

`platform/ps/benchmark/results-smoke-rules-gen8-accuracy-v28/`

当前仍未观察到胜局，需要继续优化后再重新积累最终 50 场样本。不要把 v26/v28 当作达标结论。

### 后续小步验证

最新改动还包括：

- `moveTypeOf()` 对 PS move name 做 id 归一化，使已观察的对手招式能够正确带上属性；
- `scoreSwitch()` 增加对手 STAB 属性、岩钉/撒菱/毒菱对换入目标的影响；
- 增加 `foeThreatScore()`，在高威胁且存在非明显劣势替补时优先换人。

验证目录：

`platform/ps/benchmark/results-smoke-rules-gen8-switch-standard-v30/`

结果为 5 场完成对局、0 胜 5 负；无 fallback、无非法动作。该结果仍是优化过程样本，不代表最终结论。

之后又加入了 `incomingThreat()`：当对手只亮出部分攻击招时，会将已知攻击伤害与未亮出的本系代表招式取较高威胁，避免只因为对手暂时展示了弱攻击就低估被秒风险。

最新验证目录：

`platform/ps/benchmark/results-smoke-rules-gen8-incoming-supplement-v31/`

结果为 5 场完成、0 胜 5 负；setup timeout 0、battle timeout 0、fallback 0、非法动作 0。该优化尚未达到胜率目标，仍需继续调整。

后续又补充了：

- damage calculator 的 weather / terrain 规范化；
- Reflect、Light Screen、Aurora Veil、Tailwind 传入 damage calculator；
- 对手只剩一只时提高直接伤害、降低无必要状态招和铺场动作的残局收敛倾向。

`platform/ps/benchmark/results-smoke-rules-gen8-field-aware-v32/` 已验证 3 场完成对局，0 胜 3 负；setup timeout、battle timeout、fallback、非法动作均为 0。

## 2026-10-02 技术数据统计

benchmark 已新增 `platform/ps/benchmark/battle-stats.js`，并由
`run-series.js` 在每场完成对局写入 `technicalStats`。统计包括：

- 回合数、最终存活宝可梦数；
- 首发以外换人次数，以及包含首发的 `allSwitches`；
- 强化、降级、总出招和攻击招次数；
- 击倒数、残留伤害击倒数；
- 先手击杀和击杀换人；
- `p1/p2` 与按 `player` 协议映射的 `self/opponent`。

`summarize.js` 已升级为 v2，兼容没有 `technicalStats` 的旧 JSONL，会从保存的
protocol 重新计算，并输出平均值、p25、中位数、p75、最小值、最大值、
self/opponent 差值及 provider/format/result 分组。输入 benchmark 根目录时会递归
合并多个结果目录；setup timeout、battle timeout 和 error 不进入完成对局技术均值。

随后升级为 v3：

- 每场完成对局新增 `technicalStats.normalized`，除最终存活数外的次数类指标按本场
  完成回合数归一化，字段形如 `switchesPerTurn`、`boostEventsPerTurn`、
  `firstStrikeKOsPerTurn`；
- 新增 `survivalLeadByTurn`，记录每一回合 `selfAlive`、`opponentAlive` 和
  `selfMinusOpponent`；
- 新增 `survivalLeadTimeline`，固定输出 0%、25%、50%、75%、100% 的时间轴采样；
- 汇总结果在 `technicalStats.<side>.perTurn` 和
  `technicalStats.survivalLeadTimeline` 中提供大样本统计。

最终存活数仍按每场原始数量平均，不做回合归一化。时间轴的某个百分比使用
该场完成回合数乘以百分比并向上取整的回合作为采样点，0% 使用首发队伍人数。

离线测试：

```text
node platform\ps\benchmark\test-battle-stats.js
```

对现有 benchmark 根目录重新分析（截至 2026-10-02）得到 761 场记录，其中
729 场完成、31 场 setup timeout，729 场有技术统计。该汇总混合了不同规则版本，
仅用于验证统计链路，不作为算法强度结论。
