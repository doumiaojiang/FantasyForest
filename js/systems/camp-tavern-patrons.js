/**
 * systems/camp-tavern-patrons.js — 老板娘、附魔师、梦境商店与佣兵。
 */
window.TownTavernPatronsSystem = (function () {
  const GLORY_FEE = CampSystem.gloryFee
  const campShow = options => CampSystem.showScene(options)
  const openCamp = opts => CampSystem.open(opts)
  const townPrice = (price, category) => CampSystem.townPrice(price, category)
  const routeTownService = part => CampSystem.routeTownService(part)
  const townServiceDesc = (part, actor) => CampSystem.townServiceDesc(part, actor)
  const wrongCommissionLead = kind => CampSystem.recordCommissionLead(kind)

  function tavernBarkeep () {
    const state = State.get()
    const commissionReady = state._wrongCommissionStage === 3
    const commissionAsked = !!(state._wrongCommissionLeads && state._wrongCommissionLeads.barkeep)
    const workUnlocked = state._tavernWorkUnlocked
    const workBtn = workUnlocked
      ? `<button class="camp-opt" data-tavern="work"><i>💼</i><span><b>打工</b><small>老板娘给指了条赚钱的路</small></span><em>${state._prostituteLicensed ? '营业中' : '看看'}</em></button>`
      : ''
    campShow({
      title: '💃 酒馆老板娘',
      className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>💃</i><div><b>“想喝点什么，还是想聊聊天？”</b><p>她托着腮，指尖轻叩吧台，眉眼带笑。</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-tavern="drink"><i>🍷</i><span><b>买酒</b><small>喝完有劲也有代价</small></span><em>开喝</em></button>
          <button class="camp-opt" data-tavern="chat"><i>💬</i><span><b>聊天</b><small>听老板娘说些有的没的</small></span><em>${workUnlocked ? '熟络' : '搭话'}</em></button>
          ${commissionReady ? `<button class="camp-opt camp-opt-clue${commissionAsked ? ' is-seen' : ''}" data-tavern="wrong-letter"><i>✉️</i><span><b>${commissionAsked ? '再问夜里的车队' : '出示派克的货单'}</b><small>${commissionAsked ? '确认车夫遗失的许可' : '桥边麦秸与酒馆仓库相同'}</small></span><em>${commissionAsked ? '追问' : '调查'}</em></button>` : ''}
          ${workBtn}
        </div>`,
      actions: [{ kind: 'navigation', label: '返回酒馆', handler: () => { Dialog.close(); TownTavernSystem.render() } }],
    })
    document.querySelectorAll('[data-tavern]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.tavern
        Dialog.close()
        if (opt === 'drink') TownTavernWorkSystem.openDrink()
        else if (opt === 'chat') barkeepChat()
        else if (opt === 'wrong-letter') barkeepWrongCommission()
        else if (opt === 'work') TownTavernWorkSystem.open()
      }
    })
  }

  function barkeepWrongCommission () {
    const state = State.get()
    const asked = !!(state._wrongCommissionLeads && state._wrongCommissionLeads.barkeep)
    if (asked) {
      campShow({
        title: '💃 老板娘 · 后巷', className: 'camp-tavern-modal wrong-letter-reaction-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">💃</i><div><h3>“车队已经走了，真正收货的也不是我。”</h3><p>老板娘承认车夫在旧桥弄断了轮轴，还把装许可的皮卷落在桥下。她催你别再问，因为镇里的监督官也在找它。</p></div></section>`,
        actions: [{ kind: 'navigation', label: '换个话题', handler: tavernBarkeep }],
      })
      return
    }
    campShow({
      title: '💃 酒馆 · 吧台', className: 'camp-tavern-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">✉️</i><div><h3>你把派克的货单推过吧台，又放下一把桥边的麦秸。</h3><p>老板娘认出了仓库垫货用的草料。她的笑容没有消失，手却已经悄悄扣住通往后巷的门闩。</p></div></section>
        <div class="scene-choice-list wrong-letter-choices">
          <button data-barkeep-letter="door"><i>▸</i><span><b>“夜里的货车停在后门做什么？”</b><small>追问第一批货物的去向</small></span><em>追问</em></button>
          <button data-barkeep-letter="permit"><i>▸</i><span><b>“派克是谁？谁准许车队进镇？”</b><small>追查货单背后的委托人</small></span><em>查证</em></button>
        </div>`,
      actions: [{ kind: 'navigation', label: '把信收回来', handler: tavernBarkeep }],
    })
    document.querySelectorAll('[data-barkeep-letter]').forEach(btn => {
      btn.onclick = () => finishBarkeepWrongCommission(btn.dataset.barkeepLetter)
    })
  }

  function finishBarkeepWrongCommission (choice) {
    const state = State.get()
    if (!state._pInvestigationChoices || typeof state._pInvestigationChoices !== 'object') state._pInvestigationChoices = {}
    state._pInvestigationChoices.barkeep = choice
    const complete = wrongCommissionLead('barkeep')
    EventBus.emit('ui:log', { text: '🍺 老板娘承认派克的车队在后巷卸过货，而且持有镇方许可。', type: 'warning' })
    campShow({
      title: '💃 老板娘 · 夜间卸货', className: 'camp-tavern-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">💃</i><div><h3>“他们只借后巷拆货。真正签收的人来自镇务厅。”</h3><p>${choice === 'permit' ? '她说卫兵亲自检查过盖章许可，然后替车队打开了侧门。' : '她承认货箱里装着成批的项圈、腕铐和编号牌，天亮前便被运走。'}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>车夫遗失的东西</span><p>车队在旧桥换过断裂的轮轴，装着正式许可的皮卷就是在那里丢的。</p></div>
        ${complete ? '<p class="wrong-letter-after">酒馆和铁匠的说法终于对上了：派克的车队持有镇方许可，而能证明这一点的皮卷还遗落在旧桥。</p>' : ''}`,
      actions: [{ kind: 'navigation', label: '收起信件', handler: tavernBarkeep }],
    })
  }

  const SOUL_GEMS = [
    { id: 'petty_soul_gem', icon: '💠', name: '微型灵魂石', price: 60, charge: 1, desc: '恢复 1 点防护充能' },
    { id: 'lesser_soul_gem', icon: '🔹', name: '次级灵魂石', price: 110, charge: 2, desc: '恢复 2 点防护充能' },
    { id: 'common_soul_gem', icon: '💎', name: '普通灵魂石', price: 180, charge: 99, desc: '将一件插入装备恢复至满充' },
  ]

  /** 酒馆附魔师：对话、充能和灵魂石商店。 */
  function enchanter () {
    const state = State.get()
    const charged = ['anal', 'vagina'].reduce((sum, slot) => {
      const info = typeof RestraintSystem !== 'undefined' ? RestraintSystem.insertionCharge(slot) : null
      return sum + (info ? info.current : 0)
    }, 0)
    const maximum = ['anal', 'vagina'].reduce((sum, slot) => {
      const info = typeof RestraintSystem !== 'undefined' ? RestraintSystem.insertionCharge(slot) : null
      return sum + (info ? info.max : 0)
    }, 0)
    campShow({
      title: '🧙 附魔师', className: 'enchanter-modal',
      body: `<div class="camp-character"><i>🧙</i><div><b>“灵魂会消散，附魔也会枯竭。”</b><p>附魔师放下刻刀，目光扫过你佩戴的装置："想继续让它替你挡住攻击，就把灵魂石和金币放到桌上。"</p></div></div>
        <div class="camp-stats"><span>💎 ${state.gold}G</span><span>⚡ 防护充能 ${charged}/${maximum}</span><span>🔷 灵魂石 ${SOUL_GEMS.reduce((n, gem) => n + (state.inventory.consumables[gem.id] || 0), 0)} 颗</span></div>
        <div class="camp-grid">
          <button class="camp-opt" data-enchanter="charge"><i>⚡</i><span><b>装备充能</b><small>付金币或消耗已装满的灵魂石</small></span><em>${maximum > charged ? '可充能' : maximum > 0 ? '已充满' : '未装备'}</em></button>
          <button class="camp-opt" data-enchanter="shop"><i>💎</i><span><b>购买灵魂石</b><small>微型、次级与普通灵魂石</small></span><em>查看商品</em></button>
          <button class="camp-opt" data-enchanter="chat"><i>💬</i><span><b>对话</b><small>询问灵魂石与附魔的知识</small></span><em>交谈</em></button>
        </div>`,
      actions: [{ kind: 'navigation', label: '返回酒馆', handler: renderTavern }],
    })
    document.querySelectorAll('[data-enchanter]').forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.enchanter
        if (action === 'charge') enchanterRecharge()
        else if (action === 'shop') enchanterSoulShop()
        else enchanterChat()
      }
    })
  }

  function enchanterRecharge () {
    const state = State.get()
    const slots = ['anal', 'vagina'].filter(slot => RestraintSystem.insertionDevice(slot))
    const cards = slots.length ? slots.map(slot => {
      const entry = RestraintSystem.insertionDevice(slot)
      const info = RestraintSystem.insertionCharge(slot)
      const missing = Math.max(0, info.max - info.current)
      const goldCost = townPrice(missing * 30, 'enchanter')
      const methods = [
        `<button class="btn restr-btn" data-recharge-slot="${slot}" data-recharge-method="gold" ${missing > 0 && state.gold >= goldCost ? '' : 'disabled'}>💰 ${missing > 0 ? `充满 · ${goldCost}G` : '已经充满'}</button>`,
        ...SOUL_GEMS.map(gem => `<button class="btn restr-btn" data-recharge-slot="${slot}" data-recharge-method="${gem.id}" ${missing > 0 && (state.inventory.consumables[gem.id] || 0) > 0 ? '' : 'disabled'}>${gem.icon} ${gem.name} ×${state.inventory.consumables[gem.id] || 0}</button>`),
      ].join('')
      return `<div class="restr-card"><i>${RestraintSystem.SLOT_ICONS[slot]}</i><span><b>${entry.def.name}</b><small>${RestraintSystem.SLOT_NAMES[slot]} · 每次抵挡消耗 1 点</small><span class="restr-charge${info.current <= 0 ? ' is-empty' : ''}">⚡ ${info.current}/${info.max}</span></span><div class="restr-actions">${methods}</div></div>`
    }).join('') : '<p class="camp-muted">你没有穿戴任何可充能的插入装备。先去梦幻商店购买并穿戴，再来找我。</p>'
    campShow({
      title: '⚡ 附魔师 · 装备充能', className: 'enchanter-modal',
      body: `<div class="camp-character"><i>⚡</i><div><b>“付金币，我替你直接完成；有灵魂石也可以。”</b><p>金币服务按缺失充能计算，每点 30G。买下的灵魂石也能放进背包，在野外自行使用。</p></div></div><div class="restr-grid">${cards}</div>`,
      actions: [{ kind: 'navigation', label: '返回附魔师', handler: enchanter }],
    })
    document.querySelectorAll('[data-recharge-slot]').forEach(btn => {
      btn.onclick = () => {
        const slot = btn.dataset.rechargeSlot
        const method = btn.dataset.rechargeMethod
        const info = RestraintSystem.insertionCharge(slot)
        if (!info) return
        const missing = Math.max(0, info.max - info.current)
        if (missing <= 0) return
        let added = 0
        if (method === 'gold') {
          const cost = townPrice(missing * 30, 'enchanter')
          if (state.gold < cost) return
          state.gold -= cost
          added = missing
        } else {
          const gem = SOUL_GEMS.find(item => item.id === method)
          if (!gem || (state.inventory.consumables[gem.id] || 0) <= 0) return
          state.inventory.consumables[gem.id]--
          added = Math.min(missing, gem.charge)
        }
        const result = RestraintSystem.setInsertionCharge(slot, info.current + added)
        EventBus.emit('ui:log', { text: `⚡ ${RestraintSystem.SLOT_NAMES[slot]}装备恢复 ${added} 点防护充能（${result.current}/${result.max}）。`, type: 'good' })
        EventBus.emit('state:changed', state)
        enchanterRecharge()
      }
    })
  }

  function enchanterSoulShop () {
    const state = State.get()
    const cards = SOUL_GEMS.map(gem => {
      const count = state.inventory.consumables[gem.id] || 0
      const price = townPrice(gem.price, 'enchanter')
      const canBuy = state.gold >= price
      return `<button class="merchant-item${canBuy ? '' : ' is-unaffordable'}" data-soul-buy="${gem.id}" ${canBuy ? '' : 'disabled'}><span class="merchant-item-icon">${gem.icon}</span><span class="merchant-item-info"><b>${gem.name}</b><small>${gem.desc} · 可在野外从背包使用</small></span><span class="merchant-item-price">${canBuy ? `<b>${price}G</b>${price !== gem.price ? `<s>${gem.price}G</s>` : ''}<small>×${count}</small>` : '<small>金币不足</small>'}</span></button>`
    }).join('')
    campShow({
      title: '💎 附魔师 · 灵魂石', className: 'enchanter-modal',
      body: `<section class="merchant-hero dream-shop-hero"><span aria-hidden="true">💎</span><div><h3>装满灵魂的附魔媒介</h3><p>购买后放进背包；回城可交给附魔师使用，也能在野外自行给装备充能。</p></div></section><div class="merchant-stats"><span>💎 ${state.gold}G</span><span>🔷 已持有 ${SOUL_GEMS.reduce((n, gem) => n + (state.inventory.consumables[gem.id] || 0), 0)} 颗</span></div><div class="merchant-catalog">${cards}</div>`,
      actions: [{ kind: 'navigation', label: '返回附魔师', handler: enchanter }],
    })
    document.querySelectorAll('[data-soul-buy]').forEach(btn => {
      btn.onclick = () => {
        const gem = SOUL_GEMS.find(item => item.id === btn.dataset.soulBuy)
        const price = gem ? townPrice(gem.price, 'enchanter') : 0
        if (!gem || state.gold < price) return
        state.gold -= price
        state.inventory.consumables[gem.id] = (state.inventory.consumables[gem.id] || 0) + 1
        EventBus.emit('ui:log', { text: `💎 买下${gem.name}。`, type: 'good' })
        EventBus.emit('state:changed', state)
        enchanterSoulShop()
      }
    })
  }

  const ENCHANTER_CHATS = [
    '“灵魂石只是容器。越完整的灵魂，能维持的附魔越久。”',
    '“原版天际的宫廷法师会出售灵魂石；至于替客人充能，是我在雾灯镇自己的生意。”',
    '“装置挡下攻击时，里面的灵魂力量会替你承受冲击。耗尽以后，它就只剩原本的用途了。”',
  ]
  function enchanterChat () {
    const line = ENCHANTER_CHATS[Math.floor(Math.random() * ENCHANTER_CHATS.length)]
    campShow({
      title: '💬 附魔师', className: 'enchanter-modal',
      body: `<div class="camp-character"><i>🧙</i><div><b>${line}</b><p>桌上的灵魂石在烛光下泛着幽蓝色光芒。</p></div></div>`,
      actions: [{ label: '再聊聊', handler: enchanterChat }, { kind: 'navigation', label: '返回附魔师', handler: enchanter }],
    })
  }

  /** 梦幻商店当前分类：全部分类保持在同一层级。 */
  let dreamShopCat = 'insert'

  /** 梦幻商店（妖缚商行，营地内）：所有商品使用同一层分类，一步直达。 */
  function ddShop () {
    const state = State.get()
    const all = (RESTRAINTS || []).filter(r => !r.story && !(r.femaleOnly && state.gender === 'male') && !(r.maleOnly && state.gender !== 'male'))
    const isMale = state.gender === 'male'
    const itemIcon = r => {
      if (typeof RestraintSystem === 'undefined') return '⛓️'
      return RestraintSystem.SLOT_ICONS[r.slot] || '⛓️'
    }

    const slotText = slots => slots.map(s => ({ anal: '菊穴', vagina: '小穴' }[s] || s)).join(' / ')

    const insertSizeText = r => {
      if (!Number.isFinite(r.sizeCm)) return '未标注'
      if (r.id.includes('butt_plug') || r.dildo) return `${r.sizeCm} cm${r.sizeCm >= 5.2 ? '以上' : '以下'}`
      return `${r.sizeCm} cm`
    }

    const rpgCardMeta = r => {
      const part = typeof RestraintSystem !== 'undefined' ? (RestraintSystem.SLOT_NAMES[r.slot] || r.slot) : r.slot
      const fixed = {
        lipstick: { tone: 'cosmetic', kind: '妆容装备', part: '口唇', stats: [['类型', '口唇妆容'], ['锁具', '不可上锁']], hint: '可以与全套妆容同时装备', special: '酒馆妓女：口交服务 +20 金币' },
        makeup: { tone: 'cosmetic', kind: '妆容装备', part: '面部', stats: [['类型', '全脸妆容'], ['锁具', '不可上锁']], hint: '可以与口红同时装备', special: '酒馆妓女：口交服务 +30 金币' },
        leather_gag: { tone: 'mouth', kind: '口部装备', part: '嘴部', stats: [['束缚难度', `${r.difficulty} 级`]], hint: '堵住嘴，口交任务无法完成；战斗口交攻击承受单倍伤害', special: '酒馆妓女：不触发口塞加成', warning: '上锁后：酒馆妓女与荣耀洞均不可用' },
        deepthroat_gag: { tone: 'mouth', kind: '口部装备', part: '嘴部', stats: [['束缚难度', `${r.difficulty} 级`]], hint: '固定张口与深喉姿势，口交任务无法完成', special: '酒馆妓女：不触发口塞加成', warning: '上锁后：酒馆妓女与荣耀洞均不可用' },
        slut_gag: { tone: 'mouth', kind: '口部装备', part: '嘴部', stats: [['束缚难度', `${r.difficulty} 级`]], hint: '同时佩戴项圈时，插入任务提升到 180 BPM', special: '酒馆妓女与荣耀洞可用；插入任务 160 BPM · 金币 ×2', warning: '开口结构：上锁后仍可进行性服务', allowLockedService: true },
      }[r.id]
      if (fixed) return fixed
      return {
        tone: r.buff ? 'service' : 'restraint',
        kind: r.buff ? '服务装备' : (r.heavy ? '重型妖缚装备' : '妖缚装备'),
        part,
        stats: [['束缚难度', `${r.difficulty || 1} 级`]],
        hint: r.heavy ? '重型装备，挣脱与解除更加困难' : '可以穿戴，也可以使用普通锁主动上锁',
        special: r.desc,
      }
    }

    /** 普通商品卡（妆容/媚奴/束缚） */
    const renderCard = r => {
      const ownedCount = typeof RestraintSystem !== 'undefined' ? RestraintSystem.ownedCount(r.id) : 0
      const wornThis = typeof RestraintSystem !== 'undefined' && RestraintSystem.hasDevice(r.id)
      const owned = ownedCount > 0 || (state._ownedRestraints || []).includes(r.id) || wornThis || (state._prostituteGear && state._prostituteGear[r.id === 'chastity_device' ? 'chastity' : r.id])
      const full = owned
      const price = townPrice(r.price, 'dream')
      const canBuy = state.gold >= price && !full
      const meta = rpgCardMeta(r)
      const detailHtml = `<span class="rpg-gear-kicker">${meta.kind} · ${meta.part}</span>
          <b class="rpg-gear-name">${r.name}</b>
          <span class="rpg-gear-rule"></span>
          ${meta.stats.map(([label, value]) => `<span class="rpg-gear-stat"><em>${label}</em><strong>${value}</strong></span>`).join('')}
          <small class="rpg-gear-hint">${meta.hint}</small>
          <span class="rpg-gear-special"><em>特殊</em><strong>${meta.special}</strong></span>
          ${meta.warning ? `<span class="rpg-gear-warning${meta.allowLockedService ? ' is-allowed' : ''}">${meta.allowLockedService ? '✓' : '🔒'} ${meta.warning}</span>` : ''}`
      return `<button class="merchant-item rpg-gear-card rpg-gear-${meta.tone}${full ? ' is-owned' : ''}${!full && !canBuy ? ' is-unaffordable' : ''}" data-restr="${r.id}" ${full || !canBuy ? 'disabled' : ''}>
        <span class="merchant-item-icon rpg-gear-icon">${itemIcon(r)}</span>
        <span class="merchant-item-info rpg-gear-info">${detailHtml}</span>
        <span class="merchant-item-price">${full ? '✓ 已拥有' : canBuy ? `<b>${price}G</b>${price !== r.price ? `<s>${r.price}G</s>` : ''}` : '<small>金币不足</small>'}</span>
      </button>`
    }

    /** 插入用品卡：肛塞/假阳具/震动 */
    const renderInsertCard = r => {
      const ownedCount = typeof RestraintSystem !== 'undefined' ? RestraintSystem.ownedCount(r.id) : 0
      const maxOwn = r.dildo ? RestraintSystem.effectiveMaxOwn(r) : (r.stackable ? (r.maxStack || 99) : 1)
      const full = ownedCount >= maxOwn
      const price = townPrice(r.price, 'dream')
      const canBuy = state.gold >= price && !full
      const unit = r.dildo ? '根' : (r.stackable ? '颗' : '个')
      const countText = `${r.dildo ? (isMale ? '男性最多 1 根 · ' : '') : ''}已有 ${ownedCount}/${maxOwn}${unit}`
      const chargeCount = r.stackable ? `${r.block} 次/颗` : `${r.block} 次`
      const bonusText = `酒馆妓女：+${r.prostituteBonus} 金币${r.stackable ? '/颗' : ''}`
      return `<button class="merchant-item rpg-gear-card${full ? ' is-owned' : ''}${!full && !canBuy ? ' is-unaffordable' : ''}" data-restr="${r.id}" ${full || !canBuy ? 'disabled' : ''}>
        <span class="merchant-item-icon rpg-gear-icon">🍑</span>
        <span class="merchant-item-info rpg-gear-info">
          <span class="rpg-gear-kicker">插入装备 · ${slotText(r.allowedSlots)}</span>
          <b class="rpg-gear-name">${r.name}</b>
          <span class="rpg-gear-rule"></span>
          <span class="rpg-gear-stat"><em>尺寸</em><strong>${insertSizeText(r)}</strong></span>
          <span class="rpg-gear-stat"><em>防护充能</em><strong>可充能 ${chargeCount}</strong></span>
          <small class="rpg-gear-hint">每点充能完全抵挡一次对应部位的攻击：0 伤害、0 效果</small>
          <span class="rpg-gear-special"><em>特殊</em><strong>${bonusText}</strong></span>
          ${r.vibrate ? '<small class="rpg-gear-hint">震动控制：关闭 / 低档 / 高档；提高服务收入，同时降低战斗专注与逃跑率</small>' : ''}
          <span class="rpg-gear-warning">🔒 上锁后：酒馆妓女与荣耀洞均不可用</span>
        </span>
        <span class="merchant-item-price">${full ? '已达上限' : canBuy ? `<b>${price}G</b>${price !== r.price ? `<s>${r.price}G</s>` : ''}<small>${countText}</small>` : `<small>金币不足</small>`}</span>
      </button>`
    }

    const tools = [
      { id: 'restraint_lock', name: '普通锁', price: 80, icon: '🔒', desc: '在妖缚装备栏中主动锁住一件已穿戴的装置' },
      { id: 'restraint_key', name: '普通钥匙', price: 200, icon: '🔑', desc: '解开一把普通上锁的妖缚装置' },
      { id: 'master_key', name: '万能钥匙', price: 500, icon: '🗝️', desc: '解开任意非剧情/非诅咒的上锁装置' },
      { id: 'lockpick', name: '开锁工具', price: 150, icon: '🛠️', desc: '60% 概率撬开一把普通上锁的装置，失败则损耗' },
      { id: 'curse_remover', name: '驱咒符', price: 250, icon: '🧿', desc: '解除一件被诅咒锁住的妖缚装置' },
    ]
    const renderToolCard = t => {
      const ownedCount = state.inventory.consumables[t.id] || 0
      const price = townPrice(t.price, 'dream')
      const canBuy = state.gold >= price
      return `<button class="merchant-item rpg-gear-card rpg-gear-tool${!canBuy ? ' is-unaffordable' : ''}" data-tool="${t.id}" ${canBuy ? '' : 'disabled'}>
        <span class="merchant-item-icon rpg-gear-icon">${t.icon}</span>
        <span class="merchant-item-info rpg-gear-info"><span class="rpg-gear-kicker">解锁工具 · 消耗品</span><b class="rpg-gear-name">${t.name}</b><span class="rpg-gear-rule"></span><span class="rpg-gear-stat"><em>当前持有</em><strong>${ownedCount}</strong></span><span class="rpg-gear-special"><em>用途</em><strong>${t.desc}</strong></span></span>
        <span class="merchant-item-price">${canBuy ? `<b>${price}G</b>${price !== t.price ? `<s>${t.price}G</s>` : ''}<small>×${ownedCount}</small>` : '<small>金币不足</small>'}</span>
      </button>`
    }

    const CATS = [
      { key: 'insert', icon: '🍑', label: '插入', title: '插入用品', desc: '肛塞、假阳具、跳蛋与震动棒', items: all.filter(r => r.insert), render: renderInsertCard },
      { key: 'cosmetic', icon: '💄', label: '妆容', title: '妆容装备', desc: '口红与全套妆容，可同时佩戴', items: all.filter(r => r.cosmetic), render: renderCard },
      { key: 'mouth', icon: '👄', label: '口部', title: '口部装备', desc: '不同口塞具有不同的任务限制与加成', items: all.filter(r => r.slot === 'mouth'), render: renderCard },
      { key: 'neck', icon: '🔗', label: '项圈', title: '颈部装备', desc: '奴隶项圈与接客加成项圈', items: all.filter(r => r.slot === 'neck'), render: renderCard },
      { key: 'sensory', icon: '🎀', label: '眼胸', title: '眼部与胸部', desc: '眼罩、乳夹、蝴蝶夹与链式乳夹', items: all.filter(r => ['eyes', 'chest'].includes(r.slot)), render: renderCard },
      { key: 'arms', icon: '⛓️', label: '手臂', title: '手臂束缚', desc: '手铐与反绑束臂器', items: all.filter(r => ['arms', 'arms_heavy'].includes(r.slot)), render: renderCard },
      { key: 'torso', icon: '🩱', label: '躯干', title: '躯干与服装', desc: '束腰、情趣内衣与乳胶衣', items: all.filter(r => ['torso', 'outfit'].includes(r.slot)), render: renderCard },
      { key: 'waist', icon: '🔒', label: '腰部', title: '腰部装备', desc: state.gender === 'male' ? '男性贞操锁' : '女性贞操带', items: all.filter(r => r.slot === 'waist'), render: renderCard },
      { key: 'legs', icon: '👠', label: '腿足', title: '腿部与鞋履', desc: '脚镣、脚链与不同高度的高跟鞋', items: all.filter(r => ['legs', 'feet', 'ankles'].includes(r.slot)), render: renderCard },
      { key: 'tools', icon: '🔑', label: '工具', title: '锁具与解锁工具', desc: '普通锁、钥匙、开锁工具与驱咒符', items: tools, render: renderToolCard },
    ]
    if (!CATS.some(c => c.key === dreamShopCat)) dreamShopCat = 'insert'
    const activeCat = CATS.find(c => c.key === dreamShopCat)
    const navHtml = `<div class="dream-category-grid" aria-label="梦幻商店商品分类">${CATS.map(c => `<button class="dream-category-btn${dreamShopCat === c.key ? ' is-active' : ''}" data-shop-cat="${c.key}" aria-current="${dreamShopCat === c.key ? 'true' : 'false'}"><i>${c.icon}</i><span>${c.label}</span><small>${c.items.length}</small></button>`).join('')}</div>`
    const activeCards = activeCat.items.map(activeCat.render).join('')
    const contentHtml = `<section class="dream-shop-section dream-active-section"><h4><span>${activeCat.icon}</span><b>${activeCat.title}</b><small>${activeCat.desc}</small></h4><div class="merchant-catalog dream-shop-catalog">${activeCards || '<p class="camp-muted">该分类暂无商品</p>'}</div></section>`

    Dialog.show({
      title: '🔮 梦幻商店 · 妖缚商行', className: 'inventory-modal dream-shop-modal',
      body: `<section class="merchant-hero dream-shop-hero dream-shop-hero-compact"><span aria-hidden="true">🔮</span><div><h3>柜台后的帘子轻轻晃动。</h3><p>商人把货物推到灯下，等你挑选。</p></div></section>
        <div class="merchant-stats"><span>💎 ${state.gold}G</span><span>⛓️ 已锁 ${typeof RestraintSystem !== 'undefined' ? RestraintSystem.countLocked() : 0} 件</span><span>💰 战斗金币加成 ${typeof RestraintSystem !== 'undefined' ? Math.round(RestraintSystem.goldBonus() * 100) : 0}%</span></div>
        ${navHtml}
        ${contentHtml}`,
      actions: [{ kind: 'navigation', label: '返回营地', handler: () => { Dialog.close(); openCamp() } }],
    })
    document.querySelectorAll('[data-shop-cat]').forEach(btn => {
      btn.onclick = () => {
        dreamShopCat = btn.dataset.shopCat
        Dialog.close()
        ddShop()
      }
    })
    document.querySelectorAll('[data-restr]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.restr
        const def = RESTRAINTS.find(r => r.id === id)
        if (!def) return
        const price = townPrice(def.price, 'dream')
        if (state.gold < price) return
        if (def.stackable || (def.maxOwn && def.maxOwn > 1)) {
          if (RestraintSystem.ownedCount(def.id) >= (def.stackable ? (def.maxStack || 99) : RestraintSystem.effectiveMaxOwn(def))) return
        } else if (RestraintSystem.ownedCount(def.id) > 0) return
        state.gold -= price
        const grantResult = RestraintSystem.grant(def.id, 1)
        const possibleSlots = typeof RestraintSystem !== 'undefined'
          ? RestraintSystem.allowedSlotsOf(def).filter(slot => !RestraintSystem.get(slot) && RestraintSystem.canEquip(slot, def.id).ok)
          : []
        // 单一可用槽位直接穿戴；多可用槽位（如假阳具菊穴+小穴）留在装备栏由玩家决定。
        const equipResult = possibleSlots.length === 1
          ? RestraintSystem.equip(possibleSlots[0], def.id, { locked: false, source: 'dream_shop' })
          : null
        const equipped = !!(equipResult && equipResult.ok)
        const isDildo = !!def.dildo
        const logText = def.stackable
          ? (equipped ? `🔮 你买下并塞入了 1 颗${def.name}。` : `🔮 你买下了 1 颗${def.name}（现有 ${grantResult.count} 颗）；可在妖缚装备栏调整塞入数量。`)
          : isDildo
            ? (equipped ? `🔮 你买下并戴上了${def.name}（${grantResult.count}/${RestraintSystem.effectiveMaxOwn(def)} 根）。` : `🔮 你买下了${def.name}（${grantResult.count}/${RestraintSystem.effectiveMaxOwn(def)} 根）；可在妖缚装备栏选择菊穴/小穴穿戴。`)
            : (equipped ? `🔮 你买下并戴上了${def.name}（已拥有，可随时脱下重穿）。` : `🔮 你买下了${def.name}；可在妖缚装备栏中选择可用部位穿戴。`)
        EventBus.emit('ui:log', { text: logText, type: 'good' })
        EventBus.emit('state:changed', state)
        ddShop()
      }
    })
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.tool
        const tool = { restraint_lock: { name: '普通锁', price: 80 }, restraint_key: { name: '普通钥匙', price: 200 }, master_key: { name: '万能钥匙', price: 500 }, lockpick: { name: '开锁工具', price: 150 }, curse_remover: { name: '驱咒符', price: 250 } }[id]
        const price = tool ? townPrice(tool.price, 'dream') : 0
        if (!tool || state.gold < price) return
        state.gold -= price
        state.inventory.consumables[id] = (state.inventory.consumables[id] || 0) + 1
        EventBus.emit('ui:log', { text: `🔑 买下${tool.name}。`, type: 'good' })
        EventBus.emit('state:changed', state)
        ddShop()
      }
    })
  }

  /** 扶她战士芙蕾雅：坐在酒馆角落，可闲聊，花 1000G 招募后从酒馆消失 */
  const FUTA_WARRIOR = { id: 'futa_warrior', name: '芙蕾雅', icon: '⚔️', dmg: 2, price: 1000, desc: '沉默寡言的扶她女战士，据说身上有点特别——酒馆的人都避着她坐。' }
  function tavernFuta () {
    const state = State.get()
    const hired = !!state._mercenary
    campShow({
      title: '⚔️ 芙蕾雅', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>⚔️</i><div><b>“……有事？”</b><p>一个英气十足的扶她战士占着角落的座位，面前的酒没动过。她扫你一眼，又低头擦拭剑刃。</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-futa="chat"><i>💬</i><span><b>闲聊</b><small>听听她的来历</small></span><em>搭话</em></button>
          ${hired ? '' : `<button class="camp-opt" data-futa="hire"><i>🤝</i><span><b>招募她（1000G）</b><small>战斗中你攻击命中后，她补上 2 点伤害</small></span><em>${state.gold >= 1000 ? '可雇' : '钱不够'}</em></button>`}
        </div>`,
      actions: [{ kind: 'navigation', label: '返回酒馆', handler: () => { Dialog.close(); TownTavernSystem.render() } }],
    })
    document.querySelectorAll('[data-futa]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.futa
        Dialog.close()
        if (opt === 'chat') futaChat()
        else if (opt === 'hire') hireFuta()
      }
    })
  }

  /** 扶她战士闲聊：随机循环 */
  const FUTA_CHATS = [
    { title: '💬 芙蕾雅 · 来历', body: `<div class="camp-character"><i>⚔️</i><div><b>“我打过很多仗。”</b><p>她语气平淡：“命硬，死不了。你呢，看起来也像个能打的。”</p></div></div>` },
    { title: '💬 芙蕾雅 · 战利品', body: `<div class="camp-character"><i>⚔️</i><div><b>“森林里那些怪物，砍起来顺手。”</b><p>她掂了掂剑：“你要是敢去，我可以跟着。不过……价钱不低。”</p></div></div>` },
    { title: '💬 芙蕾雅 · 酒馆', body: `<div class="camp-character"><i>⚔️</i><div><b>“老板娘的酒不错，但我不能喝。”</b><p>她顿了顿：“喝多了，容易出事。”</p></div></div>` },
    { title: '💬 芙蕾雅 · 身体', body: `<div class="camp-character"><i>⚔️</i><div><b>“想问什么直说。”</b><p>她挑起眉：“我确实和普通女人不太一样。介意的话，现在就可以走。”</p></div></div>` },
    { title: '💬 芙蕾雅 · 雇主', body: `<div class="camp-character"><i>⚔️</i><div><b>“我跟过的雇主，没几个活到最后。”</b><p>她低低笑了一声：“但都不是我杀的——是他们自己蠢死的。”</p></div></div>` },
  ]
  function futaChat () {
    const state = State.get()
    let pool = FUTA_CHATS
    if (state._futaLastChat !== undefined && FUTA_CHATS[state._futaLastChat]) {
      pool = FUTA_CHATS.filter((_, i) => i !== state._futaLastChat)
    }
    const idx = Math.floor(Math.random() * pool.length)
    const pick = pool[idx]
    state._futaLastChat = FUTA_CHATS.indexOf(pick)
    EventBus.emit('state:changed', state)
    campShow({
      title: pick.title, className: 'camp-tavern-modal', body: pick.body,
      actions: [
        { label: '再聊聊', handler: () => { Dialog.close(); futaChat() } },
        { kind: 'navigation', label: '返回她身边', handler: () => { Dialog.close(); tavernFuta() } },
      ],
    })
  }

  /** 招募扶她战士：1000G，永久常驻 */
  function hireFuta () {
    const state = State.get()
    if (state._mercenary) { tavernFuta(); return }
    const canFinance = state.gold < FUTA_WARRIOR.price && window.MercenaryContractSystem && MercenaryContractSystem.canFinanceRecruitment(FUTA_WARRIOR.price)
    campShow({
      title: '⚔️ 招募芙蕾雅', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>⚔️</i><div><b>“一千金币，买我这条命。”</b><p>她站起身，比你高出半个头：“你攻击的时候我会跟上补刀。你要是打空了，我也收招。”她顿了顿，“我不会死——但你要是死了，我会护到你咽气。”</p></div></div>
        ${state.gold < FUTA_WARRIOR.price ? `<div class="merc-rule-list"><span>随身金币 ${state.gold}G</span><span>还差 ${FUTA_WARRIOR.price - state.gold}G</span><span>${canFinance ? '可申请招募分期' : '招募分期当前不可用'}</span></div>` : ''}`,
      actions: [
        ...(state.gold >= FUTA_WARRIOR.price ? [{ label: '💸 花 1000G 招募', cls: 'btn-primary', handler: () => {
          if (state.gold < FUTA_WARRIOR.price) { hireFuta(); return }
          state.gold -= 1000
          state._mercenary = { id: 'futa_warrior', name: '芙蕾雅', icon: '⚔️', dmg: 2, lust: 0 }
          EventBus.emit('ui:log', { text: '⚔️ 芙蕾雅加入了你的队伍！你攻击命中后她会补上 2 点伤害。', type: 'good' })
          EventBus.emit('state:changed', state)
          Dialog.close()
          if (window.MercenaryContractSystem) MercenaryContractSystem.showIntro(renderTavern)
          else TownTavernSystem.render()
        } }] : []),
        ...(canFinance ? [{ label: '🤝 分期招募芙蕾雅', cls: 'btn-primary', handler: () => {
          MercenaryContractSystem.offerRecruitmentFinance(
            { id: FUTA_WARRIOR.id, name: FUTA_WARRIOR.name, icon: FUTA_WARRIOR.icon, dmg: FUTA_WARRIOR.dmg, lust: 0 },
            FUTA_WARRIOR.price,
            renderTavern,
          )
        } }] : []),
        { kind: 'navigation', label: '返回', handler: () => { Dialog.close(); tavernFuta() } },
      ],
    })
  }

  /** 服务佣兵：选择服务方式降低性欲（口交 -20 / 肛交 -30 / 性交 -30，女性专用） */
  function closeMercenaryService () {
    // 佣兵服务以前是 Dialog 弹窗，现在使用营地内嵌面板。
    // 在营地内返回酒馆；从地图 HUD 打开则关闭面板并恢复地图。
    if (State.get().phase === 'camp') TownTavernSystem.render()
    else campClose()
  }

  function serveMercenary () {
    const state = State.get()
    const merc = state._mercenary
    if (!merc || merc.dead) { EventBus.emit('ui:log', { text: '没有可服务的佣兵。', type: 'dim' }); return }
    if ((merc.lust || 0) < 25) {
      EventBus.emit('ui:log', { text: `${merc.icon} ${merc.name} 现在很冷静，暂时不需要服务。`, type: 'dim' })
      return
    }
    const isFemale = state.gender !== 'male'
    const oralLocked = townServicePartLocked('oral')
    const analLocked = townServicePartLocked('anal')
    const vaginaLocked = townServicePartLocked('vagina')
    const sexBtn = isFemale && !ChastitySystem.isWorn()
      ? `<button class="camp-opt" data-serve="sex" ${vaginaLocked ? 'disabled' : ''}><i>🌸</i><span><b>性交服务</b><small>${vaginaLocked ? '小穴装备已上锁，无法使用' : '主动骑上去，用小穴好好伺候她'}</small></span><em>${vaginaLocked ? '已锁定' : '欲 -30'}</em></button>`
      : ''
    campShow({
      title: `💋 服务佣兵 · ${merc.icon} ${merc.name}`,
      className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>${merc.icon}</i><div><b>“嗯……人家有点忍不住了。”</b><p>她脸颊泛红，腿间已经湿了。性欲 <b>${Math.min(100, merc.lust || 0)}%</b>。选一种方式喂饱她吧。</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-serve="oral" ${oralLocked ? 'disabled' : ''}><i>👄</i><span><b>口交服务</b><small>${oralLocked ? '口部装备已上锁，无法使用' : '跪下来含住她的鸡巴卖力吞吐'}</small></span><em>${oralLocked ? '已锁定' : '欲 -20'}</em></button>
          <button class="camp-opt" data-serve="anal" ${analLocked ? 'disabled' : ''}><i>🍑</i><span><b>肛交服务</b><small>${analLocked ? '菊穴装备已上锁，无法使用' : '撅起屁股让她从背后操进来'}</small></span><em>${analLocked ? '已锁定' : '欲 -30'}</em></button>
          ${sexBtn}
        </div>`,
      actions: [{ kind: 'navigation', label: '返回', handler: closeMercenaryService }],
    })
    document.querySelectorAll('[data-serve]').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.serve
        Dialog.close()
        runMercenaryService(type)
      }
    })
  }

  /** 执行佣兵服务任务 */
  async function runMercenaryService (type) {
    const state = State.get()
    const merc = state._mercenary
    if (!merc || merc.dead) return
    const requestedPart = { oral: 'oral', anal: 'anal', sex: 'vagina' }[type]
    if (requestedPart && townServicePartLocked(requestedPart)) {
      EventBus.emit('ui:log', { text: '🔒 这个部位被妖缚装备锁住了，无法用于服务。', type: 'danger' })
      serveMercenary()
      return
    }
    const cfg = {
      oral: { name: '口交服务', dmg: 20, steps: [
        { desc: '你跪在她腿间，含住她硬邦邦的鸡巴卖力吞吐，深喉吞到底', bpm: 0, seconds: 30 },
        { desc: '你一边深喉一边用手揉着她的蛋蛋，把她伺候得腿软', bpm: 0, seconds: 30 },
      ] },
      anal: { name: '肛交服务', dmg: 30, steps: [
        { desc: '你趴跪在床沿，撅起屁股，让她从背后狠狠操进你的菊穴', bpm: 90, seconds: 30 },
        { desc: '她掐着你的腰猛操，你咬着枕头承受，她越来越兴奋', bpm: 90, seconds: 30 },
      ] },
      sex: { name: '性交服务', dmg: 30, steps: [
        { desc: '你躺下来张开腿，让她挺着粗壮的鸡巴狠狠操进你的小穴', bpm: 90, seconds: 30 },
        { desc: '你主动用双腿缠住她的腰，迎合着她的抽插，浪叫连连', bpm: 90, seconds: 30 },
      ] },
    }[type]
    if (!cfg) return
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      for (let i = 0; i < cfg.steps.length; i++) {
        const step = cfg.steps[i]
        const f = await BattleUI.showTaskDialog({
          enemyName: `${merc.icon} ${merc.name}（第 ${i + 1}/${cfg.steps.length} 段）`,
          attackName: cfg.name,
          desc: step.desc,
          bpm: step.bpm || 0,
          seconds: step.seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName: '她那根粗壮的鸡巴',
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm(`给${merc.name}做${cfg.name}（完成代表伺候完了）。`)
    }
    if (failed) {
      EventBus.emit('ui:log', { text: `🏃 你半途停下来，${merc.icon} ${merc.name} 不满地瞪了你一眼（性欲没降）。`, type: 'danger' })
      EventBus.emit('state:changed', state)
      closeMercenaryService()
      return
    }
    merc.lust = Math.max(0, (merc.lust || 0) - cfg.dmg)
    EventBus.emit('ui:log', { text: `💋 你给${merc.icon} ${merc.name}做了${cfg.name}，她满足地哼了一声，性欲降到 ${merc.lust}%。`, type: 'good' })
    if (window.MercenaryContractSystem) MercenaryContractSystem.recordService('mercenary')
    EventBus.emit('state:changed', state)
    closeMercenaryService()
  }

  /** 老板娘聊天：随机循环闲话；聊到打工话题后解锁打工 */
  const BARKEEP_CHATS = [
    { title: '💬 老板娘 · 营地的规矩', body: `<div class="camp-character"><i>💃</i><div><b>“厕所那间隔间，你进去过了吧？”</b><p>她压低声音，眼神暧昧：“那里能赚快钱。姐这儿，也有别的路子。”</p></div></div>` },
    { title: '💬 老板娘 · 缺人', body: `<div class="camp-character"><i>💃</i><div><b>“我这儿正好缺人手。”</b><p>她朝角落努努嘴：“当服务员跑跑腿，或者……穿上点凉快的衣裳，陪客人乐乐，来钱快。”</p></div></div>` },
    { title: '💬 老板娘 · 闲话家常', body: `<div class="camp-character"><i>💃</i><div><b>“老顾客那骰子可邪门，别把命搭进去。”</b><p>她给自己倒了杯酒：“要是手头紧，姐这儿随时欢迎你来干活。”</p></div></div>` },
    { title: '💬 老板娘 · 林子的传闻', body: `<div class="camp-character"><i>💃</i><div><b>“听说林子里最近多了些不长眼的怪物。”</b><p>她擦着酒杯：“你要是胆子够大，出门右转进林子里，能捡到不少好东西。”</p></div></div>` },
    { title: '💬 老板娘 · 酒馆的风云', body: `<div class="camp-character"><i>💃</i><div><b>“隔壁桌那些赌棍，输急了眼连裤子都敢押。”</b><p>她呷了口酒：“你可别学他们，姐这儿不赊账。”</p></div></div>` },
    { title: '💬 老板娘 · 今晚的风', body: `<div class="camp-character"><i>💃</i><div><b>“夜里风凉，当心别在林子里过夜。”</b><p>她往炉子里添了根柴：“我这酒馆，永远给你留着一盏灯。”</p></div></div>` },
    { title: '💬 老板娘 · 铁匠铺', body: `<div class="camp-character"><i>💃</i><div><b>“新来的铁匠可有一手好手艺。”</b><p>她朝门口努努嘴：“他打的家伙什儿结实，你要是想换把趁手的兵器，去找他准没错。”</p></div></div>` },
    { title: '💬 老板娘 · 两间商店', body: `<div class="camp-character"><i>💃</i><div><b>“镇上的货，现在分得可细。”</b><p>她压低声音：“药剂和旅途补给找道具商；塞入物、锁具那些稀奇玩意儿，得去梦幻商店。”</p></div></div>` },
    { title: '💬 老板娘 · 旅行商人走了', body: `<div class="camp-character"><i>💃</i><div><b>“诶，你听说了没？老旅行商人走了。”</b><p>她擦着吧台叹了口气：“说是咱这镇子越来越大了，他得赶去别的穷地方做生意。往后补给、装备，就得靠镇上的铁匠和道具商了。”</p></div></div>` },
    { title: '💬 老板娘 · 镇子变大了', body: `<div class="camp-character"><i>💃</i><div><b>“这几年镇子是一天比一天热闹。”</b><p>她给自己倒了杯酒：“铁匠铺、道具铺一个个开起来，就剩我这酒馆还守着老味道。”</p></div></div>` },
  ]
  function barkeepChat () {
    const state = State.get()
    state._barkeepChatCount = (state._barkeepChatCount || 0) + 1
    const n = state._barkeepChatCount
    let title, body, unlock = false

    // 已从队长那办证：老板娘的反应不一样
    if (state._prostituteLicensed && state._prostituteBoughtFromCaptain) {
      title = '💬 老板娘 · 哟，有证了'
      body = `<div class="camp-character"><i>💃</i><div><b>“哟，这是从队长那儿办的证？”</b><p>她挑眉扫了你一眼：“行啊，攀上军官的高枝了。那家伙办的证……啧，反正你也入行了，姐这儿的活，随时欢迎你。”</p></div></div>`
      if (!state._tavernWorkUnlocked) {
        unlock = true
        state._tavernWorkUnlocked = true
        body += `<p class="scene-status-line is-safe"><span>老板娘收下许可证</span><b>工作簿已开放</b></p>`
      }
      EventBus.emit('state:changed', state)
      campShow({
        title, className: 'camp-tavern-modal', body,
        actions: [
          { label: unlock ? '💼 看看打工的事' : '再聊两句', cls: unlock ? 'btn-primary' : 'btn', handler: () => { Dialog.close(); unlock ? TownTavernWorkSystem.open() : barkeepChat() } },
          { kind: 'navigation', label: '返回老板娘', handler: () => { Dialog.close(); tavernBarkeep() } },
        ],
      })
      return
    }

    // 第一次：打招呼
    if (n === 1) {
      title = '💬 老板娘 · 初来乍到'
      body = `<div class="camp-character"><i>💃</i><div><b>“新来的？第一次来姐这酒馆吧。”</b><p>她擦着杯子打量你：“营地里什么人都有，别惹麻烦，有事儿来找我。”</p></div></div>`
    } else {
      // 第 3 次聊天解锁打工
      if (n >= 3 && !state._tavernWorkUnlocked) {
        unlock = true
        state._tavernWorkUnlocked = true
      }
      // 随机循环对话（避免与上次重复）
      let pool = BARKEEP_CHATS
      if (state._barkeepLastChat !== undefined && BARKEEP_CHATS[state._barkeepLastChat]) {
        pool = BARKEEP_CHATS.filter((_, i) => i !== state._barkeepLastChat)
      }
      const idx = Math.floor(Math.random() * pool.length)
      const pick = pool[idx]
      state._barkeepLastChat = BARKEEP_CHATS.indexOf(pick)
      title = pick.title
      body = pick.body
      if (unlock) body += `<p class="scene-status-line is-safe"><span>老板娘把工作簿推到你面前</span><b>工作入口已开放</b></p>`
    }
    EventBus.emit('state:changed', state)
    campShow({
      title, className: 'camp-tavern-modal',
      body,
      actions: [
        { label: unlock ? '💼 看看打工的事' : '再聊两句', cls: unlock ? 'btn-primary' : 'btn', handler: () => { Dialog.close(); unlock ? TownTavernWorkSystem.open() : barkeepChat() } },
        { kind: 'navigation', label: '返回老板娘', handler: () => { Dialog.close(); tavernBarkeep() } },
      ],
    })
  }

  /** 打工界面：服务员（暂不开放）/ 妓女 */

  return {
    openBarkeep: tavernBarkeep,
    openEnchanter: enchanter,
    openFuta: tavernFuta,
    serveMercenary,
    openDreamShop: ddShop,
  }
})()
