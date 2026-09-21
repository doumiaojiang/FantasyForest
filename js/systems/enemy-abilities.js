/**
 * systems/enemy-abilities.js — 敌人特性、精英词缀与战斗意图
 *
 * 这里只维护可保存的战斗规则；Dialog/HUD 只读取展示数据。
 */

window.EnemyAbilitySystem = (function () {
  const TRAITS = {
    poison: { id: 'poison', icon: '☠️', name: '毒性攻击', desc: '部分攻击会使你中毒；解毒剂可以解除。' },
    charge: { id: 'charge', icon: '⚡', name: '蓄力重击', desc: '会提前一回合蓄力；单次造成至少 4 点伤害可打断。' },
    guard: { id: 'guard', icon: '🛡️', name: '防御姿态', desc: '能够减免下一次普通攻击；暴击或高伤害可以破防。' },
    escape: { id: 'escape', icon: '🏃', name: '伺机逃跑', desc: '生命过低时会准备逃跑；下一次命中可以阻止。' },
    summon: { id: 'summon', icon: '✦', name: '召唤援军', desc: '能够召唤需要单独击败的小兵。' },
    pack: { id: 'pack', icon: '👥', name: '群体作战', desc: '数量会改变攻击效果；最后一只会尝试逃走。' },
    life_link: { id: 'life_link', icon: '💚', name: '生命链接', desc: '你的治疗会有一部分转移给她。' },
  }

  const ELITES = {
    toxic: {
      id: 'toxic', prefix: '剧毒', icon: '☠️', name: '剧毒精英',
      desc: '普通攻击也有概率附加 2 回合中毒。',
      abilities: { poison: { chance: 0.35, turns: 2 } },
    },
    armored: {
      id: 'armored', prefix: '装甲', icon: '🛡️', name: '装甲精英',
      desc: '开场获得一层防御，受到的下一次普通伤害减半。',
      abilities: { guard: { start: 1, reduction: 0.5, breakDamage: 4 } },
    },
    berserk: {
      id: 'berserk', prefix: '狂暴', icon: '⚡', name: '狂暴精英',
      desc: '每 2 个敌方回合会准备一次蓄力重击。',
      abilities: { charge: { every: 2, multiplier: 1.75, interruptDamage: 4 } },
    },
    cunning: {
      id: 'cunning', prefix: '狡猾', icon: '🏃', name: '狡猾精英',
      desc: '生命降至 25% 时会准备逃跑。',
      abilities: { escape: { threshold: 0.25 } },
    },
  }

  function mergeAbilities (enemy, battle) {
    const base = (enemy && enemy.abilities) || {}
    const eliteId = battle && battle.enemyState && battle.enemyState.elite
    const elite = eliteId ? ELITES[eliteId] : null
    return { ...base, ...(elite ? elite.abilities : {}) }
  }

  function elitePool (enemy) {
    const requested = enemy && Array.isArray(enemy.elitePool) ? enemy.elitePool : Object.keys(ELITES)
    const valid = requested.filter(id => ELITES[id])
    return valid.length ? valid : Object.keys(ELITES)
  }

  function chooseElite (enemy, opts) {
    if (!enemy || enemy.props?.isBoss || opts.noElite || opts.elite === false) return null
    const pool = elitePool(enemy)
    if (typeof opts.elite === 'string' && ELITES[opts.elite]) return opts.elite
    if (opts.elite === true) return pool[Math.floor(Math.random() * pool.length)]
    const wins = (State.get().defeated || []).filter(id => id !== 'spirit_of_forest').length
    const minWins = CONFIG.battle.eliteMinWins ?? 2
    const chance = CONFIG.battle.eliteChance ?? 0.15
    if (wins < minWins || Math.random() >= chance) return null
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function createState (enemy, opts = {}) {
    const elite = chooseElite(enemy, opts)
    const previewBattle = { enemyState: { elite } }
    const cfg = mergeAbilities(enemy, previewBattle)
    return {
      elite,
      enemyTurns: 0,
      guard: Math.max(0, Math.floor(cfg.guard?.start || 0)),
      charging: false,
      chargeStrike: false,
      fleeing: false,
      fleeAnnounced: false,
      fleeAttempted: false,
    }
  }

  function eliteDef (battle) {
    const id = battle && battle.enemyState && battle.enemyState.elite
    return id ? ELITES[id] || null : null
  }

  function displayName (enemy, battle) {
    const elite = eliteDef(battle)
    return `${elite ? elite.prefix : ''}${enemy ? enemy.name : '敌人'}`
  }

  function traitsFor (enemy, battle) {
    const list = (enemy && Array.isArray(enemy.traits) ? enemy.traits : [])
      .map(entry => typeof entry === 'string' ? TRAITS[entry] : entry)
      .filter(Boolean)
    const elite = eliteDef(battle)
    if (elite) list.unshift({ id: `elite-${elite.id}`, icon: elite.icon, name: elite.name, desc: elite.desc, elite: true })
    return list
  }

  function statusChips (enemy, battle) {
    if (!battle || !battle.enemyState) return []
    const es = battle.enemyState
    const chips = []
    const elite = eliteDef(battle)
    if (elite) chips.push({ icon: elite.icon, text: elite.prefix, tone: 'elite' })
    if (es.charging || es.chargeStrike) chips.push({ icon: '⚡', text: '蓄力中', tone: 'danger' })
    if (es.guard > 0) chips.push({ icon: '🛡️', text: `防御 ${es.guard}`, tone: 'guard' })
    if (es.fleeing) chips.push({ icon: '🏃', text: '准备逃跑', tone: 'warning' })
    return chips
  }

  function beginEnemyTurn (enemy, battle) {
    if (!enemy || !battle || enemy.props?.isBoss) return { action: 'attack' }
    const es = battle.enemyState || (battle.enemyState = createState(enemy, { noElite: true }))
    const cfg = mergeAbilities(enemy, battle)
    es.enemyTurns = Math.max(0, es.enemyTurns || 0) + 1

    if (es.fleeing) {
      if (es.fleeAnnounced) {
        BattleSystem.enemyEscape('low_hp')
        return { action: 'escaped' }
      }
      es.fleeAnnounced = true
      EventBus.emit('ui:log', { text: `🏃 ${displayName(enemy, battle)}开始寻找退路！下一回合前命中它可以阻止逃跑。`, type: 'danger' })
      EventBus.emit('state:changed', State.get())
      return { action: 'wait', hint: `🏃 ${displayName(enemy, battle)}正在准备逃跑！` }
    }

    if (es.charging) {
      es.charging = false
      es.chargeStrike = true
      EventBus.emit('ui:log', { text: `⚡ ${displayName(enemy, battle)}完成蓄力，发动重击！`, type: 'danger' })
      return { action: 'attack' }
    }

    const every = Math.max(0, Math.floor(cfg.charge?.every || 0))
    if (every > 0 && es.enemyTurns % every === 0) {
      es.charging = true
      EventBus.emit('ui:log', { text: `⚡ ${displayName(enemy, battle)}摆出架势开始蓄力！造成至少 ${cfg.charge.interruptDamage || 4} 点伤害即可打断。`, type: 'danger' })
      EventBus.emit('state:changed', State.get())
      return { action: 'wait', hint: `⚡ ${displayName(enemy, battle)}正在蓄力！` }
    }
    return { action: 'attack' }
  }

  function modifyEnemyAttack (enemy, battle, attack) {
    if (!enemy || !battle || !attack) return attack
    const es = battle.enemyState || (battle.enemyState = createState(enemy, { noElite: true }))
    const cfg = mergeAbilities(enemy, battle)
    const next = { ...attack }

    if (es.chargeStrike) {
      const before = Math.max(0, Number(next.dmg) || 0)
      next.dmg = Math.max(2, Math.ceil(before * (cfg.charge?.multiplier || 1.75)))
      if (!next.keepChargeName) {
        next.name = `蓄力 · ${next.name}`
        next.desc = `${next.desc}（蓄力重击：伤害 ${before} → ${next.dmg}）`
      } else {
        next.desc = `${next.desc}（处刑伤害 ${before} → ${next.dmg}）`
      }
      next.chargedStrike = true
      es.chargeStrike = false
    }

    if (!next.status && (Number(next.dmg) || 0) > 0 && cfg.poison && Math.random() < (cfg.poison.chance || 0)) {
      next.status = 'poisoned'
      next.turns = cfg.poison.turns || 2
      next.poisonBonus = true
    }
    return next
  }

  function modifyPlayerAttack (enemy, battle, result, target) {
    if (!enemy || !battle || !result || result.dmg <= 0) return result
    if (target && target.type !== 'main' && enemy.id !== 'goblins') return result
    const es = battle.enemyState
    if (!es || es.guard <= 0) return result
    const cfg = mergeAbilities(enemy, battle).guard || {}
    const before = result.dmg
    const breakDamage = cfg.breakDamage || 4
    if (result.crit || before >= breakDamage) {
      es.guard = 0
      result.enemyGuardBroken = true
      EventBus.emit('battle:guardBreak', { enemyId: enemy.id })
      EventBus.emit('ui:log', { text: `💥 ${displayName(enemy, battle)}的防御被打破了！`, type: 'good' })
      return result
    }
    result.dmg = Math.max(1, Math.ceil(before * (cfg.reduction || 0.5)))
    es.guard = Math.max(0, es.guard - 1)
    result.enemyGuarded = { before, after: result.dmg }
    EventBus.emit('ui:log', { text: `🛡️ ${displayName(enemy, battle)}挡住部分伤害：${before} → ${result.dmg}`, type: 'dim' })
    return result
  }

  function afterPlayerHit (enemy, battle, target, result) {
    if (!enemy || !battle || !target || !result || result.dmg <= 0 || !battle.enemyState) return
    const es = battle.enemyState
    const cfg = mergeAbilities(enemy, battle)

    if (es.charging && result.dmg >= (cfg.charge?.interruptDamage || 4)) {
      es.charging = false
      es.chargeStrike = false
      EventBus.emit('battle:chargeInterrupt', { enemyId: enemy.id })
      EventBus.emit('ui:log', { text: `💥 你打断了${displayName(enemy, battle)}的蓄力！`, type: 'good' })
    }

    if (es.fleeing) {
      es.fleeing = false
      es.fleeAnnounced = false
      EventBus.emit('battle:escapeStopped', { enemyId: enemy.id })
      EventBus.emit('ui:log', { text: `🎯 你阻止了${displayName(enemy, battle)}逃跑！`, type: 'good' })
      return
    }

    const escapeCfg = cfg.escape
    const isMain = target.type === 'main' || enemy.id === 'goblins'
    if (escapeCfg && isMain && !es.fleeAttempted && target.hp > 0 && target.hp / target.maxHp <= (escapeCfg.threshold || 0.25)) {
      es.fleeing = true
      es.fleeAttempted = true
      es.fleeAnnounced = false
    }
  }

  function applyEliteHealth (battle) {
    if (!eliteDef(battle)) return
    const multiplier = CONFIG.battle.eliteHpMult || 1.5
    battle.targets.forEach(target => {
      target.maxHp = Math.ceil(target.maxHp * multiplier)
      target.hp = target.maxHp
    })
  }

  return {
    TRAITS,
    ELITES,
    createState,
    displayName,
    traitsFor,
    statusChips,
    beginEnemyTurn,
    modifyEnemyAttack,
    modifyPlayerAttack,
    afterPlayerHit,
    applyEliteHealth,
    eliteDef,
  }
})()
