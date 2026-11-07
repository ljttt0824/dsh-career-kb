/**
 * dsh-career-kb — vault engine.
 *
 * The vault is a plain Obsidian-compatible Markdown tree with six career
 * modules, an inbox, an index and a meta area. Everything here is pure Node:
 * no host imports, so the plugin keeps working when the profile resolves a
 * different DSH copy than the running host.
 *
 * Responsibilities:
 * - layout creation and safe path resolution
 * - frontmatter parsing / rendering
 * - deterministic audit (duplicate, redundant, outdated, conflict,
 *   misclassified, missing source, broken link, orphan, inbox backlog)
 * - confirmed mutation with backups (move / merge / archive / delete / update)
 * - index rewriting, search, verification
 */

import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'

export const INBOX_DIR = '00-收件箱'
export const META_DIR = '_meta'
export const BACKUP_DIR = `${META_DIR}/backups`
export const AUDIT_DIR = `${META_DIR}/audit`
export const ARCHIVE_DIR = `${META_DIR}/archive`

export const MODULES = [
  {
    key: '01',
    dir: '01-职业规划与目标',
    label: '职业规划与目标',
    topics: '阶段目标、方向选择、行动计划',
    subdirs: ['长期规划', '90天行动'],
    keywords: ['规划', '目标', '方向', '计划', '路径', '五年', '十年', '二十年', '里程碑', '转行', '求职策略'],
  },
  {
    key: '02',
    dir: '02-求职与实习',
    label: '求职与实习',
    topics: 'JD、简历、面试与投递',
    subdirs: ['岗位库', '简历版本', '投递台账', '面试准备', '面试复盘'],
    keywords: ['jd', '岗位', '简历', '面试', '投递', 'offer', 'hr', '招聘', '面经', '一面', '二面', '自我介绍', '反问'],
  },
  {
    key: '03',
    dir: '03-能力建设与学习',
    label: '能力建设与学习',
    topics: '技能、笔记、学习计划',
    subdirs: ['技能树', '学习笔记', '方法论'],
    keywords: ['学习', '技能', '知识', '教程', '概念', '方法', '框架', '笔记', '复习', '八股', '算法', 'prompt', 'rag', 'agent', 'pmo', '复盘方法'],
  },
  {
    key: '04',
    dir: '04-项目与成果沉淀',
    label: '项目与成果沉淀',
    topics: '项目事实、实习成果、作品',
    subdirs: ['项目档案', '实习复盘', '作品集'],
    keywords: ['项目', '实习', '作品', '上线', '成果', '负责', '搭建', '我用', '亲历', '交付', '产出'],
  },
  {
    key: '05',
    dir: '05-个人背景与经历',
    label: '个人背景与经历',
    topics: '个人画像、偏好、资源类别',
    subdirs: ['个人画像', '偏好与约束', '人脉资源'],
    keywords: ['我是', '背景', '画像', '性格', '偏好', '兴趣', '优势', '短板', '家庭', '价值观', '教育背景', '学历'],
  },
  {
    key: '06',
    dir: '06-行业洞察与社会感知',
    label: '行业洞察与社会感知',
    topics: '行业资料、趋势、机会',
    subdirs: ['行业观察', '赛道分析'],
    keywords: ['行业', '趋势', '市场', '公司', '赛道', '融资', '政策', '报告', '风口', '竞品', '生态'],
  },
]

export const CARD_TYPES = [
  '技术',
  '概念认知',
  '方法经验',
  '他人经验',
  '行业信息',
  '岗位JD',
  '简历',
  '面试准备',
  '面试复盘',
  '项目档案',
  '个人画像',
  '规划',
  '投递记录',
  '其他',
]

const TYPE_LABEL_TO_MODULE = {
  技术: '03',
  概念认知: '03',
  方法经验: '03',
  他人经验: '03',
  行业信息: '06',
  岗位JD: '02',
  简历: '02',
  面试准备: '02',
  面试复盘: '02',
  投递记录: '02',
  项目档案: '04',
  个人画像: '05',
  规划: '01',
}

const TIME_SENSITIVE_TYPES = new Set(['技术', '行业信息', '概念认知'])
const SOURCE_SENSITIVE_TYPES = new Set(['技术', '行业信息', '概念认知', '方法经验', '他人经验'])
const BODY_LIMIT = 60000

export function resolveDataDir(config) {
  if (config !== null && typeof config === 'object' && typeof config.dataDir === 'string' && config.dataDir.trim().length > 0) {
    return path.resolve(config.dataDir.trim())
  }
  const home = process.env.DSH_HOME
    ?? (typeof os.homedir === 'function' ? path.join(os.homedir(), '.dsh') : path.join(process.cwd(), '.dsh'))
  return path.join(home, 'storages', 'career-kb')
}

export function moduleFor(key) {
  const direct = MODULES.find((item) => item.key === key)
  if (direct !== undefined) return direct
  return MODULES.find((item) => item.dir === key || item.label === key)
}

function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function nowStamp() {
  const now = new Date()
  return `${todayISO()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function uid(prefix = 'run') {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`
}

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex')
}

/** Resolve a vault-relative path and refuse anything that escapes the vault. */
export function resolveInside(vault, relative) {
  const root = path.resolve(vault)
  const resolved = path.resolve(root, relative)
  const rel = path.relative(root, resolved)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`路径不在知识库内：${relative}`)
  }
  return resolved
}

export function toRel(vault, absolute) {
  return path.relative(path.resolve(vault), absolute).split(path.sep).join('/')
}

export async function ensureLayout(vault) {
  await fs.mkdir(vault, { recursive: true })
  for (const mod of MODULES) await fs.mkdir(path.join(vault, mod.dir), { recursive: true })
  await fs.mkdir(path.join(vault, INBOX_DIR), { recursive: true })
  await fs.mkdir(path.join(vault, META_DIR, 'audit'), { recursive: true })
  await fs.mkdir(path.join(vault, META_DIR, 'backups'), { recursive: true })

  const index = path.join(vault, 'index.md')
  try {
    await fs.access(index)
  } catch {
    await fs.writeFile(path.join(vault, 'index.md'), renderIndexShell(), 'utf8')
  }
  const log = path.join(vault, 'log.md')
  try {
    await fs.access(log)
  } catch {
    await fs.writeFile(log, `# 知识库日志\n\n- ${nowStamp()} · 初始化知识库。\n`, 'utf8')
  }
  const settings = path.join(vault, META_DIR, 'settings.md')
  try {
    await fs.access(settings)
  } catch {
    await fs.writeFile(settings, SETTINGS_TEMPLATE, 'utf8')
  }
  return vault
}

export const SETTINGS_TEMPLATE = `---
title: 知识库设置
type: 其他
module: _meta
status: active
---

# 知识库设置

- 来源收件箱（要批量存入的目录，可留空）：
- 是否递归扫描子目录：是
- 需要排除的子目录或文件模式：
- 默认语言：中文
- 飞书同步：自动（检测到飞书工具时同步到飞书知识库 / 文档）
- 其他处理偏好：
`

function renderIndexShell() {
  return `# 职业生涯知识库索引

> 由 dsh-career-kb 自动维护。手动修改会在下次重建时被覆盖。

## 模块

${MODULES.map((mod) => `- [[${mod.dir}]] · ${mod.label}：${mod.topics}`).join('\n')}
`
}

/* ------------------------------------------------------------------ */
/* Frontmatter                                                         */
/* ------------------------------------------------------------------ */

export function splitFrontmatter(raw) {
  const text = String(raw ?? '').replace(/^\uFEFF/, '')
  if (!text.startsWith('---')) return { data: {}, body: text }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { data: {}, body: text }
  const header = text.slice(3, end).replace(/^\n/, '')
  const body = text.slice(end + 4).replace(/^\n/, '')
  return { data: parseYamlLite(header), body }
}

function unquote(value) {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"')
  }
  return trimmed
}

export function parseYamlLite(header) {
  const data = {}
  let currentKey = null
  for (const rawLine of header.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '')
    if (line.length === 0 || line.trimStart().startsWith('#')) continue
    const listMatch = /^\s*-\s+(.*)$/.exec(line)
    if (listMatch !== null && currentKey !== null) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = []
      data[currentKey].push(unquote(listMatch[1]))
      continue
    }
    const pair = /^([A-Za-z0-9_\u4e00-\u9fa5-]+)\s*:\s*(.*)$/.exec(line)
    if (pair === null) continue
    const key = pair[1]
    const value = pair[2].trim()
    currentKey = key
    if (value.length === 0) {
      data[key] = ''
      continue
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim()
      data[key] = inner.length === 0 ? [] : inner.split(',').map((item) => unquote(item))
      continue
    }
    data[key] = unquote(value)
  }
  return data
}

export function renderFrontmatter(data) {
  const lines = ['---']
  const order = ['id', 'title', 'type', 'module', 'status', 'source', 'source_url', 'author', 'published', 'captured', 'updated', 'review_after', 'confidence', 'tags', 'conflict_of', 'related']
  const keys = [...order.filter((key) => data[key] !== undefined), ...Object.keys(data).filter((key) => !order.includes(key))]
  for (const key of keys) {
    const value = data[key]
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      lines.push(`${key}: [${value.map((item) => (String(item).includes(',') ? `"${item}"` : item)).join(', ')}]`)
      continue
    }
    lines.push(`${key}: ${value}`)
  }
  lines.push('---')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

async function walkMarkdown(root) {
  const out = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === META_DIR || entry.name === 'node_modules') continue
        stack.push(full)
      } else if (/\.md$/i.test(entry.name) && entry.name !== 'index.md' && entry.name !== 'log.md') {
        out.push(full)
      }
    }
  }
  return out
}

export function normalizeBody(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function shingleSet(text) {
  const normalized = normalizeBody(text).toLowerCase()
  const tokens = normalized.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]{2,}/g) ?? []
  const set = new Set()
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (/^[\u4e00-\u9fa5]{2,}$/.test(token)) {
      for (let j = 0; j < token.length - 1; j += 1) set.add(token.slice(j, j + 2))
    } else {
      set.add(token)
    }
  }
  return set
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let hit = 0
  for (const value of small) if (large.has(value)) hit += 1
  return hit / (small.size + large.size - hit)
}

function containment(a, b) {
  if (a.size === 0) return 0
  let hit = 0
  for (const value of a) if (b.has(value)) hit += 1
  return hit / a.size
}

function moduleFromRel(rel) {
  const [first] = rel.split('/')
  return MODULES.find((item) => item.dir === first)
}

export function moduleKeyFromRel(rel) {
  if (rel.startsWith(INBOX_DIR)) return 'inbox'
  const mod = moduleFromRel(rel)
  return mod === undefined ? '' : mod.key
}

export function cardTitleFromBody(body, fallback) {
  const heading = /^#\s+(.+)$/m.exec(body)
  if (heading !== null) return heading[1].trim()
  const firstLine = body.split('\n').map((line) => line.trim()).find((line) => line.length > 0)
  if (firstLine !== undefined) return firstLine.replace(/^#+\s*/, '').slice(0, 80)
  return fallback
}

const LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g

export function extractLinks(text) {
  const out = new Set()
  let match
  const re = new RegExp(LINK_RE.source, 'g')
  while ((match = re.exec(text)) !== null) {
    out.add(match[1].trim())
  }
  return [...out]
}

function isDateLike(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}(-\d{2})?/.test(value)
}

function daysBetween(iso, now = new Date()) {
  const parsed = Date.parse(iso.length === 7 ? `${iso}-01` : iso)
  if (Number.isNaN(parsed)) return null
  return Math.round((now.getTime() - parsed) / 86400000)
}

export async function readCatalog(vault) {
  await ensureLayout(vault)
  const files = await walkMarkdown(vault)
  const cards = []
  for (const full of files) {
    const rel = toRel(vault, full)
    if (rel.startsWith(`${META_DIR}/`)) continue
    const raw = await fs.readFile(full, 'utf8')
    const { data, body } = splitFrontmatter(raw)
    const trimmed = body.slice(0, BODY_LIMIT)
    const title = typeof data.title === 'string' && data.title.length > 0
      ? data.title
      : cardTitleFromBody(trimmed, path.basename(full, '.md'))
    const module = typeof data.module === 'string' && data.module.length > 0 ? data.module : moduleKeyFromRel(rel)
    const tags = Array.isArray(data.tags)
      ? data.tags
      : typeof data.tags === 'string' && data.tags.length > 0
        ? data.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
        : []
    const card = {
      relPath: rel,
      path: full,
      fileName: path.basename(full, '.md'),
      id: typeof data.id === 'string' && data.id.length > 0 ? data.id : path.basename(full, '.md'),
      title,
      type: typeof data.type === 'string' ? data.type : '其他',
      module,
      status: typeof data.status === 'string' ? data.status : 'active',
      source: typeof data.source === 'string' ? data.source : '',
      source_url: typeof data.source_url === 'string' ? data.source_url : '',
      author: typeof data.author === 'string' ? data.author : '',
      published: typeof data.published === 'string' ? data.published : '',
      captured: typeof data.captured === 'string' ? data.captured : '',
      updated: typeof data.updated === 'string' ? data.updated : '',
      review_after: typeof data.review_after === 'string' ? data.review_after : '',
      confidence: typeof data.confidence === 'string' ? data.confidence : '',
      tags,
      conflict_of: Array.isArray(data.conflict_of) ? data.conflict_of : [],
      related: Array.isArray(data.related) ? data.related : [],
      inInbox: rel.startsWith(`${INBOX_DIR}/`),
      body: trimmed,
      raw: trimmed,
      links: extractLinks(trimmed),
      size: Buffer.byteLength(trimmed, 'utf8'),
      hash: sha1(normalizeBody(trimmed)),
      shingles: shingleSet(trimmed),
      data,
    }
    cards.push(card)
  }
  return cards
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export async function searchKnowledge(vault, query, limit = 12) {
  const q = String(query ?? '').trim()
  if (q.length === 0) return []
  const cards = await readCatalog(vault)
  const terms = q.toLowerCase().split(/[\s,，、]+/).filter((term) => term.length > 0)
  const rows = []
  for (const card of cards) {
    const haystack = `${card.title}\n${card.tags.join(' ')}\n${card.body}`.toLowerCase()
    let score = 0
    for (const term of terms) {
      if (card.title.toLowerCase().includes(term)) score += 12
      if (card.tags.some((tag) => String(tag).toLowerCase().includes(term))) score += 6
      const hits = haystack.split(term).length - 1
      score += Math.min(hits, 6)
    }
    if (score <= 0) continue
    const idx = haystack.indexOf(terms[0])
    const start = Math.max(0, idx - 60)
    const snippet = card.body.slice(start, start + 200).replace(/\n/g, ' ')
    rows.push({ path: card.relPath, id: card.id, title: card.title, module: card.module, type: card.type, snippet, score })
  }
  rows.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
  return rows.slice(0, Math.max(1, Math.min(50, Number(limit) || 12)))
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

function tokenizeTitle(title) {
  return new Set((String(title).toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]{2,}/g) ?? []))
}

function titleSimilarity(a, b) {
  return jaccard(tokenizeTitle(a), tokenizeTitle(b))
}

function predictModule(card) {
  const text = `${card.title}\n${card.tags.join(' ')}\n${card.body}`.toLowerCase()
  let best = { key: '', score: 0 }
  for (const mod of MODULES) {
    let score = 0
    for (const keyword of mod.keywords) {
      const hits = text.split(keyword.toLowerCase()).length - 1
      score += Math.min(hits, 4)
    }
    if (score > best.score) best = { key: mod.key, score }
  }
  return best
}

function severityWeight(severity) {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1
}

function conflictMarkers(text) {
  return {
    negated: /(不是|并非|不建议|错误|避免|不要|不能|没有证据)/.test(text),
    asserted: /(必须|一定|应该|正确|推荐|核心|本质)/.test(text),
  }
}

function findPairs(cards, matcher) {
  const pairs = []
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const hit = matcher(cards[i], cards[j])
      if (hit !== null) pairs.push(hit)
    }
  }
  return pairs
}

function sharedTags(a, b) {
  return a.tags.filter((tag) => b.tags.includes(tag))
}

export async function auditVault(vault, options = {}) {
  await ensureLayout(vault)
  const cards = await readCatalog(vault)
  const findings = []
  const now = new Date()
  const activeCards = cards.filter((card) => !card.inInbox && card.status !== 'archived')
  const inboxCards = cards.filter((card) => card.inInbox)
  const titles = new Map()
  for (const card of activeCards) {
    titles.set(card.title.toLowerCase(), card)
    titles.set(card.id.toLowerCase(), card)
  }

  const add = (finding) => {
    findings.push({
      id: finding.id ?? sha1(`${finding.kind}|${(finding.paths ?? []).join('|')}`).slice(0, 10),
      confirmRequired: true,
      severity: finding.severity ?? 'medium',
      ...finding,
    })
  }

  // 1. exact duplicates
  const hashGroups = new Map()
  for (const card of activeCards) {
    if (card.size < 80) continue
    const group = hashGroups.get(card.hash) ?? []
    group.push(card)
    hashGroups.set(card.hash, group)
  }
  for (const [hash, group] of hashGroups) {
    if (group.length < 2) continue
    if (options.include !== undefined && !options.include.includes('exact-duplicate')) continue
    add({
      kind: 'exact-duplicate',
      severity: 'high',
      title: `完全重复：${group[0].title}`,
      paths: group.map((card) => card.relPath),
      summary: `${group.length} 条记录正文完全一致。保留一条主记录，其余合并或归档。`,
      evidence: `正文哈希 ${hash.slice(0, 10)} 相同`,
      suggestedAction: { kind: 'merge', from: group.slice(1).map((card) => card.relPath), into: group[0].relPath },
    })
  }

  // 2. near duplicates / redundant (bounded pair scan)
  if (options.include === undefined || options.include.includes('near-duplicate') || options.include.includes('redundant')) {
    const candidates = activeCards.filter((card) => card.shingles.size >= 24)
    const pairs = []
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const a = candidates[i]
        const b = candidates[j]
        const titleScore = titleSimilarity(a.title, b.title)
        const tagHits = sharedTags(a, b)
        if (titleScore < 0.34 && tagHits.length === 0) continue
        const jac = jaccard(a.shingles, b.shingles)
        if (jac < 0.6) continue
        pairs.push({ a, b, jac, titleScore })
      }
      if (pairs.length > 400) break
    }
    for (const pair of pairs) {
      const { a, b, jac } = pair
      const containA = containment(a.shingles, b.shingles)
      const containB = containment(b.shingles, a.shingles)
      if (jac >= 0.9) {
        add({
          kind: 'near-duplicate',
          severity: 'high',
          title: `高度重叠：${a.title} / ${b.title}`,
          paths: [a.relPath, b.relPath],
          summary: '两篇内容高度重叠，疑似同一记录的两个版本。',
          evidence: `相似度 ${(jac * 100).toFixed(0)}%`,
          suggestedAction: { kind: 'merge', from: [b.relPath], into: a.relPath },
        })
      } else if (containA >= 0.94 && a.size * 1.5 < b.size) {
        add({
          kind: 'redundant',
          severity: 'medium',
          title: `内容冗余：${a.title}`,
          paths: [a.relPath, b.relPath],
          summary: `「${a.title}」的大部分内容已包含在「${b.title}」中。`,
          evidence: `包含度 ${(containA * 100).toFixed(0)}%`,
          suggestedAction: { kind: 'merge', from: [a.relPath], into: b.relPath },
        })
      } else if (containB >= 0.94 && b.size * 1.5 < a.size) {
        add({
          kind: 'redundant',
          severity: 'medium',
          title: `内容冗余：${b.title}`,
          paths: [b.relPath, a.relPath],
          summary: `「${b.title}」的大部分内容已包含在「${a.title}」中。`,
          evidence: `包含度 ${(containB * 100).toFixed(0)}%`,
          suggestedAction: { kind: 'merge', from: [b.relPath], into: a.relPath },
        })
      }
    }
  }

  // 3. outdated
  if (options.include === undefined || options.include.includes('outdated')) {
    for (const card of activeCards) {
      if (card.inInbox) continue
      let age = null
      if (isDateLike(card.review_after)) age = daysBetween(card.review_after, now)
      const updatedAge = isDateLike(card.updated) ? daysBetween(card.updated, now) : isDateLike(card.captured) ? daysBetween(card.captured, now) : null
      const timeSensitive = TIME_SENSITIVE_TYPES.has(card.type)
      if (age !== null && age > 0) {
        add({
          kind: 'outdated',
          severity: 'medium',
          title: `已过复查期：${card.title}`,
          paths: [card.relPath],
          summary: `复查日期 ${card.review_after} 已过，请复核是否仍然有效。`,
          evidence: `review_after 早于今天 ${Math.abs(age)} 天`,
          suggestedAction: { kind: 'update', from: [card.relPath], to: [card.relPath] },
        })
      } else if (timeSensitive && updatedAge !== null && updatedAge > 540 && card.status === 'active') {
        add({
          kind: 'outdated',
          severity: 'low',
          title: `时效性内容较旧：${card.title}`,
          paths: [card.relPath],
          summary: '技术/行业内容超过 18 个月未更新，可能已过时；确认后可归档或更新。',
          evidence: `最近更新 ${updatedAge} 天前`,
          suggestedAction: { kind: 'archive', from: [card.relPath] },
        })
      }
    }
  }

  // 4. conflicts
  if (options.include === undefined || options.include.includes('conflict')) {
    const byTag = new Map()
    for (const card of activeCards) {
      for (const tag of card.tags) {
        const list = byTag.get(tag) ?? []
        list.push(card)
        byTag.set(tag, list)
      }
    }
    const seen = new Set()
    for (const card of activeCards) {
      if (card.conflict_of.length > 0) {
        add({
          kind: 'conflict',
          severity: 'high',
          title: `已标记冲突：${card.title}`,
          paths: [card.relPath, ...card.conflict_of],
          summary: '记录自身声明与其他记录冲突，需并列来源与日期核实。',
          evidence: `conflict_of: ${card.conflict_of.join(', ')}`,
          suggestedAction: { kind: 'update', from: [card.relPath], to: [card.relPath] },
        })
        continue
      }
      for (const tag of card.tags) {
        for (const other of byTag.get(tag) ?? []) {
          if (other === card) continue
          const pairKey = [card.relPath, other.relPath].sort().join('|')
          if (seen.has(pairKey)) continue
          seen.add(pairKey)
          const titleScore = titleSimilarity(card.title, other.title)
          if (titleScore < 0.4 && sharedTags(card, other).length < 2) continue
          const ma = conflictMarkers(card.body)
          const mb = conflictMarkers(other.body)
          if ((ma.negated && mb.asserted && !mb.negated) || (mb.negated && ma.asserted && !ma.negated)) {
            add({
              kind: 'conflict',
              severity: 'medium',
              title: `疑似矛盾：${card.title} / ${other.title}`,
              paths: [card.relPath, other.relPath],
              summary: '一篇包含否定/修正说法，另一篇给出肯定结论。并列来源与日期，请用户确认哪条成立。',
              evidence: `共享标签 ${sharedTags(card, other).join(', ')}，标题相似度 ${(titleScore * 100).toFixed(0)}%`,
              suggestedAction: { kind: 'update', from: [card.relPath], to: [other.relPath] },
            })
          }
        }
      }
    }
  }

  // 5. misclassified
  if (options.include === undefined || options.include.includes('misclassified')) {
    for (const card of activeCards) {
      const pathKey = moduleKeyFromRel(card.relPath)
      const declared = moduleFor(card.module)
      const actual = moduleFor(pathKey)
      if (declared !== undefined && actual !== undefined && declared.key !== actual.key) {
        add({
          kind: 'misclassified',
          severity: 'high',
          title: `归类不一致：${card.title}`,
          paths: [card.relPath],
          summary: `正文标记在 ${declared.dir}，实际存放在 ${actual.dir}。`,
          evidence: 'frontmatter.module 与目录不一致',
          suggestedAction: { kind: 'move', from: [card.relPath], to: [path.join(declared.dir, card.fileName + '.md').split(path.sep).join('/')] },
        })
        continue
      }
      const predicted = predictModule(card)
      if (actual !== undefined && predicted.score >= 3 && predicted.key !== '' && predicted.key !== actual.key) {
        const predictedMod = moduleFor(predicted.key)
        add({
          kind: 'misclassified',
          severity: 'low',
          title: `可能放错模块：${card.title}`,
          paths: [card.relPath],
          summary: `内容关键词更像 ${predictedMod.dir}（${predicted.score} 分），当前在 ${actual.dir}。`,
          evidence: `标题/正文关键词命中 ${predictedMod.label}`,
          suggestedAction: { kind: 'move', from: [card.relPath], to: [path.join(predictedMod.dir, card.fileName + '.md').split(path.sep).join('/')] },
        })
      }
    }
  }

  // 6. missing source
  if (options.include === undefined || options.include.includes('missing-source')) {
    for (const card of activeCards) {
      if (!SOURCE_SENSITIVE_TYPES.has(card.type)) continue
      if (card.source.length === 0 && card.source_url.length === 0) {
        add({
          kind: 'missing-source',
          severity: 'low',
          title: `缺少来源：${card.title}`,
          paths: [card.relPath],
          summary: '技术/行业/经验类记录没有作者、平台或原文链接，难以核验。',
          evidence: 'source 与 source_url 均为空',
          suggestedAction: { kind: 'update', from: [card.relPath], to: [card.relPath] },
        })
      }
    }
  }

  // 7. broken links and orphans
  const linkTargets = new Set()
  for (const card of activeCards) {
    for (const link of card.links) linkTargets.add(link.toLowerCase())
  }
  if (options.include === undefined || options.include.includes('broken-link')) {
    for (const card of activeCards) {
      const broken = card.links.filter((link) => !titles.has(link.toLowerCase()))
      if (broken.length > 0) {
        add({
          kind: 'broken-link',
          severity: 'low',
          title: `链接失效：${card.title}`,
          paths: [card.relPath],
          summary: `引用了不存在的页面：${broken.slice(0, 6).join('、')}。`,
          evidence: `${broken.length} 个 [[链接]] 未找到目标`,
          suggestedAction: { kind: 'update', from: [card.relPath], to: [card.relPath] },
        })
      }
    }
  }
  if (options.include === undefined || options.include.includes('orphan')) {
    for (const card of activeCards) {
      const backlinked = linkTargets.has(card.title.toLowerCase()) || linkTargets.has(card.id.toLowerCase())
      if (card.links.length === 0 && !backlinked && card.size > 600 && !card.inInbox) {
        add({
          kind: 'orphan',
          severity: 'low',
          title: `孤立记录：${card.title}`,
          paths: [card.relPath],
          summary: '没有出链也没有反向链接，建议补充关联或并入主题记录。',
          evidence: '0 个关联链接',
          suggestedAction: { kind: 'update', from: [card.relPath], to: [card.relPath] },
        })
      }
    }
  }

  // 8. inbox backlog
  if (inboxCards.length > 0) {
    add({
      kind: 'inbox-backlog',
      severity: 'medium',
      title: `收件箱待整理：${inboxCards.length} 条`,
      paths: inboxCards.map((card) => card.relPath),
      summary: '收件箱中的原始资料尚未整理成知识卡，建议运行「存入整理」技能。',
      evidence: inboxCards.map((card) => card.title).slice(0, 5).join('；'),
      suggestedAction: { kind: 'update', from: inboxCards.map((card) => card.relPath), to: [] },
    })
  }

  findings.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || a.kind.localeCompare(b.kind))

  const counts = {}
  for (const finding of findings) counts[finding.kind] = (counts[finding.kind] ?? 0) + 1

  const report = {
    ok: true,
    runId: uid('audit'),
    generatedAt: new Date().toISOString(),
    vault,
    stats: {
      cards: activeCards.length,
      inbox: inboxCards.length,
      modules: Object.fromEntries(MODULES.map((mod) => [mod.key, activeCards.filter((card) => moduleKeyFromRel(card.relPath) === mod.key).length])),
      totalBytes: activeCards.reduce((sum, card) => sum + card.size, 0),
    },
    counts,
    findings: findings.map((finding) => ({ ...finding, evidence: finding.evidence ?? '' })),
    notes: [
      '本报告由 dsh-career-kb 只读扫描生成，未修改任何记录。',
      '执行删除、移动、合并、归档前必须针对具体 finding id 获得用户确认。',
    ],
  }

  try {
    await fs.mkdir(path.join(vault, AUDIT_DIR), { recursive: true })
    await fs.writeFile(path.join(vault, AUDIT_DIR, 'last.json'), JSON.stringify(report, null, 2), 'utf8')
    await fs.writeFile(path.join(vault, AUDIT_DIR, `report-${report.runId}.md`), renderAuditMarkdown(report), 'utf8')
  } catch { /* read-only vaults still return the report */ }

  return report
}

export function renderAuditMarkdown(report) {
  const lines = [`# 知识库巡检报告 ${report.runId}`, '', `- 生成时间：${report.generatedAt}`, `- 记录数：${report.stats.cards}，收件箱：${report.stats.inbox}`, '']
  lines.push('## 问题汇总', '', '| 类型 | 数量 |', '| --- | --- |')
  for (const [kind, count] of Object.entries(report.counts)) lines.push(`| ${kind} | ${count} |`)
  lines.push('')
  for (const finding of report.findings) {
    lines.push(`### [${finding.severity}] ${finding.title}`, '')
    lines.push(`- id：\`${finding.id}\``)
    lines.push(`- 路径：${finding.paths.join('、')}`)
    lines.push(`- 依据：${finding.evidence}`)
    lines.push(`- 建议：${finding.summary}`)
    lines.push('')
  }
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* Apply                                                               */
/* ------------------------------------------------------------------ */

async function backupFile(vault, rel, runId) {
  const source = resolveInside(vault, rel)
  const target = resolveInside(vault, path.join(BACKUP_DIR, runId, rel))
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(source, target)
  return toRel(vault, target)
}

async function appendLog(vault, line) {
  try {
    await fs.appendFile(path.join(vault, 'log.md'), `- ${nowStamp()} · ${line}\n`, 'utf8')
  } catch { /* logging is best effort */ }
}

export async function applyActions(vault, actions, options = {}) {
  if (options.confirm !== true) {
    throw new Error('执行整理动作需要用户确认（confirm=true）。请先展示整改清单并获得明确确认。')
  }
  const list = Array.isArray(actions) ? actions : []
  if (list.length === 0) throw new Error('没有可执行的动作')
  const runId = uid('apply')
  const results = []
  for (const action of list) {
    const kind = String(action.kind ?? '')
    const from = Array.isArray(action.from) ? action.from.filter((item) => typeof item === 'string') : []
    const to = Array.isArray(action.to) ? action.to.filter((item) => typeof item === 'string') : []
    try {
      if (kind === 'move') {
        if (from.length !== 1 || to.length !== 1) throw new Error('move 需要 from/to 各一个路径')
        await backupFile(vault, from[0], runId)
        const target = resolveInside(vault, to[0])
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.rename(resolveInside(vault, from[0]), target)
        results.push({ ok: true, action, detail: `${from[0]} → ${to[0]}` })
        await appendLog(vault, `移动 ${from[0]} → ${to[0]}`)
      } else if (kind === 'merge') {
        if (to.length !== 1) throw new Error('merge 需要 into（to[0]）')
        const intoPath = resolveInside(vault, to[0])
        const intoRaw = await fs.readFile(intoPath, 'utf8')
        const { data: intoData, body: intoBody } = splitFrontmatter(intoRaw)
        let merged = intoBody
        const mergedFrom = []
        for (const rel of from) {
          if (rel === to[0]) continue
          await backupFile(vault, rel, runId)
          const raw = await fs.readFile(resolveInside(vault, rel), 'utf8')
          const { data, body } = splitFrontmatter(raw)
          merged += `\n\n---\n\n## 合并自 ${data.title ?? rel}（${rel}）\n\n${body}`
          mergedFrom.push(rel)
          await fs.writeFile(resolveInside(vault, rel), `---\nid: ${data.id ?? path.basename(rel, '.md')}\ntitle: ${data.title ?? rel}\nstatus: archived\n---\n\n该记录已于 ${nowStamp()} 合并到 [[${intoData.title ?? to[0]}]].\n`, 'utf8')
        }
        await fs.writeFile(intoPath, `${renderFrontmatter({ ...intoData, updated: todayISO() })}\n\n${merged.trim()}\n`, 'utf8')
        results.push({ ok: true, action, detail: `合并 ${mergedFrom.join('、')} → ${to[0]}` })
        await appendLog(vault, `合并 ${mergedFrom.join('、')} → ${to[0]}`)
      } else if (kind === 'archive') {
        for (const rel of from) {
          await backupFile(vault, rel, runId)
          const target = resolveInside(vault, path.join(ARCHIVE_DIR, todayISO(), rel))
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.rename(resolveInside(vault, rel), target)
        }
        results.push({ ok: true, action, detail: `归档 ${from.join('、')}` })
        await appendLog(vault, `归档 ${from.join('、')}`)
      } else if (kind === 'delete') {
        for (const rel of from) {
          await backupFile(vault, rel, runId)
          await fs.rm(resolveInside(vault, rel), { force: true })
        }
        results.push({ ok: true, action, detail: `删除 ${from.join('、')}（已备份到 ${BACKUP_DIR}/${runId}）` })
        await appendLog(vault, `删除 ${from.join('、')}（已备份）`)
      } else if (kind === 'update') {
        if (from.length !== 1) throw new Error('update 需要 from 一个路径')
        await backupFile(vault, from[0], runId)
        const target = resolveInside(vault, from[0])
        if (typeof action.content === 'string') {
          await fs.writeFile(target, action.content, 'utf8')
        } else {
          const raw = await fs.readFile(target, 'utf8')
          const { data, body } = splitFrontmatter(raw)
          const next = { ...data, ...(action.patch ?? {}), updated: todayISO() }
          await fs.writeFile(target, `${renderFrontmatter(next)}\n\n${body}\n`, 'utf8')
        }
        results.push({ ok: true, action, detail: `更新 ${from[0]}` })
        await appendLog(vault, `更新 ${from[0]}`)
      } else if (kind === 'create') {
        const targetRel = to[0]
        if (typeof targetRel !== 'string') throw new Error('create 需要 to[0] 目标路径')
        const target = resolveInside(vault, targetRel)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, String(action.content ?? ''), 'utf8')
        results.push({ ok: true, action, detail: `新建 ${targetRel}` })
        await appendLog(vault, `新建 ${targetRel}`)
      } else {
        throw new Error(`未知动作：${kind}`)
      }
    } catch (error) {
      results.push({ ok: false, action, error: String(error?.message ?? error) })
    }
  }
  const okCount = results.filter((row) => row.ok).length
  await rewriteIndex(vault)
  await appendLog(vault, `执行整理 ${okCount}/${results.length} 项（run ${runId}）。`)
  return { ok: results.every((row) => row.ok), runId, backupDir: `${BACKUP_DIR}/${runId}`, results }
}

/* ------------------------------------------------------------------ */
/* Index / verify                                                      */
/* ------------------------------------------------------------------ */

export async function rewriteIndex(vault) {
  const cards = await readCatalog(vault)
  const active = cards.filter((card) => !card.inInbox && card.status !== 'archived')
  const inbox = cards.filter((card) => card.inInbox)
  const lines = [
    '# 职业生涯知识库索引',
    '',
    `> 由 dsh-career-kb 自动维护于 ${nowStamp()}。手动修改会在下次重建时被覆盖。`,
    '',
    '## 概览',
    '',
    `- 记录总数：${active.length}`,
    `- 收件箱待整理：${inbox.length}`,
    `- 模块分布：${MODULES.map((mod) => `${mod.key} ${active.filter((card) => moduleKeyFromRel(card.relPath) === mod.key).length}`).join(' · ')}`,
    '',
    '## 模块',
    '',
  ]
  for (const mod of MODULES) {
    const rows = active.filter((card) => moduleKeyFromRel(card.relPath) === mod.key)
    lines.push(`### ${mod.dir}`, '', `> ${mod.topics}`, '')
    if (rows.length === 0) lines.push('（暂无记录）', '')
    for (const card of rows) lines.push(`- [[${card.title}]] · ${card.type} · ${card.relPath}`)
    lines.push('')
  }
  if (inbox.length > 0) {
    lines.push('## 收件箱', '')
    for (const card of inbox) lines.push(`- [[${card.title}]] · ${card.relPath}`)
    lines.push('')
  }
  const text = lines.join('\n')
  await fs.writeFile(path.join(vault, 'index.md'), text, 'utf8')
  return active.length
}

export async function verifyVault(vault) {
  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok, detail })
  try {
    await ensureLayout(vault)
    add('知识库目录结构', true, MODULES.map((mod) => mod.dir).join(' / '))
  } catch (error) {
    add('知识库目录结构', false, String(error?.message ?? error))
  }

  let cards = []
  try {
    cards = await readCatalog(vault)
    add('记录可解析', true, `${cards.length} 条记录`)
  } catch (error) {
    add('记录可解析', false, String(error?.message ?? error))
  }

  const ids = new Map()
  let duplicateIds = 0
  for (const card of cards) ids.set(card.id, (ids.get(card.id) ?? 0) + 1)
  for (const count of ids.values()) if (count > 1) duplicateIds += 1
  add('记录 ID 唯一', duplicateIds === 0, duplicateIds === 0 ? '全部唯一' : `${duplicateIds} 个重复 ID`)

  const titles = new Set(cards.map((card) => card.title.toLowerCase()))
  let broken = 0
  for (const card of cards) for (const link of card.links) if (!titles.has(link.toLowerCase())) broken += 1
  add('[[链接]] 可解析', broken === 0, broken === 0 ? '无断链' : `${broken} 个断链`)

  let indexOk = false
  let indexDetail = ''
  try {
    const index = await fs.readFile(path.join(vault, 'index.md'), 'utf8')
    const missing = cards.filter((card) => !card.inInbox && card.status !== 'archived' && !index.includes(card.title))
    indexOk = missing.length === 0
    indexDetail = missing.length === 0 ? 'index.md 覆盖全部记录' : `${missing.length} 条记录未出现在 index.md`
  } catch (error) {
    indexDetail = String(error?.message ?? error)
  }
  add('index.md 完整', indexOk, indexDetail)

  const inbox = cards.filter((card) => card.inInbox)
  add('收件箱', true, `${inbox.length} 条待整理`)

  let backups = 0
  try {
    const entries = await fs.readdir(path.join(vault, BACKUP_DIR))
    backups = entries.length
  } catch { backups = 0 }
  add('备份目录可用', true, `${backups} 个备份批次`)

  const report = {
    ok: checks.every((check) => check.ok),
    checkedAt: new Date().toISOString(),
    vault,
    stats: { cards: cards.length, inbox: inbox.length, backups },
    checks,
  }
  return report
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

export function makeCardId(prefix = 'card') {
  return `${todayISO().replace(/-/g, '')}-${prefix}-${crypto.randomBytes(2).toString('hex')}`
}

export function renderCard({ id, title, type, module, status = 'active', source = '', source_url = '', author = '', published = '', captured = todayISO(), updated = todayISO(), review_after = '', confidence = 'confirmed', tags = [], conflict_of = [], related = [], body = '' }) {
  const front = renderFrontmatter({
    id,
    title,
    type,
    module,
    status,
    source,
    source_url,
    author,
    published,
    captured,
    updated,
    review_after,
    confidence,
    tags,
    conflict_of,
    related,
  })
  return `${front}\n\n${String(body).trim()}\n`
}

export async function saveInbox(vault, text, options = {}) {
  await ensureLayout(vault)
  const body = String(text ?? '').trim()
  if (body.length === 0) throw new Error('没有可保存的内容')
  const title = String(options.title ?? '').trim() || cardTitleFromBody(body, '未命名资料')
  const id = makeCardId('inbox')
  const stamp = new Date()
  const fileBase = `${todayISO()}-${String(stamp.getHours()).padStart(2, '0')}${String(stamp.getMinutes()).padStart(2, '0')}-${title.slice(0, 24).replace(/[\\/:*?"<>|\s]+/g, '-')}`
  const rel = path.join(INBOX_DIR, `${fileBase}.md`).split(path.sep).join('/')
  const content = renderCard({
    id,
    title,
    type: options.type ?? '其他',
    module: 'inbox',
    status: 'inbox',
    source: options.source ?? '',
    source_url: options.source_url ?? '',
    captured: todayISO(),
    body,
  })
  const target = resolveInside(vault, rel)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content, 'utf8')
  await appendLog(vault, `存入收件箱 ${rel}`)
  return { ok: true, path: rel, id, title, bytes: Buffer.byteLength(body, 'utf8') }
}

export async function readPage(vault, rel) {
  const target = resolveInside(vault, rel)
  const raw = await fs.readFile(target, 'utf8')
  return { path: rel, content: raw }
}

export function vaultStats(cards) {
  const active = cards.filter((card) => !card.inInbox && card.status !== 'archived')
  return {
    cards: active.length,
    inbox: cards.filter((card) => card.inInbox).length,
    modules: Object.fromEntries(MODULES.map((mod) => [mod.key, active.filter((card) => moduleKeyFromRel(card.relPath) === mod.key).length])),
    bytes: active.reduce((sum, card) => sum + card.size, 0),
  }
}

export { todayISO, nowStamp, uid }
