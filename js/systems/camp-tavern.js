/**
 * systems/camp-tavern.js — 酒馆、老板娘、队长、佣兵、附魔师、梦幻商店与酒馆工作。
 */
window.TownTavernSystem = (function () {
  const GLORY_FEE = CampSystem.gloryFee
  const campShow = options => CampSystem.showScene(options)
  const open = opts => CampSystem.open(opts)
  const setCampPhase = () => CampSystem.ensurePhase()
  const townPrice = (price, category) => CampSystem.townPrice(price, category)
  const routeTownService = part => CampSystem.routeTownService(part)
  const townServiceDesc = (part, actor) => CampSystem.townServiceDesc(part, actor)
  const wrongCommissionLead = kind => CampSystem.recordCommissionLead(kind)

  function tavern () {
    setCampPhase()
    renderTavern()
  }

  /** 酒馆主界面：两个人——老顾客 & 老板娘 */
  function renderTavern () {
    const state = State.get()
    const guestGone = (state._tavernGuest || 0) <= 0
    const barkeepClue = state._wrongCommissionStage === 3 && !(state._wrongCommissionLeads || {}).barkeep

    campShow({
      title: '🍺 雾灯酒馆', className: 'camp-tavern-modal',
      body: `<section class="tavern-hero"><div class="tavern-lamp" aria-hidden="true">🕯️</div><div><h3>杯盏轻响，炉火把木墙染成酒红色。</h3><p>老板娘守着吧台，角落的赌桌仍等着下一局。</p></div></section>
        <p class="scene-wallet">钱袋 · <b>${state.gold}G</b></p>
        <div class="tavern-grid">
          <button class="tavern-card tavern-card-barkeep${barkeepClue ? ' is-clue' : ''}" data-tavern="barkeep"><i>💃</i><span><b>酒馆老板娘</b><small>${barkeepClue ? '她守着吧台，后巷的门却关着' : '酒单、闲聊与工作机会'}</small></span><em>${barkeepClue ? '试探' : '去吧台'}</em></button>
          <button class="tavern-card tavern-card-captain" data-tavern="captain"><i>🛡️</i><span><b>守卫队队长</b><small>军官的架子与门道</small></span><em>搭话</em></button>
          <button class="tavern-card tavern-card-enchanter" data-tavern="enchanter"><i>🧙</i><span><b>附魔师</b><small>装备充能、灵魂石与附魔知识</small></span><em>搭话</em></button>
          <button class="tavern-card tavern-card-contract${state._restraintContract && state._restraintContract.ready ? ' is-ready' : ''}" data-tavern="contract"><i>${state._restraintContract && state._restraintContract.ready ? '🏅' : '📜'}</i><span><b>妖缚委托板</b><small>${state._restraintContract ? `${state._restraintContract.name} · ${state._restraintContract.progress}/${state._restraintContract.required}` : '佩戴契约装备完成冒险委托'}</small></span><em>${state._restraintContract ? (state._restraintContract.ready ? '可领奖' : '进行中') : '查看委托'}</em></button>
          ${state._mercenary
            ? `<button class="tavern-card tavern-card-futa${state._mercenaryContract && state._mercenaryContract.debt > 0 ? ' has-debt' : ''}" data-tavern="merc-contract"><i>⚔️</i><span><b>芙蕾雅的佣兵契约</b><small>${state._mercenaryContract && state._mercenaryContract.active ? `${state._mercenaryContract.active.name} · ${state._mercenaryContract.active.progress}/${state._mercenaryContract.active.required}` : state._mercenaryContract && state._mercenaryContract.debt > 0 ? `当前欠款 ${state._mercenaryContract.debt}G` : '还款、垫付与抵债契约'}</small></span><em>${state._mercenaryContract && state._mercenaryContract.debt > 0 ? '处理债务' : '查看'}</em></button>`
            : `<button class="tavern-card tavern-card-futa" data-tavern="futa"><i>⚔️</i><span><b>角落的女战士</b><small>沉默寡言，独自喝着不动的酒</small></span><em>搭话</em></button>`}
          <button class="tavern-card tavern-card-guest ${guestGone ? 'is-empty' : ''}" data-tavern="guest"><i>${guestGone ? '🪑' : '🎲'}</i><span><b>${guestGone ? '空着的赌桌' : '爱赌的老顾客'}</b><small>${guestGone ? '打赢敌人后他会带着 50G 回来' : `还剩 ${state._tavernGuest}G 可赢`}</small></span><em>${guestGone ? '查看' : '开一局'}</em></button>
        </div>`,
      actions: [{ kind: 'navigation', label: '返回营地', handler: () => { open() } }],
    })
    document.querySelectorAll('[data-tavern]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.tavern
        if (opt === 'guest') tavernGuest()
        else if (opt === 'barkeep') TownTavernPatronsSystem.openBarkeep()
        else if (opt === 'captain') TownTavernCaptainSystem.open()
        else if (opt === 'futa') TownTavernPatronsSystem.openFuta()
        else if (opt === 'enchanter') TownTavernPatronsSystem.openEnchanter()
        else if (opt === 'contract') restraintContractBoard()
        else if (opt === 'merc-contract' && window.MercenaryContractSystem) MercenaryContractSystem.openPanel()
      }
    })
  }

  /** 妖缚委托板：一次一个委托，胜利进度由 RestraintContractSystem 统一记录。 */
  function restraintContractBoard () {
    const state = State.get()
    const system = window.RestraintContractSystem
    if (!system) { EventBus.emit('ui:log', { text: '委托板暂时无法使用。', type: 'danger' }); renderTavern(); return }
    const active = system.active()
    const rankName = { easy: '简单', normal: '普通', hard: '困难' }
    const rankIcon = { easy: '🌿', normal: '⚖️', hard: '🔥' }
    let body = `<section class="scene-dialogue"><i>📜</i><div><h3>几张盖着紫蜡的委托钉在木板上。</h3><p>酒馆替委托人保管装备和报酬，接下的契约一次只能有一份。</p></div></section>`
    let actions = [{ kind: 'navigation', label: '返回酒馆', handler: () => { renderTavern() } }]

    if (active) {
      const progress = Math.min(100, Math.round((active.progress / active.required) * 100))
      const gear = active.gear.map(entry => {
        const def = RestraintSystem.defOf(entry.id)
        return `<span>${RestraintSystem.SLOT_ICONS[entry.slot] || '⛓️'} ${def ? def.name : entry.id}</span>`
      }).join('')
      const item = active.rewardItem && ItemLib.get(active.rewardItem)
      body += `<div class="contract-active scene-current-task${active.ready ? ' is-ready' : ''}">
        <div class="contract-active-head"><span><i>${active.ready ? '🏅' : rankIcon[active.rank]}</i><small>${active.ready ? '等待结算' : `${rankName[active.rank]}委托`}</small><b>${active.name}</b></span><em>${active.progress}/${active.required}</em></div>
        <div class="contract-progress"><i style="width:${progress}%"></i></div>
        <p>${active.ready ? '要求已经达成。领取报酬后，所有契约锁和暂借装备会一并回收。' : `继续赢得 ${Math.max(0, active.required - active.progress)} 场普通战斗即可完成。`}</p>
        <div class="contract-gear">${gear}</div>
        <div class="contract-reward"><span>委托报酬</span><b>💎 ${active.rewardGold}G${item ? ` · ${item.name} ×1` : ''}</b></div>
      </div>`
      actions = active.ready
        ? [
            { label: '🏅 领取报酬', cls: 'btn-primary', handler: () => { system.claim(); restraintContractBoard() } },
            { kind: 'navigation', label: '返回酒馆', handler: () => { renderTavern() } },
          ]
        : [
            { label: `放弃委托（最多 ${system.ABANDON_FEE}G）`, cls: 'btn-danger', handler: () => restraintContractAbandonPrompt() },
            { kind: 'navigation', label: '返回酒馆', handler: () => { renderTavern() } },
          ]
    } else {
      const offers = system.ensureOffers()
      body += `<div class="contract-board scene-choice-list">${offers.map(offer => {
        const available = system.availability(offer)
        const rewardItem = offer.rewardItem && ItemLib.get(offer.rewardItem)
        const gear = offer.gear.map(entry => {
          const def = RestraintSystem.defOf(entry.id)
          return def ? def.name : entry.id
        }).join(' · ')
        return `<button class="contract-card rank-${offer.rank}${available.ok ? '' : ' is-disabled'}" data-contract="${offer.id}" ${available.ok ? '' : 'disabled'}>
          <span class="contract-rank">${rankIcon[offer.rank]} ${rankName[offer.rank]}</span><i>${offer.icon}</i><b>${offer.name}</b><small>${offer.desc}</small>
          <span class="contract-gear-line">⛓️ ${gear}</span>
          <em>${available.ok ? `💎 ${offer.rewardGold}G${rewardItem ? ` + ${rewardItem.name}` : ''}` : available.reason}</em>
        </button>`
      }).join('')}</div><details class="scene-notes"><summary>查看契约细则</summary><p>接取后，暂借装备立即上锁；完成前只能回到委托板解约。普通战斗胜利才计入进度，Boss、逃跑与投降不计。</p></details>`
    }

    campShow({ title: '📜 妖缚委托板', className: 'camp-tavern-modal contract-modal', body, actions })
    document.querySelectorAll('[data-contract]').forEach(btn => {
      btn.onclick = () => {
        const result = system.accept(btn.dataset.contract)
        if (!result.ok) EventBus.emit('ui:log', { text: result.msg, type: 'danger' })
        restraintContractBoard()
      }
    })
  }

  function restraintContractAbandonPrompt () {
    const system = window.RestraintContractSystem
    const active = system && system.active()
    if (!active) { restraintContractBoard(); return }
    const payable = Math.min(system.ABANDON_FEE, Math.max(0, State.get().gold || 0))
    Dialog.show({
      title: '📜 放弃妖缚委托？', className: 'camp-tavern-modal contract-confirm-modal',
      body: `<div class="contract-confirm"><i>🔓</i><div><b>解除「${active.name}」</b><p>当前进度会清空，契约装备将被回收，并支付 <strong>${payable}G</strong> 解约金。</p></div></div>`,
      actions: [
        { label: '确认解约', cls: 'btn-danger', handler: () => { Dialog.close(); system.abandon(); restraintContractBoard() } },
        { kind: 'navigation', label: '继续委托', handler: () => Dialog.close() },
      ],
    })
  }

  /** 老顾客：对话 + 赌博 */
  function tavernGuest () {
    const state = State.get()
    const guestGone = (state._tavernGuest || 0) <= 0
    if (guestGone) {
      campShow({
        title: '🎲 老顾客的位子',
        body: '<p>那张椅子空了。你把他的钱赢光，他气得骂骂咧咧地走了。<br><span style="color:var(--text-dim)">打赢一个敌人后，他还会揣着 50G 回来。</span></p>',
        actions: [{ kind: 'navigation', label: '返回酒馆', handler: () => { renderTavern() } }],
      })
      return
    }
    campShow({
      title: '🎲 老顾客',
      className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🧔</i><div><b>“嘿，旅人，来两把骰子不？”</b><p>他晃了晃手里的骰子，咧嘴一笑。兜里还有 ${state._tavernGuest}G，看起来很好赢。</p></div></div>`,
      actions: [
        { label: '🎲 摇骰子赌博', cls: 'btn-primary', handler: () => { TownTavernWorkSystem.openGamble() } },
        { kind: 'navigation', label: '返回酒馆', handler: () => { renderTavern() } },
      ],
    })
  }

  /** 守卫队队长：军官的架子 + 卖妓女许可证（比老板娘多条路子） */

  return {
    open: tavern,
    render: renderTavern,
    guest: tavernGuest,
    serveMercenary: () => TownTavernPatronsSystem.serveMercenary(),
    openDreamShop: () => TownTavernPatronsSystem.openDreamShop(),
  }
})()

