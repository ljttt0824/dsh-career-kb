import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import {
  applyActions,
  auditVault,
  ensureLayout,
  readCatalog,
  renderCard,
  saveInbox,
  searchKnowledge,
  splitFrontmatter,
  verifyVault,
  rewriteIndex,
  MODULES,
} from '../lib/core.js'

async function makeVault() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-kb-test-'))
  await ensureLayout(dir)
  return dir
}

async function writeCard(dir, rel, card) {
  const full = path.join(dir, rel)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, renderCard(card), 'utf8')
  return full
}

test('layout creates six modules, inbox, meta and index', async () => {
  const dir = await makeVault()
  for (const mod of MODULES) {
    const stat = await fs.stat(path.join(dir, mod.dir))
    assert.equal(stat.isDirectory(), true, mod.dir)
  }
  for (const rel of ['00-收件箱', '_meta/audit', '_meta/backups', 'index.md', 'log.md', '_meta/settings.md']) {
    await fs.access(path.join(dir, rel))
  }
  await cleanup(dir)
})

test('frontmatter parser handles arrays, quoted values and body', () => {
  const raw = `---\nid: a1\ntitle: "RAG 与 检索"\ntags: [RAG, "检索增强"]\ntype: 技术\n---\n\n# 标题\n\n正文`
  const { data, body } = splitFrontmatter(raw)
  assert.equal(data.id, 'a1')
  assert.equal(data.title, 'RAG 与 检索')
  assert.deepEqual(data.tags, ['RAG', '检索增强'])
  assert.match(body, /# 标题/)
})

test('saveInbox stores a raw note and it appears in the catalog', async () => {
  const dir = await makeVault()
  const saved = await saveInbox(dir, '向量索引的取舍：内存与召回。', { title: '向量索引笔记', source: '测试' })
  assert.equal(saved.ok, true)
  const cards = await readCatalog(dir)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].inInbox, true)
  assert.equal(cards[0].title, '向量索引笔记')
  await cleanup(dir)
})

test('search ranks title and tag hits', async () => {
  const dir = await makeVault()
  await writeCard(dir, '03-能力建设与学习/学习笔记/rag.md', {
    id: 'c1', title: 'RAG 三路召回', type: '技术', module: '03', tags: ['RAG', '检索'],
    body: '# RAG 三路召回\n\nBM25 / Dense / Entity 三路召回，再用 RRF 融合。',
  })
  await writeCard(dir, '03-能力建设与学习/学习笔记/prompt.md', {
    id: 'c2', title: 'Prompt 工程', type: '技术', module: '03', tags: ['Prompt'],
    body: '# Prompt 工程\n\nfew-shot、拒答规则、JSON Schema。',
  })
  const rows = await searchKnowledge(dir, 'RAG', 5)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].path, '03-能力建设与学习/学习笔记/rag.md')
  assert.ok(rows[0].score > 0)
  await cleanup(dir)
})

test('audit finds duplicate, near-duplicate, outdated, conflict, misclassified, missing source, broken link and inbox backlog', async () => {
  const dir = await makeVault()
  const longBody = '# RAG 三路召回\n\n' + Array.from({ length: 30 }, (_, i) => `第 ${i} 行：BM25 / Dense / Entity 三路召回，再用 RRF 融合，最后按 token 预算打包。`).join('\n')

  await writeCard(dir, '03-能力建设与学习/学习笔记/rag-a.md', {
    id: 'a1', title: 'RAG 三路召回', type: '技术', module: '03', tags: ['RAG', '检索'], source: '博客', source_url: 'https://example.com/a', body: longBody, updated: '2026-01-01', review_after: '2099-01-01',
  })
  await writeCard(dir, '03-能力建设与学习/学习笔记/rag-a-copy.md', {
    id: 'a2', title: 'RAG 三路召回', type: '技术', module: '03', tags: ['RAG', '检索'], source: '博客', source_url: 'https://example.com/a', body: longBody, updated: '2026-01-01', review_after: '2099-01-01',
  })
  await writeCard(dir, '03-能力建设与学习/学习笔记/rag-b.md', {
    id: 'b1', title: 'RAG 多路召回笔记', type: '技术', module: '03', tags: ['RAG', '检索'],
    body: longBody.replace('最后按 token 预算打包。', '最后按 token 预算打包，并补充了重排。'),
    source: '博客', source_url: 'https://example.com/b', updated: '2026-02-01', review_after: '2099-01-01',
  })
  await writeCard(dir, '03-能力建设与学习/学习笔记/old.md', {
    id: 'o1', title: '2024 API 价格对比', type: '行业信息', module: '03', tags: ['API'],
    body: '# 2024 API 价格对比\n\n某 API 定价表（来源主张，待核实）。', source: '截图', updated: '2024-01-01', review_after: '2025-01-01',
  })
  await writeCard(dir, '03-能力建设与学习/方法论/pmo-a.md', {
    id: 'p1', title: 'PMO 跨团队推进法', type: '方法经验', module: '03', tags: ['PMO', '协作'],
    body: '# PMO 跨团队推进法\n\n必须每周对齐三方，一定要有看板。',
  })
  await writeCard(dir, '03-能力建设与学习/方法论/pmo-b.md', {
    id: 'p2', title: 'PMO 跨团队推进法（另一说）', type: '方法经验', module: '03', tags: ['PMO', '协作'],
    body: '# PMO 跨团队推进法（另一说）\n\n并不是所有人都要每周对齐，不建议一上来就上重看板。',
  })
  await writeCard(dir, '03-能力建设与学习/学习笔记/jd.md', {
    id: 'm1', title: '某岗位 JD 拆解', type: '岗位JD', module: '02', tags: ['JD'],
    body: '# 某岗位 JD 拆解\n\n职责：客户调研、方案材料、项目跟进。岗位要求：AI 相关项目经验。',
  })
  await writeCard(dir, '03-能力建设与学习/学习笔记/nosource.md', {
    id: 'n1', title: 'HNSW 原理', type: '技术', module: '03', tags: ['HNSW'],
    body: '# HNSW 原理\n\n分层可导航小世界图，用跳表式结构加速近邻搜索。'.repeat(3),
  })
  await writeCard(dir, '03-能力建设与学习/学习笔记/broken.md', {
    id: 'k1', title: '链接失效示例', type: '方法经验', module: '03',
    body: '# 链接失效示例\n\n参考 [[不存在的页面]]。',
  })
  await writeCard(dir, '03-能力建设与学习/学习笔记/orphan.md', {
    id: 'r1', title: '孤立长记录', type: '方法经验', module: '03',
    body: '# 孤立长记录\n\n' + '这是一段没有链接的长记录。'.repeat(60),
  })
  await saveInbox(dir, '待整理的一段剪藏内容。', { title: '剪藏' })

  const report = await auditVault(dir)
  const kinds = new Set(report.findings.map((finding) => finding.kind))
  for (const kind of ['exact-duplicate', 'near-duplicate', 'outdated', 'conflict', 'misclassified', 'missing-source', 'broken-link', 'orphan', 'inbox-backlog']) {
    assert.ok(kinds.has(kind), `缺少 ${kind}`)
  }
  assert.equal(report.stats.inbox, 1)
  assert.ok(report.findings.every((finding) => typeof finding.id === 'string' && finding.confirmRequired === true))
  await fs.access(path.join(dir, '_meta/audit/last.json'))
  await cleanup(dir)
})

test('apply refuses without confirmation, then moves, merges, archives and deletes with backups', async () => {
  const dir = await makeVault()
  const body = '# 记录\n\n' + '可核实的项目事实。'.repeat(40)
  const main = await writeCard(dir, '03-能力建设与学习/学习笔记/main.md', { id: 'm1', title: '主记录', type: '方法经验', module: '03', body, source: '用户陈述' })
  const copy = await writeCard(dir, '03-能力建设与学习/学习笔记/copy.md', { id: 'c1', title: '副本', type: '方法经验', module: '03', body, source: '用户陈述' })
  const movable = await writeCard(dir, '03-能力建设与学习/学习笔记/move.md', { id: 'v1', title: '待移动', type: '岗位JD', module: '03', body: '# 待移动\n\nJD 内容。' })
  const doomed = await writeCard(dir, '03-能力建设与学习/学习笔记/doomed.md', { id: 'd1', title: '待删除', type: '其他', module: '03', body: '# 待删除\n\n临时内容。' })

  await assert.rejects(() => applyActions(dir, [{ kind: 'delete', from: ['03-能力建设与学习/学习笔记/doomed.md'] }], { confirm: false }), /确认/)

  const moveResult = await applyActions(dir, [{
    kind: 'move',
    from: ['03-能力建设与学习/学习笔记/move.md'],
    to: ['02-求职与实习/岗位库/move.md'],
  }], { confirm: true })
  assert.equal(moveResult.ok, true)
  await fs.access(path.join(dir, '02-求职与实习/岗位库/move.md'))
  await fs.access(path.join(dir, '_meta/backups', moveResult.runId, '03-能力建设与学习/学习笔记/move.md'))

  const mergeResult = await applyActions(dir, [{
    kind: 'merge',
    from: ['03-能力建设与学习/学习笔记/copy.md'],
    to: ['03-能力建设与学习/学习笔记/main.md'],
  }], { confirm: true })
  assert.equal(mergeResult.ok, true)
  const merged = await fs.readFile(main, 'utf8')
  assert.match(merged, /合并自/)

  const deleteResult = await applyActions(dir, [{ kind: 'delete', from: ['03-能力建设与学习/学习笔记/doomed.md'] }], { confirm: true })
  assert.equal(deleteResult.ok, true)
  await assert.rejects(() => fs.access(doomed))
  await fs.access(path.join(dir, '_meta/backups', deleteResult.runId, '03-能力建设与学习/学习笔记/doomed.md'))

  const archiveResult = await applyActions(dir, [{ kind: 'archive', from: ['03-能力建设与学习/学习笔记/rag-none.md'] }], { confirm: true })
  assert.equal(archiveResult.ok, false, '不存在的文件应报错而不是崩溃')
  await cleanup(dir)
})

test('verify reports structure, ids, links and index status', async () => {
  const dir = await makeVault()
  await writeCard(dir, '03-能力建设与学习/学习笔记/good.md', { id: 'g1', title: '好记录', type: '方法经验', module: '03', body: '# 好记录\n\n有来源的正文。', source: '用户陈述' })
  await rewriteIndex(dir)
  const good = await verifyVault(dir)
  assert.equal(good.ok, true, JSON.stringify(good.checks))

  await writeCard(dir, '03-能力建设与学习/学习笔记/broken.md', { id: 'b1', title: '断链', type: '方法经验', module: '03', body: '# 断链\n\n[[不存在]]' })
  const bad = await verifyVault(dir)
  assert.equal(bad.ok, false)
  assert.ok(bad.checks.some((check) => check.name.includes('链接') && check.ok === false))
  await cleanup(dir)
})

async function cleanup(dir) {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 60 }).catch(() => {})
}

