/**
 * systems/camp-p-story.js — P 商团的镇内调查、城门与会馆主线。
 *
 * 只维护 P 主线状态机；营地容器渲染与导航继续由 CampSystem 提供。
 */
window.PTownSystem = (function () {
  const campShow = options => CampSystem.showScene(options)
  const open = opts => CampSystem.open(opts)
  const setCampPhase = () => CampSystem.ensurePhase()

  function pTownHall () {
    const state = State.get()
    const stage = state._wrongCommissionStage || 0
    if (stage === 7) {
      state._wrongCommissionStage = 8
      EventBus.emit('ui:log', { text: '⚖️ 蕾娜在镇务厅提交了被撕破的收货名单。', type: 'warning' })
      EventBus.emit('state:changed', state)
      State.save()
      campShow({
        title: '⚖️ 镇务厅 · 证人陈述',
        className: 'camp-tavern-modal wrong-letter-reaction-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🕯️</i><div><h3>蕾娜把半张名单铺在长桌上，镇长却先让卫兵关上了门。</h3><p>她证明车队由 P 出资，货物经过正式许可运入镇内；强盗袭击不是偶然，而是为了销毁完整的合作名单。</p></div></section>
          <div class="wrong-letter-evidence is-found"><span>镇长的回答</span><p>“一张残页还不够。去问城门值守、商会柜台和街上的人。若三方口供一致，我会正式处理。”</p></div>
          <p class="wrong-letter-after">镇长没有否认印章，只把决定推迟到更多证词出现以后。</p>`,
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
    if (stage === 9) { showCommissionTakeover(); return }
    open()
  }

  function investigatePTown (kind) {
    const state = State.get()
    if ((state._wrongCommissionStage || 0) !== 8) { open(); return }
    if (!state._pTownInquiry) state._pTownInquiry = { guard: false, merchant: false, citizen: false }
    const scenes = {
      guard: {
        icon: '🛡️', title: '值夜卫兵翻开入城簿，P 的车队记录一页也没有缺。',
        text: '通行许可来自镇务厅，命令要求免检放行。卫兵还承认，Bellamy 与 Murphy 已被任命为新的城门监督官。',
        clue: '车队不是偷运；镇方主动为它打开了门。',
      },
      merchant: {
        icon: '📦', title: '商会账本上，器具订单被拆成了数笔普通采购。',
        text: '付款方都指向 P 的商团，担保人却是镇务厅。商人以为这是监牢用品，直到编号牌与契约书同时送达。',
        clue: 'P 提供资金和货物，镇务厅提供合法外衣。',
      },
      citizen: {
        icon: '👥', title: '街口的人先压低声音，随后一个接一个说出同样的传闻。',
        text: '新告示早在货车抵达前就已经写好。有人被要求清空仓库，有人看见卫兵连夜换岗，所有人都在等镇长宣布结果。',
        clue: '所谓临时接管早已准备多日，不是车队遇袭后的应急决定。',
      },
    }
    const scene = scenes[kind]
    if (!scene) { open(); return }
    state._pTownInquiry[kind] = true
    const complete = state._pTownInquiry.guard && state._pTownInquiry.merchant && state._pTownInquiry.citizen
    if (complete) state._wrongCommissionStage = 9
    EventBus.emit('state:changed', state)
    State.save()
    EventBus.emit('ui:log', { text: `${scene.icon} ${scene.clue}`, type: 'warning' })
    campShow({
      title: `${scene.icon} 雾灯镇 · 补充口供`,
      className: 'camp-tavern-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${scene.icon}</i><div><h3>${scene.title}</h3><p>${scene.text}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>记录</span><p>${scene.clue}</p></div>
        ${complete ? '<p class="wrong-letter-after">三方证词已经齐全。现在可以回镇务厅，要求镇长正面回答。</p>' : ''}`,
      actions: [{ label: complete ? '回营地，准备向镇长复命' : '继续调查', cls: 'btn-primary', handler: open }],
    })
  }

  /** 完成证人、口供与复命后，才揭露镇长已经倒向 P。 */
  function showCommissionTakeover () {
    const state = State.get()
    const captured = !!state._wrongCommissionCaptured
    state._wrongCommissionStage = 10
    state._wrongCommissionOutcome = 'takeover'
    EventBus.emit('ui:log', { text: '⚖️ 镇长承认与 P 的交易，并把你送去城门接受新监督官处置。', type: 'warning' })
    EventBus.emit('state:changed', state)
    State.save()
    campShow({
      title: '⚖️ 镇务厅 · 最后的复命',
      className: 'camp-tavern-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📜</i><div><h3>你把许可、名单和三份口供逐一放到镇长面前。</h3><p>镇长没有逮捕任何人。他取出早已盖好的告示，承认合作协议由自己签署：P 的商团将接管约束器具、契约劳役和人员登记。</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>蕾娜</span><p>“所以他们追杀车队，不是为了阻止交易——只是为了掩盖你们早就谈妥的条件。”</p></div>
        <p class="wrong-letter-after">镇长让卫兵带走蕾娜，并命你去城门见两名新监督官。你完成了调查，却发现委托你调查的人本就站在 P 那边。</p>`,
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
    const scene = publicDemo ? '在告示柱与 Diamond 身旁' : '在城门登记桌后'
    if (part === 'oral') return `${actor}${scene}把你按跪在身前，用你的嘴完成这次车队验收`
    if (part === 'vagina') return `${actor}${scene}压住你的腰，分开双腿，从正面插入小穴完成验收`
    if (part === 'body') return `${actor}${scene}把你按成展示姿势，按节拍公开责打臀部`
    return `${actor}${scene}从身后插入菊穴，以车队规定的节奏完成验收`
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
      steps = [{ actor: 'Bellamy', requestedPart: preferredPart || 'oral', bpm: preferredPart === 'oral' ? 0 : 90, seconds: 30 }]
    } else if (mode === 'private' && tier === 2) {
      steps = [
        { actor: 'Bellamy', requestedPart: 'oral', bpm: 0, seconds: 30 },
        { actor: 'Murphy', requestedPart: penetration, bpm: 100, seconds: 40 },
      ]
    } else if (mode === 'private') {
      steps = [
        { actor: 'Bellamy', requestedPart: 'oral', bpm: 0, seconds: 30 },
        { actor: 'Murphy', requestedPart: penetration, bpm: 120, seconds: 60 },
        { actor: 'Bellamy 与 Murphy', requestedPart: penetration, bpm: 120, seconds: 30, publicDemo: true },
      ]
    } else {
      steps = [{ actor: tier >= 3 ? 'Bellamy 与一名被准许上前的路人' : 'Bellamy', requestedPart: penetration, bpm: tier >= 3 ? 120 : 90, seconds: tier >= 3 ? 60 : 40, publicDemo: true }]
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
        attackName: step.publicDemo ? '告示旁示范验收' : '车队私账验收',
        desc: `${caravanDebtServiceDesc(part, step.actor, step.publicDemo)}。Murphy 在黑皮册旁逐段核销这笔 ${debt}G 欠条。`,
        bpm: bodyFallback ? 60 : (part === 'oral' ? 0 : step.bpm),
        seconds: bodyFallback ? 30 : step.seconds,
        dmg: 0,
        noDamage: true,
        dildoName: bodyFallback ? '' : '商团验收用具',
        completeLabel: '✅ 完成这一段验收',
        dialogClass: 'p-gate-debt-task-modal',
      })
      if (result) { failed = true; break }
    }

    if (failed) {
      state._pCaravanDebt = debt + 20
      EventBus.emit('ui:log', { text: `🧾 验收中断，Murphy 把车队欠条提高到 ${state._pCaravanDebt}G。`, type: 'danger' })
      EventBus.emit('state:changed', state)
      State.save()
      settleCaravanDebt()
      return
    }

    state._pCaravanDebt = 0
    EventBus.emit('ui:log', { text: mode === 'public' ? `📣 告示旁的示范完成，Murphy 注销了 ${debt}G 车队欠条。` : `◆ Bellamy 与 Murphy 完成验收，${debt}G 车队欠条已经注销。`, type: 'warning' })
    EventBus.emit('state:changed', state)
    State.save()
    showPGateChapter()
  }

  function chooseSmallPrivateDebtService () {
    const state = State.get()
    const penetration = state.gender !== 'male' && !ChastitySystem.isWorn() ? 'vagina' : 'anal'
    campShow({
      title: '◆ 城门 · 私账验收',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: '<section class="scene-dialogue"><i aria-hidden="true">◆</i><div><h3>Bellamy 把短鞭横在登记桌边，让你自己选一种偿还方式。</h3><p>Murphy 只负责核对完成记录；这是一笔一次性的车队私账，不会把你登记成城镇接客者。</p></div></section>',
      actions: [
        { label: '跪下，用嘴偿还', cls: 'btn-danger', handler: () => runCaravanDebtTasks('private', 'oral') },
        { label: `俯身，用${penetration === 'vagina' ? '小穴' : '后穴'}偿还`, cls: 'btn-danger', handler: () => runCaravanDebtTasks('private', penetration) },
        { kind: 'navigation', label: '返回欠条结算', handler: settleCaravanDebt },
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
      EventBus.emit('ui:log', { text: `🧾 你向 Murphy 付清了 ${debt}G 车队欠条。`, type: 'warning' })
      EventBus.emit('state:changed', state)
      State.save()
      showPGateChapter()
    }
    const privateLabel = tier === 1 ? '接受一次私账验收' : tier === 2 ? '接受两人分段验收' : '接受两人联合验收与示范'
    const publicAction = tier >= 2
      ? [{ label: tier === 2 ? '在告示旁完成一次短示范' : '在告示旁完成完整公开示范', cls: 'btn-danger', handler: () => runCaravanDebtTasks('public') }]
      : []
    campShow({
      title: '🧾 城门 · 车队欠条',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🧾</i><div><h3>Murphy 在放你过门前翻出了旧桥看守写下的欠条。</h3><p>账面余额为 <b>${debt}G</b>。这不是镇务罚款，而是 P 商团记在你名下的车队私账。</p></div></section>
        <div class="wrong-letter-evidence ${fourfold ? 'is-found' : ''}"><span>${fourfold ? '四重束缚入库单' : captured ? '押送记录' : '旧桥搜身记录'}</span><p>${fourfold ? 'Murphy 把临时编号和四道锁具的交接记录一并翻到欠条旁。' : captured ? 'Bellamy 认出货车押送记录，命你在正式登记前先销清私账。' : '你仍以自由身份走到城门；Bellamy 只要求结清看守留下的名字与金额。'}</p></div>
        <section class="p-hall-order"><span>Bellamy</span><blockquote>“付清，或者在告示旁把这笔账做完。Murphy 记账，我来验收。”</blockquote></section>`,
      actions: [
        { label: state.gold >= debt ? `付清 ${debt}G` : `金币不足（需要 ${debt}G）`, cls: 'btn-primary', disabled: state.gold < debt, handler: clearDebt },
        { label: privateLabel, cls: 'btn-danger', handler: () => tier === 1 ? chooseSmallPrivateDebtService() : runCaravanDebtTasks('private') },
        ...publicAction,
      ],
    })
  }

  /** P 主线第一幕：城门新规、Bellamy 与 Murphy，以及已经受训多年的 Diamond。 */
  function showPGateChapter () {
    const state = State.get()
    if (Math.max(0, Number(state._pCaravanDebt) || 0) > 0) { settleCaravanDebt(); return }
    const result = pBridgeResult(state)
    const captured = result.endsWith('captured')
    const provoked = result.startsWith('provoked')
    const fourfoldEscort = captured && !!state._pFourfoldEscortCompleted
    const choices = state._pInvestigationChoices || {}
    const evidenceLed = [choices.barkeep, choices.blacksmith].filter(choice => choice === 'permit').length >= 1
    state._pMainlineStage = 1
    EventBus.emit('state:changed', state)
    State.save()

    const arrival = captured
      ? fourfoldEscort
        ? '<h3>Murphy 把黑皮册翻回你第一次被货车送进城的那一页。</h3><p>Bellamy 一眼认出了旧桥临时编号。这一次，证人、账本和镇长的命令都已到齐，临时备忘录将被换成正式身份记录。</p>'
        : `<h3>${provoked ? '货车停下时，叫来的那几名看守都来认了你的脸。' : '套在腕上的绳子被人从车尾解下，却没有完全松开。'}</h3><p>两名陌生监督官守在新告示旁。一个佩短鞭，自称贝拉米；另一个叫墨菲，正把入城者的名字逐个抄进黑皮册。</p>`
      : `<h3>${provoked ? '贝拉米看了看你，又看了看被抬回来的几名看守。' : '你把沾着桥下泥水的许可放到新告示旁。'}</h3><p>佩短鞭的监督官自称贝拉米。墨菲翻开黑皮册，很快找到了那辆货车和你的名字。</p>`
    const memory = captured
      ? fourfoldEscort
        ? '“四道锁具把你送进城，你又真的回旧桥找到了活口。那张临时入库单，现在可以正式结算了。”'
        : (provoked ? '“在桥上把我们所有人都叫出来，然后输掉——胆子不小，脑子另说。”' : '“落单的人都敢截，至少还算有点胆量。”')
      : (provoked ? '“你叫他们一起上，最后还把人全放倒了。P 先生会想见你。”' : evidenceLed ? '“一路查许可、查印章。你很清楚该抓住哪根线。”' : '“一个人截下看守，还把许可带了回来。手脚很利落。”')

    campShow({
      title: '⚖️ 雾灯镇 · 城门换岗',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${captured ? '⛓️' : '📜'}</i><div>${arrival}</div></section>
        <div class="wrong-letter-evidence is-found"><span>贝拉米</span><p>${memory}</p></div>
        <section class="p-gate-witness"><i aria-hidden="true">◇</i><div><h3>告示柱旁跪着一个戴着旧编号牌的女人。</h3><p>她本名黛雅，商团只称她为 Diamond。她并不是等待登记的新人，而是被 Bellamy 训练多年、专门用来向外来者展示新规后果的奴隶。</p></div></section>
        <p class="wrong-letter-after">Murphy 命令 Diamond 当众重复自己的编号与身份。Bellamy 则把短鞭横在你与街口之间：“看清楚。进了这道门，你打算以什么身份进去？”</p>`,
      actions: [
        { label: captured ? '“我可以替商团做事，抵掉这笔账。”' : '“把许可给 P——问他还缺不缺人。”', cls: 'btn-primary', handler: () => choosePGateRole('work') },
        { label: captured ? '“先松开绳子。我知道货是怎么进来的。”' : '“P 是谁？我要亲自听他解释。”', handler: () => choosePGateRole('question') },
        { label: captured ? '拒绝低头，也拒绝替他们做事' : '“我不替你们做事，也不承认这份新规。”', cls: 'btn-danger', handler: () => choosePGateRole('refuse') },
      ],
    })
  }

  function choosePGateRole (choice) {
    const state = State.get()
    const result = pBridgeResult(state)
    const captured = result.endsWith('captured')
    rememberPGateChoice(choice)
    state._pRole = choice === 'work' ? 'slaver' : (captured && choice === 'refuse' ? 'slave' : 'free')
    rememberPGateChoice(choice === 'question' ? 'cautious' : choice === 'refuse' ? 'defiant' : 'work')
    state._pMainlineStage = 2
    EventBus.emit('state:changed', state)
    State.save()

    let title = 'Bellamy 把一枚刻着 P 字样的黄铜牌抛到你手里。'
    let line = '“带着你的调查结果去商团会馆。Pike 会决定你有没有资格替他办事。”'
    let after = 'Diamond 仍被留在城门。你第一次去见 Pike 时，她不会同行。'
    if (state._pRole === 'free') {
      title = choice === 'refuse' ? 'Bellamy 没有得到服从，却还是让开了通往镇内的道路。' : 'Murphy 合上册子，在你的名字旁画了一道细线。'
      line = choice === 'refuse'
        ? '“你可以不承认新规，但 Pike 仍想听听是谁把他的车队翻了个底朝天。”'
        : '“发现许可、救回证人，又逼镇长表态。Pike 确实愿意见你。”'
      after = choice === 'refuse' ? '你以受监视的自由人身份入城。监督官会记住你的脸。' : '你暂时没有加入任何一方，可以当面听 Pike 提出条件。'
    } else if (state._pRole === 'slave') {
      title = 'Bellamy 扯紧旧绳，Murphy 在黑皮册里为你留下临时编号。'
      line = '“拒绝新规的人，也归新规处置。你会以商团新收财产的身份去见 Pike。”'
      after = '你的装备暂时没有被删除，但剧情身份已经改变：卫兵会押送你穿过镇内，Pike 将决定训练安排。'
    }

    EventBus.emit('ui:log', { text: state._pRole === 'slaver' ? '◆ Bellamy 允许你以候选执行人的身份去见 Pike。' : state._pRole === 'slave' ? '⛓️ 你被编入商团名册，将以俘虏身份见 Pike。' : '◇ 你保留自由身份，前往会馆听 Pike 的条件。', type: state._pRole === 'slave' ? 'danger' : 'warning' })
    campShow({
      title: '⚖️ 城门 · 黑皮册',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${state._pRole === 'slaver' ? '◆' : state._pRole === 'slave' ? '⛓️' : '◇'}</i><div><h3>${title}</h3><p>${line}</p></div></section>
        <p class="wrong-letter-after">${after}</p>`,
      actions: [{ label: '进入镇内，前往商团会馆', cls: 'btn-primary', handler: open }],
    })
  }

  function enterPHall () {
    const state = State.get()
    if (state._pMainlineStage === 2) {
      state._pMainlineStage = 3
      EventBus.emit('state:changed', state)
      State.save()
      showPikeFirstAudience()
      return
    }
    if (state._pMainlineStage === 4) {
      state._pMainlineStage = 5
      EventBus.emit('state:changed', state)
      State.save()
      showPikeSecondAudience()
      return
    }
    open()
  }

  function showPikeFirstAudience () {
    const state = State.get()
    if (state._pMainlineStage !== 3) { open(); return }
    const role = state._pRole || 'free'
    const scene = role === 'slaver'
      ? { icon: '◆', title: 'Pike 看完你带来的许可、残页与口供，没有立刻称赞。', text: '他问你是否明白，发现一条运输线与经营一座城完全不同。若真想替商团做事，就先证明 Bellamy 会服从你传达的命令。', after: 'Pike 命你返回城门，把 Diamond 完整地带到会馆。这是你的第一项正式考核。' }
      : role === 'slave'
        ? { icon: '⛓️', title: 'Pike 让书记官念出你的临时编号，像验收一件刚送到的货物。', text: '他没有立即安排训练，而是要你先回到 Bellamy 面前。Diamond 将与你一同返回会馆；你必须亲眼看清商团如何处置一个受训奴隶。', after: '你仍是被押送者，却被临时赋予了一项任务：跟随 Diamond 回到 Pike 面前。' }
        : { icon: '◇', title: 'Pike 把镇长签署的名单压在手下，承认错投的货单确实来自自己。', text: '他对你的调查能力更感兴趣，也不介意你暂时拒绝加入。作为交换，他要你回城门带来 Diamond，并观察 Bellamy 是否服从会馆命令。', after: '你仍是自由人，但 Pike 已经把你拖进他的权力试验。' }
    EventBus.emit('ui:log', { text: '🏛️ Pike 命你返回城门，把 Diamond 带到会馆。', type: 'warning' })
    campShow({
      title: '🏛️ 商团会馆 · 初见 Pike',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${scene.icon}</i><div><h3>${scene.title}</h3><p>${scene.text}</p></div></section>
        <section class="p-hall-order"><span>Pike</span><blockquote>“回城门找 Bellamy。告诉他，我要 Diamond 现在就来会馆。然后把她带回来。”</blockquote></section>
        <p class="wrong-letter-after">${scene.after}</p>`,
      actions: [{ label: '离开会馆，返回城门', cls: 'btn-primary', handler: open }],
    })
  }

  function returnToBellamy () {
    const state = State.get()
    if (state._pMainlineStage !== 3) { open(); return }
    state._pMainlineStage = 4
    EventBus.emit('state:changed', state)
    State.save()
    const role = state._pRole || 'free'
    const scene = role === 'slaver'
      ? { icon: '◆', title: 'Bellamy 听完 Pike 的命令，却故意没有立刻交出锁链。', text: '他先让你辨认 Diamond 的编号、训练等级和押送规则，随后才把锁链递来：“带错人、弄丢人，或者心软——都算你失败。”', after: '你接过 Diamond 的押送链。她没有求救，只提醒你 Bellamy 正等着看你犯错。' }
      : role === 'slave'
        ? { icon: '⛓️', title: 'Bellamy 笑着让 Murphy 把你的临时链扣到 Diamond 的锁链上。', text: '他拒绝把任何一人单独交给你，声称“财产不能押送财产”。直到 Pike 的印牌被拿出来，他才命令两名卫兵押着你们同行。', after: '你和 Diamond 被编入同一支押送队。她低声告诉你：别在街上反抗，先活着走到 Pike 面前。' }
        : { icon: '◇', title: 'Bellamy 当面拒绝了 Pike 的命令，声称 Diamond 属于城门岗哨。', text: '你出示黄铜牌和完整口供后，Murphy 才指出会馆命令优先。Bellamy 最终松开锁链，却警告 Diamond 若偏离路线就会由旁人受罚。', after: 'Diamond 跟在你身旁前往会馆。你没有成为押送者，也无法假装只是一个旁观者。' }
    EventBus.emit('ui:log', { text: role === 'slaver' ? '◆ Bellamy 把 Diamond 的押送链交给了你。' : role === 'slave' ? '⛓️ 你与 Diamond 被一同押往会馆。' : '◇ 你迫使 Bellamy 执行 Pike 的命令，Diamond 将随你前往会馆。', type: role === 'slave' ? 'danger' : 'warning' })
    campShow({
      title: '⛓️ 城门岗哨 · Pike 的命令',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${scene.icon}</i><div><h3>${scene.title}</h3><p>${scene.text}</p></div></section>
        <p class="wrong-letter-after">${scene.after}</p>`,
      actions: [{ label: '带 Diamond 返回商团会馆', cls: 'btn-primary', handler: open }],
    })
  }

  function lockPRoute (role, outcome) {
    const state = State.get()
    state._pRole = role
    state._pDayaOutcome = outcome
    state._pRouteLocked = true
    state._pMainlineStage = 6
    EventBus.emit('state:changed', state)
    State.save()
  }

  function finishPikeRoute (role, outcome, scene) {
    lockPRoute(role, outcome)
    EventBus.emit('ui:log', { text: role === 'slaver' ? '◆ Pike 安排你接受基础执行人训练。' : role === 'slave' ? '⛓️ Pike 将你送回 Bellamy 处接受奴隶训练。' : '◇ 你拒绝加入商团，但获得了暂时的自由通行。', type: role === 'slave' ? 'danger' : 'warning' })
    showPHallResolution(scene, role)
  }

  function showPikeSecondAudience () {
    const state = State.get()
    if (state._pMainlineStage !== 5) { open(); return }
    const role = state._pRole || 'free'
    const opening = role === 'slaver'
      ? { icon: '◆', title: 'Diamond 被带到长桌前，Pike 只检查了锁链和押送记录。', text: 'Bellamy 的刁难、路上的停顿和抵达时间都写在同一张考核纸上。Pike 宣布你通过了第一项测试。' }
      : role === 'slave'
        ? { icon: '⛓️', title: '你与 Diamond 再次站到 Pike 面前，这次黑皮册已经准备好正式编号。', text: 'Pike 没有把你当作救回证人的调查者，而是把那段经历写成“判断力尚可”的财产评估。' }
        : { icon: '◇', title: 'Diamond 安全抵达，Pike 也确认 Bellamy 违抗命令的经过。', text: '他没有惩罚 Bellamy，只把这当成一次筛选：看你会顺从、退缩，还是利用制度迫使对方让步。' }

    const actions = role === 'slaver'
      ? [{ label: '接受 Pike 的基础执行人训练', cls: 'btn-primary', handler: () => finishPikeRoute('slaver', 'slaver_training', { icon: '◆', title: 'Pike 把带缺口的铁印推到你面前。', text: '从现在起，你可以替商团接取任务，但还必须向 Bellamy 学习如何管理俘虏与执行命令。', after: '奴隶贩子路线开启：下一阶段是 Bellamy 的基础训练。' }) }]
      : role === 'slave'
        ? [{ label: '被押回 Bellamy 处接受训练', cls: 'btn-danger', handler: () => finishPikeRoute('slave', 'slave_training', { icon: '⛓️', title: 'Pike 在证书下方写下自己的名字。', text: 'Diamond 被送往会馆内侧，而你将返回城门，由 Bellamy 安排第一阶段训练。', after: '奴隶路线开启：失败和拒绝都已经成为后续人物记住的经历。' }) }]
        : [
            { label: '保持自由，只替 Pike 调查必要的事情', cls: 'btn-primary', handler: () => finishPikeRoute('free', 'free_observer', { icon: '◇', title: 'Pike 收回了准备好的铁印。', text: '他允许你作为受监视的自由人留在镇内，但每一次调查都会被 Bellamy 记录。', after: '自由人路线开启：你可以接近商团，也可以继续寻找反抗它的方法。' }) },
            { label: '接受执行人训练，借机进入商团内部', handler: () => finishPikeRoute('slaver', 'slaver_training', { icon: '◆', title: '你接过了 Pike 的铁印。', text: 'Pike 看得出你仍有保留，却并不在意。能完成命令的人，才有资格知道商团下一步要做什么。', after: '奴隶贩子路线开启：你将接受 Bellamy 的基础训练。' }) },
          ]
    campShow({
      title: '🏛️ 商团会馆 · 第二次会面',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${opening.icon}</i><div><h3>${opening.title}</h3><p>${opening.text}</p></div></section>
        <section class="p-hall-order"><span>Pike</span><blockquote>“Diamond 只是命令的一部分。真正送到我面前的，是你选择成为的那个人。”</blockquote></section>`,
      actions,
    })
  }

  function showPHallResolution (scene, role) {
    campShow({
      title: '🏛️ 商团会馆 · 路线确定',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${scene.icon}</i><div><h3>${scene.title}</h3><p>${scene.text}</p></div></section>
        <p class="wrong-letter-after">${scene.after}</p>`,
      actions: [{ label: role === 'slaver' ? '收下铁印，离开会馆' : role === 'slave' ? '跟随押送队离开长桌' : '记住这里，离开会馆', cls: role === 'slave' ? 'btn-danger' : 'btn-primary', handler: open }],
    })
  }

  // 兼容旧存档中已经开始的会馆战斗；新版主线不再以掀桌战代替原版任务链。
  function resolvePHallBattle (victory) {
    setCampPhase()
    if (victory) {
      lockPRoute('free', 'assault_win')
      EventBus.emit('ui:log', { text: '⚔️ 旧版会馆战斗已结算：你逃出了会馆。', type: 'danger' })
      showPHallResolution({
        icon: '⚔️', title: '贝拉米倒在翻覆的长桌旁，正门终于露出空隙。',
        text: '你趁混乱冲出了会馆。该事件会作为旧存档结果保留，但新版任务将从后续路线继续。',
        after: '你成为公开反抗商团的自由人。',
      }, 'free')
    } else {
      lockPRoute('slave', 'assault_loss')
      EventBus.emit('ui:log', { text: '⛓️ 会馆袭击失败，你和黛雅都被强制登记。', type: 'danger' })
      showPHallResolution({
        icon: '⛓️', title: '你被重新拖回长桌，手臂已经抬不起来。',
        text: 'P 让书记官把你与黛雅写在同一页：“勇气不能替你赢下一场已经输掉的战斗。”黑蜡印先后落在两个名字下面。',
        after: '袭击失败不会让你死亡，但会直接固定奴隶路线。你恢复了少量生命，下一阶段将从登记后的处境开始。',
      }, 'slave')
    }
  }

  /** 城镇广场常驻木枷：自愿展示，或在有佣兵债务时用一次任务抵债。 */

  return {
    pTownHall,
    investigatePTown,
    showPGateChapter,
    enterPHall,
    returnToBellamy,
    showPikeSecondAudience,
    resolvePHallBattle,
  }
})()
