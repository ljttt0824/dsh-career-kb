/**
 * Seed an anonymized demo vault for verification and screenshots.
 *
 *   node scripts/seed-demo.mjs <vault-dir>
 *
 * Every record is fictional (persona "林一舟"). Never point this at a real
 * vault: it writes demo cards and removes an existing directory first.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'

import { ensureLayout, renderCard, rewriteIndex, saveInbox, todayISO } from '../lib/core.js'

const target = process.argv[2]
if (typeof target !== 'string' || target.trim().length === 0) {
  console.error('用法: node scripts/seed-demo.mjs <vault-dir>')
  process.exit(1)
}
const vault = path.resolve(target.trim())
await fs.rm(vault, { recursive: true, force: true })
await ensureLayout(vault)

async function card(rel, data) {
  const full = path.join(vault, rel)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, renderCard({ captured: todayISO(), updated: todayISO(), ...data }), 'utf8')
}

await card('04-项目与成果沉淀/项目档案/knowledge-graph.md', {
  id: '20260101-project-001',
  title: '课程知识图谱自动构建系统',
  type: '项目档案',
  module: '04',
  source: '用户陈述，2026-01',
  confidence: 'confirmed',
  tags: ['知识图谱', 'Agent'],
  body: `# 课程知识图谱自动构建系统

## 背景
课程资料分散，学生查知识点靠翻文档。

## 我的职责
独立完成数据清洗、抽取流水线、评测集。团队规模 1 人，导师提供方向建议。

## 关键行动
- 9 模块 Python 流水线：切分、实体抽取、关系抽取、消歧、质检。
- 自建 200 条标注测试集，覆盖 3 门课程。
- 实体消歧用 Embedding，相似度 > 0.9 自动合并，0.7–0.9 人工确认。

## 结果
- 知识点抽取完全匹配率 55% → 88%（自建测试集口径）。
- 通用版升级为 Planner-Worker-Critic 三层架构，在电商/百科样例上验证迁移。

## 待核实
- 没有线上生产指标，只有离线测试集。
`,
})

await card('04-项目与成果沉淀/项目档案/rag-assistant.md', {
  id: '20260101-project-002',
  title: 'RAG 学习助手检索模块',
  type: '项目档案',
  module: '04',
  source: '用户陈述，2026-02',
  confidence: 'confirmed',
  tags: ['RAG', '检索'],
  body: `# RAG 学习助手检索模块

## 背景
学生口语化提问，直接向量检索经常答非所问。

## 我的职责
负责检索模块：分类路由、Query 规范化、四路召回（BM25/Dense/Entity/Graph）、RRF 融合、预算子图、Token 感知打包。

## 结果
- 口语化提问检索失败率 32% → 6%（团队测试集口径）。
- 回答强制标注课件页码来源。

## 局限
- 只在小规模课件上验证，没有做大规模线上 A/B。
`,
})

await card('04-项目与成果沉淀/实习复盘/vehicle-cert.md', {
  id: '20260101-intern-001',
  title: '车企认证实习：公告申报跟进',
  type: '项目档案',
  module: '04',
  source: '用户陈述，2024-09',
  confidence: 'confirmed',
  tags: ['实习', 'PMO', '跨团队'],
  body: `# 车企认证实习：公告申报跟进

## 背景
试验认证部产品认证科，公告申报需要对接研发、检测、供应商三方。

## 行动
- 倒排计划跟进上百个资料节点。
- 用飞书做进度看板，让卡点透明。
- 维护多表关联车型档案库，覆盖数十款车型 5 个维度。

## 结果
- 参与 2 批次申报，参数零错误。
- 没有可核实的按期率或工时节省数据。
`,
})

await card('02-求职与实习/面试复盘/cloud-ai-first.md', {
  id: '20260101-review-001',
  title: '某云厂商 AI 商业岗一面复盘',
  type: '面试复盘',
  module: '02',
  source: '本人复盘，2026-10',
  confidence: 'confirmed',
  tags: ['面试', '售前'],
  body: `# 某云厂商 AI 商业岗一面复盘

## 面试官反馈（原话）
「这个可能需要你在行业上面再多一些了解。」

## 我的不足
- 偏技术叙事，没有先讲客户价值。
- 对前沿 AI 客户的算力/token 需求了解不深。

## 改进
- 按 3 类客户方向做调研，每类 1 页笔记。
- 每个项目准备 30 秒客户版。
`,
})

await card('03-能力建设与学习/学习笔记/hnsw.md', {
  id: '20260101-note-001',
  title: 'HNSW 向量索引笔记',
  type: '技术',
  module: '03',
  source: '某技术博客',
  source_url: 'https://example.com/hnsw',
  confidence: 'unverified',
  tags: ['向量检索', 'HNSW'],
  body: `# HNSW 向量索引笔记

HNSW 用分层可导航小世界图加速近邻搜索。核心权衡：召回、内存、构建时间。

## 可复习
1. HNSW 与 IVF 的区别？
2. 为什么层数越多召回越高但内存越大？
3. 什么场景不适合 HNSW？

## 可复用
选型 checklist：数据规模、召回要求、内存预算、更新频率。
`,
})

await card('03-能力建设与学习/学习笔记/hnsw-copy.md', {
  id: '20260101-note-002',
  title: 'HNSW 向量索引笔记',
  type: '技术',
  module: '03',
  source: '某技术博客',
  source_url: 'https://example.com/hnsw',
  confidence: 'unverified',
  tags: ['向量检索', 'HNSW'],
  body: `# HNSW 向量索引笔记

HNSW 用分层可导航小世界图加速近邻搜索。核心权衡：召回、内存、构建时间。

## 可复习
1. HNSW 与 IVF 的区别？
2. 为什么层数越多召回越高但内存越大？
3. 什么场景不适合 HNSW？

## 可复用
选型 checklist：数据规模、召回要求、内存预算、更新频率。
`,
})

await card('03-能力建设与学习/学习笔记/api-price.md', {
  id: '20260101-note-003',
  title: '2024 大模型 API 价格对比',
  type: '行业信息',
  module: '03',
  source: '某社媒截图',
  confidence: 'unverified',
  updated: '2024-03-01',
  review_after: '2025-03-01',
  tags: ['API', '价格'],
  body: `# 2024 大模型 API 价格对比

来源主张，未核实：某平台输入 0.001 元/千 token。图中未给原始报告。
`,
})

await card('03-能力建设与学习/方法论/pmo-a.md', {
  id: '20260101-method-001',
  title: 'PMO 跨团队推进法',
  type: '方法经验',
  module: '03',
  source: '用户陈述',
  tags: ['PMO', '协作'],
  body: `# PMO 跨团队推进法

必须每周对齐三方，一定要有公开看板，否则项目一定失控。
`,
})

await card('03-能力建设与学习/方法论/pmo-b.md', {
  id: '20260101-method-002',
  title: 'PMO 跨团队推进法（另一说）',
  type: '方法经验',
  module: '03',
  source: '某管理博客',
  confidence: 'unverified',
  tags: ['PMO', '协作'],
  body: `# PMO 跨团队推进法（另一说）

并不是所有团队都适合每周对齐，不建议一上来就上重看板，先看协作密度和决策链。
`,
})

await card('03-能力建设与学习/学习笔记/jd-cloud-ai.md', {
  id: '20260101-jd-001',
  title: '某云厂商 AI 商业工程师 JD 拆解',
  type: '岗位JD',
  module: '02',
  source: '用户粘贴，2026-10',
  tags: ['JD', '售前'],
  body: `# 某云厂商 AI 商业工程师 JD 拆解

职责：客户调研与画像、商机线索、客户沟通、方案材料、项目跟进、生态活动。
要求：AI 相关项目经验；对具身智能/世界模型/自动驾驶有基本了解；算力与训练推理基础认知。
`,
})

await card('05-个人背景与经历/个人画像/profile.md', {
  id: '20260101-profile-001',
  title: '个人画像（演示）',
  type: '个人画像',
  module: '05',
  source: '用户陈述',
  tags: ['画像'],
  body: `# 个人画像（演示）

- 阶段：信息工程研二，求职方向 AI 产品/方案（演示数据）。
- 优势：技术理解、结构化调研、跨团队跟进。
- 待补：行业客户视角、量化结果口径。
`,
})

await saveInbox(vault, '演示收件箱：一段关于「结构化面试 STAR 法」的剪藏，待整理成知识卡。', { title: 'STAR 法剪藏（演示）', source: '演示' })

await rewriteIndex(vault)
console.log('demo vault ready:', vault)
