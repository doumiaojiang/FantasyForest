/**
 * systems/town-reputation.js — 雾灯镇长期声望与知名度
 *
 * 声望是居民的长期评价；知名度只表示有多少人认识玩家。
 * 无证营业危险值与越狱通缉仍由 camp.js 的原系统独立处理。
 */
window.TownReputationSystem = (function () {
  const RANKS = [
    { id: 'enemy', min: -100, max: -60, icon: '☠️', name: '城镇公敌', tone: 'danger', price: 0.15, guard: 1.35 },
    { id: 'hated', min: -59, max: -30, icon: '⚠️', name: '声名狼藉', tone: 'danger', price: 0.10, guard: 1.20 },
    { id: 'suspicious', min: -29, max: -10, icon: '👁️', name: '麻烦人物', tone: 'warning', price: 0.05, guard: 1.10 },
    { id: 'neutral', min: -9, max: 9, icon: '🧭', name: '外来的旅人', tone: 'neutral', price: 0, guard: 1 },
    { id: 'friendly', min: 10, max: 29, icon: '🤝', name: '镇上的熟面孔', tone: 'good', price: -0.03, guard: 0.95 },
    { id: 'respected', min: 30, max: 59, icon: '🛡️', name: '受信任的冒险者', tone: 'good', price: -0.06, guard: 0.80 },
    { id: 'revered', min: 60, max: 100, icon: '🏰', name: '雾灯镇恩人', tone: 'good', price: -0.10, guard: 0.65 },
  ]

  function st () { return State.get() }
  function data () { return st()._townReputation }
  function settings () { return st()._townReputationSettings || (st()._townReputationSettings = {}) }
  function enabled () { return settings().enabled !== false }
  function clamp (value, min, max) { return Math.max(min, Math.min(max, Math.floor(Number(value) || 0))) }
  function escapeHtml (value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
  }

  function rank (score = data().score) {
    const value = clamp(score, -100, 100)
    return RANKS.find(entry => value >= entry.min && value <= entry.max) || RANKS[3]
  }

  function fameLabel (fame = data().fame) {
    if (fame >= 80) return '全镇皆知'
    if (fame >= 50) return '广为人知'
    if (fame >= 20) return '略有名气'
    if (fame >= 5) return '有人认得'
    if (fame >= 1) return '刚被注意'
    return '无人认识'
  }

  function specialTitles () {
    const state = st()
    const result = []
    if (state.bossDefeated || (state.defeated || []).includes('spirit_of_forest')) result.push('森林解放者')
    if ((state._restraintContractCompleted || 0) >= 5) result.push('妖缚受托人')
    if ((data().counters.pilloryUses || 0) >= 3) result.push('广场名人')
    if (state._prostituteLicensed) result.push('持证服务者')
    if ((data().counters.prisonReleases || 0) > 0) result.push('有前科的旅人')
    if (state._wanted) result.push('监狱逃犯')
    if (state._mercenary && (state._mercenaryContract && state._mercenaryContract.completedCount || 0) >= 3) result.push('芙蕾雅的搭档')
    return result.slice(0, 5)
  }

  function pushHistory (kind, amount, reason) {
    const rep = data()
    rep.history.unshift({
      kind,
      amount: Math.floor(amount),
      reason: String(reason || '城镇事件').slice(0, 60),
      at: Date.now(),
    })
    rep.history = rep.history.slice(0, 12)
  }

  function scaled (amount) {
    const rate = [0.5, 1, 1.5].includes(Number(settings().gainRate)) ? Number(settings().gainRate) : 1
    if (!amount) return 0
    const value = Math.round(amount * rate)
    return value === 0 ? (amount > 0 ? 1 : -1) : value
  }

  function notify (kind, amount, reason, oldRank) {
    if (settings().detailedNotice !== false) {
      const label = kind === 'score' ? '城镇声望' : '知名度'
      EventBus.emit('ui:log', { text: `🏰 ${label} ${amount > 0 ? '+' : ''}${amount}｜${reason}`, type: amount > 0 ? 'good' : amount < 0 ? 'danger' : 'dim' })
    }
    if (kind === 'score') {
      const nextRank = rank()
      if (oldRank && oldRank.id !== nextRank.id) {
        EventBus.emit('ui:log', { text: `${nextRank.icon} 城镇评价变为「${nextRank.name}」。`, type: nextRank.tone === 'danger' ? 'danger' : nextRank.tone === 'warning' ? 'warning' : 'good' })
      }
    }
  }

  function addScore (amount, reason, options = {}) {
    if (!enabled() && !options.force) return 0
    const rep = data()
    const oldRank = rank(rep.score)
    const delta = options.raw ? Math.floor(amount) : scaled(amount)
    const next = clamp(rep.score + delta, -100, 100)
    const actual = next - rep.score
    if (!actual) return 0
    rep.score = next
    pushHistory('score', actual, reason)
    notify('score', actual, reason, oldRank)
    EventBus.emit('state:changed', st())
    State.scheduleAutoSave()
    return actual
  }

  function addFame (amount, reason, options = {}) {
    if (!enabled() && !options.force) return 0
    const rep = data()
    const delta = options.raw ? Math.floor(amount) : scaled(amount)
    const next = clamp(rep.fame + delta, 0, 100)
    const actual = next - rep.fame
    if (!actual) return 0
    rep.fame = next
    pushHistory('fame', actual, reason)
    notify('fame', actual, reason)
    EventBus.emit('state:changed', st())
    State.scheduleAutoSave()
    return actual
  }

  function recordBattle (result) {
    if (!enabled() || !result || !result.victory || result.fled || !result.enemyId) return
    const rep = data()
    if (result.enemyId === 'spirit_of_forest') {
      if (rep.counters.bossRewarded) return
      rep.counters.bossRewarded = 1
      addScore(30, '击败森林之灵')
      addFame(40, '解放森林与村庄')
      return
    }
    rep.counters.enemyKills = (rep.counters.enemyKills || 0) + 1
    const milestones = Math.floor(rep.counters.enemyKills / 3)
    if (milestones > (rep.counters.enemyKillMilestones || 0)) {
      rep.counters.enemyKillMilestones = milestones
      addScore(1, '清理森林中的怪物')
      addFame(1, '冒险战绩传回雾灯镇')
    }
  }

  function recordLegalService (venue = '酒馆') {
    if (!enabled() || settings().serviceEffects === false) return
    const rep = data()
    rep.counters.legalServices = (rep.counters.legalServices || 0) + 1
    if (rep.counters.legalServices % 3 === 0) addFame(1, `${venue}的客人开始认识你`)
  }

  function recordPillory () {
    if (!enabled()) return
    const rep = data()
    rep.counters.pilloryUses = (rep.counters.pilloryUses || 0) + 1
    addFame(1, '在城镇广场完成木枷展示')
  }

  /** 城镇商店价格；许可证、罚款、债务与剧情费用不应调用此函数。 */
  function getPrice (basePrice, category = 'general') {
    const base = Math.max(0, Math.floor(Number(basePrice) || 0))
    if (!enabled() || settings().economy === false || category === 'exempt') return base
    const modifier = rank().price
    return Math.max(base > 0 ? 1 : 0, Math.round(base * (1 + modifier)))
  }

  function guardMultiplier () {
    if (!enabled() || settings().guardEffects === false) return 1
    return rank().guard
  }

  function getServiceIncome (baseIncome) {
    const base = Math.floor(Number(baseIncome) || 0)
    if (base <= 0 || !enabled() || settings().serviceEffects === false) return base
    const current = rank()
    if (!['respected', 'revered'].includes(current.id)) return base
    return base + Math.max(1, Math.round(base * 0.05))
  }

  function guardGreeting () {
    const current = rank()
    if (!enabled() || settings().guardEffects === false) return '“站住，例行检查。”'
    if (current.id === 'revered') return '“是雾灯镇的恩人——按规矩简单看一眼就放行。”'
    if (current.id === 'respected') return '“是你啊。最近森林安稳不少，不过例行检查不能省。”'
    if (current.id === 'friendly') return '“又见面了。把背包打开，很快就好。”'
    if (current.id === 'suspicious') return '“又是你。站好，让我仔细看看。”'
    if (current.id === 'hated' || current.id === 'enemy') return '“全镇都听说过你的事。别耍花样。”'
    return '“站住，例行检查。”'
  }

  function reset () {
    const rep = data()
    Object.assign(rep, {
      score: 0,
      fame: 0,
      history: [],
      counters: { enemyKills: 0, enemyKillMilestones: 0, contractsCompleted: 0, legalServices: 0, prisonReleases: 0, pilloryUses: 0, guardChecks: 0, bossRewarded: 0 },
      seeded: true,
    })
    EventBus.emit('ui:log', { text: '🏰 城镇声望已重置为中立。', type: 'dim' })
    EventBus.emit('state:changed', st())
    State.save()
  }

  function openPanel (onClose) {
    const rep = data()
    const current = rank()
    const scorePercent = Math.round(((rep.score + 100) / 200) * 100)
    const titles = specialTitles()
    const history = rep.history.length
      ? rep.history.slice(0, 5).map(entry => `<li class="town-rep-history-${entry.kind}${entry.amount < 0 ? ' town-rep-history-negative' : ''}"><span>${entry.kind === 'score' ? '🏰' : '📣'} ${escapeHtml(entry.reason)}</span><b>${entry.amount > 0 ? '+' : ''}${entry.amount}</b></li>`).join('')
      : '<li class="is-empty"><span>还没有城镇记录</span></li>'
    const price = Math.round(Math.abs(current.price) * 100)
    const economyText = !enabled() || settings().economy === false ? '未启用' : current.price < 0 ? `购买价格 -${price}%` : current.price > 0 ? `购买价格 +${price}%` : '商店原价'
    const guardText = !enabled() || settings().guardEffects === false ? '未启用' : current.guard < 1 ? `普通检查率 ×${Math.round(current.guard * 100)}%` : current.guard > 1 ? `普通检查率 ×${Math.round(current.guard * 100)}%` : '普通检查率不变'
    Dialog.show({
      title: '🏰 雾灯镇声望',
      className: 'inventory-modal town-reputation-modal',
      body: `<section class="town-rep-hero town-rep-${current.tone}"><i>${current.icon}</i><div><small>MISTLAMP REPUTATION</small><h3>${current.name}</h3><p>${guardGreeting().replace(/[“”]/g, '')}</p></div><strong>${rep.score > 0 ? '+' : ''}${rep.score}</strong></section>
        <div class="town-rep-meter"><div><span>敌视</span><b>城镇评价</b><span>崇敬</span></div><em><i style="width:${scorePercent}%"></i></em></div>
        <div class="town-rep-overview"><span><i>🏰</i><b>${rep.score}</b><small>声望</small></span><span><i>📣</i><b>${rep.fame}</b><small>${fameLabel()}</small></span><span><i>🏷️</i><b>${titles.length}</b><small>特殊称号</small></span></div>
        <div class="town-rep-effects"><span><b>🛒 商店</b><small>${economyText}</small></span><span><b>🛡️ 卫兵</b><small>${guardText}</small></span></div>
        <section class="town-rep-section"><h4>人物履历</h4><div class="town-rep-tags">${titles.length ? titles.map(title => `<span>${escapeHtml(title)}</span>`).join('') : '<span class="is-empty">尚无特殊称号</span>'}</div></section>
        <section class="town-rep-section"><h4>最近变化</h4><ul class="town-rep-history">${history}</ul></section>
        <p class="camp-footnote">危险值与通缉仍是独立的执法状态；高声望不能免除越狱通缉或无证营业处罚。</p>`,
      actions: [{ label: '返回城镇', cls: 'btn-primary', handler: () => { Dialog.close(); if (onClose) onClose() } }],
    })
  }

  EventBus.on('battle:end', recordBattle)

  return {
    RANKS, enabled, settings, rank, fameLabel, specialTitles,
    addScore, addFame, recordLegalService, recordPillory,
    getPrice, getServiceIncome, guardMultiplier, guardGreeting, reset, openPanel,
  }
})()
