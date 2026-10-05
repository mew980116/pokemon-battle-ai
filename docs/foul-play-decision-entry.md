# Foul Play 决策入口

本文记录当前 Foul Play baseline 的 PS 输入、状态更新、信息采样和动作搜索边界。
目标是为后续 `DualViewState`、belief sampler、oracle 和 shadow prediction 提供稳定的
集成入口，不改变 baseline 的搜索算法。

## 版本边界

| 组件 | 路径 | 当前版本 |
| --- | --- | --- |
| Foul Play baseline | `D:\Other\ai\foul-play` | `5bd041d62a6f4c8587699a598a9a92407383e4f3` |
| Foul Play lab | `D:\Other\ai\foul-play-lab` | `552070acd9f4671f4f9cdce478f966c23a1d415d` |
| poke-engine | `D:\Other\ai\poke-engine` | `7126ba7ba9029f24cbddefdd6e9dc6193ee72d33` |
| PS simulator | `D:\Other\ai\ps-sim` | `a5df8274e85b0889bf2a9b3422a08b39732374fc` |

baseline checkout 只用于对照，不在其中修改源代码。后续 DualView 相关实现优先放入
`foul-play-lab`，集成和回放代码放入 `pokemon-battle-ai`。

## 输入与对局生命周期

入口文件：`foul-play/fp/websocket_client.py`

```text
PS WebSocket
  -> PSWebsocketClient.receive_message()
  -> fp.run_battle.pokemon_battle()
```

关键方法：

- `PSWebsocketClient.create()`：建立 WebSocket 连接。
- `login()`：接收 `challstr`，通过 HTTP login endpoint 获取 assertion，再发送 `/trn`。
- `challenge_user()`、`accept_challenge()`、`search_for_match()`：建立对局。
- `send_message()`：将 room 和命令拼成 PS 协议帧。
- `receive_message()`：返回未经解析的原始消息。

`foul-play` 的 WebSocket client 不是独立的 protocol replay API。要做可重复回放，
应在 `pokemon-battle-ai` 中保存原始 PS 帧，并通过独立 replay adapter 驱动同一套
状态更新逻辑；不要让 replay 依赖真实 WebSocket。

## Battle state 更新链路

入口文件：`foul-play/fp/run_battle.py`

实时链路：

```text
pokemon_battle()
  -> async_update_battle(battle, msg)
  -> update_battle(battle, msg)
  -> battle.msg_list
  -> process_battle_updates(battle)
```

`process_battle_updates()` 根据 `split_msg[1]` 分派 PS action，当前覆盖的主要 action
包括：

- 状态和请求：`request`、`inactive`、`inactiveoff`、`turn`；
- 出场：`switch`、`drag`、`faint`；
- 动作：`move`、`cant`；
- HP 和伤害：`-damage`、`-heal`、`-sethp`；
- 属性和能力：`-boost`、`-unboost`、`-status`、`-ability`、`-item`；
- 形态和战斗机制：`-formechange`、`-transform`、`-mega`、`-terastallize`；
- 场地和 side condition：`-weather`、`-fieldstart`、`-fieldend`、
  `-sidestart`、`-sideend`。

核心状态对象在 `foul-play/fp/battle.py`：

- `Battle`：battle tag、双方 `Battler`、天气、场地、回合、`request_json` 和
  `msg_list`。
- `Battler`：active、reserve、side condition、last used move 和本方选择动作。
- `Pokemon`：HP、stats、moves、item、ability、status、boosts、tera 等。

本地控制方的 `request` 处理位于：

```text
fp.battle_modifier.request()
  -> battle.rqid
  -> battle.force_switch
  -> battle.wait
  -> battle.request_json
```

随后 `Battler.update_from_request_json()` 将本方 request 中的 active、moves、PP、
disabled 状态和可用战斗机制写入内部状态。该 JSON 是本地控制方的私有输入，不能直接
复制到对手视角。

## Gen 9 Random Battle 的当前采样

入口文件：`foul-play/fp/search/random_battles.py`

```text
find_best_move()
  -> prepare_random_battles()
  -> get_all_remaining_sets_for_revealed_pkmn()
  -> RandomBattleTeamDatasets.get_all_remaining_sets()
  -> populate_randombattle_unrevealed_pkmn()
```

当前行为：

1. 对已揭示的对手 Pokémon，从剩余合法 sets 中按 dataset count 加权采样；
2. 对未揭示的对手 Pokémon，用 `sample_randombattle_pokemon()` 补全到六只；
3. 使用基础的物种重复、属性弱点、类型数量和四倍弱点约束；
4. 对 sampled battle 调用 `lock_moves()`；
5. 每个 sampled battle 独立生成，当前没有跨样本的 joint consistency 过滤。

当前采样器的职责是为 Foul Play 自身搜索补全隐藏状态，不等价于双向信息集：

- 它只对 `battle.opponent` 采样；
- 没有记录“对手知道我方哪些字段”；
- 没有生成“对手视角下我方可能配置”的候选集合；
- 没有对候选配置应用双方可见性边界。

因此后续应在 lab 中新增独立的 belief 层，而不是把现有随机采样器直接改造成
双向状态容器。

## Foul Play 决策入口

入口文件：`foul-play/fp/run_battle.py` 和 `foul-play/fp/search/main.py`

```text
pokemon_battle()
  -> async_pick_move()
  -> deepcopy(battle)
  -> Battle.update_from_request_json()  # 非 team preview
  -> find_best_move()
```

`find_best_move()` 的当前顺序：

1. 对 `Battle` 做 `deepcopy`；
2. team preview 时准备 active 占位 Pokémon；
3. 根据 battle type 选择采样器：
   - Gen 9 Random Battle：`prepare_random_battles()`；
   - Battle Factory：当前也复用 random battle sampling；
   - Standard Battle：`prepare_battles()`；
4. 对每个 sampled `Battle` 调用 `battle_to_poke_engine_state()`；
5. 将 `State` 序列化为 `State.to_string()`；
6. 通过 `ProcessPoolExecutor` 并行调用 `get_result_from_mcts()`；
7. 调用 Python binding 的 `monte_carlo_tree_search()`；
8. 通过 `select_move_from_mcts_results()` 聚合每个 sample 的根节点 visit
   分布，并返回最终动作。

当前动作选择的关键逻辑：

```text
每个 sample:
  action_weight += sample_chance * action_visits / total_visits

保留聚合权重 >= 最大权重 * 0.75 的动作
再按聚合权重随机选择一个动作
```

这意味着 Task 9 的根节点动作重加权可以先在 Python 层实现，不需要修改
poke-engine 的 Rust 搜索实现。

## Python 与 poke-engine 的边界

转换入口：`foul-play/fp/search/poke_engine_helpers.py`

```text
Foul Play Battle
  -> battle_to_poke_engine_state()
  -> PokeEngineState(...)
  -> State.to_string()
  -> PokeEngineState.from_string()
  -> monte_carlo_tree_search()
```

Python 层负责：

- PS 协议和 battle lifecycle；
- `Battle`、`Battler`、`Pokemon` 状态；
- 对手 set 推断和随机采样；
- sampled battle 的权重和动作聚合。

Rust/PyO3 层负责：

- `State` 的规则状态；
- action option 生成；
- MCTS 搜索；
- 根节点每个动作的 `total_score`、`visits`；
- `iteration_count`。

绑定文件：`poke-engine/poke-engine-py/src/lib.rs`

当前 `mcts(py_state, duration_ms, threads)` 返回：

- `side_one`：我方根动作列表；
- `side_two`：对手根动作列表；
- 每个动作的 `move_choice`、`total_score`、`visits`；
- `iteration_count`。

当前不建议修改 poke-engine。第一阶段所需的 oracle 和 shadow prediction 可以
复用该边界：以不同的 `State` 视角分别调用同一个 policy oracle，然后在 Python 层
组合预测分布。

## PS protocol replay

集成仓库的离线回放入口为：

```text
D:\Other\ai\pokemon-battle-ai\platform\ps\protocol-replay.js
```

它接受原始 PS protocol、benchmark 单行 JSON、JSON array 和 JSONL client protocol
log，并通过现有 `adapter.parseProtocol()` 与 `BattleSession` 重建状态。该工具只做
状态回放和摘要，不连接 WebSocket、不发送动作、不读取私服凭据。

回放测试位于：

```text
D:\Other\ai\pokemon-battle-ai\platform\ps\test-protocol-replay.js
```

注意：benchmark 的 `protocol` 字段目前保存规范化事件，通常不包含完整 `request`
JSON。因此它适合验证公开战报和状态迁移；要验证本方 request 私有字段，必须使用
保存了完整 `request` 的原始客户端日志或专门的 replay fixture。

## 双向信息层的边界约定

后续 `DualViewState` 至少要区分以下四类数据：

| 数据层 | 含义 | 是否可直接进入对手视角 |
| --- | --- | --- |
| `private_self` | 我方真实 request、完整 moves、未公开 item/ability 等 | 否 |
| `public_state` | 双方通过 PS protocol 已观察到的信息 | 是 |
| `belief_opponent` | 我方对对手隐藏配置的候选/分布 | 仅供我方决策 |
| `belief_self_as_seen_by_opponent` | 对手基于公开信息对我方配置的候选/分布 | 可用于预测对手策略，但不能当作我方真实状态 |

在 Gen 9 Random Battle 第一阶段，建议先固定以下规则：

1. 真实我方状态只保存在我方 private view；
2. 对手 view 只能从公开 protocol 事件和公开 team preview 重建；
3. 我方已知但尚未公开的 moves、item、ability、tera type、set 参数不得泄漏；
4. belief sampler 输出候选配置时必须携带来源和可见性理由；
5. 一致性过滤只使用候选视角当时已经能观察到的事件；
6. policy oracle 输入必须明确标注 `perspective` 和 `information_set_id`。

## 后续任务对应入口

| 任务 | 首选位置 | 说明 |
| --- | --- | --- |
| PS protocol replay | `pokemon-battle-ai/platform/ps` | 保存原始帧并重放，不接真实 WebSocket |
| `DualViewState` | `foul-play-lab/fp` | 不修改 baseline checkout |
| 可见性测试 | `foul-play-lab/tests` | 覆盖 private/public/belief 隔离 |
| Gen 9 belief sampler | `foul-play-lab/fp/search` 或独立 belief 模块 | 复用 dataset，不复用视角语义 |
| 一致性过滤 | lab belief 模块 | 只用公开事件约束 |
| Foul Play offline oracle | lab/integration 层 | 复用现有 `find_best_move()` 和 MCTS binding |
| shadow prediction | integration 层 | 运行对手视角 oracle，记录动作分布 |
| 根节点重加权 | `fp/search/main.py` 的 lab 副本或 wrapper | 先不改 Rust engine |
