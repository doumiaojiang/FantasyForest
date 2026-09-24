/** systems/camp.js — 出生点东侧的安全营地。 */
window.CampSystem = (function () {
  const GLORY_FEE = 30
  function townPrice (price, category = 'general') {
    return window.TownReputationSystem ? TownReputationSystem.getPrice(price, category) : price
  }
  function setCampPhase () {
    const state = State.get()
    if (state.phase !== 'camp') {
      state.phase = 'camp'
      EventBus.emit('state:changed', state)
    }
    // 进入营地：隐藏操作栏与浮动方向键
    const actionBar = document.getElementById('action-bar')
    if (actionBar) actionBar.classList.add('hidden')
    const float = document.getElementById('dpad-float')
    if (float) float.classList.add('hidden')
  }

  /** 根据营地在当前窗口中的实际位置分配高度，避免关键按钮落到首屏外。 */
  function fitCampViewport () {
    const panel = document.getElementById('camp-panel')
    const gameBody = panel && panel.closest('.game-body')
    const inner = panel && panel.querySelector('.camp-panel-inner')
    const battleArea = panel && panel.nextElementSibling
    if (!gameBody || !inner || panel.classList.contains('panel-hidden') || window.innerWidth <= 700) {
      if (gameBody) {
        gameBody.style.removeProperty('--camp-inner-height')
        gameBody.style.removeProperty('--camp-side-height')
      }
      return
    }
    const safeBottom = 12
    const innerTop = inner.getBoundingClientRect().top
    const sideTop = battleArea ? battleArea.getBoundingClientRect().top : innerTop
    gameBody.style.setProperty('--camp-inner-height', `${Math.max(260, window.innerHeight - innerTop - safeBottom)}px`)
    gameBody.style.setProperty('--camp-side-height', `${Math.max(260, window.innerHeight - sideTop - safeBottom)}px`)
  }

  let campResizeFrame = 0
  window.addEventListener('resize', () => {
    cancelAnimationFrame(campResizeFrame)
    campResizeFrame = requestAnimationFrame(fitCampViewport)
  })

  /** 营地页面渲染：写入页面容器而非弹窗层 */
  function campShow (options) {
    const { title, body, actions = [], className = '' } = options
    const navigation = actions.map((action, index) => ({ ...action, index })).filter(action => action.kind === 'navigation')
    const commands = actions.map((action, index) => ({ ...action, index })).filter(action => action.kind !== 'navigation')
    const footerActions = [...navigation, ...commands]
    const panel = document.getElementById('camp-panel')
    if (!panel) { Dialog.show(options); return }
    const mapPanel = document.getElementById('map-panel')
    if (mapPanel) mapPanel.classList.add('panel-hidden')
    panel.classList.remove('panel-hidden')
    panel.innerHTML = `
      <div class="camp-panel-inner modal-box ${className}">
        ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
        <div class="modal-body">${body}</div>
        ${footerActions.length ? `<div class="modal-actions${navigation.length ? ' action-bar has-navigation' : ''}">${footerActions.map(a =>
          `<button class="btn ${a.kind === 'navigation' ? 'btn-navigation' : (a.cls || '')}" ${a.disabled ? 'disabled' : ''} data-action="${a.index}">${a.kind === 'navigation' ? '<span aria-hidden="true">↩</span> ' : ''}${a.label}</button>`
        ).join('')}</div>` : ''}
      </div>`
    panel.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.action)
        const a = actions[idx]
        if (a && a.handler) a.handler()
      })
    })
    // 连续两帧测量，兼容读档时 HUD 与营地在同一轮更新的情况。
    requestAnimationFrame(() => {
      fitCampViewport()
      // 手机端从长列表进入子场景时，不能沿用列表底部的滚动位置。
      if (window.innerWidth <= 700) {
        const revealPanelTop = () => {
          const topbar = document.getElementById('topbar')
          const topOffset = (topbar ? topbar.getBoundingClientRect().height : 0) + 8
          panel.scrollIntoView({ block: 'start', behavior: 'auto' })
          window.scrollBy({ top: -topOffset, behavior: 'auto' })
        }
        revealPanelTop()
        requestAnimationFrame(revealPanelTop)
        setTimeout(revealPanelTop, 0)
      }
      requestAnimationFrame(fitCampViewport)
    })
  }

  /** 营地页面关闭：恢复地图 */
  function campClose () {
    const panel = document.getElementById('camp-panel')
    if (panel) { panel.classList.add('panel-hidden'); panel.innerHTML = '' }
    const mapPanel = document.getElementById('map-panel')
    if (mapPanel) mapPanel.classList.remove('panel-hidden')
  }

  function open (opts = {}) {
    const state = State.get()
    const wrongCommissionLeads = state._wrongCommissionLeads || { barkeep: false, blacksmith: false }
    setCampPhase()
    // 在监狱里：强制回到牢房工作，无法离开
    if (state._inPrison) {
      TownPrisonSystem.resume()
      return
    }
    // 车队押送与普通战败的城门交接都是可存档强制剧情，刷新后从当前一幕继续。
    if (((state._pCaravanEscortStage || 0) > 0 || state._pDefeatDispatchPending) && window.GameFlow && GameFlow.resumeCampStory) {
      GameFlow.resumeCampStory()
      return
    }
    // 桥洞败北后原衣被锁：进镇必须经过一次可存档的可见异常检查。
    if ((state._pBanditGateReactionPending || opts.gateEntry) && (state._pBanditClothesLocked || (state._pBanditDefeatCount || 0) > 0) && StatusSystem.has('naked')) {
      state._pBanditGateReactionPending = true
      State.save()
      TownGateSystem.showBanditNakedGate('enter')
      return
    }
    // 木枷任务属于可存档的进行中流程；刷新或读档后必须回到尚未结算的阶段。
    if (state._pillory) {
      TownPillorySystem.resume()
      return
    }
    // 已经开始的酒馆任务不可跳过结算，但普通欠债不能压过首次主线演出。
    if (state._prostitutePendingTask) {
      state._prostituteLicensed = true
      state._prostituteDressed = true
      const pending = state._prostitutePendingTask
      runCustomerTask(pending.customerKey, pending.z, pending.stepIndex)
      return
    }
    // 序章结束后的首次城门换岗属于关键演出，优先于可重复的厕所/酒馆追债。
    if ((state._wrongCommissionStage || 0) >= 10 && (state._pMainlineStage || 0) < 2) {
      PrologueSystem.showPGateChapter()
      return
    }
    // 未完成的强制流程会持久化；若装备锁死服务部位，先允许在营地内寻找解锁办法，避免软锁。
    const forcedGlory = (state._gloryDebt || 0) > 0 || state._gloryFreeService
    const gloryGearBlocked = forcedGlory && TownGlorySystem.lockedServiceGear().length > 0
    if (forcedGlory && !gloryGearBlocked) {
      TownGlorySystem.showWork()
      return
    }
    // 打工欠款同样属于强制流程，刷新或重进营地不能绕过。
    if ((state._prostituteDebt || 0) > 0) {
      state._prostituteLicensed = true
      state._prostituteDressed = true
      prostitute()
      return
    }
    // 奴隶线第一章 Stage 9500 的第二次派克会面可存档恢复。
    if (state._pRole === 'slave' && state._pMChapterStage === 9500 && !state._pMChapterCompleted && state.phase !== 'battle') {
      PMEnslavementSystem.open()
      return
    }
    // 仅地图移动进入营地时触发城门检查
    if (opts.gateEntry && TownGateSystem.shouldSearch('enter')) {
      TownGateSystem.showSearchPrompt('enter')
      return
    }
    // 第一次平安进入营地时，以场景事件投下主线线索；旧存档也只会触发一次。
    if ((state._wrongCommissionStage || 0) === 0) {
      receiveWrongCommission()
      return
    }
    const deerStatus = state._campDeerTaken ? '已领取' : '有礼物'
    const toiletStatus = state._gloryDiscovered ? '已解锁' : '可探索'
    const toiletHint = state._gloryDiscovered ? '普通厕所 · 隐藏隔间已发现' : '普通厕所 · 隔间有些不一样'
    const townRank = window.TownReputationSystem ? TownReputationSystem.rank() : { icon: '🧭', name: '外来的旅人', tone: 'neutral' }
    const townFame = window.TownReputationSystem ? TownReputationSystem.fameLabel() : '无人认识'
    campShow({
      title: '⛺ 林缘营地',
      className: 'camp-modal',
      body: `
        <section class="camp-hero">
          <div class="camp-fire" aria-hidden="true"><span>🔥</span></div>
          <div><h3>篝火还暖着，森林暂时安静。</h3><p>铁砧声从小路那头传来，酒馆的门还开着。</p></div>
        </section>
        <div class="camp-stats" aria-label="营地状态"><span>❤️ ${state.hp}/${state.maxHp}</span><span>💎 ${state.gold} 金币</span><span>🧭 出生点东侧</span></div>
        <button class="town-rep-strip town-rep-${townRank.tone}" data-town-reputation><i>${townRank.icon}</i><span><small>雾灯镇评价</small><b>${townRank.name}</b><em>📣 ${state._townReputation ? state._townReputation.fame : 0} · ${townFame}</em></span><strong>${state._townReputation && state._townReputation.score > 0 ? '+' : ''}${state._townReputation ? state._townReputation.score : 0}</strong></button>
        <div class="camp-grid">
          ${state._wrongCommissionStage >= 7 && state._wrongCommissionStage <= 9 ? `<button class="camp-opt camp-opt-clue" data-opt="p-townhall"><i>⚖️</i><span><b>镇务厅</b><small>${state._wrongCommissionStage === 7 ? '带蕾娜与名单前去作证' : state._wrongCommissionStage === 8 ? '镇长正在等待更多口供' : '带齐证词向镇长复命'}</small></span><em>主线</em></button>` : ''}
          ${state._wrongCommissionStage === 8 ? '<button class="camp-opt camp-opt-clue" data-opt="p-guard"><i>🛡️</i><span><b>城门值守</b><small>核对车队入城记录</small></span><em>调查</em></button><button class="camp-opt camp-opt-clue" data-opt="p-merchant"><i>📦</i><span><b>商会柜台</b><small>追查器具订单与付款人</small></span><em>调查</em></button><button class="camp-opt camp-opt-clue" data-opt="p-citizen"><i>👥</i><span><b>街口人群</b><small>确认新制度的传闻</small></span><em>调查</em></button>' : ''}
          ${state._pMainlineStage === 2 && state._pChapterOneLocked ? (state._pRole === 'slave' ? `<button class="camp-opt camp-opt-clue" data-opt="p-m-chapter"><i>${state._pMEscort && state._pMEscort.started && !state._pMEscort.completed ? '🏙️' : '⛓️'}</i><span><b>奴隶线·第一章</b><small>${state._pMEscort && state._pMEscort.started && !state._pMEscort.completed ? `继续九格押送 · ${(state._pMEscort.position || 0) + 1}/9` : (state._pMChapterStage || 0) === 0 ? '从城门登记后的失去意识开始' : (state._pMChapterStage || 0) === 3000 && (state._pMChapterStep || 0) >= 3 ? '当前开放至初见派克' : '继续第一章剧情'}</small></span><em>${(state._pMChapterStage || 0) === 3000 && (state._pMChapterStep || 0) >= 3 ? '已完成' : '主线'}</em></button>` : '<button class="camp-opt" disabled><i>🏛️</i><span><b>自由身第一章</b><small>后续章节尚在制作中</small></span><em>未开放</em></button>') : ''}
          <button class="camp-opt camp-opt-tavern${state._wrongCommissionStage === 3 && !wrongCommissionLeads.barkeep ? ' camp-opt-clue' : ''}" data-opt="tavern"><i>🍺</i><span><b>雾灯酒馆</b><small>${state._wrongCommissionStage === 3 && !wrongCommissionLeads.barkeep ? '桥边麦秸指向酒馆后门' : '摇骰子、买酒'}</small></span><em>${state._wrongCommissionStage === 3 && !wrongCommissionLeads.barkeep ? '有线索' : '营业中'}</em></button>
          <button class="camp-opt camp-opt-blacksmith${state._wrongCommissionStage === 3 && !wrongCommissionLeads.blacksmith ? ' camp-opt-clue' : ''}" data-opt="blacksmith"><i>🔨</i><span><b>铁匠铺</b><small>${state._wrongCommissionStage === 3 && !wrongCommissionLeads.blacksmith ? '桥边锁环带着新锉痕' : '武器与饰品'}</small></span><em>${state._wrongCommissionStage === 3 && !wrongCommissionLeads.blacksmith ? '有线索' : '营业中'}</em></button>
          <button class="camp-opt camp-opt-potion" data-opt="potion"><i>🧪</i><span><b>道具商</b><small>药品与旅途补给</small></span><em>营业中</em></button>
          <button class="camp-opt camp-opt-dream" data-opt="ddshop"><i>🔮</i><span><b>梦幻商店</b><small>插入装备·妖缚装置·解锁工具</small></span><em>营业中</em></button>
          <button class="camp-opt camp-opt-glory" data-opt="glory"><i>🚻</i><span><b>公共厕所</b><small>${toiletHint}</small></span><em>${toiletStatus}</em></button>
          <button class="camp-opt camp-opt-prison" data-opt="prison"><i>⛓️</i><span><b>监狱</b><small>无证卖淫的归宿</small></span><em>${state._inPrison ? '在押' : '戒备'}</em></button>
          ${(state._pillorySettings || {}).enabled !== false ? '<button class="camp-opt camp-opt-pillory" data-opt="pillory"><i>🪵</i><span><b>城镇广场木枷</b><small>公开展示 · 自愿打工 · 契约抵债</small></span><em>可使用</em></button>' : ''}
          <button class="camp-opt camp-opt-deer" data-opt="deer"><i>🦌</i><span><b>篝火旁的鹿</b><small>旅人的初次见面礼</small></span><em>${deerStatus}</em></button>
          <button class="camp-opt camp-opt-teleport" data-opt="teleport"><i>🌀</i><span><b>传送阵</b><small>点亮过的传送阵可互相传送</small></span><em>${(state._teleports || []).length}/${TELEPORTS.length}</em></button>
        </div>
        ${gloryGearBlocked ? `<div class="work-rule">🔒 你仍欠荣耀洞 <b>${Math.max(0, state._gloryDebt || 0)}G</b>${state._gloryFreeService ? '，还有一单免费服务未完成' : ''}。当前妖缚装备阻止服务，可先在营地购买钥匙、驱咒符或找铁匠解锁；债务结清前仍不能出城。</div>` : ''}
        <details class="scene-notes"><summary>查看旅途札记</summary><p>在营地停留不消耗回合。离开后，从来时的位置继续探索。</p></details>`,
      actions: [{ label: state._prostituteLicensed ? '⚠️ 离开营地，接受卫兵盘问' : '← 离开营地，继续冒险', cls: state._prostituteLicensed ? 'btn-danger' : 'btn-primary', handler: () => TownGateSystem.leave() }],
    })
    document.querySelectorAll('.camp-opt').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.opt
        if (opt === 'potion') {
          TownShopSystem.openPotionShop()
        } else if (opt === 'p-m-chapter') {
          PMEnslavementSystem.open()
        } else if (opt === 'p-townhall') {
          PrologueSystem.pTownHall()
        } else if (opt === 'p-guard' || opt === 'p-merchant' || opt === 'p-citizen') {
          PrologueSystem.investigatePTown(opt.slice(2))
        } else if (opt === 'blacksmith') {
          TownShopSystem.openBlacksmith()
        } else if (opt === 'glory') TownGlorySystem.open()
        else if (opt === 'tavern') TownTavernSystem.open()
        else if (opt === 'prison') TownPrisonSystem.open()
        else if (opt === 'pillory') TownPillorySystem.open()
        else if (opt === 'deer') deer()
        else if (opt === 'teleport') campTeleport()
        else if (opt === 'ddshop') TownTavernSystem.openDreamShop()
      }
    })
    const reputationBtn = document.querySelector('[data-town-reputation]')
    if (reputationBtn && window.TownReputationSystem) reputationBtn.onclick = () => TownReputationSystem.openPanel(open)
  }

  /** 原版序章式错投事件：神秘的派克把运输货单送错了人。 */
  function receiveWrongCommission () {
    const state = State.get()
    const copy = PROLOGUE_CONTENT.letter
    state._wrongCommissionStage = 1
    EventBus.emit('ui:log', { text: '📖 主线开启：欲缚镇 · 序章', type: 'good' })
    EventBus.emit('ui:log', { text: '✉️ 一个陌生信使把署名派克的货单按进你手里。', type: 'warning' })
    EventBus.emit('state:changed', state)
    State.save()
    campShow({
      title: copy.arrival.title,
      className: 'camp-tavern-modal wrong-letter-modal prologue-scene-modal',
      body: `<section class="wrong-letter-arrival">
          <i aria-hidden="true">✉️</i>
          <div><p>${copy.arrival.text}</p></div>
        </section>
        <section class="p-hall-order"><span>${copy.arrival.speaker}</span><blockquote>${copy.arrival.line}</blockquote></section>
        <div class="wrong-letter-envelope"><span>${copy.envelope.label}</span><b>${copy.envelope.recipient}</b><em>${copy.envelope.seal}</em></div>`,
      actions: [
        { label: copy.arrival.open, cls: 'btn-primary', handler: readWrongCommission },
        { label: copy.arrival.deny, handler: denyWrongCommission },
        { kind: 'navigation', label: copy.arrival.pocket, handler: () => pocketWrongCommission(false) },
      ],
    })
  }

  /** 否认身份也不会拆信，信使看过封口就把货单留下。 */
  function denyWrongCommission () {
    const copy = PROLOGUE_CONTENT.letter
    EventBus.emit('ui:log', { text: '✉️ 信使不肯听解释，把派克的货单留在你手里后钻进了雾里。', type: 'warning' })
    campShow({
      title: copy.denied.title,
      className: 'camp-tavern-modal wrong-letter-modal prologue-scene-modal',
      body: `<section class="wrong-letter-arrival">
          <i aria-hidden="true">✉️</i>
          <div><p>${copy.denied.text}</p></div>
        </section>
        <section class="p-hall-order"><span>${copy.denied.speaker}</span><blockquote>${copy.denied.line}</blockquote></section>
        <div class="wrong-letter-envelope"><span>${copy.envelope.label}</span><b>${copy.envelope.recipient}</b><em>${copy.envelope.seal}</em></div>`,
      actions: [
        { label: copy.arrival.open, cls: 'btn-primary', handler: readWrongCommission },
        { kind: 'navigation', label: copy.arrival.pocket, handler: () => pocketWrongCommission(true) },
      ],
    })
  }

  function pocketWrongCommission (alreadyLeft) {
    if (!alreadyLeft) EventBus.emit('ui:log', { text: '✉️ 你没有拆信。信使把沉默当成认领，转身钻进了雾里。', type: 'dim' })
    open()
  }

  function readWrongCommission () {
    const state = State.get()
    if ((state._wrongCommissionStage || 0) < 2) {
      state._wrongCommissionStage = 2
      EventBus.emit('ui:log', { text: '📜 货单要求把两批约束器具经旧桥送往酒馆与铁匠铺。', type: 'warning' })
      EventBus.emit('state:changed', state)
      State.save()
    }
    showWrongCommissionLetter()
  }

  function showWrongCommissionLetter () {
    const state = State.get()
    const copy = PROLOGUE_CONTENT.letter.document
    campShow({
      title: copy.title,
      className: 'camp-tavern-modal wrong-letter-modal prologue-scene-modal',
      body: `<section class="wrong-letter-paper" aria-label="错投的委托信">
          <p>${copy.greeting}</p>
          ${copy.paragraphs.map(text => `<p>${text}</p>`).join('')}
          <footer>${copy.sign}</footer>
        </section>
        <p class="wrong-letter-after">${PrologueSystem.letterAfterText(state)}</p>`,
      actions: [{ kind: 'navigation', label: copy.close, handler: open }],
    })
  }

  function wrongCommissionLead (kind) {
    const state = State.get()
    if (!state._wrongCommissionLeads) state._wrongCommissionLeads = { barkeep: false, blacksmith: false }
    state._wrongCommissionLeads[kind] = true
    const complete = state._wrongCommissionLeads.barkeep && state._wrongCommissionLeads.blacksmith
    if (complete) state._wrongCommissionStage = 4
    EventBus.emit('state:changed', state)
    State.save()
    return complete
  }

  function campTeleport () {
    const state = State.get()
    const activated = (state._teleports || [])
    const options = TELEPORTS.filter(t => t.id !== 'camp' && activated.includes(t.id))
    campShow({
      title: '🌀 传送阵 · 雾灯镇', className: 'camp-teleport-modal',
      body: `<div class="camp-character"><i>🌀</i><div><b>"传送回路正在运转。"</b><p>营地脚下的传送阵嗡嗡作响，已点亮 <b>${activated.length}/${TELEPORTS.length}</b> 处。选择一处传送，HP 回满，不消耗回合。</p></div></div>
        ${options.length
          ? `<div class="camp-grid">${options.map(t => `<button class="camp-opt camp-opt-teleport" data-tp="${t.id}"><i>✨</i><span><b>${t.name}</b><small>森林深处 · 已点亮</small></span><em>传送</em></button>`).join('')}</div>`
          : '<p class="camp-muted">还没有激活其他传送阵——去森林里找到它们，路过即可点亮。</p>'}`,
      actions: [{ kind: 'navigation', label: '返回营地', handler: () => { open() } }],
    })
    document.querySelectorAll('[data-tp]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.tp
        state.phase = 'idle'
        campClose()
        TeleportSystem.teleport(id)
      }
    })
  }

  function deer () {
    const state = State.get(); setCampPhase()
    if (state._campDeerTaken) {
      campShow({ title: '🦌 篝火旁的鹿', className: 'camp-deer-modal', body: '<div class="camp-character"><i>🦌</i><div><b>“好好冒险吧，旅人。”</b><p>小鹿卧在火光边，温柔地朝你眨了眨眼。</p></div></div>', actions: [{ kind: 'navigation', label: '返回营地', handler: () => { Dialog.close(); open() } }] }); return
    }
    campShow({
      title: '🦌 篝火旁的鹿', className: 'camp-deer-modal',
      body: `<div class="camp-character"><i>🦌</i><div><b>“初次踏入妖林的旅人，带上这些吧。”</b><p>她把一束扎好的补给推到你面前。</p></div></div><div class="camp-gifts"><span><i>🌿</i><b>坚韧树枝</b><small>2 伤害 · 可战斗 4 次</small></span><span><i>🩹</i><b>创可贴 ×1</b><small>基础治疗补给</small></span><span><i>🍺</i><b>麦酒 ×1</b><small>旅途中恢复体力</small></span></div>`,
      actions: [{ label: '收下见面礼', cls: 'btn-primary', handler: () => {
        if (state._campDeerTaken) { Dialog.close(); open(); return }
        state.inventory.consumables.twig = (state.inventory.consumables.twig || 0) + 4
        state.inventory.consumables.bandaid = (state.inventory.consumables.bandaid || 0) + 1
        state.inventory.consumables.ale = (state.inventory.consumables.ale || 0) + 1
        state._campDeerTaken = true
        EventBus.emit('ui:log', { text: '🦌 收下了鹿准备的树枝与基础补给。', type: 'good' })
        EventBus.emit('state:changed', state); Dialog.close(); open()
      } }],
    })
  }

  return {
    open,
    gloryFee: GLORY_FEE,
    townPrice,
    showScene: campShow,
    closeScene: campClose,
    ensurePhase: setCampPhase,
    routeTownService: requestedPart => TownGlorySystem.routeTownService(requestedPart),
    townServiceDesc: (part, actor) => TownGlorySystem.townServiceDesc(part, actor),
    recordCommissionLead: wrongCommissionLead,
    showGloryWork: () => TownGlorySystem.showWork(),
    gloryHole: () => TownGlorySystem.open(),
    renderToilet: () => TownGlorySystem.renderToilet(),
    investigateStall: () => TownGlorySystem.investigateStall(),
    enterGlory: () => TownGlorySystem.enterGlory(),
    useToilet: () => TownGlorySystem.useToilet(),
    deer,
    tavern: () => TownTavernSystem.open(),
    serveMercenary: () => TownTavernSystem.serveMercenary(),
    ddShop: () => TownTavernSystem.openDreamShop(),
    squarePillory: () => TownPillorySystem.open(),
    resumeGuardSearch: () => TownGateSystem.resumeSearch(),
  }
})()
