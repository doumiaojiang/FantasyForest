/** main-recovery.js — 死亡恢复、检查点与 Boss 结局。 */
window.RecoverySystem = (function () {
  let hooks = {}
  const hint = document.getElementById('action-hint')
  const btns = document.getElementById('action-buttons')
  const loverTerm = gender => gender === 'male' ? { term:'女友', pronoun:'她' } : { term:'男友', pronoun:'他' }
  function retryBossFromSave () {
    const saved = State.loadBossCheckpoint()
    if (!saved) {
      EventBus.emit('ui:log', { text: '⚠️ 没有找到战前存档！', type: 'danger' })
      respawn()
      return
    }
    State.migrate(saved)
    const state = State.get()
    state._battle = null
    state._moveState = null
    state.phase = 'idle'
    state.hp = state.maxHp
    EventBus.emit('ui:log', { text: '🔄 已读取战前存档，带全部物品重新挑战！', type: 'good' })
    EventBus.emit('state:changed', state)
    // 回到 BOSS 前检查点
    backToCheckpoint()
    hooks.readyToRoll()
  }

  function respawn () {
    const state = State.get()
    const hadGreed = StatusSystem.has('greed_demon')
    const greedDeviceResult = hadGreed && typeof TreasureSystem !== 'undefined' && TreasureSystem.clearGreedDevice
      ? TreasureSystem.clearGreedDevice()
      : 'none'
    // 清理战斗/伏击残留（防伏击死亡后状态残留导致无法正常行动）
    state._battle = null
    state._ambush = null
    state._pendingLootEvent = null
    state.gold = Math.floor(state.gold * 0.5)
    backToCheckpoint()
    state.phase = 'idle'
    state.statuses = []
    EventBus.emit('ui:log', { text: `金币减半至 ${state.gold}G。`, type: 'dim' })
    EventBus.emit('state:changed', state)
    // 死亡后贪婪恶魔消失，并与真实的胸部妖缚槽同步。
    if (hadGreed) {
      const deviceText = {
        removed: '恶魔赠送的乳夹已自动从胸部妖缚槽脱下，装备仍保留在已拥有列表。',
        detached: '恶魔已经离开你原本的胸部装备；原装备保持不变。',
        locked: '金币翻倍已经失效，但你后来锁住的乳夹仍留在胸部槽，需要自行解锁。',
        none: '金币翻倍效果已经解除。',
      }[greedDeviceResult] || '金币翻倍效果已经解除。'
      Dialog.show({
        title: '😈 贪婪恶魔消失了',
        body: `
          <p>你死了，贪婪恶魔也随之消失了……</p>
          <p style="color:var(--text-dim);margin-top:6px">${deviceText}</p>
        `,
        actions: [
          { label: '继续冒险', cls: 'btn-primary', handler: () => { Dialog.close(); hooks.readyToRoll() } },
        ],
      })
      return
    }
    hooks.readyToRoll()
  }

  function backToCheckpoint () {
    const state = State.get()
    for (let i = state.visited.length - 1; i >= 0; i--) {
      const v = state.visited[i]
      const tile = MapLib.get(v.x, v.y)
      if (tile && tile.type === TILE.CHECKPOINT) {
        state.position = { x: v.x, y: v.y }
        state.hp = state.maxHp
        return
      }
    }
    state.position = { x: MapLib.start.x, y: MapLib.start.y }
    state.hp = state.maxHp
  }

  /* ============ BOSS 结局 ============ */
  // 战斗开始时记录来源格到 battle（读档后投降/逃跑仍可退回）
  EventBus.on('battle:start', (data) => {
    const b = data && data.battle
    if (b && _prevPos && _prevPos.x >= 0 && _prevPos.y >= 0) {
      b.prevPos = { x: _prevPos.x, y: _prevPos.y }
    }
  })

  EventBus.on('battle:end', (data) => {
    const state = State.get()
    TreasureSystem.settleGuardian(data)
    if (data.fled) {
      // 逃跑/投降成功：退回来源格，避免困在战斗格反复遭遇
      // 优先用战斗存档里的 prevPos（读档后 _prevPos 已丢失），否则用内存 _prevPos
      const back = (data.prevPos && data.prevPos.x >= 0) ? data.prevPos : _prevPos
      if (back && back.x >= 0 && back.y >= 0 && MapLib.isWalkable(back.x, back.y)) {
        state.position = { x: back.x, y: back.y }
        EventBus.emit('ui:log', { text: `🏳️ 你回到了之前的位置 (${back.x},${back.y})`, type: 'dim' })
      }
      return
    }
    // 打赢敌人：酒馆赌客会回来（之前被赢光后离开）
    if (data.victory && (state._tavernGuest || 0) <= 0) {
      state._tavernGuest = 50
      EventBus.emit('ui:log', { text: '🍺 你打赢了敌人，酒馆的赌客又回来了，兜里重新揣着 50G。', type: 'good' })
      EventBus.emit('state:changed', state)
    }
    if (data.victory && data.enemyId === 'spirit_of_forest') {
      // 标记 BOSS 已击败
      State.update(s => { s.bossDefeated = true })
      State.clearBossCheckpoint()
      State.save()
      showBossVictory()
    }
  })

  function showBossVictory () {
    const state = State.get()
    hooks.showActionBar()
    const lover = loverTerm(state.gender)
    hint.textContent = '🎉 你击败了森林之灵！'
    EventBus.emit('ui:log', { text: '🎉 你杀死了森林之灵，疯长的村庄开始恢复原样。', type: 'good' })
    EventBus.emit('ui:log', { text: `所有村民从森林中走出，你看到了你的${lover.term}！`, type: 'good' })
    const naughty = state.gender === 'male'
      ? `<p>你看到女友，立刻把她带回家狠狠干了一场。</p>
         <p class="boss-ending-note">如果你想要，她会用绑带假阳具干你，最后你射进她里面。</p>`
      : `<p>你看到男友，立刻把他带回家狠狠干了一场。</p>
         <p class="boss-ending-note">如果你想要，他会用他的粗大鸡巴干你，最后他射进你里面。</p>`
    Dialog.show({
      title: '森林重见晨光',
      className: 'boss-ending-modal boss-victory-modal',
      body: `
        <div class="boss-ending-mark">☀</div>
        <small class="boss-ending-kicker">VICTORY · 妖林终章</small>
        <p>你杀死了森林之灵，疯长的村庄开始恢复原样。所有村民从森林中走出，浑然不知刚才发生了什么。</p>
        <div class="boss-ending-divider"><i></i><span>✦</span><i></i></div>
        ${naughty}
      `,
      actions: [
        { label: `🏡 带${lover.pronoun}回家`, cls: 'btn-primary', handler: () => {
          Dialog.close()
          EventBus.emit('ui:log', { text: `🏡 大结局：你救回了${lover.term}，从此过上了幸福的生活。`, type: 'good' })
          btns.innerHTML = ''
          hint.textContent = '🏡 大结局！'
        }},
      ],
    })
  }

  /** BOSS 落败剧情（由 BattleUI 在 BOSS 死亡时触发） */
  EventBus.on('boss:defeat', () => {
    Dialog.show({
      title: '永恒囚笼',
      className: 'boss-ending-modal boss-defeat-modal',
      body: `
        <div class="boss-ending-mark">♛</div>
        <small class="boss-ending-kicker">DEFEAT · 森林吞噬了你</small>
        <p>她用藤蔓缠住你，滑入你的每一个洞，把你拖进森林深处。</p>
        <p>你慢慢变成一棵树，但意识仍然清醒。</p>
        <div class="boss-ending-divider"><i></i><span>◆</span><i></i></div>
        <p class="boss-ending-final">你从此成了她永恒的私人泄欲工具。</p>
      `,
      actions: [
        { label: '……', cls: 'btn-danger', handler: () => Dialog.close() },
      ],
    })
  })

  function diffName (d) { return { normal: '普通', hard: '困难', brutal: '残酷' }[d] || d }

  function init (callbacks) { hooks = callbacks || {} }
  return { init, retryBossFromSave, respawn, backToCheckpoint, showBossVictory }
})()

