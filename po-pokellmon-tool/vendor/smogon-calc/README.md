# vendor/smogon-calc — 内嵌 Pokémon Showdown 官方伤害计算器

来源：npm 包 **@smogon/calc v0.11.0**（https://github.com/smogon/damage-calc）
许可：**MIT**（见下方原文）

## 为什么内嵌

`po-pokellmon-tool/tools.js` 的 `calc_damage` 需要计算**特性 / 道具 / 天气 / 场地 / 光墙 / 状态**等修正。
这些规则散落在官方计算器的 `mechanics/` 里（`calculateAtModsSMSSSV` / `calculateDfModsSMSSSV` /
`calculateFinalModsSMSSSV` / `calculateBasePowerSMSSSV`…），手工移植既有遗漏风险也难以长期对齐。
本目录是官方 `dist/`（去掉 `*.map` 与浏览器用 `production.min.js`）的原样拷贝，**未做任何修改**。

- 依赖为零：所有 `require()` 都是相对路径，所以放进仓库即可运行，**不需要 npm install**
  （本仓库在网络共享盘上，npm 在 UNC 路径有 realpath bug，装不了包）。
- 已验证 **gen=8 数据正确**：`new Pokemon(8, 'Cresselia')` 的 Def 用 Gen8 的 120（而非 Gen9 的 110）、
  `Zacian` 的 Atk 用 Gen8 的 170（而非 Gen9 的 150）。
- 升级方式：`npm i @smogon/calc@<ver>` 到任意本地盘，再把新版 `dist/` 按同样规则拷过来覆盖本目录，
  同步更新上面的版本号，然后跑 `node po-pokellmon-tool/test-calc-compare.js`。

## 用法（tools.js）

```js
var SMOGON = require('./vendor/smogon-calc/index.js');
var atk = new SMOGON.Pokemon(8, 'Garchomp', { evs: {...}, nature: 'Jolly', ability: 'Rough Skin' });
var def = new SMOGON.Pokemon(8, 'Blissey', { evs: {...}, item: 'Leftovers' });
var res = SMOGON.calculate(8, atk, def, new SMOGON.Move(8, 'Earthquake'), new SMOGON.Field({ weather: 'Sand' }));
res.range();      // [min, max]
res.damage;       // 16 档伤害（连击招是每档子数组）
```

## 许可原文（MIT）

```
MIT License

Copyright (c) 2018 Austin Couturier

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
