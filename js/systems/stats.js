/** stats.js — 存档内统计、成就解锁与领奖。 */
window.StatsSystem = (function () {
  const PARTS = ['anal', 'vagina', 'oral', 'hand', 'body', 'foot']
  const ACTIONS = ['penetration', 'oral', 'handjob', 'edging', 'spanking', 'service', 'other']
  const DEPTHS = ['shallow', 'medium', 'deep', 'free', 'none']
  const ENEMIES = ['tentacle', 'orc', 'sorceress', 'succubus', 'goblins', 'werewolf']
  let initialized = false

  const bucket = () => ({ count: 0, completed: 0, failed: 0, seconds: 0, thrusts: 0, damage: 0 })
  const mapBuckets = keys => Object.fromEntries(keys.map(key => [key, bucket()]))
  const enemyBucket = () => ({ encounters: 0, tasks: 0, completed: 0, failed: 0, seconds: 0, thrusts: 0, damageDealt: 0, wins: 0, losses: 0, eliteEncounters: 0, eliteKills: 0, escapes: 0 })

  function defaults () {
    return {
      version: 1,
      seeded: false,
      stats: {
        tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0, consecutiveCompleted: 0, bestStreak: 0,
        taskSeconds: 0, estimatedThrusts: 0, maxBpm: 0, longestTaskSeconds: 0,
        byPart: mapBuckets(PARTS), byAction: mapBuckets(ACTIONS), byDepth: mapBuckets(DEPTHS),
        enemies: Object.fromEntries(ENEMIES.map(id => [id, enemyBucket()])),
        battlesStarted: 0, wins: 0, losses: 0, playerEscapes: 0, surrenders: 0, enemyEscapes: 0,
        eliteEncounters: 0, eliteKills: 0, bossKills: 0, damageDealt: 0, damageTaken: 0,
        criticalHits: 0, maxDamage: 0, guardBreaks: 0, chargeInterrupts: 0, escapeStops: 0,
        insertionBlocks: 0, attackRedirects: 0, steps: 0, traps: 0, treasures: 0,
        pilloryUses: 0, pillorySeconds: 0, guardChecks: 0, townServices: 0,
      },
      achievements: { unlocked: {}, claimed: {} },
    }
  }

  function mergeObject (target, source) {
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {}
        mergeObject(target[key], source[key])
      } else if (target[key] === undefined || !Number.isFinite(target[key]) && typeof source[key] === 'number') target[key] = source[key]
    })
    return target
  }

  function ensure (state = State.get()) {
    if (!state) return null
    if (!state._profile || typeof state._profile !== 'object') state._profile = defaults()
    mergeObject(state._profile, defaults())
    const p = state._profile
    if (!p.seeded) {
      const defeated = Array.isArray(state.defeated) ? state.defeated : []
      p.stats.wins = Math.max(p.stats.wins, defeated.length)
      defeated.forEach(id => { if (p.stats.enemies[id]) p.stats.enemies[id].wins++ })
      p.stats.bossKills = state.bossDefeated ? Math.max(1, p.stats.bossKills) : p.stats.bossKills
      const c = state._townReputation && state._townReputation.counters || {}
      p.stats.guardChecks = Math.max(p.stats.guardChecks, Number(c.guardChecks) || 0)
      p.stats.pilloryUses = Math.max(p.stats.pilloryUses, Number(c.pilloryUses) || 0)
      p.stats.townServices = Math.max(p.stats.townServices, Number(c.legalServices) || 0)
      p.seeded = true
    }
    return p
  }

  function touch () {
    const state = State.get()
    if (!state) return
    evaluate(true)
    EventBus.emit('stats:changed', state._profile)
    EventBus.emit('state:changed', state)
  }

  function addBucket (b, payload, thrusts) {
    if (!b) return
    b.count++
    b[payload.completed ? 'completed' : 'failed']++
    b.seconds += payload.seconds
    b.thrusts += thrusts
    b.damage += payload.damage
  }

  function recordTask (raw = {}) {
    const p = ensure()
    if (!p) return
    const s = p.stats
    const payload = {
      source: String(raw.source || 'other'), enemyId: raw.enemyId || null,
      action: ACTIONS.includes(raw.action) ? raw.action : 'other',
      part: PARTS.includes(raw.part) ? raw.part : 'body',
      depth: DEPTHS.includes(raw.depth) ? raw.depth : 'none',
      bpm: Math.max(0, Number(raw.bpm) || 0), seconds: Math.max(0, Number(raw.seconds) || 0),
      damage: Math.max(0, Number(raw.damage) || 0), completed: raw.completed !== false,
    }
    const thrusts = payload.bpm > 0 ? Math.round(payload.bpm * payload.seconds / 60) : 0
    s.tasksTotal++
    s[payload.completed ? 'tasksCompleted' : 'tasksFailed']++
    s.consecutiveCompleted = payload.completed ? s.consecutiveCompleted + 1 : 0
    s.bestStreak = Math.max(s.bestStreak, s.consecutiveCompleted)
    s.taskSeconds += payload.seconds
    s.estimatedThrusts += thrusts
    s.maxBpm = Math.max(s.maxBpm, payload.bpm)
    s.longestTaskSeconds = Math.max(s.longestTaskSeconds, payload.seconds)
    addBucket(s.byPart[payload.part], payload, thrusts)
    addBucket(s.byAction[payload.action], payload, thrusts)
    addBucket(s.byDepth[payload.depth], payload, thrusts)
    if (payload.enemyId && s.enemies[payload.enemyId]) {
      const e = s.enemies[payload.enemyId]
      e.tasks++; e[payload.completed ? 'completed' : 'failed']++
      e.seconds += payload.seconds; e.thrusts += thrusts
    }
    if (['glory', 'tavern', 'pillory_service'].includes(payload.source) && payload.completed) s.townServices++
    touch()
  }

  function metricValue (def, s) {
    if (def.metric) return Number(s[def.metric]) || 0
    if (def.check === 'allParts') return ['oral', 'anal', 'vagina', 'hand', 'body'].filter(k => s.byPart[k].completed > 0).length
    if (def.check === 'allActions') return ['penetration', 'oral', 'handjob', 'edging', 'spanking'].filter(k => s.byAction[k].completed > 0).length
    if (def.check === 'allDepths') return ['shallow', 'medium', 'deep'].filter(k => s.byDepth[k].completed > 0).length
    if (def.check === 'allEnemies') return ENEMIES.filter(k => s.enemies[k].encounters > 0).length
    return 0
  }

  function evaluate (notify = true) {
    const p = ensure()
    if (!p) return []
    const unlocked = []
    ACHIEVEMENTS.forEach(def => {
      if (!p.achievements.unlocked[def.id] && metricValue(def, p.stats) >= def.target) {
        p.achievements.unlocked[def.id] = Date.now()
        unlocked.push(def)
        if (notify) EventBus.emit('ui:log', { text: `🏆 成就解锁：${def.name}（可在成就记录中领奖）`, type: 'good' })
      }
    })
    return unlocked
  }

  function taskMeta (enemyId, roll, part) {
    const base = ENEMY_TASK_META[enemyId] && ENEMY_TASK_META[enemyId][roll]
    if (!base) return { source: 'battle', enemyId, action: 'other', part: part || 'body', depth: 'none' }
    const actualPart = part || base.part
    const actualAction = actualPart === 'oral' ? 'oral' : actualPart === 'body' && base.action === 'penetration' ? 'spanking' : base.action
    return { source: 'battle', enemyId, action: actualAction, part: actualPart, depth: actualPart === 'body' ? 'none' : base.depth }
  }

  function claim (id) {
    const state = State.get(); const p = ensure(state)
    const def = ACHIEVEMENTS.find(a => a.id === id)
    if (!def || !p.achievements.unlocked[id] || p.achievements.claimed[id]) return false
    const reward = def.reward || {}
    if (reward.gold) state.gold += reward.gold
    if (reward.item) state.inventory.consumables[reward.item] = (state.inventory.consumables[reward.item] || 0) + (reward.count || 1)
    p.achievements.claimed[id] = Date.now()
    EventBus.emit('ui:log', { text: `🎁 已领取「${def.name}」奖励`, type: 'good' })
    EventBus.emit('state:changed', state)
    State.save()
    return true
  }

  function claimAll () {
    let count = 0
    ACHIEVEMENTS.forEach(def => { if (claim(def.id)) count++ })
    return count
  }

  function pendingCount () {
    const p = ensure(); if (!p) return 0
    return ACHIEVEMENTS.filter(a => p.achievements.unlocked[a.id] && !p.achievements.claimed[a.id]).length
  }

  function init () {
    if (initialized) return
    initialized = true
    EventBus.on('game:init', () => { ensure(); evaluate(false) })
    EventBus.on('game:load', () => { ensure(); evaluate(false) })
    EventBus.on('task:complete', recordTask)
    EventBus.on('movement:arrive', () => { const p = ensure(); if (p) { p.stats.steps++; touch() } })
    EventBus.on('trap:trigger', () => { const p = ensure(); if (p) { p.stats.traps++; touch() } })
    EventBus.on('treasure:find', () => { const p = ensure(); if (p) { p.stats.treasures++; touch() } })
    EventBus.on('battle:start', ({ enemy, battle } = {}) => {
      const p = ensure(); if (!p || !enemy) return
      p.stats.battlesStarted++
      if (p.stats.enemies[enemy.id]) {
        p.stats.enemies[enemy.id].encounters++
        if (battle && battle.enemyState && battle.enemyState.elite) { p.stats.enemies[enemy.id].eliteEncounters++; p.stats.eliteEncounters++ }
      }
      touch()
    })
    EventBus.on('battle:attack', ({ result } = {}) => {
      const p = ensure(); if (!p || !result) return
      const dmg = Math.max(0, Number(result.dmg) || 0)
      p.stats.damageDealt += dmg; p.stats.maxDamage = Math.max(p.stats.maxDamage, dmg)
      const state = State.get(); const enemyId = state && state._battle && state._battle.enemyId
      if (enemyId && p.stats.enemies[enemyId]) p.stats.enemies[enemyId].damageDealt += dmg
      if (result.crit) p.stats.criticalHits++
      touch()
    })
    EventBus.on('battle:end', data => {
      const p = ensure(); if (!p || !data) return
      const s = p.stats; const e = data.enemyId && s.enemies[data.enemyId]
      if (data.enemyEscaped) { s.enemyEscapes++; if (e) e.escapes++ }
      else if (data.surrendered) s.surrenders++
      else if (data.fled) s.playerEscapes++
      else if (data.victory) { s.wins++; if (e) e.wins++ }
      else { s.losses++; if (e) e.losses++ }
      if (data.elite) { s.eliteKills++; if (e) e.eliteKills++ }
      touch()
    })
    EventBus.on('boss:defeat', () => { const p = ensure(); if (p) { p.stats.bossKills++; touch() } })
    ;[['battle:guardBreak', 'guardBreaks'], ['battle:chargeInterrupt', 'chargeInterrupts'], ['battle:escapeStopped', 'escapeStops'], ['battle:insertionBlock', 'insertionBlocks'], ['battle:redirect', 'attackRedirects'], ['town:guardCheck', 'guardChecks']].forEach(([event, key]) => {
      EventBus.on(event, () => { const p = ensure(); if (p) { p.stats[key]++; touch() } })
    })
    EventBus.on('town:pilloryComplete', ({ seconds } = {}) => { const p = ensure(); if (p) { p.stats.pilloryUses++; p.stats.pillorySeconds += Math.max(0, Number(seconds) || 0); touch() } })
  }

  init()
  return { init, ensure, recordTask, evaluate, taskMeta, claim, claimAll, pendingCount, metricValue, enemyIds: ENEMIES }
})()
