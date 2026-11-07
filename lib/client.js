window.__ModuleLoader__.load({
  id: "dsh-career-kb",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const API = "/api/career-kb";
    const NS = "dsh-career-kb";
    const PANEL_ID = "career-kb";
    const PLUGIN_TAG = "dsh-career-kb";

    /* ------------------------------------------------------------------ */
    /* CSS                                                                */
    /* ------------------------------------------------------------------ */

    const CSS = `
.ck-page{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;overflow:hidden}
.ck-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.ck-title{font-weight:650;font-size:14px;display:flex;align-items:center;gap:7px}
.ck-sub{color:var(--dsw-alias-label-tertiary);font-size:11px;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ck-body{flex:1;min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.ck-chips{display:flex;gap:8px;flex-wrap:wrap}
.ck-chip{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:11px}
.ck-chip b{font-weight:650;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.ck-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:7px;font:inherit;font-size:12px;padding:5px 10px;cursor:pointer;line-height:18px}
.ck-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ck-btn.ck-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}
.ck-btn:disabled{opacity:.45;cursor:default}
.ck-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:10px 12px}
.ck-card h3{margin:0 0 6px;font-size:12px;font-weight:650;color:var(--dsw-alias-label-secondary)}
.ck-list{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
.ck-item{font-size:12px;color:var(--dsw-alias-label-secondary);display:flex;gap:8px;align-items:flex-start;line-height:1.5}
.ck-item .ck-path{color:var(--dsw-alias-label-tertiary);font-size:11px}
.ck-finding{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:8px 10px;display:flex;gap:9px;align-items:flex-start;background:var(--dsw-alias-bg-layer-2)}
.ck-finding.ck-high{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d33) 40%,transparent)}
.ck-finding.ck-medium{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#c90) 40%,transparent)}
.ck-sev{flex:none;font-size:10px;padding:1px 6px;border-radius:999px;margin-top:1px;color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-label-tertiary)}
.ck-sev.high{background:#c0392b}.ck-sev.medium{background:#b9770e}.ck-sev.low{background:#566573}
.ck-find-main{flex:1;min-width:0}
.ck-find-title{font-size:12px;font-weight:600;line-height:1.45;word-break:break-word}
.ck-find-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-top:2px;word-break:break-all}
.ck-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ck-grow{flex:1}
.ck-log{white-space:pre-wrap;font-size:11px;color:var(--dsw-alias-label-tertiary);max-height:150px;overflow:auto;margin:0}
.ck-empty{font-size:12px;color:var(--dsw-alias-label-tertiary);padding:6px 0}
.ck-toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:9999;background:var(--dsw-alias-bg-layer-3,#222);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:8px 14px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:min(520px,80vw);white-space:pre-wrap}
.ck-toast.ck-error{border-color:#c0392b;color:#e74c3c}
.ck-float{position:fixed;z-index:9998;display:inline-flex;align-items:center;gap:6px;border:0;border-radius:8px;padding:6px 10px;background:var(--dsw-alias-button-primary-fill,#2563eb);color:var(--dsw-alias-label-primary-foreground,#fff);font:inherit;font-size:12px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.ck-menu{position:fixed;z-index:9998;background:var(--dsw-alias-bg-layer-3,#1e1e1e);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:5px;min-width:200px;box-shadow:0 10px 28px rgba(0,0,0,.35)}
.ck-menu button{display:flex;align-items:center;gap:7px;width:100%;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;padding:6px 8px;border-radius:6px;cursor:pointer}
.ck-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ck-menu-hint{font-size:10px;color:var(--dsw-alias-label-tertiary);padding:4px 8px 2px}
.ck-assist{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.ck-assist:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
` + `
.ck-save-ok{color:#27ae60}
`

    function injectStyle() {
      if (document.querySelector(`style[data-plugin="${PLUGIN_TAG}"]`) !== null) return
      const tag = document.createElement("style")
      tag.dataset.plugin = PLUGIN_TAG
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ------------------------------------------------------------------ */
    /* Utilities                                                           */
    /* ------------------------------------------------------------------ */

    async function api(path, options = {}) {
      const response = await fetch(API + path, {
        method: options.method ?? "GET",
        headers: { "content-type": "application/json" },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
      const text = await response.text()
      let data
      try { data = JSON.parse(text) } catch { data = { ok: false, error: text.slice(0, 300) } }
      if (!response.ok || data.ok === false) throw new Error(data.error ?? `请求失败（${response.status}）`)
      return data
    }

    function toast(message, kind) {
      try {
        const previous = document.querySelector(".ck-toast")
        if (previous !== null) previous.remove()
        const node = document.createElement("div")
        node.className = "ck-toast" + (kind === "error" ? " ck-error" : "")
        node.textContent = message
        document.body.appendChild(node)
        window.setTimeout(() => node.remove(), kind === "error" ? 6500 : 3800)
      } catch { /* ignore */ }
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max)
    }

    function isElement(node) {
      return typeof Element !== "undefined" && node instanceof Element
    }

    function selectionText() {
      const selection = window.getSelection()
      if (selection === null || selection.rangeCount === 0) return ""
      return String(selection.toString() || "").trim()
    }

    function icon(name, size = 15) {
      const paths = {
        bag: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
        save: '<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.6L6 21Z"/>',
        scan: '<path d="M4 7V5a1 1 0 0 1 1-1h2"/><path d="M17 4h2a1 1 0 0 1 1 1v2"/><path d="M20 17v2a1 1 0 0 1-1 1h-2"/><path d="M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M4 12h16"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
        folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
      }
      const body = paths[name] ?? paths.bag
      return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, h("g", { dangerouslySetInnerHTML: { __html: body } }))
    }

    /* ------------------------------------------------------------------ */
    /* Selection surfaces                                                  */
    /* ------------------------------------------------------------------ */

    function installSelectionUI() {
      let float = null
      let menu = null
      let lastText = ""

      const removeFloat = () => { if (float !== null) { float.remove(); float = null } }
      const removeMenu = () => { if (menu !== null) { menu.remove(); menu = null } }

      const saveSelected = async (text, source) => {
        if (text.trim().length === 0) return
        try {
          const result = await api("/save", { method: "POST", body: { text, source, mode: "auto" } })
          const label = result.steered
            ? `已存入收件箱：${result.saved.path}\nAI 正在按「存入」技能整理${result.saved.path.includes("收件箱") ? "，整理后同步飞书（若已配置）" : ""}。`
            : `已存入收件箱：${result.saved.path}\n想整理时发 /career-save。`
          toast(label)
        } catch (error) {
          toast("存入失败：" + String(error?.message ?? error), "error")
        }
      }

      const showFloat = (rect, text) => {
        removeFloat()
        const button = document.createElement("button")
        button.type = "button"
        button.className = "ck-float"
        button.title = "存入职业生涯知识库"
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.6L6 21Z"/></svg><span>存入知识库</span>'
        button.addEventListener("mousedown", (event) => event.preventDefault())
        button.addEventListener("click", () => { saveSelected(text, "selection"); removeFloat() })
        document.body.appendChild(button)
        const width = button.offsetWidth
        const left = clamp(rect.left + rect.width / 2 - width / 2, 8, window.innerWidth - width - 8)
        const top = rect.bottom + 8 + 30 > window.innerHeight ? Math.max(8, rect.top - 38) : rect.bottom + 8
        button.style.left = left + "px"
        button.style.top = top + "px"
        float = button
      }

      const showMenu = (x, y, items, hint) => {
        removeMenu()
        const panel = document.createElement("div")
        panel.className = "ck-menu"
        for (const item of items) {
          const button = document.createElement("button")
          button.type = "button"
          button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.6L6 21Z"/></svg><span></span>'
          button.querySelector("span").textContent = item.label
          button.addEventListener("click", () => { item.run(); removeMenu() })
          panel.appendChild(button)
        }
        if (hint) {
          const hintNode = document.createElement("div")
          hintNode.className = "ck-menu-hint"
          hintNode.textContent = hint
          panel.appendChild(hintNode)
        }
        document.body.appendChild(panel)
        const width = panel.offsetWidth
        const height = panel.offsetHeight
        panel.style.left = clamp(x, 8, window.innerWidth - width - 8) + "px"
        panel.style.top = clamp(y, 8, window.innerHeight - height - 8) + "px"
        menu = panel
      }

      const onMouseUp = (event) => {
        if (isElement(event.target) && event.target.closest(".ck-float,.ck-menu")) return
        window.setTimeout(() => {
          if (isElement(event.target) && event.target.closest('input,textarea,[contenteditable="true"]')) return
          const text = selectionText()
          if (text.length === 0) { removeFloat(); return }
          const selection = window.getSelection()
          if (selection === null || selection.rangeCount === 0) return
          const rect = selection.getRangeAt(0).getBoundingClientRect()
          if (rect.width === 0 && rect.height === 0) return
          lastText = text
          showFloat(rect, text)
        }, 0)
      }

      const onContextMenu = (event) => {
        const text = selectionText()
        const target = isElement(event.target) ? event.target : null
        const userRow = target?.closest('[class*="userRow"]')
        const selection = window.getSelection()
        const selectionInRow = userRow !== null && userRow !== undefined && selection !== null && selection.anchorNode !== null && userRow.contains(selection.anchorNode)
        if (text.length > 0 && (userRow === null || userRow === undefined || selectionInRow)) {
          event.preventDefault()
          showMenu(event.clientX, event.clientY, [{ label: "存入职业生涯知识库", run: () => saveSelected(text, "context-menu-selection") }], "存入收件箱后交给 AI 整理")
          return
        }
        if (userRow) {
          const stack = userRow.querySelector('[class*="userStack"]') || userRow
          const message = String(stack.innerText || "").trim()
          if (message.length > 0) {
            event.preventDefault()
            showMenu(event.clientX, event.clientY, [{ label: "存入我发的这条消息", run: () => saveSelected(message, "context-menu-user") }], "存入职业生涯知识库")
          }
        }
      }

      const onDown = (event) => {
        if (isElement(event.target) && event.target.closest(".ck-float,.ck-menu")) return
        removeFloat(); removeMenu()
      }
      const onScroll = () => { removeFloat(); removeMenu() }
      const onKeyUp = () => { if (selectionText().length === 0) removeFloat() }

      document.addEventListener("mouseup", onMouseUp)
      document.addEventListener("contextmenu", onContextMenu)
      document.addEventListener("mousedown", onDown, true)
      document.addEventListener("scroll", onScroll, true)
      document.addEventListener("keyup", onKeyUp)

      return () => {
        removeFloat(); removeMenu()
        document.removeEventListener("mouseup", onMouseUp)
        document.removeEventListener("contextmenu", onContextMenu)
        document.removeEventListener("mousedown", onDown, true)
        document.removeEventListener("scroll", onScroll, true)
        document.removeEventListener("keyup", onKeyUp)
      }
    }

    /* ------------------------------------------------------------------ */
    /* Assistant action                                                    */
    /* ------------------------------------------------------------------ */

    function SaveAssistantButton(props) {
      const [busy, setBusy] = useState(false)
      const messageId = props?.messageId ?? props?.id ?? ""
      const onClick = useCallback(async (event) => {
        if (busy) return
        setBusy(true)
        try {
          const target = event?.currentTarget ?? null
          const holder = (() => {
            const withId = target?.closest?.('[data-message-id]')
            if (withId !== null && withId !== undefined && withId !== target) return withId
            const assistant = target?.parentElement?.closest?.('[class*="assistant"]')
            if (assistant !== null && assistant !== undefined) return assistant
            return null
          })()
          const text = holder ? String(holder.innerText || "").trim() : ""
          if (text.length === 0) {
            toast("没有找到这条回答的正文，请选中后使用浮动按钮", "error")
            return
          }
          const result = await api("/save", { method: "POST", body: { text, source: "assistant", mode: "auto" } })
          toast(result.steered ? `已存入收件箱：${result.saved.path}\nAI 正在整理并同步飞书（若已配置）。` : `已存入收件箱：${result.saved.path}`)
        } catch (error) {
          toast("存入失败：" + String(error?.message ?? error), "error")
        } finally {
          setBusy(false)
        }
      }, [busy, messageId])

      return h("button", {
        type: "button",
        className: "ck-assist",
        title: "存入职业生涯知识库",
        "aria-label": "存入职业生涯知识库",
        "data-message-id": messageId,
        onClick,
        disabled: busy,
      }, icon("save", 15))
    }

    /* ------------------------------------------------------------------ */
    /* Panel                                                               */
    /* ------------------------------------------------------------------ */

    function severityLabel(severity) {
      return severity === "high" ? "高" : severity === "medium" ? "中" : "低"
    }

    function actionSummary(finding) {
      const action = finding?.suggestedAction
      if (action === undefined || action === null) return "需在对话中处理"
      if (action.kind === "merge") return `合并到 ${String(action.into ?? "").split("/").pop()}`
      if (action.kind === "move") return `移动到 ${String((action.to ?? [])[0] ?? "").split("/").slice(0, 2).join("/")}`
      if (action.kind === "archive") return "归档（保留历史）"
      if (action.kind === "update") return "更新/补全（需对话确认内容）"
      return "需在对话中处理"
    }

    function buildAction(finding) {
      const action = finding?.suggestedAction
      if (action === undefined || action === null) return null
      if (action.kind === "merge") return { kind: "merge", from: action.from, to: [action.into] }
      if (action.kind === "move") return { kind: "move", from: [finding.paths[0]], to: action.to }
      if (action.kind === "archive") return { kind: "archive", from: finding.paths }
      return null
    }

    function Panel() {
      const [state, setState] = useState(null)
      const [busy, setBusy] = useState("")
      const [report, setReport] = useState(null)
      const [selected, setSelected] = useState({})
      const [verify, setVerify] = useState(null)
      const load = useCallback(async () => {
        try {
          const data = await api("/state")
          setState(data)
          if (data.lastAudit !== null && data.lastAudit !== undefined) setReport((previous) => previous ?? data.lastAudit)
        } catch (error) {
          toast("读取知识库状态失败：" + String(error?.message ?? error), "error")
        }
      }, [])

      useEffect(() => { load() }, [load])

      const runAudit = useCallback(async () => {
        setBusy("audit")
        try {
          const data = await api("/audit", { method: "POST", body: {} })
          setReport(data)
          setSelected({})
          toast(`巡检完成：${data.findings.length} 个问题（高 ${data.counts?.["exact-duplicate"] ?? 0} 组完全重复）`)
          await load()
        } catch (error) {
          toast("巡检失败：" + String(error?.message ?? error), "error")
        } finally { setBusy("") }
      }, [load])

      const runVerify = useCallback(async () => {
        setBusy("verify")
        try {
          const data = await api("/verify")
          setVerify(data)
          toast(data.ok ? "自检通过" : "自检查出问题，见面板", data.ok ? "" : "error")
        } catch (error) {
          toast("自检失败：" + String(error?.message ?? error), "error")
        } finally { setBusy("") }
      }, [])

      const runReindex = useCallback(async () => {
        setBusy("reindex")
        try {
          const data = await api("/reindex", { method: "POST", body: {} })
          toast(`索引已重建（${data.count} 条记录）`)
          await load()
        } catch (error) {
          toast("重建失败：" + String(error?.message ?? error), "error")
        } finally { setBusy("") }
      }, [load])

      const applySelected = useCallback(async () => {
        const findings = (report?.findings ?? []).filter((finding) => selected[finding.id] === true)
        const actions = findings.map(buildAction).filter(Boolean)
        if (actions.length === 0) { toast("没有可执行的已选项目（更新类需在对话中处理）", "error"); return }
        const ok = window.confirm(`将执行 ${actions.length} 个整理动作（先自动备份到 _meta/backups）：\n\n` + actions.map((action) => `${action.kind} ${String((action.from ?? [])[0] ?? "")}`).join("\n"))
        if (!ok) return
        setBusy("apply")
        try {
          const data = await api("/apply", { method: "POST", body: { actions, confirm: true } })
          const failed = data.results.filter((row) => row.ok !== true)
          toast(failed.length === 0 ? `已执行 ${data.results.length} 个动作，备份：${data.backupDir}` : `${failed.length} 个动作失败，见控制台`, failed.length === 0 ? "" : "error")
          if (failed.length > 0) console.warn("[career-kb] apply failures", failed)
          setSelected({})
          await runAudit()
        } catch (error) {
          toast("执行失败：" + String(error?.message ?? error), "error")
        } finally { setBusy("") }
      }, [report, selected, runAudit])

      const findings = report?.findings ?? []
      const actionable = findings.filter((finding) => buildAction(finding) !== null)
      const selectedCount = Object.values(selected).filter(Boolean).length

      return h("div", { className: "ck-page" },
        h("div", { className: "ck-toolbar" },
          h("div", { className: "ck-title" }, icon("bag", 16), "职业生涯"),
          h("div", { className: "ck-sub", title: state?.dataDir ?? "" }, state?.dataDir ?? "加载中…"),
          h("div", { className: "ck-grow" }),
          h("button", { className: "ck-btn", type: "button", onClick: load, disabled: busy !== "" }, "刷新"),
          h("button", { className: "ck-btn", type: "button", onClick: runReindex, disabled: busy !== "" }, "重建索引"),
          h("button", { className: "ck-btn", type: "button", onClick: runVerify, disabled: busy !== "" }, "自检"),
          h("button", { className: "ck-btn ck-primary", type: "button", onClick: runAudit, disabled: busy !== "" }, busy === "audit" ? "扫描中…" : "巡检全库"),
        ),
        h("div", { className: "ck-body" },
          h("div", { className: "ck-chips" },
            h("div", { className: "ck-chip" }, "记录 ", h("b", null, String(state?.stats?.cards ?? 0))),
            h("div", { className: "ck-chip" }, "收件箱 ", h("b", null, String(state?.stats?.inbox ?? 0))),
            h("div", { className: "ck-chip" }, "巡检问题 ", h("b", null, String(findings.length))),
            h("div", { className: "ck-chip" }, state?.feishu?.available ? h("span", { className: "ck-save-ok" }, "飞书已连接") : "飞书未连接"),
          ),
          h("div", { className: "ck-card" },
            h("h3", null, "收件箱待整理"),
            (state?.inbox ?? []).length === 0
              ? h("div", { className: "ck-empty" }, "暂无待整理资料。选中对话里的文字点「存入知识库」即可。")
              : h("ul", { className: "ck-list" }, (state?.inbox ?? []).slice(0, 8).map((item) => h("li", { className: "ck-item", key: item.path }, icon("folder", 13), h("div", null, h("div", null, item.title), h("div", { className: "ck-path" }, item.path))))),
          ),
          h("div", { className: "ck-card" },
            h("div", { className: "ck-row" },
              h("h3", { className: "ck-grow" }, "巡检结果", findings.length > 0 ? `（${findings.length}）` : ""),
              h("button", { className: "ck-btn", type: "button", disabled: selectedCount === 0 || busy !== "", onClick: applySelected }, `执行已选${selectedCount > 0 ? `（${selectedCount}）` : ""}`),
            ),
            findings.length === 0
              ? h("div", { className: "ck-empty" }, "还没有巡检结果。点「巡检全库」生成只读清单；删除/移动/合并都需逐项确认。")
              : h("div", { className: "ck-list" },
                findings.slice(0, 40).map((finding) => {
                  const canApply = buildAction(finding) !== null
                  return h("label", { className: "ck-finding ck-" + finding.severity, key: finding.id },
                    h("input", {
                      type: "checkbox",
                      checked: selected[finding.id] === true,
                      disabled: !canApply,
                      onChange: (event) => setSelected((previous) => ({ ...previous, [finding.id]: event.target.checked })),
                    }),
                    h("span", { className: "ck-sev " + finding.severity }, severityLabel(finding.severity)),
                    h("div", { className: "ck-find-main" },
                      h("div", { className: "ck-find-title" }, finding.title),
                      h("div", { className: "ck-find-meta" }, (finding.paths ?? []).join(" · ")),
                      h("div", { className: "ck-find-meta" }, "建议：" + actionSummary(finding) + (canApply ? "" : "（更新类请在对话里确认内容）")),
                    ),
                  )
                }),
                findings.length > 40 ? h("div", { className: "ck-empty" }, `还有 ${findings.length - 40} 项，听对话里的完整清单。`) : null,
              ),
          ),
          verify !== null ? h("div", { className: "ck-card" },
            h("h3", null, `自检：${verify.ok ? "通过" : "有问题"}`),
            h("ul", { className: "ck-list" }, (verify.checks ?? []).map((check) => h("li", { className: "ck-item", key: check.name }, icon(check.ok ? "check" : "refresh", 13), h("div", null, `${check.name}`, h("div", { className: "ck-path" }, check.detail))))),
          ) : null,
          h("div", { className: "ck-card" },
            h("h3", null, "最近日志"),
            h("pre", { className: "ck-log" }, state?.logTail ?? "（空）"),
          ),
        ),
      )
    }

    function SidebarIcon(props) {
      return icon("bag", props?.size ?? 16)
    }

    /* ------------------------------------------------------------------ */
    /* Plugin                                                              */
    /* ------------------------------------------------------------------ */

    function apply(ctx) {
      injectStyle()

      ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
        name: "sidebar.panellist",
        id: PANEL_ID,
        order: 31,
        label: "职业生涯",
      }, (props) => SidebarIcon(props)))

      ctx.slots.inject("main", () => ctx.slots.register({
        name: "main",
        key: PANEL_ID,
      }, Panel))

      ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
        name: "conversation.chat.assistant-actions",
        id: "career-kb-save",
        order: 31,
      }, SaveAssistantButton))

      ctx.effect(() => installSelectionUI(), "career-kb: selection surfaces")
    }

    exports.name = "dsh-career-kb"
    exports.inject = ["slots"]
    exports.apply = apply
    return module.exports
  },
})
