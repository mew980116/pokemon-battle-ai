# 待办工作

> 本文档根据实测笔记 [docs/reference/battle-object.md](docs/reference/battle-object.md) 等文件现状整理。
>
> **当前活跃路线**：po-pokellmon / po-pokellmon-tool（LLM 决策），见下「po-pokellmon（PokeLLMon 路线，LLM 决策）」章节。
> **归档**：早期主脚本（20201227.js）优化、字段语义映射、旧 DeepSeek 接入（deepseek-bridge/）等条目归入文末「历史条目（早期路线 / 暂缓追踪）」，当前不活跃，保留备查。

---

## 项目战略 / 长期目标

> 背景：PokeLLMon（论文实现）与 foul-play 均基于 Pokémon Showdown；本项目当前在 Pokémon Online（PO）做接口与 AI 响应验证，未来迁移 Showdown（PS）。

**两条最终产品线**：

1. **PO 服务型对战机器人**
   - 路线 A（有 LLM）：低成本、可私部（甚至本地部署）的小参数 LLM
   - 路线 B（无 LLM）：继续优化现有主脚本 [20201227.js](20201227.js) 的规则 AI
2. **PS 宝可梦对战竞技 AI**：结合强大 LLM + 算法（搜索 / 伤害计算）
   - **数据源方向（2026-09-19 定）**：长期以 **PS（pokemon-showdown）对战**为主，所以 **PO 数据的错误不再逐一修补**（只修会影响 Gen8 对战判定的明显脏数据，如已修的 `po-data/pokes/type2.txt` 里 `52:1` 脏行），也不建 PO 勘误表。能用 PS 数据的维度优先用 PS，但**注意 PS 数据是 Gen9**：需要按世代过滤（learnsets 已按「Gen8 及更早来源」过滤，见 `buildLearnsets` 的 `hasGen8OrEarlier`）。附带结论：PO 与 PS 数值「不一致」不一定是错——已查证 Cresselia Def/SpD、Zacian Atk 是官方在 **Gen8→Gen9 改过**（120/130→110/120、170→150），我们在 Gen8 环境应以 PO 的旧值为准。

**可复用资产**（调研结论，详见 [docs/research/](docs/research/)）：

- [PokeLLMon](https://github.com/mew980116/PokeLLMon)（已 fork）：prompt 模板库、KAG 知识库 JSON（typechart / 招式 Effect / 特性 / 图鉴）、状态→文本转换、ICRL / SC 实现 → **初期合入 PO 侧**
- [foul-play](https://github.com/mew980116/foul-play)：Showdown 搜索式 AI（基于 poke-engine 树搜索）→ 无 LLM 路线 / PS 竞技参考
- [poke-engine](https://github.com/mew980116/poke-engine)：Rust 战斗搜索引擎（expectiminimax / MCTS / 伤害计算）→ hybrid 预计算参考
- 本地 [20201227.js](20201227.js)：PO 主脚本，规则 AI 基线，路线 B 的持续优化对象

**分阶段路线**：

1. 短期（PO 验证）：DeepSeek 决策链路 + 场况注入 + KAG 克制 / Effect（见下「DeepSeek 接入」）
2. 中期：PO 服务化机器人（双路线并行）
3. 长期：迁移 PS，做竞技 AI

---

## 已完成（从旧 TODO 中划掉）

- [x] 探索 `battle` 对象及其顶层属性（`me` / `opp` / `id` / `data` 等）→ [docs/reference/battle-object.md](docs/reference/battle-object.md)
- [x] 探索 `battle.data.field` 结构（`weather` / `terrain` 属性，`poke(int)` / `zone(int)` 方法）
- [x] 探索 `battle.data.field.poke(int)` 结构（`onTheField` / `substitute` / `pokemon` 等属性，`stat` / `statBoost` / `type1` 等方法）
- [x] 探索 `pokemon` 对象（16 个属性：`nick` / `pokeName` / `status` / `num` / `level` / `life` / `ability` / `item` / `nature` / `hiddenPower` 等）
- [x] 探索 `pokemon.move(int)` 结构（`PP` / `totalPP` / `num`）
- [x] 探索 `battle.data.field.zone(int)` 结构（`spikesLevel` / `toxicSpikesLevel` / `stealthRocks` / `stickyWeb`）
- [x] 探索 `sys` 对象 → [docs/reference/sys-object.md](docs/reference/sys-object.md)
- [x] 探索 `client` 对象 → [docs/reference/client-object.md](docs/reference/client-object.md)
- [x] 实战采样一整局对战日志 → [test/battleLog.md](test/battleLog.md)
- [x] 回调函数参考文档初版 → [docs/api/callback-functions.md](docs/api/callback-functions.md)

---

## po-pokellmon（PokeLLMon 路线，LLM 决策）

> 移植 PokeLLMon 方案的正式 LLM 决策实现。代码在 [po-pokellmon/](po-pokellmon/)：服务端 [server.js](po-pokellmon/server.js)、PO 侧 [po-script.js](po-pokellmon/po-script.js)。

**当前状态**：底座完成 —— LLM 正确配置（非思考 `thinking:disabled`、temperature 0.3、数字选项方案、日志含 token 用量与总耗时）。

**后续 3 条基础路线**：

1. **无思考模式**：当前基准，能用但未必强于主脚本 [20201227.js](20201227.js)。最终目标是做对战 bot 服务，需持续优化 prompt / 场况注入质量。
2. **思考 + hybrid 预计算**：思考模式 + PO 侧复用主脚本的伤害/换人评估，把结构化结果注入 prompt。用时消耗大、易超时，仅适合不开计时器的对战里测 LLM 能力上限。
3. **思考 + tool**：思考模式 + function calling/tool（伤害计算等确定性函数）。同样耗时长，仅实验用途。

**动态路由（生产方向，待 1/2/3 全跑通后再看）**：在 无LLM / 1 / 2 / 3 之间按局面动态路由，平衡用时与水平。

- [ ] 🟡 **给我方精灵加「角色 tag」（用户 2026-09-21 提出，待办）**：当前 prompt 只给我方每只的种族/招/道具/HP，没有任何"它在这支队里是干嘛的"语义。用户设想：给每只挂 `check xxx` / `counter xxx` / `炮灰` / `sweeper` 之类的 tag，**由 LLM 在对局中用 tool 动态更新**（新增/修改/删除），再注入 prompt。
  - **价值**：让"谁负责挡谁、谁是可以牺牲的、谁是残局要保的"变成显式状态，而不是每回合靠 LLM 从零重推；对 T19 那类补位决策（选谁吃刀）尤其直接。
  - **注意**：tag 是 LLM 自己的判断，**必须标注 [estimated]/[proved]** 并允许被后续信息推翻（与 `save_observation` 的 threat level 同一套可信度口径）；另外 tag 会随对局变化（对手某只倒了 → 对应的 check 失效），需要有失效机制，否则会变成另一种"陈旧数据"。
  - **依赖**：可以先复用 `save_observation` 的结构（每只一条、可覆盖），不一定要新开 tool。

- [x] ✅ **我方道具只用 `poke.item` 直读 → Switcheroo/Trick 之后失真；按主脚本的做法改成「从消息维护」+「[proved] 不允许被空读覆盖」**（用户 2026-09-21 提出「主脚本当时还有围巾解析，要不移植一下？」/「能否 proved 的信息不允许简单覆盖」）—— **已完成（script 0.6.14 + 0.6.15）**：
  - **事实（battle99 T16）**：history 文本明确写了 `Ninetales obtained one Choice Scarf!`（**消息层拿到了**），但 `state.me.item` 从这一回合起变成空。T20 因此用陈旧的「我还有围巾」断言先手，实际被 408 速的 Barraskewda 先手秒掉 —— 见 [benchmark-errors.md](po-pokellmon-tool/benchmark-errors.md) E003。
  - **po-script 现状**：我方道具只读 `pklmPoke(me).item` → `sys.item(n)`（[po-script.js](po-pokellmon/po-script.js) `pklmCollectMyActive`）；`pklmInferItem(txt)`（从消息文本认道具名，0.6.8 加的）**只用在对手身上**。
  - **主脚本（[20201227.js](20201227.js)）的做法完全不同 —— 不读 `poke.item`，而是从消息回调的参数维护**：`analyseCurrentItem(itemMess, part)`，其中 `case 23 / 105 / 162: info.item = other`（道具被公开）、`case 132: part 0 → poke(foe).item, part 1 → other`（**Trick/Switcheroo 的交换**）、`case 70 / 160: info.item = 0`（被拿走/消耗）。这就是用户说的「围巾解析」→ **给我方也建一条「从消息 / 回调 `other` 参数维护道具」的路**。
  - **并加一条原则（用户提议）**：**已 [proved] 的信息不允许被「空读 / 未知读」简单覆盖**。采集时建议两个字段都给：`item`（当前直读）+ `itemProved`（最后一次被消息证实的值）+ 不一致时给 `itemNote`（直读为空而 proved 存在 → **报 proved 并注明来源**，而不是静默变空）；**只有消息证明变化时才更新 proved**。同一原则适用于招式表 / 特性。
  - **待确认（要先跑一次探针）**：`team(me).poke(0).item` 在 Switcheroo 之后到底是「PO 读不到」还是「真的没道具」。把 `poke(0).item` 的**原始编号**和回调的 `other` 参数一起打进 `pklmCb` 日志即可判定 —— 若是前者，这是**采集 bug**（系统喂错数据）；若是后者，模型读到空是对的，那就只需 proved 保护。
  - ✅ **探针跑完了（battle104，26 回合，script 0.6.12/0.6.13 + server 0.7.2）—— 结论如下：**
    - **两条直读路都会错，且方向相反**（`itemRaw` vs `itemField` 在 4 个回合不一致）：
      - T0→T1 Snorlax 的 Iapapa Berry 被吃：`raw=0`（**对**，确实没了）／`fld=8015`（**陈旧**，还报着果子）。
      - T10→T11 我方 Indeedee 用 Trick：`raw=0`／`fld=5`（陈旧，Trick 前的围巾）。真值应是 Espeon 的道具，**两条路都读不出来**。
    - ⇒ **`field.poke(me).pokemon.item` 不能当替代源**（它在「失去/消耗」时不回退）。
    - ⇒ **`team(me).poke(0).item` 只在「失去」时可信**（变 0），**拿到新道具时读不出来** —— 这正是 battle99 T16 那个空值的来源。
    - **换道具（Trick/Switcheroo）不走 `onItemMessage`**：全 26 回合里 `itemProbe` 的 msg 分布 `{5:1, 12:7, 21:4, 8000:1, 8006:1}`（剩饭回血 / 命玉反伤 / 吃果子 / 果子消耗 / 道具暴露），**Trick 那回合一条都没有**，而战报文本里明明出现了 "switched items with …!. obtained one …!"。→ 换道具的提示是走 **`onMoveMessage`**（move = Trick / Switcheroo / Bestow）渲染的，所以**移植的落点在 `onMoveMessage` 而不是 `onItemMessage`**（主脚本 case 132 的 `part 0 → poke(foe).item / part 1 → other` 对应的应该是它）。
    - **消息文本同样不可信**：Trick 那句 "Indeedee obtained one **Choice Scarf**!" 用的是**我方当前/旧道具**渲染的（同一来源），是假话 —— 与 battle99 T16 的 "Ninetales obtained one Choice Scarf!" 同一个 bug。
    - **下一步**：① 给探针加一个 `onMoveMessage` 记录点（只记换道具类招式的原始参数 `move/part/foe/other`），跑一把确认 `other` 里到底带不带道具编号；② 再加「消息驱动 + [proved] 不被空读覆盖」的我方道具维护。
  - ✅ **已实现**：**0.6.14** 建 `pklmMyItemProved` 旁证表（只有消息能写）+ `pklmCollectMyActive` 输出 `itemProved`/`itemProvedSrc`（直读为空且有旁证时才用）+ tool 侧 prompt 三分支（`Item:(none … STALE)` 警告）与 `from_state` 兜底；**0.6.15** 把范围从戏法扩到**整个道具消息族**（招式 16/23/70/105/132/160/162 + 特性 23 察觉/78 顺手牵羊/88 收获/93 捡拾/122 黏着/156 熟成），统一走 `pklmItemGain` / `pklmItemLose`，并**显式登记「失去」**（否则 proved 会在道具被打落后复活）、`%i` 一律取回调 `other`、销毁类消息不再回填对手道具、旁证表每局重置。
  - ⚠️ **残余缺口**（不影响当前结论，记录备查）：① **190 最佳礼物**（`%f took the kind offer!`）模板里**没有 `%i`**，拿不到编号 → 该事件只记「失去」不记「得到」；② **Symbiosis/162** 在单打里几乎不出现，双打才有意义（暂按 foe 得到处理）；③ **po-script 没有 Node 侧测试脚手架**（`battle`/`sys` 全是 PO 运行时对象）→ 这套「得到/失去」逻辑目前只有 `node --check` 保护，**没有单测**；要做的话得先写一个 stub（`sys.item`/`pklmGetMsgTable`/`battle.me|opp`）再 `eval` 出回调对象，属于独立工程。

- [ ] 🔴 **「PO 渲染 vs 信息获取」的总账：消息里还编码着大量我们没挖的状态（用户 2026-09-21 提出「这些问题主要还是 po 渲染跟信息获取有 gap…特性消息跟招式消息也都有解读其他内容的说法吧？对照下主脚本」）**：
  - **前提（为什么要靠消息）**：`battle.data` 只暴露 `field.weather` / `field.terrain` / `field.zone(i)`（陷阱）/ `field.poke(spot).statBoost(i)`、`.substitute`、`.onTheField` / `field.poke(spot).pokemon.status|ability|item|move(i)`（见 [battle-object.md](docs/reference/battle-object.md)）。**挑拨/再来一次/定身法/寄生种子/哈欠/扎根/磁力/击坠/燃尽/顺风/神秘守护/属性替换/对手已用过哪些招**这些**读不到**，只能从消息重建 —— 主脚本 `analyseCurrentMoveMess` / `analyseCurrentAbility` / `analyseCurrentItem` 就是在干这件事。
  - **招式消息对照（主脚本挖 20 类，我们只挖 2 类）**：
    | 主脚本从 move 消息挖出 | 我们 |
    |---|---|
    | `item`（23 stole / 70 knocked off / 105 recycled / 132 trick / 160 burned / 162 gave） | ✅ 0.6.15 |
    | 双墙/极光幕（73 / 236） | ✅ 0.6.6 |
    | **顺风**（133）/ **神秘守护**（109） | ❌ |
    | `lastMove` 记录与清空（11 / 13 / 104） | ❌ |
    | **属性替换** `temptype`（14 / 19 / 20 / 157）—— 泡水/森林诅咒/万圣夜/羽栖/燃尽 会改属性 | ❌ |
    | **定身法** `disabledMove`（28） | ❌ |
    | **再来一次** encore（33）/ **挑拨** taunt（134） | ❌ |
    | **寄生种子** seeded（72 / 103）/ **扎根** rooted（107 / 151） | ❌ |
    | **哈欠** drowsy（144）/ **灭歌** perishSong（95） | ❌ |
    | **混乱** confused（93）/ **诅咒** cursed（25） | ❌ |
    | **磁力** magnetRise（68 / 174）/ **击坠** smackDown（175）/ **燃尽** burnUp（233） | ❌ |
    | **特性被改/被压制** `tempability`（51 / 231 胃酸·烦恼种子 / 108 / 112 / 143 / 158 交换特性·木乃伊…） | ❌（我们另在 onAbilityMessage 做「消息→特性 id」识别） |
    | **我方被迫换人** `needSwitch`（95 / 108 / 143 / 144 / 158，`other === 54`） | ❌（靠 PO 的 onOfferChoice 兜底，没显式建模） |
  - **关键区别**：这些消息的**文本我们大多已经在渲染**（`pklmRenderMsg` 是通用的）→ LLM 在 history 里能读到散文（"X fell for the taunt!"），缺的是 ① **结构化状态**（能查、能当约束用）与 ② **占位符来源正确**（填错就变假话）—— 后者才是真 bug，本轮已修掉两类（`%i` 0.6.15 / 特性消息的 `%m` 0.6.17）。
  - **道具消息对照（两种做法互补，不是谁对谁错）**：主脚本用「消息号 → 道具 id」硬表（3→白药草、12→剩饭、21→命玉…）**并且 default 分支 `info.item = 0`** —— 等于「凡是不在表里的道具消息 = 道具没了」，于是打折/烧尽/树果/气息腰带**全都**被清掉（歪打正着）；我们用「文本清单认名（`PKLM_ITEM_HINTS` 31 项）+ 消耗白名单」（0.6.16）。主脚本那种硬表在「名字不在文本里」时更稳，值得以后合并成**两张表都查**。
  - **特性消息对照**：主脚本 `analyseCurrentAbility` **纯粹是「消息号 → 特性 id」**（+ 极少数 `temptype`/`tempability`），我们的 `pklmAnalyseAbility` 是它的逐条移植 → **识别侧没有 gap**。但主脚本**不从特性消息里挖道具** → 我们 0.6.15 加的 察觉23 / 顺手牵羊78 / 收获88 / 捡拾93 是**超出主脚本的新地面**，其中「`%i` ← 回调 `other`」是**按约定推的、尚未实测**（打一局遇到察觉/收获即可坐实或推翻）。
  - **顺带一个高价值探针（未做）**：`battle-object.md` 在 `field.poke(0).pokemon` 上列了 `ev(int)` / `iv(int)` / `nature` / `hiddenPower` / `level`。当前我们**假设对手的 ev/iv/nature 读不到**（所以要做 EV 反推），但这个假设**只在 `move(i)` 上实测过**（对手恒 num=0/PP=0）。→ 值得试一把 `field.poke(opp).pokemon.ev(1)` / `.nature`：若能读到，对手伤害计算就不用再猜 EV 了。
  - **建议优先级**：① 顺风/神秘守护（和已有双墙同一处，成本最低）→ ② 挑拨/再来一次/定身法（直接影响「它这回合能不能用变化招」这类判断）→ ③ 哈欠/灭歌/寄生种子（影响「还剩几回合」）→ ④ 属性替换 + 扎根/磁力/击坠/燃尽（影响克制与免疫）→ ⑤ `lastMove`/`tempability`/`needSwitch`。
  - **占位符字典 + 证据等级（0.6.17/0.6.18 收口）**：渲染器是通用的（`pklmRenderMsg` 查表 + 13 个槽位替换），**关键在于这些槽位是「位置槽」、类型由消息决定**（同一个 `%t`：`157 transformed into the %t type!` 是属性，`Perish Body %t's perish count` 是宝可梦）—— 这就是主脚本干脆不渲染文本的原因。逐个列证据：
    | 占位符 | 取值 | 证据 |
    |---|---|---|
    | `%s` | 这一侧（spot） | ✅ 主脚本 case 25/28/33/68/72/93/104/109/133/144/151/174/175/233 逐条方向一致 |
    | `%f` | 对侧（foe） | ✅ 同上（主脚本全程用 `foe === battle.opp` 判「谁被作用」，从不检查 foe 为同侧） |
    | `%i` | 招式 16/23/70/105/132/160/162 → `other`；树果 → `berry`（道具编号）；道具 36/37 → 持有者自己的道具 | ✅ 招式侧有 `case 23/105/132/162: info.item = other`；树果侧 battle104 实测 `berry=8015`=Iapapa；36/37 为推断 |
    | `%m` | 招式/道具/树果 → 自己那招；**特性 → 对侧那招**（0.6.17） | ✅ 19/22/129（特性）与 128/37/berry4-5（自己）模板自证 |
    | `%a` | `other`（特性编号） | ✅ 主脚本 `ability = other` 的正好是 18/30/31/32/33/38/40/50/68/70/80/89，而这 12 条模板全含 `%a` |
    | `%t` | `type` | ✅ `case 9 / 14 / 19 / 20 / 157: temptype = type` |
    | `%st` | `other`（能力编号） | ✅ 与 `%i` 同模板互补（berry 7 `The %i raised %s's %st!`） |
    | `%d` | `other`（0.6.18 补上，读不出保留字面） | ✅ `case 95: other < 2 → needSwitch` ↔ `%s's perish count fell to %d!`；78 Magnitude / 125 stockpile 同机制未实测 |
    | `%ts` / `%tf` | 这一侧 / 对侧 | ⚠️ 由 case 133/109/236/102 的用法 + 我们的双墙归属推的，未实测 |
    | `%q` | 回调 `q`（原样数字） | ⚠️ 连击数/减 PP 数/许愿回合，主脚本完全不取 `q` → 无对照 |
    | `%p` | 变身/进化后的形态名 —— **取值未验证**（137 Transform / 66 Mega / 特性 81） | ❌ 主脚本不碰；我们暂填 spot 自己的名字（对 Mega 可能恰好对、对 Transform 必错） |
    | `%e` | **被拖上场的那只**（107 part2，吼叫/吹飞/龙尾/巴投）→ 取对侧新上场者（0.6.20） | ⚠️ 用户判定（part0/part1 是「吹不走」的两个 case 单独写了，part2 = 吹走成功）＋ probe 验证中 |
  - **待实测/待澄清**：① **主脚本 case 107 疑似笔误** —— `if (foe === battle.opp && part === 1) info.specialStatus.rooted = true;`，而模板 part1 是 `%s is solidly rooted to the ground!`（按全表一致的 `%s`=spot，扎根的应是 spot 这一侧）→ 可能主脚本把 `spot`/`foe` 写反了，打一局遇到扎根即可判；② `%p` 一局实测（Mega 进化那一刻 `numRef` 是否已换成新形态）；③ `%q`/`%d` 的 78/125 两条实测。
  - **✅ 已做（script 0.6.20）：`%e` + 「招式消息白送对方特性」这一族** —— 用户判定 `%e` = **被拖上场的那只**（吼叫/吹飞/龙尾/巴投：part0/part1 是「吹不走」的吸盘/扎根两个 case 单独写了，part2 就是吹走成功的 case）→ 已填 `pklmActiveName(对侧)`，**待 probe 验证**（看 PO 原文是哪只 + 触发时对侧 numRef 是否已换）。另外**吸盘这类特性 `has_msg: false`，没有专属特性消息**，只有招式消息能暴露 → 顺着补了 `PKLM_MOVE_ABILITY_REVEAL`：`1 part2 → 64 污泥浆（归属 %f）`、`43 part0 → 5 结实（%s）`、`**107 part0 → 21 吸盘（%f）**`、`114 → 6 湿气（%s）`、`144 part2 → other（%s）`；**归属按模板语义写死**（这几条消息的 spot 并不统一：`%s's Sturdy` 是 %s 的，而 `%s sucked up the Liquid Ooze!` 的污泥浆属于目标 `%f`）。主脚本只挖了 1/43/114/144，**107 part0（吸盘）它也漏了**。
  - **✅ 已做（script 0.6.19）：渲染探针 —— 让渲染结果与 PO 战报并排**（用户提案：「你渲染了就发出来到 po，然后我直接把 po 战报连着 probe 一起贴回来」）。`onMoveMessage`/`onItemMessage`/`onAbilityMessage` 三处各打一行 `[PKLMP]`：
    ```
    [PKLMP] move=70/0 spot=ME foe=OPP type=0 other=15(item:Leftovers) q=0 m=Darkest Lariat | T=%s knocked off %f's %i! | R=Snorlax knocked off the foe's Leftovers!
    ```
    `T`=命中的模板原文（`(NO TEMPLATE)` = 表里没这条）、`R`=我们渲染出的文本（`(null)` = 没渲染）、`other=..(..)` 把该数字同时按 道具/招式/特性 解码（帮助判 `other` 语义）。**PO 自己那行战报就在相邻行** → 逐行对照即可判定每个占位符是谁、方向对不对、哪些消息我们根本没渲染。开关 `/llm probe`（默认 ON），走 `pklmPrint` 所以静默账号不出。
  - **[ ] 🔴 待做：特性「被复制 / 被改」的链条没有分开建模（用户 2026-09-21 追问「trace 复制了对手特性、触发的又是复制过的特性、然后下场再上场，整个过程你怎么解析、会记成什么状态」）**。现状是**一个槽位 `pklmOppAbility[slot]` 被反复覆盖**，含义在链条中不断变化，于是三种错法：
    - **① 复制到手的那条特性被丢掉**：Trace 触发是 ability msg **66** `%s traced %f's %a!`，`%a` ← `other` = **被复制到的特性 id**。我们的 `pklmAnalyseAbility(66) → 36(Trace)`，于是 `abilityInferred = "Trace"`，而 `other`（真正当场的特性）**只在 turnLog 文本里活着、没进 state**。
    - **② 复制到的特性若有消息会覆盖、若无消息就停在 Trace**：复制到威吓 → msg 34 → 覆盖成 `Intimidate`（此刻正确，但"它本来是 Trace"丢了）；复制到**无消息特性**（Levitate/Magic Guard/Multiscale…`has_msg:false`）→ 没有任何后续消息 → state **永远停在 "Trace"**，而它此刻实际持有的是 Levitate —— 对「地面招能不能打 / 伤害要不要减半」的判断是**错的**（而且 prompt 用的是 `Ability:Trace` 这种**已证实**的口吻）。
    - **③ 下场再上场不自清**：`pklmOppSwap` **复用同一个记录槽**，而 `onSendOut(opp)` **不清 `pklmOppAbility[slot]`** → 上一段在场时记的值会残留（靠 Trace 与新特性的消息自愈，遇到无消息特性就自愈不了）。
    - **建议修法**：把「**种族特性**」与「**当前生效特性**」拆成两个字段（`abilityInferred` / `abilityCurrent`），msg 66 的 `other` 写进 current、Trace 本身写进 species；`onSendOut(opp)` 时把 current 清空（species 保留）；prompt 写成 `Ability:Trace (species; currently copied: Levitate)`，`from_state` 用 **current**（机制相关）。同族还要一起处理：**47 Mummy**（`%s's ability became Mummy!`）、**161 Wandering Spirit**（`%s's Wandering Spirit swapped Abilities with %f!`，我们**没有这个 case**）、**143 Receiver**（`%f's %a was taken over by %s!`，`%a`=继承来的特性）、**move 112 Skill Swap / 108 Role Play / 143 / 158**（主脚本用 `tempability` 表达）。
    - **我方侧**：`ItemProved` 那套对我方**特性**不存在，因为我们直读 `tp.ability`（PO 会不会在木乃伊/特性交换后更新这个字段 = **未验证**，值得进 probe）。

- [ ] 🔴 **`simulate_turn` 不建模「入场特性」→ 会把某条线的全部价值漏算掉（2026-09-21 battle99 T19 实测）**：
  - **现场**：Sandaconda 倒下要补位，对手 Barraskewda 100%（408 速物理水系），我方剩 Escavalier 11% / Ninetales 59% / Slurpuff 72%。工具算 `Liquidation → Ninetales = 100-118% guaranteed OHKO`，于是 LLM 判"换 Ninetales 就是白送"、否掉了「换九尾开晴天」这条线，改选 Slurpuff（吃 42-49%）。
  - **实际数值**（同一 state，只把 weather 改成 Sun 复算）：Ninetales **Drought 是入场特性**，换入即开晴天 → Liquidation 变 **49-59%（仅 6.3% 概率 OHKO，93.7% 活）**；同时 Slurpuff 只吃 **20-24%**（而非 42-49%）。也就是说用户那条线在数值上明显更优，而 LLM 用它自己算出的"必死"数字否掉了它 —— **不是幻觉**，`unknown[]` 里确实写了 `ability triggers on switch-in (Intimidate / weather setters / etc.) are NOT modelled`，但它没手动补 ×0.5。
  - **候选修法**：① `simulate_turn` 的 `i_do` 为换人且换入者的 **ability 已知**（state 的 `bench[i].ability` 有值，PO 直接给）时，自动把 field 换成该天气/场地并在行内写明 `assumed weather after switch-in: Sun (Ninetales's Drought)` —— 这不算猜测，是确定性机制；② 或给 `assume` 加 `{"weather":"Sun"}` 让模型显式声明；③ 至少在 `unknown[]` 里对"换入者是入场特性持有者"给一句强警告，别让它读成必死。
  - **更一般**：任何"入场触发"的确定性机制（威吓 -1Atk、天气/场地特性、下载、无形/preview…）都会以同样方式歪掉"换人分支"的结论，修的时候按同一类处理。

- [ ] **服务版 LLM 完全失败降级为非 LLM 规则 AI**：多次 retry 完全 fallback 后，退化为主脚本 [20201227.js](20201227.js) 那样的非 LLM 运行——在 PO 侧本地计算伤害/换人/出招，不依赖 server / DeepSeek。目的是服务版在 DeepSeek 不可用 / 断网时仍能持续对战，不卡死、不摆烂（复用主脚本 `attemptCommand` 那一套评估逻辑作为兜底决策器）。
  - **主脚本那套是完整规则 AI，理论上能独立打完一整局**（不依赖 server/LLM），所以降级后不是「等死」，而是切到一条可持续的决策路径，可以撑到终局。
  - **降级期间持续重试连接 server**：进入兜底模式后不放弃 LLM 路线，每回合（或按间隔）探测 server 是否恢复（如轻量 `/health` 或直接重发 `/choice`）；一旦恢复则切回 LLM 决策。降级是「可逆的降级」，而非一次性判死。
  - 实现要点：兜底决策器与 LLM 决策器做成可切换的双路；server 恢复检测要轻量、有节流（避免断线时又触发 antidos）；与现有的「断线节流」「连续失败认输」逻辑联动——降级优先于认输（先试着用规则 AI 撑下去，认输是最后手段）。

- [ ] **生产环境允许 LLM 主动认输省 token + 认输后走 PO 代理**（用户 2026-09-20 提出；**依赖上面那条「降级为非 LLM 规则 AI」先做完**，本质是同一个「双路切换」基础设施）：
  - **目标**：LLM 判定「劣势大到无法翻盘」时可以直接认输，不再把 token 烧在必输的残局上（battle92 那种打到 T16 的消耗战、或明显被推平的局）。
  - **认输之后**：**后续所有操作直接由 PO 侧代理处理**（不再发 LLM 请求），即降级到非 LLM 路径；等到下一局/下一个明确时机再切回 LLM。
  - 设计要点（待细化）：
    - **协议**：新增动作类型（如 `{"type":"forfeit"}`），po-script 收到后 `battle.forfeit()`；server 侧解析 + 日志标 `concede` + 理由，便于统计。
    - **判据写进 prompt**：明确「**什么时候才可以**认输」（对手存活数显著领先 + 我方主要威胁无解 + 看不到清场/消耗/换血路线），并要求写出依据——否则模型容易早早认输。
    - **硬门槛防滥用**：例如「turn ≥ N」「我方剩余 ≤2 且对手 ≥4」「连续两回合评估都判定无翻盘线」才允许认输。
    - **复盘统计**：记录每局是否认输 + 理由，事后核对「认输的局是否真的都输了」（误判率），据此调门槛；误判（把能打的局认输）比多烧点 token 更糟。
  - **状态**：待实现（等 PO 侧兜底双路做完）。

**tool 模式长期 TODO**：

- [ ] 🟡 **worklog（`update_worklog`）暂时屏蔽，待重新定义「写什么」**（2026-09-20，随 server 0.4.13）：
  - **现状**：[server.js](po-pokellmon-tool/server.js) `ENABLE_WORKLOG=false` —— 不再暴露给模型（tool 19→18）、WORKFLOW 不提（原第 (1) 步整段撤掉、后续重编号为 REVIEW/PLAN/VERIFY/DECIDE）、system prompt 不再注入；代码保留，改回 `true` 即恢复。
  - **实测依据**（battle93/94/95，均为胜局）：worklog 调用占 tool 轮数 ≈26%/28%/28%，且**从不与其他 tool 合并** → 平均每决策 1.6 次**独占**的 LLM 往返。内容只有约 1/3 是 WORKFLOW 想要的短结构化结论（如 battle93 T4 的 177 字 `Goal → 结论 → 一句理由`）；另有大量是把它当「思考通道替代品」的千字内心独白（battle94 T3 单次 **7821 字**，反复自我推翻、枚举全部分支），并出现**未清洗的泄漏**：`thinking 终结符 + 原生 tool-call 标记`（`<|end_of_thinking|>` / `DSML invoke`）被直接写进 `text` 参数。
  - **根因**：`THINKING_ENABLED=false`（仅 turn 0 开），除首回合外没有思考通道，而调 tool 那几轮 assistant 的 `content` 又是 `null` → 模型的"当前计划"无处安放，就灌进了 worklog。
  - **待办**：① 重新定义 worklog 只写「结论 + 假设」三行式（`DECISION` / `ASSUMED` / `TODO`，≤300 字）；② server 侧对 `text` 做清洗（剥 thinking / DSML 标记）+ 长度上限；③ 评估是否改为 **server 自动回灌**（不再让模型花一轮重写，直接省掉那 28% 往返）。
  - **对比参照**：`save_strategy` 的 `scene` / `checks` 是**已结构化回灌**的（预测与实况不符会强制复盘、`checks` 回灌最近两条），worklog 若保留应向这套看齐，而不是纯文本拼回 system 首条。

- [ ] 🔴 **决策门禁：predict → 验算 → 不一致则重选动作**（用户 2026-09-20 提出；这是 E001 的正解，见 [benchmark-errors.md](po-pokellmon-tool/benchmark-errors.md)）：
  - **要解决的问题**：LLM 会对「换入者扛不扛得住」**不验算就下结论**，且**只在支持自己想做的动作时把倍率说反**（E001 实测 6 次重放：inbound 验算 0/6；要换洛托姆时说「水是中性」3/3 错，决定不换时说「弱水 2x」2/2 对）。
  - **设计**：新增 `predict(claims)`（**只登记预测、不给答案**，强制先承诺后揭示）；claim 分四类 `type`（`get_type_matchup` 裁决）/ `survive`（`calc_damage` inbound）/ `damage`（outbound）/ `order`（`calc_stats`）；`calc_*` 接受 `claim_id` 并在返回里带 `MATCH|MISMATCH`；`save_strategy` 变**硬闸**（承载结论的 claim 未裁决或 MISMATCH → 返回 error，必须改写重交）；最终 `{"choice":N}` 前若闸门未过 → 注入一条 user 消息让它收敛（超过 2 次放行并标 `gate_unmet`，防死锁）。
  - **关键措辞**：MISMATCH 必须**重选动作**，不是只改预测（否则会交出「预测改对了、方案照旧」的策略）。
  - **范围**：用户定为**所有回合强制**。注意轮次预算——全回合强制预计每回合 +2~4 轮（battle96 T1 已 7 轮/30s），要把 `MAX_TOOL_ROUNDS` 从 25 提到 ~35，或让 gate 重试不计数，否则超限会走 `finalizeNoThink` 反而丢结论。
  - **验收①（已完成，2026-09-20）**：门禁前基线 A/B 两臂各 10 次（唯一变量 = worklog 开关，state 完全相同）——**A** = 0.4.12（worklog 开，8096，`%TEMP%\pba-armA`）：**7/10 = 70% 选了必死的洛托姆**，inbound 均值 1.30/样本；**B** = 0.4.13（worklog 关，8092）：**5/10 = 50%**，inbound 2.40/样本；早前 B 批次 2/6 → 合计 12/20 = 60%。⚠️ n=10 时 A/B **统计上分不开**（p≈0.65），只能说点估计偏高。完整表 + 证据见 [错题集.md E001](po-pokellmon-tool/错题集.md)。
  - **验收①的关键发现（改变了设计）**：① **「算了」≠「会改判」**——B R10 对选中的洛托姆算了 6 次承伤、strategy 明写「Hydro Pump/Scald in rain = OHKO」，**仍然换了**（赌对手点 Hurricane）；② **它只给「自己想选的那条」做体检**（A 臂 7 个致命样本的 inbound 验算全算在 Toxtricity/留场上，没有一次算在选中目标 `me:4`）；③ **幻觉在制造决策依据**——R10 写「Hurricane **2x vs Fairy**」（实际 1x），把留场算成挨 82-96%（实际 ~37-42%），从而让「换人赌一把」显得合理。
  - **设计修正（因上面 ①）**：光做「claim vs calc 一致性」**不够**——R10 的 strategy 并不自相矛盾，一致性检查不会触发。必须追加 **结果约束闸门**：用已裁决的最坏 inbound，若**所选动作**在对手任一合理招下 `guaranteed OHKO` 且存在更安全的可选动作 → **直接拒绝**（要求改选）。并且 `type` claim（`get_type_matchup`）放在最前，一次调用就能杀掉「2x vs Fairy」这类幻觉。
  - **验收②（已完成 2026-09-20）**：C1 20% → C2 40%（换漏法）→ **C3（simulate_turn）0%**；见 [benchmark-errors.md](po-pokellmon-tool/benchmark-errors.md) 的 C1/C2/C3 表 + 对照 fixture 表。**但要诚实**：C3 的 0% 更可能来自「仿真表让它看见负血量」的信息效应，而非门禁的拒绝力（门禁只校验"声明的那个分支"，它可以选择声明无害分支）。
  - [ ] ⏸ **待定（用户 2026-09-20：先打打实战再说）补「换人后的下一回合收益」**：`simulate_turn` 是**单回合生存表**，看不到"赌赢的收益"（例：赌一次换入 → 下回合围巾先手 4x 秒掉对手洒水器）。结构上会让模型**系统性偏向不赌**（battle96-T1 fixture 实测 0/5 选洛托姆，而该路线并未被门禁禁止）。候选修法：对**换人动作**多输出一行「若这回合没死，下回合的先手情况 + 对它的 4x 击杀机会」——只补一层、不做树搜索。**先看实战是否真的过度保守再决定。**
  - **设施（已完成）**：fixture [eval/fixtures/battle96-t1.json](po-pokellmon-tool/eval/fixtures/battle96-t1.json)（含上帝视角评分规格 `threatMoves`）；采样+评分脚本 [eval/run.js](po-pokellmon-tool/eval/run.js)（`--url` / `--logdir` / `--arm` / `--n`，产 `eval/results/*.json` 含 strategy 原文）。评分口径已验证：留场 Weezing 87-103%（25% 被杀）= RISKY，Toxtricity 81-96% = SAFE，Rotom-Heat 137-162% = **LETHAL**。
  - **⚠ 方向修正（2026-09-21，用户："最好别搞门禁，我感觉门禁会搞出 bug"）**：0.7.6 加的「声明换人前必须先仿真一条留场分支」**已撤（tool 0.7.8）**。理由：那条判据把"我们以为合法的动作集合"写成硬拦，而该集合恰好是已知有洞的那块 —— 「只有换人可选」的回合不止"我方已倒"（`me.fainted`），还有**我方自己用换场招（U-turn 族）/ 逃生按钮触发 / 危险回避触发**，那时 `me.fainted=false`、招式列表也照样列出来 → 判据一错，门禁自己就是新 bug 源。且 battle106 复测 6/6 全对时它**一次都没触发**（起效的是 `trajectory` 那句确定性事实）⇒ 收益未证实、风险已证实。**今后引导倾向"给确定性事实"，不倾向"加拦"**；`trajectory` 保留。
  - **⚠ 先手判定改用"正反手都算"（2026-09-21，tool 0.8.0）**：用户定规则「只要是同先制度的操作你都算正反手吧…别直接 you move first 了」。起因是 battle106 T15 的 sim 输出 `you move first (your spe 309 vs their 194-306)` 而实际是后手 —— 对手 Roserade 全程先手、一点血没掉（一路 KO Basculin→Zarude→Vikavolt→Mew）⇒ 只能解释为**专爱围巾**（306×1.5），而我们的速度上限只算到"252 速 + 正性格"。速度对比的错法**只朝"我更快"一个方向错**（围巾/顺风/强化/麻痹都看不见），所以它不再是顺序的依据：先制度不同仍是硬事实（只算一种），同先制度**一律两块盘面**。**仍未建的是"围巾推断"本身**（可从"锁招 + 连续先手打脸我们的上界"反推），挂着。
  - **换场招的交互（用户 2026-09-21："当然是用出了招式再换人，这是规则"）**：换人目标在**招式结算之后**才选，不是选招时一并交 `pokeSlot` ⇒ [pklmSendCommand](po-pokellmon/po-script.js) 只填 `attackSlot` 是对的。待补的是**识别**：我方用换场招（U-turn 族）的回合会**多一次决策**（只有换人合法，但 `me.fainted=false`、招式列表照列）→ 该在 prompt 里把这批招标成不可用（给事实，不设拦）。等实战真遇到再补。

- [ ] 🔴 **两阶段决策：先「排除明显愚蠢的选项」，再对剩余选项仿真选择**（用户 2026-09-21 提出；"算了，待办吧"）：
  - **起因（battle108 PO T7，用户问"他不选鼬是什么理由" → 结论：这一步本身错，不是我一开始说的"读数漏了/判断分歧"）**：Throh 倒下后选了 Jirachi，而场上有 Mienshao（339 速 > Bouffalant 速度上限 229，Close Combat 156-184% 必杀）。**人类扫一眼就知道 Jirachi 蠢**：对面 +2 的 Bouffalant 打不死、只会继续 SD/Sub，上一个 3HKO 的墙上去只是被磨。**教训（别开脱 + 别过度自信）**：不能用"它引用了我们喂的数字"当作"判断变对了"的证据 —— 0.8.2 的事实块只把 ② 从 1/3 提到 2/3（③ 1/3 → 3/3 是唯一明确改善）。
  - **思路**：把决策拆两段 —— ① **排除明显愚蠢的选项**（对应人类"一眼砍掉一批"）；② 只对剩下的候选跑现有的仿真选择流程。**副作用可能是更便宜**：现在生产配置 5.67 请求/决策、95k prompt，其中相当一部分花在**对蠢选项也跑仿真**。
  - **阶段一的关键判据不是伤害阈值，而是「这一步能不能改变局面」**：排除 = （不能击杀）∧（不能终止对面的滚雪球 —— 对面有强化招且已强化过时，"只是扛得住当前这一发"不算改变局面）∧（没有任何功能性动作：撒钉/清钉/回复/天气/状态/接力/UT）∧（**必须同时存在别的候选能满足上一条**，否则删空 → 不筛）。**纯查表筛不掉 Jirachi** —— 它确实扛得住当前一发，需要多推一步（它会继续 SD 穿透）。
  - **三个待定**：① 筛放**服务端确定性**（零 token、零额外请求）还是**模型 cheap 请求**（只输出排除清单+理由，不给工具）还是两者都做；② 筛掉的选项**删掉**（+ 理由写进 prompt，让它知道为什么没了）还是**标注保留**；③ 判据要**窄**（宁可漏杀）还是**宽**（宁可误杀、更接近"人类一眼"）。
  - **验证靶子**：正向 = battle108 PO T7（必须恰好删 Jirachi、不误删 Mienshao/Sandaconda）；反向 = battle108 其余回合 + battle106 T13/T15（"留场炮灰""挡招换人"不许被误删）。
  - **前提**：用户明确"不考虑靠思考模式 / 换更强模型来顶"（烧钱）→ 这条要在**弱模型的 prompt/流程**里解决。**基线已改为 flash+low**（2026-09-21）。

- [ ] 🎯 **【方向已定】把 `simulate_turn` 的内核换成 PS 引擎（`@pkmn/sim` / `pokemon-showdown`）而不是继续手搓机制**（用户 2026-09-20：「这个模型的竞争性场景实际上还真是以 PS 为主，PO 主要还是测试跟可能的未来服务用，出点因为 PO 数据问题导致的幻觉也无妨，所以真对齐的话直接搬一个 PS 引擎我觉得还行」）：
  - **背景（引擎蔓延）**：sim 目前从"伤害"一路补到"命中率 → 会心 → 变化招/状态标注"，再补下去（异常状态后果、能力等级、残余、替身、灭亡歌、陷阱触发、特性触发…）就是在重搓一个半成品 PS。**目标环境是 PS，那 PS 语义就是对的语义**，所以直接搬引擎比手搓划算。
  - **范围**：把 state 映射成引擎的战场、对手未知信息用 `assume` 填、跑一回合、把结果转成现有的**分支表 + `unknown[]` 骨架**（未知信息的声明骨架必须保留——引擎也消不掉"对手 EV/道具/特性未知"）。
  - **工程要点**：① `@pkmn/sim` 是 TS，需要构建/打包进 `vendor/`（与现有 `vendor/smogon-calc` 同模式）；② **PO 编号 ↔ PS dex 的映射**（state 里的特性/道具/招式编号是 PO 的，而引擎吃 PS dex —— 我们已知 PO 会合并相近特性：17 Immunity/Pastel Veil、164 Teravolt 并入 Turboblaze）；③ 数据源倾向整体转向 PS（现在 knowledge 是 PO + pokemon-showdown 混的）；④ 引擎是"权威计算"，**PO 局里它可能与 PO 实际不符**——按用户定调可容忍，但要在输出里标明"本表按 PS 规则计算"。
  - **前置**：不做 PO 战报对账（用户已认可容忍差异）；但建议**先在 PS 规则下自测**（拿 PS replay 或构造局面）确认引擎封装正确。
  - **时序**：**排在实战验证之后**。当前先用 0.5.4 的"只标注不建模"版本上实战，观察模型会不会被 `0% = 安全` 骗、以及 sim 的缺口是否真的影响决策，再决定投入。

- [x] 🟢 **「可能性空间补全」——补出模型没想到的招**（2026-09-20，server 0.5.6）：
  - **动机（用户洞察）**：「他想到的倒是都对，其实关键是那些他没想到的」。数据支持：battle93-97 共 107 决策 / 823 次调用，`get_pokemon_info` 39 次里 **36 次只拿图鉴摘要**（0 次全池）；它用过的 3 次招式池校验共 26 个招 **全部在池内**；`simulate_turn` 的 36 个分支 **0 次**触发"不在学习面"。→ **招属不属于这只，它记忆很准；漏掉的招才是风险，而漏掉的那一行表里不存在、门禁也看不见。**
  - **做法**：`simulate_turn` 顶层返回 `possibility_space.unlisted_dangerous` —— 扫对手**学得到的攻击招**（`LEARNSETS.byKey`），对"我行动后留在场上那只"算伤害，列出**未列进 `opp_does` 且 ≥25%** 的 top 4（含 dmg / ko / faints）。
  - **关键定性**：这是**可能性空间的上界，不是预测**（note 写死 NOT a prediction）——所以**不需要配置频率先验**，也不违反"不建合理招表"的约束（纯逻辑：学习面 ∩ 伤害计算）。变化招不在其中（只算伤害）；变威力招用固定假设并在 caveats 声明。
  - **实测**：E001 局面里它只列 Hydro Pump/Scald/Hurricane，补全后是 **11 个 ≥25%**（Weather Ball 126-149% / Surf 113-134% / Brine 83-98% / Water Pulse 76-91% …）→ **"水招会秒洛托姆"这个结论对"它漏掉哪个水招"是鲁棒的**。
  - **待观察**：实战里它会不会把这些补出来的招加成分支（battle97 起可用）；以及 51 次 calc/回合的本地开销是否可忽略（目前看是 ms 级）。

- [ ] 🟡 **「未查招式池就断言对手配置」的两个方向（按数据重估后）**：
  - 原方案 A/C（默认返回招式池 / prompt 注入池子）**按数据应放弃**：归属层它本来就准（26/26），补池子收益最低。
  - 原方案 B（没查池子就断言 → 警告）**价值被高估**：它的断言是**频率**（"Blissey likely Toxic"、"Mandibuzz's standard wall kit"）不是归属，池子校验管不到频率。
  - **B'（可选，一分钟）**：prompt 里明确告诉它"**你没有配置频率先验，只能用『已暴露的招 + 它学得到的招』界定可能性，不要拿 commonly/likely/standard 当决策依据**"。
  - **D（频率先验）**：引 PS usage / 常见配置数据给"它可能带什么"一个**实测频率**——与"PS 对齐"同线，一起做。

- [ ] 🟡 **`from_state` 越界槽位静默降级**（2026-09-20 发现）：合法槽位是 `state.myStats` 的 slot（0=场上，1-5=板凳），但传 `me:7` 这类越界值时 `tools.js` **不报错**，只把 ev/iv/性格换成默认值，照样返回一个"看起来正常"的伤害（battle96 T1 的 Thunderbolt 就是这么算的）。建议：显式指定了 slot 却解析不到 → 返回 error（或至少把 warning 提到返回体的顶层），不要让模型拿到一个来路不明的数字。

- [ ] ⏸ **（用户 2026-09-20 决定暂缓，先不动）跨回合的战术洞察没有留存机制**（来源 E002，见 [benchmark-errors.md](po-pokellmon-tool/benchmark-errors.md)）：`save_strategy.text` 从不回灌（只有 `scene` 最近 1 条、`checks` 最近 2 条），所以「锁招陷阱」这类正确洞察写过就丢——battle96 里它 T4 写过「锁 Draco 会吃 -2 SpA，U-turn 更好」，T16 面对同一个抉择点时已完全不记得。worklog 也救不了（每回合清空）。方向（先不做）：把这类洞察引导到 `save_observation`，或做成可从教训里召回的知识条目。

- [x] 🔴 **【高优先级】对战主脑切 `deepseek-v4-pro`（已切 0.3.46，待实测对比）**：实测（2026-09-16）确认 `deepseek-v4-pro` 端点可用、**未被路由到 flash**（响应 `model:deepseek-v4-pro`）；开 thinking + tool 多轮时**不回传 reasoning_content 不报错**（两场景均 200），故切换**无需**改 [server.js](po-pokellmon-tool/server.js) 的 reasoning_content 回传逻辑。附带发现：回传 reasoning_content 提升 prompt cache 命中（cached_tokens 384 vs 256、miss 41 vs 169），属可选优化。**已落地（0.3.46）**：`MODEL` 默认改 `deepseek-v4-pro`，提成 env `POKELLMON_MODEL`（一键回 flash：`POKELLMON_MODEL=deepseek-v4-flash`），thinking 仍 `low`。**待做**：实测对比 Flash/Pro 的决策质量 + 延迟；Pro-max 在多轮 tool（MAX_TOOL_ROUNDS=15）下可能逼近 240s 超时，若 low 稳定再考虑按「关键回合（换人/残局/强化手判断）升 high/max」分级。
  - 背景：Flash 强「工具/agent 执行」（DeepSWE 74.2 > Pro 62.7）弱「闭卷深想」（HLE 36.8 < Pro 42.7）；对战主脑瓶颈是「决策浅/缺全局意识」而非工具执行，故倾向 Pro。R1 无资源 + 工具调用弱，不作主脑。

- [x] 🔴 **【高优先级】认输根因 = state URL 过长（已修 0.3.43）**：实测 `sys.synchronousWebCall` 120s 不超时（排除 webCall 超时），翻旧 server 输出无崩溃/DeepSeek 报错；真正根因是 **state 里的 fullHistory 随回合累积，`?state=<encodeURIComponent>` 到 turn 23 已 ~16KB**，逼近 Node 默认 `maxHeaderSize`(16KB) → 请求被拒 → PO webCall 返回空 → `JSON.parse` 崩 → 连续 3 次失败（跨度>15s）→ 认输。修复：`http.createServer({ maxHeaderSize: 65536 })`（放宽到 64KB）+ 加 crash 日志（crash.log）。长尾：fullHistory 无界增长，超长局（100+ 回合）仍可能再触顶，后续考虑改成 POST（state 放 body）或裁剪 fullHistory。

- [ ] **历史战报改为 server 端拼接（根治 state URL 过长）**：当前 PO 每回合把完整 `fullHistory` 塞进 `?state=` 发出，随回合线性增长（turn 23 已 ~16KB），虽已放宽 maxHeaderSize 到 64KB，超长局仍会再触顶。方案：PO 侧只发本回合新增的战报片段（`pklmTurnLog`，不再重复发累计的 fullHistory），server 按 `battleId` 缓存累积拼接成完整 history 供 `get_battle_history` tool 用。URL 从 O(回合数) 降到 O(1)，从根上解决。需改：① po-script.js 采集 state 不再带 fullHistory（或只带增量）② server 端按 battleId 维护 `historyStore[battleId]`（append 增量、对战结束释放，类似 notesStore）。

- [x] **允许 LLM 读写对战观察（memory）**：已完成 —— `save_observation` / `get_observation` / `save_strategy` / `get_strategy` 四个 tool 已实现并运行。后续持续完善：看 LLM 还可以观察什么、记什么（如对手操作倾向/习惯、常见先读模式等），按需扩展笔记字段或新增观察维度。

- [x] **先读（预测对手行为）决策框架（已实施 0.3.49，采用方案 b：写进 save_strategy 的 tool 描述）**：让 LLM 决策前从对手视角做合理先读，5 步框架：
  1. 对手是否倾向于使用招式？（包括已知他有的 + 他可能会携带但未暴露的）
  2. 对手是否倾向于替换某只宝可梦？（仅根据对手已暴露的宝可梦及其状态推断）
  3. 对手已经知道我方的哪些信息？对于对手未知的我方信息，他会视作威胁还是置之不理？
  4. 基于此，你认为对手最可能采取什么行动？我方如何应对这一行动最优？如果预测错误，是否会直接使我方陷入严重被动？
  5. 基于上述分析，给出最终决策。
  补充决策思考：
  - 若有多个能重创（KO）对手的招式，可选伤害不是最高、但能覆盖（cover）对手潜在换人的那个（而非一味选最高伤害）。
  - 若我方场上完全 counter 对方、但对手后备信息太少，可考虑撒钉/强化/替身等（利用对手信息不足做铺垫，而非直接输出）。
  已写入 `save_strategy` 的 tool description（要求 LLM 按这 5 步写 read→plan 笔记，并含两条启发）。

- [x] **先读推演只用于「当次决策」，跨回合只带「待核对判断」**（2026-09-19 提出并已实施）：`save_strategy` 拆成两部分并存成 `{text, checks}`——`text` = 本回合的 6 步先读/推演（含新增的「到下次决策前的行动序列」），**不回灌**；`checks` = **留给后续回合去战报里核对的待验证判断**（不是行动提示）——写成「我假设 X 的力度/速度是…，若…则被证伪」这种可核对形式，例：`verify whether X hits harder than I assumed, refuted if it does <40%`、`check whether X is really faster than Y`。（参数名 0.3.63 由 `advice` 改为 `checks`，语义更直白。）server **只把最近 2 条 `checks` 注入后续 prompt**，label 为 `PENDING CHECKS you left for yourself — verify each one against the new battle log BEFORE deciding`；WORKFLOW 的 REVIEW 步也要求先逐条 confirm/refute 再往下走。tool 描述里明确告知 LLM「只有 checks 会被带到后续、text 不会」。起因：先读是对**本回合**的即时推演，整段带回去既占上下文（实测 turn 15 的 `Your notes` 已 1.9KB 且随对战增长），也可能把过时预判当既定事实；同时 battle66 中 LLM 的计划默认「对手下回合不行动」，故在 text 里加第 (5) 步强制按行动顺序推演到下次决策。

- [ ] **精简 system prompt 里的 `BATTLE_TIPS`（评估「何时」去掉「哪几条」）**：`BATTLE_TIPS` 是移植 PokeLLMon 的 always-on 提示（[prompts.js](po-pokellmon/prompts.js)，约 1.1KB，每回合都发），其中多条现在已被 tool / 知识库覆盖，属于重复的常驻上下文（systemPrompt 实测 ~3.8KB，而 tool 定义 ~19KB）。逐条候选 —— **去掉前必须先确认对应 tool 真被调用、且行为没退化**：
  - 「boost 换人清空」「换人当回合失去行动 + 对手先手 + 换入太慢会连吃两下」→ 已被 `get_knowledge` 的 `switch` 条目覆盖，且 WORKFLOW 要求换人前必查 `get_knowledge`（**优先候选，可先删这两句**）
  - 「撒钉策略（stickyweb/spikes/toxicspikes/stealthrock）」→ 已被 `get_move_info`（效果/威力）+ `get_knowledge`（毒菱等）+ `battle_tips`（下钉逼换）+ 0.3.58 新增的 may-fail 提示覆盖
  - 「你可以选择出招或换人」→ 行动列表本身已经说明
  - 条款（Sleep Clause / Self-KO Clause / Species Clause）→ 可考虑搬进 `get_knowledge` 新增的「条款」条目后再从 system prompt 去掉；注意 0.4.17 记录过「客户端拿不到 clause 掩码，所以固定写死」，搬走时要保证 LLM 真会查
  - **建议保留**：「对手强化时尽快 KO，必要时牺牲」——PokeLLMon 论文验证有效的核心启发（正对我们战报里「强化后误换人」），且不属于任何确定性知识、tool 推不出来；环境声明（Gen8 单打、无 Mega/Z/极巨化/钛晶）也保留（很短且每回合都要用）
  - **评估时机**：先跑若干局，看 LLM 是否稳定「先查 `get_knowledge`/`battle_tips` 再行动」；确认后**一次只删一条**，对比战报质量再决定继续删还是回滚。

- [x] **战术思路 tool（可无限扩充的战术知识库，避免 system prompt 膨胀）**（已做 battle_tips 基础：10 组队战术 + random_battle_playbook，可继续扩充条目）：把宝可梦对战的战术思路/打法套路做成可调用 tool，LLM 决策前按需查，而不是全塞进 system prompt（prompt 太长会稀释重点、增加 token 成本）。设计方向：一个 `get_tactic(name)` 或分类的 `list_tactics()` + `get_tactic(name)`，内容用结构化文本描述「触发条件 + 做法 + 目的 + 风险」。可塞的战术清单（持续扩充）：
  - 多换一击杀高威胁（牺牲换人节奏，换取先手击杀对手核心威胁）
  - 炮灰（送掉无用/低价值宝可梦，换取无伤换入王牌）
  - 下钉逼换（撒隐形岩/地钉/毒钉施压，逼对手换人被钉子惩罚）
  - U-Turn/Volt Switch/Flip Turn 转场（打一发 + 免费换人，保持节奏）
  - 先读 hard read（预判对手换入/守住，打针对招）
  - stall 消耗（通过回复/钉子/状态/属性盾慢慢磨血）
  - setup sweep（强化后推队）
  - 耗 PP（压力特性/替身耗招，把对手核心招 PP 耗尽）
  - 替保毒（替身 + 守住 + 剧毒，磨血拖回合）
  - 联防（队伍间属性抗性互补，反复换人分摊伤害）
  - …（持续扩充）
  - **战术条目必含字段**：① **Gen 适用度**——注明该战术在哪个世代强/弱（部分老战术如替保毒在 Gen5+ 因机制变化/快节奏被削弱，写入时须标注「Gen N 环境适用度」）② **案例**——举一个具体宝可梦怎么打（如「烈咬陆鲨 替保毒：替身躲技能→剧毒磨血→守住回 PP」）③ **代表性宝可梦/特性/招式**——列出该战术的典型载体（如耗 PP 常用压力特性、替保毒常用剧毒+守住+替身、联防常用钢盾+飞行盾等）。
  - 实现要点：战术描述要写成「什么时候该用、怎么用、什么时候别用」的可操作文本，而非泛泛而谈；与评估依据 tool（伤害/速度/克制）分工——评估 tool 给「事实」，战术 tool 给「思路」，决策权仍留给 LLM。战术库数据建议放 `po-pokellmon-tool/knowledge/tactics.json`（结构化，含 gen/案例/代表宝可梦字段），build 或手写维护。

- [ ] **评估依据 tool（移植+改造主脚本的评估逻辑）**：不做「返回结论」的决策 tool（会让 LLM 变传声筒），而是做「返回理由」的评估 tool，把主脚本里「为什么加/扣分、变化招适应度理由、属性/特性免疫、状态互斥」等确定性规则知识喂给 LLM，决策权仍留给 LLM。候选方向：
  - `evaluate_move(slot)`：属性克制、是否被属性/特性免疫、能力等级修正（为什么打不打得动）
  - `evaluate_status_move(slot)`：变化招适应度 + 理由（对手毒系/已异常→剧毒无效；对手已强化→要抢先；我方残血→睡觉价值高）
  - `evaluate_switch(slot)`：换人候选依据（抗性能不能扛、会不会被秒、输出够不够）
  - 优先级：硬事实（属性克制/免疫/状态互斥/招式效果）→ 半硬评估（伤害/速度/先手）→ 经验系数（最后）
  - 前置：种族值数据文件（`calc_damage` 需要）。具体实现等确定方向后再做。
  - **开工前先评估**：对战到底需要哪些 tool（数据→tool 映射见 [po-data/README.md](po-data/README.md)），列清单后再动手写 build 脚本，避免盲目堆 tool。
  - **初版 tool 清单（评估后暂定 3 个）**：
    1. **先后手评估**：双方招式先制度一致时判断先后手可能情况；并提示双方先制招式、改变速度的特性/场地/状态（雨速/叶绿素/拨沙/冲浪之尾/麻痹降速/顺风等）。
       - **部分已实现（2026-09-20，server 0.5.0 的 `simulate_turn`）**：① 任一方换人 → **不用比速度**（PO 换人阶段先于出招阶段），直接输出「你换→你的换入者吃招 / 它换→你的招打在它换入的那只 / 双方都换→无事」；② 双方出招 → 先比**先制度**（读 `moves.json` 的 `priority`），③ 同先制度 → 比速度：**我方精确**（从 `myStats` 的 ev/iv/nature/level 用 `effectiveStat` 现算，按已知道具补围巾 ×1.5），**对手只给区间**（31IV/0EV/降性格 ~ 31IV/252EV/升性格），输出「你先手 / 它先手 / 区间重叠，取决于对手 EV/性格」。实测 Weezing spe 219 vs Pelipper 149-251 → 输出"区间重叠"（诚实，但回答不了"我到底先手吗"）。
       - **仍未覆盖**：天气速度特性（雨速/叶绿素/拨沙/冲浪之尾）、麻痹降速、顺风、速度强化等级、对手未暴露的围巾、戏法空间。要真正回答"先后手"，需要把对手的**常见配速档**（如"防御型 0 速 / 满速"）作为显式档位输出，而不是一个宽区间。
    - **速度线相关触发/结算顺序（待实证，先记待定）**：除「同优先度技能按速度」外，还有若干跟速度相关的触发顺序需确认，当前 logs 无对应战报数据，待后续实战采样：
      - **入场/首发特性发动顺序**（威吓、天气特性、场地特性等）：理论上多个特性同时触发时按速度从高到低；PO 战报只记录威吓（已实证「换入 → 特性 → 技能」顺序，如 "Krookodile intimidates Rotom-Heat!"），但 logs 仅单方换入场景，无法实证「多个特性按速度」；天气/场地特性触发消息不走 onAbilityMessage（只能读 battle.data.field 结果）。
      - **灭亡之歌（Perish Song）倒计时到 0 的倒下先后**：是否按速度？logs 中 perish 出现 0 次，无数据，待实测。
      - **回合末结算顺序**（天气伤害/场地/状态伤害/剩饭/灭亡倒计时等）涉及双方时是否按速度——待实证。
      - **换人优先于所有技能**：换人先发生，然后技能按速度（已从威吓战报实证）。
    - **HP 比例取整规则（待确认）**：替身消耗 1/4 已确认向下取整（floor，如 404 HP → 101 HP 替身）；待确认腹鼓（Belly Drum）消耗 1/2、树果回复（如文柚果 1/4）等 HP 比例计算的取整方向（预期都是向下取整 floor，需按官方规则/实战确认）。
    2. **场上 pm 对场上 pm 用招评估**：评估我方场上 pm 对对手场上 pm 用某招式的效果，含伤害类（伤害范围/克制/命中）和变化类（强化/状态/场地）。
    3. **场上 pm 对换上 pm 用招评估**：假定一方换人时评估，我方招式对对手换入 pm 的效果；换入方无能力等级（stats 清零），且需接受入场结算（隐形岩/地钉/毒钉等）。
    4. ✅ **特性/道具/招式详情查询**（已做 get_ability_info/get_item_info/get_move_info）：`get_ability_info(name)` / `get_item_info(name)` / `get_move_info(name)` 返回特性/道具/招式具体效果文本（prompt 已放名字，详情按需查，供 LLM 判断免疫/强化/先制等机制）。依赖 po-data 的 `ability_desc.txt` / `item_effects*.txt` / `move_description.txt`（或 `move_effect.txt`）解析成 knowledge JSON（与 `po-pokellmon-tool/build-knowledge.js` 同源）。
    - **特性知识库按官方规则（PS），读取按 PO**：PO 会把效果相近的特性合并（实测 `17 Immunity/Pastel Veil`、`164 Teravolt`（Turboblaze 被并入，无独立编号）等），但官方规则里它们是不同特性。`get_ability_info` 的**描述/效果文本按官方规则（PS）写、区分合并的特性**；**特性读取/编号仍按 PO**（对接 PO 的 `state.ability` 编号）。
    5. ✅ **move 的 tag 信息（不止 description）**（已做 get_move_info 暴露 tag）：招式除描述文字外还有 tag 类属性——声音类 `voice`、接触类 `touch`、铁拳 `ironFist`、鲁莽 `reckless`、强壮之颚 `strongJaw`、超级发射器 `megaLauncher`、先制 `priority` 等，已在 [movedata.json](movedata.json) 整理好。`get_move_info` 应一并暴露这些 tag（如「接触类会被鲨鱼皮/静电/火焰之躯反伤」「声音类被隔音免疫」），后续优先关注。
    6. 🟡 **特性推断（可能特性列表 + 触发/未触发提示）**（正向解析+入场反向排除已做，交 LLM 排除待做）：让 LLM 能读一只 PM 的**可能特性列表**（`pokes/ability1/2/3.txt` 给出每只 PM 的三个特性槽位），并重点标注「哪些特性触发后战报会有提示」（数据源 `abilities/ability_messages.txt`）。核心是**双向推断**：不仅「触发 → 确定是这个特性」，还有「未见触发 → 排除这个特性」（如对面未触发威吓→排除威吓；未触发静电→排除静电）。这比静态读特性文本更高阶，接入时让 LLM 在「已触发提示 vs 未触发提示」之间做排除式推断。
    - **已实现（po-script 0.6.0）**：正向解析（pklmAnalyseAbility 移植主脚本 switch-case）+ 入场必触发特性反向排除（17 个：威吓/天气/场地/下载/复制/察觉/压迫感/破格/不挠之剑/不屈之盾等，换入后没触发特性消息则从 possible 排除）。
    - **后续（交 LLM 排除）**：更复杂的反向排除（被攻击/回合末/免疫类特性「该触发但没触发」）系统硬编码做不彻底，后续通过 prompt 引导 LLM 用 get_ability_info 的 signal（触发时机+判断方式）自行排除，而不是系统全做。

- [ ] **天气伤害判定 tool（来自 battle55 的 submit_feedback）**：LLM 想要一个能明确报告「对手某只宝可梦本回合是否吃到沙暴/冰雹等天气掉血」的 tool，用来从战报确认 Magic Guard / Unaware（是否免疫间接伤害）之类的特性。现状：只能靠 `get_battle_history` 逐回合扫天气/掉血行。方案：po-script 侧在回合末记录「天气伤害事件」（哪个 slot 掉了多少 HP），存进 history 或独立字段，供 tool 直接查询/汇总。

- [x] **battle97 复盘（LLM 打吧服 BOT，胜；19 决策 / script 0.6.11 / server 0.5.5——门禁+simulate_turn 首次实战）**：
  - 结果：**胜**（`result=1 / winner=0`）。**平均 48s / 中位 39s / 最长 106s** —— 没有逼近 `TIMEOUT_MS=240s`（之前担心的长决策这局没出现）。
  - `simulate_turn` 共 **25 次 / 19 决策 = 1.32 次每决策**（比 eval fixture 的 2.2-6.8 省得多）；`save_strategy` 被拒 5 次（都是缺 `action/branch/outcome` 的格式问题）；最终闸门打回 2 次；**`gateUnmet` / `gateBypassed` 均 0（没有逃逸）**。
  - **变化招 `status_move_note` 基本被理会**：31 行变化招分支里 **25 行被 strategy 明确提及（81%）**；未提及的 6 行**全在 T13**，而 T13 是 `Slowbro@14%`「反正要死」的局面（忽略强化招合理，WORKFLOW 明确鼓励"每条线都要死时选最有价值的"）。
  - 典型：T0 写「or sets **Trick Room/Wish**」、T1 写「likely continues setting up (**Calm Mind**)」、T2 写「**Roost**/Brave Bird/Defog each possible」—— 都提到了。
  - ⚠ 教训（我方工具踩坑）：第一版统计脚本因为**在 toolLog 里先遇到 `simulate_turn` 后遇到 `save_strategy`**，读 strategy 时还是 null，把结果误算成"30/31 未提及"。**跨 tool 的统计必须两遍扫（先收全、再判断）**。
  - 【已做】本局结束后 8092 已切到 **0.5.8**（`/version` 确认）。

- [x] 🟢 **"默认值制造自信错误数字"的两处（battle98 发现，0.6.0 已修）**：
  - **打落漏掉道具加成**：`@smogon/calc` 本来就会算 ×1.5（实测无道具 70-83% → 有道具 105-124%），但模型没填对手道具（`state.opp.itemInferred=null` 是"**未暴露**"不是"没道具"）→ 把可能的 OHKO 读成"打不死"。修法（用户定：**两个值都给**）：目标道具未知时 `item_note` 同时给出「有道具/无道具」两个值；已知则只给一个（`sideItemKnown`，并去掉两值相同的冗余）。
  - **对手 EV 默认 0 的方向是危险的**：在「它打我」方向**低估**（Amoonguss 打 Crawdaunt 0EV 95-113% vs 252SpA+Modest 135-160% → 把"必杀"读成"有几率活"）；在「我打它」方向反而高估。修法（用户定：**攻击方给两锚点**）：对手当攻击方且未传 `assume` 时，除 0EV 外再给「252 + 升性格」锚点（`ev_note` + `mine.hp_after_max_investment`），且 `faints` **保守化**（取两个锚点里更坏的）。
  - 关键认知：**这两处误差方向相反、会部分抵消**（T0 那个 70-83% 既不是上界也不是下界，纯属巧合）→ 所以正确做法是**把两个值都摆出来**，而不是挑一个"看起来合理"的默认。

- [ ] 🟡 **诊断盲区：失败/重试只进 stdout，不落盘（battle98 T11 的 663s 因此无法定因）**：`attempt()` 里的 `[choice] fail …ms (…), retry n/3 in Xms` 全是 `console.log`；**日志文件只在结尾写 entry，且 entry 里没有 attempts/retries 字段**。所以事后**无法区分**"一个请求吐了 600s"还是"240s 超时 × 重试 2 次"（后者最坏 ≈ 3×240s）。修法：启动时把 stdout 落盘（`node server.js *> logs/server-console.log`），并考虑把 attempts/每轮 error 写进 entry。
- [ ] 🟡 **不检查 `finish_reason`（截断无声）**：`MAX_TOKENS = null` → **不发 `max_tokens`**（用服务端默认）；且[代码里完全没有读 `finish_reason`](file:///smartstorage/PC-3002847099/SD/github/Battle%20AI/pokemon-battle-ai/po-pokellmon-tool/server.js) → 响应若被 token 上限截断，只会表现为"`parseAction` 失败 → `fallbackAction('parse_failed')`"，**无法与"模型乱答"区分**（用户 2026-09-20 提问）。修法：读 `finish_reason === 'length'` → 降级 no-think 重试，或至少标进 entry。
- [ ] 🟡 **要不要启用 `MAX_TURN_MS`（整回合上限）—— 待定**：`MAX_TURN_MS = 0` 意味着现在**整回合没有任何时长上限**（`server.js` 里"快到点就 no-think 收尾"的分支写着但被禁用）。2026-09-20 battle98 T11 卡死 637s 就是没东西掐它。已修的是**单请求 240s 硬墙钟**（0.6.1，原来 `req.setTimeout` 是空闲超时根本不触发）；但最坏情况仍是 `MAX_TOOL_ROUNDS(35) × 240s`，而且**超时后会重试 3 次**（2s/5s 延迟，第 3 次 no-think）→ 单轮最坏 ≈ 3×240s。**真正能封顶的做法：把「剩余预算」传进 `callDS`，硬超时取 `min(TIMEOUT_MS, 剩余预算)`**，这样无论重试几次整回合都不会超上限。

- [ ] 🟡 **`save_strategy.text` 退化成占位符（battle97 T13 实测）**：那一回合模型把 `text` 写成 **26 字符的 `"(placeholder filled above)"`**，门禁放过了它（门禁有意只校验 `action/branch/outcome` 一致性，不评价 text 质量）。影响：`text` 不回灌 → 对**当前**决策影响有限，但它是**复盘与我们迭代的主要证据来源**，退化会让我们看不到它的推演；同回合还伴随"3 个变化招分支未在 text 提及"，**两者可能同源**（该回合整体输出质量下降）。候选修法：`save_strategy` 对 `text` 做**长度 + 占位符检测**（过短或含 placeholder → 返回 warning，只提醒不拦）。

- [x] **battle94 复盘（LLM 打吧服 BOT，胜；29 决策 / 25 分钟 / script 0.6.10 / server 0.4.11）**：
  - 结果：**胜**（`09:16:04 started → 09:41:25 won against`）。`0 fallback`、`0 攻击方被覆盖`。**平均 47s / 最长 218s**（逼近 `TIMEOUT_MS=240s`，值得盯）；29 个决策里 4 个带 `bannedMoves`（=发生了 PO 拒绝→重决策）。
  - 已修（**0.6.11，用户发现「T21 为什么点暗影球」**）：**被拒槽位跨宝可梦串味** —— `pklmBannedSlots` 存的是**槽位号**，而 `pklmIsMoveDisabled(m)` 只按槽位过滤**当前场上**这只的招。实测链路（T20）：Rotom-Wash 的 **Volt Switch（slot 0）**被 PO 拒（专爱锁招）→ ban 槽位 0 → 同回合换上 Oranguru，它的 **Psychic 也是 slot 0** → 被误过滤 → prompt 只剩 `Focus Blast / Trick / Shadow Ball` → LLM 只好打 **Shadow Ball（46-55，14%）**；而正解 **Psychic（78-93，23-28%）根本没出现在选项里**（CAUTION 还按当前宝可梦解析槽位号，把这次拒绝渲染成「Psychic 被拒」）。修：我方 `onSendOut`（换人）/`onKo`（倒下补位）时清空 ban 列表 —— 被拒本质是「这只宝可梦的这个槽位不可用」，换人后不适用。
  - 已评估不改（T6：「围巾被 Trick 换走后点水炮/被拒」）：**Trick 换走道具后 `state.me.item` 读成空** → 专爱锁招的**正向**检测（`item ∈ {4,5,6}`）失效 → LLM 看到 4 个招都能点 → 点了被锁的 Volt Switch → 被 PO 拒 → 重决策（46s + 45s）。**用户判断：不修** —— ① 多烧一轮影响有限；② 跨回合保留 ban 列表反而会在道具被换走后变成错误信息；③ 现在这套（被拒→ban 该槽位→重决策）与主脚本 `disabledAttackSlot`（每回合 `resetCommandStatus` 清空 + `checkDisabled` 累积）语义一致，符合既定设计。
  - 待观察：**218s 的单次决策**（29 个决策里最长）离 240s 上限只差 22s —— 是偶发还是「多轮 tool + 长思考」的常态？若常态需考虑压 `MAX_TOOL_ROUNDS` 或给关键回合单独设上限。
  - **[x] 待部署项已解决（2026-09-20 核实）**：0.6.11 **已进 PO** —— battle96 实战日志实测 `scriptVersion=0.6.11`（该局 33 回合、`result=1/winner=0` 胜）。8092 也已推进到 **0.5.3**（`max_tool_rounds=35`、tools 含 `simulate_turn`、worklog 关）。battle94 的残留对战窗口已关。

- [x] **battle93 复盘（LLM 打吧服 BOT，胜 6-0；14 回合 / 8 分钟 / script 0.6.10 / server 0.4.10→0.4.11）**：
  - 结果：**胜且零封**（`08:37:45 started → 08:45:43 won`；我方 0 折、对手 6 折）。`0 fallback`；平均 28s / 最长 77s（比前两局快）。**这一局是「重贴 0.6.10 + 重启 8092」之后的第一次实战，日志逐回合确认 `script=0.6.10 / server=0.4.10`** ✓
  - 已修（0.4.11，本局发现）：① **`from_state:'me'` + 显式点名后备宝可梦 → 算错对象**（T1：它写 `{from_state:'me', poke:'Tapu Koko'}` 想算「换上 Tapu Koko 打」，而 'me' 是场上 Toxapex → 被「系统为准」覆盖成 Toxapex，算出 Toxapex 的招）→ 改为**按名字反查槽位**（我方 myStats/bench、对手已亮相 oppTeam），命中即解析成 `me:1`/`opp:4` 并记进 `inputs_used.slot_resolved_by_name`。② 特性写成 **`"Protean/Libero"`** → 计算器不认 → `normalizeDexName` 拆开取能识别的那个（特性/道具通用），真拼错仍报 not recognised。
  - **未被验证**：0.6.9 的能力等级残留修复这局没机会生效（**全程双方 `boosts` 都是空**，没有任何强化/降能力）→ 留待下一局出现强化时核对。
  - 待观察：同名不同形态仍按「不同」处理（本局它写 `Magearna` 而 PO 叫 `Magearna-Original` → 名字反查/填充都跳过，**方向安全**但少拿信息）；若这类误伤变多，再考虑加「形态后缀」归一化。

- [x] **battle92 复盘（LLM 打吧服 BOT，胜；20 回合 / 19.5 分钟 / script 0.6.8 / server 0.4.10）**：
  - 结果：**胜**（`01:08:34 started → 01:28:00 won against [Lv0.吧服BOT]清分少女`）；**我方折 3（Steelix T6 / Conkeldurr T9 与 Vaporeon 对掉 / Excadrill T14）**，对手折 6 —— 这局比 battle91（0 折）更接近均势，有参考价值。`0 fallback`、`0 工具轮次用尽`、`0 个 not recognised`、**攻击方被 state 覆盖 0 次**（0.4.9 的坑没再出现 ✓）。耗时均值 52s / 最长 157s（T12）。
  - 已修（**0.6.9，从这局日志里抓到的真 bug**）：**换人当回合 PO 的 `field.poke().statBoost()` 残留换下那只的能力等级** —— 对手 Silvally-Fairy 剑舞 Atk+2 后被换下，换上来的 Duraludon 读到 `Boosts:[Atk+2]`（假），prompt 与 `calc_damage` 的 `from_state` 都吃到了它（会把对手伤害高估 ~1.5 倍）。**是 LLM 自己看出来的**（Duraludon 笔记：「the "Atk+2" in state was stale from Silvally's Swords Dance, which boosts reset on switch per 换人 rule」），但系统不该递错数据。修法：`onSendOut` 给该侧置位 `pklmBoostsReset`、`onBeginTurn` 清除，置位期间 boosts 一律报 0（`pklmCollectBoosts` 是唯一的 statBoost 读取点，state/prompt/history 三处同时修）。**要重贴 po-script.js 才生效。**
  - 质量亮点：① **证明链完整**用 `[proved]` 标注来源 —— Vaporeon 的 Leftovers「**proved**（restored HP end of turn 7）」（0.6.8 的道具消息推断生效）、Slurpuff 的 Assault Vest「**proved**（knocked off turn 3 by Scrafty's Knock Off）」→ 顺带证明 T2 那次 Knock Off 是有价值的；② 速度推断靠**行动顺序**：「Vaporeon moved FIRST (Scald before my Thunder Punch), so Vaporeon outspeeds Conkeldurr」、「Excadrill moved SECOND… confirmed Excadrill outspeeds」；③ **极细的机制理解**：「Thunder Punch dealt 95% — **Guts burn NOT yet active when hit**（burn applied same turn as Thunder Punch, so Guts had not kicked in yet）」；④ `submit_feedback` **首次被调用**（T3：「the Steelix switch is clearly optimal…」）—— 内容是自我核对而非系统反馈，说明这个 tool 的定位可以再想。
  - 待办：① ~~单侧 from_state~~ **已评估：不改**（见下）② 折 3 只的两个节点（T6 Steelix 站场吃死、T9 Conkeldurr 与 Vaporeon 对掉）值得回看是否有更优解。③ 157s 的长决策（T12）是否要压。
  - **「只写一侧 from_state」评估结论（2026-09-20，不改）**：这局 24/61 个 leg 只写一侧。实测三种单侧写法（只写攻击方 / 只写防守方 / 一侧显式写了**另一只**宝可梦）**都不报错**、语义也正确 —— 缺失侧默认取**对侧**、只补空缺不覆盖显式值、显式命名与 state 当前这只不同时**整侧不填**，并在 `inputs_used` 里给 `attacker_asked`/`defender_asked` + 一句 note。**唯一会报错的**是填不出来的槽位（`me:9` 越界 / `opp:5` 未亮相 / run_js 沙箱无 state）。所以「有害」的那一半（攻击方被 state.me 顶掉 → 自己打自己）0.4.9 已经修掉，剩下的只是「它少拿一点信息」，且 note 已经把推断来源写明。tool 描述里已加过一句「两侧都写最干净」，**再堆字不划算** → 记录结论，不做。

- [x] **battle91 复盘（LLM 打吧服 BOT，胜；17 回合 / 15 分钟 / script 0.6.8 / server 0.4.8→0.4.10）**：
  - 结果：**胜**（`00:36:14 started → 00:51:29 「木偶」析构万理的发条公主 won against [Lv0.吧服BOT]清分少女`；末状态我方 0 倒、对手 5 倒；最后 T16 Scizor 29% vs Chansey 40%，用 +1 先制 Bullet Punch 收尾）。**0 fallback、0 工具轮次用尽、0 个「名字 not recognised」**。耗时 16-102s/决策（均值 ~45s，最慢 T11 102s）。
  - 工具画像（19 决策）：update_worklog 27 / get_type_matchup 26 / calc_damage 31（80 leg）/ save_strategy 19 / get_battle_history 17 / get_my_stats 16 / get_pokemon_info 14 / save_observation 8 / get_knowledge 5 / calc_stats 5 / run_js 3 / get_observation 4 / get_strategy 2 / get_move_info 2 / battle_tips 1 / get_ability_info 1；**get_item_info 0 次**。
  - 已修（0.4.9，**实盘日志当场发现**）：**「只给一侧写 `from_state` 时，另一侧被静默当成 me」** —— LLM 用 `attacker:{poke:'Tapu Bulu', ev:…, nature:…}` + `defender:{from_state:'me'}` 算「对手打我」，旧代码把没写 from_state 的攻击侧默认成 `me` → 用 `state.me` 覆盖掉它写的 `Tapu Bulu`，算出「Scizor 木槌打 Scizor 14-17%」（真值 29-34%），而 `inputs_used` 里其实明写着 `OVERRIDES your value "Tapu Bulu"`（LLM 不读）。修：缺失的一侧取**对侧** + 只补空缺（`keepExplicitSide`），且显式命名的宝可梦与 state 当前这只不同时整侧不填。回归 from_state 8/8。
    - **影响面量化**：80 个 leg 里 **14 个**出现「攻击方被 state 覆盖」（T1 4/9、T2 7/9、T4 3/17）—— 即 T1/T2 它算「对手这发打我最痛多少」时全在拿自己的数值算。有趣的是 **T3 之后它自己换成了 `attacker.from_state:'me'` + 显式 defender 的写法**（好方向），所以后面 42 个「单侧 from_state」leg 只有 3 个踩坑。且**这局是在带 bug 的情况下赢的**（它没盲信那些数字 / 决策余量够）。
  - 已修（0.4.10，核对「打小蛋」时发现）：**固定伤害招 KO 误报** —— 地球上投/黑夜魔影（=等级）、龙之怒 40、音爆 20 这类招，@smogon/calc 的 `res.damage` 是**数字**不是数组 → 旧代码 `perHit` 成空数组 → `koVerdict` 里 `0 === 0` 命中 → 一律返回「guaranteed OHKO」（地球上投 100 打 291 血=34% 被说成必杀）。同时把「返回 0」拆成**真免疫** vs **算不出**（Super Fang/Counter/Endeavor…），并把 `variable_power` 提示按三类分说。回归：新增「固定伤害招 5/5」。
  - **核对结论（用户提问：进化辉石 / 地球上投算没算）**：① **进化辉石它算对了** —— T5/T6/T11/T12 自己填 `item:"Eviolite"` + 252HP/252Def 大胆 + `hp:704`（正确的 Chansey 满血值），`applied.defenderItem:"Eviolite"`，并在笔记里标注「Likely Eviolite **[estimated]** … Item unrevealed but Eviolite is standard」；② **地球上投它没调计算器**，全程靠自己的知识写「Seismic Toss ~100 fixed」（Chansey 笔记里写 "Seismic Toss does 100 fixed, which OHKOs my Scizor at 29% (~90 HP)"，**手算正确**）—— 但它要是调了，旧代码会回一个错到离谱的「必杀」。
  - 质量亮点（笔记摘录）：从一发**暴击**反推对手配置 ——「Crit Wood Hammer did 157 to Scizor → implies 252+ Atk (~394 Atk) [estimated]」，并维护速度线表（`Speed:186(0Spe Adamant)·…`、Rotom-Mow「<442 unless Choice Scarf」）；Keldeo 那条写「它所有可能的招对我 Moltres-G 都是 2HKO 而**不是** OHKO → 站场反击是安全的」，然后真的站场打；T15/T16 的 6 步推演里明确否掉 Roost（"a losing stall loop"）改用先制收尾。
  - TODO（本局暴露、未做）：① 对手**道具全靠 LLM 自己填**（Eviolite 从未被消息暴露）—— 系统层 `itemInferred` 只在「文本写着道具名」时才有；是否给 prompt 加「对手常见道具」提示或做个 tool？（`get_item_info` 这局 0 次调用，反过来说明它不缺这个信息）② `save_observation` 只覆盖了 4 只（Tapu Bulu/Keldeo/Chansey/Rotom-Mow），Charizard/Kyurem 没记 —— 要不要在 prompt 里要求「新登场的对手都记一条」？（注意别堆太多指令）③ 平均 45s/决策偏慢，服务型 BOT 场景是否可接受。

- [ ] **battle71 复盘（LLM vs 用户，42 回合；tool 0.4.2 / script 0.6.4）**：
  - 已处理（0.4.1）：① **直传能力值被 @smogon/calc 的 `calculate()`→`clone()` 静默丢弃（真 bug）** ② **直传值 + `boosts` 的语义**（直传值按「未加成数值」处理，等级应照常生效；旧语义把等级清零 → Body Press 少算 2.5 倍）③ 知识库补 `mechanics.unaware`（天然 vs 辅助力量/扑击）。
  - 已处理（0.4.2）：④ **`psAbilityExists`/`psItemExists` 用错数据结构**（`SMOGON.ABILITIES`/`ITEMS` 是数组，按名字索引永远 miss）→ 0.4.0 起对**每个**特性/道具误报「拼错、未生效」，LLM 因此不信任 Unaware/Transistor；改用 `Generations.get(8).abilities/items.get(id)` ⑤ **特性描述 data bug**：`DESC_OVERRIDE` 把 Transistor/Dragon's Maw 写成 Gen9 的 30%（Gen8 是 50%）→ LLM 照着推出 1.3x 与计算器的 1.5x 打架；`ability_battledesc.txt` 按编号取、PO 删特性后**整体串行**（35/50/118/131/132/163 全张冠李戴）→ 新增 `DESC_EN_OVERRIDE`；补 Steelworker 数值、Water Bubble 漏的攻击向 ⑥ 新护栏：`move.name`+`move.power` 同时给且不一致 → 提示 power 被忽略；按等级算威力的招式没传 `boosts` → 提示会按 20 BP 算。
  - [ ] **天气扣血采集（本次 T12 误判的直接原因）**：LLM 用「沙暴在场却没掉血」推 Magic Guard 并声称排除 Unaware —— 但**我们根本没采集天气扣血**（决定性证据：T13 Mew（超能，非免疫）在沙暴下只记录了月亮之力的 180，没有任何沙暴掉血行；`po-script.js` 只挂 `onStatusDamage`，而 PO 的该回调只在**状态异常**掉血时触发，主脚本 20201227.js 里也完全没有天气伤害处理）。
    - **降级已落地（0.4.3）**：知识库补 `mechanics.weather_chip`，明确「战报不采集天气回合末伤害 → 『没掉血』是没有数据、不是证据，不能用它推断 Magic Guard / 天然 / 魔法防守」，并提醒「天气期间血量不能按招式伤害±剩饭倒推」。
    - **探针已备好（待你实测）**：`po-pokellmon/probe-weather.js` —— 独立小脚本（**替换** po-script.js 贴一次），把 28 个回调全部打点 + 每个 `onBeginTurn` dump 双方全队 HP。打一局有沙暴/冰雹的对战 5-8 回合，把 `[PROBE]` 行贴回来即可判断：① 回合末到底有没有任何回调触发 ② 两次 `onBeginTurn` 之间的 HP 差值能否读出「天气那一份」。
    - 若探针也拿不到 → 走退路：在回合末对比双方 `hpPct` 快照 + 已知天气/属性/特性，把「天气扣血事件」补进 history（顺带覆盖其它未记录的间接伤害）。注：这条同时是 battle55 那条「天气伤害判定 tool」的同一个坑。
    - **探针已升级 + 部分结论（battle72 晴天/无天局）**：探针现带 ① 自增序号 `#n`（PO 文本控件会折叠连续相同行，粘贴会丢重复行）② `player=ME/OPP` 标注（`onChoiceSelection` 每回合触发**两次** = 一次我方一次对手，**不是 bug**，生产脚本有 `player !== battle.me` 守卫）③ 每只的 `status/item/ability` ④ 回合间 HP 差值 `Δ`（按**槽位**索引 —— 换人后 Δ 会失真，需连同宝可梦名一起看）⑤ `FIELD` 行原始值探测 ⑥ `/probe`、`/eval <表达式>` 交互命令。**已验证 `Δ` 审计法成立**：T15 电灯怪 306 → 255 = −51，恰好 = Scald −51 + 剩饭 +24 − 烧伤 24，**报告的事件能完整解释 Δ** → 沙暴局里若出现「没被打却掉约 6.25% 且无回调」，即证明天气扣血只能靠差值补。**仍缺一局沙暴/冰雹实测**（晴天无回合末扣血，是空对照）。
    - 顺带确认：`onStatusDamage` 会为中毒/烧伤触发（`status=5/4`），而**中毒/烧伤伤害不产生 `onDamageDone`**（该回调只记招式伤害，参数是**百分比**）；`onMajorStatusChange status=31` 会在**倒下**时触发（在 `onKo` 之前）；`onEffectiveness` 的取值是**倍率 ×4**（0 免疫 / 1、2 = 0.25x、0.5x / 4 = 1x / 8、16 = 2x、4x）——**三局下来每一发都对上，等于 PO 免费给出真实倍率**（可用来校验我们自己的克制表，甚至记进 history）；多段招式（Double Iron Bash）**每段一次 `onDamageDone`**；替身消息 `move=128 part=4`（造出）/`part=1`（被打掉）；`onMiss` 的 spot = **攻击方**（我们写 "X's attack missed" 正确）、`onCriticalHit spot` = 被暴击方（我们只写 "A critical hit!"，无歧义 ✓）。
    - [x] **天气扣血实测结论（冰雹局，已实锤；探针任务完成）**：`鳃鱼海兽 used Hail!` → `weather=1` ✓，随后每回合末 `The hail crashes down. / The foe's 迭失棺 is buffeted by the hail!` —— **扣血那一刻零回调**（前后只有攻击的 `onDamageDone` 和我方/对手剩饭的 `onItemMessage`，中间没有任何 `[PROBE]` 行）。故：**天气扣血既没有回调、也不走 `onStatusDamage`** → 无法直接采集。
    - **差值法（残差审计）能做到什么**：我方 HP 是**精确值**，实测 Δ 完全可解释（鹹鱼海兽 317 → 160 = Body Press −176 + 剩饭 +19 ✓，且冰系不受冰雹伤害 ✓）→ 我方侧可靠。对手侧有两个坑：① HP 是 `/100` **百分比取整**；② **剩饭/黑泥与冰雹/沙暴都是 1/16 → 对持有者完全抵消**（本局对手迭失棺正是 `67/100 → 67/100 Δ=0`，掩盖得干干净净）。→ 结论：残差审计只在「该回合其他项都知道、且扣血没被 1/16 回复项抵消」时有效。
    - 顺带：本局对手剩饭消息 `onItemMessage spot=OPP item=12` 的文本含 "Leftovers" → **0.6.8 的文本推断生效**，`itemInferred` 能正确记成 Leftovers（旧代码会记 `(No Item)`）。
    - [x] **`battle.data.field.terrain` 能读，之前判定「读不到」是被「无场地时的未初始化值」骗了（第四、五局实锤，问题关闭）**：`卡璞・哞哞's Grassy Surge makes the grass grow to cover the battlefield!` 之后，`terrain` 从 `566823768` 变成干净的 **`2`**（`str=2`、`typeof number`）→ **有场地时就是 1-4 的正常编号**（`2=青草`，与主脚本 L2449-2455 的 `1=电气 2=青草 3=薄雾 4=精神` 一致，`pklmTerrainName()` 早就写对了）。**完整生命周期已实测**：T10 末 `Grassy Surge` 起 → `terrain=2` 持续 T11-T15 共 5 回合 → T15 末 `The grass disappeared from the battlefield!` → **`terrain=0`**（`str=0`），此后整局都是 0。→ 最终语义：**`1-4` = 有场地；`0` = 场地已过期/无；初始未初始化的大数（`566823768`/`-795540743`）= 本局还没出现过场地**。三者都落进「只认 1-4」的白名单 → 现有写法完全正确，**不需要降级、也不需要消息侧重建**（`Terrain:None` 不是假话）。顺带两条：① **起场地/终止场地都没有回调**（`Grassy Surge` 与 `The grass disappeared` 前后都没有 `onAbilityMessage`/`onMoveMessage`，只有文本 —— 与 `Drizzle` 同类）→ 直读 `field.terrain` 是唯一可靠来源；② **青草场地的回血有回调**（`The Grassy Terrain heals the Pokemon on the field!` → `onMoveMessage move=205 part=2`，`205` 是 `move_message.txt` 的消息 id，part 0/1/2 = 长出/消失/回血）—— 和天气扣血（零回调）不同，这条 HP 变化**能对账**。
    - [x] **顺带修一个真 bug（tool 0.4.8）：场地/天气「带后缀的全名」静默不生效** —— `calc_damage` 的名字归一化只认 PS 短名（`Grassy` / `Harsh Sunshine`），而 `state.terrain` / `state.weather` 产出的却是 **`Grassy Terrain` / `Harsh Sunlight`** 这种全名 → `from_state` 自动填的场地/天气**整份修正被静默丢掉**（实测 木槌 710-836 → 546-644，少了青草场地 ×1.5；`Harsh Sunlight` 同样不生效）。修：别名表补全名/中文（`grassy terrain`、`青草场地`、`harsh sunlight`、`大晴天`、`沙暴`…）+ 新增「传了却不被识别」的 notes 提示（与特性/道具拼写提示同类，专治这类静默失效）。回归：`test-calc-compare.js` 新增「场地/天气名称归一化 12/12」。对照：`weather` 是普通数字且动态可靠（1 冰雹 2 雨 3 沙暴 4 晴，雨天局实测 起雨=2 / 雨停=0 / 再起=2 ✓）。
    - 已修（script 0.6.8）：**对手道具恒读成 `"(No Item)"` 是真 bug** —— 实测即使对手剩饭消息已触发，`team(opp).poke(0).item` 仍恒为 0（`sys.item(0)="(No Item)"`），旧代码会把它当「已推断出的道具」存进 `opp.itemInferred` → 经 `from_state` 喂给计算器。现改为从**消息文本**认道具名（`PKLM_ITEM_HINTS` 31 项受控清单），`%i` 读不到时渲染成 `[item hidden by PO]`。
    - [x] ✅ **（script 0.6.16）「berry 消息的 `%i` 仍是隐藏态」已解决** —— 当时判断「berry 名不在文本里」是**错的**：实测 `onItemMessage` 的 `berry` 参数**就是树果的道具编号**（`8015` = Iapapa Berry，`sys.item()` 直接可读），`item` 参数是**树果消息号 + 8000**（8000→`%s ate its %i!`、8006→`%s restored some HP!`）。旧代码把 `berry` 当消息号查表 → 永远 `txt:null`。现在树果名与文本都正常，且**树果一响即登记道具消耗**（对手侧 `itemInferred` 不再挂着已被吃掉的果子）。
    - [x] ✅ **（script 0.6.16）消耗型道具（红牌/逃脱按钮/气息腰带/白药草…）终于会清对手道具** —— 依据 `po-data/items/item_messages.txt` 建了「一次性消耗」白名单（3/5/7/11/18/38/39/40/43/71/74/75/76/77 + 气球 part0），触发即 `pklmItemLose`；**不消耗的**（剩饭/命玉/黑泥/快爪/火珠毒珠/贝壳铃/附着针/粗糙头盔/气息头巾/宿命绳/安全护目镜/万能伞/厚底靴）不在表内。在此之前对手用掉气息腰带后我们仍会一直按「它还有 Focus Sash」算血量与打落加成。
  - [x] **`from_state`：系统直接塞场上参数（用户提案，0.6.6 script / 0.4.4 tool）**：`calc_damage` 支持 `attacker:{from_state:"me"}` / `defender:{from_state:"opp"}` → 我方用 state 硬数据（等级/EV/IV/性格/boosts/道具/特性/HP%）、对手只用已暴露信息（boosts/HP%/状态/`abilityInferred`/`itemInferred`），并回显 `detail.inputs_used`（值 + 来源）；对手特性未解析时明确写 `NOT applied — candidates: …`。同时补了**双墙采集**（`move_message` 73/236 跟踪 → `state.screens`）与**对手道具已暴露记录**（`opp.itemInferred`），prompt 场地行加双墙。**顺带修真 bug**：`state.me.boosts` 是 `["Def+3","SpA-3"]` 字符串数组，之前直传计算器会静默丢掉全部强化（辅助力量又变 20 BP）→ 统一 `parseStateBoosts()` 转换。**注意：本次改了 po-script.js（0.6.6），需要重贴。**
  - [ ] **特性描述「Gen8 口径」系统审计**：PO 的中文描述来自较新版本（已发现 Transistor/Dragon's Maw 的 30% vs Gen8 的 50%），英文描述表按编号取且**整体串行**（已修 6 条但没做全量核对）。方向：拿计算器的 Gen8 行为（`mechanics/gen789.js` 的倍率）+ PS Gen8 官方文案，逐条核对带数值的特性描述（重点：`Huge Power/Pure Power`、`Guts`、`Transistor`、`Dragon's Maw`、`Steelworker`、`Rocky Payload`、`Water Bubble`、`Tough Claws`、`Strong Jaw`、`Mega Launcher`、`Iron Fist`、`Reckless`、`Adaptability`、`Technician` 等），并把结果写成可回归的断言（像本次的「特性描述 Gen8 口径 8/8」）。
  - [x] **决策摇摆（T11→T12 连续换人）**：T11 换 Hippowdon 时**明确否掉过「换 Mew」**（理由：更被动、不解决 Regieleki），T12 立刻以「Mew 是这只皮可西的硬解」为由又换 Mew —— 中间零新信息（只白吃一发月爆），白丢一回合 + Hippowdon 白吃 163 HP。**用户决定先不改 prompt**（「堆的太多也可能会有问题」），故只记录、不加提示。
  - [x] **tool 轮次打满 → 强制 fallback，且动作与自述结论不一致（已修 0.4.3）**：T38 用满 25 轮（201s）被 `tool_rounds_exceeded` 收尾 —— 旧 `fallbackAction` 直接返回**招式列表第 1 项**（`state.me.moves[0]`），**完全不看 LLM 已写下的结论**（它 reply 写「Decision: Roost」，落子却是 Cosmic Power）。现改为：追加「工具轮次用尽，立刻只输出最终 JSON」→ `finalizeNoThink()`（关思考、不再执行 tool）→ 解析失败才 fallback（reason 带 `tool_rounds_exceeded_*`）。
  - [x] **日志重放回归工具（新增 0.4.3）**：`po-pokellmon-tool/replay.js` —— 用日志里的 `state` 请求 `/choice`，用「现在的代码/prompt/知识」重跑历史回合，验证老问题是否解决。`--list` 先看清单，`--tag` 把新决策写到隔离日志避免污染原文件。实测 battle71 T12 重放成功（同动作/8 轮/63s；重放后它的观察措辞从「Magic Guard confirmed [proved]」变成「likely Magic Guard … **or Unaware**」，checks 里也写了「if not, Magic Guard **or it took sand damage quietly**」——注意单次重放有采样噪声，只能看「推理/工具调用是否变化」，不能当确定性对照）。下一步可用它系统回归：T12（错误能力结论）、T22/T28（辅助力量=20BP）、T38（轮次打满）。
  - [ ] **LLM 反馈必须逐条核对**：`submit_feedback` 两条 —— T36「Body Press 直传 def 被忽略」= **真 bug**（已修）；T38「辅助力量应按**净**等级算（+3 → 80 BP）」= **误报**（官方规则只数**正向**等级，BP 140 正确；它观测到 32% 是因为把 Regieleki 当 0 HP EV 而实际有血量投入）。不能把反馈直接当需求。
  - 过程事实（用于后续 prompt 设计）：T12 用「沙暴无伤」推 Magic Guard 并**声称排除 Unaware**，T13 记成「Magic Guard confirmed [proved]」，直到 **T17 才靠「伤害随我方 SpD 上升反而变高」反推出 Unaware（这条推理是正确的）**，T19 才改判 proved —— 即前 6 回合建立在一个错误的能力结论上。T13→T29 的 ~12 回合反复「宇宙力量/生蛋/辅助力量」+ 多次换人，根因就是「天然让辅助力量变 20 威力」这个错误认知（真值：威力 140，41.9-49.5%）。另：`get_move_info("Stored Power")` 全程被调了 22 次，我们的 desc 只有一句 "power is increased by 20 for every stage the user's stats are raised." —— 没写「只数正向」也没写「与 Unaware 无关」，所以它查了 22 次仍只能自己猜；`get_knowledge(["纯朴","Unaware"])` 在 T19 查过，当时知识库里没有该条目（0.4.1 已补）。

- [ ] **招式观察对手配置的解析（打落/小偷/戏法 → 道具，烦恼种子/扮演/特性交换 → 特性）**：有些招式能主动暴露对手配置：打落（Knock Off）/小偷（Thief）/抢夺（Covet）拍落或偷取对手道具（move_message.txt `%s knocked off %f's %i`），戏法/掉包交换道具；烦恼种子（Worry Seed）/胃液（Gastro Acid）消除特性，扮演（Role Play）/特性交换（Skill Swap）复制/交换特性（走 onAbilityMessage）。价值：比被动等道具/特性自己触发更主动、确定。① ~~先修/确认 `%i` 道具名占位符替换方向~~ **✅ 已做（script 0.6.15/0.6.16/0.6.18）**：`%i` 方向已按消息族分清（招式 16/23/70/105/132/160/162 → 回调 `other`；树果 → `berry`；道具 36/37 → 持有者自己的），并移植了主脚本的「道具消息号 → 道具编号」硬表；打落/小偷/戏法/烧尽/回收/传递 + 消耗类（红牌/逃脱按钮/气息腰带/树果…）都已维护进 `state`（我方 `itemProved` / 对手 `itemInferred`）。② **特性侧仍未做** —— 主脚本 `case 51/231/108/112/143/158` 的 `tempability`（胃酸·烦恼种子消除特性、扮演/特性交换/木乃伊改特性）还是空的；我们目前只在 `onAbilityMessage` 做「消息 → 特性 id」的**识别**，没做「特性被改/被压制」的建模。

- [ ] **`get_my_stats` 的 `nature` 应给名字而非 PO 编号**：用户实测返回 `nature: 8`（PO 编号，例：Toxapex 8 / Barraskewda 3 / Mandibuzz 5 / Dracozolt 3 / Kartana 13 / Aegislash 15），编号对 LLM 不可读。应改成性格名（`po-pokellmon-tool/knowledge/natures.json` 的 `byNum` 已含 `name_zh`/`name_en`，如 8→淘气/Impish、13→爽朗/Jolly、15→内敛/Modest）或 buff/debuff 效果说明（如「+Def -Atk」），或直接去掉该字段。数据源：po-script.js 采集我方队伍时 `nature: tp.nature`（编号，[L611](po-pokellmon/po-script.js#L611)），[tools.js](po-pokellmon-tool/tools.js) 的 `getMyStats` 原样透传（L760）。顺带检查 `calc_stats` 返回、state 注入 prompt 处是否也有编号直出。

- [x] ✅ **已决定并落地（0.4.0）** **评估是否引入 @smogon/calc（PS 官方伤害计算器）**：**引入了**（内嵌 `dist/` 到 `po-pokellmon-tool/vendor/smogon-calc/`，MIT）。原先顾虑「TS 库需 npm install + 转译、UNC 路径装不了包」已绕过：直接拷贝编译好的 `dist/`（`require()` 全相对路径、零依赖），不需要 npm。另一关键确认：**它的 gen8 数据是正确的**（`Pokemon(8,'Cresselia')` Def=120 而非 Gen9 的 110；Zacian Atk=170 而非 150），所以不会把 Gen9 数值带进来。升级：本地盘 `npm i @smogon/calc@<ver>` → 覆盖 vendor 目录 → 跑 test-calc-compare.js。

- [ ] **主脚本 20201227.js 伤害计算对齐 @smogon/calc（等 tool 侧验证后再做）**：tool 侧 calc_damage 已对齐（0.3.37：随机系数→STAB(4096定点)→克制(pokeRound)→extra，6 用例与 @smogon/calc 一致）。主脚本 getMoveDamage 有两处差异：① **随机系数顺序反**——movepow[i]（L2427）算出的是「最大伤害」（1.0x，先 base→克制→STAB 连续乘），别处用 `maxpow * 0.85`（L1042/L1285）算最小伤害；正确应「先随机系数(85-100) 再 STAB 再克制」② **取整方式**——主脚本纯浮点连续乘（无逐步 floor/pokeRound），正确应逐步 floor（随机向下取整、STAB 五舍六入 pokeRound、克制向下取整）。对齐需改 L2427 base damage 公式（`(2*level+10)/250` 等价 `(2*level/5+2)/50`，但 buff 里 atk/def 未逐步 floor）+ 后续克制/STAB/修正链 + getPossibleDamage/analyseCurrentDamage 的 `maxpow*0.85`。注意：主脚本是评分用估算、精度要求低于 tool，可先对齐顺序，逐步 floor 视收益再决定。

- [ ] **主脚本 `disabledAttackSlot` 可能同样有「被拒槽位跨宝可梦串味」（battle94 T20 发现，待验证）**：po-script 侧已修（0.6.11：我方 `onSendOut`/`onKo` 时清空 ban 列表）。主脚本对应实现是 `disabledAttackSlot`（[20201227.js:1402](20201227.js#L1402)）——**同样按槽位记**，清空只发生在 `resetCommandStatus()`（由 **`onOfferChoice`** 调用，[1422-1428](20201227.js#L1422-L1428)、[3764-3765](20201227.js#L3764-L3765)），**没有**按宝可梦作用域。所以「被拒 → 同一回合换人 → 新宝可梦的同号槽位被误禁用」在它那里是否会发生，取决于一个**未验证的点**：PO 在「指令被拒 → 要求重选」时会不会**再触发一次 `onOfferChoice`**？
  - 会 → `resetCommandStatus()` 顺带把列表清掉 → 主脚本碰巧不受影响（**这可能正是几年数万场没暴露的原因**）。
  - 只会触发 `onChoiceSelection` → 主脚本有同样的 bug（上一只的禁用槽位套到新上场宝可梦头上，**漏掉最优招**）。
  - **验证办法**：给 `onOfferChoice` / `onChoiceCancellation` / `onChoiceSelection` 各加一个自增序号心跳（探针脚本已有类似写法），然后**故意点一招被专爱锁住的招**，看同一回合内 `onOfferChoice` 是否出现两次。若确认有 bug，修法照抄本次：在我方 `onSendOut` / `onKo` 里 `disabledAttackSlot = []`（**不要**改成在 `onOfferChoice` 里清 —— 万一重选时也会触发，就会把同回合的禁用清掉、退回「重复点被拒招」的坑）。

- [ ] **重点观察（battle95+，验 0.6.11）**：① 换人/倒下后的那次决策里，**招式列表是否完整**（不再出现「同号槽位被误过滤」）② `state.bannedMoves` 报出的**招名是否与真实被拒的招一致**（之前按当前宝可梦解析槽位号，会把 Rotom 的 Volt Switch 渲染成 Oranguru 的 Psychic）③ 被拒频率（battle94：4/29 决策带 bannedMoves）——其中若有「Trick 换走道具后锁招检测失效」造成的，属**已知不修**的面（见 battle94 条目）。

- [x] ✅ **已完成（0.4.0）** **calc_damage 补全特性/道具/天气/场地等修正（对齐 @smogon，后续做）**：**改成了内嵌官方计算器**（不是手工移植）——把 @smogon/calc v0.11.0 的 `dist/`（MIT，26 文件 ~810KB，零依赖）放进 `po-pokellmon-tool/vendor/smogon-calc/`，`calcOneLeg` 改成「解析入参 → 喂给计算器 → 整理输出」。LLM 新增入参：`attacker/defender` 的 `ability` / `item` / `status`，`leg.field` = `{weather, terrain, reflect, lightScreen, auroraVeil, helpingHand}`；`extra` 保留但与这些**互斥**（同时传报错）。附带白拿：体重类招式（Low Kick/Heavy Slam）、招式专属 BP 回调、`detail.applied` 回显实际生效项、拼错名称提示、默认特性提示。验证：44 例基础 + 29 例修正项差分全一致。详见 README 0.4.0 条目。

- [x] ✅ **已修（0.3.72）** 🟡 **【优先级：中高 —— 与上面「calc_damage 补全特性/道具/天气」合并成一轮「伤害计算全面对齐 @smogon/calc」；同时它也是 learnsets 之外另一处「PO 数据与 PS 口径不一致」的地方】** calc_damage 特殊属性克制招式未处理（实测算错）：（**本轮只修了「特殊属性克制招式」；「特性/道具/天气/场地」那条即上面 L152，仍未做**）`calcOneLeg` 的 typeMult 只做 `CHART[move.type][defType]`，以下 3 个招式的特殊属性克制全错（2026-09-17 实测 vs @smogon/calc）：
  - **Freeze-Dry 冷冻干燥**：对 Water 固定 2x（覆盖正常冰→水 0.5x）。实测 Vaporeon（水）：我们 34-41（0.5x）vs smogon 138-164（2x），**少 4 倍**；Swampert（水/地）：我们 72-85（1x）vs smogon 288-340（4x），少 4 倍；Flygon（地/龙）无差异 ✅。
  - **Flying Press 飞身重压**：type=Fighting 但实为格斗+飞行双属性，倍率 = Fighting 倍率 × Flying 倍率。实测 Venusaur（草/毒）：我们 0.5x vs smogon 1x（**少 2 倍**）；Tyranitar（岩/恶）：我们 4x vs smogon 2x（**多 2 倍**）。
  - **Thousand Arrows 千箭齐发**：Ground 系但整体倍率算完若为 0 则改成 1（可打飞行系/浮游）。实测 Tornadus（飞行）：我们 **0（免疫）** vs smogon 180-213（1x）。
  - 规则来源：@smogon/calc `mechanics/util.ts` getMoveEffectiveness（Freeze-Dry 对 Water→2；Flying Press 额外乘 Flying 倍率）+ `mechanics/gen789.ts:420`（Thousand Arrows 整体 0→1）。PO 数据里这 3 招都有（另 Sky Drop 是「对飞行系无法使用」不是倍率问题；Nihil Light 是 Gen9 新招 PO 无）。
  - 修复方案（改 `calcOneLeg` 的 typeMult 段，约 15 行）：逐属性算 eff 时 `Freeze-Dry && Water → 2`；`Flying Press` 再乘 `CHART[Flying][defType]`；乘法累加完后 `if (mvName === 'Thousand Arrows' && typeMult === 0) typeMult = 1`。注意特判靠招式英文名（`mv.name`），需在 calc_damage 描述里注明「用 name 传招式才能识别特殊招式」。
  - 验证：临时脚本 `po-pokellmon-tool/tmp-check-special.js`（已删，修复时重建即可，模式同 test-calc-compare.js）；修完把这几条用例并入 test-calc-compare.js。
  - ✅ **已修（0.3.71）** **附带同源问题（同一轮一起改）**：PO 的 `po-data/moves/8G/power.txt` 用 **1 作哨兵值**表示「威力不固定」——共 48 招（OHKO / 固定伤害 / 按体重或 HP 计算，如 Guillotine、Horn Drill、Fissure、Seismic Toss、Night Shade、Super Fang、Flail、Reversal、Counter、Mirror Coat、Spit Up、Wring Out、Crush Grip…）。这些招 `get_move_info` 会报 `Power:1`（误导），按 `name` 传进 `calc_damage` 也会按 1 算。改成 `power: null` + 标 `variable_power: true` 并附一句说明（这类招本就无法用固定威力算）。
  - ✅ **已修（0.3.71）** **还有一处：鳃咬/电喙的「先手翻倍」我们完全没实现**（2026-09-19 查源码）。**PS 战斗引擎**（`pokemon-showdown/dist/data/moves.js` → `fishiousrend.basePowerCallback`）定义是：`if (target.newlySwitched || this.queue.willMove(target)) return basePower * 2` —— 即「**目标本回合刚换入**」或「**目标本回合还没出招**（攻击方先手）」任一成立就 85→170。而 **@smogon/calc**（`mechanics/gen789.js`）只用**有效速度**比较：`turnOrder = 攻击方有效速度 > 防守方有效速度 ? 'first' : 'last'`，鳃咬/电喙在 `turnOrder !== 'last'` 时翻倍（实测：攻方+2速、防守方-2速、防守方麻痹、防守方围巾都会改变判定；速度相同不翻倍）。→ **两边不等价**：在「目标本回合换入」场景，引擎**必定翻倍**，计算器却看速度 —— 若换入者更快，计算器会**少算一半**（这正是 battle67 的误判源头之一：LLM 用「鳃咬没翻倍」推「对手比我慢」）。我们的 `calc_damage` 目前**连这条都没有**，永远按 85 算。要改：加 `targetSwitchedIn` / `targetMovesLater` 两个可选入参（或直接让 LLM 手动按 170 传 power）。
  - ✅ **已修（0.3.71）** **另一处同源问题：`calc_damage` 没有暴击建模，必定 CT 的招式全算错**（2026-09-19 实测 vs @smogon/calc 0.11.0）。必定 CT 的招式共 5 个：`Wicked Blow 暗冥强击(PO 843)`、`Surging Strikes 水流连打(844)`、`Storm Throw(480)`、`Frost Breath(524)`、`Flower Trick(Gen9 不在 PO)`。我们的数据已有信号（`crit_rate: 6` + desc "Always scores a critical hit."），但 `calc_damage` 只靠 `extra` 手动乘 1.5，实测对比（Urshifu Adamant 252Atk vs Corviknight 252HP/252+Def，Gen8）：Wicked Blow 我们按非 CT 算 = Crunch 的 102-120，而 PS 是 **153-180**（CT ×1.5）；且 CT 还要**无视「攻击方负向能力等级」与「防御方正向上升」**（实测 atk-1/-2、def+2 伤害完全不变 = 153-180），**但烧伤照算**（153-180 → 76-90）。**注意世代差异（易记混）**：Gen1「CT 无视一切能力修正（含烧伤减半）」；Gen2 改为「CT 无视全部能力等级 + 烧伤减半 + 光墙反射壁，但仅当防守方防御等级 ≥ 攻击方攻击等级时」；**Gen3 起**才变成现在的「CT 只无视攻击方负向等级 + 防守方正向等级 + 光墙反射壁，而**烧伤的物攻减半不再被无视**」（Bulbapedia「Critical hit」原文：*"the halved damage from physical moves due to a burn is no longer ignored"*）。我们是 Gen8，所以按 Gen3+ 规则：CT 生效时烧伤照样减半。要改：`calcOneLeg` 支持 `isCrit`（含 `willCrit` 自动判定 + `crit_rate>=1` 的高暴击档位），crit 时跳过攻击方负向/防御方正向等级、`typeMult` 之外乘 1.5，burn 仍生效。

  - ✅ **已修（0.3.71）** **输出形式也要对齐：做成「伤害值 + 场景」**（2026-09-19 提出，与上面同一轮做）。现在只回 `min-max + HP%`，应像 @smogon/calc 的 desc 那样带**判定结论 + 情境**，例如 `252+ Atk Dracovish Fishious Rend (170 BP) vs. 0 HP / 0 Def Snorlax: 337-397 (73.1-86.1%) -- guaranteed 2HKO`：一次给出 ① **实际威力 BP**（含翻倍/CT/天气等修正后的值，让 LLM 不用猜）② **对当前剩余 HP 的 KO 判定**（guaranteed OHKO / 2HKO / 概率 KO）③ **本次计算用到的关键假设**（道具、特性、天气/场地、能力等级、是否换入/先手、是否 CT）。LLM 才能直接拿去决策，而不是自己二次换算。

  - ✅ **已修（0.3.71）** **属性替换类招式没实现（battle69 feedback + 实测确认）**：`Body Press` 应把**使用者的 Def** 当攻击值（实测我们用的是 `atk`：传 atk167 → 76-90(22-27%)；真值用 Def337 应 ≈46-55%，实战 38-44%）；`Foul Play` 应把**目标的 Atk** 当攻击值（实测不传时用了使用者 Klefki 的 atk196 → 19-23%，应为目标 Arctozolt 的 328 → ~32-38%）。另外 `Psyshock / Psystrike / Secret Sword` 是用**目标 Def** 当防御值。要改：在 `calc_damage` 里按招式名自动替换（并回显 `stat_note`），或在 tool 描述里强制要求手传 + 举例。
  - ✅ **已修（0.3.71）** **`calc_damage` 静默回退默认词条的风险**（battle69 T50 的误判源头）：LLM 传 `{"attacker":{"poke":"Arctozolt"}}`（漏了 ev/nature/atk）→ 计算器用中性 0EV 的 **atk 236**（真实 328，少算 28%），它还把 Bolt Beak 的 170BP 翻倍也漏了（未传 power → 用 85）、并自行乘了 0.5（Reflect）→ 估出 13-15%，实际 211HP(≈44%) → 换上的 Snorlax 直接被送掉。要改：结果里当使用了默认词条时加 `assumed:true` + 提示「本次用了默认 EV/性格，若已知实际数值请重算」；并考虑在 tool 描述里写明「**不要省略 attacker 的 ev/nature/atk**」。

- [x] ✅ **已修（script 0.6.4 锁招方向 + 被拒回滚；0.6.11 被拒槽位跨宝可梦串味），待实战复验** **锁招（专爱/挑衅）场景下我方招式列表与实际可用不一致**（battle68 T20 由 LLM 上报——`submit_feedback`）：同一回合第一次决策列出的招式是 `U-turn`、被 PO 拒绝后（`bannedMoves:["U-turn"]`）重试时列表变成 `Earthquake`。说明专爱锁招时 PO 给的活动招式会变，而我们把它原样当"可选招"展示，LLM 可能以为被锁的招还能点。要查：`po-script.js` 的 `pklmCollectMoves`（锁招时是否该只显示锁定招/标注 locked）＋ 被拒重试路径下 state 采集的一致性。**修法回顾**：0.6.4 把「锁招」从「过滤掉锁定槽」改成**标 `locked` 并保留**（原来方向反了：锁定时那一招才是唯一能点的），并**被拒时回滚 `pklmLastAttackSlot`**（否则同回合第二次决策的招式列表会变）；0.6.11 再修「被拒槽位沿用槽位号 → 换人后误伤新宝可梦同号槽位」。

- [x] **calc_damage/calc_stats 支持形态宝可梦（forme≠0）**（已修 0.3.41）：`resolvePokemonInput` 用 `POKEMON.byName[name.toLowerCase()]` 反查，`buildPokemon` 改为收录基础形态 + 合法形态（按 pokemons.txt 的 tag 排除 Mega 'M' / 极巨化 'G'），key 用 `num:forme`（基础形态仍 `num` 兼容），形态缺 type1 时继承基础形态。现已支持 Rotom-Wash / Landorus-Therian / Deoxys-Attack / Giratina-Origin / 洛托姆各形态等（真实种族值）。

- [ ] **smogon 生态资源（暂记，看情况做）**：① **Usage Stats**（各分级使用率/配招/道具/特性/努力分布，作对手配置先验）——随机队向暂缓，等适配 PS 组队对战再说 ② **@pkmn/data / @pkmn/dex**（PS 完整数据层，补学习面/招式效果等）③ **pokemon-showdown 引擎**（MCTS/rollout 搜索，工程量大，短期不需要）④ **Smogon Analysis/Dex**（标准配招/counter/check 分析，可做 get_set_analysis tool）。

**已实证**：

- 挣扎保底（全 ban 后 `attackButton()`）不会导致卡死，兜底有效。
- PO 无通用 stat 变化回调：剑舞/近身战/冥想等通用 stat 升降不通过 `onMoveMessage` 暴露（`move_message.txt` 里 `rose/fell/sharply` 只有诅咒/装饰/树果/Octolock 等写死的特定招式），战报文本缺「Attack rose sharply / Defense fell」；但 `boosts` 字段（`statBoost` 快照）正确反映能力等级，LLM 可通过 history（用了什么招）+ boosts（能力值）关联推断。**结论：不硬补文本，靠 `boosts` 字段即可**。

**待办（观察项，暂不实施，等再打几把看表现）**：

- [x] **战报保存完整性（基于回调 function 补全战报细节）**：当前 po-script.js 只记 `onUseAttack`/`onDamageDone`/`onKo`/`onSendOut`，大量效果信息丢失。需把以下回调补进 `pklmTurnLog`（进而进 history/fullHistory，供 tool 的 `get_battle_history` 读取），让战报能完整还原「有效/无效/招式效果/状态变化」：
  - `onEffectiveness`（有效 / 效果绝佳 / 效果不好 / 无效）
  - `onAttackFailing`（攻击失败）
  - `onMiss` / `onAvoid`（未命中 / 被避开）
  - `onCriticalHit`（会心一击）
  - `onMoveMessage`（招式效果消息，如「对手被浸水，属性变水」）
  - `onMajorStatusChange` / `onStatusOver`（状态变化 / 结束，如浸水、烧伤、中毒、麻痹）
  - `onStatusDamage`（状态异常伤害，如烧伤/中毒扣血）
  - `onFlinch`（畏缩）
  - `onItemMessage` / `onAbilityMessage`（道具 / 特性触发）
  - 映射备注：`onEffectiveness` 取值 `0`=无效 / `2`=效果不好(1/2) / `4`=正常(1x) / `8`=效果绝佳（2x 与 4x 都传 8；PO 通常不传 `1`/`16`，但需兼容 `1`=1/4、`16`=4x）；status 编号 `1`=麻痹 / `2`=睡眠 / `3`=冰冻 / `4`=烧伤 / `5`=中毒 / `6`=混乱 / `31`=KO（见 [board-standalone.js](../board/board-standalone.js) `boardStatusName`）

- [ ] **战报细节度持续扩充（状态效果体系持续补全）**：已完成的战报保存完整性（上方 [x]）解决了基础回调，浸水/剧毒/挡路这类「改属性 + 状态」体系已经能通过 `onMoveMessage` / `onMajorStatusChange` 记进 history（如「对手被浸水，属性变为水」）。本项转为**持续扩充**：后续按需补进更多效果类回调 / 消息解码覆盖（如浸水、挡路、再来一次、再来一次等未覆盖的效果文本），目标是让战报能完整还原「有效/无效/招式效果/状态变化」。每当发现「LLM 重复用无效招」或「看不到某个状态」时，回来补一条对应的战报细节。

- **强化后误换人（丢强化 + 白挨一击）**：暗黑酋雷姆龙之舞后（`Atk+1 Spe+1`）HP 剩 1%，DS 却选换人而非进攻（此时冰锥 2x 克制 + Atk+1 + 速度+1 应先手）。暴露几个通用问题：
  - 换人代价被忽视：换入宝可梦会白吃对手一击，prompt 未体现；
  - 强化损失被忽视：换人清空 Atk/Spe 强化，DS 未理解「换人 = 白费强化」；
  - 先手判断缺失：有 `Spe+1` 但 prompt 无速度对比，DS 无法判断是否先手；
  - 濒死信号过强：`HP 1%` 触发过度保守换人。
  - 方向：换人选项追加「换人代价 / 强化损失」提示 + 注入速度对比 + 预设评估「强化后应进攻利用，换人白费强化」。

**PS 平台（platform/ps）待办（2026-09-27 本地自建服实测记录）**：

- [ ] 🟡 **看板左栏不渲染「等级/道具/特性」**：PS 侧 state 里已经有 `level`/`item`/`ability`（tool 0.9.6），prompt 里也在用（`Ability:innerfocus,Item:heavydutyboots`），但 `po-pokellmon-view/index.html` 的左栏渲染没画这几项（原来只服务 PO 的 state）。**只改 viewer，不动 PS 侧**。
- [ ] 🟡 **决策服务的知识库停在 gen8（物种 + 招式）**：`get_pokemon_info("Iron Valiant")` → `unknown pokemon`；`Ivy Cudgel` / `Psychic Noise` 这类 gen9 招式在 prompt 里只能显示原始 id。PS 侧 `speciesTypes` / `moveById` 已优先走内嵌 PS 图鉴（gen9）所以**观战与首发候选行不受影响**，缺口在 tool 侧。两条路：① tool 在 PO 图鉴查不到时回退到 `vendor/smogon-calc`（小改动）② 重建 `knowledge/pokemon.json` + `moves.json` 到 gen9（彻底，需重跑 build-knowledge.js）。
- [ ] 🟡 **`simulate_turn` 的 move 参数易写错**：battle68 T22 实测它连发 30 次 tool 调用仍没定稿（`{"move":"TeraBlast"}`、`"太晶爆发"`、`{"move":"Tera Blast","terastallize":"Flying"}`、`{"move":851}`），最后被回合预算掐掉走兜底。方向：给 move 参数加更硬的校验与示例（只接受动作表里的原始名字或编号），或在报错时直接回「请用动作表里的名字」。
- [ ] ⚪ **小瑕疵**：`Calm Mind:Acc:101%` —— PO 招式数据里「必中」用 101 编码，prompt 里显示成 101% 有点怪，可考虑渲染成「必中」。

---

## 历史条目（早期路线 / 暂缓追踪）

> 以下条目对应早期路线：PO 主脚本 [20201227.js](20201227.js) 规则 AI 优化、字段语义映射、旧 DeepSeek 接入（deepseek-bridge/）、长期重构等。当前不活跃，保留备查，需要时回来取用。

### 本地可做（纯文档 / 代码整理，不依赖 PO 运行时）

#### 1. 字段语义映射（优先级最高）

实测拿到了字段的整数值，但还没映射到人类可读的含义。梳理清楚这些之后，AI 决策代码才能摆脱"魔法数字"。

- [x] `battle.data.field.weather`：`0=无 1=冰雹 2=雨 3=沙暴 4=晴 5=大晴天 6=大雨`（与主脚本 L2435-2440 一致，动态可靠）
- [x] `battle.data.field.terrain`：**有场地时是 1-4 的正常编号**（`1=电气 2=青草 3=薄雾 4=精神`，`Grassy Surge` 实测 `terrain=2`、5 回合后过期回落 **`0`**）；**本局还没出现过场地时是未初始化的大数**（`566823768` / `-795540743` 等，每局/每进程不同）→ 白名单判 1-4 即可
- [ ] `pokemon.status`：`0 = 正常`，其他状态异常编号 → 结合 `onMajorStatusChange` 回调中的 `status` 参数映射
- [ ] `pokemon.ability`（实测 `0`）→ 特性编号对照表
- [ ] `pokemon.item`（实测 `8015`）→ 道具编号对照表
- [ ] `pokemon.nature`（实测 `3`）→ 25 种性格对照
- [ ] `pokemon.hiddenPower`（实测 `11`）→ 隐藏属性类型对照
- [ ] 基于 [move_data_reference/move_message.txt](move_data_reference/move_message.txt) 解码 `onMoveMessage(spot, move, part, ...)` 中的 `move` / `part` 参数

#### 2. 文档完善

- [ ] 合并 [docs/api/battle-object.md](docs/api/battle-object.md)（框架文档，含虚构 API 如 `getFieldState()`）与 [docs/reference/battle-object.md](docs/reference/battle-object.md)（实测笔记）—— 保留实测为准
- [ ] 补充 `battle.battleCommand` / `attackClicked` / `switchClicked` / `targetChosen` 的参数含义与调用示例
- [ ] 分析 `battle.data.field.zone` 各字段（尖刺等）对战术决策的影响
- [ ] 更新 [README.md](README.md)，反映当前项目进展

#### 3. 代码整理（[20201227.js](20201227.js)）

- [ ] 继续补中文注释，重点覆盖核心函数：`typechart` / `calcBaseStats` / `statsCalcFromBase` / `calcStatWhenBoost`
- [ ] 梳理 `20201227.js` 内部逻辑分块的边界，为未来模块化做准备（**只标注边界，不拆文件** —— 拆分后无法在本地验证）
- [ ] **内存泄漏排查（短期不动，待实测确认根因）**：服务久了内存爆、PO 挂掉的疑似根源——① 每个 battle window 顶层 `loadJsonData("movedata.json")`（[L1396](20201227.js#L1396)）重复 parse ~1MB 对象树，window 关闭后若 PO 不释放 QScript 引擎则每场残留一份；② 大量 `sys.setTimer` 闭包持有整个脚本作用域（`battle`/`foeInformation`/`moveDataObj`）。脚本内部无随场次无限增长的数据结构（`foeInformation.pokemon` 固定 6 槽位、`previousTurnEventRecord` 每回合 reset）。**根因判断需实测**：连打 10 场看 PO 进程内存是否回落；若根因是 PO 不释放 QScript 引擎，脚本侧优化杯水车薪，真正该做的是服务型 BOT 定期重启 PO。附带小 bug：`loadJsonData` 里 `sys.getFileContent(file)` 被调用两次（[L1380-L1382](20201227.js#L1380-L1382)），可顺手修。

#### 4. 已知 bug / 疑似遗迹（本地可确认，改动需验证）

> 以下问题在逆向分析中发现，可在本地修改，但效果需实战验证。参见 [docs/analysis/decision-logic.md](docs/analysis/decision-logic.md)。

- [ ] **`getGoodForSwitch` L1495：`indexOf()` 缺少参数** → 永远返回 -1，某个类型克制分支从不生效；需确认正确参数后修复
- [ ] **`getGoodForSwitch` L1519：条件与 L1518 相同** → 疑似应为 `> 2`（倍率克制额外惩罚），与 L1518 的 `> 1` 重复导致第二段无效
- [ ] **Path 3 速度判断三段重复（L3089-3103）** → 三段几乎相同的速度检查互相覆盖，实际行为偏向最后一段；需人工走读确认预期行为后合并

#### 5. v1.1.1 待办（基于 softmax 设计复盘）

> 核心原则修正：服务型 BOT 的随机性应建立在"期望收益接近的合理动作之间"，而非"信息少时盲目发散"。对手 bench 未亮相时不读空气，对手有明确换入收益时才启动混合评分。

- [x] **softmax 候选集改为基于 `finalScore` 过滤（已实施 v1.1.1）**：两轮遍历改造；第一遍计算所有 finalScore，第二遍用 `finalScore >= maxFinalScore * threshold` 过滤；threshold 通过 T 对应：T≤0.8→0.85，T≤1.5→0.75，T≤2.5→0.65，T>2.5→0.55

- [x] **残局 T 衰减（已实施 v1.1.1）**：`switchesList.length + 1 ≤ 2` → smT×0.30，≤3 → smT×0.45；case 1 武道熊师残局场景下 T 从 2.0 降至 0.60，毒击直接被 threshold 过滤

- [x] **专爱系道具 T cap（已实施 v1.1.1）**：item∈[4,5,6] 且 switchesList 为空时 smT 强制 ≤ 0.6，防止锁招状态下仍走随机分叉

- [ ] **UT/VS/Flip Turn 加 KO 保护**：当前 `finalScore *= (1 + switchP * 0.008)` 在有明确 KO 招时可能出现"明明能杀却急速折返"。建议：若候选中存在满足先手斩杀条件的招式，则 UT/VS 的 `finalScore` 不得超过该 KO 招的 0.95 倍（cap，不减成零）；若 UT/VS 本身也能 KO 则不受此限制。UT/VS 的正确定位是"伤害 + 节奏" 复合价值，switchP 加成体现的是换人时转场收益上升，而不是弥补低伤害

- [ ] **对 `switchP=0`（bench 全未亮相）的文档澄清**：当前代码行为正确，但文档应明确区分两类"未知"：① 已知 bench 存在可分析换入概率（switchP 由 `estimateFoeSwitchProb` 计算）；② bench 完全未亮相无法定位（switchP=0，不读空气）。服务型 BOT 的随机性来源是"对手在几个合理选择间不可预测"，而非"我不了解对手所以乱打"。更新 [docs/v1.1-battle-logic.md](docs/v1.1-battle-logic.md) 第 4 节和第 5.1 节对比表

- [ ] **当前免疫但打换入强的招（hard read candidate，v1.2+）**：例如对手场上飞行系免疫地震，但已知 bench 有火钢——点地震属于 hard read。触发条件要极严：switchP ≥ 75 + 已知 bench 对该招伤害高 + 当前局面不危急 + 无更稳的 UT/VS 可用。不与普通 softmax 合并，单独以很低概率（如 `hardReadScore = incomingScore * 0.6`）加入候选，且 cap 不得超过最高稳定招。等 v1.1 实战日志稳定后再做

#### 5.5 未合入的决策优化方向（中期，需深入研究）

- [ ] **变化招纳入 softmax（基础）**：当前改动 D 只覆盖攻击招，变化招（强化 / 撒钉 / 睡眠等）仍走原有确定性逻辑；对服务型 BOT 而言，变化招的选用时机也值得随机化——需先分析变化招的 `rejected` 控制流再设计
- [ ] **变化招纳入 softmax（foeSwitchP 联动）**：`movepow=0` 的变化招在 foeSwitchP 高时可能有换人收益——例如对手可能换入时布岩钉/地钉收益更高，或对手换入后弱点可被撒毒/催眠命中。当前 v1.1 仅对 446/191 特判 stratPow，其余变化招完全不参与。后续可按"假定换入目标"评估变化招的收益（岩钉用属性倍率估算 bench 的入场伤害，状态招用 bench 的特性/类型推断命中收益），并将 stratPow 动态化而非固定为 70/40/18。依赖 `estimateFoeSwitchProb` 扩展，需先完成基础变化招接入再做
- [ ] **Path 2 对手强化后换人逻辑复查**：L3107 在对手强化 >2 时以 2/3 概率拒绝换人；进到 Path 2 意味着只有中等候选，被对手 setup 后可能直接被秒——目前判定为"保守合理"但未验证，实战后若反复出现"中等候选换上即被秒"则需重新评估
- [x] **softmax 触发率过低问题（已修复，v1.1）**：原阈值模型（75/85/90%）只覆盖近等势场景，已改为温度参数真 softmax（改动 D v2），所有 `movepow > 0` 的招式全量参与加权采样，温度 T 基于局面紧迫度而非 pool。新增 `estimateFoeSwitchProb()` + bench 混合评分 + UT/VS 加成 + 岩钉战略分。参见 `feedback/v1.0/case 1.md`
- [ ] **getFoeThreatToMe()：AI 自身受威胁评估**：当前 `getOpponentDecisionPool` 只量化对手选择空间，缺少 AI 自身风险维度——对手能一击打死时，随机化选次优招代价极高。拟新建 `getFoeThreatToMe()` 函数（返回 0-100）作为 pool 的负项，因子包括：速度对比（对手确定/可能更快）、对手进攻强化等级、我方当前 HP 比例、**已亮相招式中对我有效的**（只用已知信息，不做属性推断——对手不一定带本系招，且可能带覆盖招，纯属性推断不可靠）。参见 `docs/analysis/battle-relationships.md`
- [ ] **softmax 候选评分纳入命中率**：当前 softmax 的 `smScores` 直接使用 `movepow`，而 `movepow` 里命中率只作为控制流阈值（`damagePercent * accurcy > 0.5`），不影响权重。这导致同等 movepow 的 70% 命中招与 100% 命中招被等同对待。即便对手决策空间大，人类也倾向于选高命中招——建议改为 `smScores[i] = floor(movepow[i] * accurcy / 100)`，让低命中招在权重上自然处于劣势。需确认 `accurcy` 在插入点处是否可访问（当前在主循环内部，softmax 在循环外，需要存到循环外变量或重新计算）
- [ ] **`getOpponentDecisionPool` 扩展影响范围**：当前 pool 只用于改动 B（自损惩罚系数）和改动 D（softmax 候选集宽度），但它对更多决策环节都有潜在的调优价值，包括但不限于：
  - 先手斩杀阈值（pool 低时对手被逼死角，是否应降低斩杀阈值？）
  - 优先度招式（截击 / 影子偷袭等）的使用时机
  - 变化招的接受概率（pool 高时更倾向搏一把撒钉 / 催眠）
  - 换人路径的 `choosetime` 门槛（pool 高时可以更早触发换人评估）
  - 保护 / 替身的使用意愿（pool 高时对手不可预测，保护价值更高）
  - 需系统梳理 `attemptCommand` 里所有带随机数的判断点，逐一评估是否值得接入 pool
- [ ] **对手专爱锁招推断用于换人 counter 选择**（来自 case 1 R7）：已知对手持有专爱头带/眼镜/围巾 + 本回合使用过某招（或上回合已锁定）时，换人评估应以该锁定招为假定来袭招式，而非扫全部已知招式。具体：在 `getGoodForSwitch` 的类型威胁评估中，若 `foePoke.item in [4,5,6]` 且已记录使用过的招式，只计算该招式的属性威胁，不做宽泛的"所有招式最大威胁"估算
- [ ] **对手最后一只时战略招 stratPow 归零**（来自 case 2 R19）：对手场上只剩最后一只宝可梦（无 bench 可换入）时，布隐形岩/地钉没有实质收益（无换入目标）。当前代码仅检查岩钉是否已布，不检查对手剩余数量。修改：在 stratPow 赋值逻辑中追加条件 `&&（对手 bench 存活数 > 0）`；对手存活数可从对手 switchesList 等价结构读取
- [ ] **UT/VS 先后手判断影响换入候选评估**（来自 case 2 R4）：先手使用 UT/VS/Flip Turn 时，换入宝可梦将在本回合直接承受对手攻击——换入候选应满足防御要求；后手使用时对手已出完招，换入宝可梦只需满足下回合进攻要求。建议：先手场景下对 UT/VS 的 finalScore 加入对候选 bench 防御能力的评估权重；后手场景维持现有逻辑（仅攻击评分）。速度对比可复用已有的速度判断逻辑
- [ ] **附加效果按场面条件动态估值**（来自 case 2 R14）：当前 movepow 不区分附加效果在当前场面的实际价值——高速旋转+1 速在我方确定快过对手时收益为 0，提升攻防的招式在特定能力段同理。建议对带附加效果的招式（速度提升/攻防强化/恢复）在计算 movepow 或 finalScore 时引入场面条件修正系数；实施前需先梳理 movepow 里已有的附加效果处理位置
- [ ] **我方能力下降后主循环换人误判修复**（来自 case 1 R12）：流星群/过热等自损 SpAtk 后，若当前宝可梦仍可 OHKO 对手（`dropFoeHp * 2 > foeRemainingHp`），主循环不应因"我方输出下降"触发换人评估。根因在 `getMoveDamage` 用下降后的攻击力估算后续伤害，导致 `movepow` 偏低从而换人路径被激活。临时方案：在换人触发条件中增加"本回合出招可 KO 对手"豁免
- [ ] **属性盲点无法 KO 时降低招式权重**（来自 case 1 R1）：对手类型信息不足（`pokeNum=0` 或只见过 1 招）时，带属性盲点的招式（如对幽灵/地面免疫系的近身战/地震）若无法确认 KO，其 finalScore 应乘以惩罚系数（建议 0.5-0.7）。依赖已有的类型已知度判断逻辑；免疫判断需结合 `typechart()` + 已知 `type1/type2`（未知属性时跳过惩罚）
- [ ] **清场特性持有者 KO 招 finalScore 加成**（来自 case 1 R1）：特性为异兽提升（ability=39）或黑暗绒毛（ability=???）等击倒对手后能力提升的宝可梦，KO 对手的招式在当前回合价值更高（击倒后强化）。建议：在 finalScore 计算时若 `damagePct >= foeHpPct`（可 KO），对该类特性持有者追加 ×1.2 系数；特性编号待实战确认
- [ ] **百变怪/变身宝可梦特殊伤害估算**（来自 case 2 R1/R19）：变身类宝可梦（百变怪 num=132，或使用变身招后）的攻击/防御等于目标宝可梦，但 HP 保持自身；当前 `getMoveDamage` 直接用 `calcBaseStats` 读原始种族值，会大幅低估变身后的伤害和耐久。建议：检测 `fpoke.pokemon.num === 132` 或变身状态标记，改用目标宝可梦种族值计算，同时保留自身 HP

#### 5.6 v1.3 统一 softmax 决策架构（大版本主题，基于 v1.1.2 实测 + 作者愿景）

> 核心问题（v1.1.2 case3-2/case1-14/case2-12/case4 共同根因）：当前决策是「阶段1 主循环确定性 break + 阶段2 softmax 纯伤害旁路」两套割裂逻辑。落入 softmax 时只剩伤害对比，先制/命中率/附加效果/变化招全部丢失。控制流详见 [docs/analysis/attemptCommand-control-flow.md](docs/analysis/attemptCommand-control-flow.md)。
>
> 愿景：把所有动作选择统一进 softmax，`finalScore` 从「纯伤害」升级为「综合行动价值」，所有合理动作在同一尺度加权采样——这是服务型 BOT「防被读穿」的终极形态。v1.2 的 `commandDecided` 标志是过渡止血件，本架构落地后移除。
>
> 实施前必读：等 v1.2 实战反馈回来，用真实日志校准下面各层的权重映射（拍脑袋定值不如实战数据）。

- [ ] **L1 全攻击招入池**：4 个攻击招全部进 softmax，不再靠主循环 break 旁路。先制斩杀等确定性决策改用「极高权重 finalScore」表达（必杀就几乎必选），而非 break 跳过。移除 commandDecided 标志
- [ ] **L2 变化招入池**：变化招按 `getStatusMoveEffectiveForCurrentFoe` 的适应度（0-4）映射成 finalScore 权重，与攻击招同池竞争。修掉「适应度3却用不出」（case1-14羽栖/case2-12寄生种子/case4鬼火）。配套：日志输出「哪个变化招适应度是几」（当前只打印数值不带招名，case2-12/checklist 第2条诉求）
- [ ] **L3 权重修正项**：finalScore 纳入命中率（×accuracy/100，checklist 第4条）、附加效果（提速/烧伤/斩杀先制等按场面条件加成）。变化招适应度还要看「自身受威胁程度」（case4-1 隐形岩在快倒地时仍给适应度4不合理）
- [ ] **L4 换人入池**：换人候选也算 finalScore（standard 映射），与出招同池竞争采样，统一「换不换 + 换谁 + 出什么招」为一次采样。这是最难的一层，依赖 L1-L3 稳定后再做

#### 5.7 v1.1.2 实测其他待办（非 softmax 架构）

- [ ] **开局输出我方阵容与队伍参数**（checklist 第1条）：调试模式下开局打印我方 6 只的种族值/招式/道具概要，方便人工核对 AI 阵容分析是否合理
- [ ] **换人失败 → 推断对手特性**（case2-4）：换人指令被拦截（如对手磁力/踩影/沙穴）时记录对手对应特性，供后续决策利用
- [ ] **伏特替换/急速折返 后再换人 的开局逻辑**（case1 开局）：我方先手且持 UT/VS 时，先打一发再换人比直接换人多收益
- [ ] **伤害评估系统性偏高校准**（case2-13）：实测 damagePercent≈0.20 实际仅 16%，伤害公式偏乐观，需校准
- [ ] **高耐久无输出墙的换入价值**（case2 托戈德玛尔）：standard 已能识别（电钢4倍抗飞行给高分），但因无输出招被 attemptSwitch 的 goodAttackSwitch 排除。改动F 的 standard 主导选择应已部分缓解，需实战确认

#### 5.8 对手「可能但未确认」免疫特性的规避过严（待 v1.2 上线后做，独立改动）

> 用户反馈（基于 v1.0，各版本通用）：卡璞哞哞（草+妖精）面对玛力露丽（水+妖精）不用草系招、改用格斗招，结果输掉。
>
> **根因**：`calcMoveDamageBuff`（L2414-2423）对「可能但未确认」的免疫特性一律把 `initbuf` 归零。`getPossibleAbility`（L1373）在特性未被实战观测确定前返回该种族**全部**可能特性。玛力露丽种族特性含食草(25)，于是 L2417 `defPossibleAbility.indexOf(25) !== -1 && 草系倍率<2 → initbuf=0` 触发，草系招被完全归零——哪怕食草只是三选一可能性（玛力露丽实战绝大多数是大力士，尤其腹鼓配置）。
>
> **更深的博弈问题**：当不点该招就完全无法处理对手时（卡璞哞哞不点草系打不动玛力露丽），规避免疫特性 = 主动放弃唯一解。此时赌对面不是免疫特性反而期望胜率更高。
>
> **现状细分（两个方向相反的问题并存）**：
> - **A 类·单特性免疫，规避过严**：L2416 飘浮→地面、L2417 食草→草、L2419 引火→火，结构是单特性 `defPossibleAbility.indexOf(X) !== -1` → 只要 X 是该种族可能特性之一就归零。**食草问题（玛力露丽）就出在 L2417**，确定过严。
> - **B 类·L2418/2420 的 `&&` 疑似 bug**：L2418 水系免疫写成 `indexOf(11)!=-1 && indexOf(87)!=-1 && indexOf(114)!=-1`（三特性**同时**在列表），L2420 电系同理 `12 && 31 && 78`。一只宝可梦最多 3 特性，这三个又是不同的免疫特性，几乎不可能同时拥有 → **该条件几乎永不触发，水系/电系免疫特性实际几乎从不被规避**。直觉上应是「任一免疫特性在列表即归零」（用 `||`）。但**未确认**：① 11/87/114/12/31/78 的准确含义（无特性对照表，编号是从上下文推测）；② 原作者是否另有意图。**做这个改动前先解码特性编号**（见本地可做 1. 字段语义映射的特性对照表任务），确认后再决定 `&&`→`||`。
>
> **方案（已定调：折扣 + 唯一解不归零组合）**：
> - A 类单特性免疫：从「归零」改为「乘折扣系数（建议 0.4）」。
> - B 类：先确认编号与意图；若确属 bug 则改 `||`，同样用折扣而非归零（修 bug 又不过严）。
> - **唯一解保护**：若该招打折扣后仍是我方对当前对手的最高 movepow 招（即归零它就无招可打），则不打折扣、按正常伤害算——主动赌对面不是免疫特性。
> - 特性已被实战确认（`info.ability !== -1`，getPossibleAbility 只返回 1 个）时维持归零——确认是免疫特性就别白打。
>
> **实施注意**：calcMoveDamageBuff 是 getMoveDamage 的子调用，折扣会同时影响主循环和 softmax 的 movepow。「唯一解保护」需要在调用点（getMoveDamage 内）判断该 slot 是否为全队/全招最高，或在 calcMoveDamageBuff 外层做二次判断。需先理清调用链再动手。
> 特性编号待确认（无对照表，下列为上下文推测）：25=食草 26=飘浮 18=引火 11=储水 87=引水 114=干燥皮肤 12=蓄电 31=避雷 78=电气引擎。

#### 5.9 v1.3 已实施 + 衍生待办（基于 feedback/v1.2 case+report）

**已实施（v1.3）**：

- [x] **改动 I**：被迫/KO 换人纳入高 standard 候选（修 case4-R8/case7-R2 换人送死；passive 时合并全体 standard 接近最高的墙，主动换人不变）
- [x] **改动 M**：softmax 溢出折减 + 命中率（有效伤害=1.10内全额+溢出×0.1，再×命中率；修 case4 水炮/冲浪）
- [x] **改动 K**：softmax 先制度建模（速度劣势分层为主+先制斩杀/对手能秒我放大；突袭×0.3；修 case7-R3）
- [x] **改动 J**：softmax 上下位招剔除（同属性严格支配）
- [x] **改动 L**：softmax 自损 debuff 招非首选剔除

**v1.3 衍生 / 未做（后续版本）**：

- [ ] **伤害估算 ±5% 偏差校准**：实测伤害与 AI 预估有约 ±5% 偏差，疑来自对手耐久估算（case7 观测38%估33%、连续重算数值漂移）。A/B 两招调同一耐久故相对比较稳，但绝对值影响斩杀线判断。可探索"用实战观测伤害在线回归修正对手耐久"。v1.3 用溢出 1.10 阈值规避其对溢出判断的影响，但根因未解。
- [ ] **finalScore 完整加权模型（远期，统一架构终态）**：把 smFinal 从当前的"有效伤害×命中×先制系数"升级为显式加权和：`w1·期望有效伤害占比 + w2·伤害溢出(负) + w3·命中率 + w4·buff/debuff + w5·先制出手概率(速度差) + ...`。J/L 的"支配剔除"届时改为按各因子综合判定；K 的突袭降权归位为 w5+w2。与 5.6 的 L1-L4 统一架构合并推进。
- [ ] **report 暴露的剥削点（人类视角，防被读穿）**：① setup 后不衔接输出（report4 龙舞+替身死循环）② 进场即换的可预测循环（report5 音波龙/具甲武者反复进退）③ 撞墙硬刚守住（report4 垒磊石撞青铜钟）。这些是人类反复看穿剥削的点，优先级高。
- [ ] **连击招伤害 / 混乱自伤记录 bug（case6/case2）**：钢拳双击伤害体感高估（虽 times=5 用 3.168 系数，仍偏高待核）；飞膝踢把对手混乱自伤并入招式伤害记录。

#### 5.10 v1.3.1 已实施 + v1.4 待办（基于 feedback/v1.3 case1/case2）

**已实施（v1.3.1 patch）**：

- [x] **改动1**：KO 换人走 passive 路径（`attemptSwitch(false)`→`true`），触发改动I，修 KO 换人选 standard 最低送死（case1-R6/case2-R6 致命）
- [x] **改动2**：被动换人纯 standard 候选，去掉 goodAttackSwitch 无条件纳入（修铁螯龙虾-130 进候选池）
- [x] **改动3**：standard 虚高缓解小改——①L1752 indexOf 死代码修复 ②耐久加分收紧(+30→+18,0.3→0.22) ③输出过低惩罚(<0.18 罚-30,<0.30 罚-15)
- [x] **改动4**：回退改动J（误删伏特替换），保留改动L与第二遍守卫

**v1.4 待办（结构性重构）**：

- [ ] **问题5：威胁评估未露本系招式**：getFoeThreatToMe 的 B 因子 bestDmg 只算已亮相攻击招，对手只露1招时忽视本系招威胁（case2-R6 藏玛然特只露巨兽弹，忽视格斗本近身战4x，铁螯龙虾被换上送死）。方案：露招时补"未露属性的本系"，按露招数衰减（露1招×0.8/露2招×0.5/露3招×0.2）。并入 v1.4 getSwitchStandard 重构（防御评估也统一考虑未露本系）。
- [ ] **问题3 结构性：getSwitchStandard 复用 getFoeDamageToMe**：当前防御评估用手写耐久公式+属性循环+抵抗加分（L1749-1803），与 getFoeThreatToMe 用的 getFoeDamageToMe 是两套体系、量纲不一致且有 bug。重构为：防御部分改用 getFoeDamageToMe（对手打候选伤害比例→映射加减分）+ 加完整输出维度（候选打对手），删手写耐久公式+抵抗加分虚高项。standard 变防御+输出综合分。呼应 finalScore 加权模型愿景（5.9）。
- [ ] **问题6：threat 算法优化**：threat 与 bestDmg 量纲关系（A速度+B伤害独立累加，我方先手时威胁压低）后续专门讨论，可能拆成"秒杀威胁/消耗威胁"两分量或重新设计因子权重。

#### 5.11 天气/场地编号核查 + analysePossibleSpeed bug（v1.4，看板联调时发现）

> 来源：board 看板联调反馈"晴天显雨天"，核查主脚本 weather 编号时发现。

**已确认（无需再查）**：
- weather 编号在主脚本三处逻辑（威力加成 L2435-2440 / 提速特性 L1450-1456 / 招式判断 L2099-2100）一致：`2=雨 4=晴 3=沙暴 1=冰雹 5=大日照 6=大雨`。board-standalone.js 的 boardWeatherName 已据此修正（原 2/4 搞反）。**主脚本 weather 判断没反**。
- terrain 编号 `1=electric 2=grassy 3=misty 4=psychic`（L2447-2451 威力加成确认）。

**待办**：

- [ ] **bug 修复：analysePossibleSpeed L1290 `var weather = turnMemory.memory.terrain`** → 应为 `.weather`。当前 weather 变量读成 terrain 值，导致 L1300-1306 / 1320-1326 / 1335-1341 所有天气特性（雨速/叶绿素/拨沙/雪走）速度修正判断失效（拿 terrain 值比 weather 编号，几乎不匹配）。影响对手速度区间推断，漏算天气特性加速。对照 getPossibleSpeed L1447 `weather = battle.data.field.weather` 是对的。
- [ ] **核查特性编号 33/34/146/221/212**：从"提速特性配对应天气"自洽性反推为 33=雨速 / 34=叶绿素 / 146=拨沙 / 221=雪走 / 212=冲浪之尾，但无特性对照表实证。PO 里 `/eval sys.ability(33)` 等打名字确认。顺便补特性编号对照表（见本地可做 1. 字段语义映射）。
- [ ] **核查天气/场地相关招式编号**：L2099-2107 招 240/241/258/201/588/593/599/633/635 在对应天气/场地失效，确认招名与机制一致（240=日光束 weather2雨无效、241=打雷 weather4晴低命中等已自洽，其余待核）。
- [ ] **status 编号 3=冰冻 的实证**：1=麻 2=睡 4=烧 5=毒 31=KO 有特性/招式证据，3=冰冻是排除法推断（L1822 与 2 并列），联调时确认。

#### 6. Sacrifice play（长期探索，暂不做）

> 需要跨回合状态记忆，无法在单回合决策框架内实现，工程量大。

- [ ] 在 `getGoodForSwitch` 里新增"当前宝可梦无用度"评分：HP < 30% 且 PP 耗尽 / 类型覆盖冗余的宝可梦得高分，视为候选炮灰
- [ ] 主循环新增"当前宝可梦是否比场下候选更适合作为炮灰"的判断逻辑
- [ ] 增加跨回合标记 `pendingRoyalEntry`：本回合决定送炮灰，下回合知道要换王牌上来收掉

---

### v1.0 已合入改动的实战验证（需 PO 环境）

> 改动 A/B/D 的参数均为经验估算，需要实战数据来校准。

- [ ] 跑 ≥50 局并收集 `print_s` 日志，统计以下指标：
  - 自损招（流星群 / 过热等）的使用频次是否合理（改动 B）
  - 对手攻击强化 ≥2 后 AI 换人率变化（改动 A）
  - softmax 候选数分布（candidates=1 / 2 / 3+ 的各自比例）（改动 D）
- [ ] 根据实战结果调整改动 B 系数（当前 0.60 / 0.70 / 0.85）——若流星群出现过少则上调，过多则下调
- [ ] 根据实战结果调整改动 D 阈值（当前 75 / 85 / 90）——若 AI 出招仍可预测则降阈值扩宽候选集
- [ ] 验证 `getOpponentDecisionPool` 返回值分布是否合理（是否存在长期为 0 或长期满 100 的情况）

---

### 需要 PO 运行环境才能推进

> 必须在 PO 客户端挂 [test_callbacks.js](test_callbacks.js) 实战才能完成。在本地无法做。

- [ ] 探索 `battle.data.team(int)` 返回值结构（队伍数据组织方式）
- [ ] 探索 `battle.data.avatar(int)` 返回值
- [ ] 验证 `battle.battleCommand` / `switchClicked` / `attackClicked` 的实际调用效果与参数约束
- [ ] 扩展 [test/battleLog.md](test/battleLog.md) 采样：覆盖更多场景（天气 / 场地变更、多段技、状态异常、濒死强制交换、Mega 演化、Z 招式、动态 Max 等）
- [ ] 实战中验证 [20201227.js](20201227.js) AI 的判定正确性，记录回归点

---

### DeepSeek 接入（LLM 决策，deepseek-bridge/）

> 用 DeepSeek 代替/辅助现有 `attemptCommand()` 决策。链路：PO QScript → 本地 Node 代理 [deepseek-bridge/server.js](deepseek-bridge/server.js) → DeepSeek API。测试脚本 [deepseek-bridge/deepseek-test.js](deepseek-bridge/deepseek-test.js)。

**已完成**：

- [x] 连通性验证：PO ↔ 代理 ↔ DeepSeek 往返（dummy 请求）
- [x] 最小决策闭环：DeepSeek 返回 attack/switch 指令，PO 用 `battle.battleCommand` 执行（attack 与 switch 执行链路均已验证）

**待办**：

- [ ] 场况注入 prompt：采集双方场上/后备/招式（名称/属性/威力/PP）/HP/能力等级/天气场地，拼进 prompt 让 DeepSeek 基于局势决策
- [ ] hybrid 预计算：PO 侧复用 `attemptCommand` 里的 `getMoveDamage` / `getBestSwitchList` 等，把每个可用招式的伤害分布、克制倍率、换人评估算好，作为结构化数据注入 prompt（而非让 DeepSeek 动态重算）
- [ ] 合入主脚本 `20201227.js` 的 `onChoiceSelection`，与现有 `attemptCommand()` 做成开关切换，脱离独立测试脚本
- [ ] 异步化防超时：用 `sys.webCall` 异步回调替代 `synchronousWebCall`，避免 DeepSeek 延迟阻塞 Qt 事件循环 / 触碰回合计时
- [ ] **战报历史注入（最终形态）**：把对战已进行的回合战报（谁用了什么招、伤害、换人、KO、状态变化）解析成结构化上下文，随每回合状态一起注入 prompt，让 DeepSeek 具备跨回合记忆 / 长程决策能力（对应 PokeLLMon 的 in-context RL 文本反馈思路，见 docs/research）
- [ ] **未来形态（远期）· function calling / tool**：把伤害计算等确定性函数包装成 tool 供 DeepSeek 在决策前动态调用（coding 工具那种 agent 模式）。需自建 harness（tool 执行器 + 多轮往返 + 状态管理 + 超时），或把纯函数移植到 Node 代理侧预计算。当前环境 QScript 只能 webCall/同步 GET 且阻塞事件循环，手搓 harness 代价高，**先走 hybrid 预计算注入 prompt 路线**，待链路成熟后再评估是否值得做真 function calling

---

### 长期重构（低优先，需重新评估收益）

- [ ] 将 [20201227.js](20201227.js) 核心逻辑迁移到 [src/core/battleAI.js](src/core/battleAI.js)（目前只有骨架）
  - **注意**：Node.js 环境下没有 `battle` / `sys` 对象，迁移后也无法脱离 PO 独立运行。如果迁移目的只是"代码整洁"，建议先保持单文件但加强注释分块；真正拆分前应先明确能带来什么好处（单元测试？离线回放？）
- [ ] 按 [docs/architecture/modular-ai-architecture.md](docs/architecture/modular-ai-architecture.md) 的 5 模块方案拆分（游戏规则 / 信息收集 / 信息推理 / 推算 / 决策）
