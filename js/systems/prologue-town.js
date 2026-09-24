/**
 * systems/prologue-town.js —《欲缚镇 · 序章》镇内调查、城门与会馆运行模块。
 *
 * 只维护派克主线状态机；营地容器渲染与导航继续由 CampSystem 提供。
 */
(window.__PrologueRuntime ||= {}).town = (function () {
  const campShow = options => {
    options.className = `${options.className || ''} prologue-scene-modal`.trim()
    return CampSystem.showScene(options)
  }
  const open = opts => CampSystem.open(opts)
  const setCampPhase = () => CampSystem.ensurePhase()

  function pTownHall () {
    const state = State.get()
    const stage = state._wrongCommissionStage || 0
    if (stage === 7) {
      const copy = PROLOGUE_CONTENT.townHall.witness
      state._wrongCommissionStage = 8
      EventBus.emit('ui:log', { text: '⚖️ 蕾娜在镇务厅提交了被撕破的收货名单。', type: 'warning' })
      EventBus.emit('state:changed', state)
      State.save()
      campShow({
        title: copy.title,
        className: 'camp-tavern-modal wrong-letter-reaction-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🕯️</i><div><h3>${copy.heading}</h3><p>${copy.text}</p></div></section>
          <section class="p-hall-order"><span>${copy.speaker}</span><blockquote>${copy.line}</blockquote></section>
          <p class="wrong-letter-after">${copy.after}</p>`,
        actions: [{ label: '离开镇务厅，分别调查', cls: 'btn-primary', handler: open }],
      })
      return
    }
    if (stage === 8) {
      const inquiry = state._pTownInquiry || {}
      const missing = [!inquiry.guard && '城门值守', !inquiry.merchant && '商会柜台', !inquiry.citizen && '街口人群'].filter(Boolean)
      campShow({
        title: '⚖️ 镇务厅 · 等待证词',
        className: 'camp-tavern-modal wrong-letter-reaction-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">📚</i><div><h3>书记官把名单收进证物袋，却不肯立刻登记案件。</h3><p>还需要核实：${missing.join('、') || '所有口供已经齐全'}。</p></div></section>`,
        actions: [{ kind: 'navigation', label: '返回镇内调查', handler: open }],
      })
      return
    }
    if (stage === 9) { showCommissionReport(); return }
    open()
  }

  function investigatePTown (kind) {
    const state = State.get()
    if ((state._wrongCommissionStage || 0) !== 8) { open(); return }
    const scene = PROLOGUE_CONTENT.investigation.town[kind]
    if (!scene) { open(); return }
    campShow({
      title: `${scene.icon} 雾灯镇 · 补充口供`,
      className: 'camp-tavern-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${scene.icon}</i><div><h3>${scene.title}</h3><p>${scene.text}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>记录</span><p>${scene.clue}</p></div>
        <div class="scene-choice-list wrong-letter-choices">
          <button data-town-ask="${kind}"><i>▸</i><span><b>${scene.ask}</b><small>就这份口供再问一句</small></span><em>追问</em></button>
        </div>`,
      actions: [{ kind: 'navigation', label: '先离开', handler: open }],
    })
    document.querySelectorAll('[data-town-ask]').forEach(btn => {
      btn.onclick = () => finishPTownInquiry(btn.dataset.townAsk)
    })
  }

  function finishPTownInquiry (kind) {
    const state = State.get()
    if ((state._wrongCommissionStage || 0) !== 8) { open(); return }
    const source = PROLOGUE_CONTENT.investigation.town[kind]
    const scene = source && { icon: source.icon, title: source.answerTitle, text: source.answerText, clue: source.answerClue }
    if (!scene) { open(); return }
    if (!state._pTownInquiry) state._pTownInquiry = { guard: false, merchant: false, citizen: false }
    state._pTownInquiry[kind] = true
    const complete = state._pTownInquiry.guard && state._pTownInquiry.merchant && state._pTownInquiry.citizen
    if (complete) state._wrongCommissionStage = 9
    EventBus.emit('state:changed', state)
    State.save()
    EventBus.emit('ui:log', { text: `${scene.icon} ${scene.clue}`, type: 'warning' })
    campShow({
      title: `${scene.icon} 雾灯镇 · 追问`,
      className: 'camp-tavern-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${scene.icon}</i><div><h3>${scene.title}</h3><p>${scene.text}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>回答</span><p>${scene.clue}</p></div>
        ${complete ? '<p class="wrong-letter-after">三方证词已经齐全。现在可以回镇务厅，要求镇长正面回答。</p>' : ''}`,
      actions: [{ label: complete ? '回营地，准备向镇长复命' : '继续调查', cls: 'btn-primary', handler: open }],
    })
  }

  /** 复命时先把证据摆上桌，质问之后镇长才承认。 */
  function showCommissionReport () {
    const copy = PROLOGUE_CONTENT.townHall.report
    campShow({
      title: copy.title,
      className: 'camp-tavern-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📜</i><div><h3>${copy.heading}</h3><p>${copy.text}</p></div></section>
        <div class="scene-choice-list wrong-letter-choices">
          <button data-mayor-ask="signed"><i>▸</i><span><b>${copy.ask}</b><small>要求镇长正面回答</small></span><em>质问</em></button>
        </div>`,
      actions: [{ kind: 'navigation', label: '先把证据收回来', handler: open }],
    })
    const ask = document.querySelector('[data-mayor-ask]')
    if (ask) ask.onclick = () => showCommissionTakeover()
  }

  /** 完成证人、口供与复命后，才揭露镇长已经倒向派克。 */
  function showCommissionTakeover () {
    const state = State.get()
    const copy = PROLOGUE_CONTENT.townHall.takeover
    const captured = !!state._wrongCommissionCaptured
    state._wrongCommissionStage = 10
    state._wrongCommissionOutcome = 'takeover'
    EventBus.emit('ui:log', { text: '⚖️ 镇长承认与派克的交易，并把你送去城门接受新监督官处置。', type: 'warning' })
    EventBus.emit('state:changed', state)
    State.save()
    campShow({
      title: copy.title,
      className: 'camp-tavern-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📜</i><div><p>${copy.text}</p></div></section>
        <section class="p-hall-order"><span>镇长</span><blockquote>${copy.mayor}</blockquote></section>
        <section class="p-hall-order"><span>蕾娜</span><blockquote>${copy.rena}</blockquote></section>
        <p class="wrong-letter-after">${copy.after}</p>`,
      actions: [{ label: captured ? '被卫兵带往城门' : '拿着证据前往城门', cls: 'btn-primary', handler: open }],
    })
  }

  function pBridgeResult (state) {
    if (['normal_victory', 'provoked_victory', 'normal_captured', 'provoked_captured'].includes(state._pBridgeResult)) return state._pBridgeResult
    return state._wrongCommissionCaptured ? 'normal_captured' : 'normal_victory'
  }

  function rememberPGateChoice (choice) {
    const state = State.get()
    if (!Array.isArray(state._pGateChoices)) state._pGateChoices = []
    if (!state._pGateChoices.includes(choice)) state._pGateChoices.push(choice)
  }

  function caravanDebtTier (debt) {
    if (debt >= 60) return 3
    if (debt >= 40) return 2
    return 1
  }

  function caravanDebtServiceDesc (part, actor, publicDemo = false) {
    const scene = publicDemo ? '在告示栏前的木伽里' : '在拘束便器箱里'
    if (part === 'oral') return `${actor}${scene}按住你的后脑：“用嘴还。含住，跟着拍子，别停。”`
    if (part === 'vagina') return `${actor}${scene}压住你的腰，分开你的腿：“前面张开。这笔账从这里进。”`
    if (part === 'body') return `${actor}${scene}：“穴用不成，就打。一下一声，打完这笔才算。”`
    return `${actor}${scene}从后面抓住你的腰：“后面也行。按我说的拍子把账还完。”`
  }

  function routeCaravanDebtService (requestedPart) {
    const result = CampSystem.routeTownService(requestedPart)
    if (result.mode !== 'unavailable') return result
    return { mode: 'fallback', part: 'body', events: result.events || [] }
  }

  async function runCaravanDebtTasks (mode, preferredPart = null) {
    const state = State.get()
    const debt = Math.max(0, Number(state._pCaravanDebt) || 0)
    const tier = caravanDebtTier(debt)
    const penetration = state.gender !== 'male' && !ChastitySystem.isWorn() ? 'vagina' : 'anal'
    let steps = []

    if (mode === 'private' && tier === 1) {
      const part = preferredPart || 'oral'
      steps = [{ actor: '贝拉米', requestedPart: part, bpm: part === 'oral' ? 110 : 90, seconds: 30 }]
    } else if (mode === 'private' && tier === 2) {
      steps = [
        { actor: '贝拉米', requestedPart: 'oral', bpm: 110, seconds: 30 },
        { actor: '墨菲', requestedPart: penetration, bpm: 100, seconds: 40 },
      ]
    } else if (mode === 'private') {
      steps = [
        { actor: '贝拉米', requestedPart: 'oral', bpm: 110, seconds: 30 },
        { actor: '墨菲', requestedPart: penetration, bpm: 120, seconds: 50 },
        { actor: '贝拉米与墨菲', requestedPart: penetration, bpm: 120, seconds: 40, publicDemo: true },
      ]
    } else if (tier >= 3) {
      steps = [
        { actor: '贝拉米与一名被准许上前的路人', requestedPart: 'oral', bpm: 110, seconds: 40, publicDemo: true },
        { actor: '贝拉米', requestedPart: penetration, bpm: 120, seconds: 80, publicDemo: true },
      ]
    } else {
      steps = [{ actor: '贝拉米', requestedPart: penetration, bpm: 100, seconds: 70, publicDemo: true }]
    }

    Dialog.close()
    let failed = false
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const route = routeCaravanDebtService(step.requestedPart)
      const part = route.part
      const bodyFallback = part === 'body'
      const result = await BattleUI.showTaskDialog({
        enemyName: `${step.publicDemo ? '📣' : '◆'} ${step.actor}（${i + 1}/${steps.length}）`,
        attackName: step.publicDemo ? '告示栏前的木伽' : '拘束便器箱',
        desc: `${caravanDebtServiceDesc(part, step.actor, step.publicDemo)}墨菲在旁边翻着那张 ${debt}G 的条子，服务一次才会扣掉对应的钱。`,
        bpm: bodyFallback ? 60 : step.bpm,
        seconds: bodyFallback ? 30 : step.seconds,
        dmg: 0,
        noDamage: true,
        dildoName: bodyFallback ? '' : '还债',
        completeLabel: '✅ 完成',
        dialogClass: 'p-gate-debt-task-modal',
      })
      if (result) { failed = true; break }
    }

    if (failed) {
      state._pCaravanDebt = debt + 20
      EventBus.emit('ui:log', { text: `🧾 你没完成服务。墨菲在条子上又加了 20G，现在是 ${state._pCaravanDebt}G。`, type: 'danger' })
      EventBus.emit('state:changed', state)
      State.save()
      settleCaravanDebt()
      return
    }

    state._pCaravanDebt = 0
    EventBus.emit('ui:log', { text: mode === 'public' ? `📣 你完成了一项服务，从债务中扣掉了 ${debt}G。` : `◆你完成了一项服务，从债务中扣掉了  ${debt}G。`, type: 'warning' })
    EventBus.emit('state:changed', state)
    State.save()
    showPGateChapter()
  }

  function chooseSmallPrivateDebtService () {
    const state = State.get()
    const penetration = state.gender !== 'male' && !ChastitySystem.isWorn() ? 'vagina' : 'anal'
    campShow({
      title: '◆ 拘束便器箱',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: '<section class="scene-dialogue"><i aria-hidden="true">◆</i><div><p>贝拉米用短鞭指了指桌旁的箱子。木质的框架箱体，刚好够一个人蜷缩着塞进去，只留前后两个洞口在外面。</p></div></section><section class="p-hall-order"><span>贝拉米</span><blockquote>“爬进去！说，你想先被操那个穴！”</blockquote></section>',
      actions: [
        { label: '操我嘴穴', cls: 'btn-danger', handler: () => runCaravanDebtTasks('private', 'oral') },
        { label: penetration === 'vagina' ? '操我小穴' : '操我菊穴', cls: 'btn-danger', handler: () => runCaravanDebtTasks('private', penetration) },
        { kind: 'navigation', label: '先不进去', handler: settleCaravanDebt },
      ],
    })
  }

  function settleCaravanDebt () {
    const state = State.get()
    const debt = Math.max(0, Number(state._pCaravanDebt) || 0)
    if (!debt) { showPGateChapter(); return }
    const tier = caravanDebtTier(debt)
    const result = pBridgeResult(state)
    const captured = result.endsWith('captured')
    const fourfold = captured && !!state._pFourfoldEscortCompleted
    const clearDebt = () => {
      state.gold = Math.max(0, state.gold - debt)
      state._pCaravanDebt = 0
      EventBus.emit('ui:log', { text: `🧾 你把欠的 ${debt}G 桌子上，墨菲核对后把那张条子划掉了。`, type: 'warning' })
      EventBus.emit('state:changed', state)
      State.save()
      showPGateChapter()
    }
    const privateLabel = tier === 1 ? '你爬到拘束便器箱里' : tier === 2 ? '让他们两个轮流操我' : '让他们两个一起操我'
    const publicAction = tier >= 2
      ? [{ label: tier === 2 ? '走到告示栏前的木伽里' : '镇民们排队使用你，每次操你都需要付费', cls: 'btn-danger', handler: () => runCaravanDebtTasks('public') }]
      : []
    campShow({
      title: '🧾 城门 · 旧桥的条子',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🧾</i><div><p>墨菲用笔尾敲了敲旧桥看守留下的条子。</p></div></section>
        <section class="p-hall-order"><span>墨菲</span><blockquote>“你欠了${debt}G的债务，名字是你的。你必须在这里把欠还了先在谈别的。”</blockquote></section>
        <div class="wrong-letter-evidence ${fourfold ? 'is-found' : ''}"><span>${fourfold ? '四道锁' : captured ? '押送' : '搜身'}</span><p>${fourfold ? '他把你使用过我们拘束道具的那张欠条也翻了出来，和欠款条子压在一起。' : captured ? '贝拉米看了你一眼：“上次你穿了我们商会那么多拘束道具你都忘了吗，先把这个欠款还了。”' : '贝拉米只看金额：“这是上次你欠看守的条子，先把这个还了在谈别的”'}</p></div>
        <section class="p-hall-order"><span>贝拉米</span><blockquote>${tier === 1 ? '“就这点钱，你赶快爬进拘束便器箱服务几个客人就完事了。告示栏前的木伽还有别的用，暂不开放。”' : '“钱留下也行。不然爬进拘束便器箱，或者自己走到告示栏前的木伽里去。那边都是饥渴的镇民，他们会怎么操你我可不知道。”'}</blockquote></section>`,
      actions: [
        { label: state.gold >= debt ? `付清 ${debt}G` : `金币不足（需要 ${debt}G）`, cls: 'btn-primary', disabled: state.gold < debt, handler: clearDebt },
        { label: privateLabel, cls: 'btn-danger', handler: () => tier === 1 ? chooseSmallPrivateDebtService() : runCaravanDebtTasks('private') },
        ...publicAction,
      ],
    })
  }

  /**派克主线第一幕：城门新规、贝拉米与墨菲，以及已经受训多年的戴蒙德。 */
  function showPGateChapter () {
    const state = State.get()
    if (Math.max(0, Number(state._pCaravanDebt) || 0) > 0) { settleCaravanDebt(); return }
    const result = pBridgeResult(state)
    const captured = result.endsWith('captured')
    const provoked = result.startsWith('provoked')
    const fourfoldEscort = captured && !!state._pFourfoldEscortCompleted
    state._pMainlineStage = 1
    EventBus.emit('state:changed', state)
    State.save()

    const copy = PROLOGUE_CONTENT.gate
    const arrival = copy.arrival(captured)
    const memory = copy.memory({ captured, provoked, fourfold: fourfoldEscort })

    campShow({
      title: '⚖️ 雾灯镇 · 城门换岗',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${captured ? '⛓️' : '📜'}</i><div><h3>${arrival.heading}</h3><p>${arrival.text}</p></div></section>
        <section class="p-hall-order"><span>贝拉米</span><blockquote>${memory}</blockquote></section>
        <section class="p-gate-witness"><i aria-hidden="true">◇</i><div><h3>${copy.diamond.heading}</h3><p>${copy.diamond.text}</p></div></section>
        <p class="wrong-letter-after">${copy.diamond.after}</p>
        <section class="p-hall-order"><span>贝拉米</span><blockquote>${copy.diamond.line}</blockquote></section>`,
      actions: [
        { label: copy.choices.slaver, cls: 'btn-primary', disabled: true, handler: () => {} },
        { label: copy.choices.slave, cls: 'btn-danger', handler: () => choosePGateRole('slave') },
        { label: copy.choices.free, handler: () => choosePGateRole('free') },
      ],
    })
  }

  function choosePGateRole (role) {
    const state = State.get()
    if (!['slave', 'free'].includes(role)) return
    rememberPGateChoice(role)
    state._pRole = role
    state._pMainlineStage = 2
    state._pChapterOneLocked = true
    if (role === 'slave') {
      state._pMChapterStage = 0
      state._pMChapterStep = 0
      state._pMChapterBranch = null
      state._pMChapterAttitude = null
      state._pMWakeResist = 0
      state._pMSpankStack = 1
      state._pMChapterFailures = 0
      state._pMChapterEscrow = null
      state._pMConfiscated = false
      state._pMConfiscationEscrow = null
      state._pMChapterRestraintEscrow = null
      state._pMGroomed = false
      state._pMBranded = false
      state._pMSisterBond = false
      state._pMMarketResponse = null
      state._pMDayaChoice = null
      state._pMChapterCompleted = false
      state._pMEscortMode = 'bellamy'
      state._pMEscort = null
    }
    EventBus.emit('state:changed', state)
    State.save()

    const isSlave = role === 'slave'
    const title = isSlave ? '墨菲在黑皮册里写下你的临时编号。' : '墨菲在你的名字旁标注“自由身观察”。'
    const line = isSlave ? '墨菲收起笔，贝拉米把手按到你的后颈。' : '墨菲在名字旁写完最后一笔，随后合上黑皮册。'
    const routeLine = isSlave ? '“M 路线已经登记。”' : '“自由身路线已经登记。你暂时可以继续在镇内活动。”'
    const after = isSlave ? '《欲缚镇 · 序章》到此结束。你的下一段记忆，从收容笼旁边醒来开始。' : '《欲缚镇 · 序章》到此结束。自由身第一章尚在制作中。'

    EventBus.emit('ui:log', { text: isSlave ? '⛓️ 已选择 M 路线；奴隶线·第一章已开启。' : '◇ 已选择自由身路线；后续章节暂未开放。', type: isSlave ? 'danger' : 'warning' })
    campShow({
      title: '⚖️ 欲缚镇 · 序章完成',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${isSlave ? '⛓️' : '◇'}</i><div><h3>${title}</h3><p>${line}</p></div></section>
        <section class="p-hall-order"><span>墨菲</span><blockquote>${routeLine}</blockquote></section>
        <p class="wrong-letter-after">${after}</p>`,
      actions: [{ label: isSlave ? '进入奴隶线·第一章' : '返回欲缚镇', cls: isSlave ? 'btn-danger' : 'btn-primary', handler: () => isSlave && window.PMEnslavementSystem ? PMEnslavementSystem.open() : open() }],
    })
  }

  /** 城镇广场常驻木枷：自愿展示，或在有佣兵债务时用一次任务抵债。 */

  return {
    pTownHall,
    investigatePTown,
    showPGateChapter,
  }
})()
