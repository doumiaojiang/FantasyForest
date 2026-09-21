/**
 * systems/commission.js — “P 的货单”序章野外事件。
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
    saveProgress(3, '🌉 旧桥上的车辙证实，P 的货物已经分批送进雾灯镇。')
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
        <div class="wrong-letter-evidence is-found"><span>许可背面</span><p>“货到后启用新规。城门监督官负责接管。——P”</p></div>
        <p class="wrong-letter-after">桥栏外侧沾着尚未干透的血迹。一截蓝布挂在桥墩下，凌乱的车轮印沿着斜坡滑进断桥阴影。</p>`,
      actions: [{ label: '收起许可，沿桥墩下去', cls: 'btn-primary', handler: () => {
        state._pBridgeAftermath = null
        EventBus.emit('ui:log', { text: '📜 你收好了雾灯镇签发给 P 商队的通行许可。', type: 'warning' })
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
        <p class="wrong-letter-after">这不再只是送错的货单。只要证人还活着，就有人能说明 P 的车队究竟替谁办事。</p>`,
      actions: [{ label: '靠近桥洞里的营火', cls: 'btn-primary', handler: () => { Dialog.close(); enterBanditHideout() } }],
    })
  }

  function startBanditBattle (returning = false) {
    const state = State.get()
    if ((state._wrongCommissionStage || 0) !== 6) { GameFlow.openCamp(); return }
    Dialog.close()
    EventBus.emit('ui:log', { text: returning ? '⚔️ “熟客，先堵嘴。”哨探从旧位置扑来，但这一次没人再替头目挡刀。' : '⚔️ 你踏进桥洞。哨探已经从斜坡阴影里摸到你背后。', type: 'danger' })
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
    EventBus.emit('ui:log', { text: '🔒 强盗把你的原衣锁进头目铁箱；浅滩和赃物堆里都找不到。', type: 'danger' })
  }

  async function playFirstBanditDefeat (startScene = 1) {
    const state = State.get()
    const result = state._pBanditDefeatResult || { goldLost: 0, livingCrew: 2 }
    if (startScene <= 1) {
      state._pBanditAftermath = 'defeat-verify'
      state._pBanditDefeatScene = 1
      lockBanditClothes()
      EventBus.emit('state:changed', state); State.save()
      await runBanditTask('☠️ 劫货强盗头目', '给弃畜烙号', '全裸趴上货箱，左右交替拧乳并逐下报数。头目踩着箱沿骂道：“二十下，母畜。衣服锁起来，你以后就靠腿上的字认自己。”', { taskCount: 20, taskTool: '双手', completeLabel: '报完二十下' })
      await runBanditTask('☠️ 劫货强盗头目', '烂货耳光', '保持趴伏，逐下完成八记耳光。炭笔随后在大腿内侧写下弃畜编号。', { taskCount: 8, taskTool: '手掌', completeLabel: '挨完八下' })
    }

    if (startScene <= 2) {
      state._pBanditAftermath = 'defeat-rotate'
      state._pBanditDefeatScene = 2
      EventBus.emit('state:changed', state); State.save()
      const living = Math.max(0, Math.min(2, result.livingCrew || 0))
      await runBanditTask('☠️ 劫货强盗头目', '匪帮泄火', living > 0
        ? '头目从身后使用你十五秒。“名单不在这头婊子身上。轮着操完，再把烂货扔出去。”'
        : '头目独占着从身后使用你二十秒，每八拍停住一次。', { bpm: 100, seconds: living > 0 ? 15 : 20 })
      if (living >= 1) await runBanditTask('🗡️ 桥洞哨探', '封口收尾', '哨探按住后脑深喉八秒，最后停住憋气。', { bpm: 70, seconds: 8 })
      if (living >= 2) await runBanditTask('🗡️ 翻箱扒手', '搜净母畜', '扒手探穴确认没有藏东西，再逐下扇臀十次。', { taskCount: 10, taskTool: '手掌' })
    }

    state._pBanditAftermath = 'defeat-discard'
    state._pBanditDefeatScene = 3
    EventBus.emit('state:changed', state); State.save()
    showBanditDiscard()
  }

  async function playRepeatBanditDefeat () {
    const state = State.get()
    state._pBanditAftermath = 'defeat-rotate'
    state._pBanditDefeatScene = 2
    EventBus.emit('state:changed', state); State.save()
    await runBanditTask('☠️ 劫货强盗头目', '爬回来的弃畜', '“被操完扔进浅滩的母猪，又自己爬回来了。”头目不再检查，只让人扇臀十下。', { taskCount: 10, taskTool: '手掌' })
    await runBanditTask('🗡️ 桥洞哨探', '堵嘴泄火', '“这头骚货只配堵嘴泄火。”哨探用深喉堵住辩解，最后停住憋气八秒。', { bpm: 70, seconds: 12 })
    state._pBanditAftermath = 'defeat-discard'
    state._pBanditDefeatScene = 3
    EventBus.emit('state:changed', state); State.save()
    showBanditDiscard(true)
  }

  function showBanditDiscard (repeat = false) {
    const state = State.get()
    const result = state._pBanditDefeatResult || { goldLost: 0 }
    Dialog.show({
      title: '🩸 旧桥下 · 弃置浅滩',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🩸</i><div><h3>“${repeat ? '这头弃畜连号都不用重写。堵完嘴，照旧扔下去。' : '问过了。把这头烂母畜操完扔出去，活口比她值钱。'}”</h3><p>头目揪着记号把你拖到洞口，像空箱子一样踹下斜坡。你全裸摔进浅滩，腿上的炭字还新；${result.goldLost || 0}G 已被搜走，原衣则锁在他腰间钥匙对应的铁箱里。</p></div></section>
        <div class="wrong-letter-evidence"><span>桥下的记号</span><p>蕾娜仍被关在木栅后。你可以先回镇整备，也可以立刻再次进入桥洞。</p></div>`,
      actions: [
        { kind: 'navigation', label: '先回镇里整备', handler: () => finishBanditDiscard(true) },
        { label: '再次进入桥洞', cls: 'btn-danger', handler: () => finishBanditDiscard(false) },
      ],
    })
  }

  function finishBanditDiscard (toTown) {
    const state = State.get()
    state._pBanditAftermath = null
    state._pBanditDefeatScene = 0
    state._pBanditDefeatResult = null
    state._pBanditGateReactionPending = toTown && state._pBanditClothesLocked && StatusSystem.has('naked')
    EventBus.emit('state:changed', state); State.save(); Dialog.close()
    if (toTown) GameFlow.openCamp()
    else enterBanditHideout()
  }

  async function begForWitness () {
    const state = State.get()
    Dialog.close()
    await runBanditTask('🗡️ 桥洞哨探', '熟客封口', '自己爬上货箱，报出腿上的编号。哨探按住后脑深喉十二秒，最后停住憋气。', { bpm: 75, seconds: 12 })
    await runBanditTask('🗡️ 翻箱扒手', '锁箱验收', '扒手拍了拍仍锁着原衣的铁箱，当众拧乳十五下。', { taskCount: 15, taskTool: '双手' })
    await runBanditTask('☠️ 劫货强盗头目', '名单换人', '头目从身后使用你二十五秒：“名单换人，人换这张嘴。用完这头婊子，就把记账的扔给她。”', { bpm: 100, seconds: 25 })
    state._pBanditWitnessBegged = true
    EventBus.emit('state:changed', state); State.save()
    rescueCaravanWitness('begged')
  }

  function buyWitness () {
    const state = State.get()
    const price = Math.max(300, (state._pCaravanDebt || 0) * 2)
    if (state.gold < price) { enterBanditHideout(); return }
    state.gold -= price
    state._pBanditWitnessBegged = true
    EventBus.emit('ui:log', { text: `💰 你付出 ${price}G 买下蕾娜的命；头目仍拒绝打开衣箱。`, type: 'danger' })
    EventBus.emit('state:changed', state); State.save(); Dialog.close()
    rescueCaravanWitness('bought')
  }

  function enterBanditHideout () {
    const state = State.get()
    if ((state._wrongCommissionStage || 0) !== 6) { GameFlow.openCamp(); return }
    if ((state._pBanditDefeatCount || 0) >= 1) {
      const price = Math.max(300, (state._pCaravanDebt || 0) * 2)
      const forceChoice = (state._pBanditDefeatCount || 0) >= 2
      Dialog.show({
        title: '🌉 旧桥下 · 熟客',
        className: 'commission-bridge-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🔥</i><div><h3>头目一眼认出你腿上的炭字，笑声从货箱一路传到木栅。</h3><p>“昨天扔出去的${state.gender === 'male' ? '男婊子' : '母猪'}自己爬回来了。名单还在。你是来打，还是来跪？”蕾娜隔着木栅看着你，没有出声。</p></div></section>
          ${forceChoice ? '<p class="wrong-letter-after">连续两次被扔回来后，匪帮已经封死正面入口。要救人，只能交出足够的代价。</p>' : ''}`,
        actions: [
          ...(!forceChoice ? [{ label: '再打一次', cls: 'btn-danger', handler: () => startBanditBattle(true) }] : []),
          { label: '跪上货箱换人', cls: 'btn-danger', handler: begForWitness },
          ...(state.gold >= price ? [{ label: `付 ${price}G 买下活口`, cls: 'btn-primary', handler: buyWitness }] : []),
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
    const result = state._pBanditVictoryResult || { fleeingCrew: 0 }
    const revenge = (state._pBanditDefeatCount || 0) > 0
    state._pBanditAftermath = 'victory-fall'
    EventBus.emit('state:changed', state); State.save()
    Dialog.show({
      title: revenge ? '☠️ 桥洞 · 弃畜归来' : '☠️ 桥洞 · 头目倒下',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">☠️</i><div><h3>${revenge ? '头目认出腿上的炭号时已经太迟。木盾脱手，他跪倒在那只曾经压住你的货箱旁。' : '木盾砸进灰堆，头目跪倒在货箱旁。'}</h3><p>${result.fleeingCrew > 0 ? `剩余 ${result.fleeingCrew} 名喽啰看见头目倒下，抢着钻出桥洞，连账册和钥匙都没敢拿。` : '哨探和扒手已经倒下，桥洞里只剩头目的喘息与木栅后的锁链声。'}${revenge ? '“被你们扔进浅滩的弃畜，自己爬回来取钥匙了。”' : ''}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>胜负已定</span><p>头目已经不能继续战斗。现在决定怎样处置他，再去处理铁箱与证人。</p></div>`,
      actions: [
        { label: '踩住他，逼问雇主', cls: 'btn-primary', handler: () => settleBanditLeader('questioned') },
        { label: '用他的绳子捆好', handler: () => settleBanditLeader('bound') },
        { label: '让他带着记号爬出去', cls: 'btn-danger', handler: () => settleBanditLeader('released') },
      ],
    })
  }

  function settleBanditLeader (fate) {
    const state = State.get()
    state._pBanditLeaderFate = fate
    const logs = {
      questioned: '📖 头目吐出雇主只要求烧掉名单、不能伤及镇内收货人的口供。',
      bound: '🪢 你用头目的绳子反绑住他，准备把人和账册一起交给镇务厅。',
      released: '🩸 你把炭号写回头目脸上，让他带着“弃匪”的记号爬出桥洞。',
    }
    EventBus.emit('ui:log', { text: logs[fate], type: fate === 'released' ? 'danger' : 'good' })
    EventBus.emit('state:changed', state); State.save(); Dialog.close()
    continueBanditVictory()
  }

  function continueBanditVictory () {
    const state = State.get()
    const result = state._pBanditVictoryResult || {}
    if ((result.clothesTaken || state._pBanditClothesLocked) && StatusSystem.has('naked')) {
      state._pBanditAftermath = 'clothes'
      EventBus.emit('state:changed', state); State.save()
      recoverBanditClothes()
      return
    }
    showBanditVictoryMark()
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
      title: '🩸 桥洞 · 腿上的弃畜号',
      className: 'commission-bridge-modal',
      body: '<section class="scene-dialogue"><i aria-hidden="true">🩸</i><div><h3>铁箱已经打开，腿内侧的炭字却还留着。</h3><p>浅滩的水能把它擦淡。你也可以故意留下，让镇里的人知道这头被强盗扔出去的“弃畜”最后又爬回来打倒了主人。</p></div></section>',
      actions: [
        { label: '用浅滩水擦掉记号', cls: 'btn-primary', handler: () => settleBanditMark('scrubbed') },
        { label: '留下记号作为战利品', cls: 'btn-danger', handler: () => settleBanditMark('kept') },
      ],
    })
  }

  function settleBanditMark (choice) {
    const state = State.get()
    state._pBanditMarkChoice = choice
    EventBus.emit('ui:log', { text: choice === 'scrubbed' ? '💧 你用冷水擦淡了腿上的弃畜号。' : '🩸 你保留了腿上的弃畜号，把它变成爬回来复仇的证明。', type: choice === 'scrubbed' ? 'good' : 'warning' })
    EventBus.emit('state:changed', state); State.save(); Dialog.close()
    finishBanditVictory()
  }

  function finishBanditVictory () {
    const state = State.get()
    state._pBanditAftermath = null
    state._pBanditVictoryResult = null
    EventBus.emit('state:changed', state); State.save()
    rescueCaravanWitness((state._pBanditDefeatCount || 0) > 0 ? 'revenge' : 'victory')
  }

  function rescueCaravanWitness (method = 'victory') {
    const state = State.get()
    state._wrongCommissionStage = 7
    state._wrongCommissionOutcome = 'permit'
    EventBus.emit('ui:log', { text: '🕯️ 你救出了车队记账员。她愿意带着名单去镇务厅作证。', type: 'good' })
    EventBus.emit('state:changed', state)
    State.save()
    Dialog.show({
      title: '🕯️ 旧桥下 · 活着的证人',
      className: 'commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🕯️</i><div><h3>${['victory', 'revenge'].includes(method) ? '你劈开木栅上的锁，女人却先扑向即将烧尽的文件。' : '强盗终于打开木栅，把蕾娜推到你脚边；锁着原衣的铁箱却重新落了锁。'}</h3><p>${method === 'begged' ? '“他们用完你才开锁。”蕾娜捡起半张名单，冷冷看了你一眼，“别求我感谢。至少跟你走，比留在洞里强。”' : method === 'bought' ? '“你买的是我的命，不是我的感谢。”蕾娜把半张名单藏进外套，催你立刻离开桥洞。' : method === 'revenge' ? '蕾娜认得腿上的炭号，也看见你拿着头目钥匙回来。“他们把你当弃畜扔出去，你却回来把锁打开了。”她没有道谢，只把半张名单递给你，“这次别再倒下。”' : '她叫蕾娜，是车队的记账员。P 的货只是诱饵；真正重要的是镇务厅签署的合作名单。'}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>半张收货名单</span><p>酒馆、铁匠铺、城门卫队都在名单上。最后一栏的签署人属于镇务厅。</p></div>
        <p class="wrong-letter-after">${['victory', 'revenge'].includes(method) ? `蕾娜看了一眼${state._pBanditLeaderFate === 'bound' ? '被反绑的头目' : state._pBanditLeaderFate === 'released' ? '洞口那道带血的爬痕' : '被撬开的账册'}，同意把处置经过一起写进口供。` : '蕾娜记得自己是怎样被换出来的；后续证词会保留这段经过。'}她要你先护送她回雾灯镇。</p>`,
      actions: [{ label: '护送蕾娜返回镇务厅', cls: 'btn-primary', handler: () => { Dialog.close(); GameFlow.openCamp() } }],
    })
  }

  function startBridgeBattle (provoked) {
    const state = State.get()
    Dialog.close()
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
    if (state._pBanditAftermath === 'defeat-verify') {
      playFirstBanditDefeat(1)
      return true
    }
    if (state._pBanditAftermath === 'defeat-rotate') {
      if ((state._pBanditDefeatCount || 0) > 1) playRepeatBanditDefeat()
      else playFirstBanditDefeat(2)
      return true
    }
    if (state._pBanditAftermath === 'defeat-discard') {
      showBanditDiscard((state._pBanditDefeatCount || 0) > 1)
      return true
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
    const state = State.get()
    const locked = !!state._pBanditClothesLocked
    Dialog.show({
      title: locked ? '🔑 桥洞 · 头目的铁箱' : '👕 桥洞 · 赃物堆',
      className: 'commission-bridge-modal caravan-clothes-modal',
      body: locked
        ? '<section class="scene-dialogue"><i aria-hidden="true">🔑</i><div><h3>头目倒下时，腰间那把铁钥匙也落进尘土。</h3><p>赃物堆里果然没有衣服。你用钥匙打开他的铁箱，才找回被专门锁起来的原衣；腿上的炭字仍提醒着你第一次被扔出去的样子。</p></div></section>'
        : '<section class="scene-dialogue"><i aria-hidden="true">📦</i><div><h3>头目倒下后，你在扒手翻乱的赃物堆里找到了自己的衣服。</h3><p>衣带已经被割断，但还能勉强穿回去。木栅后的记账员仍在呼救，现在不是继续翻找战利品的时候。</p></div></section>',
      actions: [
        { label: '穿回原衣', cls: 'btn-primary', handler: () => finishBanditClothes(true, locked) },
        { label: '把破损原衣披在肩上', cls: 'btn-danger', handler: () => finishBanditClothes(false, locked) },
      ],
    })
  }

  function finishBanditClothes (wear, locked) {
    const state = State.get()
    if (wear && StatusSystem.has('naked')) StatusSystem.remove('naked')
    state._pBanditClothesLocked = false
    EventBus.emit('ui:log', { text: wear
      ? `👕 你${locked ? '打开头目铁箱，' : ''}穿回了自己的原衣。`
      : `👕 你${locked ? '从头目铁箱取回' : '从赃物堆拿起'}破损原衣披在肩上，身体仍保持裸露。`, type: wear ? 'good' : 'warning' })
    EventBus.emit('state:changed', state); State.save(); Dialog.close()
    showBanditVictoryMark()
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

    if (stage === 1) {
      Dialog.show({
        title: '⛓️ 旧桥 · 封箱',
        className: 'commission-bridge-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🔒</i><div><h3>第四道锁扣咬死时，看守没有再继续攻击。</h3><p>他扯住编号项圈，先检查手铐、口塞和入库肛塞的封条，再在货单上写下“四件齐全”。你不再被当作对手，而是被当作一件已经验收的货物。</p></div></section>
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

    if (stage === 3) {
      Dialog.show({
        title: '⚖️ 雾灯镇城门 · 交接',
        className: 'commission-bridge-modal p-gate-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">📖</i><div><h3>货车没有排在入城队伍后面，而是直接停在新立的登记桌旁。</h3><p>佩着短鞭的 Bellamy 先扯了扯项圈，确认四道锁扣都没有被破坏。Murphy 则翻开黑皮册，核对车队看守交上来的货单。</p></div></section>
          <div class="wrong-letter-evidence is-found"><span>Bellamy</span><p>“旧桥上还没处理完，就先送来一个四道锁的。好。这个我会记住。”</p></div>
          <div class="wrong-letter-evidence"><span>Murphy</span><p>他没把你写进正式财产页，只在城门备忘录上留下临时编号、旧桥地点和“待追查失踪车辆”。</p></div>`,
        actions: [{ label: '接受临时登记', cls: 'btn-danger', handler: () => nextCaravanEscortStage(4) }],
      })
      return true
    }

    Dialog.show({
      title: '📖 城门内侧 · 临时编号',
      className: 'commission-bridge-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><h3>Murphy 在木牌上盖下城门印，Bellamy 却没有把你直接送去地牢。</h3><p>被劫的车辆、失踪的记账员和桥下的血迹都还没有答案。他需要一个已经被登记、又熟悉旧桥现场的人回去追查。</p></div></section>
        <section class="p-hall-order"><span>Bellamy</span><blockquote>“锁先留着。进城，恢复体力，然后回旧桥找出车队和活口。别以为这是释放——Murphy 会等你回来销记。”</blockquote></section>
        <div class="wrong-letter-evidence is-found"><span>新任务理由</span><p>你不是莫名其妙地折返旧桥：临时登记的条件，就是找到失踪车队、记账员与后续证据。今后再见 Bellamy 与 Murphy，他们会记得你是怎样被送进城的。</p></div>`,
      actions: [{ label: '带着临时编号进入雾灯镇', cls: 'btn-danger', handler: () => {
        Dialog.close()
        state._pCaravanEscortStage = 0
        state._pCaravanEscortResult = null
        state._pFourfoldEscortCompleted = true
        EventBus.emit('ui:log', { text: '⛓️ Bellamy 与 Murphy 完成了临时登记，命你之后返回旧桥追查失踪车队。', type: 'warning' })
        EventBus.emit('state:changed', state)
        State.save()
        GameFlow.openCamp()
      } }],
    })
    return true
  }

  /** 普通生命归零后的城门交接；独立存档，避免刷新后凭空跳到营地。 */
  function resumeDefeatDispatch () {
    const state = State.get()
    if (!state._pDefeatDispatchPending) return false
    const result = ['normal_captured', 'provoked_captured'].includes(state._pBridgeResult)
      ? state._pBridgeResult
      : (state._wrongCommissionCaptured ? 'normal_captured' : 'normal_victory')
    const provoked = result === 'provoked_captured'
    Dialog.show({
      title: '⚖️ 雾灯镇城门 · 临时交接',
      className: 'commission-bridge-modal p-gate-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🛞</i><div><h3>货车越过排队的人群，直接停在新立的登记桌旁。</h3><p>Murphy 核对看守交来的货单，把你的名字、旧桥地点和“未取得许可”写进临时页。Bellamy 则扯住捆腕的绳结，确认你身上没有藏着那张许可。</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>Bellamy</span><p>“${provoked ? '把整队人叫来又被送回来，你至少该记得桥下有什么。' : '车队少了一辆，记账员也没进城。你既然从旧桥来，就回去把他们找出来。'}”</p></div>
        <section class="p-hall-order"><span>临时命令</span><blockquote>进城恢复体力，然后返回旧桥，寻找失踪车辆与活口。没有许可，也要带回能让 Murphy 销记的证据。</blockquote></section>
        <p class="wrong-letter-after">这不是正式的身份登记。真正的城门换岗与路线选择，要等你查完车队、救出证人并向镇长复命后才会发生。</p>`,
      actions: [{ label: '接受临时命令，进入雾灯镇', cls: 'btn-danger', handler: () => {
        state._pDefeatDispatchPending = false
        EventBus.emit('ui:log', { text: '⚖️ Bellamy 命你恢复体力后返回旧桥，寻找失踪车队与活口。', type: 'warning' })
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

  function afterDefeat (result) {
    if (result && result.storyDefeat && result.enemyId === 'p_bandit_leader' && result.story === 'commission-bandits') {
      const state = State.get()
      state._wrongCommissionStage = 6
      state._pBanditDefeatCount = (state._pBanditDefeatCount || 0) + 1
      state._pBanditDefeatResult = {
        goldLost: Math.max(0, Number(result.goldLost) || 0),
        livingCrew: Math.max(0, Math.min(2, Number(result.banditLivingCrew) || 0)),
      }
      state._pBanditAftermath = state._pBanditDefeatCount === 1 ? 'defeat-verify' : 'defeat-rotate'
      state._pBanditDefeatScene = state._pBanditDefeatCount === 1 ? 1 : 2
      EventBus.emit('state:changed', state)
      State.save()
      if (state._pBanditDefeatCount === 1) playFirstBanditDefeat()
      else playRepeatBanditDefeat()
      return true
    }
    if (!result || !result.storyDefeat || result.enemyId !== 'p_caravan_guard') return false
    const state = State.get()
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

    if (stage < 2) {
      EventBus.emit('ui:log', { text: '🌉 雾从旧桥的断栏间穿过。桥板上有新车辙，但你暂时不知道它们属于谁。', type: 'dim' })
    } else if (stage === 3) {
      EventBus.emit('ui:log', { text: '🌉 车辙仍通向雾灯镇。先去酒馆与铁匠铺确认两批货物的去向。', type: 'dim' })
    } else {
      EventBus.emit('ui:log', { text: '🌉 旧桥下只剩被雨水冲淡的车辙；桥洞里的营火已经熄灭。', type: 'dim' })
    }
    GameFlow.afterEvent()
  }

  function letterAfterText (state = State.get()) {
    const leads = state._wrongCommissionLeads || {}
    const stage = state._wrongCommissionStage || 0
    if (stage >= 10) return '证人、账本和口供证明镇长早已与 Pike 合作。Bellamy 与 Murphy 已开始在城门执行新制度。'
    if (stage === 9) return '城门、商会与居民的口供已经齐全。现在必须带着证据向镇长复命。'
    if (stage === 8) return '获救的记账员已经作证。镇长要求继续核对城门记录、商会账本和居民传闻。'
    if (stage === 7) return '强盗头目已经倒下，车队记账员蕾娜带着半张合作名单活了下来。'
    if (stage === 6) return '失事车队旁的拖拽痕迹钻进旧桥洞；一个知道真相的活口仍被关在那里。'
    if (stage === 5) return state._pBridgePermitAcquired
      ? '旧桥许可盖着镇务厅印章，桥栏外的血迹说明车队残骸就在桥下。'
      : '你没有抢到许可，却从押送和城门放行中确认车队受雾灯镇庇护。Bellamy 命你返回旧桥寻找失踪车辆。'
    if (stage === 4) return '老板娘与铁匠都承认车队持有正式许可；车夫把许可皮卷遗失在旧桥。'
    if (stage === 3 && leads.barkeep) return '老板娘承认车队在后巷拆过货。铁匠铺仍值得调查。'
    if (stage === 3 && leads.blacksmith) return '铁匠承认改装过一批约束锁具。酒馆后门仍值得调查。'
    if (stage === 3) return '旧桥上的车辙、麦秸和锁环证明两批货物都已经进入雾灯镇。'
    return '货单要求两批约束器具经旧桥送入雾灯镇。签收人是酒馆与铁匠，真正的委托人只留下字母 P。'
  }

  return { visitBridge, inspectCaravanWreck, enterBanditHideout, afterBattle, afterDefeat, resumeCaravanEscort, resumeDefeatDispatch, resumeCampStory, resumePending, letterAfterText }
})()
