# V1.1.2 实测 Checklist

> 用 `mew's` 账号对战，打开 PO 脚本控制台收集 `print_s` 日志。
> v1.1.2 仅修一个回归 bug：softmax 阈值过滤后候选只剩 1 个时强制采用该唯一候选。
> 问题根因见 [feedback/v1.1.1/analysis.md](../v1.1.1/analysis.md) 第 1 节。
> v1.1.1 / v1.1 基础验证项继续有效（见各自 checklist）。

---

## A. candidates=1 强制采用唯一候选

**触发条件**：finalScore 阈值过滤后 `candidates=1`（残局低 T、thresh 高时高频）。

- [ ] `candidates=1` 时，日志 `chosen=` 的 slot **等于**候选集里那一个招式的 slot
- [ ] `candidates=1` 时，`chosen` 的招式名 **等于** `[...]` 方括号里显示的那个招式名
- [ ] 不再出现 `candidates=1 chosen=X(招A) [招B]=100`（chosen 与候选集不一致）的矛盾日志
- [ ] 残局（alive=2，T≤0.8，thresh=0.85）回合：若评分最优招唯一通过 floor，AI 实际打出的就是它

**复盘验证（case7-R14 场景）**：
- 多龙巴鲁托对捷拉奥拉，流星群 damagePercent>1（可秒），floor 过滤后只剩流星群
- 修复前：`candidates=1 chosen=1(暗影球) [流星群]=100`（错误，打出次优暗影球）
- 修复后：应为 `candidates=1 chosen=0(流星群) [流星群]=100`（打出流星群）

## B. 负向回归（确保不破坏 candidates>1 路径）

- [ ] `candidates>1` 时，加权采样仍正常工作（chosen 在候选集内，按权重分布）
- [ ] `candidates=0` 不会发生（最强招必然通过 thresh，见 v1.1.1 保证）
- [ ] 单招宝可梦 / 全程只有 1 个攻击招可用时，行为正常（chosen 就是该招）

---

## C. Bug 记录模板

```
**Bug #NNN**
- 触发条件：
- 观察到的行为：
- 预期行为：
- 相关日志（截取关键行）：
- 推测代码位置：
- 候选修复方案：
```
