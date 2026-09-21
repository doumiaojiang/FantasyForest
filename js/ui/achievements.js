/** achievements.js — 成就与记录三页签弹窗。 */
window.AchievementsUI = (function () {
  const partNames = { anal: '菊穴', vagina: '小穴', oral: '口部', hand: '手部', body: '身体/打屁股', foot: '足部' }
  const actionNames = { penetration: '抽插', oral: '口交', handjob: '手交', edging: '寸止/摩擦', spanking: '打屁股', service: '服务', other: '其他' }
  const enemyNames = { tentacle: '触手怪', orc: '兽人', sorceress: '魔女', succubus: '魅魔', goblins: '哥布林', werewolf: '狼人' }
  let active = 'overview'
  let onClose = null

  const n = value => Math.max(0, Number(value) || 0).toLocaleString('zh-CN')
  const duration = seconds => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0))
    if (total >= 3600) return `${Math.floor(total / 3600)}小时 ${Math.floor(total % 3600 / 60)}分`
    if (total >= 60) return `${Math.floor(total / 60)}分 ${total % 60}秒`
    return `${total}秒`
  }
  const rewardText = reward => reward.item ? `💠 ${reward.count || 1} 个异变结晶` : `💰 ${reward.gold || 0}G`
  const progress = (def, stats) => Math.min(def.target, StatsSystem.metricValue(def, stats))

  function overview (s) {
    const parts = Object.entries(partNames).map(([id, label]) => `<div class="record-row"><span>${label}</span><b>${n(s.byPart[id].count)} 次</b><small>${duration(s.byPart[id].seconds)} · 估算 ${n(s.byPart[id].thrusts)} 下</small></div>`).join('')
    return `<div class="record-kpis">
      <div><small>任务总数</small><b>${n(s.tasksTotal)}</b><span>完成 ${n(s.tasksCompleted)} · 失败 ${n(s.tasksFailed)}</span></div>
      <div><small>估算动作</small><b>${n(s.estimatedThrusts)}</b><span>按 BPM × 时长计算</span></div>
      <div><small>累计时间</small><b>${duration(s.taskSeconds)}</b><span>最长 ${duration(s.longestTaskSeconds)}</span></div>
      <div><small>最高节拍</small><b>${n(s.maxBpm)} BPM</b><span>最佳连胜 ${n(s.bestStreak)}</span></div>
    </div><h3 class="record-heading">身体部位</h3><div class="record-list">${parts}</div>`
  }

  function achievements (p) {
    const cards = ACHIEVEMENTS.map(def => {
      const unlocked = !!p.achievements.unlocked[def.id]
      const claimed = !!p.achievements.claimed[def.id]
      const value = progress(def, p.stats)
      const pct = Math.min(100, Math.round(value / def.target * 100))
      return `<article class="achievement-card ${unlocked ? 'is-unlocked' : ''} ${claimed ? 'is-claimed' : ''}">
        <i>${def.icon}</i><div><b>${def.name}</b><p>${def.desc}</p><span class="achievement-progress"><em style="width:${pct}%"></em></span><small>${n(value)} / ${n(def.target)} · ${rewardText(def.reward)}</small></div>
        ${claimed ? '<button disabled>已领取</button>' : unlocked ? `<button data-achievement-claim="${def.id}">领取</button>` : '<button disabled>未解锁</button>'}
      </article>`
    }).join('')
    return `<div class="achievement-toolbar"><span>已解锁 <b>${Object.keys(p.achievements.unlocked).length}</b> / ${ACHIEVEMENTS.length}</span>${StatsSystem.pendingCount() ? '<button class="btn btn-success" data-claim-all>全部领取</button>' : ''}</div><div class="achievement-list">${cards}</div>`
  }

  function records (s) {
    const actions = Object.entries(actionNames).map(([id, label]) => `<div class="record-row"><span>${label}</span><b>${n(s.byAction[id].count)} 次</b><small>完成 ${n(s.byAction[id].completed)} · ${duration(s.byAction[id].seconds)}</small></div>`).join('')
    const enemies = StatsSystem.enemyIds.map(id => { const e = s.enemies[id]; return `<div class="record-row enemy-record"><span>${enemyNames[id]}</span><b>${n(e.encounters)} 遭遇 / ${n(e.wins)} 胜</b><small>${n(e.tasks)} 个任务 · ${duration(e.seconds)} · 估算 ${n(e.thrusts)} 下</small></div>` }).join('')
    return `<h3 class="record-heading">动作分类</h3><div class="record-list">${actions}</div>
      <h3 class="record-heading">战斗档案</h3><div class="record-kpis compact"><div><small>战斗</small><b>${n(s.battlesStarted)}</b><span>${n(s.wins)} 胜 · ${n(s.losses)} 负</span></div><div><small>累计伤害</small><b>${n(s.damageDealt)}</b><span>最高单击 ${n(s.maxDamage)}</span></div><div><small>精英击杀</small><b>${n(s.eliteKills)}</b><span>遭遇 ${n(s.eliteEncounters)}</span></div><div><small>脱离战斗</small><b>${n(s.playerEscapes + s.surrenders)}</b><span>敌人逃跑 ${n(s.enemyEscapes)}</span></div></div>
      <div class="record-list">${enemies}</div>
      <h3 class="record-heading">城镇与装备</h3><div class="record-kpis compact"><div><small>木枷</small><b>${duration(s.pillorySeconds)}</b><span>${n(s.pilloryUses)} 次</span></div><div><small>城镇服务</small><b>${n(s.townServices)}</b><span>已完成</span></div><div><small>城门检查</small><b>${n(s.guardChecks)}</b><span>累计次数</span></div><div><small>插入格挡</small><b>${n(s.insertionBlocks)}</b><span>改攻 ${n(s.attackRedirects)} 次</span></div></div>`
  }

  function render () {
    const p = StatsSystem.ensure()
    if (!p) return
    const tabs = [['overview', '总览'], ['achievements', `成就${StatsSystem.pendingCount() ? ` (${StatsSystem.pendingCount()})` : ''}`], ['records', '详细记录']]
    const content = active === 'overview' ? overview(p.stats) : active === 'achievements' ? achievements(p) : records(p.stats)
    Dialog.show({
      title: '🏆 成就与记录', className: 'records-modal',
      body: `<nav class="record-tabs" aria-label="记录分类">${tabs.map(([id, label]) => `<button class="${active === id ? 'is-active' : ''}" data-record-tab="${id}">${label}</button>`).join('')}</nav><div class="record-content">${content}</div>`,
      actions: [{ kind: 'navigation', label: onClose ? '返回营地' : '关闭', handler: () => { Dialog.close(); if (onClose) onClose() } }],
    })
    Dialog.onMount(bind)
  }

  function bind (root) {
    root.querySelectorAll('[data-record-tab]').forEach(btn => { btn.onclick = () => { active = btn.dataset.recordTab; render() } })
    root.querySelectorAll('[data-achievement-claim]').forEach(btn => { btn.onclick = () => { StatsSystem.claim(btn.dataset.achievementClaim); render() } })
    const all = root.querySelector('[data-claim-all]')
    if (all) all.onclick = () => { StatsSystem.claimAll(); render() }
  }

  function open (tab = 'overview', closeHandler = null) { active = tab; onClose = closeHandler; render() }
  return { open }
})()
