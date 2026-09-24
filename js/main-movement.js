/** main-movement.js — 移动输入、方向键、自动行走与移动阶段恢复。 */
window.MovementController = (function () {
  const gameScreen = document.getElementById('screen-game')
  const hint = document.getElementById('action-hint')
  const btns = document.getElementById('action-buttons')
  let _stepsRemaining = 0
  let _isWalking = false
  let _prevPos = { x: -1, y: -1 }
  let _moveLocked = false
  let _turning = false
  let _readyToRollTimer = null
  function showActionBar () {
    const bar = document.getElementById('action-bar')
    if (bar) bar.classList.remove('hidden')
    const float = document.getElementById('dpad-float')
    if (float) float.classList.add('hidden')
  }

  function readyToRoll (keepSteps) {
    if (State.get().phase === 'gameover') return
    State.update(s => s.phase = 'idle')
    if (!keepSteps) {
      _stepsRemaining = 0
      _turning = false
    }
    _isWalking = false

    // 同步移动状态到存档（岔路暂停时保留剩余步数）
    State.update(s => {
      if (_turning && _stepsRemaining > 0) s._moveState = { steps: _stepsRemaining, turning: true }
      else s._moveState = null
    }, true)

    hint.textContent = _stepsRemaining > 0
      ? `🧭 选择方向继续移动（剩余 ${_stepsRemaining} 步）`
      : '🧭 选择方向（点击后掷 Y 移动）'

    // 统一浮动方向键（比操作栏更可靠，避免响应式断点问题）
    btns.innerHTML = ''
    const actionBar = document.getElementById('action-bar')
    if (actionBar) actionBar.classList.add('hidden')
    const float = document.getElementById('dpad-float')
    // 先确保显示（即使 buildDpad 出错也不影响）
    if (float) {
      float.style.left = ''
      float.style.top = ''
      float.style.right = ''
      float.style.bottom = ''
      float.classList.remove('hidden')
    }
    try {
      if (float) {
        float.innerHTML = buildDpad()
        bindDpad()
        makeDraggable(float)
        const itemBtn = document.getElementById('btn-move-item')
        if (itemBtn) itemBtn.onclick = showMoveItemMenu
      }
    } catch (e) {
      console.error('方向键渲染失败:', e)
    }
    // 延迟重试：确保浮动键在 DOM 就绪后显示（新建游戏时可能因布局未稳定而隐藏）
    clearTimeout(_readyToRollTimer)
    _readyToRollTimer = setTimeout(() => {
      const float2 = document.getElementById('dpad-float')
      if (float2 && float2.classList.contains('hidden')) {
        float2.classList.remove('hidden')
      }
    }, 200)
  }

  /** 移动阶段使用物品（非战斗，可随意使用治疗/解毒类） */
  function showMoveItemMenu () {
    const state = State.get()
    if (!state) return
    // 只显示可在移动阶段使用的物品（治疗/解毒/再生），满血时排除治疗类
    const items = Object.entries(state.inventory.consumables)
      .filter(([id, v]) => {
        if (v <= 0) return false
        const item = ItemLib.get(id)
        if (!item) return false
        const e = item.effect
        // 非战斗道具：治疗 / 治愈状态 / 再生 / 灵魂石充能
        if (!(e.heal || e.cure || e.regen || e.special === 'soul_charge')) return false
        // 满血时不用治疗类
        if (e.heal && state.hp >= state.maxHp) return false
        return true
      })
    if (!items.length) {
      EventBus.emit('ui:log', { text: '没有可在移动时使用的物品。', type: 'dim' })
      return
    }

    let html = items.map(([id, count]) => {
      const item = ItemLib.get(id)
      return `<button class="btn move-item-use" data-item="${id}" style="display:block;width:100%;text-align:left;margin:6px 0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>${item.name}</b>
          <span style="color:var(--gold)">×${count}</span>
        </div>
        <div style="font-size:.78rem;color:var(--text-dim);margin-top:3px">${item.desc}</div>
      </button>`
    }).join('')

    Dialog.show({
      title: '🎒 使用物品（移动时）',
      body: html,
      actions: [{ label: '关闭', handler: () => Dialog.close() }],
    })

    Dialog.onMount(root => {
      root.querySelectorAll('.move-item-use').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.item
          if (ShopSystem.isSoulGem(id)) {
            ShopSystem.openSoulGemCharge(id, () => showMoveItemMenu(), () => showMoveItemMenu())
            return
          }
          const result = ShopSystem.useConsumable(id)
          Dialog.close()
          if (!result.ok) {
            EventBus.emit('ui:log', { text: result.msg, type: 'danger' })
          } else {
            // 使用日志由 ShopSystem.useConsumable 统一输出
            // 可继续用，重新打开
            showMoveItemMenu()
          }
        }
      })
    })
  }

  /** 让元素可拖动（pointer events，兼容触摸/鼠标） */
  function makeDraggable (el) {
    if (el._draggable) return
    el._draggable = true
    let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false, moved = false

    el.addEventListener('pointerdown', (e) => {
      // 点击内部按钮不触发拖动
      if (e.target.closest && e.target.closest('button')) return
      dragging = true
      moved = false
      startX = e.clientX
      startY = e.clientY
      const rect = el.getBoundingClientRect()
      startLeft = rect.left
      startTop = rect.top
      el.setPointerCapture && el.setPointerCapture(e.pointerId)
    })
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      // 超过阈值才算拖动，避免误触按钮
      if (!moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return
      moved = true
      el.style.left = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx)) + 'px'
      el.style.top = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy)) + 'px'
      el.style.right = 'auto'
      el.style.bottom = 'auto'
    })
    el.addEventListener('pointerup', () => { dragging = false })
    el.addEventListener('pointercancel', () => { dragging = false })
  }

  /** 清理浮动方向键（战斗/移动结束时） */
  function clearFloatDpad () {
    const float = document.getElementById('dpad-float')
    if (float) float.classList.add('hidden')
  }

  /** 生成十字方向键 */
  function buildDpad () {
    const state = State.get()
    const pos = state.position
    const dirs = [
      { key: 'n', dx: 0, dy: -1, label: '北', icon: '↑' },
      { key: 's', dx: 0, dy: 1, label: '南', icon: '↓' },
      { key: 'w', dx: -1, dy: 0, label: '西', icon: '←' },
      { key: 'e', dx: 1, dy: 0, label: '东', icon: '→' },
    ]
    const dirBtn = (d) => {
      const nx = pos.x + d.dx
      const ny = pos.y + d.dy
      const walkable = MapLib.isWalkable(nx, ny)
      // 岔路转向：禁用来路（同一回合不能回头）
      const isBack = _turning && _prevPos && _prevPos.x === nx && _prevPos.y === ny
      const tile = MapLib.get(nx, ny)
      const tileName = tile ? (tile.raw || tile.type) : '墙壁'
      const cls = (walkable && !isBack) ? 'dpad-btn dpad-active' : 'dpad-btn dpad-disabled'
      return `<button class="${cls}" data-dir="${d.key}" ${(walkable && !isBack) ? '' : 'disabled'}>
        <span class="dpad-arrow">${d.icon}</span>
        <span class="dpad-label">${d.label}</span>
        <span class="dpad-tile">${tileName}</span>
      </button>`
    }
    // 3×3 网格布局：物品在左上角空位（北的左、西的上）
    const centerLabel = _stepsRemaining > 0
      ? `<div class="dpad-center">🎲<span>剩${_stepsRemaining}步</span></div>`
      : `<div class="dpad-center">🎲<span>掷Y</span></div>`
    return `
      <div class="dpad dpad-grid">
        <button class="dpad-btn dpad-item-btn" id="btn-move-item" title="使用物品">
          <span class="dpad-arrow">🧪</span>
          <span class="dpad-label">物品</span>
        </button>
        ${dirBtn(dirs[0])}
        <div class="dpad-void"></div>
        ${dirBtn(dirs[2])}
        ${centerLabel}
        ${dirBtn(dirs[3])}
        <div class="dpad-void"></div>
        ${dirBtn(dirs[1])}
        <div class="dpad-void"></div>
      </div>
    `
  }

  /** 绑定十字键 */
  function bindDpad () {
    document.querySelectorAll('[data-dir]').forEach(btn => {
      btn.onclick = () => {
        const dirKey = btn.dataset.dir
        onMoveDirection(dirKey)
      }
    })
  }

  /** 选方向后掷 Y 直线移动 */
  async function onMoveDirection (dirKey) {
    if (_moveLocked) return   // 运行锁：防止重复触发
    _moveLocked = true

    const state = State.get()

    // 有剩余步数（岔路转向 / 直线移动中断恢复）：不重新掷骰，直接沿新方向继续走
    if (_stepsRemaining > 0) {
      _turning = false
      hint.textContent = '🎲 继续移动……'
      btns.innerHTML = ''
      clearFloatDpad()
      const dirs = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }
      const [dx, dy] = dirs[dirKey] || [0, 0]
      _isWalking = true
      try {
        await autoWalk(dx, dy)
      } finally {
        _moveLocked = false
      }
      if (State.get().phase !== 'battle') {
        StatusSystem.tickOutOfBattle()
      }
      return
    }

    hint.textContent = '🎲 掷骰中……'
    btns.innerHTML = ''
    clearFloatDpad()   // 移动时隐藏浮动方向键

    let steps = MovementSystem.rollStep()
    let injuredDmg = 0

    // 定时锁：每回合递减，到点自动解开
    if (typeof RestraintSystem !== 'undefined') RestraintSystem.tickTimers()

    // 脚镣/脚链：移动步数 -1（可叠加，最低 1 格）
    if (typeof RestraintSystem !== 'undefined') {
      let slow = 0
      if (RestraintSystem.hasLegCuffs()) slow++
      if (RestraintSystem.hasAnkleChains()) slow++
      if (slow > 0 && steps > 1) {
        steps = Math.max(1, steps - slow)
        EventBus.emit('ui:log', { text: '🦶 铁链拖着你的步子，挪动变慢了（步数 -' + slow + '）。', type: 'danger' })
      }
    }

    // 受伤状态：移动减速 + 扣血
    if (StatusSystem.has('injured')) {
      const injuredEffect = state.statuses.find(s => s.id === 'injured')
      const def = STATUS_EFFECTS['injured']
      const moveData = { steps, damage: 0 }
      const result = def.onMove(state, injuredEffect, moveData)
      steps = result.steps
      injuredDmg = result.damage
      if (steps !== moveData.steps || injuredDmg > 0) {
        EventBus.emit('ui:log', { text: `🩹 受伤状态：移动${steps}格，扣 ${injuredDmg} HP`, type: 'danger' })
      }
    }

    _stepsRemaining = steps
    // 移动中：写入存档状态，读档后恢复剩余步数
    state._moveState = { steps: _stepsRemaining, turning: false, prevPos: { x: _prevPos.x, y: _prevPos.y } }

    try {
      await Dialog.showDice(steps, 'Y')
    } catch (e) {
      console.error('骰子动画异常:', e)
    }

    if (injuredDmg > 0) {
      if (!State.get()._godMode) state.hp -= injuredDmg
      EventBus.emit('state:changed', state)
    }

    if (state.hp <= 0) {
      _isWalking = false
      state.phase = 'gameover'
      EventBus.emit('game:gameover', {})
      return
    }

    if (_stepsRemaining <= 0) {
      StatusSystem.tickOutOfBattle()
      readyToRoll()
      // 步数耗尽移动结束：佣兵可能发情袭击
      if (State.get().phase !== 'battle' && State.get().phase !== 'gameover') {
        await maybeMercenaryAssault()
      }
      return
    }

    const dirs = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }
    const [dx, dy] = dirs[dirKey] || [0, 0]
    _isWalking = true
    try {
      await autoWalk(dx, dy)
    } finally {
      _moveLocked = false
    }

    if (State.get().phase !== 'battle') {
      StatusSystem.tickOutOfBattle()
    }
    // 移动轮次结束：佣兵可能因发情强制袭击
    if (State.get().phase !== 'battle' && State.get().phase !== 'gameover') {
      await maybeMercenaryAssault()
    }
  }

  /* ============ 佣兵发情袭击（移动后） ============ */
  /** 移动结束后：佣兵发情 ≥50 时按 lust% 概率强制袭击 */
  async function maybeMercenaryAssault () {
    const state = State.get()
    const merc = state._mercenary
    if (!merc || merc.dead) return
    const lust = merc.lust || 0
    if (lust < 50) return
    // 掷骰：随机 0-99，小于 lust → 触发
    const roll = Math.floor(Math.random() * 100)
    if (roll >= lust) return
    EventBus.emit('ui:log', { text: `🔥 ${merc.icon} ${merc.name} 欲火中烧，从背后一把抱住了你（发情 ${lust}%，触发了 ${roll}%）！`, type: 'danger' })
    // 先随机攻击部位，再交给妖缚装置处理：充能抵挡、失效拔除、上锁改位、全封闭打屁股。
    const pool = state.gender !== 'male' ? ['oral', 'anal', 'vagina'] : ['oral', 'anal']
    const requestedPart = pool[Math.floor(Math.random() * pool.length)]
    const routed = typeof RestraintSystem !== 'undefined'
      ? RestraintSystem.resolveMonsterOrifice(requestedPart)
      : { mode: 'original', part: requestedPart, events: [] }
    ;(routed.events || []).forEach(text => EventBus.emit('ui:log', { text, type: routed.mode === 'blocked' ? 'good' : 'danger' }))
    if (routed.mode === 'blocked') {
      EventBus.emit('ui:log', { text: `⚡ ${merc.icon} ${merc.name}的袭击被防护充能完全挡下：0 伤害、0 效果。`, type: 'good' })
      EventBus.emit('state:changed', state)
      return
    }
    const type = routed.mode === 'spank' ? 'spank' : ({ oral: 'oral', anal: 'anal', vagina: 'sex' }[routed.part] || 'anal')
    await forcedMercenaryService(type, merc)
  }

  /** 强制佣兵服务任务（移动中被袭击） */
  async function forcedMercenaryService (type, merc) {
    const state = State.get()
    const cfg = {
      oral: { name: '强迫口交', dmg: 20, desc: '她揪着你的头发，把鸡巴狠狠塞进你嘴里，逼你深喉', seconds: 30 },
      anal: { name: '强迫肛交', dmg: 30, desc: '她把你按在树干上，从背后猛地操进你的菊穴', seconds: 30 },
      sex: { name: '强迫性交', dmg: 30, desc: '她把你压在身下，挺着鸡巴狠狠操进你的小穴', seconds: 30 },
      spank: { name: '强制打屁股', dmg: 10, desc: '你的嘴穴、菊穴和小穴都被挡住，她恼火地把你按住，狠狠抽打屁股', seconds: 30 },
    }[type]
    if (!cfg) return
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const f = await BattleUI.showTaskDialog({
        enemyName: `${merc.icon} ${merc.name}`,
        attackName: cfg.name,
        desc: cfg.desc,
        bpm: 90,
        seconds: cfg.seconds,
        dmg: 0,
        noDamage: true,
        dildoName: '她那根粗壮的鸡巴',
      })
      failed = f
    } else {
      failed = !confirm(`${cfg.name}：完成代表挨完了。`)
    }
    // 强制：完成降全欲；中途承受不住降一半
    const lustDrop = failed ? Math.floor(cfg.dmg / 2) : cfg.dmg
    merc.lust = Math.max(0, (merc.lust || 0) - lustDrop)
    EventBus.emit('ui:log', { text: failed
      ? `🥵 你被${merc.icon} ${merc.name}操得腿软求饶，她才放过你（性欲 -${lustDrop}）。`
      : `💦 ${merc.icon} ${merc.name} 满足地泄了身，放过你继续上路（性欲 -${lustDrop}）。`, type: 'danger' })
    EventBus.emit('state:changed', state)
  }

  /* ============ 沿方向直线移动 ============ */
  async function autoWalk (dx, dy) {
    while (_isWalking && _stepsRemaining > 0) {
      const state = State.get()
      const { x, y } = state.position

      // 目标格 = 当前格 + 方向
      const nx = x + dx
      const ny = y + dy

      // 撞墙或无路 → 停止
      if (!MapLib.isWalkable(nx, ny)) {
        EventBus.emit('ui:log', { text: '🚧 前方是墙/边界，停止移动。', type: 'dim' })
        break
      }

      _prevPos = { x, y }
      const res = await stepTo({ x: nx, y: ny })
      if (res === 'stopped') { _isWalking = false; return }
      if (res === 'ambush') { _isWalking = false; readyToRoll(); return }

      // 走到新格后判断岔路：排除来路(回头)后的可走方向
      const cur = State.get().position
      const neighbors = MapLib.neighbors(cur.x, cur.y)
      const openDirs = neighbors.filter(n => !(n.x === x && n.y === y))
      if (openDirs.length >= 2 && _stepsRemaining > 0 && State.get().phase === 'idle') {
        // 三岔/十字路口：暂停让玩家选择新方向
        EventBus.emit('ui:log', { text: `🔀 三岔路口！停下重新选择方向（剩 ${_stepsRemaining} 步）。`, type: 'dim' })
        _isWalking = false
        _turning = true
        readyToRoll(true)   // 保留剩余步数，选方向后继续走
        return
      }
      if (openDirs.length === 1 && _stepsRemaining > 0 && State.get().phase === 'idle') {
        // 只有唯一继续方向：若非原方向则自动拐弯，否则直线继续
        const next = openDirs[0]
        const forward = { x: cur.x + dx, y: cur.y + dy }
        if (!(next.x === forward.x && next.y === forward.y)) {
          // 直接改变方向继续走（不暂停），剩余步数保留
          const ndx = next.x - cur.x
          const ndy = next.y - cur.y
          dx = ndx
          dy = ndy
          continue
        }
      }
      if (openDirs.length === 0 && neighbors.length === 1 && _stepsRemaining > 0 && State.get().phase === 'idle') {
        // 走进死路时自动掉头，避免宝箱等尽头格吞掉剩余步数。
        const back = neighbors[0]
        dx = back.x - cur.x
        dy = back.y - cur.y
        continue
      }
    }

    // 步数耗尽或撞墙 → 触发当前格子事件（传送阵/宝藏已在经过时触发）
    _isWalking = false
    const state = State.get()
    const finalTile = MapLib.get(state.position.x, state.position.y)
    // 站在传送阵上：询问是否传送
    if (finalTile && finalTile.type === TILE.CHECKPOINT && typeof TeleportSystem !== 'undefined') {
      TeleportSystem.ask()
      return
    }
    if (finalTile && finalTile.type !== TILE.CHECKPOINT && finalTile.type !== TILE.EMPTY && finalTile.type !== TILE.START && finalTile.type !== TILE.TREASURE && finalTile.type !== TILE.AMBUSH) {
      NodeEvents.trigger(finalTile, state.position.x, state.position.y)
      return  // 事件接管流程，结束后通过 game:readyToMove 恢复
    }

    readyToRoll()
  }

  /** 走一步到目标格子 */
  async function stepTo (target) {
    const state = State.get()
    const fromX = state.position.x
    const fromY = state.position.y
    state.position = { x: target.x, y: target.y }
    state.visited.push({ x: target.x, y: target.y })
    const tile = MapLib.get(target.x, target.y)

    // 空地不消耗步数
    if (tile.type !== TILE.EMPTY) _stepsRemaining--

    // 移动中同步剩余步数到存档状态（中断档时恢复）
    if (state._moveState) {
      state._moveState.steps = _stepsRemaining
      state._moveState.prevPos = { x: fromX, y: fromY }
    }

    EventBus.emit('movement:arrive', { x: target.x, y: target.y, tile })
    EventBus.emit('ui:mapUpdate', {})
    EventBus.emit('state:changed', state)

    // 传送阵经过即触发：激活 + 回满 HP + 存档
    if (tile.type === TILE.CHECKPOINT) {
      const tp = typeof TeleportSystem !== 'undefined' ? TeleportSystem.byPos(target.x, target.y) : null
      if (tp) TeleportSystem.activate(tp.id)
      state.hp = state.maxHp
      EventBus.emit('ui:log', { text: tp ? `🌀 路过${tp.name}，HP 回满。` : '🌀 经过传送阵，HP 回满。', type: 'good' })
      State.save()
      EventBus.emit('state:changed', state)
    }

    // 伏击经过即触发（反复掷骰直到双数）
    if (tile.type === TILE.AMBUSH) {
      if (state._noEnemyEncounters) {
        EventBus.emit('ui:log', { text: '🚶 避敌模式让你安全穿过伏击区。', type: 'dim' })
        return 'continue'
      }
      await AmbushSystem.trigger()
      return 'ambush'
    }

    // 宝藏经过即触发
    if (tile.type === TILE.TREASURE) {
      const treasureResult = await TreasureSystem.roll({ continueMovement: _stepsRemaining > 0 })
      // 宝箱可能启动守卫战斗 / 贪婪恶魔弹窗，此时需停止移动
      if (treasureResult === 'battle' || State.get().phase === 'battle' || State.get()._battle) {
        _isWalking = false
        return 'stopped'
      }
      if (treasureResult === 'resume') {
        hint.textContent = `🚶 收好宝藏，继续前进（剩余 ${_stepsRemaining} 步）`
      }
    }

    // 营地经过即触发（打开营地菜单）
    if (tile.type === TILE.CAMP) {
      hint.textContent = '⛺ 进入营地……'
      _isWalking = false
      // 记录进入营地前的位置，离开时回到这里（避免困在营地格只能回头）
      if (typeof CampSystem !== 'undefined' && CampSystem.open) {
        const st = State.get()
        if (st) st._campReturnPos = { x: fromX, y: fromY }
        CampSystem.open({ gateEntry: true })
      }
      return 'stopped'
    }

    // 强盗营地是旧桥下方的固定地点，进入格子就停止自动行走并交给剧情系统。
    if (tile.type === TILE.BANDIT_CAMP) {
      hint.textContent = '🔥 进入桥下强盗营地……'
      _isWalking = false
      if (typeof PrologueSystem !== 'undefined' && PrologueSystem.visitBanditCamp) PrologueSystem.visitBanditCamp()
      else GameFlow.afterEvent()
      return 'stopped'
    }

    // 旧桥是可重复进入的主线节点。掷骰步数尚未耗尽时也必须停下来询问，
    // 否则玩家会因自动行走直接越过桥洞重试入口。
    if (tile.type === TILE.BRIDGE && _stepsRemaining > 0) {
      hint.textContent = `🌉 路过旧桥（剩余 ${_stepsRemaining} 步）`
      return new Promise(resolve => {
        Dialog.show({
          title: '🌉 路过旧桥',
          className: 'commission-bridge-modal',
          body: `<section class="scene-dialogue"><i aria-hidden="true">🌉</i><div><h3>断栏与桥墩从雾里显出来，桥下的浅滩就在脚边。</h3><p>${(state._wrongCommissionStage || 0) === 6 ? '封死的泄洪洞里仍有营火。你可以现在下桥，继续处理强盗据点与被关着的证人。' : (state._wrongCommissionStage || 0) === 2 ? '派克的货单写着空车从这里返回。桥板上的新车辙还没被雾冲掉，可以现在核对，也可以留着步数先过去。' : '你可以停下来查看旧桥，也可以保留剩余步数继续前进。'}</p></div></section>`,
          actions: [
            { label: (state._wrongCommissionStage || 0) === 6 ? '下桥进入据点' : (state._wrongCommissionStage || 0) === 2 ? '核对桥上的车辙' : '停下查看旧桥', cls: 'btn-primary', handler: () => {
              Dialog.close()
              _isWalking = false
              if (typeof PrologueSystem !== 'undefined' && PrologueSystem.visitBridge) PrologueSystem.visitBridge()
              else GameFlow.afterEvent()
              resolve('stopped')
            } },
            { kind: 'navigation', label: `继续前进（剩余 ${_stepsRemaining} 步）`, handler: () => {
              Dialog.close()
              hint.textContent = '🚶 经过旧桥，继续前进……'
              resolve('continue')
            } },
          ],
        })
      })
    }

    // 商店经过时可选停留
    if (tile.type === TILE.SHOP && _stepsRemaining > 0) {
      hint.textContent = '🏪 路过商店……'
      return new Promise(resolve => {
        Dialog.show({
          title: '🏪 发现商店！',
          body: '<p style="color:var(--text-dim)">你路过一间商店，是否停留？</p>',
          actions: [
            { label: '🛒 停留购物', cls: 'btn-primary', handler: () => {
              Dialog.close()
              _isWalking = false
              ShopSystem.open(tile)
              resolve('stopped')
            } },
            { label: '⏭ 继续前进', handler: () => {
              Dialog.close()
              hint.textContent = '🚶 继续前进……'
              setTimeout(() => resolve('continue'), 250)
            } },
          ],
        })
      })
    }

    // 小延迟
    await new Promise(r => setTimeout(r, 250))
    return 'continue'
  }

  /* ============ 事件监听 ============ */

  // 战斗/商店/陷阱等事件结束后，回到掷骰阶段
  EventBus.on('game:readyToMove', () => {
    const st = State.get()
    // 事件结束后无条件恢复移动（商店/陷阱/弹窗关闭等），不依赖 _isWalking
    if (!st || st.phase === 'battle' || st.phase === 'gameover' || st.phase === 'shop') return
    _isWalking = false
    _moveLocked = false
    readyToRoll()
  })

  EventBus.on('game:gameover', () => {
    _isWalking = false
    showActionBar()
    const wasBoss = State.get()._battle && State.get()._battle.enemyId === 'spirit_of_forest'

    if (wasBoss) {
      // BOSS 战死亡：可读取战前存档带全部物品重开
      hint.textContent = '💀 你被森林之灵击败了……'
      btns.innerHTML = `
        <button class="btn btn-primary" id="btn-retry-boss">🔄 读取战前存档重开 (带全部物品)</button>
        <button class="btn btn-danger" id="btn-respawn">🏘️ 返回检查点 (金币减半)</button>
      `
      document.getElementById('btn-retry-boss').onclick = RecoverySystem.retryBossFromSave
      document.getElementById('btn-respawn').onclick = RecoverySystem.respawn
      EventBus.emit('boss:defeat')  // 落败剧情
      return
    }

    hint.textContent = '💀 你死了……'
    btns.innerHTML = `<button class="btn btn-danger" id="btn-respawn">等待重生</button>`
    document.getElementById('btn-respawn').onclick = RecoverySystem.respawn
  })


  function restore (moveState) {
    if (moveState && (moveState.steps || 0) > 0) {
      _stepsRemaining = moveState.steps
      _turning = !!moveState.turning
      if (moveState.prevPos && moveState.prevPos.x >= 0) _prevPos = { x: moveState.prevPos.x, y: moveState.prevPos.y }
      readyToRoll(true)
      return true
    }
    readyToRoll()
    return false
  }

  /** 剧情节点主动撤回进入前一格，并结束本次掷骰移动。 */
  function retreatToPrevious () {
    const state = State.get()
    const saved = state && state._moveState && state._moveState.prevPos
    const back = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
      ? { x: saved.x, y: saved.y }
      : _prevPos && _prevPos.x >= 0 && _prevPos.y >= 0
        ? { x: _prevPos.x, y: _prevPos.y }
        : null
    if (!state || !back || !MapLib.isWalkable(back.x, back.y)) return false

    state.position = back
    state.phase = 'idle'
    state._moveState = null
    state.visited.push({ x: back.x, y: back.y })
    _prevPos = { x: -1, y: -1 }
    _stepsRemaining = 0
    _turning = false
    _isWalking = false
    _moveLocked = false
    EventBus.emit('ui:mapUpdate', {})
    EventBus.emit('state:changed', state)
    State.save()
    readyToRoll()
    return true
  }

  function handleResize () {
    const st = State.get()
    if (!st) return
    const gameActive = !gameScreen.classList.contains('screen-hidden')
    if (!gameActive || st.phase !== 'idle' || _isWalking || _moveLocked) return
    clearTimeout(_readyToRollTimer)
    const float = document.getElementById('dpad-float')
    if (float) float.classList.add('hidden')
    readyToRoll(_turning)
  }

  return { readyToRoll, restore, retreatToPrevious, handleResize, showActionBar }
})()
