/**
 * systems/commission.js — “欲缚镇 · 序章”野外事件。
 *
 * 任务顺序：收到错信 → 旧桥核对车辙 → 调查酒馆与铁匠
 * → 返回旧桥寻找遗失许可 → 搜查桥下车队残骸 → 桥洞据点救出证人
 * → 镇内复查与镇长复命 → 城门见证新法生效。
 */
window.CommissionSystem = (function () {
  function saveProgress (stage, log) {
    const state = State.get()
    state._wrongCommissionStage = Math.max(state._wrongCommissionStage || 0, stage)
    if (log) EventBus.emit('ui:log', { text: log, type: 'warning' })
    EventBus.emit('state:changed', state)
    State.save()
  }

  function firstBridgeInspection () {
    saveProgress(3, '🌉 旧桥上的车辙证实，派克的货物已经分批送进雾灯镇。')
    Dialog.show({
      title: '🌉 旧桥 · 车辙',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🛞</i><div><h3>桥板上留着两道很深的新车辙。</h3><p>一辆重车不久前在这里停过。断裂的捆绳旁散着酒馆用的麦秸，铁屑里还混着几枚刚锉过的锁环。</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>货单得到印证</span><p>货物确实从旧桥进入雾灯镇，并在过桥后拆成两批：一批去了酒馆方向，另一批留下了铁匠铺的炉渣。</p></div>`,
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
    if (!state._pBridgePermitAcquired) grantBridgePermit('permit')
    Dialog.show({
      title: '🌉 旧桥 · 遗失的许可',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📜</i><div><h3>桥墩缝里卡着一只泡湿的皮卷。</h3><p>这是车夫丢失的运输许可。酒馆与铁匠都列在收货人一栏，最下方却盖着雾灯镇的正式印章——这批货不是偷运进来的。</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>许可背面</span><p>“货到后启用新规。城门监督官负责接管。——派克”</p></div>
        <p class="wrong-letter-after">桥栏外侧沾着尚未干透的血迹。一截蓝布挂在桥墩下，凌乱的车轮印沿着斜坡滑进断桥阴影。</p>`,
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
    if ((state._wrongCommissionStage || 0) !== 5) { GameFlow.openCamp(); return }
    state._pCaravanTrailSeen = true
    saveProgress(6, '🛞 你在旧桥下找到被洗劫的车队残骸，拖拽痕迹一直延伸进封死的桥洞。')
    Dialog.show({
      title: '🛞 旧桥下 · 失事车队',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🛞</i><div><h3>翻倒的货车卡在桥墩与浅滩之间，车夫与两名护卫已经没了呼吸。</h3><p>箱子被撬开，约束器具却几乎没有被拿走。强盗真正寻找的是随车名单，以及一个知道收货人身份的活口。</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>桥洞里的痕迹</span><p>拖拽脚印和断裂的蓝布条钻进旧桥封死的泄洪洞。石缝深处透着营火，有人被活着带进去了。</p></div>
        <p class="wrong-letter-after">这不再只是送错的货单。只要证人还活着，就有人能说明派克的车队究竟替谁办事。</p>`,
      actions: [{ label: '靠近桥洞里的营火', cls: 'btn-primary', handler: () => { Dialog.close(); enterBanditHideout() } }],
    })
  }

  function startBanditBattle (returning = false) {
    const state = State.get()
    if ((state._wrongCommissionStage || 0) !== 6) { GameFlow.openCamp(); return }
    Dialog.close()
    EventBus.emit('ui:log', {
      text: returning
        ? '⚔️ “这不是上次那只肉便器吗？！”哨探从旧位置扑来，这一次没人再替头目挡刀。'
        : '⚔️ 你踏进桥洞。哨探已经从斜坡阴影里摸到你背后。',
      type: 'danger',
    })
    State.save()
    GameFlow.startBattle('p_bandit_leader', { story: 'commission-bandits', noElite: true, banditNoCover: returning })
  }

  async function runBanditTask (enemyName, attackName, desc, options = {}) {
    if (typeof BattleUI === 'undefined' || !BattleUI.showTaskDialog) return false
    return BattleUI.showTaskDialog({
      enemyName, attackName, desc,
      bpm: options.bpm || 0,
      seconds: options.seconds || 0,
      taskCount: options.taskCount || 0,
      taskTool: options.taskTool || '',
      taskSteps: options.taskSteps || [],
      dmg: 0, noDamage: true,
      allowSkip: false,
      completeLabel: options.completeLabel || '完成这一段',
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
    const male = State.get().gender === 'male'
    if (kind === 'anal') return '菊穴'
    if (kind === 'vagina') return male ? '菊穴' : '小穴'
    if (kind === 'oral') return '嘴穴'
    return '身体'
  }

  function banditUseEntry (pick) {
    return {
      actor: pick.actor,
      name: pick.name,
      desc: pick.desc,
      bpm: pick.bpm || 0,
      seconds: pick.seconds || 0,
      taskCount: pick.count || 0,
      taskTool: pick.tool || '',
    }
  }

  function pickBanditToyUses (days) {
    const male = State.get().gender === 'male'
    const hole = banditOrifice('vagina')
    const anal = banditOrifice('anal')
    const oral = banditOrifice('oral')
    const frontalUse = male
      ? { name: '撸管寸止', actor: '🗡️ 翻箱扒手', bpm: 100, seconds: 40, desc: '扒手把你翻过来，攥住阴茎反复套弄，每次快要射出时就突然停手。“没有小穴也一样能验货。没有我的命令，不准射。”' }
      : { name: '正穴灌精', actor: '🗡️ 翻箱扒手', bpm: 130, seconds: 40, desc: `扒手把你翻过来，对准${hole}整根没入。“名单不在这口穴里？那就把精液先灌进去。”` }
    const penetration = [
      { name: '后入飞机杯', actor: '☠️ 劫货强盗头目', bpm: 140, seconds: 40, desc: `头目把你按在货箱上当飞机杯用，从身后整根操进${anal}，每一下都顶到最深。“送上门的洞，当然要灌满。”` },
      { name: '操嘴泄火', actor: '🗡️ 桥洞哨探', bpm: 110, seconds: 35, desc: `哨探揪着头发把鸡巴塞进${oral}，按节拍抽插，唾液顺着下巴往下滴。` },
      frontalUse,
      { name: '深喉停住', actor: '☠️ 劫货强盗头目', bpm: 90, seconds: 35, desc: `头目按住后脑做深喉，每八拍停在最深处逼你憋气。“飞机杯不会喘气，只会吞。”` },
    ]
    const punishment = [
      { name: '拱穴展示', actor: '🗡️ 桥洞哨探', bpm: 60, seconds: 30, desc: '哨探命你双手抱头、双腿打开，按拍子反复下蹲并向后拱起臀部，让营火边所有人看清被操开的穴口。' },
      { name: '打飞机杯屁股', actor: '☠️ 劫货强盗头目', count: 20, tool: '手掌或皮带', desc: '头目把你按过膝弯，连续抽打臀部并逼你报数。“烂飞机杯也要会报数。”' },
      { name: '扇巴掌', actor: '🗡️ 桥洞哨探', count: 12, tool: '手掌', desc: '哨探左右开弓扇脸，每一下都要你把嘴张开给下一个人用。' },
      { name: '拧乳泄愤', actor: '🗡️ 翻箱扒手', count: 16, tool: '双手', desc: '扒手左右交替拧乳头并逼你报数。乳尖被拧得又红又肿，他还故意往上面抹精液。' },
    ]
    const uses = []
    for (let day = 0; day < days; day++) {
      uses.push(banditUseEntry(penetration[Math.floor(Math.random() * penetration.length)]))
      uses.push(banditUseEntry(punishment[Math.floor(Math.random() * punishment.length)]))
    }
    return uses
  }

  function ensureBanditToySession (repeat) {
    const state = State.get()
    if (state._pBanditToySession && Array.isArray(state._pBanditToySession.uses) && state._pBanditToySession.uses.length) return state._pBanditToySession
    const days = 2 + Math.floor(Math.random() * 2)
    const session = { days, uses: pickBanditToyUses(days), index: 0, repeat: !!repeat }
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
      body: `<section class="scene-dialogue"><i aria-hidden="true">🍑</i><div><h3>${repeat ? '“被灌满扔出去的飞机杯，自己又爬回来了。”' : '“名单不在这头货身上。那就先当几天飞机杯。”'}</h3><p>头目把你按上货箱。他们把你留在桥洞里 <b>${session.days}</b> 天。每一天只有两段：先使用一次，再责打或展示一次。身上会被写满淫话，用完才把你扔回断桥。</p></div></section>`,
      actions: [{ label: '被留下当飞机杯', cls: 'btn-danger', handler: () => { Dialog.close(); continueBanditToySession() } }],
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
          body: `<section class="scene-dialogue"><i aria-hidden="true">🔥</i><div><h3>营火重新点起来。这是第 ${day} 天，一共 ${session.days} 天。</h3><p>今天仍是两段：先使用一次，再责打或展示一次。</p></div></section>`,
          actions: [{ label: '继续这一天', cls: 'btn-danger', handler: () => { Dialog.close(); resolve() } }],
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
      ? `${use.name}（第${day}天 · ${index % 2 === 0 ? '使用' : '责打'}）`
      : `${use.name}（${index + 1}/${current.uses.length}）`
    await runBanditTask(use.actor, label, use.desc, {
      bpm: use.bpm, seconds: use.seconds, taskCount: use.taskCount, taskTool: use.taskTool,
      completeLabel: last ? '被用完' : endOfDay ? '这一天结束' : '下一段',
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
      title: '🩸 断桥 · 扔出去的飞机杯',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🩸</i><div><h3>“${repeat ? '免费精液飞机杯用完了。照旧扔到断桥上去。' : '问过了。烂飞机杯扔出去，活口比她值钱。'}”</h3><p>他们把灌满精液和尿的你拖到断桥边踹下去。没有衣服。身上写满淫话，穴口还在往外淌。${lost ? `身上仅剩的 ${lost}G 也被头目搜走。` : '钱袋早就空了。'}蕾娜仍被锁在木栅后。</p></div></section>
        <div class="wrong-letter-evidence"><span>断桥</span><p>你可以先回镇，也可以马上再进洞。他们没有把衣服扔给你。</p></div>`,
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
      ['☠️ 劫货强盗头目', '嘴穴第一轮', `你爬上货箱求换人。头目笑着把鸡巴塞进${oral}：“想免费换人？先把这张嘴献出来。”`, { bpm: 120, seconds: 35 }],
      ['☠️ 劫货强盗头目', '菊穴第一轮', `第一轮还没结束，他就把你翻过去，整根操进${anal}。`, { bpm: 140, seconds: 35 }],
      ['☠️ 劫货强盗头目', '嘴穴第二轮', '第二轮从嘴开始。精液还没咽下去，下一根又顶进来。', { bpm: 130, seconds: 30 }],
      ['☠️ 劫货强盗头目', '菊穴第二轮', `他拍着被操开的${anal}：“这才第二轮。”`, { bpm: 150, seconds: 30 }],
      ['☠️ 劫货强盗头目', '嘴穴第三轮', '第三轮深喉停在最深处。哨探和扒手在旁边笑。', { bpm: 100, seconds: 30 }],
      ['☠️ 劫货强盗头目', '菊穴第三轮', '三轮结束。头目射在最深处，把你像用完的套一样拽起来。', { bpm: 150, seconds: 30 }],
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
    EventBus.emit('ui:log', { text: '🩸 三轮用完，他们把你笑着扔回断桥。蕾娜仍锁在木栅后。', type: 'danger' })
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
        title: '🌉 旧桥下 · 熟客',
        className: 'commission-bridge-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🔥</i><div><h3>头目一眼认出你身上的淫话和还没干的精斑，笑声从货箱传到木栅。</h3><p>“这不是上次那只肉便器吗？！名单还在。你是来挨打，还是又送上门来给操？”蕾娜隔着木栅看着你，没有出声。</p></div></section>
          <p class="wrong-letter-after">当场付 600G 可带走人质；付不起就欠 1200G，以后每次路过旧桥都要给头目口交、深喉、肛交和性交各一次。想免费换人，他们只会再操你三轮再把你扔出去。</p>`,
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
      body: `<section class="scene-dialogue"><i aria-hidden="true">🔥</i><div><h3>斜坡上先有人影动了一下。哨探没有喊，只把一只手按在刀柄上，打量你有没有把名单带回来。</h3><p>桥洞被木板和旧货箱隔成营地。被俘的女人锁在最深处的桥墩旁，穿着车队记账员的蓝色外套，手里还攥着半张撕破的收货名单。扒手蹲在营火边翻她的口袋；头目把木盾搁在膝上：“车队漏网的，还是镇里派来灭口的？先问清楚。”</p></div></section>
        <div class="wrong-letter-evidence"><span>据点情况</span><p>哨探会先从阴影里按住你。正面还有扒手与头目。撤退不会推进任务；击倒头目，喽啰才会丢下账册逃走。</p></div>`,
      actions: [
        { kind: 'navigation', label: '先退回桥面准备', handler: () => { Dialog.close(); GameFlow.afterEvent() } },
        { label: '冲进据点救人', cls: 'btn-danger', handler: startBanditBattle },
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
      body: `<section class="scene-dialogue"><i aria-hidden="true">☠️</i><div><h3>头目倒下了。木盾砸进灰堆，桥洞里只剩营火和木栅后的锁链声。</h3><p>${result.fleeingCrew > 0 ? `剩余 ${result.fleeingCrew} 名喽啰抢着钻出桥洞。` : '哨探和扒手也已经倒下。'}你从他们身上搜出 ${result.gold || 0}G，以及能证明这批货通往镇务厅的账页。</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>战利品</span><p>头目已死。先处理衣服，再去救木栅后的证人。</p></div>`,
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
      body: '<section class="scene-dialogue"><i aria-hidden="true">🩸</i><div><h3>头目死了，身上被写成飞机杯的字还在。</h3><p>浅滩的水能把它们擦掉。</p></div></section>',
      actions: [
        { label: '擦掉', cls: 'btn-primary', handler: () => settleBanditMark('scrubbed') },
        { label: '先不擦', handler: () => settleBanditMark('kept') },
      ],
    })
  }

  function settleBanditMark (choice) {
    const state = State.get()
    state._pBanditMarkChoice = choice
    EventBus.emit('ui:log', { text: choice === 'scrubbed' ? '💧 你把身上的淫话擦掉了。' : '🩸 那些字还留在皮肤上。', type: choice === 'scrubbed' ? 'good' : 'warning' })
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
      ? '蕾娜看见你从浅滩回来，也看见头目已经死了。“他们把你扔出去，你却擦掉那些字，又回来把锁打开了。”她把半张名单递给你。'
      : '蕾娜看见那些还留在身上的字，也看见头目已经死了。“他们把你当飞机杯扔出去，你却回来把锁打开了。”她把半张名单递给你。'
    state._wrongCommissionStage = 7
    state._wrongCommissionOutcome = 'permit'
    EventBus.emit('ui:log', { text: '🕯️ 你救出了车队记账员。她愿意带着名单去镇务厅作证。', type: 'good' })
    EventBus.emit('state:changed', state)
    State.save()
    Dialog.show({
      title: '🕯️ 旧桥下 · 活着的证人',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🕯️</i><div><h3>${method === 'bought' ? '头目收了钱，把木栅打开，把蕾娜推到你脚边。' : '你劈开木栅上的锁，女人却先扑向即将烧尽的文件。'}</h3><p>${method === 'bought' ? '“你买的是我的命，不是我的感谢。”蕾娜把半张名单藏进外套，催你立刻离开桥洞。' : method === 'revenge' ? revengeLine : '她叫蕾娜，是车队的记账员。派克的货只是诱饵；真正重要的是镇务厅签署的合作名单。'}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>半张收货名单</span><p>酒馆、铁匠铺、城门卫队都在名单上。最后一栏的签署人属于镇务厅。</p></div>
        <p class="wrong-letter-after">${method === 'bought' ? '蕾娜记得自己是被钱换出来的。' : '头目已经死了。'}她要你先护送她回雾灯镇。</p>`,
      actions: [{ label: '护送蕾娜返回镇务厅', cls: 'btn-primary', handler: () => { Dialog.close(); GameFlow.openCamp() } }],
    })
  }

  /** 从后期存档回测序章时，清掉会把读档强制推回 stage 10 的未来状态。 */
  function resetPostPrologueState (state) {
    state._wrongCommissionOutcome = null
    state._pMainlineStage = 0
    state._pRole = null
    state._pChapterOneLocked = false
    state._pRouteLocked = false
    state._pGateChoices = []
    state._pDayaOutcome = null
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
      body: `<section class="scene-dialogue"><i aria-hidden="true">🗡️</i><div><h3>你刚摸到桥墩下的皮卷，身后便响起脚步声。</h3><p>一个车队看守折返回来寻找遗失的许可。他只有一人，短棍还卡在腰带里；远处林边似乎另有同伙。</p></div></section>
        <div class="wrong-letter-evidence"><span>眼前的机会</span><p>趁他落单先动手，这场战斗不会太难。若故意叫来他的同伙，战利品不会增加，危险却会明显上升。</p></div>`,
      actions: [
        { kind: 'navigation', label: '先退回林边', handler: () => { Dialog.close(); GameFlow.afterEvent() } },
        { label: '抢先截住落单看守', cls: 'btn-primary', handler: () => startBridgeBattle(false) },
        { label: '“把你的人都叫来”', cls: 'btn-danger', handler: () => startBridgeBattle(true) },
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
    Dialog.close()
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
      punishCaravanDefeat(!!result.provoked, () => {
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
      Dialog.show({
        title: '⛓️ 旧桥 · 封箱',
        className: 'commission-bridge-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🔒</i><div><h3>第四道锁扣咬死时，看守没有再继续攻击。</h3><p>他扯住奴隶项圈，先检查手铐、球形口塞和小肛塞的封条，再在货单上写下“四件齐全”。你不再被当作对手，而是被当作一件已经验收的货物。</p></div></section>
          <div class="wrong-letter-evidence is-found"><span>入库记录</span><p>束缚 ${result.bindings || 4}/4 · 搜走 ${result.goldLost || 0}G${state._pCaravanDebt ? ` · 车队欠条 ${state._pCaravanDebt}G` : ''}。锁具在押送结束前不会打开。</p></div>
          <p class="wrong-letter-after">看守把一块写着临时编号的木牌挂在项圈上，叫人把你抬向停在桥下的货车。</p>`,
        actions: [{ label: '被抬上货车', cls: 'btn-danger', handler: () => nextCaravanEscortStage(2) }],
      })
      return true
    }

    if (stage === 2) {
      Dialog.show({
        title: '🛶 返城货车 · 途中',
        className: 'commission-bridge-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🌫️</i><div><h3>货车钻进林雾，车轮每撞上一块石头，四件锁具就同时收紧。</h3><p>${result.naked ? '被没收的衣物装在另一只封口袋里，看守拒绝在交接前归还。' : '看守把搜出来的东西单独装袋，与你的临时编号系在一起。'}每次你试着挪动手腕，押车人就用钱袋在车板上敲一下，记下一次“运输中不服从”。</p></div></section>
          <div class="wrong-letter-evidence"><span>押运状态</span><p>项圈负责牵引，手铐限制双手，口塞取消申辩，最后一件锁具则是车队的“完整验收”标记。</p></div>
          <p class="wrong-letter-after">车速慢下来时，前方已经能看到雾灯镇的城门火把。</p>`,
        actions: [{ label: '听着车轮驶向城门', cls: 'btn-danger', handler: () => nextCaravanEscortStage(3) }],
      })
      return true
    }

    if (stage === 3 && !result.gateUsed) {
      Dialog.show({
        title: '⚖️ 雾灯镇城门 · 莫须有的卖淫',
        className: 'commission-bridge-modal p-gate-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><h3>看守把项圈绳子交到登记桌边上，当着排队的人给你按了罪。</h3><p>“四道锁还戴着就送上门，不是卖淫是什么？非法卖淫，人赃并获。监督官先验收，验完我再交给守卫。”</p></div></section>
          <div class="wrong-letter-evidence is-found"><span>罪名</span><p>非法卖淫。没有客人，没有定价，只有他随口写下的这一条。锁具一件不拆。</p></div>`,
        actions: [{ label: '被交到贝拉米与墨菲面前', cls: 'btn-danger', handler: () => {
          Dialog.close()
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

    Dialog.show({
      title: '🛡️ 城门守卫 · 卖淫收押',
      className: 'commission-bridge-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🛡️</i><div><h3>贝拉米把用完的绳子扔给守卫，墨菲把刚写好的一页拍进黑皮册。</h3><p>守卫看都不用看第二遍。“非法卖淫，按无证卖淫收监。广场木枷太便宜你了。贞操锁扣上，积分攒够才放你出去。出去之后，货车和那个记账的女人你还得自己找。”</p></div></section>
        <section class="p-hall-order"><span>守卫的判决</span><blockquote>“卖淫的去监狱服役。这本册子上的道数不满，门不会开。”</blockquote></section>`,
      actions: [{ label: '被押进雾灯镇监牢', cls: 'btn-danger', handler: () => {
        Dialog.close()
        state._pCaravanEscortStage = 0
        state._pCaravanEscortResult = null
        state._pFourfoldEscortCompleted = true
        EventBus.emit('ui:log', { text: '⛓️ 守卫以非法卖淫把你收监。服刑期满后，仍要回旧桥找回货车与活口。', type: 'danger' })
        EventBus.emit('state:changed', state)
        State.save()
        if (window.TownPrisonSystem) TownPrisonSystem.enter()
        else GameFlow.openCamp()
      } }],
    })
    return true
  }

  /** 四重束缚押到城门后，贝拉米与墨菲先按卖淫罪使用，再交给守卫。手铐不解开。 */
  async function useByGateOfficers (done) {
    const male = State.get().gender === 'male'
    const oral = banditOrifice('oral')
    const hole = banditOrifice('vagina')
    const anal = banditOrifice('anal')
    await runBanditTask('墨菲', '验收这张嘴', `墨菲扯开口塞，笔还夹在耳后。手铐和项圈都没解开。“非法卖淫？手既然不能动，${oral}就自己送到拍子上。账房先验收。”`, {
      bpm: 110, seconds: 35,
      taskSteps: [
        { at: 0, label: '跪好', text: '膝盖分开跪下。手腕保持在背后，当它们还拷在一起。口塞被拿开后含住假阳具，不要用手扶。' },
        { at: 8, label: '按拍吞吐', text: '按 110 BPM 前后含入。每八拍停在最深处一拍，再继续。' },
        { at: 25, label: '听到嘲笑也不许停', text: '墨菲会数你漏掉的拍子。含到最深，直到这一段结束。' },
      ],
    })
    await runBanditTask('贝拉米', '登记桌边上', `贝拉米把你按到登记桌边上，短鞭横在腰后，抽开后面的塞子，整根插进${anal}。“手被铐着还想卖淫？一百五十拍。腰自己送，腿不许并。”`, {
      bpm: 150, seconds: 40,
      taskSteps: [
        { at: 0, label: '上身压住', text: '上身趴低，脸侧过去。双手仍背在身后，不能撑桌。' },
        { at: 8, label: '把腰送上拍子', text: `假阳具对准${anal}，按 150 BPM 自行迎合。每八拍停一拍，再坐到底。` },
        { at: 28, label: '最后不要躲', text: '幅度加大。腿保持分开，直到贝拉米数完这一段。' },
      ],
    })
    if (Math.random() < 0.5) {
      EventBus.emit('ui:log', { text: '👁️ 贝拉米朝排队的人抬了抬下巴，叫了一个路人过来一起使用你。', type: 'danger' })
      await runBanditTask('路人', '被叫来的客人', `贝拉米揪着你的项圈，把一个路人按到你面前。“卖淫的嘴闲着也是闲着。你含他的，我继续用后面。拍子听我的，不许停。”`, {
        bpm: 120, seconds: 30,
        taskSteps: [
          { at: 0, label: '前后一起', text: `维持被铐住的姿势。嘴里含住假阳具，${male ? anal : `${hole}或${anal}`}继续迎合后面。双手不要绕到前面。` },
          { at: 10, label: '听贝拉米的拍子', text: '按 120 BPM。前面每八拍深含一次，后面每八拍送到底一次。' },
          { at: 22, label: '路人听完就走', text: '保持这个节奏直到结束。路人只是被叫来试用，用完就会被打发走。' },
        ],
      })
    }
    if (done) done()
  }

  /** 战败后先在桥上做完惩罚，再进入押送或城门交接。 */
  async function punishCaravanDefeat (provoked, done, options = {}) {
    const male = State.get().gender === 'male'
    const hole = banditOrifice('vagina')
    const anal = banditOrifice('anal')
    const steps = provoked
      ? [
          ['车队看守', '战败惩罚 · 轮流使用', '你跪在桥板上，已经没有还手的力气。两个看守按住你的头。“打输的人只负责挨操。嘴张开，含到最深，换人时不许吐出来。”', { bpm: 140, seconds: 35 }],
          ['车队看守', '战败惩罚 · 按在栏上', `他们把你翻过去按在断栏上，一个人插进${anal}，另一个继续按着你的后颈。“一百六十拍。每一下都报数。哭可以，停不行。”`, { bpm: 160, seconds: 40 }],
        ]
      : [
          ['车队看守', '战败惩罚', `看守一脚把你踢得趴在桥板上，揪住头发迫使你仰起脸。“淫魔的规矩你清楚：输了就服从。先深喉，再把${male ? anal : `${hole}和${anal}轮流`}送上来。我没射完之前，你只是桥上的洞。”`, { bpm: 120, seconds: 35 }],
          ['车队看守', '战败惩罚 · 后入', `他没有把你放开，直接按着腰从后面整根插入${anal}。一百五十拍，撞一下你就出一声，手背到身后，腿不许并。`, { bpm: 150, seconds: 35 }],
        ]
    const startStep = Math.max(0, Math.min(steps.length, Math.floor(Number(options.startStep) || 0)))
    for (let index = startStep; index < steps.length; index++) {
      await runBanditTask(...steps[index])
      if (typeof options.onStep === 'function') options.onStep(index + 1)
    }
    if (done) done()
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
      punishCaravanDefeat(provoked, () => {
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
      Dialog.show({
        title: '🛞 雾灯镇城门 · 全裸押到',
        className: 'commission-bridge-modal p-gate-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">👙</i><div><h3>绳子套在你脖子上。看守牵着全裸的你，越过排队的人，直接走到守卫面前。</h3><p>${provoked ? '“这个在桥上把整队人都叫出来，然后光着输了。”' : '“桥上拦车的。衣服已经收了，人就这副样子。”'}他把绳头塞进守卫手里，“裸身妨碍车队通行。我的部分到此为止，罪你们定。”</p></div></section>
          <div class="wrong-letter-evidence"><span>看守报上的罪名</span><p>裸身妨碍车队通行。比卖淫轻，但是当众、全裸、有绳子为证。</p></div>`,
        actions: [{ label: '绳子交到守卫手里', cls: 'btn-danger', handler: () => {
          Dialog.close()
          runBanditTask('城门守卫', '淫秽妨碍 · 当众报罪', '守卫把你按得跪在告示柱下。“罪名改成淫秽妨碍通行。自己掰开，把这句话报十遍。报错就从头。报完不准穿衣，滚回旧桥抵罪。”', { taskCount: 10, taskTool: '当众掰开并出声报罪' }).then(() => {
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
    Dialog.show({
      title: '🛡️ 城门守卫 · 淫秽妨碍',
      className: 'commission-bridge-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🛡️</i><div><h3>守卫在入城簿空白处写下「淫秽妨碍通行」，把绳子一松，却没有把衣服还给你。</h3><p>“这种小罪不进监狱，也犯不上绞刑架。罚款一百金币，外加厕所的入场管理费。付不起就去公共厕所赚。赚够之前不许出城。债清了，再全裸回旧桥把货车和人找回来。再被这样牵回来，就按卖淫收监。”</p></div></section>
        <section class="p-hall-order"><span>判决</span><blockquote>衣物不还。先去厕所把罚款赚出来，再回旧桥抵罪。</blockquote></section>`,
      actions: [{ label: '被押去公共厕所还债', cls: 'btn-danger', handler: () => {
        const fee = window.CampSystem && CampSystem.gloryFee ? CampSystem.gloryFee : 0
        state._pDefeatDispatchPending = false
        state._gloryDebt = Math.max(0, Number(state._gloryDebt) || 0) + 100 + fee
        state._gloryByGuard = true
        EventBus.emit('ui:log', { text: `🚻 守卫以淫秽妨碍罚你 ${state._gloryDebt}G。赚够之前不能出城，债清后仍要全裸回旧桥抵罪。`, type: 'danger' })
        EventBus.emit('state:changed', state)
        State.save()
        Dialog.close()
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
    const leads = state._wrongCommissionLeads || {}
    const stage = state._wrongCommissionStage || 0
    if (stage >= 10) return '证人、账本和口供证明镇长早已与派克合作。贝拉米与墨菲已开始在城门执行新制度。'
    if (stage === 9) return '城门、商会与居民的口供已经齐全。现在必须带着证据向镇长复命。'
    if (stage === 8) return '获救的记账员已经作证。镇长要求继续核对城门记录、商会账本和居民传闻。'
    if (stage === 7) return '强盗头目已经倒下，车队记账员蕾娜带着半张合作名单活了下来。'
    if (stage === 6) return '失事车队旁的拖拽痕迹钻进旧桥洞；一个知道真相的活口仍被关在那里。'
    if (stage === 5) return state._pBridgePermitAcquired
      ? '旧桥许可盖着镇务厅印章，桥栏外的血迹说明车队残骸就在桥下。'
      : state._pFourfoldEscortCompleted
        ? '看守给你安了非法卖淫的罪名。贝拉米与墨菲使用过你，守卫把你关进监狱服役。出来以后仍要回旧桥找回货车与活口。'
        : '你被全裸牵到城门，罪名定为淫秽妨碍通行。守卫罚你去公共厕所把罚款赚出来，债清后才能出城回旧桥抵罪。'
    if (stage === 4) return '老板娘与铁匠都承认车队持有正式许可；车夫把许可皮卷遗失在旧桥。'
    if (stage === 3 && leads.barkeep) return '老板娘承认车队在后巷拆过货。铁匠铺仍值得调查。'
    if (stage === 3 && leads.blacksmith) return '铁匠承认改装过一批约束锁具。酒馆后门仍值得调查。'
    if (stage === 3) return '旧桥上的车辙、麦秸和锁环证明两批货物都已经进入雾灯镇。'
    return '货单要求两批约束器具经旧桥送入雾灯镇。签收人是酒馆与铁匠，真正的委托人只留下字母派克。'
  }

  return { visitBridge, visitBanditCamp, inspectCaravanWreck, enterBanditHideout, afterBattle, afterDefeat, resumeCaravanEscort, resumeDefeatDispatch, resumeCampStory, resumePending, letterAfterText }
})()
