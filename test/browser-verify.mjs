// Browser-level verification for the dsh-career-kb client half.
// Usage: node test/browser-verify.mjs <appUrl> <cdpBase> [screenshotPath]
const appUrl = process.argv[2]
const cdpBase = process.argv[3] ?? 'http://127.0.0.1:9334'
const screenshotPath = process.argv[4]
const capturePath = process.argv[5]

const targets = await (await fetch(cdpBase + '/json/list')).json()
const page = targets.find((target) => target.type === 'page')
if (page === undefined) throw new Error('no page target')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })

let nextId = 1
const pending = new Map()
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.id !== undefined && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(JSON.stringify(message.error)))
    else resolve(message.result)
  }
}
function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(result.exceptionDetails).slice(0, 500))
  return result.result.value
}
async function waitFor(expression, timeoutMs = 25000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await evaluate(expression)
      if (value) return value
    } catch { /* keep waiting */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('timeout waiting for: ' + expression)
}

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: appUrl })
await waitFor("document.readyState === 'complete'", 30000)
await waitFor("document.body && document.body.innerText.length > 0", 30000)

// Dismiss the first-run preview notice so it does not cover the panel.
const dismissed = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button,[role="button"]')].find((node) => /^(继续|开始使用|我知道了|我了解)$/.test((node.innerText || '').trim()));
  if (button) { button.click(); return true; }
  return false;
})()`)
if (dismissed) await new Promise((resolve) => setTimeout(resolve, 400))

const styleReady = await waitFor("document.querySelector('style[data-plugin=\"dsh-career-kb\"]') !== null", 25000).catch(() => false)
check('客户端 bundle 已加载（样式已注入）', styleReady === true)

const sidebar = await evaluate(`(() => {
  const nodes = [...document.querySelectorAll('button,[role="button"],a,div,span')];
  const hit = nodes.find((node) => {
    const text = (node.textContent || '').trim();
    const aria = node.getAttribute('aria-label') || '';
    return (text === '职业生涯' || aria === '职业生涯') && node.offsetParent !== null;
  });
  return hit ? hit.tagName : '';
})()`)
check('左侧栏出现「职业生涯」入口', sidebar !== '', sidebar)

const clicked = await evaluate(`(() => {
  const nodes = [...document.querySelectorAll('button,[role="button"],a')];
  const hit = nodes.find((node) => {
    const text = (node.textContent || '').trim();
    const aria = node.getAttribute('aria-label') || '';
    return (text === '职业生涯' || aria === '职业生涯') && node.offsetParent !== null;
  });
  if (!hit) return false;
  hit.click();
  return true;
})()`)
check('点击入口', clicked === true)

const panelReady = await waitFor("document.querySelector('.ck-page') !== null", 20000).catch(() => false)
check('面板渲染 .ck-page', panelReady === true)

if (panelReady) {
  const chips = await waitFor(`(() => {
    const nodes = [...document.querySelectorAll('.ck-chip')];
    const text = nodes.map((node) => node.innerText.replace(/\\s+/g, ' ').trim()).join(' | ');
    const records = Number((text.match(/记录\\s*(\\d+)/) ?? [])[1] ?? 0);
    return text.length > 0 && records > 0 ? text : '';
  })()`, 12000).catch(() => '')
  check('统计 chips 渲染（含真实记录数）', typeof chips === 'string' && chips.length > 0, chips)

  const inboxText = await evaluate(`(() => { const card = [...document.querySelectorAll('.ck-card')].find((node) => node.innerText.includes('收件箱待整理')); return card ? card.innerText.slice(0, 180).replace(/\\s+/g, ' ') : ''; })()`)
  check('收件箱区块渲染', typeof inboxText === 'string' && inboxText.length > 0, inboxText)

  const auditClicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll('.ck-btn')].find((node) => node.innerText.includes('巡检全库'));
    if (!button) return false;
    button.click();
    return true;
  })()`)
  check('点击「巡检全库」', auditClicked === true)
  const findings = await waitFor("document.querySelectorAll('.ck-finding').length", 45000).catch(() => 0)
  check('巡检结果列表渲染', findings > 0, findings + ' 项')
  const auditSettled = await waitFor(`(() => {
    const button = [...document.querySelectorAll('.ck-btn')].find((node) => node.innerText.includes('巡检全库'));
    return button !== undefined && button.disabled === false;
  })()`, 60000).catch(() => false)
  check('巡检完成（按钮恢复可用）', auditSettled === true)

  if (typeof screenshotPath === 'string' && screenshotPath.length > 0 && auditSettled === true) {
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const { writeFile } = await import('node:fs/promises')
    await writeFile(screenshotPath, Buffer.from(shot.data, 'base64'))
    check('面板截图已保存', true, screenshotPath)
  }
}

// Selection capture: select real page text, fire mouseup, click the floating button.
const selected = await evaluate(`(() => {
  const pick = () => {
    const preferred = document.querySelector('.ck-finding .ck-find-title, .ck-card, .ck-empty');
    if (preferred) {
      const walker = document.createTreeWalker(preferred, NodeFilter.SHOW_TEXT);
      let node = null;
      while ((node = walker.nextNode()) !== null) if ((node.textContent || '').trim().length >= 10) return node;
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = null;
    while ((node = walker.nextNode()) !== null) {
      const text = (node.textContent || '').trim();
      const parent = node.parentElement;
      if (text.length >= 16 && parent && !parent.closest('input,textarea,[contenteditable="true"],script,style')) return node;
    }
    return null;
  };
  const target = pick();
  if (target === null) return false;
  const range = document.createRange();
  range.setStart(target, 0);
  range.setEnd(target, Math.min(24, target.textContent.length));
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 240, clientY: 240 }));
  return true;
})()`)
check('可选中页面文字', selected === true)

const floatReady = await waitFor("document.querySelector('.ck-float') !== null", 8000).catch(() => false)
check('选中后出现「存入知识库」浮动按钮', floatReady === true)

if (floatReady) {
  const floatLabel = await evaluate("document.querySelector('.ck-float').innerText.trim()")
  check('浮动按钮文案', floatLabel.includes('存入知识库'), floatLabel)
  await evaluate("document.querySelector('.ck-float').click()")
  const toastText = await waitFor(`(() => {
    const toast = document.querySelector('.ck-toast');
    return toast && toast.innerText.includes('已存入') ? toast.innerText : '';
  })()`, 15000).catch(() => '')
  check('点击浮动按钮后收到服务端结果', toastText.length > 0, String(toastText).replace(/\s+/g, ' ').slice(0, 160))
}

// Context menu with a live selection offers the capture entry.
const contextMenuOk = await evaluate(`(() => {
  const selection = window.getSelection();
  let target = null;
  const preferred = document.querySelector('.ck-finding .ck-find-title, .ck-card, .ck-empty');
  if (preferred) {
    const walker = document.createTreeWalker(preferred, NodeFilter.SHOW_TEXT);
    let node = null;
    while ((node = walker.nextNode()) !== null) if ((node.textContent || '').trim().length >= 10) { target = node; break; }
  }
  if (target === null) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = null;
    while ((node = walker.nextNode()) !== null) {
      const text = (node.textContent || '').trim();
      const parent = node.parentElement;
      if (text.length >= 12 && parent && !parent.closest('input,textarea,[contenteditable="true"],script,style')) { target = node; break; }
    }
  }
  if (target === null) return false;
  const range = document.createRange();
  range.setStart(target, 0);
  range.setEnd(target, Math.min(18, target.textContent.length));
  selection.removeAllRanges();
  selection.addRange(range);
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300 });
  document.body.dispatchEvent(event);
  const menu = document.querySelector('.ck-menu');
  return menu !== null && menu.innerText.includes('存入职业生涯知识库');
})()`)
check('右键菜单含「存入职业生涯知识库」', contextMenuOk === true)

if (typeof capturePath === 'string' && capturePath.length > 0) {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const { writeFile } = await import('node:fs/promises')
  await writeFile(capturePath, Buffer.from(shot.data, 'base64'))
  check('存入交互截图已保存', true, capturePath)
}

const failed = results.filter((row) => row.ok !== true)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
ws.close()
process.exit(failed.length === 0 ? 0 : 1)
