/**
 * systems/movement.js — 移动系统（网格版）
 *
 * 职责：
 *  - 掷 Y 决定步数
 *  - 在网格上逐格移动（上下左右，墙不可穿）
 *  - 每进入一个格子即触发该格子事件
 *  - 步数走完后结束移动
 *
 * 事件：movement:roll / movement:arrive
 */

window.MovementSystem = (function () {
  /** 掷骰，返回步数和初始移动数据 */
  function rollStep () {
    const state = State.get()
    const steps = Dice.rollMove()
    EventBus.emit('movement:roll', { steps })
    EventBus.emit('ui:log', { text: `🎲 掷出 ${steps} 步`, type: 'dice' })
    return steps
  }

  /**
   * 往 (dx, dy) 方向移动一步
   * @param {number} dx  行增量（-1 上 / 1 下 / 0）
   * @param {number} dy  列增量（-1 左 / 1 右 / 0）
   * @returns {{ ok, tile, stepsRemaining }}
   */
  function moveOne (dx, dy) {
    const state = State.get()
    const { x, y } = state.position
    const nx = x + dx
    const ny = y + dy

    if (!MapLib.isWalkable(nx, ny)) {
      return { ok: false, reason: '墙' }
    }

    state.position = { x: nx, y: ny }
    state.visited.push({ x: nx, y: ny })

    const tile = MapLib.get(nx, ny)
    EventBus.emit('movement:arrive', { x: nx, y: ny, tile })
    EventBus.emit('ui:mapUpdate', {})

    return { ok: true, tile }
  }

  return { rollStep, moveOne }
})()

/**
 * 网格版节点触发器：进入格子触发对应事件。
 * 区别于原版"经过即触发"，网格上进入格子的瞬间触发。
 */
window.NodeEvents = {
  trigger (tile, x, y) {
    const state = State.get()

    // 更新底部提示：进入事件等待选择（避免停在"掷骰中"）
    const hint = document.getElementById('action-hint')
    const btns = document.getElementById('action-buttons')

    switch (tile.type) {
      case TILE.MONSTER:
        if (hint) hint.textContent = '⚔️ 遭遇敌人！'
        startRandomBattle()
        return   // 战斗接管流程

      case TILE.TRAP:
        if (hint) hint.textContent = '🪤 触发陷阱……'
        TrapSystem.roll()
        return

      case TILE.AMBUSH:
        if (hint) hint.textContent = '🌫️ 你被伏击了！'
        EventBus.emit('ui:log', { text: '🌫️ 你被伏击了！', type: 'danger' })
        AmbushSystem.trigger()
        return

      case TILE.EVENT:
        if (hint) hint.textContent = '❔ 触发事件……'
        triggerRandomEvent()
        return

      case TILE.TREASURE:
        if (hint) hint.textContent = '🎁 发现宝箱！'
        TreasureSystem.roll()
        return

      case TILE.BOSS:
        if (hint) hint.textContent = '👑 最终决战！'
        if (btns) btns.innerHTML = ''
        EventBus.emit('ui:log', { text: '👑 森林之灵挡住了去路！', type: 'danger' })
        Dialog.show({
          title: '👑 最终决战',
          className: 'boss-gate-modal',
          body: `<div class="boss-gate">
              <span class="boss-gate-crown">♛</span>
              <div><small>THE LAST VILLAGE</small><b>森林的意志正在前方等待</b></div>
            </div>
            <p>穿过最后一道迷雾，村庄安静得反常。道路尽头，一个女孩正注视着你。</p>
            <div class="boss-save-notice"><span>💾</span><div><b>专用战前存档</b><small>挑战时自动建立，战斗中的普通存档不会覆盖它。</small></div></div>
            <p class="boss-gate-warning">落败后可读取战前存档重新挑战，或返回检查点并损失一半金币。</p>`,
          actions: [
            { label: '⚔️ 挑战森林之灵', cls: 'btn-danger', handler: () => {
              Dialog.close()
              State.saveBossCheckpoint()
              State.save()
              EventBus.emit('ui:log', { text: '💾 已建立独立战前存档，可带全部物品重开。', type: 'good' })
              BattleSystem.start('spirit_of_forest')
            }},
          ],
        })
        return

      case TILE.SHOP:
        if (hint) hint.textContent = '🏪 发现商店！'
        ShopSystem.open(tile)
        return

      case TILE.CAMP:
        if (hint) hint.textContent = '⛺ 进入营地……'
        if (typeof CampSystem !== 'undefined' && CampSystem.open) {
          CampSystem.open({ gateEntry: true })
        } else {
          EventBus.emit('ui:log', { text: '⛺ 营地暂时无人。', type: 'dim' })
          GameFlow.afterEvent()
        }
        return

      case TILE.CHECKPOINT:
        const tp = typeof TeleportSystem !== 'undefined' ? TeleportSystem.byPos(state.position.x, state.position.y) : null
        if (tp) TeleportSystem.activate(tp.id)
        state.hp = state.maxHp
        EventBus.emit('ui:log', { text: tp ? `🌀 ${tp.name}激活，HP 回满。` : '🌀 传送阵激活，HP 回满。', type: 'good' })
        State.save()
        EventBus.emit('state:changed', state)
        break

      case TILE.START:
        EventBus.emit('ui:log', { text: '这里是起点。', type: 'dim' })
        break

      case TILE.EMPTY:
      default:
        break
    }

    // 无事发生的格子：继续流程
    GameFlow.afterEvent()
  },
}

/** 掷 Z 随机遭遇怪物 */
function startRandomBattle () {
  const z = Dice.rollZ()
  const pool = CONFIG.monsters.randomPool || ['tentacle', 'orc', 'sorceress', 'succubus', 'goblins', 'werewolf']
  const idx = Math.min(z - 1, pool.length - 1)
  const enemyId = pool[idx]
  EventBus.emit('ui:log', { text: `掷 Z=${z} → ${DATA.monster(enemyId).name} 出现了！`, type: 'dice' })
  BattleSystem.start(enemyId)
}

/** 随机事件：掷 Z，按概率决定是陷阱 / 伏击 /  特殊事件 */
function triggerRandomEvent () {
  const z = Dice.rollZ()
  if (z <= 2) {
    // 陷阱
    TrapSystem.roll()
  } else if (z <= 4) {
    // 伏击
    EventBus.emit('ui:log', { text: '🌫️ 你被伏击了！', type: 'danger' })
    AmbushSystem.trigger()
  } else if (z <= 5) {
    // 宝藏
    TreasureSystem.roll()
  } else {
    // 特殊：遇到商人 / 恢复等
    EventBus.emit('ui:log', { text: '你发现了一处隐蔽的休息点。', type: 'good' })
    const state = State.get()
    state.hp = Math.min(state.maxHp, state.hp + 5)
    EventBus.emit('state:changed', state)
    GameFlow.afterEvent()
  }
}

/* ---------- 伏击系统 ---------- */
window.AmbushSystem = {
  async trigger () {
    const state = State.get()
    state.phase = 'ambush'
    state._ambush = { smallPlugBlocked: 0, plugBlocked: 0, blocked: 0, reflectTurns: 0, smallPlugType: null, plugType: null }
    EventBus.emit('ui:log', { text: '🌫️ 你被伏击了！反复掷骰直到掷出双数才能脱身。', type: 'danger' })
    EventBus.emit('state:changed', state)

    const hint = document.getElementById('action-hint')
    if (hint) hint.textContent = '🌫️ 伏击！准备掷 Y / Z'
    await AmbushSystem.showIntro()

    let round = 0
    while (true) {
      round++
      const y = Dice.rollAttack()  // Y 决定怪物
      const z = Dice.rollEnemy()   // Z 决定攻击

      await Dialog.showDice(y, 'Y')
      await Dialog.showDice(z, 'Z')
      EventBus.emit('ui:log', { text: `🎲 第${round}轮：Y=${y} Z=${z}`, type: 'dice' })

      // 用 Y 决定怪物，Z 决定攻击
      const pool = CONFIG.monsters.randomPool || ['tentacle', 'orc', 'sorceress', 'succubus', 'goblins', 'werewolf']
      const idx = Math.min(y - 1, pool.length - 1)
      const enemyId = pool[idx]
      const enemy = DATA.monster(enemyId)
      const attack = enemy.attacks.find(a => a.roll === z) || enemy.attacks[0]
      // 贞操装置：小穴/撸管/寸止任务强制改为肛交；否则女性 Z4-6 操菊穴改为操小穴
      const chRes = ChastitySystem.resolveAttack(attack)
      let effAttack = chRes.attack
      let attackPart = chRes.part
      if (!chRes.chastity && State.get().gender !== 'male' && attackPart === 'anal' && z >= 4) {
        effAttack = { ...attack, desc: attack.desc.replace(/菊穴/g, '小穴'), name: attack.name }
        attackPart = 'vagina'
      }
      EventBus.emit('ui:log', { text: `🌫️ ${enemy.name} 突袭并使用「${effAttack.name}」！`, type: 'danger' })

      // 显示攻击任务（口塞下口交类做不了，硬挨一记）
      const gaggedOral = typeof RestraintSystem !== 'undefined' && RestraintSystem.hasGag() && /口交|深喉|吞吐|口穴|嘴穴/.test(effAttack.desc)
      if (gaggedOral) {
        EventBus.emit('ui:log', { text: '🤐 口塞堵着嘴，你做不了口交任务，硬挨了伏击攻击（单倍伤害）。', type: 'danger' })
      } else {
        await AmbushSystem.showTask(enemy, effAttack)
      }

      // 伏击怪物只执行本轮一次攻击，不进入普通战斗，也不保留 HP。
      let damage = effAttack.dmg || 0
      let blocked = false
      if (state._ambush && state._ambush.blocked > 0) {
        if (ShopSystem.consumeBlockForPart(attackPart)) {
          damage = 0
          blocked = true
        }
      }

      // 屏障咒反射：未格挡时反射一半伤害（伏击的袭击者承受，无持久目标则仅提示）
      let reflected = 0
      if (!blocked && state._ambush && state._ambush.reflectTurns > 0) {
        state._ambush.reflectTurns--
        reflected = Math.floor(damage * 0.5)
        EventBus.emit('ui:log', { text: `🪞 屏障咒反射了 ${reflected} 点伤害给 ${enemy.name}！`, type: 'good' })
        damage = Math.max(0, damage - reflected)
      }

      if (!State.get()._godMode) {
        // 蒙眼罩：伏击受到的伤害 +2
        if (typeof RestraintSystem !== 'undefined' && RestraintSystem.hasBlindfold() && damage > 0) {
          damage += 2
          EventBus.emit('ui:log', { text: '😵 蒙着眼罩，伏击的袭击更难躲开，额外 -2 HP。', type: 'danger' })
        }
        state.hp -= damage
      }
      if (!blocked && effAttack.status) StatusSystem.apply(effAttack.status, effAttack.turns, { level: effAttack.level, source: 'enemy' })
      EventBus.emit('ui:log', {
        text: blocked ? `🛡️ 挡住了 ${enemy.name} 的伏击攻击！` : `💥 ${enemy.name} 的攻击造成 ${damage} 点伤害。`,
        type: blocked ? 'good' : 'danger',
      })

      EventBus.emit('state:changed', state)

      // 死亡判定
      if (state.hp <= 0) {
        EventBus.emit('ui:log', { text: '💀 你在伏击中倒下了……', type: 'danger' })
        AmbushSystem.cleanup()
        state.phase = 'gameover'
        EventBus.emit('game:gameover', {})
        return
      }

      // 轮数上限（按难度阶梯）：达到上限即使没掷出双数也强制脱身
      const diffCfg = CONFIG.difficulty[state.difficulty] || {}
      const maxRounds = diffCfg.ambushMaxRounds || CONFIG.dice.ambushMaxRounds || 6
      const diffName = { normal: '普通', hard: '困难', brutal: '残酷' }[state.difficulty] || state.difficulty
      if (round >= maxRounds) {
        EventBus.emit('ui:log', { text: `🛟 伏击已达 ${maxRounds} 轮上限（${diffName}难度），你拼尽全力挣脱了！`, type: 'good' })
        AmbushSystem.cleanup()
        state.phase = 'idle'
        EventBus.emit('state:changed', state)
        GameFlow.afterEvent()
        return
      }

      // 双数的这次攻击仍需完整结算，结算后才脱身。
      if (y === z) {
        EventBus.emit('ui:log', { text: '✨ 双数攻击已经结算，你成功摆脱了伏击！', type: 'good' })
        await AmbushSystem.showEscape(round, y)
        AmbushSystem.cleanup()
        state.phase = 'idle'
        EventBus.emit('state:changed', state)
        GameFlow.afterEvent()
        return
      }

      // 每两次投掷之间最多使用一个物品。
      await AmbushSystem.showIntermission(round)
    }
  },

  showIntro () {
    const state = State.get()
    const diffCfg = CONFIG.difficulty[state.difficulty] || {}
    const maxRounds = diffCfg.ambushMaxRounds || CONFIG.dice.ambushMaxRounds || 6
    return new Promise(resolve => {
      Dialog.show({
        title: '🌫️ 你被伏击了！',
        className: 'ambush-intro-modal',
        body: `
          <div class="ambush-intro">
            <div class="ambush-intro-mark" aria-hidden="true">⚠</div>
            <p class="ambush-intro-lead">雾中有东西扑了上来。反复投掷直到掷出双数或达到上限（最多 ${maxRounds} 轮）。</p>
            <p class="ambush-unavoidable">经过即触发 · 无法回避 · 再次经过仍会触发</p>
            <div class="ambush-rule-grid">
              <div class="ambush-rule"><b>Y 骰</b><span>决定袭击者</span></div>
              <div class="ambush-rule"><b>Z 骰</b><span>决定敌方攻击</span></div>
              <div class="ambush-rule ambush-rule-success"><b>Y = Z</b><span>结算本次攻击后脱身</span></div>
              <div class="ambush-rule ambush-rule-danger"><b>投掷之间</b><span>最多使用 1 个物品</span></div>
            </div>
          </div>`,
        actions: [
          { label: '🎲 开始脱身', cls: 'btn-danger', handler: () => {
            Dialog.close()
            resolve()
          }},
        ],
      })
    })
  },

  showEscape (round, value) {
    return new Promise(resolve => {
      Dialog.show({
        title: '✨ 成功脱身！',
        className: 'ambush-result-modal',
        body: `<div class="ambush-result">
          <div class="ambush-result-dice"><span>Y</span><b>${value}</b><i>=</i><span>Z</span><b>${value}</b></div>
          <p>第 ${round} 轮掷出双数；对应攻击已结算，伏击结束。</p>
        </div>`,
        actions: [
          { label: '继续前进', cls: 'btn-success', handler: () => {
            Dialog.close()
            resolve()
          }},
        ],
      })
    })
  },

  /** 投掷间隙：可直接继续，或选择并使用一个适用于伏击的物品。 */
  showIntermission (round) {
    return new Promise(resolve => {
      const showChoice = () => {
        const state = State.get()
        const items = AmbushSystem.usableItems()
        const actions = []

        if (items.length) {
          actions.push({ label: '🎒 使用物品', cls: 'btn-primary', handler: showItems })
        }
        actions.push({ label: '🎲 继续掷骰', cls: 'btn-danger', handler: () => {
          Dialog.close()
          resolve({ used: false })
        }})

        Dialog.show({
          title: `🌫️ 第 ${round} 轮攻击结束`,
          className: 'ambush-intermission-modal',
          body: `<div class="ambush-intermission">
            <div><span>当前生命</span><b>${Math.max(0, state.hp)} / ${state.maxHp}</b></div>
            <p>${items.length ? '下一次投掷前，你可以使用 1 个物品。' : '没有适合在伏击中使用的物品。'}</p>
          </div>`,
          actions,
        })
      }

      const showItems = () => {
        const items = AmbushSystem.usableItems()
        const body = items.length
          ? `<div class="ambush-item-list">${items.map(({ item, count }) => `
              <button class="ambush-item-use" data-item="${item.id}">
                <span><b>${item.name}</b><small>${item.desc}</small></span>
                <em>×${count}</em>
              </button>`).join('')}</div>`
          : '<p class="ambush-item-empty">没有适合在伏击中使用的物品。</p>'

        Dialog.show({
          title: '🎒 使用物品（本轮限 1 个）',
          className: 'ambush-item-modal',
          body,
          actions: [{ label: '← 返回', handler: showChoice }],
        })

        setTimeout(() => {
          document.querySelectorAll('.ambush-item-use').forEach(btn => {
            btn.onclick = () => {
              const result = ShopSystem.useConsumable(btn.dataset.item)
              if (!result.ok) {
                EventBus.emit('ui:log', { text: result.msg, type: 'danger' })
                showItems()
                return
              }
              Dialog.close()
              // 使用日志由 ShopSystem.useConsumable 统一输出
              resolve({ used: true, item: result.item })
            }
          })
        }, 0)
      }

      showChoice()
    })
  },

  usableItems () {
    const state = State.get()
    return Object.entries(state.inventory.consumables || {}).flatMap(([id, count]) => {
      if (count <= 0) return []
      const item = ItemLib.get(id)
      if (!item || !item.effect) return []
      const effect = item.effect
      // 伏击中没有玩家攻击阶段，因此排除力量宝珠、升级材料、树枝和纯反伤物品。
      if (!(effect.heal || effect.cure || effect.regen || effect.block || effect.reflect)) return []
      if (effect.heal && state.hp >= state.maxHp) return []
      return [{ item, count }]
    })
  },

  cleanup () {
    const state = State.get()
    // 巨肛塞与普通战斗一致：事件结束时自动取下并归还背包。
    if (state._plugActive) ShopSystem.removePlug()
    state._ambush = null
  },

  showTask (enemy, attack) {
    // 复用战斗任务弹窗（含 BPM 节拍器 + 计时器 + debuff 提示）
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      // 解析 BPM 和秒数（与战斗系统一致）
      const bpmMatch = (attack.desc || '').match(/(\d+)\s*BPM/)
      const bpm = bpmMatch ? parseInt(bpmMatch[1]) : 0
      const minMatch = (attack.desc || '').match(/(\d+)\s*分/)
      const secMatch = (attack.desc || '').match(/(\d+)\s*秒/)
      let seconds = 0
      if (minMatch) seconds += parseInt(minMatch[1]) * 60
      if (secMatch) seconds += parseInt(secMatch[1])

      return BattleUI.showTaskDialog({
        enemyName: `🌫️ ${enemy.name}`,
        attackName: attack.name,
        desc: attack.desc,
        bpm,
        seconds,
        dmg: attack.dmg || 0,
        status: attack.status,
        statusTurns: attack.turns,
      }).then(failed => {
        // 伏击不区分完成/没完成，统一按承受伤害结算
        return failed
      })
    }
    // 兜底：简单的承受伤害弹窗
    return new Promise(resolve => {
      Dialog.show({
        title: `🌫️ 伏击 — ${enemy.name}`,
        body: `<p>${enemy.name} 使用了「${attack.name}」</p>
          <p style="color:var(--text-dim);margin-top:6px">${attack.desc}</p>
          <p style="margin-top:8px;color:var(--danger)">伤害: ${attack.dmg || 0}</p>`,
        actions: [
          { label: '✅ 承受伤害', cls: 'btn-danger', handler: () => {
            Dialog.close()
            resolve(false)
          }},
        ],
      })
    })
  },
}

/* ---------- 陷阱系统（桩，正式实现见 systems/index.js） ---------- */
window.TrapSystem = window.TrapSystem || { roll () { GameFlow.afterEvent() } }

/* ---------- 宝藏系统（桩，正式实现见 systems/index.js） ---------- */
window.TreasureSystem = window.TreasureSystem || { collected: [], roll () { GameFlow.afterEvent() } }
