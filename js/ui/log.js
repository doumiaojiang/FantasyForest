/**
 * ui/log.js — 冒险日志组件
 *
 * 监听 ui:log 事件，新消息插入顶部。
 * 最新消息始终显示在最上方。
 * 日志同步写入 state.logs，读档后恢复。
 */

window.Log = (function () {
  const box = document.getElementById('log-box')
  const count = document.getElementById('log-count')
  const MAX_LOGS = 120   // 只保留关键事件，控制存档体积

  // 旧版本会逐格记录移动过程。读档时过滤这些无决策价值的流水消息。
  function isMovementNoise (text = '') {
    return /^→ \(\d+,\d+\) 剩余步数:/.test(text) ||
      /^(?:⬛|🟫|🏘️|👑|👹|🪤|🌫️|❓|🎁|🏪|🔥)\s*\(\d+,\d+\)$/u.test(text) ||
      /^↪️ 直角转弯/.test(text) ||
      /^↩️ 前方是死路/.test(text) ||
      /^🛑 停在了 \(\d+,\d+\)，触发事件/.test(text)
  }

  function updateCount () {
    if (count) count.textContent = box.children.length
    box.classList.toggle('log-empty', box.children.length === 0)
  }

  function createLine (text, type = '') {
    const line = document.createElement('div')
    line.className = 'log-line'
    if (['good', 'danger', 'dim', 'warning'].includes(type)) line.classList.add(type)
    const content = document.createElement('span')
    content.textContent = String(text == null ? '' : text)
    line.appendChild(content)
    return line
  }

  function init () {
    EventBus.on('ui:log', ({ text, type = '' }) => {
      add(text, type)
    })
  }

  function add (text, type = '') {
    if (isMovementNoise(text)) return
    const line = createLine(text, type)
    box.prepend(line)
    while (box.children.length > MAX_LOGS) box.lastElementChild.remove()
    box.scrollTop = 0
    updateCount()

    // 写入存档（State 存在时）
    const state = State.get()
    if (state && Array.isArray(state.logs)) {
      state.logs.unshift({ text, type })
      if (state.logs.length > MAX_LOGS) state.logs.length = MAX_LOGS
    }
  }

  /** 从存档恢复日志（读档时调用） */
  function loadFromState (logs) {
    box.innerHTML = ''
    if (!Array.isArray(logs)) { updateCount(); return }
    const cleaned = logs.filter(entry => entry && !isMovementNoise(entry.text)).slice(0, MAX_LOGS)
    cleaned.forEach(({ text, type }) => box.appendChild(createLine(text, type || '')))
    const state = State.get()
    if (state) state.logs = cleaned
    box.scrollTop = 0
    updateCount()
  }

  function clear () {
    box.innerHTML = ''
    const state = State.get()
    if (state) state.logs = []
    updateCount()
  }

  return { init, add, clear, loadFromState }
})()
