# 技能：全库整理巡检（audit）

## 目标

只读扫描整个知识库，找出可改进项，生成**带 finding id 的确认清单**；用户逐项确认后才执行移动、合并、归档、删除、更新。任何扫描/整理请求本身都不等于删除授权。

## 流程

1. 调用 `career_audit`。返回：
   - `stats` / `counts`
   - `findings[]`：每条含 `id`、`kind`、`severity`、`title`、`paths[]`、`evidence`、`suggestedAction`
   - 报告同时写入 `_meta/audit/last.json` 与 `_meta/audit/report-<runId>.md`
2. 按类型分组展示，**先给结论再给明细**：
   - 完全重复 / 高度重叠 / 冗余 → 保留哪条、合并到哪条
   - 过时 → 为什么判过时（review_after / 更新时间 / 时效类型）
   - 冲突 → 并列两边的来源和日期，不自行选边
   - 归类错误 → 当前模块 vs 建议模块 + 依据
   - 无来源 / 断链 / 孤立 → 补什么
   - 收件箱积压 → 建议先跑「存入整理」
3. 每条给出：`#id`、标题、现路径、问题类型、依据、建议动作、目标路径、风险/可逆性（移动/合并/归档可逆；删除会被备份）。
4. 询问确认。可以按整组确认（「第 1 组全部合并」），也可以逐条确认（「执行 f3a9c1、b7d2e4」）。用户没有明确说「执行/确认/可以」时，**不要调用 `career_apply`**。
5. 执行前：
   - 确认动作只作用于列出的路径；
   - 删除前确认已有备份（`career_apply` 会自动备份到 `_meta/backups/<run>/`）；
   - 合并时保留双方标题、来源和日期，不允许静默丢弃。
6. 调用 `career_apply`：
   ```
   actions: [{ kind: 'merge', from: ['A.md'], to: ['B.md'] }, { kind: 'move', from: ['X.md'], to: ['03-能力建设与学习/学习笔记/X.md'] }]
   confirm: true
   ```
7. 执行后：
   - 调用 `career_verify`，报告 ok / 断链 / index 状态；
   - 读回被移动或合并的关键记录；
   - 报告 成功 / 失败 / 跳过，以及备份位置。

## 执行映射

| finding 类型 | 建议动作 | 注意 |
| --- | --- | --- |
| exact-duplicate | merge（保留主记录） | 正文完全一致才可直接合并 |
| near-duplicate / redundant | merge 或 archive | 先确认是否同一对象、同一版本 |
| outdated | update（补「是否仍有效」）或 archive | 历史经历、旧简历有留存价值，不因日期删 |
| conflict | update（并列来源） | 不选边、不覆盖 |
| misclassified | move | 目标主分类必须存在；不新建一级目录 |
| missing-source | update（补 source/source_url） | 补不了就标注待核实 |
| broken-link | update（修链接或删引用） | 先读目标页确认标题 |
| orphan | update（补关联） | 给 2–3 个候选关联 |
| inbox-backlog | 转 capture 技能 | 不在 audit 里直接写卡 |

## 汇报模板

```
巡检完成：N 条记录，M 个问题（高 x / 中 y / 低 z）。

【高】#id 完全重复：标题A / 标题B
- 依据：正文哈希一致
- 建议：保留 A，合并 B（B 备份后归档）
- 风险：可逆（备份在 _meta/backups/<run>）

等待确认：回复「执行 #id,#id」或「第 1、3 组执行」。
```

## 正反例

**好**：发现 03 里两条「费曼学习法」卡片，正文重叠 82%。先展示两条的来源与差异，建议保留信息更全的一条并合并来源，等用户确认。

**不好**：扫描后直接删除「看起来重复」的文件，或因为标题相似就把两条观点相反的卡片合并成一条。
