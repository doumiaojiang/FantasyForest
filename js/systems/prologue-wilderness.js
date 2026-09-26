/**
 * systems/prologue-wilderness.js —《欲缚镇 · 序章》旧桥与野外运行模块。
 *
 * 任务顺序：收到错信 → 旧桥核对车辙 → 调查酒馆与铁匠
 * → 返回旧桥寻找遗失许可 → 搜查桥下车队残骸 → 桥洞据点救出证人
 * → 镇内复查与镇长复命 → 城门见证新法生效。
 */
(window.__PrologueRuntime ||= {}).wilderness = (function () {
  /**
   * 车队战败后的押送属于连续剧情，不使用悬浮 Dialog。
   * 和“奴隶线·第一章”一样，将内容写进营地主场景面板；只有计时、计数
   * 以及装备确认仍由各自的操作弹窗负责。
   */
  function showCaravanDefeatScene (options) {
    const scene = {
      ...options,
      className: `camp-tavern-modal wrong-letter-reaction-modal p-gate-modal p-m-chapter-modal caravan-defeat-scene ${options.className || ''}`.trim(),
    }
    if (window.CampSystem && CampSystem.showScene) {
      if (CampSystem.ensurePhase) CampSystem.ensurePhase()
      return CampSystem.showScene(scene)
    }
    return Dialog.show(scene)
  }

  function closeCaravanDefeatScene () {
    if (window.CampSystem && CampSystem.closeScene) CampSystem.closeScene()
    Dialog.close()
  }

  function saveProgress (stage, log) {
    const state = State.get()
    state._wrongCommissionStage = Math.max(state._wrongCommissionStage || 0, stage)
    if (log) EventBus.emit('ui:log', { text: log, type: 'warning' })
    EventBus.emit('state:changed', state)
    State.save()
  }

  function firstBridgeInspection () {
    const copy = PROLOGUE_CONTENT.bridge.firstInspection
    saveProgress(3, '🌉 旧桥上的车辙证实，派克的货物已经分批送进雾灯镇。')
    Dialog.show({
      title: copy.title,
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🛞</i><div><h3>${copy.heading}</h3><p>${copy.text}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>货单得到印证</span><p>${copy.evidence}</p></div>`,
      actions: [{ label: '回镇里调查', cls: 'btn-primary', handler: () => { Dialog.close(); GameFlow.afterEvent() } }],
    })
  }

  function grantBridgePermit (aftermath) {
    const state = State.get()
    state.inventory.consumables.raven_latch = Math.max(1, state.inventory.consumables.raven_latch || 0)
    state._wrongCommissionOutcome = 'permit'
    state._wrongCommissionStage = Math.max(5, state._wrongCommissionStage || 0)
    state._pBridgePermitAcquired = true
    state._pBridgeAftermath = aftermath || 'permit'
    EventBus.emit('state:changed', state)
    State.save()
  }

  function finalBridgeInspection () {
    const state = State.get()
    const copy = PROLOGUE_CONTENT.bridge.permit
    if (!state._pBridgePermitAcquired) grantBridgePermit('permit')
    Dialog.show({
      title: copy.title,
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📜</i><div><h3>${copy.heading}</h3><p>${copy.text}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>许可背面</span><p>${copy.back}</p></div>
        <p class="wrong-letter-after">${copy.after}</p>`,
      actions: [{ label: '收起许可，沿桥墩下去', cls: 'btn-primary', handler: () => {
        state._pBridgeAftermath = null
        EventBus.emit('ui:log', { text: '📜 你收好了雾灯镇签发给派克商队的通行许可。', type: 'warning' })
        EventBus.emit('state:changed', state)
        State.save()
        Dialog.close()
        inspectCaravanWreck()
      } }],
    })
  }

  function recoverCaravanClothes () {
    const state = State.get()
    Dialog.show({
      title: '👙 旧桥 · 遗失的衣物',
      className: 'commission-bridge-modal caravan-clothes-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🌉</i><div><h3>看守倒下了，你的衣服却不在他身边。</h3><p>桥面散着被踩乱的绳索与车队印泥。断栏外侧挂着一小片熟悉的布料，衣物可能被他随手抛到了桥下。</p></div></section>
        <div class="wrong-letter-evidence"><span>战场遗留</span><p>沿着断栏边缘和桥墩缝隙寻找，应该还能把衣服找回来。</p></div>`,
      actions: [{ label: '在桥栏下寻找衣服', cls: 'btn-primary', handler: () => {
        Dialog.show({
          title: '👕 找回衣物',
          className: 'commission-bridge-modal caravan-clothes-modal',
          body: `<section class="scene-dialogue"><i aria-hidden="true">👕</i><div><h3>衣服卡在桥墩伸出的旧铁钉上。</h3><p>上面沾着灰土和车队墨迹，但没有完全损坏。你把它从桥下扯了回来。</p></div></section>
            <div class="wrong-letter-evidence is-found"><span>被没收的衣服</span><p>点击穿上后解除「全裸」状态，再继续搜查车队留下的许可。</p></div>`,
          actions: [{ label: '穿上衣服', cls: 'btn-primary', handler: () => {
            if (StatusSystem.has('naked')) StatusSystem.remove('naked')
            state._pCaravanClothesAwaitingRecovery = false
            state._pBridgeAftermath = 'permit'
            EventBus.emit('ui:log', { text: '👕 你找回并穿上了被没收的衣服。', type: 'good' })
            EventBus.emit('state:changed', state)
            State.save()
            Dialog.close()
            finalBridgeInspection()
          } }],
        })
      } }],
    })
  }

  function inspectCaravanWreck () {
    const state = State.get()
    const copy = PROLOGUE_CONTENT.bridge.wreck
    if ((state._wrongCommissionStage || 0) !== 5) { GameFlow.openCamp(); return }
    state._pCaravanTrailSeen = true
    saveProgress(6, '🛞 你在旧桥下找到被洗劫的车队残骸，拖拽痕迹一直延伸进封死的桥洞。')
    Dialog.show({
      title: copy.title,
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🛞</i><div><h3>${copy.heading}</h3><p>${copy.text}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>桥洞里的痕迹</span><p>${copy.evidence}</p></div>
        <p class="wrong-letter-after">${copy.after}</p>`,
      actions: [{ label: '靠近桥洞里的营火', cls: 'btn-primary', handler: () => { Dialog.close(); enterBanditHideout() } }],
    })
  }

  function startBanditBattle (returning = false) {
    const state = State.get()
    if ((state._wrongCommissionStage || 0) !== 6) { GameFlow.openCamp(); return }
    Dialog.close()
    EventBus.emit('ui:log', {
      text: returning
        ? '⚔️ “这不是上次那只肉便器吗？！”哨探从旧位置走了过来。'
        : '⚔️ 你踏进桥洞。哨探已经从斜坡阴影里摸到你背后。',
      type: 'danger',
    })
    State.save()
    GameFlow.startBattle('p_bandit_leader', { story: 'commission-bandits', noElite: true, banditNoCover: returning })
  }

  async function runBanditTask (enemyName, attackName, desc, options = {}) {
    if (typeof BattleUI === 'undefined' || !BattleUI.showTaskDialog) return false
    if (Array.isArray(options.segments) && options.segments.length) {
      let failed = false
      const startSegment = Math.max(0, Math.min(options.segments.length, Math.floor(Number(options.startSegment) || 0)))
      for (let index = startSegment; index < options.segments.length; index++) {
        const segment = options.segments[index]
        failed = (await BattleUI.showTaskDialog({
          enemyName: `${enemyName}（${index + 1}/${options.segments.length}）`,
          attackName: segment.name || attackName,
          desc: segment.desc || desc,
          bpm: segment.bpm || 0,
          seconds: segment.seconds || 0,
          taskCount: segment.count || 0,
          taskTool: segment.tool || '',
          taskSteps: segment.taskSteps || [],
          dmg: 0, noDamage: true,
          allowSkip: segment.allowSkip !== false && options.allowSkip !== false,
          completeLabel: segment.completeLabel || options.completeLabel || '完成',
          dialogClass: 'commission-bandit-aftermath-task',
        })) || failed
        if (typeof options.onSegment === 'function') options.onSegment(index + 1)
      }
      return failed
    }
    return BattleUI.showTaskDialog({
      enemyName, attackName, desc,
      bpm: options.bpm || 0,
      seconds: options.seconds || 0,
      taskCount: options.taskCount || 0,
      taskTool: options.taskTool || '',
      taskSteps: options.taskSteps || [],
      dmg: 0, noDamage: true,
      allowSkip: options.allowSkip !== false,
      completeLabel: options.completeLabel || '完成',
      dialogClass: 'commission-bandit-aftermath-task',
    })
  }

  function lockBanditClothes () {
    const state = State.get()
    if (StatusSystem.has('naked')) StatusSystem.remove('naked')
    StatusSystem.apply('naked', 99999, { source: 'p_bandit_chest' })
    state._pBanditClothesLocked = true
    EventBus.emit('ui:log', { text: '👙 他们把你扔上断桥时没有给你衣服。', type: 'danger' })
  }

  function banditOrifice (kind) {
    return BanditLeaderContent.orifice(kind)
  }

  function ensureBanditToySession (repeat) {
    const state = State.get()
    if (state._pBanditToySession && Array.isArray(state._pBanditToySession.uses) && state._pBanditToySession.uses.length) return state._pBanditToySession
    const days = 2 + Math.floor(Math.random() * 2)
    const defeatResult = state._pBanditDefeatResult || {}
    const livingCrewIds = Array.isArray(defeatResult.livingCrewIds) ? defeatResult.livingCrewIds : []
    const session = { days, uses: BanditLeaderContent.pickDefeatToyUses(days, livingCrewIds), index: 0, repeat: !!repeat }
    state._pBanditToySession = session
    return session
  }

  async function playBanditToyDefeat (repeat = false) {
    const state = State.get()
    const session = ensureBanditToySession(repeat)
    state._pBanditAftermath = 'defeat-toy'
    EventBus.emit('state:changed', state); State.save()
    Dialog.show({
      title: repeat ? '🍑 桥洞 · 免费精液飞机杯' : '🍑 桥洞 · 送上门的飞机杯',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🍑</i><div><p>头目把你锁在货箱上，当作营地公用飞机杯。他们把你留在桥洞里 <b>${session.days}</b> 天。每一天都会有人使用、惩罚或公开展示你。你的身上会被写满淫语和“正”，直到他们把你扔回断桥。</p></div></section>
        <section class="p-hall-order"><span>强盗头目</span><blockquote>${repeat ? '“被灌满扔出去的飞机杯，自己又爬回来了。”' : '“名单不在这屄货身上。那就先当几天公用飞机杯吧。”'}</blockquote></section>`,
      actions: [{ label: '被留下当营地的公用飞机杯', cls: 'btn-danger', handler: () => { Dialog.close(); continueBanditToySession() } }],
    })
  }

  async function continueBanditToySession () {
    const state = State.get()
    const session = ensureBanditToySession(false)
    const index = Math.max(0, Math.min(session.uses.length, Number(session.index) || 0))
    if (index >= session.uses.length) {
      showBanditDiscard(!!session.repeat)
      return
    }
    const structured = session.uses.length === session.days * 2
    const day = Math.floor(index / 2) + 1
    if (structured && index > 0 && index % 2 === 0 && session.announcedDay !== day) {
      session.announcedDay = day
      state._pBanditToySession = session
      EventBus.emit('state:changed', state); State.save()
      await new Promise(resolve => {
        Dialog.show({
          title: `🍑 桥洞 · 第${day}天`,
          className: 'commission-bridge-modal',
          body: `<section class="scene-dialogue"><i aria-hidden="true">🔥</i><div><h3>营火重新点起来。这是第 ${day} 天，一共 ${session.days} 天。</h3><p>今天你还是营地里的公用飞机杯，先到先得。</p></div></section>`,
          actions: [{ label: '继续', cls: 'btn-danger', handler: () => { Dialog.close(); resolve() } }],
        })
      })
    }
    const latest = State.get()
    const current = latest._pBanditToySession || session
    const use = current.uses[index]
    latest._pBanditAftermath = 'defeat-toy'
    latest._pBanditDefeatScene = index + 1
    current.index = index
    EventBus.emit('state:changed', latest); State.save()
    const endOfDay = structured && index % 2 === 1
    const last = index + 1 >= current.uses.length
    const label = structured
      ? `${use.name}（第${day}天 · ${index % 2 === 0 ? '操穴' : '惩罚'}）`
      : `${use.name}（${index + 1}/${current.uses.length}）`
    await runBanditTask(use.actor, label, use.desc, {
      bpm: use.bpm, seconds: use.seconds, taskCount: use.taskCount, taskTool: use.taskTool,
      completeLabel: last ? '完成' : endOfDay ? '完成' : '继续',
    })
    session.index = index + 1
    state._pBanditToySession = session
    EventBus.emit('state:changed', state); State.save()
    if (session.index >= session.uses.length) showBanditDiscard(!!session.repeat)
    else continueBanditToySession()
  }

  function showBanditDiscard (repeat = false) {
    const state = State.get()
    const lost = Math.max(0, Number((state._pBanditDefeatResult || {}).goldLost) || 0)
    Dialog.show({
      title: '🩸 断桥 · 不可回收垃圾',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🩸</i><div><p>他们把你像垃圾一样丢在断桥边。没有衣服，身上写满淫语和“正”。${lost ? `身上仅剩的 ${lost}G 也被头目搜走。` : '钱袋早就空了。'}</p></div></section>
        <section class="p-hall-order"><span>强盗头目</span><blockquote>“${repeat ? '把这垃圾扔出去，反正这屄货过几天洗干净穴又回来了，哈哈哈哈！' : '操坏的飞机杯毫无价值，还占一份粮食。'}”</blockquote></section>
        <div class="wrong-letter-evidence"><span>提示</span><p>你可以先回镇，也可以马上再进洞。</p></div>`,
      actions: [
        { kind: 'navigation', label: '先回镇里', handler: () => finishBanditDiscard(true) },
        { label: '再次进入桥洞', cls: 'btn-danger', handler: () => finishBanditDiscard(false) },
      ],
    })
  }

  function finishBanditDiscard (toTown) {
    const state = State.get()
    state._pBanditAftermath = null
    state._pBanditDefeatScene = 0
    state._pBanditDefeatResult = null
    state._pBanditToySession = null
    state._pBanditTradeStep = 0
    state._pBanditGateReactionPending = toTown && StatusSystem.has('naked')
    EventBus.emit('state:changed', state); State.save(); Dialog.close()
    if (toTown) GameFlow.openCamp()
    else enterBanditHideout()
  }

  async function fakeWitnessTrade () {
    const state = State.get()
    const oral = banditOrifice('oral')
    const anal = banditOrifice('anal')
    const steps = [
      ['☠️ 强盗头目', '嘴穴第一轮', `你跪下来求强盗头目把她放了。头目笑着把鸡巴塞进你的${oral}里：“你说放我就放啊，你给我舔舐高兴了，没准我就放了呢～”。以 90 BPM 的速度为鸡巴口交。`, { bpm: 90, seconds: 35 }],
      ['☠️ 强盗头目', '菊穴第一轮', `他就把你翻过去，将肉棒整根硬生生地插进了你的${anal}。以 90 BPM的速度抽插。`, { bpm: 90, seconds: 35 }],
      ['☠️ 强盗头目', '嘴穴第二轮', '给我把肉棒舔舐干净再说话开始。又一根肉棒插了进你的嘴穴，以 120 BPM速度操你的嘴穴。', { bpm: 120, seconds: 30 }],
      ['☠️ 强盗头目', '菊穴第二轮', `他拍着被操开的${anal}：“这才是开始。”以 120 BPM的速度进行抽查。`, { bpm: 120, seconds: 30 }],
      ['☠️ 强盗头目', '嘴穴第三轮', '没用的废物，给我含住。强盗头目的鸡巴插在了你的深喉深处，哨探和扒手在旁边笑。进行深喉保持20秒', { bpm: 0, seconds: 20 }],
      ['☠️ 强盗头目', '菊穴第三轮', '强盗头目以全进全出的腰法操你的你死去活来，然后把精液射在最深处，把你像用完的避孕套一样扔在了一遍。以 90 BPM 的速度，肉棒全进全出的进行抽插', { bpm: 90, seconds: 30 }],
    ]
    Dialog.close()
    state._pBanditAftermath = 'witness-trade'
    let step = Math.max(0, Math.min(steps.length, Math.floor(Number(state._pBanditTradeStep) || 0)))
    EventBus.emit('state:changed', state); State.save()
    for (; step < steps.length; step++) {
      await runBanditTask(...steps[step])
      const latest = State.get()
      latest._pBanditTradeStep = step + 1
      latest._pBanditAftermath = 'witness-trade'
      EventBus.emit('state:changed', latest); State.save()
    }
    const latest = State.get()
    EventBus.emit('ui:log', { text: '🩸 三轮用完，他们把你笑着扔回断桥。蕾娜仍锁在木栅后。“做白日梦，下辈子吧！”', type: 'danger' })
    latest._pBanditTradeStep = 0
    latest._pBanditAftermath = 'defeat-discard'
    EventBus.emit('state:changed', latest); State.save()
    showBanditDiscard(true)
  }

  function buyWitness () {
    const state = State.get()
    const price = 600
    if (state.gold >= price) {
      state.gold -= price
      state._pBanditWitnessBegged = true
      state._pBanditBridgeToll = false
      EventBus.emit('ui:log', { text: `💰 你当场付清 ${price}G：你和人质各 300G。头目仍没把衣服给你。`, type: 'danger' })
      EventBus.emit('state:changed', state); State.save(); Dialog.close()
      rescueCaravanWitness('bought')
      return
    }
    state._pBanditRansomDebt = (state._pBanditRansomDebt || 0) + 1200
    state._pBanditWitnessBegged = true
    state._pBanditBridgeToll = true
    EventBus.emit('ui:log', { text: '🧾 你欠下 1200G。从此每次路过旧桥，都要给头目口交、深喉、肛交和性交各一次。', type: 'danger' })
    EventBus.emit('state:changed', state); State.save(); Dialog.close()
    rescueCaravanWitness('bought')
  }

  function enterBanditHideout () {
    const state = State.get()
    if ((state._wrongCommissionStage || 0) !== 6) { GameFlow.openCamp(); return }
    if ((state._pBanditDefeatCount || 0) >= 1) {
      Dialog.show({
        title: '🌉 旧桥下 · 老熟人',
        className: 'commission-bridge-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🔥</i><div><p>头目一眼就认出你，他的笑声从货箱传到洞口。</p></div></section>
          <section class="p-hall-order"><span>强盗头目</span><blockquote>“这不是上次那个飞机杯吗？！自己爬回来，是来打，还是来跪？”</blockquote></section>
          <p class="wrong-letter-after">当场付 600G 可带走人质；付不起可以贷款 1200G，但是之后每次路过旧桥都要给头目口交、深喉、肛交和性交各一次。想要换人，那你至少要付出一点代价吧！</p>`,
        actions: [
          { label: '再打一次', cls: 'btn-danger', handler: () => startBanditBattle(true) },
          { label: '尝试空手换人', cls: 'btn-danger', handler: fakeWitnessTrade },
          { label: state.gold >= 600 ? '付 600G 买下两个人' : '欠 1200G 把人带走', cls: 'btn-primary', handler: buyWitness },
          { kind: 'navigation', label: '退回桥面', handler: () => { Dialog.close(); GameFlow.afterEvent() } },
        ],
      })
      return
    }
    Dialog.show({
      title: '🌉 旧桥下 · 强盗据点',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🔥</i><div><h3>斜坡上先有人影动了一下，你没有在意。</h3><p>桥洞被木板和旧货箱隔成营地。被俘的女人锁在最深处的笼子里，好像是穿着车队记账员的蓝色外套，手里还攥着半张撕破的纸？ 强盗蹲在营火边翻她的包裹，头目。</p></div></section>
        <section class="p-hall-order"><span>强盗头目</span><blockquote>“嚯～来客人了呀，小的们，上！”</blockquote></section>
        <div class="wrong-letter-evidence"><span>据点情况</span><p>哨探会躲在阴影里发现了你，你发现营地里还有扒手与头目。你现在可以逃跑，逃跑不会推进任务；击倒头目，你才能拿回账册。</p></div>`,
      actions: [
        { kind: 'navigation', label: '先逃跑吧，这么多人！', handler: () => { Dialog.close(); GameFlow.afterEvent() } },
        { label: '前去营救', cls: 'btn-danger', handler: startBanditBattle },
      ],
    })
  }

  function showBanditVictoryFall () {
    const state = State.get()
    const result = state._pBanditVictoryResult || { fleeingCrew: 0, gold: 0 }
    state._pBanditAftermath = 'victory-fall'
    EventBus.emit('state:changed', state); State.save()
    Dialog.show({
      title: '☠️ 战胜强盗头目',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">☠️</i><div><h3>头目倒下了，桥洞里只剩营火和笼子里的锁链声。</h3><p>${result.fleeingCrew > 0 ? `剩余 ${result.fleeingCrew} 名手下跑着离开了桥洞。` : '他的手下们也都被你击败了。'}你从他们身上搜出 ${result.gold || 0}G，以及能证明这批货通往镇务厅的账页。</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>战利品</span><p>你打赢了强盗头目。你可以先穿上衣服后，再去救笼子里的人。</p></div>`,
      actions: [{ label: '继续', cls: 'btn-primary', handler: () => { Dialog.close(); continueBanditVictory() } }],
    })
  }

  function continueBanditVictory () {
    const state = State.get()
    // 输过后即使已经在镇里买了替换装，原衣仍锁在头目的箱子里。
    // 胜利时必须给玩家取回原衣的选择，不能因为当前并非全裸就静默销毁锁箱状态。
    if (StatusSystem.has('naked') || state._pBanditClothesLocked) {
      state._pBanditAftermath = 'clothes'
      EventBus.emit('state:changed', state); State.save()
      recoverBanditClothes()
      return
    }
    if ((state._pBanditDefeatCount || 0) > 0) {
      showBanditVictoryMark()
      return
    }
    finishBanditVictory()
  }

  function showBanditVictoryMark () {
    const state = State.get()
    if ((state._pBanditDefeatCount || 0) < 1) {
      finishBanditVictory()
      return
    }
    state._pBanditAftermath = 'victory-mark'
    EventBus.emit('state:changed', state); State.save()
    Dialog.show({
      title: '🩸 桥洞 · 身上的淫话',
      className: 'commission-bridge-modal',
      body: '<section class="scene-dialogue"><i aria-hidden="true">🩸</i><div><h3>头目死了，身上被写满了淫语和淫纹。</h3><p>你可以通过浅滩的水把洗干净。</p></div></section>',
      actions: [
        { label: '擦掉', cls: 'btn-primary', handler: () => settleBanditMark('scrubbed') },
        { label: '先不擦', handler: () => settleBanditMark('kept') },
      ],
    })
  }

  function settleBanditMark (choice) {
    const state = State.get()
    state._pBanditMarkChoice = choice
    EventBus.emit('ui:log', { text: choice === 'scrubbed' ? '💧 你把身上的淫语和淫纹都擦掉了。' : '🩸 那些淫语和淫纹还留在你的皮肤上。', type: choice === 'scrubbed' ? 'good' : 'warning' })
    EventBus.emit('state:changed', state); State.save(); Dialog.close()
    finishBanditVictory()
  }

  function finishBanditVictory () {
    const state = State.get()
    state._pBanditAftermath = null
    state._pBanditVictoryResult = null
    state._pBanditClothesLocked = false
    state._pBanditBridgeToll = false
    EventBus.emit('state:changed', state); State.save()
    rescueCaravanWitness((state._pBanditDefeatCount || 0) > 0 ? 'revenge' : 'victory')
  }

  function rescueCaravanWitness (method = 'victory') {
    const state = State.get()
    const revengeLine = state._pBanditMarkChoice === 'scrubbed'
      ? '蕾娜看见你从浅滩回来，也看见强盗头目已经死了。她把半张名单递给你。'
      : '蕾娜看见那些还留在身上的字，羞红了脸。但是看见强盗头目已经死了。她把半张名单递给你。我可以跟你进城作证。'
    const revengeQuote = state._pBanditMarkChoice === 'scrubbed'
      ? '“谢谢你救了我！这个是名单，我看你是在找这个吧。”'
      : '“谢谢你救了我！你要不把那个....那个擦掉吧！这...这个是名单，我看你是在找这个吧。我可以跟你进城作证。”'
    state._wrongCommissionStage = 7
    state._wrongCommissionOutcome = 'permit'
    EventBus.emit('ui:log', { text: '🕯️ 你救出了车队记账员。她愿意带着名单去镇务厅作证。', type: 'good' })
    EventBus.emit('state:changed', state)
    State.save()
    Dialog.show({
      title: '🕯️ 旧桥下 · 活着的证人',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🕯️</i><div><h3>${method === 'bought' ? '头目收了钱，把笼子打开，把蕾娜推到你身边。' : '打开了笼子上的锁，女人却先扑向即将烧尽的文件。'}</h3><p>${method === 'bought' ? '蕾娜把剩下的半张名单藏进衣服里，催你立刻离开桥洞。' : method === 'revenge' ? revengeLine : '她是蕾娜，是车队的记账员。派克的货只是诱饵；真正重要的是镇务厅签署的合作名单。'}</p></div></section>
        ${method === 'bought' ? '<section class="p-hall-order"><span>蕾娜</span><blockquote>“谢谢你救了我。”</blockquote></section>' : ''}
        ${method === 'revenge' ? `<section class="p-hall-order"><span>蕾娜</span><blockquote>${revengeQuote}</blockquote></section>` : ''}
        <div class="wrong-letter-evidence is-found"><span>半张收货名单</span><p>酒馆、铁匠铺、城门卫队都在名单上。最后一栏的签署人属于镇务厅。</p></div>
        <p class="wrong-letter-after">${method === 'bought' ? '蕾娜记得你是将她赎了回来。' : '头目已经死了。'}她要你先护送她回雾灯镇。</p>`,
      actions: [{ label: '护送蕾娜返回镇务厅', cls: 'btn-primary', handler: () => { Dialog.close(); GameFlow.openCamp() } }],
    })
  }

  /** 从后期存档回测序章时，清掉会把读档强制推回 stage 10 的未来状态。 */
  function resetPostPrologueState (state) {
    state._wrongCommissionOutcome = null
    state._pMainlineStage = 0
    state._pRole = null
    state._pChapterOneLocked = false
    state._pGateChoices = []
    state._pMChapterStage = 0
    state._pMChapterStep = 0
    state._pMChapterBranch = null
    state._pMChapterAttitude = null
    state._pMWakeResist = 0
    state._pMSpankStack = 1
    state._pMStage2000SlapCount = 0
    state._pMStage2000SlapPending = false
    state._pMStage2000SlapReturn = null
    state._pMStage2500GearConfirmStep = 0
    state._pMStage2500GearConfirming = false
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
    state._pTownInquiry = { guard: false, merchant: false, citizen: false }
    state._pDefeatDispatchPending = false
    state._pDefeatPunished = false
    state._pDefeatSentenced = false
    state._pDefeatPunishmentStep = 0
    state._pCaravanEscortStage = 0
    state._pCaravanEscortResult = null
  }

  function startBridgeBattle (provoked) {
    const state = State.get()
    Dialog.close()
    resetPostPrologueState(state)
    state._wrongCommissionBattle = provoked ? 'provoked' : 'guard'
    EventBus.emit('ui:log', {
      text: provoked
        ? '⚔️ 你故意高声挑衅，远处的同伙也赶了过来。车队看守进入狂暴状态！'
        : '⚔️ 你抢先截住落单的车队看守。只要稳住阵脚，这一战并不危险。',
      type: provoked ? 'danger' : 'warning',
    })
    EventBus.emit('state:changed', state)
    State.save()
    GameFlow.startBattle('p_caravan_guard', {
      elite: provoked ? 'berserk' : false,
      hpMult: provoked ? 1.35 : 1,
      story: provoked ? 'commission-provoked' : 'commission-guard',
    })
  }

  function bridgeGuardEncounter () {
    Dialog.show({
      title: '🌉 旧桥 · 抢回许可',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🗡️</i><div><h3>你刚来到旧桥处，身后便响起脚步声。</h3><p>一个车队看守折返回来寻找遗失的许可。他只有一人，短棍还卡在腰带里；远处林边似乎另有同伙。</p></div></section>
        <div class="wrong-letter-evidence"><span>眼前的机会</span><p>趁他落单先动手，这场战斗不会太难。若故意叫来他的同伙，战利品不会增加，危险却会明显上升。</p></div>`,
      actions: [
        { kind: 'navigation', label: '先退回林边', handler: () => {
          Dialog.close()
          if (GameFlow.retreatToPrevious()) EventBus.emit('ui:log', { text: '🌲 你退回了进入旧桥前的林边。', type: 'dim' })
          else GameFlow.afterEvent()
        } },
        { label: '和落单看守单挑', cls: 'btn-primary', handler: () => startBridgeBattle(false) },
        { label: '“大喊：把你的人都叫来”', cls: 'btn-danger', handler: () => startBridgeBattle(true) },
      ],
    })
  }

  function afterBattle (result) {
    if (result && result.victory && !result.fled && result.enemyId === 'p_bandit_leader' && result.story === 'commission-bandits') {
      const state = State.get()
      state._pBanditVictoryResult = {
        fleeingCrew: Math.max(0, Math.min(2, Number(result.banditFleeingCrew) || 0)),
        clothesTaken: !!result.banditClothesTaken,
        gold: Math.max(0, Number(result.loot && result.loot.gold) || 0),
      }
      state._pBanditAftermath = 'victory-fall'
      EventBus.emit('state:changed', state); State.save()
      showBanditVictoryFall()
      return true
    }
    if (!result || !result.victory || result.fled || result.enemyId !== 'p_caravan_guard') return false
    if (!['commission-guard', 'commission-provoked'].includes(result.story)) return false
    const state = State.get()
    state._pBridgeResult = result.story === 'commission-provoked' ? 'provoked_victory' : 'normal_victory'
    state._wrongCommissionBattle = null
    const clothesPending = (result.caravanClothesTaken || state._pCaravanClothesAwaitingRecovery) && StatusSystem.has('naked')
    grantBridgePermit(clothesPending ? 'clothes' : 'permit')
    if (clothesPending) recoverCaravanClothes()
    else finalBridgeInspection()
    return true
  }

  function resumePending () {
    const state = State.get()
    if (!state) return false
    if (state._pBanditAftermath === 'clothes') {
      recoverBanditClothes()
      return true
    }
    if (state._pBanditAftermath === 'victory-fall') {
      showBanditVictoryFall()
      return true
    }
    if (state._pBanditAftermath === 'victory-mark') {
      showBanditVictoryMark()
      return true
    }
    if (state._pBanditAftermath === 'defeat-toy') {
      continueBanditToySession()
      return true
    }
    if (state._pBanditAftermath === 'defeat-verify' || state._pBanditAftermath === 'defeat-rotate') {
      playBanditToyDefeat((state._pBanditDefeatCount || 0) > 1)
      return true
    }
    if (state._pBanditAftermath === 'defeat-discard') {
      showBanditDiscard((state._pBanditDefeatCount || 0) > 1)
      return true
    }
    if (state._pBanditAftermath === 'witness-trade') {
      fakeWitnessTrade()
      return true
    }
    if (state._pBridgeAftermath === 'punish') {
      const clothesPending = !!(state._pCaravanPunish && state._pCaravanPunish.clothesPending)
      state._pCaravanPunish = null
      state._pBridgeAftermath = clothesPending ? 'clothes' : 'permit'
      State.save()
    }
    if (state._pBridgeAftermath === 'clothes') {
      if (state._pCaravanClothesAwaitingRecovery && StatusSystem.has('naked')) recoverCaravanClothes()
      else {
        state._pBridgeAftermath = 'permit'
        State.save()
        finalBridgeInspection()
      }
      return true
    }
    if (state._pBridgeAftermath === 'permit') {
      finalBridgeInspection()
      return true
    }
    return false
  }

  function recoverBanditClothes () {
    const alreadyDressed = !StatusSystem.has('naked')
    Dialog.show({
      title: '👕 桥洞 · 衣服',
      className: 'commission-bridge-modal caravan-clothes-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">👕</i><div><h3>${State.get()._pBanditClothesLocked ? '你用头目掉下的钥匙打开铁箱，原衣还在里面。' : '头目倒下后，你的衣服就在旁边。'}</h3><p>${alreadyDressed ? '可以换回原衣，也可以保留后来买到的替换装。' : '可以穿上，也可以继续光着去救人。'}</p></div></section>`,
      actions: [
        { label: alreadyDressed ? '换回原衣' : '穿上', cls: 'btn-primary', handler: () => finishBanditClothes(true, alreadyDressed) },
        { label: alreadyDressed ? '保留替换装' : '先不穿', handler: () => finishBanditClothes(false, alreadyDressed) },
      ],
    })
  }

  function finishBanditClothes (wear, alreadyDressed = false) {
    const state = State.get()
    if (wear && StatusSystem.has('naked')) StatusSystem.remove('naked')
    state._pBanditClothesLocked = false
    const text = wear
      ? (alreadyDressed ? '👕 你收起替换装，换回了自己的原衣。' : '👕 你把衣服穿上了。')
      : (alreadyDressed ? '👕 你保留身上的替换装，把原衣留在箱边。' : '👙 你决定先不穿。')
    EventBus.emit('ui:log', { text, type: wear ? 'good' : 'warning' })
    EventBus.emit('state:changed', state); State.save(); Dialog.close()
    if ((state._pBanditDefeatCount || 0) > 0) showBanditVictoryMark()
    else finishBanditVictory()
  }

  function setCaravanEscortStage (stage) {
    const state = State.get()
    state._pCaravanEscortStage = Math.max(0, Math.min(4, Math.floor(Number(stage) || 0)))
    EventBus.emit('state:changed', state)
    State.save()
  }

  function nextCaravanEscortStage (stage) {
    closeCaravanDefeatScene()
    setCaravanEscortStage(stage)
    resumeCaravanEscort()
  }

  /** 四重束缚专属押送：四幕都写入存档，刷新不会跳过。 */
  function resumeCaravanEscort () {
    const state = State.get()
    const stage = Math.max(0, Math.min(4, Math.floor(Number(state._pCaravanEscortStage) || 0)))
    const result = state._pCaravanEscortResult || { goldLost: 0, provoked: false, bindings: 4, naked: StatusSystem.has('naked') }
    if (!stage) return false

    if (stage === 1 && !result.punished) {
      CaravanGuardBehavior.runDefeatPunishment(!!result.provoked, () => {
        const latest = State.get()
        latest._pCaravanEscortResult = { ...(latest._pCaravanEscortResult || result), punished: true, punishmentStep: 2 }
        EventBus.emit('state:changed', latest)
        State.save()
        resumeCaravanEscort()
      }, {
        startStep: result.punishmentStep,
        onStep: step => {
          const latest = State.get()
          latest._pCaravanEscortResult = { ...(latest._pCaravanEscortResult || result), punishmentStep: step }
          EventBus.emit('state:changed', latest)
          State.save()
        },
      })
      return true
    }

    if (stage === 1) {
      showCaravanDefeatScene({
        title: '⛓️ 旧桥 · 封箱',
        className: 'commission-bridge-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🔒</i><div><h3>第四道锁自动锁紧，看守就没有再继续攻击。</h3><p>看守抓住奴隶项圈，先检查手铐、球形口塞和小肛塞的锁之后，他发现你已经无力反抗了。他把你打包成了一件货物装上了车。</p></div></section>
          <div class="wrong-letter-evidence is-found"><span>入库记录</span><p>束缚 ${result.bindings || 4}/4 · 搜走 ${result.goldLost || 0}G${state._pCaravanDebt ? ` · 车队欠条 ${state._pCaravanDebt}G` : ''}。锁具在押送结束前不会打开。</p></div>
          <p class="wrong-letter-after">看守把一块写着临时编号的木牌挂在项圈上，叫人把你抬向停在桥上的货车。</p>`,
        actions: [{ label: '被抬上货车', cls: 'btn-danger', handler: () => nextCaravanEscortStage(2) }],
      })
      return true
    }

    if (stage === 2) {
      showCaravanDefeatScene({
        title: '🛶 返城货车 · 途中',
        className: 'commission-bridge-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🌫️</i><div><h3>货车钻进林雾，车轮每撞上一块石头。</h3><p>${result.naked ? '你看到你的衣物被他放到车顶的麻袋里了。' : '还有你的道具和武器也在麻袋里'}每次你试着挪动手腕，押车人就刀柄在车板上敲一下，别给我打歪脑筋，你再乱动就把你手脚切掉，做出真正的飞机杯送到镇上。</p></div></section>
          <div class="wrong-letter-evidence"><span>押运状态</span><p>项圈卡在了笼子里，手铐将双手铐在背后，口塞让你说不了，你只好无助的蜷缩在了笼子里。</p></div>
          <p class="wrong-letter-after">车速慢下来时，前方已经能看到雾灯镇的城门火把。</p>`,
        actions: [{ label: '听着车轮驶向城门', cls: 'btn-danger', handler: () => nextCaravanEscortStage(3) }],
      })
      return true
    }

    if (stage === 3 && !result.gateUsed) {
      showCaravanDefeatScene({
        title: '⚖️ 雾灯镇城门 · 非法野外卖淫罪',
        className: 'commission-bridge-modal p-gate-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><p>看守把装着你的笼子放到了登记桌边上，当着镇民给你顶了罪。</p></div></section>
          <section class="p-hall-order"><span>车队看守</span><blockquote>“这货在路上说500一次，不是卖淫是什么？非法卖淫，人赃并获。替天行道，等我们惩罚过后自会交给城镇的守卫。”</blockquote></section>
          <div class="wrong-letter-evidence is-found"><span>罪名</span><p>野外非法卖淫</p></div>`,
        actions: [{ label: '被搬到了贝拉米与墨菲面前', cls: 'btn-danger', handler: () => {
          closeCaravanDefeatScene()
          useByGateOfficers(() => {
            const latest = State.get()
            latest._pCaravanEscortResult = { ...(latest._pCaravanEscortResult || result), gateUsed: true }
            latest._pCaravanEscortStage = 4
            EventBus.emit('state:changed', latest)
            State.save()
            resumeCaravanEscort()
          })
        } }],
      })
      return true
    }

    if (stage === 3) {
      nextCaravanEscortStage(4)
      return true
    }

    showCaravanDefeatScene({
      title: '🛡️ 城门守卫 · 卖淫收押',
      className: 'commission-bridge-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🛡️</i><div><p>贝拉米把你的牵引绳交给了守卫，墨菲则把刚刚给你编的一页罪名一起交给了守卫。</p></div></section>
        <section class="p-hall-order"><span>城门守卫</span><blockquote>“野外非法卖淫，按无证卖淫收监，好了跟我去监狱吧。”</blockquote></section>`,
      actions: [{ label: '被押进雾灯镇监狱', cls: 'btn-danger', handler: () => {
        closeCaravanDefeatScene()
        state._pCaravanEscortStage = 0
        state._pCaravanEscortResult = null
        state._pFourfoldEscortCompleted = true
        EventBus.emit('ui:log', { text: '⛓️ 守卫以野外非法卖淫罪把你收监。服刑期满后，仍要回旧桥寻找名单。', type: 'danger' })
        EventBus.emit('state:changed', state)
        State.save()
        if (window.TownPrisonSystem) {
          TownPrisonSystem.enter({
            charge: '野外非法卖淫',
            caravanBindings: Array.isArray(state._pDefeatCaravanBindings) ? state._pDefeatCaravanBindings : [],
          })
        }
        else GameFlow.openCamp()
      } }],
    })
    return true
  }

  /** 四重束缚押到城门后，贝拉米与墨菲先按卖淫罪使用，再交给守卫。手铐不解开。 */
  async function useByGateOfficers (done) {
    const state = State.get()
    const male = state.gender === 'male'
    const oral = banditOrifice('oral')
    const hole = banditOrifice('vagina')
    const anal = banditOrifice('anal')
    const escortResult = state._pCaravanEscortResult || {}
    let officerStep = Math.max(0, Math.floor(Number(escortResult.officerStep) || 0))
    if (typeof escortResult.roadTrial !== 'boolean') escortResult.roadTrial = Math.random() < 0.5
    state._pCaravanEscortResult = escortResult
    EventBus.emit('state:changed', state)
    State.save()

    const saveOfficerStep = step => {
      const latest = State.get()
      latest._pCaravanEscortResult = { ...(latest._pCaravanEscortResult || {}), officerStep: step, roadTrial: escortResult.roadTrial }
      officerStep = step
      EventBus.emit('state:changed', latest)
      State.save()
    }

    await runBanditTask('墨菲', '验货', '', {
      startSegment: Math.max(0, officerStep),
      onSegment: step => saveOfficerStep(step),
      segments: [
        { name: '摘下口塞', desc: `墨菲扯开口塞，笔还夹在耳后。他捏着下巴，把${oral}掰开检查。张开嘴穴给他检查。`, seconds: 5 },
        { name: '口交调教', desc: '墨菲将鸡巴插入你的嘴穴，按 110 BPM 速度进行抽插，不能用手扶。', bpm: 110, seconds: 20 },
        { name: '深喉调教', desc: '墨菲最后把鸡巴插进你的喉穴最深处，保持 10 秒。', seconds: 10 },
      ],
    })
    await runBanditTask('贝拉米', '登记桌', '', {
      startSegment: Math.max(0, officerStep - 3),
      onSegment: step => saveOfficerStep(3 + step),
      segments: [
        { name: '准备姿势', desc: `接下来贝拉米把你按在了登记桌上，他抽出了你菊穴里的肛塞。胸口贴紧桌面，手仍铐在背后，双腿分开，他掰开了你的${anal}。`, seconds: 5 },
        { name: '菊穴调教', desc: `他以 90 BPM的速度抽插着你的菊穴。腿不许并。`, bpm: 90, seconds: 30 },
        { name: '精液便器', desc: '他加快到 120 BPM，继续抽插你的菊穴，最后在里面射入 10 ml（可以用假精液替代）。如果你躲开或夹紧，都会被记成抗拒执法。', bpm: 120, seconds: 20 },
      ],
    })
    if (escortResult.roadTrial) {
      EventBus.emit('ui:log', { text: '👁️ 贝拉米朝排队的人招了招手，叫了一个路人过来。', type: 'danger' })
      await runBanditTask('贝拉米与路人', '当众试用', '', {
        startSegment: Math.max(0, officerStep - 6),
        onSegment: step => saveOfficerStep(6 + step),
        segments: [
          { name: '前后就位', desc: `路人站到登记桌前，把鸡巴送进你的嘴穴。贝拉米留在身后，对准你的${male ? anal : hole}。手仍铐在背后，不能挡开任何一边。`, seconds: 5 },
          { name: '当众试用', desc: `嘴里按拍含住路人，同时用${male ? anal : hole}迎合贝拉米。前后两边都按 90 BPM 继续。`, bpm: 90, seconds: 30 },
          { name: '等待收押', desc: '路人被打发走后，你仍趴在登记桌上，保持着这个姿势等守卫来收押。', seconds: 5 },
        ],
      })
    }
    if (done) done()
  }

  /** 普通战败判决后解除车队临时锁；战前已有装备则恢复原状。 */
  function releaseDefeatCaravanBindings () {
    if (typeof RestraintSystem === 'undefined') return
    const state = State.get()
    const records = Array.isArray(state._pDefeatCaravanBindings) ? state._pDefeatCaravanBindings : []
    if (records.length) {
      records.forEach(binding => {
        if (!binding || !binding.slot) return
        if (binding.borrowed && binding.original) RestraintSystem.restore(binding.slot, { ...binding.original })
        else {
          const current = RestraintSystem.get(binding.slot)
          if (current && current.source === 'p_caravan_guard') RestraintSystem.restore(binding.slot, null)
        }
      })
    } else {
      // 兼容修复前已经走到判决页的存档：只清除车队来源的临时装备。
      ;(RestraintSystem.SLOT_ORDER || []).forEach(slot => {
        const current = RestraintSystem.get(slot)
        if (current && current.source === 'p_caravan_guard') RestraintSystem.restore(slot, null)
      })
    }
    state._pDefeatCaravanBindings = null
    EventBus.emit('ui:log', { text: '🔓 守卫解除车队临时的束缚，确认你可以在厕所完成还债。', type: 'dim' })
  }

  /** 普通生命归零后的城门交接；独立存档，避免刷新后凭空跳到营地。 */
  function resumeDefeatDispatch () {
    const state = State.get()
    if (!state._pDefeatDispatchPending) return false
    const result = ['normal_captured', 'provoked_captured'].includes(state._pBridgeResult)
      ? state._pBridgeResult
      : (state._wrongCommissionCaptured ? 'normal_captured' : 'normal_victory')
    const provoked = result === 'provoked_captured'
    if (!state._pDefeatPunished) {
      CaravanGuardBehavior.runDefeatPunishment(provoked, () => {
        const latest = State.get()
        latest._pDefeatPunished = true
        latest._pDefeatPunishmentStep = 2
        EventBus.emit('state:changed', latest)
        State.save()
        resumeDefeatDispatch()
      }, {
        startStep: state._pDefeatPunishmentStep,
        onStep: step => {
          const latest = State.get()
          latest._pDefeatPunishmentStep = step
          EventBus.emit('state:changed', latest)
          State.save()
        },
      })
      return true
    }
    if (!state._pDefeatSentenced) {
      showCaravanDefeatScene({
        title: '🛞 雾灯镇城门 · 全裸押到',
        className: 'commission-bridge-modal p-gate-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">👙</i><div><p>看守牵着全裸的你，越过排队的人，直接走到守卫面前。他把绳头塞进守卫手里。</p></div></section>
          <section class="p-hall-order"><span>车队看守</span><blockquote>${provoked ? '“这个在桥上把人都叫出来，输了就把衣服脱光求饶，还欠着钱。拿身体抵债，没登记。”' : '“拦车的时候衣服自己就没了，站在路中间，像是要拿身体换路。”'}“当众发情。我的部分到此为止，罪你们定。”</blockquote></section>
          <div class="wrong-letter-evidence"><span>看守报上的罪名</span><p>当众发情。全裸为证。</p></div>`,
        actions: [{ label: '绳子交到守卫手里', cls: 'btn-danger', handler: () => {
          closeCaravanDefeatScene()
          runBanditTask('城门守卫', '当众发情 · 报罪', '守卫把你按得跪在告示柱下。“罪名是当众发情。你这么喜欢发情，那就当众自慰直到高潮吧！在大家面前展示你这头喜欢发情的贱母猪是如何高潮吧。”', { taskCount: 10, taskTool: '当众自慰直到高潮' }).then(() => {
            const latest = State.get()
            latest._pDefeatSentenced = true
            EventBus.emit('state:changed', latest)
            State.save()
            resumeDefeatDispatch()
          })
        } }],
      })
      return true
    }
    showCaravanDefeatScene({
      title: '🛡️ 城门守卫 · 当众发情',
      className: 'commission-bridge-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🛡️</i><div><p>守卫在宣判「当众发情」的罪名后，把你往城镇公共厕所的方向拉去。</p></div></section>
        <section class="p-hall-order"><span>城门守卫</span><blockquote>“发情而已不是什么大事，罚款一百金币，罚金只能去公共厕所赚回来，赚够之前禁止出城。”</blockquote></section>`,
      actions: [{ label: '被押去公共厕所还债', cls: 'btn-danger', handler: () => {
        releaseDefeatCaravanBindings()
        state._pDefeatDispatchPending = false
        TownGlorySystem.addDebt({ amount: 100, source: 'prologue', reason: '当众发情罚款', includeEntryFee: true })
        EventBus.emit('state:changed', state)
        State.save()
        closeCaravanDefeatScene()
        GameFlow.openCamp()
      } }],
    })
    return true
  }

  function resumeCampStory () {
    if (resumeCaravanEscort()) return true
    return resumeDefeatDispatch()
  }

  async function collectBanditBridgeToll () {
    const state = State.get()
    if (!state._pBanditBridgeToll) { GameFlow.afterEvent(); return }
    const debt = Math.max(0, Number(state._pBanditRansomDebt) || 0)
    const actions = []
    if (debt > 0 && state.gold >= debt) {
      actions.push({ label: `付清 ${debt}G`, cls: 'btn-primary', handler: () => settleBanditRansomDebt(debt) })
    }
    actions.push({ label: '交过路费', cls: 'btn-danger', handler: async () => {
      Dialog.close()
      await runBanditTask('☠️ 劫货强盗头目', '欠债口交', `先把${banditOrifice('oral')}送上去。`, { bpm: 110, seconds: 30 })
      await runBanditTask('☠️ 劫货强盗头目', '欠债深喉', '按住后脑做深喉，停在最深处。', { bpm: 90, seconds: 30 })
      await runBanditTask('☠️ 劫货强盗头目', '欠债肛交', `再把${banditOrifice('anal')}交给他。`, { bpm: 140, seconds: 30 })
      await runBanditTask('☠️ 劫货强盗头目', '欠债性交', `最后操进${banditOrifice('vagina')}。债还没清，下次过桥还要再交。`, { bpm: 130, seconds: 30 })
      EventBus.emit('ui:log', { text: `🧾 过桥路费交完。${debt}G 的欠条还在。`, type: 'danger' })
      GameFlow.afterEvent()
    } })
    Dialog.show({
      title: '🌉 旧桥 · 欠债路费',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🧾</i><div><h3>头目的人还守在断桥边。</h3><p>欠款还剩 <b>${debt}G</b>。你可以付清欠款；钱不够时，只能按约定交过路费。</p></div></section>`,
      actions,
    })
  }

  function settleBanditRansomDebt (amount) {
    const state = State.get()
    const debt = Math.max(0, Number(state._pBanditRansomDebt) || 0)
    const payment = Math.min(debt, Math.max(0, Number(amount) || 0))
    if (!payment || state.gold < payment) return
    state.gold -= payment
    state._pBanditRansomDebt = Math.max(0, debt - payment)
    state._pBanditBridgeToll = state._pBanditRansomDebt > 0
    EventBus.emit('ui:log', { text: `💰 你付清了 ${payment}G，桥洞欠条被销毁。`, type: 'good' })
    EventBus.emit('state:changed', state); State.save(); Dialog.close()
    GameFlow.afterEvent()
  }

  function afterDefeat (result) {
    if (result && result.storyDefeat && result.enemyId === 'p_bandit_leader' && result.story === 'commission-bandits') {
      const state = State.get()
      const taken = state.gold
      state.gold = 0
      state._wrongCommissionStage = 6
      state._pBanditDefeatCount = (state._pBanditDefeatCount || 0) + 1
      state._pBanditDefeatResult = {
        goldLost: taken,
        livingCrew: Math.max(0, Math.min(2, Number(result.banditLivingCrew) || 0)),
        livingCrewIds: Array.isArray(result.banditLivingCrewIds)
          ? result.banditLivingCrewIds.filter(id => ['bandit-lookout', 'bandit-cutpurse'].includes(id))
          : [],
      }
      lockBanditClothes()
      state._pBanditAftermath = 'defeat-toy'
      state._pBanditDefeatScene = 0
      EventBus.emit('state:changed', state)
      State.save()
      playBanditToyDefeat(state._pBanditDefeatCount > 1)
      return true
    }
    if (!result || !result.storyDefeat || result.enemyId !== 'p_caravan_guard') return false
    const state = State.get()
    resetPostPrologueState(state)
    state._wrongCommissionStage = 5
    state._wrongCommissionBattle = null
    state._wrongCommissionCaptured = true
    state._pBridgeResult = result.provoked ? 'provoked_captured' : 'normal_captured'
    state._pBridgePermitAcquired = false
    state._pBridgeAftermath = null
    state._pCaravanClothesAwaitingRecovery = false
    // 四重俘获后监狱仍需这份记录来收走车队锁具，并在释放时归还战前原装备。
    state._pDefeatCaravanBindings = Array.isArray(result.caravanBindingRecords)
      ? result.caravanBindingRecords
      : []
    if (result.caravanFourfoldCapture) {
      state._pCaravanEscortStage = 1
      state._pCaravanEscortResult = {
        goldLost: Math.max(0, Number(result.goldLost) || 0),
        provoked: !!result.provoked,
        bindings: Math.max(0, Math.min(4, Number(result.caravanBindings) || 4)),
        naked: StatusSystem.has('naked'),
      }
    }
    EventBus.emit('state:changed', state)
    State.save()
    if (result.caravanFourfoldCapture) return resumeCaravanEscort()
    state._pDefeatDispatchPending = true
    EventBus.emit('state:changed', state)
    State.save()
    return resumeDefeatDispatch()
  }

  function visitBridge () {
    const state = State.get()
    const stage = state._wrongCommissionStage || 0

    if (stage === 2) {
      firstBridgeInspection()
      return
    }
    if (stage === 4) {
      bridgeGuardEncounter()
      return
    }
    if (stage === 5) {
      inspectCaravanWreck()
      return
    }
    if (stage === 6) {
      enterBanditHideout()
      return
    }
    if (state._pBanditBridgeToll && stage >= 7) {
      collectBanditBridgeToll()
      return
    }

    if (stage < 2) {
      EventBus.emit('ui:log', { text: '🌉 雾从旧桥的断栏间穿过。桥板上有新车辙，但你暂时不知道它们属于谁。', type: 'dim' })
    } else if (stage === 3) {
      EventBus.emit('ui:log', { text: '🌉 车辙仍通向雾灯镇。先去酒馆与铁匠铺确认两批货物的去向。', type: 'dim' })
    } else {
      EventBus.emit('ui:log', { text: '🌉 旧桥下只剩被雨水冲淡的车辙；桥洞里的营火已经熄灭。', type: 'dim' })
    }
    GameFlow.afterEvent()
  }

  function visitBanditCamp () {
    const state = State.get()
    const stage = state._wrongCommissionStage || 0
    if (stage < 5) {
      Dialog.show({
        title: '🔥 旧桥下 · 封死的营地',
        className: 'commission-bridge-modal',
        body: '<section class="scene-dialogue"><i aria-hidden="true">🔥</i><div><h3>桥墩下有一条被碎木和湿泥遮住的斜坡。</h3><p>下面隐约有旧营火的气味，但入口还被倒塌的货箱封着。没有车队留下的痕迹，现在贸然下去只会在暗沟里绕圈。</p></div></section>',
        actions: [{ kind: 'navigation', label: '返回旧桥', handler: () => { Dialog.close(); GameFlow.afterEvent() } }],
      })
      return
    }
    if (stage === 5) {
      inspectCaravanWreck()
      return
    }
    if (stage === 6) {
      enterBanditHideout()
      return
    }
    if (state._pBanditBridgeToll) {
      collectBanditBridgeToll()
      return
    }
    EventBus.emit('ui:log', { text: '🔥 强盗营地只剩熄灭的火堆、空货箱和被雨水冲淡的脚印。', type: 'dim' })
    GameFlow.afterEvent()
  }

  function letterAfterText (state = State.get()) {
    return PROLOGUE_CONTENT.letterAfterText(state)
  }

  return { visitBridge, visitBanditCamp, inspectCaravanWreck, enterBanditHideout, afterBattle, afterDefeat, resumeCaravanEscort, resumeDefeatDispatch, resumeCampStory, resumePending, letterAfterText }
})()
