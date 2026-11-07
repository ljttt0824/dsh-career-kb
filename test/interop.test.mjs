import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { buildSkillPrompt, listSkills, readSkillText, SKILLS } from '../lib/skills.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = path.resolve(HERE, '..')

test('every skill has a SOP file and a command', async () => {
  for (const skill of SKILLS) {
    const text = await readSkillText(skill.name)
    assert.ok(text.trim().length > 200, `${skill.name} 内容过少`)
    assert.match(text, /^#/m, `${skill.name} 缺少标题`)
    assert.ok(skill.command.startsWith('career-'), `${skill.name} 命令名不规范`)
  }
  assert.equal(listSkills().length, SKILLS.length)
})

test('skill prompts include the vault path, tool guide and truthfulness rules', async () => {
  const prompt = await buildSkillPrompt('resume', '某岗位 JD', { dataDir: 'C:/vault', feishuAvailable: true })
  assert.match(prompt, /C:\/vault/)
  assert.match(prompt, /career_audit/)
  assert.match(prompt, /不得虚构/)
  assert.match(prompt, /飞书/)
})

test('templates and fewshot examples exist and are anonymized', async () => {
  const templates = await fs.readdir(path.join(PACKAGE_ROOT, 'templates'))
  assert.ok(templates.length >= 6, `模板过少：${templates.join(',')}`)
  const examples = await fs.readdir(path.join(PACKAGE_ROOT, 'examples'))
  assert.ok(examples.length >= 5, `示例过少：${examples.join(',')}`)
  for (const name of ['fewshot-capture.md', 'fewshot-audit.md', 'fewshot-resume.md', 'fewshot-interview-prep.md', 'fewshot-interview-review.md']) {
    const text = await fs.readFile(path.join(PACKAGE_ROOT, 'examples', name), 'utf8')
    assert.match(text, /正例|反例|示例/, `${name} 缺少正反例`)
    assert.doesNotMatch(text, /cl_[a-z0-9]{10,}/i, `${name} 含疑似密钥`)
    assert.doesNotMatch(text, /1[3-9]\d{9}/, `${name} 含手机号`)
  }
})

test('feishu tool names referenced by the skills match the installed dsh-feishu surface', async () => {
  const profile = process.env.DSH_PROFILE_DIR ?? path.join(process.env.USERPROFILE ?? '', '.dsh', 'profiles', 'desktop')
  const toolsDir = path.join(profile, 'node_modules', 'dsh-feishu', 'lib', 'tools')
  let available = true
  try {
    await fs.access(toolsDir)
  } catch {
    available = false
  }
  if (!available) {
    assert.ok(true, '未安装 dsh-feishu，跳过精确对照')
    return
  }
  const files = await fs.readdir(toolsDir)
  const names = new Set()
  for (const file of files) {
    if (!file.endsWith('.js')) continue
    const text = await fs.readFile(path.join(toolsDir, file), 'utf8')
    for (const match of text.matchAll(/name:\s*'(feishu_[a-z_]+)'/g)) names.add(match[1])
  }
  const required = ['feishu_doc', 'feishu_wiki', 'feishu_drive']
  for (const name of required) assert.ok(names.has(name), `dsh-feishu 未提供 ${name}`)
  const capture = await readSkillText('capture')
  for (const name of required) assert.match(capture, new RegExp(name), `capture 技能未提及 ${name}`)
  assert.match(capture, /feishu_bitable|feishu_sheet|feishu_doc/, 'capture 技能未提及飞书写入')
})
