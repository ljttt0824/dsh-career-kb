import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CLIENT = path.resolve(HERE, '../lib/client.js')

function makeElement(tag) {
  const element = {
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    dataset: {},
    children: [],
    listeners: {},
    innerHTML: '',
    textContent: '',
    title: '',
    type: '',
    disabled: false,
    offsetWidth: 120,
    offsetHeight: 40,
    removed: false,
    appendChild(child) { this.children.push(child); return child },
    addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler) },
    removeEventListener() {},
    remove() {
      this.removed = true
      const body = globalThis.__testDocument?.body
      const index = body?.children?.indexOf(this) ?? -1
      if (index >= 0) body.children.splice(index, 1)
    },
    querySelector() { return makeElement('span') },
    closest() { return null },
    setAttribute() {},
    getAttribute() { return null },
    click() { for (const handler of this.listeners.click ?? []) handler({ target: this }) },
  }
  return element
}

test('client half loads, installs surfaces and saves selected text through the API', async () => {
  const code = await fs.readFile(CLIENT, 'utf8')

  const listeners = {}
  const styles = []
  const document = {
    head: { appendChild(node) { styles.push(node) } },
    body: { children: [], appendChild(node) { this.children.push(node); return node } },
    querySelector() { return null },
    createElement(tag) { return makeElement(tag) },
    addEventListener(type, handler) { (listeners[type] ??= []).push(handler) },
    removeEventListener() {},
  }

  let definition
  const window = {
    __ModuleLoader__: { load(def) { definition = def } },
    innerWidth: 1200,
    innerHeight: 800,
    getSelection() { return null },
    setTimeout(fn) { fn() },
  }

  const fetchCalls = []
  const fetchImpl = async (url, options) => {
    fetchCalls.push({ url, options })
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, steered: true, saved: { path: '00-收件箱/20260101-1200-测试.md', id: 'x', title: '测试' } }),
    }
  }
  const React = {
    createElement(tag, props, ...children) { return { tag, props, children } },
    memo(value) { return value },
    useState(value) { return [value, () => {}] },
    useEffect() {},
    useCallback(fn) { return fn },
    useMemo(fn) { return fn() },
    useRef() { return { current: null } },
  }

  const fakeRequire = (name) => {
    if (name === 'react') return React
    throw new Error('unknown module ' + name)
  }
  const run = new Function('window', 'document', 'fetch', code)
  globalThis.Element = class Element {}
  globalThis.__testDocument = document
  run(window, document, fetchImpl)

  assert.ok(definition !== undefined, '模块没有注册')
  assert.equal(definition.id, 'dsh-career-kb')
  const exports = definition.factory(fakeRequire)
  assert.equal(exports.name, 'dsh-career-kb')

  const registrations = []
  const effects = []
  const ctx = {
    slots: {
      inject(name, callback) { callback() },
      register(spec, component) { registrations.push({ name: spec.name, id: spec.id, key: spec.key, component }); return () => {} },
    },
    effect(fn) { effects.push(fn()); return () => {} },
  }
  exports.apply(ctx)

  assert.equal(styles.length, 1, '样式只注入一次')
  assert.match(styles[0].textContent, /\.ck-float/)
  assert.equal(registrations.length, 3)
  assert.ok(registrations.some((item) => item.name === 'sidebar.panellist' && item.id === 'career-kb'))
  assert.ok(registrations.some((item) => item.name === 'main' && item.key === 'career-kb'))
  assert.ok(registrations.some((item) => item.name === 'conversation.chat.assistant-actions'))

  for (const type of ['mouseup', 'contextmenu', 'mousedown', 'scroll', 'keyup']) {
    assert.ok((listeners[type] ?? []).length > 0, `缺少 ${type} 监听`)
  }

  // Simulate a text selection and click the floating save button.
  window.getSelection = () => ({
    toString: () => '这是选中的一段回答文字',
    rangeCount: 1,
    getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 100, top: 100, width: 60, height: 20, bottom: 120 }) }),
  })
  const mouseUp = listeners.mouseup[0]
  mouseUp({ target: { closest: () => null } })

  const float = document.body.children.find((node) => node.className === 'ck-float')
  assert.ok(float !== undefined, '选中文字后出现浮动按钮')
  assert.match(float.innerHTML, /存入知识库/)

  float.listeners.click[0]({})
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(fetchCalls.length, 1)
  assert.match(fetchCalls[0].url, /\/api\/career-kb\/save$/)
  const payload = JSON.parse(fetchCalls[0].options.body)
  assert.equal(payload.text, '这是选中的一段回答文字')
  assert.equal(payload.mode, 'auto')

  // Context menu on a selected fragment offers the same capture entry.
  const menuHandler = listeners.contextmenu[0]
  let prevented = false
  menuHandler({ preventDefault() { prevented = true }, target: { closest: () => null }, clientX: 40, clientY: 40 })
  assert.equal(prevented, true, '选中文字时拦截右键菜单并给出入库项')
  window.getSelection = () => null
  let preventedEmpty = false
  menuHandler({ preventDefault() { preventedEmpty = true }, target: { closest: () => null }, clientX: 40, clientY: 40 })
  assert.equal(preventedEmpty, false, '未选中时不拦截右键菜单')
})
