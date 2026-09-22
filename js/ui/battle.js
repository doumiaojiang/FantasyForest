/**
 * ui/battle.js — 战斗界面
 *
 * 流程：
 *   玩家回合 → 攻击/跳过 → 敌人回合（显示任务描述）
 *   → 玩家点「完成任务」or「没完成」 → 回到玩家回合
 */

window.BattleUI = (function () {
  let _enemy = null
  let _lastEnemyAttack = null
  let _activeTaskCleanup = null

  function init () {
    EventBus.on('battle:start', onStart)
    EventBus.on('battle:end', onEnd)
    EventBus.on('battle:ui:ready', onBattleReady)
    // 任务弹窗被设置、剧情或其他流程提前关闭时，也必须停止后台计时与节拍声。
    EventBus.on('ui:modalclose', () => {
      if (_activeTaskCleanup) _activeTaskCleanup()
    })
  }

  function onBattleReady () {
    // 石化先攻：敌人获得先手（如魔女），第一次攻击后石化解除
    if (_enemy && _enemy.props && _enemy.props.firstStrike) {
      const hint = document.getElementById('action-hint')
      hint.textContent = `🪨 你被石化了，${_enemy.name} 获得先攻！`
      EventBus.emit('ui:log', { text: `🪨 你被石化了，${_enemy.name} 获得先攻！第一次攻击后石化解除。`, type: 'danger' })
      setTimeout(() => {
        doEnemyTurn()
      }, 500)
      return
    }
    const battle = State.get() && State.get()._battle
    if (battle && battle.banditAmbushPending) {
      const hint = document.getElementById('action-hint')
      hint.textContent = '☠️ 哨探从斜坡阴影里先按住了你！'
      EventBus.emit('ui:log', { text: '☠️ 哨探没有喊人。他先捂住你的嘴，把你按进货箱后面。', type: 'danger' })
      setTimeout(() => {
        doBanditAmbush()
      }, 400)
      return
    }
    showPlayerTurn()
  }

  function onStart (data) {
    _enemy = data.enemy
    _lastEnemyAttack = null
    // 进入战斗：隐藏地图 + 操作栏固定底部
    const body = document.querySelector('.game-body')
    const mapPanel = document.getElementById('map-panel')
    const actionBar = document.getElementById('action-bar')
    const gameScreen = document.getElementById('screen-game')
    if (body) body.classList.add('battle-mode')
    if (mapPanel) mapPanel.classList.add('panel-hidden')
    if (actionBar) actionBar.classList.add('fixed')
    if (actionBar) actionBar.classList.remove('hidden')   // 战斗时显示操作栏
    if (gameScreen) gameScreen.classList.add('has-fixed-bar')

    // 清理移动界面：隐藏浮动方向键、清空操作栏按钮（防止作弊/任何入口残留）
    const floatDpad = document.getElementById('dpad-float')
    if (floatDpad) floatDpad.classList.add('hidden')
    const actionButtons = document.getElementById('action-buttons')
    if (actionButtons) actionButtons.innerHTML = ''

    // 哥布林：先播数量掷骰动画，再显示战斗弹窗
    if (_enemy.id === 'goblins') {
      const count = State.get()._battle && State.get()._battle.goblinInitialCount
      setTimeout(() => {
        Dialog.battleIntro(_enemy, { goblinCount: count, battle: data.battle })
      }, 800)
      return
    }
    Dialog.battleIntro(_enemy, { battle: data.battle })
  }

  /* ============ 玩家回合 ============ */

  function showPlayerTurn () {
    const hint = document.getElementById('action-hint')
    const btns = document.getElementById('action-buttons')

    const isStunned = StatusSystem.has('stunned')
    hint.textContent = isStunned
      ? `⚡ ${_enemy.name} — 你被眩晕了，无法行动`
      : `⚔️ ${_enemy.name} — 你的回合`

    if (isStunned) {
      // 眩晕：无法攻击/防御/逃跑/使用物品，只能跳过
      btns.innerHTML = `
        <button class="btn" id="btn-skip">⏭ 跳过 (被眩晕)</button>
      `
      document.getElementById('btn-skip').onclick = () => {
        // 跳过同样消耗 1 回合，眩晕倒计时递减
        if (typeof RestraintSystem !== 'undefined') RestraintSystem.tickTimers()
        if (typeof BattleSystem.tickCaravanBindings === 'function' && !BattleSystem.tickCaravanBindings()) return
        StatusSystem.tickInBattle()
        // 状态伤害（中毒/再生反转）可能致死，统一走死亡流程
        if (State.get().hp <= 0) {
          BattleSystem.end(false)
          return
        }
        if (State.get().phase !== 'battle') return
        doEnemyTurn()
      }
      return
    }

    const caravanPending = typeof BattleSystem.caravanPendingBindings === 'function' ? BattleSystem.caravanPendingBindings() : []
    const nearestCaravanLock = caravanPending.length ? Math.min(...caravanPending.map(binding => binding.remaining)) : 0
    btns.innerHTML = `
      <button class="btn btn-primary" id="btn-attack">🎲 攻击</button>
      <button class="btn" id="btn-defend">🛡️ 防御</button>
      <button class="btn" id="btn-skip">⏭ 跳过</button>
      ${_enemy && _enemy.surrender ? '<button class="btn" id="btn-flee">🏳️ 投降</button>' : ''}
      <button class="btn" id="btn-item">🧪 物品</button>
      ${caravanPending.length ? `<button class="btn btn-danger" id="btn-caravan-struggle">⏳ 挣开车队束缚 (${nearestCaravanLock}回合)</button>` : ''}
      ${(typeof RestraintSystem !== 'undefined' && RestraintSystem.lockedSlots().some(slot => !RestraintSystem.isContractLock(slot) && RestraintSystem.get(slot)?.source !== 'p_caravan_guard')) ? '<button class="btn" id="btn-struggle">⛓️ 挣脱</button>' : ''}
    `

    document.getElementById('btn-attack').onclick = () => { playerAttack() }
    document.getElementById('btn-defend').onclick = () => { doDefend() }
    document.getElementById('btn-skip').onclick = () => { doSkip() }
    const fleeBtn = document.getElementById('btn-flee')
    if (fleeBtn) fleeBtn.onclick = () => { doSurrender() }
    document.getElementById('btn-item').onclick = () => { showItemMenu() }
    const caravanStruggleBtn = document.getElementById('btn-caravan-struggle')
    if (caravanStruggleBtn) caravanStruggleBtn.onclick = () => { doCaravanStruggle() }
    const struggleBtn = document.getElementById('btn-struggle')
    if (struggleBtn) struggleBtn.onclick = () => { doBattleStruggle() }
  }

  function doDefend () {
    // 束腰：勒紧腰身，摆不出防御姿态
    if (typeof RestraintSystem !== 'undefined' && RestraintSystem.hasCorset()) {
      EventBus.emit('ui:log', { text: '🩱 束腰勒得你直不起腰，摆不出防御姿态！', type: 'danger' })
      showPlayerTurn()
      return
    }
    if (!tickPlayerTurn()) return
    BattleSystem.defend()
    doEnemyTurn()
  }

  function doSkip () {
    if (!tickPlayerTurn()) return
    doEnemyTurn()
  }

  /** 战斗中挣脱：消耗本回合攻击机会，尝试挣脱一件上锁妖缚装置 */
  function doBattleStruggle () {
    if (typeof RestraintSystem === 'undefined') { showPlayerTurn(); return }
    const slots = RestraintSystem.lockedSlots().filter(slot => !RestraintSystem.isContractLock(slot) && RestraintSystem.get(slot)?.source !== 'p_caravan_guard')
    if (!slots.length) { showPlayerTurn(); return }
    const html = slots.map(slot => {
      const d = RestraintSystem.get(slot)
      const def = RestraintSystem.defOf(d.id)
      return `<button class="restr-struggle-opt" data-slot="${slot}"><i>${RestraintSystem.SLOT_ICONS[slot]}</i><span><b>${def.name}</b><small>${RestraintSystem.SLOT_NAMES[slot]} · ${d.lockType === 'cursed' ? '🧿 诅咒锁' : d.timer ? `⏲️ 定时锁(${d.timer})` : '🔒 上锁'}</small></span></button>`
    }).join('')
    Dialog.show({
      title: '⛓️ 战斗中挣脱',
      className: 'inventory-modal restraint-modal',
      body: `<div class="restr-struggle-pick">${html}</div><p class="camp-footnote">挣脱会消耗本回合攻击机会；诅咒锁挣脱无效，定时锁可等它到点自动开。</p>`,
      actions: [{ label: '取消', handler: () => { Dialog.close(); showPlayerTurn() } }],
    })
    Dialog.onMount(root => {
      root.querySelectorAll('.restr-struggle-opt').forEach(btn => {
        btn.onclick = () => {
          const slot = btn.dataset.slot
          Dialog.close()
          const result = RestraintSystem.struggle(slot)
          if (result.msg) EventBus.emit('ui:log', { text: result.msg, type: result.ok ? 'good' : 'danger' })
          // 无论成败都消耗本回合
          if (!tickPlayerTurn()) return
          doEnemyTurn()
        }
      })
    })
  }

  /** 车队束缚在上锁前有独立的两回合挣脱窗口。 */
  function doCaravanStruggle () {
    const pending = typeof BattleSystem.caravanPendingBindings === 'function' ? BattleSystem.caravanPendingBindings() : []
    if (!pending.length) { showPlayerTurn(); return }
    const html = pending.map(binding => {
      const target = Math.min(6, 3 + Number(binding.stage || 0))
      return `<button class="restr-struggle-opt" data-caravan-slot="${binding.slot}"><i>${binding.icon || '⛓️'}</i><span><b>${binding.label}</b><small>还有 ${binding.remaining} 回合 · 掷出 ${target}~6 挣开</small></span></button>`
    }).join('')
    Dialog.show({
      title: '⏳ 锁扣尚未咬死',
      className: 'inventory-modal restraint-modal',
      body: `<div class="restr-struggle-pick">${html}</div><p class="camp-footnote">挣脱会消耗本回合。失败后倒计时继续；第四件锁死时会直接被车队俘获。</p>`,
      actions: [{ label: '取消', handler: () => { Dialog.close(); showPlayerTurn() } }],
    })
    Dialog.onMount(root => {
      root.querySelectorAll('[data-caravan-slot]').forEach(btn => {
        btn.onclick = () => {
          Dialog.close()
          BattleSystem.struggleCaravanBinding(btn.dataset.caravanSlot)
          if (!tickPlayerTurn()) return
          doEnemyTurn()
        }
      })
    })
  }

  /** 攻击、防御和跳过都会消耗一个玩家回合并推进状态。 */
  function tickPlayerTurn () {
    // 定时锁：战斗回合同样递减
    if (typeof RestraintSystem !== 'undefined') RestraintSystem.tickTimers()
    if (typeof BattleSystem.tickCaravanBindings === 'function' && !BattleSystem.tickCaravanBindings()) return false
    StatusSystem.tickInBattle()
    if (State.get().hp <= 0) {
      BattleSystem.end(false)
      return false
    }
    return State.get().phase === 'battle'
  }

  function doSurrender () {
    const state = State.get()
    const enemy = _enemy
    const sur = enemy && enemy.surrender

    // BOSS 或无法投降的怪：不能投降
    if (!sur) {
      EventBus.emit('ui:log', { text: '🏳️ 对方不接受投降！', type: 'danger' })
      doEnemyTurn()
      return
    }

    const tribute = sur.tribute || 0
    const hasGold = state.gold >= tribute

    const hum = sur.humiliation || {}
    const humCost = hum.dmg ? `（损失 ${hum.dmg} HP${hum.status ? ' + 状态' : ''}）` : ''

    const tributeBtn = hasGold
      ? `<button class="battle-choice sur-tribute">
           <b>💰 上贡 ${tribute} 金</b>
           <span>付钱让 ${enemy.name} 放你走</span>
         </button>`
      : `<p class="battle-choice-unavailable">💰 金币不足（需要 ${tribute} 金）</p>`

    Dialog.show({
      title: '🏳️ 投降',
      className: 'battle-choice-modal',
      body: `
        <section class="scene-dialogue"><i>🏳️</i><div><h3>你放低武器，等待 ${enemy.name} 回应。</h3><p>它给了你两条活着离开的路。</p></div></section>
        <div class="battle-choice-list">
          ${tributeBtn}
          <button class="battle-choice sur-humiliate">
            <b>🥵 接受羞辱任务</b>
            <span>${hum.desc || '承受羞辱'}</span>
            <em>${humCost}</em>
          </button>
        </div>
      `,
      actions: [{ kind: 'navigation', label: '继续战斗', handler: () => Dialog.close() }],
    })

    Dialog.onMount(root => {
      const tBtn = root.querySelector('.sur-tribute')
      if (tBtn) tBtn.onclick = () => {
        const s = State.get()
        s.gold -= tribute
        EventBus.emit('ui:log', { text: `🏳️ 你上贡 ${tribute} 金币，${_enemy.name} 放你走了。`, type: 'good' })
        EventBus.emit('state:changed', s)
        Dialog.close()
        doSurrenderEnd()
      }
      const hBtn = root.querySelector('.sur-humiliate')
      if (hBtn) hBtn.onclick = () => {
        Dialog.close()
        // 羞辱任务：惩罚伤害 + 状态
        const s = State.get()
        const dmg = hum.dmg || 0
        if (dmg > 0) {
          s.hp -= dmg
          EventBus.emit('ui:log', { text: `🥵 你承受了羞辱，损失 ${dmg} HP。`, type: 'danger' })
        }
        if (hum.status) {
          StatusSystem.apply(hum.status, hum.turns || 2)
          const stDef = STATUS_EFFECTS[hum.status]
          if (stDef) EventBus.emit('ui:log', { text: `${stDef.icon} 你获得了 ${stDef.name} 状态！`, type: 'danger' })
        }
        EventBus.emit('ui:log', { text: `🏳️ 你完成羞辱任务，${_enemy.name} 放你走了。`, type: 'good' })
        EventBus.emit('state:changed', s)
        if (s.hp <= 0) {
          BattleSystem.end(false)
          return
        }
        doSurrenderEnd()
      }
    })
  }

  /** 投降结束战斗（强制成功，类似逃跑成功，退回来源格） */
  function doSurrenderEnd () {
    Dialog.close()
    BattleSystem.flee(true)   // 强制成功，触发 battle:end 退回来源格
    GameFlow.afterEvent()     // 恢复移动界面
  }

  async function playerAttack () {
    const hint = document.getElementById('action-hint')
    const btns = document.getElementById('action-buttons')

    const targets = BattleSystem.getTargets()

    // 多目标：选目标再攻击
    if (targets.length > 1) {
      btns.innerHTML = ''
      hint.textContent = '🎯 选择攻击目标'

      btns.innerHTML = targets.map(t =>
        `<button class="btn" data-target="${t.id}">${t.name} (HP ${t.hp}/${t.maxHp})</button>`
      ).join('') + '<button class="btn btn-danger" id="btn-cancel-target">取消</button>'

      btns.querySelectorAll('[data-target]').forEach(btn => {
        btn.onclick = () => {
          doRollAttack(btn.dataset.target)
        }
      })
      document.getElementById('btn-cancel-target').onclick = showPlayerTurn
      return
    }

    doRollAttack('main')
  }

  async function doRollAttack (targetId) {
    const hint = document.getElementById('action-hint')
    const btns = document.getElementById('action-buttons')
    btns.innerHTML = ''
    hint.textContent = '🎲 掷骰中……'

    // 攻击同样消耗 1 回合：定时锁 + 状态计时递减
    if (typeof RestraintSystem !== 'undefined') RestraintSystem.tickTimers()
    if (typeof BattleSystem.tickCaravanBindings === 'function' && !BattleSystem.tickCaravanBindings()) return
    StatusSystem.tickInBattle()

    // 状态伤害（中毒/再生反转）可能让玩家死亡，先检查
    if (State.get().hp <= 0) {
      hint.textContent = '💀 你在攻击前倒下了……'
      BattleSystem.end(false)
      return
    }

    const roll = Dice.rollAttack()
    try {
      await Dialog.showDice(roll, 'Y')
    } catch (e) {
      console.error('骰子动画异常:', e)
    }

    // 攻击结算：异常时恢复玩家回合，避免硬卡
    let result = null
    try {
      result = BattleSystem.playerAttack(targetId, roll)
    } catch (e) {
      console.error('攻击结算异常:', e)
      hint.textContent = '⚠️ 结算出错，请重试。'
      btns.innerHTML = `<button class="btn btn-primary" id="btn-retry">🔄 重试</button>`
      document.getElementById('btn-retry').onclick = () => doRollAttack(targetId)
      return
    }
    if (!result) {
      // 结算返回空（如战斗已结束/状态异常），确保界面恢复
      if (State.get().phase === 'battle' && State.get()._battle) showPlayerTurn()
      return
    }

    let msg = ''
    if (result.stunned) msg = '⚡ 你被眩晕了，无法攻击！'
    else if (result.hitSelf) msg = `🌀 混乱中你打中了自己！-${result.dmg} HP`
    else if (result.vibrationDistracted) msg = `${result.vibrationMode === 'high' ? '⚡' : '〰️'} ${result.vibrationName || '震动装备'}突然加速，你分心打空了！`
    else if (result.miss) msg = '❌ 未命中！'
    else if (result.crit) msg = `🔥 暴击！${result.target?.name || '敌人'} 受到 ${result.dmg} 点伤害！`
    else msg = `⚔️ 命中！${result.target?.name || '敌人'} 受到 ${result.dmg} 点伤害`

    EventBus.emit('ui:log', { text: `[玩家] ${msg}`, type: result.hitSelf ? 'danger' : result.crit ? 'good' : result.miss ? 'dim' : '' })

    if (State.get().phase === 'idle') return

    // 额外攻击次数（双敌陷阱）：每回合可攻击多次，用完才轮到敌人
    const battle = State.get()._battle
    if (battle && battle.extraAttacks > 1) {
      battle.extraAttacksUsed = (battle.extraAttacksUsed || 0) + 1
      if (battle.extraAttacksUsed < battle.extraAttacks) {
        EventBus.emit('ui:log', { text: `⚔️ 剩余 ${battle.extraAttacks - battle.extraAttacksUsed} 次攻击机会`, type: 'good' })
        showPlayerTurn()
        return
      }
    }

    doEnemyTurn()
  }

  /* ============ 敌人任务系统（计时器 + 节拍器） ============ */

  async function doBanditAmbush () {
    const battle = State.get() && State.get()._battle
    if (!battle || !_enemy) {
      showPlayerTurn()
      return
    }
    battle.banditAmbushPending = false
    battle.banditAmbushStrike = true
    await doEnemyTurn()
  }

  async function doEnemyTurn () {
    const hint = document.getElementById('action-hint')
    const btns = document.getElementById('action-buttons')
    btns.innerHTML = ''
    hint.textContent = `🎲 ${_enemy.name} 的回合……`

    // 进入敌人回合：重置本回合额外攻击计数（双敌每回合都生效）和物品使用标记
    const _battle = State.get() && State.get()._battle
    if (_battle) {
      _battle.extraAttacksUsed = 0
      _battle.itemUsedThisTurn = false
    }

    const ambushStrike = !!(_battle && _battle.banditAmbushStrike)
    if (ambushStrike) _battle.banditAmbushStrike = false
    if (!ambushStrike) {
      const abilityTurn = EnemyAbilitySystem.beginEnemyTurn(_enemy, _battle)
      if (abilityTurn.action === 'escaped') return
      if (abilityTurn.action === 'wait') {
        hint.textContent = abilityTurn.hint
        setTimeout(() => {
          if (State.get().phase === 'battle') showPlayerTurn()
        }, 450)
        return
      }
    }

    // BOSS战：森林之灵召唤敌人攻击
    if (_enemy.props && _enemy.props.isBoss) {
      await doBossTurn()
      return
    }

    const roll = ambushStrike ? 1 : Dice.rollEnemy()
    if (!ambushStrike) await Dialog.showDice(roll, 'Z')

    const enemy = DATA.monster(_enemy.id)
    let attack = enemy.attacks.find(a => a.roll === roll) || { name: '普通攻击', desc: '攻击了你', dmg: 0 }
    if (_battle?.story === 'commission-provoked' && attack.provoked) attack = { ...attack, ...attack.provoked }
    // 强盗头目蓄力完成后固定使用标志性处刑；对应喽啰倒下后，群体招式会切成头目单人版本。
    if (_battle?.enemyState?.chargeStrike && enemy.props?.chargedAttack) {
      attack = { ...enemy.props.chargedAttack }
    } else if (attack.special === 'bandit_rotate' && attack.rotate) {
      const living = 1 + (_battle.targets || []).filter(target => target.type === 'bandit').length
      const rotated = attack.rotate[Math.max(1, Math.min(3, living))] || attack.rotate[1] || attack.solo
      if (rotated) attack = { ...rotated, roll: attack.roll, special: attack.special }
    } else if (attack.requiresCrew) {
      const crewAlive = attack.requiresCrew === true
        ? _battle.targets.some(target => target.type === 'bandit')
        : _battle.targets.some(target => target.id === attack.requiresCrew)
      if (!crewAlive && attack.solo) attack = { ...attack.solo, roll: attack.roll }
    }
    // 扒手第一次搜赃会真正剥走衣服；之后改用不重复脱衣的搜赃文案。
    if (enemy.id === 'p_bandit_leader' && attack.special === 'steal') {
      if (StatusSystem.has('naked') && attack.repeat) {
        attack = { ...attack, ...attack.repeat }
      } else if (!StatusSystem.has('naked')) {
        StatusSystem.apply('naked', 99999, { source: 'p_bandit_cutpurse' })
        _battle.banditClothesTaken = true
        EventBus.emit('ui:log', { text: '👙 翻箱扒手割断衣带，将衣物扔进桥洞的赃物堆。', type: 'danger' })
        State.save()
      }
    }
    // 车队编号示众：第一次收走衣物并施加持续全裸；同一战斗再次触发时改用二次验货动作。
    if (enemy.id === 'p_caravan_guard' && roll === 5) {
      const alreadyDisplayed = Number(_battle?.caravanDisplayCount || 0) > 0
      const alreadyNaked = StatusSystem.has('naked')
      if ((alreadyDisplayed || alreadyNaked) && attack.repeat) {
        attack = { ...attack, ...attack.repeat }
      } else if (!alreadyNaked) {
        StatusSystem.apply('naked', 99999, { source: 'p_caravan_guard' })
        _battle.caravanClothesTaken = true
        State.get()._pCaravanClothesAwaitingRecovery = true
        EventBus.emit('ui:log', { text: '👙 车队看守收走了你的全部衣物；击败他后才能在桥边找回。', type: 'danger' })
      }
      if (_battle) _battle.caravanDisplayCount = Number(_battle.caravanDisplayCount || 0) + 1
      State.save()
    }
    //派克车队看守的两个专属机制不走通用 BPM 任务流程。
    if (enemy.id === 'p_caravan_guard' && attack.special === 'caravan_search') {
      _lastEnemyAttack = { attack, roll, part: 'inventory', actor: _enemy.name }
      EventBus.emit('ui:log', { text: `[${_enemy.name}] ${attack.desc}`, type: 'danger' })
      await resolveCaravanSearch(attack)
      applyEnemyDamage(false)
      return
    }
    if (enemy.id === 'p_caravan_guard' && attack.special === 'caravan_restraint') {
      _lastEnemyAttack = { attack, roll, part: 'body', actor: _enemy.name }
      EventBus.emit('ui:log', { text: `[${_enemy.name}] ${attack.desc}`, type: 'danger' })
      const nextBinding = BattleSystem.peekCaravanBinding()
      if (nextBinding) await showCaravanRestraintTask(nextBinding)
      if (State.get().phase !== 'battle' || !State.get()._battle) return
      const result = BattleSystem.applyCaravanBinding()
      if (State.get().phase !== 'battle' || !State.get()._battle) return
      await showCaravanBinding(result)
      applyEnemyDamage(false)
      return
    }
    // 贞操装置：小穴/撸管/寸止任务强制改为肛交；否则女性角色 Z4-6 操菊穴改为操小穴
    if (attack.genderedPart && State.get().gender !== 'male' && attack.part === 'anal' && !ChastitySystem.isWorn()) {
      attack = { ...attack, part: 'vagina', desc: (attack.desc || '').replace(/菊穴/g, '小穴') }
    }
    const chRes = ChastitySystem.resolveAttack(attack)
    let effAttack = chRes.attack
    let attackPart = attack.part || chRes.part
    if (!chRes.chastity && State.get().gender !== 'male' && attackPart === 'anal' && roll >= 4) {
      effAttack = { ...attack, desc: attack.desc.replace(/菊穴/g, '小穴'), name: attack.name }
      attackPart = 'vagina'
    }
    if (!attackPart && /口交|深喉|吞吐|口穴|嘴穴|操嘴/.test(effAttack.desc || '')) attackPart = 'oral'

    // 第一阶段：普通怪物发现目标部位被挡住时，尝试拔出、改换部位或打屁股。
    let chargedBlocked = false
    if (typeof RestraintSystem !== 'undefined') {
      const originalTiming = getTaskTiming(effAttack)
      const targetResult = RestraintSystem.resolveMonsterOrifice(attackPart)
      targetResult.events.forEach(text => EventBus.emit('ui:log', { text, type: text.startsWith('💥') ? 'danger' : 'good' }))
      if (targetResult.mode === 'blocked') {
        chargedBlocked = true
        effAttack = { ...effAttack, dmg: 0, status: null, special: null, turns: 0, level: 0 }
      } else if (targetResult.mode === 'redirect') {
        EventBus.emit('battle:redirect', { from: attackPart, to: targetResult.part, enemyId: enemy.id })
        const partName = { oral: '嘴穴', anal: '菊穴', vagina: '小穴' }[targetResult.part]
        effAttack = {
          ...effAttack,
          name: `${effAttack.name} · 改攻${partName}`,
          desc: `${enemy.name}发现原本的部位无法使用，立刻改为攻击你的${partName}；攻击强度与持续时间不变。`,
          special: null,
          taskBpm: originalTiming.bpm,
          taskSeconds: originalTiming.seconds,
          taskSequence: null,
          secondaryPart: null,
        }
        attackPart = targetResult.part
      } else if (targetResult.mode === 'spank') {
        effAttack = {
          ...effAttack,
          name: '打屁股',
          desc: `${enemy.name}找不到能使用的部位，只好把你按住狠狠打屁股。`,
          status: null,
          special: null,
          turns: 0,
          level: 0,
          taskBpm: originalTiming.bpm,
          taskSeconds: originalTiming.seconds,
          taskSequence: null,
          secondaryPart: null,
        }
        attackPart = 'body'
      }
      attack = effAttack
    }
    // 双部位招式的口部被封口装备挡住时，只保留插入部分，不生成不可能完成的深喉任务。
    if (effAttack.secondaryPart === 'oral' && typeof RestraintSystem !== 'undefined' && RestraintSystem.hasGag()) {
      effAttack = {
        ...effAttack,
        secondaryPart: null,
        name: `${effAttack.name} · 口部受阻`,
        desc: `${effAttack.desc} 口塞封住嘴，正面的深喉被取消，只结算插入动作。`,
        taskSteps: (effAttack.taskSteps || []).map(step => ({ ...step, text: String(step.text || '').replace(/同时进行深喉|正面深喉|口部用具/g, '保持插入动作') })),
      }
      attack = effAttack
    }
    // 即使攻击被充能装备挡住，也要消耗已经完成的蓄力，避免重击延续到下一回合。
    effAttack = EnemyAbilitySystem.modifyEnemyAttack(enemy, _battle, effAttack)
    attack = effAttack
    const actingEnemyName = effAttack.actor || _enemy.name
    _lastEnemyAttack = { attack: effAttack, roll, part: attackPart, actor: actingEnemyName }

    EventBus.emit('ui:log', { text: `[${actingEnemyName}] ${effAttack.desc}`, type: 'danger' })

    if (chargedBlocked) {
      applyEnemyDamage(false, { chargeBlocked: true })
      return
    }

    // 口塞：口交/深喉类攻击做不了，硬挨一记（单倍伤害，不翻倍）
    if (typeof RestraintSystem !== 'undefined' && RestraintSystem.hasGag() && attackPart === 'oral') {
      EventBus.emit('ui:log', { text: '🤐 口塞堵着嘴，你没法完成口交任务，硬挨了一记（单倍伤害）。', type: 'danger' })
      applyEnemyDamage(false)
      return
    }

    // 哥布林深插：每只哥布林各干 15 秒（120 BPM）
    if (attack.special === 'goblin_deep') {
      const gobCount = State.get()._battle.targets.filter(t => t.type === 'goblin').length
      const secondsPerGob = attack.taskSeconds || 15
      const bpm = attack.taskBpm || 120

      EventBus.emit('ui:log', { text: `👺 ${gobCount} 只哥布林轮流深插你，每只 ${secondsPerGob} 秒（${bpm} BPM）！`, type: 'danger' })

      let anyFailed = false
      for (let i = 1; i <= gobCount; i++) {
        const failed = await showTaskDialog({
          enemyName: `哥布林 ${i}/${gobCount}`,
          attackName: attack.name,
          desc: `第 ${i} 只哥布林深插你的${ChastitySystem.orifice(roll)}，120 BPM`,
          bpm,
          seconds: secondsPerGob,
          dmg: attack.dmg,   // 显示总伤害，与最终结算一致
          dildoName: DildoSystem.describe('goblins'),
          telemetry: StatsSystem.taskMeta(_enemy.id, roll, _lastEnemyAttack.part),
        })
        if (failed) anyFailed = true
      }

      applyEnemyDamage(anyFailed)
      return
    }

    // 哥布林轮换双插：每 10 秒顺时针轮换，直到所有哥布林都干过两个洞
    if (attack.special === 'goblin_rotate') {
      const gobCount = State.get()._battle.targets.filter(t => t.type === 'goblin').length
      // 轮数 = 哥布林数（每轮 2 只轮流，N 轮覆盖每只×两个洞）
      const roundCount = Math.max(2, gobCount)
      const secondsPerRound = attack.taskSecondsPerRound || 10
      const bpm = attack.taskBpm || 120

      EventBus.emit('ui:log', { text: `👺 哥布林轮换双插：每 ${secondsPerRound} 秒顺时针轮换，共 ${roundCount} 轮！`, type: 'danger' })

      let anyFailed = false
      for (let i = 1; i <= roundCount; i++) {
        const g1 = ((i - 1) % gobCount) + 1      // 插屁眼
        const g2 = (i % gobCount) + 1            // 口交
        const failed = await showTaskDialog({
          enemyName: `哥布林轮换 ${i}/${roundCount}`,
          attackName: attack.name,
          desc: `哥布林${g1} 浅插${ChastitySystem.orifice(roll)}，哥布林${g2} 口交，120 BPM`,
          bpm,
          seconds: secondsPerRound,
          dmg: attack.dmg,   // 显示总伤害，与最终结算一致
          status: attack.status,
          statusTurns: attack.turns,
          dildoName: DildoSystem.describe('goblins'),
          telemetry: StatsSystem.taskMeta(_enemy.id, roll, _lastEnemyAttack.part),
        })
        if (failed) anyFailed = true
      }

      applyEnemyDamage(anyFailed)
      return
    }

    // 哥布林偷袭休息：半数哥布林（向上取整）轮流干你
    if (attack.special === 'goblin_rest') {
      const gobCount = State.get()._battle.targets.filter(t => t.type === 'goblin').length
      const repeatCount = Math.ceil(gobCount / 2)
      const randSeconds = Math.floor(Math.random() * (attack.taskTimeMax - attack.taskTimeMin + 1)) + attack.taskTimeMin

      EventBus.emit('ui:log', { text: `👺 ${gobCount} 只哥布林 → 半数（向上取整）=${repeatCount} 只轮流干你！`, type: 'danger' })

      let anyFailed = false
      for (let i = 1; i <= repeatCount; i++) {
        const failed = await showTaskDialog({
          enemyName: `${enemy.name} ${i}/${repeatCount}`,
          attackName: attack.name,
          desc: `第 ${i} 只哥布林：${ChastitySystem.convertDesc(attack.desc, roll)}`,
          bpm: attack.taskBpm || 60,
          seconds: randSeconds,
          dmg: attack.dmg,   // 显示总伤害，与最终结算一致
          status: attack.status,
          statusTurns: attack.turns,
          dildoName: DildoSystem.describe('goblins'),
          telemetry: StatsSystem.taskMeta(_enemy.id, roll, _lastEnemyAttack.part),
        })
        if (failed) anyFailed = true
      }

      applyEnemyDamage(anyFailed)
      return
    }

    // 魅魔狂暴：所有干插一插到底 + 速度加快 50%；套弄改用松握
    let effDesc = attack.desc
    let effBpmSrc = attack.desc
    if (_enemy.id === 'succubus' && State.get()._battle && State.get()._battle.enraged) {
      const bpmMatch = attack.desc.match(/(\d+)\s*BPM/)
      if (bpmMatch) {
        const newBpm = Math.round(parseInt(bpmMatch[1]) * 1.5)
        effDesc = attack.desc.replace(/(\d+)\s*BPM/, newBpm + ' BPM')
        effBpmSrc = effDesc
      }
      if (attack.special === 'drain_self' || attack.name === '吸取') {
        effDesc = '用手套弄自己的鸡巴（狂暴下改用松握）直到快要射精就停下（寸止），从中吸收 1 HP。你 -1 HP，她 +1 HP'
      }
      EventBus.emit('ui:log', { text: '😈 魅魔狂暴：干插一插到底、速度 +50%，套弄改松握！', type: 'danger' })
    }

    // 解析 BPM 和秒数
    const timing = getTaskTiming({ ...attack, desc: effBpmSrc })
    const bpm = timing.bpm
    const seconds = timing.seconds

    // 纯状态攻击（无动作、无伤害，只施加状态）：直接确认，不进入任务流程
    if (attack.dmg === 0 && bpm === 0 && attack.status) {
      await showStatusConfirm(attack)
      applyEnemyDamage(false)
      return
    }

    // 复合任务按顺序执行，但只在整招结束后结算一次伤害与特殊效果。
    if (Array.isArray(attack.taskSequence) && attack.taskSequence.length) {
      let sequenceFailed = false
      for (let i = 0; i < attack.taskSequence.length; i++) {
        const step = attack.taskSequence[i]
        const failedStep = await showTaskDialog({
          enemyName: `${actingEnemyName}（${i + 1}/${attack.taskSequence.length}）`,
          attackName: step.name || attack.name,
          desc: step.desc || attack.desc,
          bpm: Number(step.bpm) || 0,
          seconds: Number(step.seconds) || 0,
          taskCount: Number(step.count) || 0,
          taskTool: step.tool || '',
          dmg: 0,
          noDamage: true,
          allowSkip: false,
          showFailure: true,
          completeLabel: '✅ 完成这一段',
          dialogTitle: `⚔️ 敌方行动：${attack.name}`,
        })
        if (failedStep) { sequenceFailed = true; break }
      }
      applyEnemyDamage(sequenceFailed)
      return
    }

    // 显示任务弹窗
    const failed = await showTaskDialog({
      enemyName: actingEnemyName,
      attackName: attack.name,
      desc: effDesc,
      bpm,
      seconds,
      dmg: attack.dmg,
      status: attack.status,
      statusTurns: attack.turns,
      taskSteps: attack.taskSteps,
      taskCount: attack.taskCount,
      taskTool: attack.taskTool,
      dildoName: _enemy.props?.storyEncounter ? '' : DildoSystem.describe(_enemy.id),
      allowSkip: !_enemy.props?.storyEncounter,
      showFailure: !_enemy.props?.storyEncounter || !!_enemy.props?.adultCombatTasks,
      completeLabel: _enemy.props?.adultCombatTasks ? '✅ 完成动作' : _enemy.props?.storyEncounter ? '继续战斗' : '✅ 完成任务',
      dialogTitle: _enemy.props?.storyEncounter ? `⚔️ 敌方行动：${attack.name}` : '',
      telemetry: _enemy.props?.storyEncounter && !_enemy.props?.adultCombatTasks ? null : StatsSystem.taskMeta(_enemy.id, roll, _lastEnemyAttack.part),
    })

    // 断触手：敌人实际插入（有操弄动作的任务）时替换掉假阴茎
    const stt = State.get()
    if (stt && stt.statuses.some(s => s.id === 'tentacle_embedded') && attack.dmg > 0) {
      stt.statuses = stt.statuses.filter(s => s.id !== 'tentacle_embedded')
      EventBus.emit('ui:log', { text: '🍑 敌人插入时替换了断触手，假阴茎滑出。', type: 'good' })
      EventBus.emit('state:changed', stt)
    }

    // 兽人锁喉：憋不住气则双倍伤害 + 困倦 5 回合
    if (attack.special === 'choke') {
      const held = await askChokeBreath()
      if (held) {
        applyEnemyDamage(failed)
      } else {
        applyEnemyDamage(failed, { chokeFail: true })
      }
      return
    }

    applyEnemyDamage(failed)
  }

  /** 强制搜身先按妖缚状态处理检查部位，再在物品、金币和车队欠条之间结算。 */
  async function resolveCaravanSearch (attack) {
    const state = State.get()
    let inspectionPart = attack.inspectionPart || 'anal'
    if (typeof RestraintSystem !== 'undefined') {
      const target = RestraintSystem.resolveMonsterOrifice(inspectionPart)
      target.events.forEach(text => EventBus.emit('ui:log', { text, type: text.startsWith('💥') ? 'danger' : 'good' }))
      if (target.mode === 'blocked') {
        await showCaravanSearchNotice(attack, '🛡️', '穴被锁住', '妖缚装置挡住了腔道。看守骂了一句，改成把你按在栏杆上抽打，打完仍要翻你的东西。')
      } else if (target.mode === 'spank') {
        await showTaskDialog({
          enemyName: _enemy.name,
          attackName: `${attack.name} · 打到开口`,
          desc: '能插的地方都被锁死。看守把你按在断栏上，用手掌抽打臀部二十下。每一下都要报数，腰不许躲，打完把屁股继续翘着接受搜查。',
          bpm: 0, seconds: 0, taskCount: 20, taskTool: '手掌', dmg: 0, noDamage: true, showFailure: false, allowSkip: false,
        })
      } else {
        inspectionPart = target.part || inspectionPart
        const partName = { oral: '嘴穴', anal: '菊穴', vagina: '小穴' }[inspectionPart] || '身体'
        const two = (attack.searchTier || 1) > 1
        await showTaskDialog({
          enemyName: _enemy.name,
          attackName: `${attack.name} · 掰开受查`,
          desc: two
            ? `两人把你按在桥栏上。一个用手指撑开${partName}往里翻，另一个按着你的后颈不让你抬头。按 110 BPM 把腰送上去 30 秒，每插一下都要出声，夹紧或躲开就从头再来。`
            : `看守用两根手指直接插进${partName}里翻搅，另一只手按住你的腰。按 100 BPM 自行迎合 25 秒，嘴里报数，手只能掰着自己，不许挡。`,
          bpm: two ? 110 : 100,
          seconds: two ? 30 : 25,
          dmg: 0, noDamage: true, showFailure: false, allowSkip: false,
        })
      }
    }
    const inventory = state.inventory.consumables || {}
    const ordinaryItems = Object.keys(inventory).filter(id => {
      if (inventory[id] <= 0) return false
      const item = DATA.item(id)
      return item && item.type === 'consumable' && !(item.effect && item.effect.special)
    })
    const tier = Math.max(1, Number(attack.searchTier) || 1)
    const choices = ordinaryItems.length ? ['item', 'gold', 'debt'] : ['gold', 'debt']
    let kind = choices[Math.floor(Math.random() * choices.length)]
    if (kind === 'gold' && state.gold <= 0) kind = 'debt'

    let icon = '🧾'
    let title = '车队欠条'
    let detail = ''
    if (kind === 'item') {
      const id = ordinaryItems[Math.floor(Math.random() * ordinaryItems.length)]
      const item = DATA.item(id)
      inventory[id]--
      if (inventory[id] <= 0) delete inventory[id]
      icon = '🎒'
      title = `${item.name}被扣下`
      detail = `看守把${item.name}塞进自己的腰包，宣称这是“车队遗失物”。`
    } else if (kind === 'gold') {
      const wanted = tier > 1 ? 15 + Math.floor(Math.random() * 11) : 5 + Math.floor(Math.random() * 11)
      const taken = Math.min(state.gold, wanted)
      state.gold -= taken
      icon = '🪙'
      title = `${taken}G 被没收`
      detail = '看守把钱袋在手里掂了掂，只留下一句“搜查费”。'
    } else {
      const debt = tier > 1 ? 40 : 20
      state._pCaravanDebt = Math.max(0, Number(state._pCaravanDebt) || 0) + debt
      title = `被记下 ${debt}G 车队债务`
      detail = `看守在货单背面写下你的名字。车队现在声称你共欠 ${state._pCaravanDebt}G。`
    }
    EventBus.emit('ui:log', { text: `${icon} ${title}。`, type: 'danger' })
    EventBus.emit('state:changed', state)
    State.save()

    return new Promise(resolve => {
      Dialog.show({
        title: `🔎 ${attack.name}`,
        className: 'battle-choice-modal',
        body: `<section class="scene-dialogue"><i>${icon}</i><div><h3>${title}</h3><p>${detail}</p></div></section>`,
        actions: [{ label: '继续战斗', cls: 'btn-primary', handler: () => { Dialog.close(); resolve() } }],
      })
    })
  }

  function showCaravanSearchNotice (attack, icon, title, detail) {
    return new Promise(resolve => {
      Dialog.show({
        title: `🔎 ${attack.name}`,
        className: 'battle-choice-modal',
        body: `<section class="scene-dialogue"><i>${icon}</i><div><h3>${title}</h3><p>${detail}</p></div></section>`,
        actions: [{ label: '继续搜查', cls: 'btn-primary', handler: () => { Dialog.close(); resolve() } }],
      })
    })
  }

  function showCaravanRestraintTask (binding) {
    const extra = State.get()._battle?.story === 'commission-provoked' ? 5 : 0
    const held = extra ? '旁边的人按着你，这段再加五秒。' : ''
    const tasks = {
      neck: {
        name: '奴隶项圈',
        bpm: 60,
        seconds: 20 + extra,
        desc: `跪直，下巴抬起，双手背到身后。按 60 BPM 保持这个姿势，让看守检查奴隶项圈。${held}`,
      },
      arms: {
        name: '手铐',
        bpm: 0,
        seconds: 20 + extra,
        desc: `手腕交叉到背后，膝盖分开，保持被铐住的姿势。不能用手撑地。${held}`,
      },
      mouth: {
        name: '球形口塞',
        bpm: 90,
        seconds: 20 + extra,
        desc: `先按 90 BPM 含住，每八拍停在最深处一拍。这一段结束才戴上球形口塞。${held}`,
      },
      anal: {
        name: '小肛塞',
        bpm: 120,
        seconds: 25 + extra,
        desc: `按 120 BPM 自行把小肛塞纳入，停住后让它留在里面。${held}`,
      },
    }
    const task = tasks[binding.slot]
    if (!task) return Promise.resolve()
    return showTaskDialog({
      enemyName: '车队看守',
      attackName: task.name,
      desc: task.desc,
      bpm: task.bpm,
      seconds: task.seconds,
      dmg: 0,
      noDamage: true,
      allowSkip: false,
      showFailure: true,
      completeLabel: '✅ 戴上',
      dialogTitle: `⛓️ ${task.name}`,
    })
  }

  function showCaravanBinding (result) {
    if (!result || !result.ok || !result.binding) return Promise.resolve()
    const binding = result.binding
    const battle = State.get()._battle
    const locked = battle && Array.isArray(battle.caravanBindings) ? battle.caravanBindings.filter(entry => entry.locked).length : 0
    return new Promise(resolve => {
      Dialog.show({
        title: `${binding.icon || '⛓️'} ${binding.label}`,
        className: 'battle-choice-modal',
        body: `<section class="scene-dialogue"><i>⏳</i><div><h3>锁扣开始收紧</h3><p>再消耗 2 个行动回合，${binding.label}就会彻底上锁。下个玩家回合会出现“挣开车队束缚”。</p></div></section>
          <div class="wrong-letter-evidence"><span>车队束缚</span><p>已锁 ${locked}/4 · 第 4 件上锁时自动战败并被押走。</p></div>`,
        actions: [{ label: '继续战斗', cls: 'btn-danger', handler: () => { Dialog.close(); resolve() } }],
      })
    })
  }

  /** 纯状态攻击确认框（如再生之吻，无动作直接确认） */
  function showStatusConfirm (attack) {
    return new Promise(resolve => {
      const stDef = STATUS_EFFECTS[attack.status]
      const stName = stDef ? stDef.name : attack.status
      const stIcon = stDef ? stDef.icon : '❓'
      const stDesc = stDef && stDef.desc ? stDef.desc : ''
      const turns = attack.turns ? ` ${attack.turns} 回合` : ''
      Dialog.show({
        title: `${stIcon} ${attack.name}`,
        className: 'battle-status-modal',
        body: `
          <section class="scene-dialogue"><i>${stIcon}</i><div><h3>${_enemy.name} ${attack.desc}</h3><p>你被施加了「${stName}」${turns}。</p></div></section>
          <div class="battle-status-result"><b>${stIcon} ${stName}${turns}</b><span>${stDesc}</span></div>
        `,
        actions: [
          { label: '确认', cls: 'btn-primary', handler: () => { Dialog.close(); resolve() } },
        ],
      })
    })
  }

  /** 兽人锁喉：询问是否憋住气 */
  function askChokeBreath () {
    return new Promise(resolve => {
      Dialog.show({
        title: '🫁 锁喉！',
        className: 'battle-choice-modal',
        body: '<section class="scene-dialogue"><i>🫁</i><div><h3>兽人一边深插，一边掐住你的喉咙。</h3><p>胸口的空气正在迅速耗尽。</p></div></section><p class="battle-danger-note">没憋住：伤害双倍，并陷入困倦 5 回合。</p>',
        actions: [
          { label: '✅ 憋住了', cls: 'btn-success', handler: () => { Dialog.close(); resolve(true) } },
          { label: '❌ 没憋住', cls: 'btn-danger', handler: () => { Dialog.close(); resolve(false) } },
        ],
      })
    })
  }

  function parseBpm (desc) {
    const m = desc.match(/(\d+)\s*BPM/)
    return m ? parseInt(m[1]) : 0
  }

  function parseSeconds (desc) {
    const min = desc.match(/(\d+)\s*分/)
    const sec = desc.match(/(\d+)\s*秒/)
    let total = 0
    if (min) total += parseInt(min[1]) * 60
    if (sec) total += parseInt(sec[1])
    return total || 0
  }

  /** 优先读取攻击表里的任务参数，缺省时再从说明文字解析。 */
  function getTaskTiming (attack) {
    const bpm = Number(attack.taskBpm) || parseBpm(attack.desc || '')
    let seconds = Number(attack.taskSeconds) || Number(attack.taskSecondsPerRound) || 0

    if (!seconds && Number.isFinite(attack.taskTimeMin) && Number.isFinite(attack.taskTimeMax)) {
      const min = Math.min(attack.taskTimeMin, attack.taskTimeMax)
      const max = Math.max(attack.taskTimeMin, attack.taskTimeMax)
      seconds = Math.floor(Math.random() * (max - min + 1)) + min
    }

    if (!seconds) seconds = parseSeconds(attack.desc || '')
    return { bpm, seconds }
  }

  /** 显示任务弹窗，返回 true=没完成 false=已完成
   *  allowSkip=false 时隐藏"跳过计时器"；showFailure=false 时隐藏"没完成"；
   *  completeLabel 自定义完成按钮文字；dialogClass 附加弹窗样式类；
   *  refuseLabel 提供"拒绝服务"按钮（点击 resolve 'refuse'） */
  function showTaskDialog ({ enemyName, attackName, desc, bpm, seconds, dmg, status, statusTurns, taskSteps = [], taskCount = 0, taskTool = '', dildoName, noDamage, allowSkip = true, showFailure = true, completeLabel = '✅ 完成任务', dialogTitle = '', dialogClass = '', refuseLabel = '', telemetry = null }) {
    // 同一时间只允许一个任务计时器；新任务会先彻底清掉可能残留的旧任务。
    if (_activeTaskCleanup) _activeTaskCleanup()
    return new Promise(resolve => {
      const hasTimer = seconds > 0
      const hasBpm = bpm > 0
      const requiredCount = Math.max(0, Math.floor(Number(taskCount) || 0))
      let completedCount = 0
      const phases = Array.isArray(taskSteps)
        ? taskSteps.filter(step => step && Number.isFinite(Number(step.at))).map(step => ({ ...step, at: Math.max(0, Number(step.at)) })).sort((a, b) => a.at - b.at)
        : []

      // 构建 debuff 提示
      let statusHtml = ''
      if (status) {
        const stDef = STATUS_EFFECTS[status]
        const stName = stDef ? stDef.name : status
        const stIcon = stDef ? stDef.icon : '❓'
        const stDesc = stDef && stDef.desc ? stDef.desc : ''
        const turns = statusTurns ? ` ${statusTurns} 回合` : ''
        statusHtml = `
          <div style="margin-top:10px;padding:8px 12px;background:var(--panel-2);border:1px solid var(--danger);border-radius:8px;text-align:left">
            <div style="font-weight:700;color:var(--danger)">${stIcon} 你被施加了「${stName}」${turns}！</div>
            <div style="font-size:.8rem;color:var(--text-dim);margin-top:2px">${stDesc}</div>
          </div>`
      }

      let timerValue = seconds
      let timerInterval = null
      let metronomeInterval = null
      let metronomeStartTimer = null
      let started = false
      let running = false
      let done = false
      let metronomeDir = 1
      let audioCtx = null

      const cleanupTask = () => {
        running = false
        stopTimer()
        if (audioCtx) {
          try { audioCtx.close() } catch (_) {}
          audioCtx = null
        }
        if (_activeTaskCleanup === cleanupTask) _activeTaskCleanup = null
      }
      _activeTaskCleanup = cleanupTask

      const finish = failed => {
        cleanupTask()
        if (telemetry && failed !== 'refuse') {
          EventBus.emit('task:complete', {
            ...telemetry,
            bpm: Math.max(0, Number(bpm) || 0),
            seconds: Math.max(0, Number(seconds) || 0),
            count: requiredCount,
            damage: Math.max(0, Number(dmg) || 0),
            completed: failed === false,
          })
        }
        resolve(failed)
      }

      const bodyHtml = `
        <div class="task-container">
          ${attackName && attackName !== desc ? `<p style="margin-bottom:4px"><b>${enemyName}</b> 使用「${attackName}」</p>` : `<p style="margin-bottom:4px"><b>${enemyName}</b></p>`}
          <p style="color:var(--text-dim);font-size:.9rem;margin-bottom:10px">${desc}</p>
          ${phases.length ? `<div class="task-phase" id="task-phase"><small>${phases[0].label || '当前命令'}</small><b>${phases[0].text || ''}</b></div>` : ''}
          ${requiredCount ? `<div class="task-count-card"><span>已完成 / 规定次数</span><strong><b id="task-count-current">0</b><small> / ${requiredCount} 下</small></strong>${taskTool ? `<p>可用：${taskTool}</p>` : ''}<div class="task-count-controls"><button type="button" class="btn" id="task-count-minus" disabled>−1</button><button type="button" class="btn btn-danger" id="task-count-add-one">+1 下</button><button type="button" class="btn btn-danger" id="task-count-add-five">+5 下</button></div><em>按实际完成数量记录；达到规定次数后才能结算</em></div>` : ''}
          ${dildoName ? `<p style="font-size:.85rem;color:var(--gold);margin-bottom:8px">🍆 当前假阴茎：${dildoName}</p>` : ''}
          ${hasBpm ? `
            <div class="metronome-area">
              <div class="bpm-label">${bpm} BPM</div>
              <div class="metronome-visual">
                <div class="metronome-base"></div>
                <div class="metronome-pendulum" id="metronome-pendulum"></div>
              </div>
            </div>
          ` : ''}
          ${hasTimer ? `
            <div class="timer-area">
              <div class="timer-display" id="timer-display">${formatTime(seconds)}</div>
              <div class="timer-bar-track"><div class="timer-bar-fill" id="timer-fill"></div></div>
            </div>
          ` : ''}
          ${statusHtml}
          ${noDamage ? '' : `<div class="task-dmg">伤害: <span style="color:var(--danger)">${dmg} HP</span></div>`}
        </div>
      `

      // 无 BPM 也无计时器：不需要"开始任务"，直接确认完成/没完成
      const actions = (!hasTimer && !hasBpm) ? [
        {
          label: completeLabel,
          cls: 'btn-success',
          disabled: requiredCount > 0,
          handler: () => {
            if (requiredCount && completedCount < requiredCount) return
            Dialog.close(); finish(false)
          },
        },
        ...(showFailure ? [{
          label: '❌ 没完成',
          cls: 'btn-danger',
          handler: () => { Dialog.close(); finish(true) },
        }] : []),
      ] : [
        ...(refuseLabel ? [{
          label: refuseLabel,
          cls: 'btn-danger',
          handler: () => { Dialog.close(); finish('refuse') },
        }] : []),
        {
          label: '▶️ 开始任务',
          cls: 'btn-primary',
          handler: () => {
            if (started) return
            started = true
            beginTask()
          },
        },
      ]

      Dialog.show({
        title: dialogTitle || (attackName && attackName !== desc ? `🎯 任务：${attackName}` : '🎯 任务'),
        body: bodyHtml,
        actions,
        className: dialogClass || undefined,
      })

      if (requiredCount && !hasTimer && !hasBpm) {
        Dialog.onMount(root => {
          const current = root.querySelector('#task-count-current')
          const addOne = root.querySelector('#task-count-add-one')
          const addFive = root.querySelector('#task-count-add-five')
          const minus = root.querySelector('#task-count-minus')
          const complete = root.querySelector('.modal-actions [data-action="0"]')
          const renderCount = () => {
            if (current) current.textContent = String(completedCount)
            if (minus) minus.disabled = completedCount <= 0
            if (addOne) addOne.disabled = completedCount >= requiredCount
            if (addFive) addFive.disabled = completedCount >= requiredCount
            if (complete) complete.disabled = completedCount < requiredCount
          }
          if (addOne) addOne.addEventListener('click', () => { completedCount = Math.min(requiredCount, completedCount + 1); renderCount() })
          if (addFive) addFive.addEventListener('click', () => { completedCount = Math.min(requiredCount, completedCount + 5); renderCount() })
          if (minus) minus.addEventListener('click', () => { completedCount = Math.max(0, completedCount - 1); renderCount() })
          renderCount()
        })
      }

      function beginTask () {
        if (running) return
        running = true
        const layer = document.getElementById('modal-layer')
        const btns = (layer ? layer : document).querySelectorAll('.modal-actions button')
        btns.forEach(b => { if (b.textContent.includes('开始任务') || (refuseLabel && b.textContent.includes(refuseLabel))) b.style.display = 'none' })
        // 添加跳过计时器按钮
        const actionsDiv = (layer ? layer : document).querySelector('.modal-actions')
        if (actionsDiv && hasTimer && allowSkip) {
          const skipBtn = document.createElement('button')
          skipBtn.className = 'btn btn-danger'
          skipBtn.textContent = '⏭ 跳过计时器 (直接结算)'
          skipBtn.onclick = () => { stopTimer(); onTimeUp() }
          actionsDiv.appendChild(skipBtn)
        }

        if (hasTimer) {
          timerInterval = setInterval(() => {
            timerValue--
            updateTimerDisplay()
            if (timerValue <= 0) {
              stopTimer()
              onTimeUp()
            }
          }, 1000)
        } else {
          onTimeUp()
        }

        if (hasBpm) {
          const intervalMs = Math.round(60000 / bpm)
          // 先往右摆
          metronomeStartTimer = setTimeout(() => {
            metronomeStartTimer = null
            tickMetronome()
          }, 0)
          metronomeInterval = setInterval(() => {
            tickMetronome()
          }, intervalMs)
        }
      }

      function updateTimerDisplay () {
        const el = document.getElementById('timer-display')
        const fill = document.getElementById('timer-fill')
        if (el) el.textContent = formatTime(Math.max(0, timerValue))
        if (fill && seconds > 0) fill.style.width = ((timerValue / seconds) * 100) + '%'
        updateTaskPhase()
      }

      function updateTaskPhase () {
        if (!phases.length) return
        const elapsed = Math.max(0, seconds - timerValue)
        let active = phases[0]
        for (const phase of phases) {
          if (phase.at <= elapsed) active = phase
          else break
        }
        const phaseEl = document.getElementById('task-phase')
        if (!phaseEl || phaseEl.dataset.at === String(active.at)) return
        phaseEl.dataset.at = String(active.at)
        phaseEl.classList.remove('is-changing')
        void phaseEl.offsetWidth
        phaseEl.innerHTML = `<small>${active.label || '当前命令'}</small><b>${active.text || ''}</b>`
        phaseEl.classList.add('is-changing')
      }

      function tickMetronome () {
        if (!running || done || _activeTaskCleanup !== cleanupTask) return
        const p = document.getElementById('metronome-pendulum')
        if (!p) return
        // 左右摆动
        const angle = metronomeDir * 28
        p.style.transform = `rotate(${angle}deg)`
        metronomeDir *= -1
        // 音效
        playClick()
      }

      function playClick () {
        if (!running || done || _activeTaskCleanup !== cleanupTask) return
        try {
          if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)()
          }
          if (audioCtx.state === 'suspended') audioCtx.resume()
          const now = audioCtx.currentTime
          const osc = audioCtx.createOscillator()
          const gain = audioCtx.createGain()
          osc.connect(gain)
          gain.connect(audioCtx.destination)
          osc.frequency.value = 1200
          osc.type = 'sine'
          gain.gain.setValueAtTime(0.06, now)
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
          osc.start(now)
          osc.stop(now + 0.05)
        } catch(e) {
          // 音频不可用则静默
        }
      }

      function onTimeUp () {
        if (done) return
        done = true
        stopTimer()
        const modalBox = document.querySelector('#modal-layer .modal-box')
        if (!modalBox) { resolve(false); return }
        const actionsDiv = modalBox.querySelector('.modal-actions')
        if (actionsDiv) {
          const failBtn = showFailure
            ? `<button class="btn btn-danger task-finish-btn" data-result="fail">${noDamage ? '❌ 没完成' : '❌ 没完成 (伤害翻倍)'}</button>`
            : ''
          actionsDiv.innerHTML = `
            <button class="btn btn-success task-finish-btn" data-result="complete">${completeLabel}</button>
            ${failBtn}
          `
          actionsDiv.querySelectorAll('.task-finish-btn').forEach(btn => {
            btn.onclick = () => {
              Dialog.close()
              finish(btn.dataset.result === 'fail')
            }
          })
        }
      }

      function stopTimer () {
        running = false
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
        if (metronomeInterval) { clearInterval(metronomeInterval); metronomeInterval = null }
        if (metronomeStartTimer) { clearTimeout(metronomeStartTimer); metronomeStartTimer = null }
        // 复位节拍器
        const p = document.getElementById('metronome-pendulum')
        if (p) p.style.transform = 'rotate(0deg)'
      }
    })
  }

  function formatTime (s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  /* ============ BOSS战：森林之灵 ============ */

  async function doBossTurn () {
    const hint = document.getElementById('action-hint')

    // 掷 Y 决定被召唤的敌人
    const y = Dice.rollAttack()
    const pool = CONFIG.monsters.randomPool || ['tentacle', 'orc', 'sorceress', 'succubus', 'goblins', 'werewolf']
    const idx = Math.min(y - 1, pool.length - 1)
    const summonedId = pool[idx]
    const summoned = DATA.monster(summonedId)

    hint.textContent = `🌲 掷 Y=${y} → 森林之灵召唤了 ${summoned.name}！`
    await Dialog.showDice(y, 'Y')
    EventBus.emit('ui:log', { text: `🌲 森林之灵召唤了 ${summoned.name}（伤害翻倍、状态翻倍）！`, type: 'danger' })

    // 掷 Z 决定被召唤敌人的攻击
    const z = Dice.rollEnemy()
    let attack = summoned.attacks.find(a => a.roll === z) || summoned.attacks[0] || { name: '攻击', desc: '攻击了你', dmg: 0 }
    // 贞操装置：小穴/撸管/寸止任务强制改为肛交；否则女性角色 Z4-6 操菊穴改为操小穴
    const chRes = ChastitySystem.resolveAttack(attack)
    let effAttack = chRes.attack
    let attackPart = chRes.part
    if (!chRes.chastity && State.get().gender !== 'male' && attackPart === 'anal' && z >= 4) {
      effAttack = { ...attack, desc: attack.desc.replace(/菊穴/g, '小穴'), name: attack.name }
      attackPart = 'vagina'
    }
    if (!attackPart && /口交|深喉|吞吐|口穴|嘴穴|操嘴/.test(effAttack.desc || '')) attackPart = 'oral'

    let chargedBlocked = false
    if (typeof RestraintSystem !== 'undefined') {
      const originalTiming = getTaskTiming(effAttack)
      const targetResult = RestraintSystem.resolveMonsterOrifice(attackPart, Math.random, { boss: true })
      targetResult.events.forEach(text => EventBus.emit('ui:log', { text, type: text.startsWith('🌿') || text.startsWith('💥') ? 'danger' : 'good' }))
      if (targetResult.mode === 'blocked') {
        chargedBlocked = true
        effAttack = { ...effAttack, name: `${effAttack.name} · 被充能抵挡`, desc: '插入装备的防护充能完全挡住了召唤怪物的攻击与效果。', dmg: 0, heal: 0, status: null, special: null, turns: 0, level: 0 }
      } else if (targetResult.mode === 'redirect' || targetResult.mode === 'forced_unlock') {
        if (targetResult.mode === 'redirect') EventBus.emit('battle:redirect', { from: attackPart, to: targetResult.part, enemyId: summoned.id, boss: true })
        const partName = { oral: '嘴穴', anal: '菊穴', vagina: '小穴' }[targetResult.part]
        effAttack = {
          ...effAttack,
          name: `${effAttack.name} · ${targetResult.mode === 'forced_unlock' ? '破锁强攻' : '改攻'}${partName}`,
          desc: `${summoned.name}${targetResult.mode === 'forced_unlock' ? '在藤蔓破锁后' : '发现原部位无法使用后'}改为攻击你的${partName}；原攻击伤害与效果不变。`,
          taskBpm: originalTiming.bpm,
          taskSeconds: originalTiming.seconds,
        }
        attackPart = targetResult.part
      } else if (targetResult.mode === 'spank') {
        effAttack = {
          ...effAttack,
          name: '藤蔓打屁股',
          desc: `${summoned.name}找不到能使用的部位，只好在森林之灵操控下狠狠打你的屁股。`,
          heal: 0,
          status: null,
          special: null,
          turns: 0,
          level: 0,
          taskBpm: originalTiming.bpm,
          taskSeconds: originalTiming.seconds,
        }
        attackPart = 'body'
      }
      attack = effAttack
    }
    _lastEnemyAttack = { attack: effAttack, roll: z, summonedId, part: attackPart }
    // 持久化当前召唤攻击（任务中刷新后不丢失，读档时自动结算）
    const _bsState = State.get()
    if (_bsState && _bsState._battle) {
      _bsState._pendingBossAttack = { attack: effAttack, roll: z, summonedId, part: attackPart }
      EventBus.emit('state:changed', _bsState)
    }

    await Dialog.showDice(z, 'Z')
    EventBus.emit('ui:log', { text: `${summoned.name} 使用「${effAttack.name}」：${effAttack.desc}`, type: 'danger' })

    // 只有依赖整支族群的效果会失效；魔女/哥布林召唤会转化为 BOSS 小兵。
    if (attack.special && ['infight', 'steal'].includes(attack.special)) {
      EventBus.emit('ui:log', { text: '🌲 被短暂控制的敌人无法发动族群效果，只结算本次攻击。', type: 'dim' })
    }

    // 与普通怪共用任务时长/BPM规则：优先攻击表配置，缺省时解析说明文字。
    const { bpm, seconds } = getTaskTiming(attack)

    // 弹窗显示的是完成任务时会受到的基础伤害；失败后才在结算阶段翻倍。
    // 这些值必须在打开弹窗前计算，否则会因引用未定义变量而中断整个 Boss 回合。
    const state = State.get()
    const battle = state._battle
    if (!battle) return
    const dmgMult = _enemy.props.summonDmgMult || 2
    // 魅魔"让你干她"(heal_self)是纯回血无伤害；"吸取"(drain_self)有伤害且强化
    const previewMainDmg = attack.special === 'heal_self'
      ? 0
      : (attack.dmg || 0) * dmgMult
    const previewMinionDmg = battle.targets.reduce((sum, target) => {
      return sum + (target.type === 'boss-minion' ? (target.dmgPerTurn || 0) : 0)
    }, 0)

    // 口塞：口交/深喉类召唤攻击做不了，硬挨一记（单倍伤害）
    const mouthDevice = typeof RestraintSystem !== 'undefined' ? RestraintSystem.get('mouth') : null
    const mouthDef = mouthDevice && RestraintSystem.defOf(mouthDevice.id)
    const gaggedOral = attackPart === 'oral' && mouthDef && mouthDef.id !== 'slut_gag'

    // 任务弹窗
    const failed = chargedBlocked
      ? (() => { EventBus.emit('ui:log', { text: '⚡ 召唤攻击被完全抵挡；场上已有小兵仍会独立造成伤害。', type: 'good' }); return false })()
      : gaggedOral
      ? (() => { EventBus.emit('ui:log', { text: '🤐 口塞堵着嘴，你没法完成口交任务，硬挨了召唤攻击（单倍伤害）。', type: 'danger' }); return false })()
      : await showTaskDialog({
          enemyName: `🌲 ${summoned.name}`,
          attackName: attack.name,
          desc: attack.desc,
          bpm,
          seconds,
          dmg: previewMainDmg + previewMinionDmg,
          status: attack.status,
          statusTurns: attack.turns ? attack.turns * 2 : 0,
          dildoName: DildoSystem.describe(summoned.id),
          telemetry: StatsSystem.taskMeta(summoned.id, z, attackPart),
        })

    // 结算（BOSS规则）
    let mainDmg = previewMainDmg
    const minionDmg = previewMinionDmg
    let blocked = false

    // 没完成任务：本回合总伤害翻倍。
    let dmg = mainDmg + minionDmg
    if (failed) dmg *= 2

    // 兽人锁喉失败：在任务失败惩罚外再翻倍，困倦基础 5 回合、BOSS 下翻倍为 10。
    let statusTurns = attack.turns ? attack.turns * 2 : 0
    if (attack.special === 'choke' && failed) {
      dmg *= 2
      statusTurns = 10
      EventBus.emit('ui:log', { text: '🫁 没憋住气！伤害再次翻倍，困倦 10 回合！', type: 'danger' })
    }

    // 全裸暴击与牺牲项链沿用普通战斗规则。
    if (StatusSystem.has('naked') && dmg > 0) {
      const critChance = { normal: 0.25, hard: 0.35, brutal: 0.45 }[state.difficulty] || 0.25
      if (Math.random() < critChance) {
        dmg *= 2
        EventBus.emit('ui:log', { text: '👙 你全裸无防护，被召唤攻击暴击！', type: 'danger' })
      }
    }
    if ((state.inventory.accessories || []).includes('sacrificial_necklace') && dmg > 0) {
      dmg *= 3
      EventBus.emit('ui:log', { text: '🔴 牺牲项链：受到的伤害变为三倍！', type: 'danger' })
    }

    // 防御针对已经翻倍后的最终伤害，避免奇数伤害多扣 1 点。
    if (battle.defending) {
      const before = dmg
      dmg = Math.ceil(dmg * CONFIG.battle.defendMult)
      battle.defending = false
      EventBus.emit('ui:log', { text: `🛡️ 防御姿态！伤害从 ${before} 减至 ${dmg}`, type: 'good' })
    }

    // DD 插入装备抵挡对应部位的整次敌方结算（包含已有小兵伤害、治疗反转）。
    if (!chargedBlocked && battle.blocked > 0) {
      const attackPart = _lastEnemyAttack ? _lastEnemyAttack.part : null
      if (ShopSystem.consumeBlockForPart(attackPart)) {
        blocked = true
        dmg = 0
      }
    }

    // 治疗反转：治疗转精灵且翻倍（被肛塞挡住则完全无效）
    let healToBoss = 0
    if (attack.special === 'heal_self' || attack.special === 'drain_self') {
      if (!blocked && !failed) {
        healToBoss = (attack.heal || 0) * 2
        const boss = battle.targets.find(target => target.id === 'main')
        if (boss) boss.hp = Math.min(boss.hp + healToBoss, boss.maxHp)
        EventBus.emit('ui:log', { text: `💚 治疗被反转！森林之灵恢复了 ${healToBoss} HP！`, type: 'danger' })
      } else if (blocked) {
        EventBus.emit('ui:log', { text: '🛡️ 肛塞挡住了治疗攻击！森林之灵没有恢复。', type: 'good' })
      } else {
        EventBus.emit('ui:log', { text: '💚 任务未完成，治疗攻击没有生效。', type: 'dim' })
      }
    }

    if (!blocked && dmg > 0) {
      if (State.get()._godMode) {
        EventBus.emit('ui:log', { text: '🛡️ 无敌模式：伤害被抵消！', type: 'good' })
      } else {
        state.hp -= dmg

        // 屏障咒反射（BOSS 战同样生效，仅受伤时反射）
        if (battle.reflectTurns > 0) {
          const reflected = Math.floor(dmg * 0.5)
          const boss = battle.targets.find(target => target.id === 'main')
          if (boss) {
            boss.hp -= reflected
            if (boss.hp <= 0) battle.targets = battle.targets.filter(target => target.id !== 'main')
          }
          EventBus.emit('ui:log', { text: `🪞 屏障咒反射了 ${reflected} 点伤害给森林之灵！`, type: 'good' })
        }
      }
    }

    // 屏障咒持续回合：每回合消耗 1 次（无论是否反射）
    if (battle.reflectTurns > 0) battle.reflectTurns--

    // 状态效果（回合翻倍）
    if (!blocked && attack.status) {
      StatusSystem.apply(attack.status, statusTurns, { level: attack.level, source: 'enemy' })
      const stDef = STATUS_EFFECTS[attack.status]
      if (stDef) EventBus.emit('ui:log', { text: `${stDef.icon} ${stDef.name} ${statusTurns} 回合（翻倍）！`, type: 'danger' })
    }

    if (!blocked) {
      if (attack.special === 'summon') addBossMinion(battle, '魔女小兵')
      if (attack.special === 'summon_goblin') addBossMinion(battle, '哥布林小兵')
    }

    EventBus.emit('state:changed', state)

    let msg = blocked ? '🛡️ 被插入装备挡住了！' : failed
      ? `❌ 没完成任务！受到 ${dmg} 点伤害`
      : `受到 ${dmg} 点伤害（召唤攻击已强化）`
    EventBus.emit('ui:log', { text: `[${summoned.name}] ${msg}`, type: dmg > 0 ? 'danger' : 'dim' })
    if (minionDmg > 0 && !blocked) {
      EventBus.emit('ui:log', { text: `👾 现有小兵本回合贡献 ${minionDmg} 点基础伤害。`, type: 'danger' })
    }

    // 检查死亡/胜利
    if (state.hp <= 0) { BattleSystem.end(false); return }
    if (!battle.targets.some(target => target.id === 'main')) { BattleSystem.end(true); return }

    // 攻击已结算，清除持久化的召唤攻击
    if (state._pendingBossAttack) {
      state._pendingBossAttack = null
      EventBus.emit('state:changed', state)
    }

    showPlayerTurn()
  }

  function addBossMinion (battle, name) {
    const count = battle.targets.filter(target => target.type === 'boss-minion').length
    if (count >= 4) {
      EventBus.emit('ui:log', { text: '👾 召唤小兵已达到上限（4 只）。', type: 'dim' })
      return
    }
    const label = ['A', 'B', 'C', 'D'][count]
    battle.targets.push({
      id: `boss-minion-${Date.now()}-${count}`,
      name: `${name} ${label}`,
      hp: 4,
      maxHp: 4,
      type: 'boss-minion',
      dmgPerTurn: 2,
    })
    EventBus.emit('ui:log', { text: `👾 ${name} ${label} 加入战斗，每回合额外造成 2 点伤害。`, type: 'danger' })
  }

  function applyEnemyDamage (failed, opts = {}) {
    const hint = document.getElementById('action-hint')
    const btns = document.getElementById('action-buttons')
    btns.innerHTML = ''

    const state = State.get()
    const battle = state._battle
    if (!_lastEnemyAttack || !_lastEnemyAttack.attack) {
      EventBus.emit('ui:log', { text: '⚠️ 敌人攻击数据丢失，跳过本次结算。', type: 'danger' })
      showPlayerTurn()
      return
    }
    const attack = _lastEnemyAttack.attack
    let blocked = !!opts.chargeBlocked
    let dmg = blocked ? 0 : (attack.dmg || 0)

    // 全裸：按难度概率被敌人暴击（普通25% / 困难35% / 残酷45%）；蒙眼罩额外 +10%
    if ((StatusSystem.has('naked') || (typeof RestraintSystem !== 'undefined' && RestraintSystem.hasBlindfold())) && !blocked) {
      const critChance = { normal: 0.25, hard: 0.35, brutal: 0.45 }[state.difficulty] || 0.25
      const blindBonus = (typeof RestraintSystem !== 'undefined' && RestraintSystem.hasBlindfold()) ? 0.10 : 0
      if (Math.random() < (critChance + blindBonus)) {
        dmg *= 2
        EventBus.emit('ui:log', { text: StatusSystem.has('naked') ? '👙 你全裸无防护，被敌人暴击！伤害翻倍！' : '😵 蒙着眼罩看不清攻击，被敌人暴击！伤害翻倍！', type: 'danger' })
      }
    }

    // 防御：伤害减半（仅生效一次）
    if (battle && battle.defending && !blocked) {
      const halved = Math.ceil(dmg * CONFIG.battle.defendMult)
      EventBus.emit('ui:log', { text: `🛡️ 防御姿态！伤害从 ${dmg} 减至 ${halved}`, type: 'good' })
      dmg = halved
      battle.defending = false
    }

    // 召唤物额外伤害（求和所有召唤物/哥布林的 dmgPerTurn）
    let minionDmg = 0
    if (battle) {
      battle.targets.forEach(t => { if (t.dmgPerTurn) minionDmg += t.dmgPerTurn })
    }
    if (!blocked) dmg += minionDmg

    // 乳夹：敏感被扯动，30% 额外 -1 HP
    if (!blocked && dmg > 0 && typeof RestraintSystem !== 'undefined' && RestraintSystem.hasNipple() && Math.random() < 0.3) {
      dmg += 1
      EventBus.emit('ui:log', { text: '🎀 乳夹被扯动，又麻又痛，额外 -1 HP。', type: 'danger' })
    }

    // 牺牲项链：受到的伤害三倍（覆盖主攻击 + 召唤物总伤害）
    if (!blocked && (state.inventory.accessories || []).includes('sacrificial_necklace')) {
      dmg *= 3
      EventBus.emit('ui:log', { text: '🔴 牺牲项链：受到的伤害变为三倍！', type: 'danger' })
    }


    // DD 插入装备按部位消耗本场格挡：菊穴装备挡菊穴，小穴装备挡小穴。
    if (!blocked && battle && battle.blocked > 0) {
      const attackPart = _lastEnemyAttack ? _lastEnemyAttack.part : null
      if (ShopSystem.consumeBlockForPart(attackPart)) {
        blocked = true
        dmg = 0
      }
    }

    if (failed && !blocked) dmg *= 2  // 没完成：伤害翻倍

    // 兽人锁喉：憋不住气 → 伤害再翻倍 + 困倦 5 回合
    let sleepyTurns = attack.turns || 3
    if (opts.chokeFail && !blocked) {
      dmg *= 2
      sleepyTurns = 5
      EventBus.emit('ui:log', { text: '🫁 没憋住气！伤害双倍，困倦 5 回合！', type: 'danger' })
    }

    if (!blocked) {
      if (State.get()._godMode) {
        EventBus.emit('ui:log', { text: '🛡️ 无敌模式：伤害被抵消！', type: 'good' })
      } else {
        state.hp -= dmg

        // 屏障咒反射（仅受伤时反射）
        let reflected = 0
        if (battle && battle.reflectTurns > 0) {
          reflected = Math.floor(dmg * 0.5)
          battle.targets[0].hp -= reflected
          // 反射击杀：仅从目标列表移除，不触发 end（统一在末尾判定胜负）
          if (battle.targets[0].hp <= 0) {
            battle.targets = battle.targets.filter(t => t.id !== battle.targets[0].id)
          }
        }
      }

      // 屏障咒持续回合：每次攻击结算消耗 1 次（无论是否反射）
      if (battle && battle.reflectTurns > 0) battle.reflectTurns--

      // 施加状态效果
      if (attack.status) {
        const turns = attack.status === 'sleepy' ? sleepyTurns : attack.turns
        StatusSystem.apply(attack.status, turns, { level: attack.level, source: 'enemy' })
        // 状态施加提示
        const stDef = STATUS_EFFECTS[attack.status]
        if (stDef) {
          EventBus.emit('ui:log', { text: `${stDef.icon} ${stDef.name}${turns ? ' ' + turns + ' 回合' : ''}！`, type: 'danger' })
        }
      }

      // 特殊攻击效果
      handleSpecialEffects(attack, battle, failed)

      // 特殊效果可能已结束战斗（如内讧引发逃跑 / 群怪全灭），立即停止本次结算
      if (State.get().phase !== 'battle' || !State.get()._battle) {
        EventBus.emit('state:changed', State.get())
        return
      }
    }

    EventBus.emit('state:changed', state)

    const storyEnemyLabel = _enemy?.id === 'p_caravan_guard' ? '看守' : _enemy?.id === 'p_bandit_leader' ? '强盗' : '敌人'
    let msg = _enemy?.props?.storyEncounter
      ? (dmg > 0 ? `⚔️ ${storyEnemyLabel}的攻势造成 ${dmg} 点伤害。` : attack.special === 'caravan_search' || attack.special === 'caravan_restraint' ? `⚔️ ${attack.name}没有造成直接伤害。` : `⚔️ 你避开了${storyEnemyLabel}的攻势。`)
      : failed
        ? `❌ 没完成任务！伤害翻倍！受到 ${dmg} 点伤害`
        : `✅ 完成任务！受到 ${dmg} 点伤害`
    if (blocked) msg = opts.chargeBlocked ? '⚡ 防护充能完全抵挡：0 伤害、0 效果！' : '🛡️ 被插入装备挡住了！'
    EventBus.emit('ui:log', { text: msg, type: failed ? 'danger' : 'dim' })

    // 召唤物伤害提示
    if (minionDmg > 0 && !blocked) {
      EventBus.emit('ui:log', { text: `👾 魔女小兵额外造成 ${minionDmg} 点伤害！`, type: 'danger' })
    }

    // 检查死亡/胜利
    if (state.hp <= 0) { BattleSystem.end(false); return }
    if (battle && battle.targets.length === 0) { BattleSystem.end(true); return }

    showPlayerTurn()
  }

  function handleSpecialEffects (attack, battle, failed) {
    switch (attack.special) {
      case 'infight':
        // 随机一只干你，其余哥布林各 -2 HP
        const goblins = battle.targets.filter(t => t.type === 'goblin')
        if (goblins.length > 1) {
          const lucky = goblins[Math.floor(Math.random() * goblins.length)]
          goblins.filter(g => g !== lucky).forEach(g => {
            g.hp = Math.max(0, g.hp - 2)
          })
          const dead = goblins.filter(g => g !== lucky && g.hp <= 0)
          dead.forEach(g => BattleSystem.removeTarget(g.id))
          EventBus.emit('ui:log', { text: `👺 哥布林内讧！除了干你的那只，其余各 -2 HP${dead.length ? '，死了' + dead.length + '只' : ''}。`, type: 'danger' })
        }
        break
      case 'summon':
        // 召唤物成为新的攻击目标（上限 4 只，可叠加伤害，按 ABCD 命名）
        const minionCount = battle.targets.filter(t => t.type === 'minion').length
        if (minionCount < 4) {
          const letters = ['A', 'B', 'C', 'D']
          const label = letters[minionCount] || (minionCount + 1)
          battle.targets.push({ id: 'minion-' + Date.now(), name: '魔女小兵 ' + label, hp: 4, maxHp: 4, type: 'minion', dmgPerTurn: 1, secondsPerTurn: 15 })
          EventBus.emit('ui:log', { text: `🔮 魔女召唤了小兵 ${label}！(现共 ${minionCount + 1} 只，每回合共造成 ${minionCount + 1} 点伤害)`, type: 'danger' })
        } else {
          EventBus.emit('ui:log', { text: '🔮 魔女想再召唤小兵，但已经满了（上限 4 只）！', type: 'dim' })
        }
        break
      case 'summon_goblin':
        const gobCount = battle.targets.filter(t => t.type === 'goblin').length
        const goblinDef = DATA.monster('goblins')
        const maxPack = goblinDef?.props?.maxPack || 5
        if (gobCount < maxPack) {
          const letters = ['A', 'B', 'C', 'D', 'E']
          const label = letters[gobCount] || (gobCount + 1)
          const hpMap = goblinDef?.props?.hpByDifficulty
          const unitHp = (hpMap && hpMap[State.get().difficulty || 'normal']) || goblinDef?.maxHp || 5
          battle.targets.push({ id: 'goblin-' + Date.now(), name: '哥布林 ' + label, hp: unitHp, maxHp: unitHp, type: 'goblin', dmgPerTurn: 0 })
          EventBus.emit('ui:log', { text: `👺 哥布林叫来了哥布林 ${label}！(现共 ${gobCount + 1} 只)`, type: 'danger' })
        } else {
          EventBus.emit('ui:log', { text: '👺 哥布林想叫帮手，但已经满了（最多 5 只）！', type: 'dim' })
        }
        break
      case 'steal':
        const gold = attack.gold || 0
        const stolen = Math.min(State.get().gold, gold)
        State.get().gold = Math.max(0, State.get().gold - stolen)
        if (battle.enemyId === 'p_bandit_leader') battle.banditGoldStolen = (battle.banditGoldStolen || 0) + stolen
        EventBus.emit('ui:log', { text: `💰 被偷了 ${stolen} 金币！`, type: 'danger' })
        break
      case 'heal_self':
        if (!failed && battle.targets[0]) {
          // 魅魔回血上限 10
          const cap = DATA.monster(battle.enemyId)?.props?.maxSelfHp || battle.targets[0].maxHp
          battle.targets[0].hp = Math.min(battle.targets[0].hp + attack.heal, cap)
          EventBus.emit('ui:log', { text: `💚 ${DATA.monster(battle.enemyId).name} 恢复了 ${attack.heal} HP`, type: 'danger' })
        }
        break
      case 'drain_self':
        if (!failed && battle.targets[0]) {
          const cap = DATA.monster(battle.enemyId)?.props?.maxSelfHp || battle.targets[0].maxHp
          battle.targets[0].hp = Math.min(battle.targets[0].hp + attack.heal, cap)
        }
        break
    }
  }

  /* ============ 物品 ============ */

  function showItemMenu () {
    const state = State.get()
    // 手铐/反绑束臂器：双手被束住，无法使用物品
    if (typeof RestraintSystem !== 'undefined' && RestraintSystem.hasHandsBlocked()) {
      EventBus.emit('ui:log', { text: RestraintSystem.hasArmbinder() ? '🪢 双臂被反绑在身后，够不到背包！' : '⛓️ 手铐锁着你的双手，够不到背包里的东西！', type: 'danger' })
      showPlayerTurn()
      return
    }
    if (state._battle && state._battle.itemUsedThisTurn) {
      EventBus.emit('ui:log', { text: '本回合已经使用过 1 个物品，下次再战！', type: 'dim' })
      return
    }
    const items = Object.entries(state.inventory.consumables)
      .filter(([id, v]) => v > 0 && id !== 'weapon_upgrade_material' && id !== 'mutant_crystal' && id !== 'twig' && id !== 'restraint_lock' && id !== 'restraint_key' && id !== 'master_key' && id !== 'lockpick' && id !== 'curse_remover')
    const usableItems = state._battle && state._battle.itemUsedThisTurn ? [] : items
    if (!usableItems.length) {
      EventBus.emit('ui:log', { text: '没有可用物品。', type: 'dim' })
      return
    }

    let html = usableItems.map(([id, count]) => {
      const item = ItemLib.get(id)
      const desc = item && item.desc ? item.desc : ''
      return `<button class="item-use-btn" data-item="${id}">
        <div>
          <b>${item?.name || id}</b>
          <span>×${count}</span>
        </div>
        <small>${desc}</small>
      </button>`
    }).join('')

    Dialog.show({
      title: '🎒 选择物品',
      className: 'battle-item-modal',
      body: `<div class="battle-item-list">${html}</div>`,
      actions: [{ kind: 'navigation', label: '继续战斗', handler: () => Dialog.close() }],
    })

    Dialog.onMount(root => {
      root.querySelectorAll('[data-item]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.item
          if (ShopSystem.isSoulGem(id)) {
            ShopSystem.openSoulGemCharge(id, () => {
              if (State.get()._battle) State.get()._battle.itemUsedThisTurn = true
              showPlayerTurn()
            }, showItemMenu)
            return
          }
          const result = ShopSystem.useConsumable(id)
          Dialog.close()
          if (!result.ok) EventBus.emit('ui:log', { text: result.msg, type: 'danger' })
          else {
            // 使用日志由 ShopSystem.useConsumable 统一输出（避免重复）
            if (State.get()._battle) State.get()._battle.itemUsedThisTurn = true
            showPlayerTurn()
          }
        }
      })
    })
  }

  /* ============ 战斗结束 ============ */

  function continueAfterBattle (data) {
    if (GameFlow.handleBattleVictory(data)) return
    GameFlow.afterEvent()
  }

  function onEnd (data) {
    const hint = document.getElementById('action-hint')
    const btns = document.getElementById('action-buttons')
    btns.innerHTML = ''
    let pendingDropNames = ''   // 额外掉落弹窗内容（点"继续"后先展示，避免竞态）

    // 战斗结束：恢复地图 + 操作栏回到文档流
    const body = document.querySelector('.game-body')
    const mapPanel = document.getElementById('map-panel')
    const actionBar = document.getElementById('action-bar')
    const gameScreen = document.getElementById('screen-game')
    if (body) body.classList.remove('battle-mode')
    if (mapPanel) mapPanel.classList.remove('panel-hidden')
    if (actionBar) actionBar.classList.remove('fixed')
    if (gameScreen) gameScreen.classList.remove('has-fixed-bar')

    if (data.enemyEscaped) {
      const escaped = DATA.monster(data.enemyId)
      const gold = data.loot?.gold || 0
      hint.textContent = `🏃 ${escaped ? escaped.name : '敌人'}逃走了！`
      EventBus.emit('ui:log', { text: `🏃 敌人成功逃走，你只捡到 ${gold} 金币，没有获得特殊掉落。`, type: 'dim' })
      btns.innerHTML = `<button class="btn btn-primary" id="btn-loot">继续</button>`
      document.getElementById('btn-loot').onclick = () => {
        Dialog.close()
        GameFlow.afterEvent()
      }
    } else if (data.storyDefeat && GameFlow.handleBattleDefeat(data)) {
      hint.textContent = data.hallAssault
        ? '⛓️ 会馆袭击失败，你被拖回登记长桌。'
        : data.banditHideout
          ? '🗡️ 你被赶出强盗据点，证人仍等待救援。'
          : '⛓️ 你被车队押回了雾灯镇。'
    } else if (data.victory) {
      if (data.fled) {
        if (data.surrendered) {
          hint.textContent = '🏳️ 你投降了。'
          EventBus.emit('ui:log', { text: '🏳️ 你选择投降，离开了战斗。', type: 'good' })
        } else {
          hint.textContent = '🏃 成功逃脱！'
          EventBus.emit('ui:log', { text: '🏃 你成功逃脱了战斗。', type: 'good' })
        }
      } else {
        hint.textContent = '🎉 战斗胜利！'
        let msg = `获得 ${data.loot.gold} 金币`
        // 哥布林偷金：显示实际被偷金额
        const stolen = (data.loot.drops || []).find(d => d.type === 'gold_loss')
        if (stolen) {
          msg += `，但被偷了 ${stolen.gold} 金币`
          EventBus.emit('ui:log', { text: `🤑 最后那只哥布林逃跑时撞到你，偷走了 ${stolen.gold} 金币！`, type: 'danger' })
        }
        // 真实额外掉落 = 物品或状态（特殊剧情掉落有独立展示，不计入）
        const realDrops = (data.loot.drops || []).filter(d => d.itemId || d.type === 'status')
        if (realDrops.length) {
          msg += ' + 额外掉落'
          // 弹窗说明获得了什么
          const dropNames = realDrops.map(d => {
            if (d.itemId) {
              const it = ItemLib.get(d.itemId)
              const dd = typeof RestraintSystem !== 'undefined' ? RestraintSystem.defOf(d.itemId) : null
              return it ? `${it.name}` : dd ? `${dd.name}（妖缚装备）` : d.itemId
            }
            if (d.type === 'status') {
              const st = STATUS_EFFECTS[d.id]
              return st ? `${st.icon} ${st.name}` : d.id
            }
            return ''
          }).filter(Boolean).join('、')
          pendingDropNames = dropNames
        }
        EventBus.emit('ui:log', { text: msg, type: 'good' })
      }
      btns.innerHTML = `<button class="btn btn-primary" id="btn-loot">继续</button>`
      document.getElementById('btn-loot').onclick = () => {
        Dialog.close()
        // 额外掉落弹窗：先展示，关闭后再继续（避免竞态）
        if (pendingDropNames) {
          Dialog.show({
            title: '🎁 额外掉落',
            body: `
              <div style="background:var(--panel-2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
                <div style="font-size:.8rem;color:var(--text-dim);margin-bottom:8px">你获得了</div>
                <div style="font-size:1.05rem;font-weight:700;color:var(--gold)">${pendingDropNames}</div>
              </div>
            `,
            actions: [{ label: '收下', cls: 'btn-primary', handler: () => {
              Dialog.close()
              // 特殊掉落事件：从持久化的 _pendingLootEvent 判断（刷新后仍可恢复）
              if (processPendingLootEvent()) return
              continueAfterBattle(data)
            } }],
          })
          return
        }
        // 特殊掉落事件：从持久化的 _pendingLootEvent 判断（刷新后仍可恢复）
        if (processPendingLootEvent()) return
        continueAfterBattle(data)
      }
    } else {
      hint.textContent = '💀 你被击败了……'
      btns.innerHTML = `<button class="btn btn-danger" id="btn-die">等待重生</button>`
      document.getElementById('btn-die').onclick = () => {
        Dialog.close()
        respawn()
      }
    }
  }

  /** 处理持久化的特殊掉落事件（断触手/狼人遗愿/魔女召唤）；返回 true 表示已处理 */
  function processPendingLootEvent () {
    const state = State.get()
    const pending = state && state._pendingLootEvent
    if (!pending || !pending.type) return false
    if (pending.type === 'tentacle_embedded') {
      state._pendingLootEvent = null
      EventBus.emit('state:changed', state)
      showTentacleEmbedded()
      return true
    }
    if (pending.type === 'werewolf_final') {
      state._pendingLootEvent = null
      EventBus.emit('state:changed', state)
      showWerewolfFinal()
      return true
    }
    if (pending.type === 'reroll_encounter') {
      state._pendingLootEvent = null
      EventBus.emit('state:changed', state)
      EventBus.emit('ui:log', { text: '🔮 临死前，魔女以自己的身躯为祭品召唤出另一只怪物，再掷一次遭遇。', type: 'danger' })
      const z = Dice.rollZ()
      // 魔女不能召唤自己（排除 sorceress）
      const pool = (CONFIG.monsters.randomPool || ['tentacle', 'orc', 'sorceress', 'succubus', 'goblins', 'werewolf']).filter(id => id !== 'sorceress')
      const idx = Math.min(z - 1, pool.length - 1)
      const enemyId = pool[idx]
      EventBus.emit('ui:log', { text: `掷 Z=${z} → ${DATA.monster(enemyId).name} 出现了！`, type: 'dice' })
      BattleSystem.start(enemyId)
      return true
    }
    return false
  }

  /* ============ 狼人临终遗愿 ============ */

  function showWerewolfFinal () {
    const state = State.get()
    const z = Dice.rollZ()
    const hole = ChastitySystem.orifice(z)
    EventBus.emit('ui:log', { text: `🌕 太阳升起，狼人变回了人形……（掷 Z=${z}，他操你的${hole}）`, type: 'dim' })
    Dialog.show({
      title: '🌕 临终遗愿',
      body: `
        <p>太阳升起，他变回了人形。</p>
        <p>临终遗愿是让你给他个痛快。</p>
        <p>你让他最后一次以中等深度操你的${hole} 45 秒（现在用普通假阴茎）。</p>
        <div style="margin-top:10px;padding:10px;background:var(--panel-2);border:1px solid var(--gold);border-radius:8px">
          <div style="color:var(--gold);font-weight:700;margin-bottom:4px">🎯 现实任务</div>
          <p style="font-size:.9rem;line-height:1.6">用<b>普通假阴茎</b>以中等深度操弄你的${hole}，持续 <b>45 秒</b>。</p>
        </div>
      `,
      actions: [
        { label: '▶️ 开始任务', cls: 'btn-primary', handler: () => {
          Dialog.close()
          doWerewolfTask(z)
        }},
      ],
    })
  }

  /** 狼人临终 45 秒任务，完成后承受毒精液伤害 */
  async function doWerewolfTask (z) {
    const state = State.get()
    const hole = ChastitySystem.orifice(z)
    try {
      const failed = await showTaskDialog({
        enemyName: '🌕 人形狼人',
        attackName: '临终操弄',
        desc: `用普通假阴茎以中等深度操弄${hole}`,
        bpm: 0,
        seconds: 45,
        dmg: 8,
        dildoName: '普通假阴茎',
        telemetry: { source: 'battle', enemyId: 'werewolf', action: 'penetration', part: state.gender !== 'male' && z >= 4 ? 'vagina' : 'anal', depth: 'medium' },
      })
      // 无论完成与否，毒精液伤害都会施加
      state.hp -= 8
      EventBus.emit('ui:log', { text: failed ? `☠️ 任务没完成，但毒精液依然灼烧你的${hole}！-8 HP` : `☠️ 狼人的毒精液灼烧你的${hole}！-8 HP`, type: 'danger' })
      EventBus.emit('state:changed', state)
      // 死亡检查（战斗已结束，直接触发死亡流程）
      if (state.hp <= 0) {
        state.phase = 'gameover'
        EventBus.emit('battle:end', { victory: false })
        EventBus.emit('game:gameover', {})
        return
      }
      GameFlow.afterEvent()
    } catch (e) {
      console.error('狼人任务异常:', e)
      state.hp -= 8
      EventBus.emit('state:changed', state)
      GameFlow.afterEvent()
    }
  }

  /* ============ 触手断体 ============ */

  function showTentacleEmbedded () {
    const state = State.get()
    const z = Dice.rollZ()
    const hole = ChastitySystem.orifice(z)
    EventBus.emit('ui:log', { text: `🐙 你在被干时砍断了触手，断掉的那截弹进了你的${hole}里！（掷 Z=${z}）`, type: 'danger' })
    Dialog.show({
      title: '🐙 断触手',
      body: `
        <p>你在被干时砍断了触手，断掉的那截弹进了你的${hole}里！</p>
        <p style="color:var(--text-dim);margin-top:6px">将假阴茎留在里面，直到有别的东西插入你的${hole}。</p>
        <div style="margin-top:10px;padding:10px;background:var(--panel-2);border:1px solid var(--gold);border-radius:8px">
          <div style="color:var(--gold);font-weight:700;margin-bottom:4px">🎯 现实任务</div>
          <p style="font-size:.9rem;line-height:1.6">插入一根<b>普通假阴茎</b>（对应断掉的触手），并让它一直待在${hole}里，<b>直到下一个敌人用别的东西插入你</b>才能替换。中途不得取出。</p>
        </div>
      `,
      actions: [
        { label: '🍑 已插入并保持', cls: 'btn-primary', handler: () => {
          Dialog.close()
          // 施加断触手状态：持续到下一位敌人插入才移除
          const state = State.get()
          state.statuses = state.statuses.filter(s => s.id !== 'tentacle_embedded')
          state.statuses.push({ id: 'tentacle_embedded', turnsLeft: 999, source: 'enemy' })
          EventBus.emit('ui:log', { text: `🍑 假阴茎留在你的${hole}里，等下一个敌人插入。`, type: 'good' })
          EventBus.emit('state:changed', state)
          GameFlow.afterEvent()
        }},
      ],
    })
  }

  /* ============ 重生 ============ */

  function respawn () {
    const state = State.get()
    const hadGreed = StatusSystem.has('greed_demon')
    const greedDeviceResult = hadGreed && typeof TreasureSystem !== 'undefined' && TreasureSystem.clearGreedDevice
      ? TreasureSystem.clearGreedDevice()
      : 'none'
    // 防御性清理：确保伏击/战斗残留状态清除
    state._ambush = null
    state._battle = null
    state._pendingLootEvent = null
    for (let i = state.visited.length - 1; i >= 0; i--) {
      const v = state.visited[i]
      const tile = MapLib.get(v.x, v.y)
      if (tile && tile.type === TILE.CHECKPOINT) {
        state.position = { x: v.x, y: v.y }
        state.hp = state.maxHp
        state.phase = 'idle'
        state.statuses = []
        state.gold = Math.floor(state.gold * 0.5)
        EventBus.emit('ui:log', { text: `在检查点 (${v.x},${v.y}) 重生。金币减半。`, type: 'dim' })
        finishRespawn(hadGreed, greedDeviceResult)
        return
      }
    }
    state.position = { x: MapLib.start.x, y: MapLib.start.y }
    state.hp = state.maxHp
    state.phase = 'idle'
    state.statuses = []
    state.gold = Math.floor(state.gold * 0.5)
    finishRespawn(hadGreed, greedDeviceResult)
  }

  function finishRespawn (hadGreed, greedDeviceResult = 'none') {
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
          { label: '继续冒险', cls: 'btn-primary', handler: () => { Dialog.close(); GameFlow.afterEvent() } },
        ],
      })
      return
    }
    GameFlow.afterEvent()
  }

  /** 从存档恢复战斗 UI（不重建战斗数据） */
  function resume () {
    const state = State.get()
    if (!state._battle) return
    _enemy = DATA.monster(state._battle.enemyId) || { id: state._battle.enemyId, name: '???' }
    _lastEnemyAttack = null

    // 上次 Boss 召唤攻击未结算完成（任务弹窗中刷新）：清除并提示，保持战斗一致
    if (state._pendingBossAttack) {
      state._pendingBossAttack = null
      EventBus.emit('ui:log', { text: '🌲 上次召唤攻击已中断，重新进入你的回合。', type: 'dim' })
    }

    const body = document.querySelector('.game-body')
    const mapPanel = document.getElementById('map-panel')
    const actionBar = document.getElementById('action-bar')
    const gameScreen = document.getElementById('screen-game')
    if (body) body.classList.add('battle-mode')
    if (mapPanel) mapPanel.classList.add('panel-hidden')
    if (actionBar) actionBar.classList.add('fixed')
    if (actionBar) actionBar.classList.remove('hidden')
    if (gameScreen) gameScreen.classList.add('has-fixed-bar')

    HUD.render()
    showPlayerTurn()
  }

  return { init, showTaskDialog, resume, processPendingLootEvent }
})()
