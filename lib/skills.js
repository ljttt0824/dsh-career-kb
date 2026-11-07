/**
 * dsh-career-kb — skill catalog.
 *
 * Skills are plain Markdown SOPs shipped inside the package. The host exposes
 * them through the `career_skill` tool and through slash commands, which paste
 * the SOP into a steered user message so the running agent can execute it with
 * the tools it already has (including `feishu_*` when dsh-feishu is installed).
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const PACKAGE_ROOT = path.resolve(HERE, '..')

export const SKILLS = [
  {
    name: 'setup',
    file: 'setup.md',
    title: '搭建知识库',
    description: '首次搭建六大模块职业档案：访谈、个人画像、职业规划、首页索引。',
    triggers: ['第一次用', '搭建知识库', '建档', '初始化'],
    command: 'career-setup',
    inputHint: '可选：你的目标方向、已有的简历或资料路径',
  },
  {
    name: 'capture',
    file: 'capture.md',
    title: '存入与整理',
    description: '把剪藏、帖子、网页、截图转成可学习/可复习/可复用的知识卡，自动查重、分类并同步飞书。',
    triggers: ['存入', '收进知识库', '整理剪藏', '这个收藏一下'],
    command: 'career-save',
    inputHint: '要存入的文字、链接或文件路径（可直接选中文后点按钮）',
  },
  {
    name: 'audit',
    file: 'audit.md',
    title: '全库整理巡检',
    description: '扫描整个知识库，找出重复、冗余、过时、冲突、归类错误、无来源与断链，给确认清单后执行。',
    triggers: ['整理知识库', '巡检', '查重', '清理知识库', '找重复'],
    command: 'career-audit',
    inputHint: '可选：只检查某个模块，如 03',
  },
  {
    name: 'resume',
    file: 'resume.md',
    title: 'JD 定向简历',
    description: '按岗位 JD 检索知识库证据，输出证据矩阵和可直接投递的简历，严禁虚构。',
    triggers: ['写简历', '改简历', '投这个岗', 'JD 简历'],
    command: 'career-resume',
    inputHint: '粘贴岗位 JD（可附目标公司/岗位名）',
  },
  {
    name: 'interview-prep',
    file: 'interview-prep.md',
    title: '面试准备',
    description: '按 JD、个人经历和联网面经生成自我介绍、复习清单、八股/常规/项目深挖/情景问答与模拟面试。',
    triggers: ['准备面试', '面试复习', '模拟面试', '面经'],
    command: 'career-prep',
    inputHint: '粘贴 JD；可补充公司、轮次、面试日期',
  },
  {
    name: 'interview-review',
    file: 'interview-review.md',
    title: '面试复盘',
    description: '根据真实面试过程、反馈和结果沉淀经验、改进动作与下一轮准备，关联申请与证据。',
    triggers: ['复盘面试', '面试完了', '一面复盘', '面试反馈'],
    command: 'career-review',
    inputHint: '面试公司/轮次 + 问到的问题 + 你的回答 + 反馈或结果',
  },
  {
    name: 'search',
    file: 'search.md',
    title: '知识库检索',
    description: '在职业档案里按主题、项目、岗位、时间检索，给出带路径和来源的答案。',
    triggers: ['查一下', '我以前', '知识库里有没有', '找记录'],
    command: 'career-search',
    inputHint: '要查的关键词或问题',
  },
  {
    name: 'jd-decode',
    file: 'jd-decode.md',
    title: 'JD 拆解与匹配',
    description: '把 JD 拆成职责/硬性/优先条件和关键词，匹配个人证据，给出投递优先级与缺口。',
    triggers: ['分析 JD', '这个岗匹配吗', '拆 JD'],
    command: 'career-jd',
    inputHint: '粘贴 JD',
  },
  {
    name: 'weekly-review',
    file: 'weekly-review.md',
    title: '周期复盘',
    description: '按周/月汇总成果、学习、求职进展与阻碍，回写规划和投递台账。',
    triggers: ['周复盘', '这周做了什么', '月度总结'],
    command: 'career-weekly',
    inputHint: '可选：起止日期或复盘范围',
  },
]

const skillCache = new Map()

export async function readSkillText(name) {
  const meta = SKILLS.find((skill) => skill.name === name || skill.command === name)
  if (meta === undefined) throw new Error(`未知技能：${name}`)
  if (skillCache.has(meta.name)) return skillCache.get(meta.name)
  const file = path.join(PACKAGE_ROOT, 'skills', meta.file)
  const text = await fs.readFile(file, 'utf8')
  skillCache.set(meta.name, text)
  return text
}

export function skillMeta(name) {
  return SKILLS.find((skill) => skill.name === name || skill.command === name)
}

export function listSkills() {
  return SKILLS.map((skill) => ({
    name: skill.name,
    title: skill.title,
    description: skill.description,
    triggers: skill.triggers,
    command: skill.command,
    inputHint: skill.inputHint,
  }))
}

export function skillCatalogMarkdown() {
  return SKILLS.map((skill) => `- ${skill.title}（/${skill.command}）：${skill.description}`).join('\n')
}

const TOOL_GUIDE = [
  '可用工具：',
  '- career_status / career_index / career_read / career_search：读取知识库。',
  '- career_save：把原始资料存入收件箱（不自动整理）。',
  '- career_audit：只读巡检，返回结构化问题清单和 finding id。',
  '- career_apply：仅在用户明确确认后执行移动/合并/归档/删除/更新，需要 confirm=true。',
  '- career_verify：自检知识库完整性。',
  '- career_reindex：重建 index.md 索引。',
  '- career_skill：按需读取其它技能 SOP。',
  '飞书：如果当前环境存在 feishu_doc / feishu_wiki / feishu_drive / feishu_sheet / feishu_bitable 等工具，按技能说明把成果同步到用户飞书空间；没有这些工具时明确说明只写在本机知识库。',
].join('\n')

export async function buildSkillPrompt(name, userInput, options = {}) {
  const meta = skillMeta(name)
  if (meta === undefined) throw new Error(`未知技能：${name}`)
  const sop = await readSkillText(meta.name)
  const dataDir = String(options.dataDir ?? '')
  const feishu = options.feishuAvailable === true ? '当前会话检测到飞书工具。' : '当前会话未检测到飞书工具（只能写本机知识库）。'
  const extra = typeof options.extra === 'string' && options.extra.trim().length > 0 ? `\n${options.extra.trim()}\n` : ''
  return [
    `你现在执行 dsh-career-kb 的「${meta.title}」技能。请严格按下面的 SOP 工作，不要跳过真实性检查和保存后读回核对。`,
    '',
    `知识库目录：${dataDir}`,
    feishu,
    '',
    TOOL_GUIDE,
    '',
    '技能 SOP：',
    '',
    sop.trim(),
    '',
    extra,
    '用户这次输入：',
    userInput.trim().length > 0 ? userInput.trim() : '（无额外输入，按技能默认流程开始，先问缺失的关键信息）',
    '',
    '执行要求：',
    '1. 涉及写入时，先读后写；写完读回核对，并报告真实保存路径。',
    '2. 不得虚构经历、数字、学历、证书或面试流程；没有证据的结论标「待核实」或留空。',
    '3. 需要用户确认的批量动作（删除/移动/合并/归档）先给清单，等确认后再调用 career_apply。',
    '4. 回答末尾给出：实际使用的来源（知识库路径 / 链接 / 未联网说明）。',
  ].join('\n')
}
