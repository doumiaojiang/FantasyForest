/**
 * systems/status.js — 状态效果系统
 *
 * 职责：
 *  - 施加/移除状态效果
 *  - 每回合 tick（战斗内、战斗外）
 *  - 查询状态存在性
 *
 * 状态效果定义见 data/status.js
 * 事件：status:apply / status:tick / status:remove
 */

window.StatusSystem = (function () {
  /**
   * 施加状态效果
   * @param {string} id    效果 id
   * @param {number} turns 持续回合数
   * @param {object} [opts] 额外参数（如 level）
   */
  function apply (id, turns, opts = {}) {
    const state = State.get()
    const def = STATUS_EFFECTS[id]
    if (!def) return

    // 缩小/增大允许多次叠加
    if (id === 'size_up' || id === 'size_down') {
      const effect = { id, turnsLeft: turns, stacks: 1, ...opts }
      state.statuses.push(effect)
      if (def.onApply) def.onApply(state, effect)
      EventBus.emit('status:apply', { effect })
      EventBus.emit('state:changed', state)
      return
    }

    // 已有同类效果：刷新持续时间（来源以最新一次施加为准）
    const existing = state.statuses.find(s => s.id === id)
    if (existing) {
      existing.turnsLeft = Math.max(existing.turnsLeft, turns)
      if (opts.level) existing.level = opts.level
      if (opts.source) existing.source = opts.source
      EventBus.emit('state:changed', state)
      return
    }

    const effect = { id, turnsLeft: turns, ...opts }
    state.statuses.push(effect)
    if (def.onApply) def.onApply(state, effect)
    EventBus.emit('status:apply', { effect })
    EventBus.emit('state:changed', state)
  }

  /** 移除指定状态效果 */
  function remove (id) {
    const state = State.get()
    const idx = state.statuses.findIndex(s => s.id === id)
    if (idx === -1) return
    const effect = state.statuses[idx]
    const def = STATUS_EFFECTS[id]
    if (def && def.onRemove) def.onRemove(state, effect)
    state.statuses.splice(idx, 1)
    EventBus.emit('status:remove', { effect })
    EventBus.emit('state:changed', state)
  }

  /** 战斗内回合 tick：每回合开始时调用 */
  function tickInBattle () {
    const state = State.get()
    state.statuses.slice().forEach(s => {
      const def = STATUS_EFFECTS[s.id]
      if (def && def.onTick) def.onTick(state, s)
    })
    // 移除过期效果
    state.statuses = state.statuses.filter(s => s.turnsLeft > 0)
    EventBus.emit('status:tick', { effects: state.statuses })
    EventBus.emit('state:changed', state)
  }

  /** 战斗外移动后 tick：用于受伤效果 */
  function tickOutOfBattle () {
    const state = State.get()
    state.statuses.slice().forEach(s => {
      if (s.id === 'injured') {
        const def = STATUS_EFFECTS[s.id]
        if (def && def.onTick) def.onTick(state, s)
      }
    })
    state.statuses = state.statuses.filter(s => s.turnsLeft > 0)
    EventBus.emit('status:tick', { effects: state.statuses })
  }

  function has (id) { return StatusLib.has(State.get(), id) }
  function getActive (id) { return StatusLib.getActive(State.get(), id) }
  function getAll () { return State.get().statuses.slice() }

  return { apply, remove, tickInBattle, tickOutOfBattle, has, getActive, getAll }
})()