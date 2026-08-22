/**
 * systems/teleport.js — 传送阵系统
 *
 * 地图传送阵（TILE.CHECKPOINT）与城镇传送阵（营地）：
 *  - 路过传送阵 → 激活（注册 + 回满 HP + 存档）
 *  - 站在传送阵上 → 询问是否传送
 *  - 每个传送阵都有名字（TELEPORTS 注册表）
 */

window.TeleportSystem = (function () {
  function all () { return TELEPORTS || [] }
  function byId (id) { return all().find(t => t.id === id) }
  function byPos (x, y) { return all().find(t => t.x === x && t.y === y) }

  function isActivated (id) {
    const state = State.get()
    return !!(state._teleports && state._teleports.includes(id))
  }

  /** 路过激活：注册传送阵（营地始终激活） */
  function activate (id) {
    const state = State.get()
    const arr = state._teleports || []
    if (id && !arr.includes(id)) {
      state._teleports = [...arr, id]
      EventBus.emit('state:changed', state)
    }
  }

  /** 玩家当前所在的传送阵 id（不在传送阵上返回 null） */
  function currentId () {
    const state = State.get()
    const found = byPos(state.position.x, state.position.y)
    return found ? found.id : null
  }

  /** 站在传送阵上：询问是否传送 */
  function ask (fromId) {
    const state = State.get()
    const current = fromId || currentId()
    const here = byId(current)
    const options = all().filter(t => t.id !== current && isActivated(t.id))
    const currentName = here ? here.name : '未知地点'
    const currentHtml = here
      ? `<div class="teleport-current"><i>🌀</i><div><small>当前位置</small><b>${here.name}</b></div></div>`
      : `<div class="teleport-current"><i>🌀</i><div><small>当前位置</small><b>${currentName}</b></div></div>`

    const listHtml = options.length
      ? `<div class="teleport-list">${options.map(t => `
          <button class="teleport-opt" data-tp="${t.id}"><i>✨</i><span><b>${t.name}</b><small>${t.isCamp ? '城镇 · 雾灯镇营地' : '森林深处'}</small></span><em>传送</em></button>
        `).join('')}</div>`
      : '<p class="camp-muted">还没有激活其他传送阵——去森林里找到它们，路过即可点亮。</p>'

    Dialog.show({
      title: '🌀 传送阵',
      className: 'teleport-modal',
      body: `<div class="teleport-hero"><i>🌀</i><div><small>TELEPORT ARRAY · 空间魔法回路</small><h3>${currentName} 的光芒笼罩着你。</h3><p>回路已点亮 ${all().filter(t => isActivated(t.id)).length}/${all().length} 处。选择一处传送，HP 回满，不消耗回合。</p></div></div>
        ${currentHtml}
        ${listHtml}`,
      actions: [{ label: '💤 留在原地', handler: () => { Dialog.close(); afterDone() } }],
    })

    document.querySelectorAll('[data-tp]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.tp
        Dialog.close()
        teleport(id)
      }
    })
  }

  /** 传送至目标传送阵（不消耗回合） */
  function teleport (id) {
    const state = State.get()
    const dest = byId(id)
    if (!dest) { afterDone(); return }
    state.hp = state.maxHp
    if (dest.isCamp) {
      // 传送到城镇：记录来源格，进入营地
      state._campReturnPos = { x: state.position.x, y: state.position.y }
      EventBus.emit('ui:log', { text: `🌀 传送至「${dest.name}」，HP 回满。`, type: 'good' })
      EventBus.emit('state:changed', state)
      State.save()
      CampSystem.open()
      return
    }
    state.position = { x: dest.x, y: dest.y }
    state.visited.push({ x: dest.x, y: dest.y })
    EventBus.emit('ui:log', { text: `🌀 传送至「${dest.name}」，HP 回满。`, type: 'good' })
    EventBus.emit('state:changed', state)
    EventBus.emit('ui:mapUpdate', {})
    State.save()
    afterDone()
  }

  /** 传送结束：回到移动流程 */
  function afterDone () {
    if (typeof GameFlow !== 'undefined' && GameFlow.afterEvent) GameFlow.afterEvent()
  }

  return { all, byId, byPos, isActivated, activate, currentId, ask, teleport }
})()