import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'

import { apply } from '../lib/index.js'

function makeCtx(options = {}) {
  const tools = new Map()
  const commands = new Map()
  const sections = []
  const routes = []
  const steered = []
  const toolService = {
    register(definition) {
      tools.set(definition.name, definition)
      return () => tools.delete(definition.name)
    },
    get(name) {
      if (options.feishuTools === true && ['feishu_doc', 'feishu_wiki', 'feishu_drive'].includes(name)) return { name }
      return undefined
    },
  }
  const agent = {
    session: options.sessionId ?? 'session-test',
    steer(message) { steered.push(message) },
  }
  const ctx = {
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    get(name) {
      if (name === 'tools') return toolService
      if (name === 'agents') return { roots: () => [agent], list: () => [agent], get: () => agent }
      if (name === 'llm') return undefined
      return undefined
    },
    inject(names, callback) {
      const scope = {
        tools: toolService,
        systemPrompt: { section(section) { sections.push(section); return () => {} } },
        commands: { register(definition) { commands.set(definition.name, definition); return () => commands.delete(definition.name) } },
        webServer: { register(route) { routes.push(route); return () => {} } },
        effect() {},
      }
      callback(scope)
    },
    effect(fn) { if (typeof fn === 'function') fn() },
  }
  return { ctx, tools, commands, sections, routes, steered, agent }
}

async function callTool(tools, name, args) {
  const definition = tools.get(name)
  assert.ok(definition !== undefined, `工具未注册：${name}`)
  return definition.execute(args)
}

function fakeRequest(method, body) {
  const req = new EventEmitter()
  req.method = method
  req.url = '/'
  process.nextTick(() => {
    if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body)))
    req.emit('end')
  })
  return req
}

function fakeResponse() {
  const chunks = []
  return {
    statusCode: 0,
    headers: {},
    writeHead(status, headers) { this.statusCode = status; this.headers = headers ?? {} },
    end(text) { if (text !== undefined) chunks.push(String(text)) },
    body() { return chunks.join('') },
    json() { return JSON.parse(this.body()) },
  }
}

async function callRoute(routes, routePath, method, body) {
  const route = routes.find((item) => item.path === routePath)
  assert.ok(route !== undefined, `路由未注册：${routePath}`)
  const res = fakeResponse()
  await route.handler(fakeRequest(method, body), res)
  return res
}

test('host registers tools, commands, prompt section and routes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-kb-host-'))
  const { ctx, tools, commands, sections, routes } = makeCtx()
  apply(ctx, { dataDir: dir })
  await new Promise((resolve) => setTimeout(resolve, 50))

  const expectedTools = ['career_status', 'career_index', 'career_read', 'career_search', 'career_save', 'career_audit', 'career_apply', 'career_verify', 'career_reindex', 'career_skill']
  for (const name of expectedTools) assert.ok(tools.has(name), `缺少工具 ${name}`)
  assert.equal(commands.size, 11, [...commands.keys()].join(','))
  assert.ok(sections.some((section) => /职业生涯知识库/.test(section.text)))
  assert.ok(routes.some((route) => route.path === '/api/career-kb/state'))
  await cleanup(dir)
})

test('tools work end-to-end: save, search, audit, apply gate, verify', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-kb-tools-'))
  const { ctx, tools } = makeCtx()
  apply(ctx, { dataDir: dir })

  const saved = JSON.parse(await callTool(tools, 'career_save', { text: 'RAG 学习助手把检索失败率从 32% 降到 6%。', title: 'RAG 学习助手', source: '用户陈述' }))
  assert.equal(saved.ok, true)

  const search = JSON.parse(await callTool(tools, 'career_search', { query: 'RAG' }))
  assert.equal(search.count, 1)

  const audit = JSON.parse(await callTool(tools, 'career_audit', {}))
  assert.equal(audit.ok, true)
  assert.ok(Array.isArray(audit.findings))
  assert.ok(audit.findings.some((finding) => finding.kind === 'inbox-backlog'))

  const blocked = JSON.parse(await callTool(tools, 'career_apply', { actions: [], confirm: false }))
  assert.equal(blocked.ok, false)

  const verify = JSON.parse(await callTool(tools, 'career_verify', {}))
  assert.ok(Array.isArray(verify.checks))

  const status = JSON.parse(await callTool(tools, 'career_status', {}))
  assert.equal(status.feishu.available, false)

  const skill = await callTool(tools, 'career_skill', { name: 'resume' })
  assert.match(skill, /JD 定向简历/)

  await cleanup(dir)
})

test('commands steer the agent with the skill SOP', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-kb-cmd-'))
  const { ctx, commands, steered } = makeCtx({ sessionId: 's1' })
  apply(ctx, { dataDir: dir })

  const auditCommand = commands.get('career-audit')
  const fakeAgent = { steer(message) { steered.push(message) } }
  const result = await auditCommand.handler({ agent: fakeAgent, rawInput: '', attachments: [] })
  assert.equal(result.kind, 'success')

  const resumeCommand = commands.get('career-resume')
  const resumeResult = await resumeCommand.handler({ agent: fakeAgent, rawInput: '某公司 AI 产品实习 JD：客户调研、方案材料。', attachments: [] })
  assert.equal(resumeResult.kind, 'success')
  assert.equal(steered.length, 2)
  assert.match(steered[0].content[0].text, /全库整理巡检/)
  const text = steered[1].content[0].text
  assert.match(text, /JD 定向简历/)
  assert.match(text, /不得虚构/)

  const saveEmpty = await commands.get('career-save').handler({ agent: fakeAgent, rawInput: '', attachments: [] })
  assert.equal(saveEmpty.kind, 'error')

  await cleanup(dir)
})

test('HTTP routes expose state, save (steers), audit and verify', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-kb-http-'))
  const { ctx, routes, steered } = makeCtx({ sessionId: 's1' })
  apply(ctx, { dataDir: dir })

  const health = await callRoute(routes, '/api/career-kb/health', 'GET')
  assert.equal(health.statusCode, 200)
  assert.equal(health.json().plugin, 'dsh-career-kb')

  const save = await callRoute(routes, '/api/career-kb/save', 'POST', { text: '选中的一段文字：结构化面试的 STAR 法。', source: 'selection', mode: 'auto', sessionId: 's1' })
  assert.equal(save.statusCode, 200)
  assert.equal(save.json().steered, true)
  assert.equal(steered.length, 1)

  const state = await callRoute(routes, '/api/career-kb/state', 'GET')
  assert.equal(state.json().stats.inbox, 1)
  assert.ok(Array.isArray(state.json().skills))

  const audit = await callRoute(routes, '/api/career-kb/audit', 'POST', {})
  assert.equal(audit.json().ok, true)
  assert.ok(Array.isArray(audit.json().findings))

  const verify = await callRoute(routes, '/api/career-kb/verify', 'GET')
  assert.ok(Array.isArray(verify.json().checks))

  await cleanup(dir)
})

test('feishu detection flips on when feishu tools are registered', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-kb-feishu-'))
  const { ctx, tools } = makeCtx({ feishuTools: true })
  apply(ctx, { dataDir: dir })
  const status = JSON.parse(await callTool(tools, 'career_status', {}))
  assert.equal(status.feishu.available, true)
  assert.ok(status.feishu.tools.includes('feishu_doc'))
  await cleanup(dir)
})

async function cleanup(dir) {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 60 }).catch(() => {})
}

