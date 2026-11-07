/**
 * dsh-career-kb — host half.
 *
 * Professional-career vault for DeepSeek Harness. It owns the local
 * Obsidian-compatible vault, registers agent tools and slash commands, exposes
 * a small HTTP API for the browser panel/selection surfaces, and steers the
 * running agent into the bundled skill SOPs (capture, audit, resume,
 * interview-prep, interview-review, ...). When dsh-feishu is installed the
 * skills use its `feishu_*` tools; this plugin never assumes they exist.
 */

import crypto from 'node:crypto'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import {
  applyActions,
  auditVault,
  ensureLayout,
  readCatalog,
  readPage,
  resolveDataDir,
  saveInbox,
  searchKnowledge,
  verifyVault,
  rewriteIndex,
  vaultStats,
  MODULES,
  INBOX_DIR,
  todayISO,
} from './core.js'
import { buildSkillPrompt, listSkills, readSkillText, skillCatalogMarkdown, skillMeta, SKILLS } from './skills.js'

export const name = 'career-kb'
export const inject = ['tools']

const ROUTE_PREFIX = '/api/career-kb'
const MAX_BODY = 4 * 1024 * 1024
const FEISHU_TOOL_PROBES = [
  'feishu_doc',
  'feishu_wiki',
  'feishu_drive',
  'feishu_sheet',
  'feishu_bitable',
  'feishu_query',
  'feishu_message',
]

function textOutput() {
  return {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: String(value) }],
  }
}

function toolSchema(properties, required = []) {
  return { type: 'object', properties, required, additionalProperties: false }
}

function makeUserMessage(text) {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('请求体超过 4MB'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim().length === 0) return resolve({})
      try { resolve(JSON.parse(text)) } catch (error) { reject(new Error('请求体不是 JSON: ' + error.message)) }
    })
    req.on('error', reject)
  })
}

function detectFeishu(ctx) {
  const result = { available: false, tools: [] }
  try {
    const tools = ctx.get('tools')
    if (tools === undefined || typeof tools.get !== 'function') return result
    for (const toolName of FEISHU_TOOL_PROBES) {
      try {
        if (tools.get(toolName) !== undefined) result.tools.push(toolName)
      } catch { /* unknown tool */ }
    }
    result.available = result.tools.length > 0
  } catch { /* tools service is optional */ }
  return result
}

function pickAgent(ctx, sessionId) {
  try {
    const agents = ctx.get('agents')
    if (agents === undefined) return undefined
    if (typeof sessionId === 'string' && sessionId.length > 0) {
      const direct = typeof agents.get === 'function' ? agents.get(sessionId) : undefined
      if (direct !== undefined) return direct
      const all = typeof agents.list === 'function' ? agents.list() : []
      const match = all.find((agent) => agent?.session === sessionId || agent?.session?.id === sessionId)
      if (match !== undefined) return match
    }
    const roots = typeof agents.roots === 'function' ? agents.roots() : []
    if (roots.length > 0) return roots[roots.length - 1]
    const all = typeof agents.list === 'function' ? agents.list() : []
    return all.length > 0 ? all[all.length - 1] : undefined
  } catch {
    return undefined
  }
}

function steerAgent(ctx, sessionId, text) {
  const agent = pickAgent(ctx, sessionId)
  if (agent === undefined || typeof agent.steer !== 'function') return false
  agent.steer(makeUserMessage(text))
  return true
}

function buildTools(ctx, dataDir, config) {
  const run = (toolName, description, parameters, execute, timeoutMs = 60000) => ({
    name: toolName,
    description,
    parameters,
    output: textOutput(),
    timeoutMs,
    async execute(args) { return execute(args ?? {}) },
  })

  return [
    run(
      'career_status',
      '查看职业生涯知识库状态：记录数、模块分布、收件箱待整理、最近巡检结果、飞书工具是否可用。',
      toolSchema({}),
      async () => {
        await ensureLayout(dataDir)
        const cards = await readCatalog(dataDir)
        const stats = vaultStats(cards)
        let lastAudit = null
        try {
          const raw = await fs.readFile(path.join(dataDir, '_meta', 'audit', 'last.json'), 'utf8')
          const parsed = JSON.parse(raw)
          lastAudit = { runId: parsed.runId, generatedAt: parsed.generatedAt, counts: parsed.counts }
        } catch { lastAudit = null }
        const feishu = detectFeishu(ctx)
        return JSON.stringify({
          ok: true,
          dataDir,
          stats,
          inbox: cards.filter((card) => card.inInbox).map((card) => ({ title: card.title, path: card.relPath })),
          lastAudit,
          feishu,
          skills: listSkills().map((skill) => `${skill.command} ${skill.title}`),
          today: todayISO(),
        }, null, 2)
      },
    ),
    run(
      'career_index',
      '读取职业生涯知识库的 index.md 索引。回答职业/简历/面试相关问题前先读索引。',
      toolSchema({}),
      async () => (await fs.readFile(path.join(dataDir, 'index.md'), 'utf8')),
    ),
    run(
      'career_read',
      '读取知识库中的一条记录（vault 相对路径，如 04-项目与成果沉淀/项目档案/xxx.md）。',
      toolSchema({ path: { type: 'string', description: 'vault 相对路径' } }, ['path']),
      async (args) => {
        const page = await readPage(dataDir, String(args.path ?? ''))
        return page.content
      },
    ),
    run(
      'career_search',
      '在职业生涯知识库中搜索（标题 12 分、标签 6 分、正文命中）。返回路径、模块、类型与片段。',
      toolSchema({
        query: { type: 'string', description: '关键词，可空格分隔多个词' },
        limit: { type: 'integer', description: '最多返回条数，默认 12，上限 50' },
      }, ['query']),
      async (args) => {
        const rows = await searchKnowledge(dataDir, String(args.query ?? ''), Number.isFinite(args.limit) ? args.limit : 12)
        return JSON.stringify({ query: args.query, count: rows.length, results: rows }, null, 2)
      },
    ),
    run(
      'career_save',
      '把用户给的原始资料存入知识库收件箱（不做整理、不写飞书）。整理请使用「存入与整理」技能。',
      toolSchema({
        text: { type: 'string', description: '原始资料正文或摘录' },
        title: { type: 'string', description: '可选标题' },
        source: { type: 'string', description: '来源平台/作者' },
        source_url: { type: 'string', description: '原始链接' },
      }, ['text']),
      async (args) => JSON.stringify(await saveInbox(dataDir, String(args.text ?? ''), {
        title: args.title,
        source: args.source,
        source_url: args.source_url,
      }), null, 2),
    ),
    run(
      'career_audit',
      '只读巡检整个知识库：重复、近似重复、冗余、过时、冲突、归类错误、无来源、断链、孤立记录、收件箱积压。返回 finding id 与建议动作；不修改任何文件。',
      toolSchema({
        include: { type: 'array', items: { type: 'string' }, description: '只检查这些类型（可选）' },
      }),
      async (args) => JSON.stringify(await auditVault(dataDir, { include: Array.isArray(args.include) ? args.include : undefined }), null, 2),
      120000,
    ),
    run(
      'career_apply',
      '执行用户已确认的整理动作（move/merge/archive/delete/update/create）。必须带 confirm=true，并先得到用户对具体 finding 的确认；执行前自动备份。',
      toolSchema({
        actions: { type: 'array', items: { type: 'object' }, description: '动作列表：{kind, from[], to[], into, content, patch}' },
        confirm: { type: 'boolean', description: '用户已明确确认时为 true' },
      }, ['actions', 'confirm']),
      async (args) => {
        if (args.confirm !== true) {
          return JSON.stringify({ ok: false, error: '未确认：请先把整改清单给用户，得到明确确认后再带 confirm=true 调用。' })
        }
        const report = await applyActions(dataDir, Array.isArray(args.actions) ? args.actions : [], { confirm: true })
        return JSON.stringify(report, null, 2)
      },
      120000,
    ),
    run(
      'career_verify',
      '自检知识库：目录结构、记录可解析、ID 唯一、链接可解析、index 完整、备份目录。只读。',
      toolSchema({}),
      async () => JSON.stringify(await verifyVault(dataDir), null, 2),
    ),
    run(
      'career_reindex',
      '重建 index.md 索引（按六大模块列出全部记录）。',
      toolSchema({}),
      async () => JSON.stringify({ ok: true, count: await rewriteIndex(dataDir) }, null, 2),
    ),
    run(
      'career_skill',
      '读取 dsh-career-kb 的技能 SOP；name 省略时列出全部技能。',
      toolSchema({ name: { type: 'string', description: '技能名：setup/capture/audit/resume/interview-prep/interview-review/search/jd-decode/weekly-review' } }),
      async (args) => {
        const wanted = String(args.name ?? '').trim()
        if (wanted.length === 0) return JSON.stringify(listSkills(), null, 2)
        return readSkillText(wanted)
      },
    ),
  ]
}

function registerRoutes(scope, ctx, dataDir) {
  const disposers = []
  const add = (kind, routePath, handler) => {
    disposers.push(scope.webServer.register({ kind, path: routePath, handler }))
  }

  add('exact', `${ROUTE_PREFIX}/health`, async (req, res) => {
    if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method not allowed' })
    json(res, 200, { ok: true, plugin: 'dsh-career-kb', dataDir, today: todayISO() })
  })

  add('exact', `${ROUTE_PREFIX}/state`, async (req, res) => {
    if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method not allowed' })
    try {
      await ensureLayout(dataDir)
      const cards = await readCatalog(dataDir)
      const stats = vaultStats(cards)
      const inbox = cards.filter((card) => card.inInbox).map((card) => ({ title: card.title, path: card.relPath }))
      let lastAudit = null
      try {
        const raw = await fs.readFile(path.join(dataDir, '_meta', 'audit', 'last.json'), 'utf8')
        const parsed = JSON.parse(raw)
        lastAudit = { runId: parsed.runId, generatedAt: parsed.generatedAt, counts: parsed.counts, findings: parsed.findings?.slice(0, 60) }
      } catch { lastAudit = null }
      let logTail = ''
      try {
        const log = await fs.readFile(path.join(dataDir, 'log.md'), 'utf8')
        logTail = log.split('\n').slice(-30).join('\n')
      } catch { logTail = '' }
      json(res, 200, {
        ok: true,
        dataDir,
        stats,
        inbox,
        lastAudit,
        logTail,
        modules: MODULES,
        skills: listSkills(),
        feishu: detectFeishu(ctx),
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      json(res, 500, { ok: false, error: String(error?.message ?? error) })
    }
  })

  add('exact', `${ROUTE_PREFIX}/save`, async (req, res) => {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
    try {
      const body = await readBody(req)
      const text = typeof body.text === 'string' ? body.text : ''
      if (text.trim().length === 0) return json(res, 400, { ok: false, error: '没有可保存的内容' })
      const saved = await saveInbox(dataDir, text, {
        title: body.title,
        source: typeof body.source === 'string' ? body.source : '选中文字',
      })
      let steered = false
      if (body.mode !== 'local') {
        try {
          const feishu = detectFeishu(ctx)
          const prompt = await buildSkillPrompt('capture', `我刚存入收件箱一条资料：${saved.path}\n\n原始内容：\n${text}`, {
            dataDir,
            feishuAvailable: feishu.available,
            extra: '这是用户从对话中选中的文字，请按存入 SOP 整理成知识卡；如果 detection 显示飞书工具可用，同时同步到飞书知识库并在回答中给出来源链接。',
          })
          steered = steerAgent(ctx, typeof body.sessionId === 'string' ? body.sessionId : undefined, prompt)
        } catch (error) {
          steered = false
          void error
        }
      }
      json(res, 200, { ok: true, saved, steered })
    } catch (error) {
      json(res, 400, { ok: false, error: String(error?.message ?? error) })
    }
  })

  add('exact', `${ROUTE_PREFIX}/audit`, async (req, res) => {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
    try {
      const body = await readBody(req)
      const report = await auditVault(dataDir, { include: Array.isArray(body.include) ? body.include : undefined })
      json(res, 200, report)
    } catch (error) {
      json(res, 500, { ok: false, error: String(error?.message ?? error) })
    }
  })

  add('exact', `${ROUTE_PREFIX}/apply`, async (req, res) => {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
    try {
      const body = await readBody(req)
      const report = await applyActions(dataDir, Array.isArray(body.actions) ? body.actions : [], { confirm: body.confirm === true })
      json(res, 200, report)
    } catch (error) {
      json(res, 400, { ok: false, error: String(error?.message ?? error) })
    }
  })

  add('exact', `${ROUTE_PREFIX}/verify`, async (req, res) => {
    if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method not allowed' })
    try {
      json(res, 200, await verifyVault(dataDir))
    } catch (error) {
      json(res, 500, { ok: false, error: String(error?.message ?? error) })
    }
  })

  add('exact', `${ROUTE_PREFIX}/reindex`, async (req, res) => {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
    try {
      const count = await rewriteIndex(dataDir)
      json(res, 200, { ok: true, count })
    } catch (error) {
      json(res, 500, { ok: false, error: String(error?.message ?? error) })
    }
  })

  scope.effect(() => () => {
    for (const dispose of disposers) dispose()
  }, 'career-kb: http routes')
}

function registerCommands(ctx, dataDir, config) {
  const register = (definition) => {
    try {
      ctx.commands.register(definition)
    } catch (error) {
      ctx.logger?.warn?.(`career-kb: 注册命令 ${definition.name} 失败: ${String(error?.message ?? error)}`)
    }
  }

  const steerPrompt = async (agent, skillName, rawInput, extra) => {
    const feishu = detectFeishu(ctx)
    const prompt = await buildSkillPrompt(skillName, rawInput, { dataDir, feishuAvailable: feishu.available, extra })
    agent.steer(makeUserMessage(prompt))
    return { kind: 'success', text: `已把「${skillMeta(skillName)?.title ?? skillName}」交给 AI 执行${feishu.available ? '，检测到飞书工具，会同步飞书' : '（未检测到飞书工具，只写本机）'}。` }
  }

  register({
    name: 'career',
    description: '职业生涯知识库：列出全部技能与用法',
    handler: async () => ({
      kind: 'success',
      text: [
        '职业生涯知识库（dsh-career-kb）可用技能：',
        skillCatalogMarkdown(),
        '',
        '也可以直接选中对话里的文字，点「存入知识库」或右键存入。',
        '数据目录：' + dataDir,
      ].join('\n'),
    }),
  })

  const skillCommands = [
    ['career-setup', 'setup', '首次搭建职业档案（访谈 + 画像 + 规划）'],
    ['career-save', 'capture', '把资料/剪藏整理成知识卡并同步飞书'],
    ['career-import', 'import', '导入飞书知识库/本地目录里已有的职业资料'],
    ['career-audit', 'audit', '全库巡检：重复/冗余/过时/冲突/错放'],
    ['career-resume', 'resume', '按 JD 生成不造假的定向简历'],
    ['career-prep', 'interview-prep', '按 JD + 面经准备面试材料与模拟问答'],
    ['career-review', 'interview-review', '面试复盘：经验沉淀与下一轮改进'],
    ['career-search', 'search', '在职业知识库中检索并带来源回答'],
    ['career-jd', 'jd-decode', '拆解 JD、匹配证据、给出缺口与优先级'],
    ['career-weekly', 'weekly-review', '周/月复盘：成果、学习、求职进展'],
  ]

  for (const [command, skillName, description] of skillCommands) {
    const meta = skillMeta(skillName)
    register({
      name: command,
      description,
      input: { hint: meta?.inputHint ?? '' },
      handler: async ({ agent, rawInput }) => {
        if (skillName === 'capture' && String(rawInput ?? '').trim().length === 0) {
          return {
            kind: 'error',
            text: '请把要存入的内容贴在命令后面，或直接选中对话里的文字点「存入知识库」。',
          }
        }
        return steerPrompt(agent, skillName, String(rawInput ?? ''), skillName === 'audit'
          ? '先调用 career_audit 获取当前扫描结果；把 finding 按严重度整理成确认清单，等用户逐项确认后再调用 career_apply。'
          : undefined)
      },
    })
  }
}

export function apply(ctx, rawConfig) {
  const config = rawConfig !== null && typeof rawConfig === 'object' ? rawConfig : {}
  const dataDir = resolveDataDir(config)
  const logger = ctx.logger

  ensureLayout(dataDir).catch((error) => {
    logger?.error?.(`career-kb: 初始化知识库失败: ${String(error?.message ?? error)}`)
  })

  ctx.inject(['tools'], (scope) => {
    for (const definition of buildTools(ctx, dataDir, config)) scope.tools.register(definition)
    logger?.info?.(`career-kb: 已注册工具 career_status / career_index / career_read / career_search / career_save / career_audit / career_apply / career_verify / career_skill；数据目录 ${dataDir}`)
  })

  ctx.inject(['systemPrompt'], (scope) => {
    scope.systemPrompt.section({
      name: 'tool:career-kb',
      order: 150,
      text: [
        '本机有一个「职业生涯知识库」插件（dsh-career-kb），数据目录：' + dataDir + '。',
        '技能：' + skillCatalogMarkdown() + '。',
        '当用户提到简历、面试、JD、职业规划、投递、复盘、存入资料、整理知识库时，优先使用这些技能与工具；不确定时先调用 career_status 和 career_index。',
        '真实性红线：个人经历、职责、时间、成果数字、学历证书只能来自知识库已确认记录或用户本次陈述；没有证据就标「待核实」，不得编造或把他人经历写成用户经历。',
        '写入规则：删除/移动/合并/归档必须先给用户确认清单，用户明确同意后才调用 career_apply（confirm=true）；执行会自动备份到 _meta/backups。',
        '飞书：如果当前环境有 feishu_* 工具，把需要长期保存的成果同步到飞书知识库/文档，并回传链接；没有飞书工具时明确说明只写本机。',
        '回答末尾标注实际来源（知识库路径或链接）；未联网查面经时明确说明。',
      ].join(' '),
    })
  })

  ctx.inject(['commands'], (scope) => {
    registerCommands(scope, dataDir, config)
    logger?.info?.('career-kb: 已注册 /career 系列命令')
  })

  ctx.inject(['webServer'], (scope) => {
    registerRoutes(scope, ctx, dataDir)
    logger?.info?.(`career-kb: 已挂载 ${ROUTE_PREFIX} API`)
  })
}

export { SKILLS, INBOX_DIR }
