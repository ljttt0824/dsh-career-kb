# 职业生涯知识库（dsh-career-kb）设计方案

## 0. 这个插件是干什么的

### 0.1 它解决的问题

求职期的资料天然是散的：简历版本在网盘、面经在飞书、项目复盘在笔记、JD 在聊天记录、随手刷到的行业文章在收藏夹。真正要用的时候——写简历、准备面试、复盘一场面试——要在十几个地方来回翻，还容易把「听来的经验」写成「自己的经历」。

dsh-career-kb 把这件事收敛成一个**本机 Markdown 职业档案 + 一组可执行技能**：

- 一个 Obsidian 能直接打开的六模块知识库，作为职业事实的唯一主档；
- 十个技能把日常动作变成可复用流程：搭建、存入、导入、巡检、简历、面试准备、面试复盘、检索、JD 拆解、周期复盘；
- 所有写入都强调「先读后写、写完读回、删除先备份、批量动作先确认」；
- 装了飞书插件时，成果可以同步到用户自己的飞书空间；没装也能完整工作。

### 0.2 它给出的四类结果

插件不把「整理」做成一个黑盒按钮，而是把动作拆成四类可核对的结果：

| 结果 | 触发 | 是否修改文件 |
|---|---|---|
| **已保存** | `career_save` / 选中文字 / `/career-save` | 只新增收件箱原始记录，不改动既有档案 |
| **整改建议** | `career_audit` / `/career-audit` / 面板「巡检全库」 | 不修改；每条建议带 `id`、证据、建议动作 |
| **已执行变更** | `career_apply`（必须 `confirm=true`） | 移动/合并/归档/删除/更新；执行前自动备份，执行后重建索引 |
| **自检报告** | `career_verify` / 面板「自检」 | 不修改；输出结构、解析、ID、链接、索引、备份六类检查 |

一句话：**能证明的问题才列出来，能回滚的动作才执行，执行完必须能读回。**

### 0.3 六个模块与十个技能

**六大模块**（与旧版 Skill 的目录规则一致，迁移自飞书时保留原结构）：

| 模块 | 保存内容 |
|---|---|
| 01-职业规划与目标 | 阶段目标、方向选择、行动计划 |
| 02-求职与实习 | 岗位 JD、简历版本、投递台账、面试准备、面试复盘 |
| 03-能力建设与学习 | 技能树、学习笔记、方法论 |
| 04-项目与成果沉淀 | 项目档案、实习复盘、作品集 |
| 05-个人背景与经历 | 个人画像、偏好约束、人脉资源 |
| 06-行业洞察与社会感知 | 行业观察、赛道分析 |

**十个技能**（SOP 以 Markdown 形式随包分发，运行时读取）：

| 技能 | 命令 | 做什么 |
|---|---|---|
| setup | `/career-setup` | 访谈式建档：画像、规划、首页索引 |
| capture | `/career-save` | 剪藏/帖子/网页/选中文字 → 可学习、可复习、可复用的知识卡 |
| import | `/career-import` | 把飞书知识库/云文档/本地目录导入六大模块，保留原文与来源 |
| audit | `/career-audit` | 全库巡检：重复、冗余、过时、冲突、错类、无来源、断链、孤立、积压 |
| resume | `/career-resume` | 按 JD 检索证据，输出证据矩阵与不造假的简历 |
| interview-prep | `/career-prep` | JD + 经历 + 联网面经：自我介绍、复习清单、题库、项目深挖、模拟面试 |
| interview-review | `/career-review` | 真实面试 → 经验沉淀、改进动作、下一轮准备 |
| search | `/career-search` | 带路径与来源的检索问答 |
| jd-decode | `/career-jd` | 要求拆解、证据匹配、缺口与投递优先级 |
| weekly-review | `/career-weekly` | 周/月复盘，回写规划与投递台账 |

### 0.4 四个入口

1. **斜杠命令**：`/career-*` 直接执行，命令本身不进入模型消息；处理器把对应 SOP 交给当前 agent。
2. **选中文字**：在对话中选中任何一段文字，浮出「存入知识库」按钮；右键菜单也有「存入职业生涯知识库」。保存后按 `capture` 技能整理，并（在飞书工具可用时）同步飞书。
3. **回答书签**：每条 AI 回答下方有书签图标，保存整条回答。
4. **侧栏面板「职业生涯」**：记录数/收件箱/巡检问题/飞书状态；收件箱列表；巡检结果勾选与「执行已选」；自检；日志尾部。

### 0.5 什么时候会花 token

插件自己**不主动调用模型**：

- **0 token**：保存原文、索引、检索、巡检、自检、面板渲染、执行确认后的整理动作；
- **常驻开销**：一段系统提示（技能目录 + 真实性红线 + 飞书写入规则）+ 10 个工具定义；
- **按需花费**：`/career-*` 命令或对话请求触发 agent 执行 SOP 时的模型调用；`/save` 选中文字后如果当前有活跃 agent，会 steer 一条 capture 提示。

---

## 1. 问题定义与设计约束

要回答的问题不是「帮用户写一段简历」，而是「怎样让职业事实可追溯、可复用、可安全整理」。由此推出六条硬约束：

1. **事实可追溯**。个人经历、职责、时间、数字、学历只能来自知识库已确认记录或用户本次陈述；无证据即标「待核实」。
2. **先读后写，写完读回**。所有写入前搜索同一对象主记录，写入后读回核对并报告真实路径。
3. **批量动作必须确认**。删除/移动/合并/归档需用户明确同意；`career_apply` 在 `confirm!==true` 时直接拒绝。
4. **可回滚**。每次变更前把原文件复制到 `_meta/backups/<runId>/`；删除也先备份。
5. **本地优先，外部可选**。本地 vault 是主档；飞书同步失败不影响本地落盘，且必须如实报告「未同步/仅本机」。
6. **只做插件该做的事**。不保存飞书凭证、不重复实现飞书 API、不在后台自动跑模型、不写用户没有授权的系统位置。

---

## 2. 总体架构

```
用户/Agent
   │  命令 / 工具 / 面板 / 选中文字
   ▼
lib/index.js（宿主组合根）
   ├─ ctx.inject(['tools'])       → 10 个 career_* 工具
   ├─ ctx.inject(['commands'])    → 11 个 /career* 命令，steer 技能 SOP
   ├─ ctx.inject(['systemPrompt'])→ tool:career-kb 常驻段
   └─ ctx.inject(['webServer'])   → /api/career-kb/{health,state,save,audit,apply,verify,reindex}
             ▲
             │ 同源 HTTP
lib/client.js（浏览器半）
   ├─ sidebar.panellist + main          → 「职业生涯」面板
   ├─ conversation.chat.assistant-actions → 回答书签
   └─ document mouseup/contextmenu       → 选中文字浮动按钮/右键菜单
             │
             ▼
lib/core.js（纯 Node，全部领域逻辑）
   ├─ 布局/路径/原子写入
   ├─ frontmatter 解析/渲染、catalog、search
   ├─ audit：10 类检测 + 建议动作
   ├─ apply：move/merge/archive/delete/update/create + 备份
   ├─ verify：6 类不变量
   └─ index/log 重写
             │
             ▼
职业档案（Markdown，默认 <DSH_HOME>/storages/career-kb，可用 dataDir 覆盖）
```

分层原则：

- **core.js 不依赖 DSH**：只 import Node 内置模块，测试可脱离宿主直接跑；
- **index.js 是唯一组合根**：注册工具、命令、提示、路由，不写业务判定；
- **skills.js 只做加载与提示拼装**：SOP 是文件，改 SOP 不需改代码；
- **client.js 不直接读磁盘**：所有数据走同源 API。

代码量：`core.js` 约 1,200 行，`index.js` 约 500 行，`client.js` 约 500 行，`skills.js` 约 180 行；SOP 约 480 行；模板 8 套；示例 5 份。

---

## 3. 数据层

### 3.1 目录布局

```
career-kb/
├── 00-收件箱/                  # 选中文字、剪藏、待整理原始资料
├── 01-职业规划与目标/
├── 02-求职与实习/
├── 03-能力建设与学习/
├── 04-项目与成果沉淀/
├── 05-个人背景与经历/
├── 06-行业洞察与社会感知/
├── _meta/
│   ├── audit/last.json          # 最近一次巡检报告
│   ├── audit/report-<runId>.md  # 可读版报告
│   ├── backups/<runId>/...      # 每次变更前的原文件副本（保留相对路径）
│   ├── archive/<date>/...       # 归档目标
│   └── settings.md              # 来源收件箱、排除项、飞书偏好
├── index.md                     # 自动维护的索引
└── log.md                       # 操作日志
```

`resolveDataDir` 的解析顺序：`config.dataDir` → `<DSH_HOME>/storages/career-kb`。开发机上可以把目录放在 D 盘，再用目录 junction 把旧路径接回去，插件无需改配置。

所有落盘路径经 `resolveInside(vault, rel)` 校验，拒绝 `..` 与绝对路径逃逸。

### 3.2 记录格式

每篇 Markdown 由 YAML frontmatter + 正文组成：

| 字段 | 说明 |
|---|---|
| `id` | 稳定标识；本地生成 `YYYYMMDD-<prefix>-<hex>`；导入记录沿用来源 node token |
| `title` | 标题，同时作为 `[[链接]]` 的目标 |
| `type` | 技术/概念认知/方法经验/他人经验/行业信息/岗位JD/简历/面试准备/面试复盘/项目档案/个人画像/规划/投递记录/其他 |
| `module` | 模块 key（01–06；收件箱为 inbox） |
| `status` | active / archived / inbox |
| `source` / `source_url` | 来源平台、原文链接 |
| `captured` / `updated` / `review_after` | 采集、更新、复查日期 |
| `confidence` | confirmed / unverified |
| `tags` | 标签数组 |
| `conflict_of` | 显式冲突对象（用于冲突检测） |
| `origin` | 导入来源标记，例如 `feishu-import` |

解析器是**自带的 YAML 子集**（标量、引号、行内数组、块数组），不引入第三方依赖；解析失败不抛异常，退化为空 frontmatter + 正文，由「记录可解析」检查兜底。

### 3.3 索引与日志

- `index.md`：每次应用动作或 `career_reindex` 后全量重写，按模块列出全部活动记录、收件箱、概览计数。
- `log.md`：追加式，记录存入、移动、合并、归档、删除、执行批次与来源。
- 所有写入使用「先写临时内容再替换」的语义（`fs.writeFile` 到目标路径；备份先复制），不并发写入同一文件。

---

## 4. 审计层

`auditVault(vault, options)` 读出全部活动记录，逐类检测，输出：

```
{ runId, generatedAt, vault, stats {cards,inbox,modules,totalBytes},
  counts {kind: n}, findings[{id, kind, severity, title, paths[], summary,
  evidence, suggestedAction, confirmRequired:true}], notes[] }
```

### 4.1 十类检测

| 类型 | 判定 | 严重度 |
|---|---|---|
| `exact-duplicate` | 正文归一化后 sha1 相同（<80 字节不判） | 高 |
| `near-duplicate` | 标题/标签预筛后，正文 shingle Jaccard ≥ 0.9 | 高 |
| `redundant` | 一篇的 shingle 包含度 ≥ 0.94 且另一篇至少大 1.5 倍 | 中 |
| `outdated` | `review_after` 已过；或 技术/行业/概念 类超过 540 天未更新 | 中/低 |
| `conflict` | 显式 `conflict_of`；或共享标签 + 标题相似 + 一方否定、一方肯定 | 高/中 |
| `misclassified` | ① `module` 与所在目录不一致；② 类型与模块不一致；③ 非导入记录的关键词建议 | 高/中/低 |
| `missing-source` | 技术/行业/概念/方法/他人经验类没有 `source` 与 `source_url` | 低 |
| `broken-link` | `[[目标]]` 找不到同名记录或 ID | 低 |
| `orphan` | 无出链、无反向链接、正文 >600 字节 | 低 |
| `inbox-backlog` | 收件箱有条目 | 中 |

### 4.2 相似度与阈值

- shingle：中文按二字组、拉丁按词切分，去重成集合；
- 预筛：标题 Jaccard ≥ 0.34 或共享至少一个标签，避免全量 O(n²)；
- 近似对扫描上限 400 对，超出后停止扩展，行为可预期；
- 完全重复的主记录选择：优先没有 `copy/副本/备份/old` 字样的文件，其次路径层级更浅的。

### 4.3 归类建议为什么保守

早期版本按「正文关键词计数」猜模块，长文档会被 03 的宽泛词库淹没：一份 02 的面试手册因为大量出现 RAG/Prompt/知识/学习，会被建议去 03。修复后的规则：

1. **声明与路径**：`module` 与目录不一致 → 高置信度；
2. **类型优先**：`面试准备/简历/面试复盘/岗位JD/投递记录 → 02`、`项目档案 → 04`、`个人画像 → 05`、`规划 → 01`、`行业信息 → 06`，类型与目录不一致 → 中置信度；
3. **导入档案不做关键词猜模块**：`origin: feishu-import` 或来源含「飞书知识库」的记录直接跳过关键词建议，保留用户原目录结构；
4. **关键词建议**：标题 ×6、标签 ×4、正文 ×1，每词最多计 3 次；预测分 ≥12 且比当前模块高 ≥8 才提示，严重度低。

### 4.4 巡检不修改任何文件

审计只读；报告写入 `_meta/audit/`。是否执行、执行哪几条，由用户确认后交给 `career_apply`。

---

## 5. 变更层

`applyActions(vault, actions, {confirm})`：

- `confirm !== true` 直接抛错：**「扫描/整理」不等于删除授权**；
- 支持动作：

| 动作 | 行为 |
|---|---|
| `move` | 备份原文件 → 建目标目录 → 重命名 |
| `merge` | 备份双方 → 把被合并正文追加到目标（带「合并自」来源标注）→ 被合并文件留归档桩 |
| `archive` | 备份 → 移到 `_meta/archive/<date>/<原相对路径>` |
| `delete` | 备份 → 删除（备份在 `_meta/backups/<runId>/`） |
| `update` | 备份 → 全量替换内容，或 patch frontmatter 并更新 `updated` |
| `create` | 在指定相对路径写新文件 |

- 每个动作独立 try/catch，逐条返回 `{ok, action, detail|error}`，不因一条失败中断整批；
- 批次结束统一 `rewriteIndex` 并追加 `log.md`；
- 结果里带 `runId` 与 `backupDir`，用户可据此回滚。

---

## 6. 自检层

`verifyVault(vault)` 输出 `{ok, checkedAt, stats, checks[]}`，检查：

1. 六大模块/收件箱/meta 目录存在；
2. 全部 Markdown 可解析；
3. 记录 ID 唯一；
4. `[[链接]]` 都能解析（断链为 0）；
5. `index.md` 覆盖全部活动记录；
6. 收件箱计数可读；
7. 备份目录可用。

任一项不满足 `ok=false`，面板与工具都会如实展示，不把「跳过」当「通过」。

---

## 7. 技能层

### 7.1 SOP 即数据

`skills/*.md` 是运行时可读的流程文档，`skills.js` 提供：

- `listSkills()`：技能目录（名称、标题、描述、触发词、命令、输入提示）；
- `readSkillText(name)`：带缓存地读取 SOP；
- `buildSkillPrompt(name, userInput, {dataDir, feishuAvailable, extra})`：把 SOP、数据目录、飞书可用性、工具指南、用户输入、执行要求拼成一段提示。

SOP 修改不需要改代码，也不需要重新构建。

### 7.2 命令如何驱动技能

`/career-*` 命令的 handler 不直接写业务逻辑，而是：

```
agent.steer({ id, role:'user', content:[{type:'text', text: prompt}], source:{kind:'user'} })
```

- 命令本身不产生模型消息，只把 SOP 变成一条受控输入；
- 消息对象只带标准字段，不依赖宿主内部的 `createUserMessage`，避免第三方插件解析到另一份 DSH；
- `/career-audit` 额外要求「先调用 career_audit 取当前扫描结果，确认清单后再 career_apply」；
- `save` 命令在输入为空时直接报错，引导用户粘贴或选中文字。

### 7.3 few-shot 与正反例

- `examples/fewshot-capture.md`：8 个存入场景（技术教程、认知框架、他人经验、行业数据、面经、无法读取、重复、分类不明），每个都给正例/反例；
- `examples/fewshot-audit.md`：6 个巡检场景与「确认后执行」的对话样例；
- `examples/fewshot-resume.md`：证据矩阵、好/坏 bullet、缺口处理；
- `examples/fewshot-interview-prep.md` / `fewshot-interview-review.md`：面试准备与复盘的结构化示例；
- `examples/classification.md`：模块归属对照表。

示例全部脱敏、虚构，不携带个人知识库内容。

---

## 8. 飞书对接层

插件**不重复实现**飞书能力，而是在运行时探测已安装的 `dsh-feishu` 提供的工具：

```
tools.get('feishu_doc'|'feishu_wiki'|'feishu_drive'|'feishu_sheet'|'feishu_bitable'|'feishu_query'|'feishu_message')
```

- `career_status` 与 `/api/career-kb/state` 返回 `feishu.available` 与可用工具名；
- 技能提示里写明「当前是否检测到飞书工具」；
- 写入顺序：**先本机落盘并读回，再尝试飞书同步**；飞书失败只降级为「仅本机」，不丢数据、不假装成功；
- 凭证、token、身份切换全部由 `dsh-feishu` 管理，本插件不读写任何飞书凭证；
- 飞书侧支持的能力边界（如 wiki 不支持 file 节点创建）由技能如实说明并给替代方案。

`import` 技能补充了两条路径：

- 有 API 权限：递归列节点、读正文、按六大模块建本地卡（保留来源 URL 与原文）；
- 只有浏览器登录态：在用户明确授权下导出/复制内容到本地目录，再按本地目录导入；不把「浏览器可见」等同于「API 可授权」。

---

## 9. 客户端层

### 9.1 接入点

| 接入点 | 组件 | 作用 |
|---|---|---|
| `sidebar.panellist` | 侧栏图标 | 「职业生涯」入口 |
| `main` | `Panel` | 记录统计、收件箱、巡检结果、执行确认、自检、日志 |
| `conversation.chat.assistant-actions` | `SaveAssistantButton` | 保存整条回答 |
| `document` 事件 | 选中文字 UI | 浮动「存入知识库」+ 右键「存入职业生涯知识库」 |

### 9.2 选中文字流程

1. `mouseup` 后读取 `window.getSelection()`，忽略输入框/可编辑区域；
2. 在选区下方（或上方）放置浮动按钮，点击后 `POST /api/career-kb/save`，body `{text, source, mode:'auto'}`；
3. 服务端先写收件箱，再尝试 steer 当前 agent 执行 capture 技能；
4. 返回 `{saved:{path,...}, steered:boolean}`，前端 toast 显示「已存入收件箱 + 是否已交给 AI 整理」；失败显示错误 toast。

### 9.3 面板

- 加载 `/state`：统计、收件箱、最近巡检、技能目录、飞书状态；
- 「巡检全库」→ `POST /audit`，渲染 findings；每条带严重度、证据、建议动作；
- 可执行动作（merge/move/archive）提供勾选，「执行已选」二次确认后 `POST /apply` `{actions, confirm:true}`；
- 更新类动作（需要改内容）不允许面板直接执行，提示在对话里处理；
- 「自检」`GET /verify`、「重建索引」`POST /reindex`；
- 所有请求同源，失败有 toast 与理由。

### 9.4 两个实现约束

1. **不假设宿主内部 API**：客户端只依赖 `window.__ModuleLoader__` 工厂 + 官方 slot，不 import `@deepseek-ai/*`；
2. **DOM 全局监听要可回收**：`mouseup/contextmenu/mousedown/scroll/keyup` 都在 `ctx.effect` 的 disposer 中移除，避免热重载后重复绑定。

---

## 10. 接口层

### 10.1 HTTP（同源 `/api/career-kb/`）

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/health` | 插件与数据目录健康检查 |
| GET | `/state` | 统计、收件箱、最近巡检、日志、技能、飞书状态 |
| POST | `/save` | 写收件箱；`mode:auto` 时尝试 steer capture 技能 |
| POST | `/audit` | 只读巡检，返回完整报告 |
| POST | `/apply` | 执行已确认动作（`confirm:true`） |
| GET | `/verify` | 自检 |
| POST | `/reindex` | 重建 index.md |

请求体上限 4MB；错误返回 `{ok:false,error}` 与 HTTP 4xx/5xx。

### 10.2 Agent 工具

| 工具 | 用途 |
|---|---|
| `career_status` | 记录数、模块分布、收件箱、最近巡检、飞书可用性、技能列表 |
| `career_index` | 读取 index.md |
| `career_read` | 按 vault 相对路径读记录 |
| `career_search` | 标题/标签/正文加权检索，返回路径、片段、分数 |
| `career_save` | 原始资料写入收件箱（不整理） |
| `career_audit` | 只读巡检，返回 finding id 与建议动作 |
| `career_apply` | 执行已确认动作（`confirm=true`），自动备份 |
| `career_verify` | 自检 |
| `career_reindex` | 重建索引 |
| `career_skill` | 列出/读取技能 SOP |

### 10.3 斜杠命令

`/career`、`/career-setup`、`/career-save`、`/career-import`、`/career-audit`、`/career-resume`、`/career-prep`、`/career-review`、`/career-search`、`/career-jd`、`/career-weekly`。

---

## 11. 安全与隐私边界

- **数据只在本地 vault**：默认 `%DSH_HOME%/storages/career-kb`，可配置到其他磁盘；插件不向任何第三方上传；
- **飞书写入仅在用户调用时发生**：由 agent 调用 `feishu_*` 工具完成，插件自身不持有凭证、不发起网络请求；
- **HTTP 只挂在 DSH 的 localhost webServer**，没有额外端口；
- **路径逃逸防护**：所有相对路径经 `resolveInside`；
- **删除可恢复**：备份在 `_meta/backups/<runId>`；
- **不做后台自动模型调用**：除用户命令/选中文字 steer 外，插件不主动消耗 token；
- **公开仓库不含个人数据**：`examples/`、`templates/` 全是虚构示例；导入的个人档案只在用户本机。

---

## 12. 成本模型

| 行为 | 花费 |
|---|---|
| 保存原文 / 索引 / 检索 / 巡检 / 自检 / 面板渲染 | 0（纯本地） |
| 常驻开销 | 一段系统提示 + 10 个工具 schema |
| `/career-*` 技能执行 | 由 agent 的模型调用决定，插件只拼提示 |
| 选中文字自动整理 | 若当前有活跃 agent，steer 一条 capture 提示；没有则只落本地 |
| 重复查看巡检结果 | 0（读 `_meta/audit/last.json`） |

---

## 13. 测试与验收

| 套件 | 数量 | 覆盖 |
|---|---|---|
| `test/core.test.mjs` | 10 | 布局、frontmatter、存入、检索、10 类巡检、确认后执行与备份、自检、导入档案不误报、类型/模块不一致 |
| `test/host.test.mjs` | 6 | 10 工具、11 命令、提示段、HTTP 路由、飞书探测、命令 steer |
| `test/client.test.mjs` | 1 | 模块加载、样式、3 个 slot、选中浮动按钮、右键菜单、POST 载荷 |
| `test/interop.test.mjs` | 4 | 技能 SOP 完整性、模板/示例脱敏、与已装 dsh-feishu 工具名对照 |
| 合计 | 19 | `node --test` 全绿 |

浏览器端到端（真实 DSH 隔离 profile + Edge headless CDP，`test/browser-verify.mjs`）16 项：bundle 加载、侧栏入口、面板、统计、收件箱、巡检列表、巡检完成、选中文字、浮动按钮、服务端保存、右键菜单、截图。

已完成的安装验收：

- 桌面 profile 热加载成功（未重启），`career_status` 探测到 7 个飞书工具；
- 空 profile 执行 `dsh plugin add github:ljttt0824/dsh-career-kb` 后启动验证通过；
- GitHub 安装路径与市场收录均验证。

---

## 14. 已知限制与演进

- **巡检是启发式**：冲突检测依赖否定/肯定词与标签相似度；归类建议对导入档案只做类型/路径判断，不做关键词移动。结果始终是「建议」，需要人确认。
- **近似重复阈值保守**：长文可能漏检；对 400 对上限之外的内容不做扫描。
- **本地与飞书是双份**：插件不做双向同步引擎，飞书同步由技能按需执行；两处修改可能分叉，需要用户选择以哪边为准。
- **飞书 wiki 文件节点 API 限制**：file 类型节点创建返回 131002，导入时用「文档页 + 下载链接」承载，原文仍保留在云空间。
- **无后台调度**：没有定时巡检/提醒；需要时由用户触发或由 DSH 调度器另接。
- **大库性能**：catalog 全量读入内存；十万级记录需要分页/索引化，当前面向个人职业档案（百级到千级）。
- **模型判断质量取决于 SOP**：插件提供证据与结构，真实性最终仍由 agent 按 SOP 执行；模型不应被当作事实来源。

---

## 15. 目录索引

```
lib/
  index.js      宿主组合根：工具/命令/提示/HTTP
  core.js       领域引擎：布局/解析/检索/巡检/变更/自检
  skills.js     技能目录与提示拼装
  client.js     浏览器半：面板/选中文字/书签
skills/         10 个 SOP
templates/      8 套结构化模板
examples/       5 份脱敏 few-shot 与正反例
test/           单元/集成/浏览器端到端
docs/           本设计文档、验证报告、飞书对接说明
```
