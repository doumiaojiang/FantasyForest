/**
 * systems/camp-p-story.js —派克商团的镇内调查、城门与会馆主线。
 *
 * 只维护派克主线状态机；营地容器渲染与导航继续由 CampSystem 提供。
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
        body: `<section class="scene-dialogue"><i aria-hidden="true">🕯️</i><div><h3>蕾娜把半张名单铺在长桌上，镇长却先让卫兵关上了门。</h3><p>她证明车队由派克出资，货物经过正式许可运入镇内；强盗袭击不是偶然，而是为了销毁完整的合作名单。</p></div></section>
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
    if (stage === 9) { showCommissionReport(); return }
    open()
  }

  function investigatePTown (kind) {
    const state = State.get()
    if ((state._wrongCommissionStage || 0) !== 8) { open(); return }
    const scenes = {
      guard: {
        icon: '🛡️', title: '值夜卫兵翻开入城簿，派克的车队记录一页也没有缺。',
        text: '通行许可来自镇务厅，命令要求免检放行。卫兵还承认，贝拉米与墨菲已被任命为新的城门监督官。',
        clue: '车队不是偷运；镇方主动为它打开了门。',
        ask: '“免检令上的签名，是镇长本人的吗？”',
      },
      merchant: {
        icon: '📦', title: '商会账本上，器具订单被拆成了数笔普通采购。',
        text: '付款方都指向派克的商团，担保人却是镇务厅。商人以为这是监牢用品，直到编号牌与契约书同时送达。',
        clue: '派克提供资金和货物，镇务厅提供合法外衣。',
        ask: '“担保人为什么会是镇务厅？”',
      },
      citizen: {
        icon: '👥', title: '街口的人先压低声音，随后一个接一个说出同样的传闻。',
        text: '新告示早在货车抵达前就已经写好。有人被要求清空仓库，有人看见卫兵连夜换岗，所有人都在等镇长宣布结果。',
        clue: '所谓临时接管早已准备多日，不是车队遇袭后的应急决定。',
        ask: '“告示早就写好了，镇长还在等什么？”',
      },
    }
    const scene = scenes[kind]
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
    const answers = {
      guard: {
        icon: '🛡️',
        title: '卫兵把入城簿转过来，签名栏盖着镇务厅的章。',
        text: '经手人写的是镇长的名字。卫兵把簿子合上，说自己只负责放行，不肯再往下讲。',
        clue: '免检令经镇长本人签字。',
      },
      merchant: {
        icon: '📦',
        title: '商人翻到契约最后一页，指给你看一行小字。',
        text: '商会不得追问货物用途，违约就收回铺面。他说自己只敢按页入账。',
        clue: '镇务厅用铺面要挟商会闭嘴。',
      },
      citizen: {
        icon: '👥',
        title: '一个清空了仓库的人看了看镇务厅的方向。',
        text: '“等一个外来的人把名单送回来。这样接管看起来就像调查的结果，而不是早就谈好的事。”',
        clue: '镇长在等你把名单送回，好让接管看起来像调查结论。',
      },
    }
    const scene = answers[kind]
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
    campShow({
      title: '⚖️ 镇务厅 · 复命',
      className: 'camp-tavern-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📜</i><div><h3>你把许可、半张名单和三份口供逐一放到镇长面前。</h3><p>蕾娜站在桌侧，没有说话。镇长看完最后一页，手指却按在那份早已盖好的告示上，像是在等你先开口。</p></div></section>
        <div class="scene-choice-list wrong-letter-choices">
          <button data-mayor-ask="signed"><i>▸</i><span><b>“三份口供都指向你。协议是你签的吗？”</b><small>要求镇长正面回答</small></span><em>质问</em></button>
        </div>`,
      actions: [{ kind: 'navigation', label: '先把证据收回来', handler: open }],
    })
    const ask = document.querySelector('[data-mayor-ask]')
    if (ask) ask.onclick = () => showCommissionTakeover()
  }

  /** 完成证人、口供与复命后，才揭露镇长已经倒向派克。 */
  function showCommissionTakeover () {
    const state = State.get()
    const captured = !!state._wrongCommissionCaptured
    state._wrongCommissionStage = 10
    state._wrongCommissionOutcome = 'takeover'
    EventBus.emit('ui:log', { text: '⚖️ 镇长承认与派克的交易，并把你送去城门接受新监督官处置。', type: 'warning' })
    EventBus.emit('state:changed', state)
    State.save()
    campShow({
      title: '⚖️ 镇务厅 · 最后的复命',
      className: 'camp-tavern-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📜</i><div><h3>“是我签的。”</h3><p>镇长没有逮捕任何人。他取出早已盖好的告示，承认合作协议由自己签署：派克的商团将接管约束器具、契约劳役和人员登记。</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>蕾娜</span><p>“所以他们追杀车队，不是为了阻止交易——只是为了掩盖你们早就谈妥的条件。”</p></div>
        <p class="wrong-letter-after">镇长让卫兵带走蕾娜，并命你去城门见两名新监督官。你完成了调查，却发现委托你调查的人本就站在派克那边。</p>`,
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
    const scene = publicDemo ? '在告示柱与戴蒙德身旁' : '在城门登记桌后'
    if (part === 'oral') return `${actor}${scene}按住你的后脑：“用嘴还。含住，跟着拍子，别停。”`
    if (part === 'vagina') return `${actor}${scene}压住你的腰，分开你的腿：“前面张开。这笔账从这里进。”`
    if (part === 'body') return `${actor}${scene}把你按在桌沿上：“穴用不成，就打。一下一声，打完这笔才算。”`
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
        attackName: step.publicDemo ? '当众还账' : '在桌后还账',
        desc: `${caravanDebtServiceDesc(part, step.actor, step.publicDemo)}墨菲在旁边翻着那张 ${debt}G 的条子，做完一段才肯划一笔。`,
        bpm: bodyFallback ? 60 : step.bpm,
        seconds: bodyFallback ? 30 : step.seconds,
        dmg: 0,
        noDamage: true,
        dildoName: bodyFallback ? '' : '商团验收用具',
        completeLabel: '✅ 这一段做完了',
        dialogClass: 'p-gate-debt-task-modal',
      })
      if (result) { failed = true; break }
    }

    if (failed) {
      state._pCaravanDebt = debt + 20
      EventBus.emit('ui:log', { text: `🧾 你没做完。墨菲在条子上又加了 20G，现在是 ${state._pCaravanDebt}G。`, type: 'danger' })
      EventBus.emit('state:changed', state)
      State.save()
      settleCaravanDebt()
      return
    }

    state._pCaravanDebt = 0
    EventBus.emit('ui:log', { text: mode === 'public' ? `📣 告示柱那边做完了。墨菲划掉了 ${debt}G。` : `◆桌后做完了。墨菲划掉了 ${debt}G。`, type: 'warning' })
    EventBus.emit('state:changed', state)
    State.save()
    showPGateChapter()
  }

  function chooseSmallPrivateDebtService () {
    const state = State.get()
    const penetration = state.gender !== 'male' && !ChastitySystem.isWorn() ? 'vagina' : 'anal'
    campShow({
      title: '◆ 登记桌后',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: '<section class="scene-dialogue"><i aria-hidden="true">◆</i><div><h3>贝拉米用短鞭指了指桌后的空地。</h3><p>“就一次。嘴，还是下面，你自己趴过来。”墨菲已经把笔蘸好，等着划这一笔。</p></div></section>',
      actions: [
        { label: '用嘴', cls: 'btn-danger', handler: () => runCaravanDebtTasks('private', 'oral') },
        { label: penetration === 'vagina' ? '用前面' : '用后面', cls: 'btn-danger', handler: () => runCaravanDebtTasks('private', penetration) },
        { kind: 'navigation', label: '先回去', handler: settleCaravanDebt },
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
      EventBus.emit('ui:log', { text: `🧾 你把 ${debt}G 放到墨菲账上，那张条子被划掉了。`, type: 'warning' })
      EventBus.emit('state:changed', state)
      State.save()
      showPGateChapter()
    }
    const privateLabel = tier === 1 ? '跪到桌子后面' : tier === 2 ? '让他们两个轮流来' : '让他们两个一起上'
    const publicAction = tier >= 2
      ? [{ label: tier === 2 ? '走到告示柱旁边' : '当着排队的人还', cls: 'btn-danger', handler: () => runCaravanDebtTasks('public') }]
      : []
    campShow({
      title: '🧾 城门 · 旧桥的条子',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🧾</i><div><h3>墨菲用笔尾敲了敲旧桥看守留下的条子。</h3><p>“${debt}G。名字是你的。不过这道门，条子还在我手上。”</p></div></section>
        <div class="wrong-letter-evidence ${fourfold ? 'is-found' : ''}"><span>${fourfold ? '四道锁' : captured ? '押送' : '搜身'}</span><p>${fourfold ? '他把你戴着锁进城的那页也翻了出来，和条子压在一起。' : captured ? '贝拉米看了你一眼：“车上那次我记得。先把这个了了。”' : '贝拉米只看金额：“看守写的。把账了了再谈别的。”'}</p></div>
        <section class="p-hall-order"><span>贝拉米</span><blockquote>${tier === 1 ? '“就这点钱。放下，或者跪到桌子后面。告示柱那边今天不收小账。”' : '“钱留下也行。不然跪到桌子后面，或者自己走到告示柱那边去。那边围着人，可不会让你少做。”'}</blockquote></section>`,
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
    const choices = state._pInvestigationChoices || {}
    const evidenceLed = [choices.barkeep, choices.blacksmith].filter(choice => choice === 'permit').length >= 1
    state._pMainlineStage = 1
    EventBus.emit('state:changed', state)
    State.save()

    const arrival = captured
      ? fourfoldEscort
        ? '<h3>墨菲把黑皮册翻回你第一次被货车送进城的那一页。</h3><p>贝拉米一眼认出了旧桥临时编号。这一次，证人、账本和镇长的命令都已到齐，临时备忘录将被换成正式身份记录。</p>'
        : `<h3>${provoked ? '货车停下时，叫来的那几名看守都来认了你的脸。' : '套在腕上的绳子被人从车尾解下，却没有完全松开。'}</h3><p>两名陌生监督官守在新告示旁。一个佩短鞭，自称贝拉米；另一个叫墨菲，正把入城者的名字逐个抄进黑皮册。</p>`
      : `<h3>${provoked ? '贝拉米看了看你，又看了看被抬回来的几名看守。' : '你把沾着桥下泥水的许可放到新告示旁。'}</h3><p>佩短鞭的监督官自称贝拉米。墨菲翻开黑皮册，很快找到了那辆货车和你的名字。</p>`
    const memory = captured
      ? fourfoldEscort
        ? '“四道锁具把你送进城，你又真的回旧桥找到了活口。那张临时入库单，现在可以正式结算了。”'
        : (provoked ? '“在桥上把我们所有人都叫出来，然后输掉——胆子不小，脑子另说。”' : '“落单的人都敢截，至少还算有点胆量。”')
      : (provoked ? '“你叫他们一起上，最后还把人全放倒了。派克先生会想见你。”' : evidenceLed ? '“一路查许可、查印章。你很清楚该抓住哪根线。”' : '“一个人截下看守，还把许可带了回来。手脚很利落。”')

    campShow({
      title: '⚖️ 雾灯镇 · 城门换岗',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${captured ? '⛓️' : '📜'}</i><div>${arrival}</div></section>
        <div class="wrong-letter-evidence is-found"><span>贝拉米</span><p>${memory}</p></div>
        <section class="p-gate-witness"><i aria-hidden="true">◇</i><div><h3>告示柱旁跪着一个戴着旧编号牌的女人。</h3><p>她本名黛雅，商团只称她为戴蒙德。她并不是等待登记的新人，而是被贝拉米训练多年、专门用来向外来者展示新规后果的奴隶。</p></div></section>
        <p class="wrong-letter-after">墨菲命令戴蒙德当众重复自己的编号与身份。贝拉米则把短鞭横在你与街口之间：“看清楚。进了这道门，你打算以什么身份进去？”</p>`,
      actions: [
        { label: 'S 路线 · 商团执行人（开发中）', cls: 'btn-primary', disabled: true, handler: () => {} },
        { label: 'M 路线 · 受支配者', cls: 'btn-danger', handler: () => choosePGateRole('slave') },
        { label: '自由身路线 · 受监视的旅人', handler: () => choosePGateRole('free') },
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
    EventBus.emit('state:changed', state)
    State.save()

    const isSlave = role === 'slave'
    const title = isSlave ? '墨菲在黑皮册里写下你的临时编号。' : '墨菲在你的名字旁标注“自由身观察”。'
    const line = isSlave ? '“M 路线已经登记。后续训练将在下一章开放。”' : '“自由身路线已经登记。你暂时可以继续在镇内活动。”'
    const after = '《欲缚镇 · 序章》到此结束。第一章尚在制作中，当前版本不会继续触发商团会馆主线。'

    EventBus.emit('ui:log', { text: isSlave ? '⛓️ 已选择 M 路线；后续章节暂未开放。' : '◇ 已选择自由身路线；后续章节暂未开放。', type: isSlave ? 'danger' : 'warning' })
    campShow({
      title: '⚖️ 欲缚镇 · 序章完成',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${isSlave ? '⛓️' : '◇'}</i><div><h3>${title}</h3><p>${line}</p></div></section>
        <p class="wrong-letter-after">${after}</p>`,
      actions: [{ label: '返回欲缚镇', cls: 'btn-primary', handler: open }],
    })
  }

  function enterPHall () {
    const state = State.get()
    if (state._pChapterOneLocked) {
      campShow({
        title: '🏛️ 商团会馆 · 尚未开放',
        className: 'camp-tavern-modal p-gate-modal',
        body: '<section class="scene-dialogue"><i aria-hidden="true">🔒</i><div><h3>第一章仍在制作中。</h3><p>当前版本停在身份选择完成之后；后续路线写完时会从这里继续。</p></div></section>',
        actions: [{ kind: 'navigation', label: '返回欲缚镇', handler: open }],
      })
      return
    }
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
      ? { icon: '◆', title: '派克看完你带来的许可、残页与口供，没有立刻称赞。', text: '他问你是否明白，发现一条运输线与经营一座城完全不同。若真想替商团做事，就先证明贝拉米会服从你传达的命令。', after: '派克命你返回城门，把戴蒙德完整地带到会馆。这是你的第一项正式考核。' }
      : role === 'slave'
        ? { icon: '⛓️', title: '派克让书记官念出你的临时编号，像验收一件刚送到的货物。', text: '他没有立即安排训练，而是要你先回到贝拉米面前。戴蒙德将与你一同返回会馆；你必须亲眼看清商团如何处置一个受训奴隶。', after: '你仍是被押送者，却被临时赋予了一项任务：跟随戴蒙德回到派克面前。' }
        : { icon: '◇', title: '派克把镇长签署的名单压在手下，承认错投的货单确实来自自己。', text: '他对你的调查能力更感兴趣，也不介意你暂时拒绝加入。作为交换，他要你回城门带来戴蒙德，并观察贝拉米是否服从会馆命令。', after: '你仍是自由人，但派克已经把你拖进他的权力试验。' }
    EventBus.emit('ui:log', { text: '🏛️派克命你返回城门，把戴蒙德带到会馆。', type: 'warning' })
    campShow({
      title: '🏛️ 商团会馆 · 初见派克',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${scene.icon}</i><div><h3>${scene.title}</h3><p>${scene.text}</p></div></section>
        <section class="p-hall-order"><span>派克</span><blockquote>“回城门找贝拉米。告诉他，我要戴蒙德现在就来会馆。然后把她带回来。”</blockquote></section>
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
      ? { icon: '◆', title: '贝拉米听完派克的命令，却故意没有立刻交出锁链。', text: '他先让你辨认戴蒙德的编号、训练等级和押送规则，随后才把锁链递来：“带错人、弄丢人，或者心软——都算你失败。”', after: '你接过戴蒙德的押送链。她没有求救，只提醒你贝拉米正等着看你犯错。' }
      : role === 'slave'
        ? { icon: '⛓️', title: '贝拉米笑着让墨菲把你的临时链扣到戴蒙德的锁链上。', text: '他拒绝把任何一人单独交给你，声称“财产不能押送财产”。直到派克的印牌被拿出来，他才命令两名卫兵押着你们同行。', after: '你和戴蒙德被编入同一支押送队。她低声告诉你：别在街上反抗，先活着走到派克面前。' }
        : { icon: '◇', title: '贝拉米当面拒绝了派克的命令，声称戴蒙德属于城门岗哨。', text: '你出示黄铜牌和完整口供后，墨菲才指出会馆命令优先。贝拉米最终松开锁链，却警告戴蒙德若偏离路线就会由旁人受罚。', after: '戴蒙德跟在你身旁前往会馆。你没有成为押送者，也无法假装只是一个旁观者。' }
    EventBus.emit('ui:log', { text: role === 'slaver' ? '◆贝拉米把戴蒙德的押送链交给了你。' : role === 'slave' ? '⛓️ 你与戴蒙德被一同押往会馆。' : '◇ 你迫使贝拉米执行派克的命令，戴蒙德将随你前往会馆。', type: role === 'slave' ? 'danger' : 'warning' })
    campShow({
      title: '⛓️ 城门岗哨 ·派克的命令',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${scene.icon}</i><div><h3>${scene.title}</h3><p>${scene.text}</p></div></section>
        <p class="wrong-letter-after">${scene.after}</p>`,
      actions: [{ label: '带戴蒙德返回商团会馆', cls: 'btn-primary', handler: open }],
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
    EventBus.emit('ui:log', { text: role === 'slaver' ? '◆派克安排你接受基础执行人训练。' : role === 'slave' ? '⛓️派克将你送回贝拉米处接受奴隶训练。' : '◇ 你拒绝加入商团，但获得了暂时的自由通行。', type: role === 'slave' ? 'danger' : 'warning' })
    showPHallResolution(scene, role)
  }

  function showPikeSecondAudience () {
    const state = State.get()
    if (state._pMainlineStage !== 5) { open(); return }
    const role = state._pRole || 'free'
    const opening = role === 'slaver'
      ? { icon: '◆', title: '戴蒙德被带到长桌前，派克只检查了锁链和押送记录。', text: '贝拉米的刁难、路上的停顿和抵达时间都写在同一张考核纸上。派克宣布你通过了第一项测试。' }
      : role === 'slave'
        ? { icon: '⛓️', title: '你与戴蒙德再次站到派克面前，这次黑皮册已经准备好正式编号。', text: '派克没有把你当作救回证人的调查者，而是把那段经历写成“判断力尚可”的财产评估。' }
        : { icon: '◇', title: '戴蒙德安全抵达，派克也确认贝拉米违抗命令的经过。', text: '他没有惩罚贝拉米，只把这当成一次筛选：看你会顺从、退缩，还是利用制度迫使对方让步。' }

    const actions = role === 'slaver'
      ? [{ label: '接受派克的基础执行人训练', cls: 'btn-primary', handler: () => finishPikeRoute('slaver', 'slaver_training', { icon: '◆', title: '派克把带缺口的铁印推到你面前。', text: '从现在起，你可以替商团接取任务，但还必须向贝拉米学习如何管理俘虏与执行命令。', after: '奴隶贩子路线开启：下一阶段是贝拉米的基础训练。' }) }]
      : role === 'slave'
        ? [{ label: '被押回贝拉米处接受训练', cls: 'btn-danger', handler: () => finishPikeRoute('slave', 'slave_training', { icon: '⛓️', title: '派克在证书下方写下自己的名字。', text: '戴蒙德被送往会馆内侧，而你将返回城门，由贝拉米安排第一阶段训练。', after: '奴隶路线开启：失败和拒绝都已经成为后续人物记住的经历。' }) }]
        : [
            { label: '保持自由，只替派克调查必要的事情', cls: 'btn-primary', handler: () => finishPikeRoute('free', 'free_observer', { icon: '◇', title: '派克收回了准备好的铁印。', text: '他允许你作为受监视的自由人留在镇内，但每一次调查都会被贝拉米记录。', after: '自由人路线开启：你可以接近商团，也可以继续寻找反抗它的方法。' }) },
            { label: '接受执行人训练，借机进入商团内部', handler: () => finishPikeRoute('slaver', 'slaver_training', { icon: '◆', title: '你接过了派克的铁印。', text: '派克看得出你仍有保留，却并不在意。能完成命令的人，才有资格知道商团下一步要做什么。', after: '奴隶贩子路线开启：你将接受贝拉米的基础训练。' }) },
          ]
    campShow({
      title: '🏛️ 商团会馆 · 第二次会面',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">${opening.icon}</i><div><h3>${opening.title}</h3><p>${opening.text}</p></div></section>
        <section class="p-hall-order"><span>派克</span><blockquote>“戴蒙德只是命令的一部分。真正送到我面前的，是你选择成为的那个人。”</blockquote></section>`,
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
        text: '派克让书记官把你与黛雅写在同一页：“勇气不能替你赢下一场已经输掉的战斗。”黑蜡印先后落在两个名字下面。',
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
