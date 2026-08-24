/**
 * systems/index.js — 系统层聚合入口（网格版）
 *
 * 提供 GameFlow 流程控制 + 全局工具函数。
 * 提供陷阱与宝藏结算；移动和伏击流程位于 movement.js。
 */

window.GameFlow = {
  /**
   * 进入格子后继续流程：
   * 1. 触发事件（NodeEvents.trigger）
   * 2. 事件如果是战斗/商店/弹窗，它们接管流程
   * 3. 事件结束后回到移动模式
   */
  afterArrive (tile, x, y) {
    if (tile) {
      NodeEvents.trigger(tile, x, y)
    } else {
      this.afterEvent()
    }
  },

  /** 事件结束后（非战斗/商店等），回到移动等待 */
  afterEvent () {
    EventBus.emit('game:readyToMove', {})
  },
}

/**
 * 陷阱系统（网格版，完整 6 项）
 */
window.TrapSystem = {
  /** 森林陷阱尝试附加一件普通妖缚装置；不会覆盖现有槽位或特殊锁。 */
  tryRestraint (state = State.get(), random = Math.random) {
    const none = { applied: false, note: '', deviceId: null, slot: null, lockType: null, timer: 0 }
    if (typeof RestraintSystem === 'undefined' || typeof RESTRAINTS === 'undefined') return none
    const rules = RestraintSystem.settings()
    if (!rules.allowTrap || RestraintSystem.countLocked() > 0) return none
    if ((Number(random()) || 0) >= 0.3) return none

    const candidates = RESTRAINTS.flatMap(def => {
      if (def.story || def.buff || def.cosmetic || def.insert) return []
      if (def.femaleOnly && state.gender === 'male') return []
      if (def.maleOnly && state.gender !== 'male') return []
      return RestraintSystem.allowedSlotsOf(def).flatMap(slot => {
        if (RestraintSystem.isWorn(slot)) return []
        // 贞操装备合拢会排斥小穴插入物；陷阱不应静默覆盖玩家已有装备。
        if (def.effect === 'chastity' && RestraintSystem.isWorn('vagina')) return []
        return [{ def, slot }]
      })
    })
    if (!candidates.length) return none

    const choiceRoll = Math.max(0, Number(random()) || 0)
    const chosen = candidates[Math.min(candidates.length - 1, Math.floor(choiceRoll * candidates.length))]
    const lockRoll = Math.max(0, Number(random()) || 0)
    const opts = {
      locked: rules.trapAutoLock,
      lockType: rules.trapAutoLock && lockRoll < 0.1 ? 'cursed' : 'common',
      source: 'forest_trap',
    }

    // 陷阱获得的装备会永久记入已拥有列表，脱困后仍可重新穿戴。
    RestraintSystem.grant(chosen.def.id)
    const result = RestraintSystem.equip(chosen.slot, chosen.def.id, opts)
    if (!result.ok) return none

    let timer = 0
    let note = opts.locked
      ? `<br>⛓️ 陷阱机关猛地收紧——你被<b>${chosen.def.name}</b>锁住了！装备已记入妖缚栏，可用钥匙、挣扎或找铁匠解开。`
      : `<br>🌿 陷阱替你穿上了<b>${chosen.def.name}</b>，但自动上锁已在 MCM 中关闭，可以直接从妖缚栏脱下。`
    if (opts.locked && opts.lockType === 'cursed') {
      timer = 12
      RestraintSystem.setTimer(chosen.slot, timer)
      note = `<br>🧿 陷阱埋着<b>诅咒锁</b>——${chosen.def.name}锁在你身上！钥匙撬不开，只能找铁匠或使用驱咒符（⏲️ ${timer} 回合后自动解除）。`
    } else if (opts.locked && (Number(random()) || 0) < 0.35) {
      timer = 8 + Math.floor(Math.max(0, Number(random()) || 0) * 8)
      RestraintSystem.setTimer(chosen.slot, timer)
      note += `<br>⏲️ 这是定时锁：<b>${timer}</b> 回合后会自动打开。`
    }

    EventBus.emit('ui:log', {
      text: opts.locked
        ? `⛓️ 森林陷阱锁上了${chosen.def.name}${timer ? `（${timer} 回合）` : ''}。`
        : `🌿 森林陷阱替你穿上了${chosen.def.name}，但没有上锁。`,
      type: opts.locked ? 'danger' : 'dim',
    })
    return { applied: true, note, deviceId: chosen.def.id, slot: chosen.slot, lockType: opts.lockType, timer }
  },

  async roll () {
    const state = State.get()
    state.phase = 'trap'
    EventBus.emit('state:changed', state)

    const hint = document.getElementById('action-hint')
    if (hint) hint.textContent = '🪤 陷阱触发！正在掷 Z……'

    const z = Dice.rollZ()
    await Dialog.showDice(z, 'Z')
    const trap = DATA.trapByRoll(z)
    if (!trap) {
      state.phase = 'idle'
      EventBus.emit('state:changed', state)
      return GameFlow.afterEvent()
    }

    EventBus.emit('trap:trigger', { trap, roll: z })
    EventBus.emit('ui:log', { text: `🪤 Z=${z}：${trap.name} — ${trap.desc}`, type: 'danger' })

    let resultText = ''
    let resultTone = 'danger'

    switch (trap.effect) {
      case 'enemy_hp_double':
        state._nextEnemyHpDouble = true
        resultText = '下一场普通战斗开始时，主敌及其初始目标的 HP 翻倍。效果触发一次后消失。'
        break
      case 'back_to_checkpoint':
        resultText = backToCheckpoint()
        resultTone = 'neutral'
        break
      case 'ambush':
        const ambushRestraint = TrapSystem.tryRestraint(state)
        await TrapSystem.showResult(trap, z, `陷阱把你推进了伏击区域，接下来进入伏击判定。${ambushRestraint.note}`, 'danger', '🌫️ 陷入伏击')
        await AmbushSystem.trigger()
        return
      case 'double_enemy':
        state._nextBattleExtraAttacks = 2
        resultText = '下一场普通战斗会受到双敌夹击；作为补偿，你每回合可以攻击 2 次。效果触发一次后消失。'
        resultTone = 'warning'
        break
      case 'hp_halve':
        const oldHp = state.hp
        state.hp = Math.ceil(state.hp / 2)
        resultText = `从树上重重摔下：HP ${oldHp} → ${state.hp}。`
        break
      case 'injured':
        StatusSystem.apply('injured', 1)
        resultText = '获得「受伤」状态：下一次掷移动骰时会减速并扣血，随后解除。'
        break
    }

    EventBus.emit('state:changed', state)

    const restraintResult = TrapSystem.tryRestraint(state)
    if (restraintResult.applied) {
      resultText += restraintResult.note
      resultTone = 'danger'
    }

    await TrapSystem.showResult(trap, z, resultText, resultTone)
    state.phase = 'idle'
    EventBus.emit('state:changed', state)
    GameFlow.afterEvent()
  },

  showResult (trap, roll, resultText, tone = 'danger', actionLabel = '继续前进') {
    return new Promise(resolve => {
      Dialog.show({
        title: `🪤 ${trap.name}`,
        className: `trap-result-modal trap-tone-${tone}`,
        body: `<div class="trap-result">
          <div class="trap-roll"><span>Z</span><b>${roll}</b></div>
          <p class="trap-desc">${trap.desc}</p>
          <div class="trap-effect"><small>结算结果</small><p>${resultText}</p></div>
        </div>`,
        actions: [{ label: actionLabel, cls: tone === 'neutral' ? 'btn-primary' : 'btn-danger', handler: () => {
          Dialog.close()
          resolve()
        }}],
      })
    })
  },
}

/** 回到最近检查点或起点 */
function backToCheckpoint () {
  const state = State.get()
  for (let i = state.visited.length - 1; i >= 0; i--) {
    const v = state.visited[i]
    const tile = MapLib.get(v.x, v.y)
    if (tile && tile.type === TILE.CHECKPOINT) {
      state.position = { x: v.x, y: v.y }
      state.hp = state.maxHp
      EventBus.emit('ui:log', { text: `回到检查点 (${v.x},${v.y})`, type: 'dim' })
      EventBus.emit('state:changed', state)
      EventBus.emit('ui:mapUpdate', {})
      return `迷路后回到了检查点 (${v.x},${v.y})，HP 已恢复至 ${state.hp}。`
    }
  }
  state.position = { x: MapLib.start.x, y: MapLib.start.y }
  state.hp = state.maxHp
  EventBus.emit('ui:log', { text: '回到起点。', type: 'dim' })
  EventBus.emit('state:changed', state)
  EventBus.emit('ui:mapUpdate', {})
  return `尚未经过检查点，因此回到了起点，HP 已恢复至 ${state.hp}。`
}

/**
 * 宝藏系统（网格版）
 * 集齐记录存于 state.treasures（持久化），避免递归栈溢出。
 */
window.TreasureSystem = {
  /** 发放补给包：妖缚装备进入拥有列表；已达拥有上限时按商店半价折成金币。 */
  grantItemBundle (state, itemIds) {
    const rewards = []
    let convertedGold = 0
    ;(itemIds || []).forEach(id => {
      const restraint = typeof RestraintSystem !== 'undefined' ? RestraintSystem.defOf(id) : null
      if (restraint && restraint.insert) {
        const before = RestraintSystem.ownedCount(id)
        RestraintSystem.grant(id)
        const after = RestraintSystem.ownedCount(id)
        if (after > before) {
          rewards.push(`${restraint.name}（已加入妖缚装备栏）`)
        } else {
          const value = Math.floor(Math.max(0, restraint.price || 0) * 0.5)
          state.gold += value
          convertedGold += value
          rewards.push(`${restraint.name}已拥有，折算 ${value}G`)
        }
        return
      }
      state.inventory.consumables[id] = (state.inventory.consumables[id] || 0) + 1
      rewards.push(ItemLib.get(id)?.name || id)
    })
    return { rewards, convertedGold }
  },

  /** 贪婪恶魔依附到胸部妖缚槽；不覆盖玩家已有装备。 */
  applyGreedDemon (state) {
    let gearText = ''
    if (typeof RestraintSystem !== 'undefined') {
      const chest = RestraintSystem.get('chest')
      if (!chest) {
        RestraintSystem.grant('nipple_clamps')
        const equipped = RestraintSystem.equip('chest', 'nipple_clamps', { source: 'greed_demon' })
        gearText = equipped.ok
          ? '乳夹已装备到胸部妖缚槽；取下后金币翻倍会立即结束。'
          : '乳夹已加入妖缚装备栏，但未能自动穿戴。'
      } else {
        chest.greedBound = true
        EventBus.emit('state:changed', state)
        const def = RestraintSystem.defOf(chest.id)
        gearText = `胸部已有${def ? def.name : '装备'}，贪婪恶魔附着其上，没有覆盖原装备；取下该装备后效果结束。`
      }
    } else {
      gearText = '获得金币翻倍效果。'
    }
    StatusSystem.apply('greed_demon', 9999)
    return gearText
  },

  /** 死亡时解除恶魔与胸部装备的绑定；只自动脱下由恶魔赠送且未上锁的乳夹。 */
  clearGreedDevice () {
    if (typeof RestraintSystem === 'undefined') return 'none'
    const chest = RestraintSystem.get('chest')
    if (!chest) return 'none'
    if (chest.source === 'greed_demon') {
      if (chest.locked) return 'locked'
      RestraintSystem.remove('chest')
      return 'removed'
    }
    if (chest.greedBound) {
      delete chest.greedBound
      EventBus.emit('state:changed', State.get())
      return 'detached'
    }
    return 'none'
  },

  async roll ({ continueMovement = false } = {}) {
    const state = State.get()
    const totalTreasures = TREASURES.length
    state.phase = 'treasure'
    EventBus.emit('state:changed', state)

    const hint = document.getElementById('action-hint')
    if (hint) hint.textContent = '🎁 打开宝箱……'

    // 第 7 个已经领取：之后经过宝箱不再发放奖励。
    if (state.treasureComplete) {
      EventBus.emit('ui:log', { text: '📭 宝箱已经被搜空了。', type: 'dim' })
      await TreasureSystem.showResult({ name: '空宝箱', desc: '七份宝藏已经全部收集完成。' }, '—', '里面已经没有可领取的奖励。', TreasureSystem.totalSlots(), '继续前进')
      state.phase = 'idle'
      EventBus.emit('state:changed', state)
      if (!continueMovement) GameFlow.afterEvent()
      return continueMovement ? 'resume' : 'continue'
    }

    // 六种唯一宝藏集齐后，第 7 个由玩家从已获得宝藏中自选，不再掷骰。
    if (state.treasures.length >= totalTreasures) {
      const selected = await TreasureSystem.showFinalChoice()
      return TreasureSystem.claimFinal(selected, continueMovement)
    }

    // 循环重掷直到拿到未收集的宝藏（最多尝试 20 次防死循环）
    let treasure = null
    let finalRoll = null
    for (let i = 0; i < 20; i++) {
      const z = Dice.rollZ()
      const t = DATA.treasureByRoll(z)
      if (t && !state.treasures.includes(t.id)) {
        treasure = t
        finalRoll = z
        break
      }
    }

    // 兜底：20 次仍没抽到新宝藏，强制给第一个未收集的宝藏，保证必有奖励
    if (!treasure) {
      treasure = TREASURES.find(t => !state.treasures.includes(t.id)) || null
      if (!treasure) {
        EventBus.emit('ui:log', { text: '宝箱是空的……', type: 'dim' })
        state.phase = 'idle'
        EventBus.emit('state:changed', state)
        if (!continueMovement) GameFlow.afterEvent()
        return continueMovement ? 'resume' : 'continue'
      }
      finalRoll = treasure.roll
      EventBus.emit('ui:log', { text: '🎁 宝箱吐出了最后的宝藏！', type: 'good' })
    }

    await Dialog.showDice(finalRoll, 'Z')
    EventBus.emit('treasure:find', { treasure, roll: finalRoll })
    EventBus.emit('ui:log', { text: `🎁 ${treasure.desc}`, type: 'good' })

    let resultText = ''
    let actionLabel = '收下宝藏'

    switch (treasure.effect) {
      case 'gold':
        state.gold += treasure.gold
        resultText = `获得 ${treasure.gold} 金币，当前共有 ${state.gold} 金币。`
        break
      case 'guardian':
        // 守卫宝箱只有胜利后才算正式收集；战败或逃跑可回来重新挑战。
        state._pendingGuardianTreasure = { id: treasure.id, gold: treasure.gold || 0 }
        resultText = `${DATA.monster(treasure.enemy)?.name || '宝箱守卫'}跳了出来。击败它后才能获得 ${treasure.gold || 0} 金币。`
        actionLabel = '⚔️ 挑战守卫'
        EventBus.emit('state:changed', state)
        await TreasureSystem.showResult(treasure, finalRoll, resultText, state.treasures.length, actionLabel, 'danger')
        BattleSystem.start(treasure.enemy)
        return 'battle'
      case 'items':
        const bundle = TreasureSystem.grantItemBundle(state, treasure.items)
        resultText = `获得：${bundle.rewards.join('、')}。${bundle.convertedGold ? `重复妖缚装备共折算 ${bundle.convertedGold}G。` : ''}`
        break
      case 'maxhp':
        state.maxHp += treasure.value
        state.hp += treasure.value
        resultText = `最大 HP +${treasure.value}，当前生命 ${state.hp} / ${state.maxHp}。`
        break
      case 'greed_demon':
        resultText = `${TreasureSystem.applyGreedDemon(state)}获得金币翻倍效果；死亡时贪婪恶魔会消失。`
        actionLabel = '😈 戴上乳夹'
        break
      case 'free_upgrade':
        // 材料进入背包，供商店使用
        state._freeUpgrade = true
        state.inventory.consumables['weapon_upgrade_material'] = (state.inventory.consumables['weapon_upgrade_material'] || 0) + 1
        EventBus.emit('ui:log', { text: '🔧 获得武器升级材料（已放入背包）！', type: 'good' })
        resultText = '获得武器升级材料：可在商店免费升级普通武器，购买大师之剑时抵扣 500 金币。'
        break
    }

    state.treasures.push(treasure.id)
    EventBus.emit('state:changed', state)
    await TreasureSystem.showResult(treasure, finalRoll, resultText, state.treasures.length, actionLabel)
    state.phase = 'idle'
    EventBus.emit('state:changed', state)
    if (!continueMovement) GameFlow.afterEvent()
    return continueMovement ? 'resume' : 'continue'
  },

  showResult (treasure, roll, resultText, collectedCount, actionLabel = '收下宝藏', tone = 'reward') {
    return new Promise(resolve => {
      Dialog.show({
        title: `🎁 ${treasure.name}`,
        className: `treasure-result-modal treasure-tone-${tone}`,
        body: `<div class="treasure-result">
          <div class="treasure-roll"><span>Z</span><b>${roll}</b></div>
          <p class="treasure-desc">${treasure.desc}</p>
          <div class="treasure-reward"><small>开箱结果</small><p>${resultText}</p></div>
          <div class="treasure-progress"><span>宝藏收集</span><b>${collectedCount} / ${TreasureSystem.totalSlots()}</b></div>
        </div>`,
        actions: [{ label: actionLabel, cls: tone === 'danger' ? 'btn-danger' : 'btn-success', handler: () => {
          Dialog.close()
          resolve()
        }}],
      })
    })
  },

  totalSlots () {
    return TREASURES.length + 1
  },

  showFinalChoice () {
    return new Promise(resolve => {
      Dialog.show({
        title: '✨ 选择第七宝藏',
        className: 'treasure-choice-modal',
        body: `<div class="treasure-choice">
          <p>六种宝藏已经集齐。最后一份无需掷骰，可以从已获得的宝藏中再选择一个。</p>
          <div class="treasure-choice-grid">${TREASURES.map(treasure => `
            <button class="treasure-choice-card" data-treasure="${treasure.id}">
              <b>${treasure.name}</b>
              <span>${treasure.desc}</span>
            </button>`).join('')}</div>
          <small>选择后无法更改${TREASURES.some(t => t.effect === 'guardian') ? '；守卫宝箱仍需击败守卫才算领取' : ''}。</small>
        </div>`,
        actions: [],
      })

      let chosen = false
      setTimeout(() => {
        document.querySelectorAll('.treasure-choice-card').forEach(btn => {
          btn.onclick = () => {
            if (chosen) return
            const treasure = TREASURES.find(t => t.id === btn.dataset.treasure)
            if (!treasure) return
            chosen = true
            Dialog.close()
            resolve(treasure)
          }
        })
      }, 0)
    })
  },

  async claimFinal (treasure, continueMovement) {
    const state = State.get()
    let resultText = ''
    let actionLabel = '领取第七宝藏'

    EventBus.emit('ui:log', { text: `✨ 第七宝藏选择：${treasure.name}`, type: 'good' })

    switch (treasure.effect) {
      case 'gold':
        state.gold += treasure.gold
        resultText = `再次获得 ${treasure.gold} 金币，当前共有 ${state.gold} 金币。`
        break
      case 'guardian':
        state._pendingGuardianTreasure = { id: treasure.id, gold: treasure.gold || 0, isFinal: true }
        resultText = `${DATA.monster(treasure.enemy)?.name || '宝箱守卫'}再次出现。击败它后才能完成第七宝藏。`
        actionLabel = '⚔️ 再次挑战守卫'
        EventBus.emit('state:changed', state)
        await TreasureSystem.showResult(treasure, '自选', resultText, TREASURES.length, actionLabel, 'danger')
        BattleSystem.start(treasure.enemy)
        return 'battle'
      case 'items':
        const finalBundle = TreasureSystem.grantItemBundle(state, treasure.items)
        resultText = `再次获得：${finalBundle.rewards.join('、')}。${finalBundle.convertedGold ? `重复妖缚装备共折算 ${finalBundle.convertedGold}G。` : ''}`
        break
      case 'maxhp':
        state.maxHp += treasure.value
        state.hp += treasure.value
        resultText = `最大 HP 再次 +${treasure.value}，当前生命 ${state.hp} / ${state.maxHp}。`
        break
      case 'greed_demon':
        resultText = `${TreasureSystem.applyGreedDemon(state)}贪婪恶魔效果重新生效；获得金币翻倍，死亡时消失。`
        actionLabel = '😈 再次戴上乳夹'
        break
      case 'free_upgrade':
        state._freeUpgrade = true
        state.inventory.consumables.weapon_upgrade_material = (state.inventory.consumables.weapon_upgrade_material || 0) + 1
        resultText = '再次获得 1 个武器升级材料。'
        break
    }

    state.treasureComplete = true
    state.treasureBonusId = treasure.id
    EventBus.emit('state:changed', state)
    await TreasureSystem.showResult(treasure, '自选', resultText, TreasureSystem.totalSlots(), actionLabel)
    state.phase = 'idle'
    EventBus.emit('state:changed', state)
    if (!continueMovement) GameFlow.afterEvent()
    return continueMovement ? 'resume' : 'continue'
  },

  /** 守卫宝箱战斗结束结算；返回 true 表示处理了待领取宝藏。 */
  settleGuardian (battleResult) {
    const state = State.get()
    const pending = state._pendingGuardianTreasure

    if (pending) {
      state._pendingGuardianTreasure = null
      state._pendingGuardianGold = null
      if (battleResult.victory && !battleResult.fled) {
        if (pending.isFinal) {
          state.treasureComplete = true
          state.treasureBonusId = pending.id
        } else if (!state.treasures.includes(pending.id)) {
          state.treasures.push(pending.id)
        }
        state.gold += pending.gold || 0
        EventBus.emit('ui:log', { text: `🎁 击败宝箱守卫，获得 ${pending.gold || 0} 金币！`, type: 'good' })
        EventBus.emit('state:changed', state)
        State.save()
      } else {
        EventBus.emit('ui:log', { text: '🎁 未能击败宝箱守卫，宝藏仍留在箱中。', type: 'dim' })
      }
      return true
    }

    // 兼容旧存档留下的单独金币字段。
    if (battleResult.victory && !battleResult.fled && state._pendingGuardianGold) {
      const bonus = state._pendingGuardianGold
      state._pendingGuardianGold = null
      state.gold += bonus
      EventBus.emit('ui:log', { text: `🎁 守卫宝箱额外奖励 ${bonus} 金币！`, type: 'good' })
      EventBus.emit('state:changed', state)
      State.save()
      return true
    }
    return false
  },
}
