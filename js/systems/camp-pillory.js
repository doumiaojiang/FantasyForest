/**
 * systems/camp-pillory.js — 城镇广场木枷玩法与可恢复任务流程。
 */
window.TownPillorySystem = (function () {
  const campShow = options => CampSystem.showScene(options)
  const open = opts => CampSystem.open(opts)
  const setCampPhase = () => CampSystem.ensurePhase()
  const routeTownService = part => CampSystem.routeTownService(part)
  const townServiceDesc = (part, actor) => CampSystem.townServiceDesc(part, actor)

  const PILLORY_OPTIONS = [
    { duration: 30, reward: 10, label: '短时展示', note: '30 秒 · 10G' },
    { duration: 60, reward: 25, label: '标准展示', note: '60 秒 · 25G' },
    { duration: 90, reward: 45, label: '长时展示', note: '90 秒 · 45G' },
  ]
  const PILLORY_POSES = [
    {
      id: 'classic', icon: '🪵', name: '标准受枷', tag: '衣物不除 · 弯腰示众',
      intro: '你俯身把脖颈和双腕放进木枷，身体被迫固定在广场中央，只能任由路人从近处打量。',
      task: '木枷压住你的后颈与双腕，你保持弯腰受制的姿势，无法遮挡围观者的视线。',
    },
    {
      id: 'nude_bent', icon: '🍑', name: '全裸撅臀', tag: '一丝不挂 · 臀部朝向人群',
      intro: '你在木枷前脱得一丝不挂，赤裸地弯下腰，把脖颈和双腕锁进沉重的木板。腰被压低，臀部却高高撅向人群，最私密的地方毫无遮掩地暴露在广场上。',
      task: '你全裸弯腰受枷，脖颈和双腕都被木板牢牢卡住，只能高高撅着臀部，让来往路人从身后看个清楚。',
    },
    {
      id: 'nude_kneel', icon: '⛓️', name: '全裸跪姿', tag: '双膝分开 · 低位受枷',
      intro: '你脱光衣服跪在低矮木枷前，双膝分开，脖颈与手腕被锁在同一排孔洞里。上身被迫贴低，赤裸的臀部成为所有围观目光的中心。',
      task: '你全裸跪在石板上，双膝分开、上身伏低，颈首枷把头和双手固定得严严实实，只剩臀部无助地抬起。',
    },
  ]
  const PILLORY_CROWD_LINES = [
    '脚步声在身后停停走走，有人故意绕到木枷后方，近距离欣赏你无法遮掩的姿态。',
    '广场上的议论声越来越近，几道目光沿着你的后背一路落到高高抬起的臀部。',
    '木枷旁渐渐围起一圈人，你看不见身后，只能从笑声和喘息声猜测他们正在看哪里。',
    '粗糙的木板让你无法直起腰，任何细小挣扎都只会让展示姿势变得更加明显。',
  ]
  const PILLORY_AMBIENT_EVENTS = [
    { id: 'coin_tip', kind: 'ambient', icon: '🪙', name: '路人投币', desc: '一名路人把几枚金币丢进木枷旁的铁碗。', gold: 5, type: 'good' },
    { id: 'quiet_crowd', kind: 'ambient', icon: '👥', name: '驻足围观', desc: '几名镇民停下脚步，小声议论片刻后继续赶路。', gold: 0, type: 'dim' },
    { id: 'public_mockery', kind: 'ambient', icon: '📣', name: '公开嘲笑', desc: '围观者起哄嘲笑，你只能保持姿势把这一段熬过去。', gold: 0, type: 'dim' },
    { id: 'light_fingers', kind: 'ambient', icon: '🫳', name: '顺手牵羊', desc: '有人趁你动弹不得，摸走了最多 5 枚金币。', gold: -5, type: 'danger' },
  ]
  const PILLORY_ADULT_EVENTS = [
    { id: 'cruel_guard_trial', kind: 'adult', part: 'spank', bpm: 0, seconds: 0, name: '铁腕守卫的加码', style: '公开惩戒', story: 'cruel_guard' },
    { id: 'oral_slow', kind: 'adult', part: 'oral', bpm: 60, seconds: 30, name: '缓慢口部服务', style: '缓慢试探' },
    { id: 'oral_fast', kind: 'adult', part: 'oral', bpm: 120, seconds: 30, name: '快速口部服务', style: '快速操弄' },
    { id: 'oral_deep', kind: 'adult', part: 'oral', bpm: 90, seconds: 30, name: '围观深喉', style: '压住后脑深深送入' },
    { id: 'public_spank', kind: 'adult', part: 'spank', bpm: 90, seconds: 30, name: '轮流拍打', style: '让围观者轮流掌掴裸露的臀部' },
    { id: 'anal_tease', kind: 'adult', part: 'anal', bpm: 60, seconds: 30, name: '后穴慢弄', style: '扶住腰胯缓慢顶弄' },
    { id: 'anal_standard', kind: 'adult', part: 'anal', bpm: 90, seconds: 30, name: '后穴围观服务', style: '稳定抽插' },
    { id: 'anal_hard', kind: 'adult', part: 'anal', bpm: 150, seconds: 30, name: '激烈后穴服务', style: '猛烈抽插' },
    { id: 'vagina_standard', kind: 'adult', part: 'vagina', bpm: 90, seconds: 30, name: '小穴围观服务', style: '稳定抽插' },
    { id: 'vagina_hard', kind: 'adult', part: 'vagina', bpm: 150, seconds: 30, name: '激烈小穴服务', style: '猛烈抽插' },
  ]
  let pilloryRunning = false
  function pilloryPose (id) {
    return PILLORY_POSES.find(pose => pose.id === id) || PILLORY_POSES[1]
  }

  function squarePillory () {
    setCampPhase()
    campShow({
      title: '🪵 雾灯镇广场',
      className: 'camp-tavern-modal pillory-modal pillory-story-page-modal',
      body: `<section class="pillory-narrative">
          <div class="pillory-scene-mark">🪵</div>
          <p>广场中央立着一副被磨得发亮的旧木枷。铁碗摆在旁边，里面已经有几枚别人留下的硬币。</p>
          <p>看守用钥匙敲了敲木板。附近的脚步渐渐慢下来，几个路人站在不远处，等着看你会不会真的走上去。</p>
          <blockquote><b>广场看守</b>“想赚赏钱，就自己把脖子伸进来。”</blockquote>
        </section>
        <div class="pillory-action-list" aria-label="木枷姿势">
          <button data-pillory-pose="classic"><span>保留衣服，俯身进入木枷</span><small>让看守锁住你的脖颈和双腕</small></button>
          <button data-pillory-pose="nude_bent"><span>当众脱光，弯腰撅起臀部</span><small>把衣服留在脚边，赤裸地走到木枷前</small></button>
          <button data-pillory-pose="nude_kneel"><span>脱光跪下，把头和双手伸进去</span><small>双膝分开，接受低位木枷的固定</small></button>
        </div>`,
      actions: [{ kind: 'navigation', label: '返回营地', handler: () => open() }],
    })
    document.querySelectorAll('[data-pillory-pose]').forEach(btn => {
      btn.onclick = () => showPilloryDuration(btn.dataset.pilloryPose)
    })
  }

  function showPilloryDuration (poseId) {
    const state = State.get()
    const pose = pilloryPose(poseId)
    const adultOn = (state._pillorySettings || {}).adultEvents !== false
    const mercDebt = state._mercenary && state._mercenaryContract
      ? Math.max(0, state._mercenaryContract.debt || 0)
      : 0
    const afterPose = {
      classic: '木板在你后颈合拢。隔着衣服，你仍能感觉到背后那些毫不掩饰的视线。',
      nude_bent: '最后一件衣服落在脚边。木板咔哒合拢，你赤裸地弯在广场中央，臀部正对着渐渐聚拢的人群。',
      nude_kneel: '石板的凉意贴上膝盖。你分开双腿伏低身体，让看守把颈首和双腕一起锁进低矮的木枷。',
    }[pose.id]
    campShow({
      title: `🪵 ${pose.name}`,
      className: 'camp-tavern-modal pillory-modal pillory-story-page-modal',
      body: `<section class="pillory-narrative is-bound">
          <div class="pillory-scene-mark">${pose.icon}</div>
          <p>${afterPose}</p>
          <p>看守提起木枷旁的铁碗，在手里掂了掂。</p>
          <blockquote><b>广场看守</b>“要锁多久？撑得越久，赏钱越多。”</blockquote>
        </section>
        <div class="pillory-action-list" aria-label="展示时长">
          <button data-pillory-choice="0"><span>先忍耐一会儿</span><small>30 秒 · 赏钱 10G</small></button>
          <button data-pillory-choice="1"><span>在人群前多待一阵</span><small>60 秒 · 赏钱 25G</small></button>
          <button data-pillory-choice="2"><span>逞强撑到看守满意</span><small>90 秒 · 赏钱 45G</small></button>
          ${adultOn ? '<button class="is-danger" data-pillory-cruel><span>抬眼看向柱边的黑甲看守</span><small>“普通展示太无聊了。你来替他们加点节目。”</small></button>' : ''}
          ${mercDebt > 0 ? '<button class="is-debt" data-pillory-debt><span>让芙蕾雅把这次展示记在债上</span><small>受枷 60 秒 · 不领赏钱，用来抵扣债务</small></button>' : ''}
        </div>`,
      actions: [
        { kind: 'navigation', label: '重新选择姿势', handler: squarePillory },
        { kind: 'navigation', label: '离开广场', handler: open },
      ],
    })
    document.querySelectorAll('[data-pillory-choice]').forEach(btn => {
      btn.onclick = () => {
        const opt = PILLORY_OPTIONS[Number(btn.dataset.pilloryChoice)]
        if (opt) startPillory('voluntary', opt.duration, opt.reward, pose.id)
      }
    })
    const cruelBtn = document.querySelector('[data-pillory-cruel]')
    if (cruelBtn) cruelBtn.onclick = () => startPillory('voluntary', 60, 25, pose.id, { eventId: 'cruel_guard_trial' })
    const debtBtn = document.querySelector('[data-pillory-debt]')
    if (debtBtn) debtBtn.onclick = () => startPillory('mercenary', 60, 0, pose.id)
  }

  /** 每 15 秒进行一次围观判定；一轮最多保留一项，并排除上次事件。 */
  function rollPilloryEvent (duration, source = 'voluntary', random = Math.random) {
    const state = State.get()
    const checks = Math.max(1, Math.floor(duration / 15))
    let triggered = false
    const chance = source === 'punishment' ? 0.45 : 0.30
    for (let i = 0; i < checks; i++) {
      if (random() < chance) { triggered = true; break }
    }
    if (!triggered) return null
    const adultOn = (state._pillorySettings || {}).adultEvents !== false
    const adultPool = adultOn
      ? PILLORY_ADULT_EVENTS.filter(event => state.gender !== 'male' || event.part !== 'vagina')
      : []
    const wantsAdult = adultPool.length && random() < (source === 'punishment' ? 0.65 : 0.45)
    let pool = wantsAdult ? adultPool : PILLORY_AMBIENT_EVENTS
    const withoutRepeat = pool.filter(event => event.id !== state._pilloryLastEventId)
    if (withoutRepeat.length) pool = withoutRepeat
    const picked = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
    return picked ? { ...picked, applied: false } : null
  }

  function startPillory (source, duration, reward, poseId = 'nude_bent', opts = {}) {
    const state = State.get()
    if (state._pillory || pilloryRunning) return
    const forcedEvent = opts.eventId ? PILLORY_ADULT_EVENTS.find(item => item.id === opts.eventId) : null
    const event = forcedEvent ? { ...forcedEvent, applied: false } : rollPilloryEvent(duration, source)
    state._pillory = {
      source: ['mercenary', 'fine', 'punishment'].includes(source) ? source : 'voluntary',
      duration,
      reward,
      poseId: pilloryPose(poseId).id,
      crowdLine: PILLORY_CROWD_LINES[Math.floor(Math.random() * PILLORY_CROWD_LINES.length)],
      stage: 'restraint',
      event,
      results: [],
      returnTo: source === 'fine' ? 'leave' : 'camp',
    }
    if (event) state._pilloryLastEventId = event.id
    EventBus.emit('ui:log', { text: `🪵 ${pilloryPose(state._pillory.poseId).intro} 开始 ${duration} 秒公开展示。`, type: 'dim' })
    EventBus.emit('state:changed', state)
    State.save()
    runPilloryFlow()
  }

  async function runPilloryFlow () {
    const state = State.get()
    const task = state._pillory
    if (!task || pilloryRunning) return
    pilloryRunning = true
    try {
      if (task.stage === 'restraint') {
        const pose = pilloryPose(task.poseId)
        const crowdLine = task.crowdLine || PILLORY_CROWD_LINES[0]
        if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
          await BattleUI.showTaskDialog({
            enemyName: '🪵 雾灯镇广场',
            attackName: `公开木枷 · ${pose.name}`,
            desc: `${pose.task} ${crowdLine} 保持这副姿势 ${task.duration} 秒。`,
            bpm: 0,
            seconds: task.duration,
            dmg: 0,
            noDamage: true,
            allowSkip: true,
            showFailure: false,
            completeLabel: '✅ 确认展示完成',
            dialogClass: 'pillory-task-modal',
            telemetry: { source: 'pillory', action: 'other', part: 'body', depth: 'none' },
          })
        }
        task.stage = task.event ? 'adult' : 'settle'
        EventBus.emit('state:changed', state)
        State.save()
      }
      if (task.stage === 'adult') {
        await runPilloryEvent(task)
        task.stage = 'settle'
        EventBus.emit('state:changed', state)
        State.save()
      }
      if (task.stage === 'settle') settlePillory(task)
    } finally {
      pilloryRunning = false
    }
  }

  function addPilloryResult (task, result) {
    if (!Array.isArray(task.results)) task.results = []
    task.results.push(result)
    task.results = task.results.slice(-6)
  }

  function pilloryEventDef (event) {
    return [...PILLORY_AMBIENT_EVENTS, ...PILLORY_ADULT_EVENTS].find(item => item.id === event.id) || event
  }

  const CRUEL_GUARD_BRANCHES = {
    endure: {
      icon: '🩸', name: '咬牙忍耐', action: 'spanking', part: 'body', bpm: 90, seconds: 45, hpLoss: 1, wanted: 2, bonus: 10,
      hint: '藤条惩戒 45 秒 · 轻伤',
      taskName: '藤条惩戒',
      desc: '你没有求饶。守卫把束腰皮带又收紧一格，命令你继续高高撅着臀部；藤条按节拍落在裸露的臀肉上，每一下都逼得木枷发出沉闷撞响。',
      outcome: '你咬住嘴唇撑完整段惩戒，臀部已经火辣发麻，围观者终于满意地散开。',
    },
    provoke: {
      icon: '🔥', name: '挑衅加码', action: 'spanking', part: 'body', bpm: 150, seconds: 45, hpLoss: 3, wanted: 8, bonus: 20,
      hint: '急促重罚 45 秒 · 重伤风险',
      taskName: '残酷加码',
      desc: '你回头嘲笑守卫下手太轻。守卫冷笑着扣紧第二道皮带，把你的腰彻底压死在最低处；更重、更快的藤条连续抽落，围观人群跟着节拍大声计数。',
      outcome: '最后一下落下时，你只能靠木枷支撑身体。守卫把额外赏钱丢进铁碗，也把你的名字记进巡逻簿。',
    },
    submit: {
      icon: '⛓️', name: '低声求饶', action: 'oral', part: 'oral', bpm: 90, seconds: 30, hpLoss: 0, wanted: 4, bonus: 12,
      hint: '公开服从 30 秒 · 不扣生命',
      taskName: '公开服从',
      desc: '你低声请求停止抽打。守卫捏住你的下巴，给出替代条件：保持颈首和双腕受枷，在所有人面前完成一段公开口部服从任务，证明你已经学会听话。',
      outcome: '守卫确认你完成服从任务后停止惩戒，但围观者的起哄声让这次求饶变得比挨打更加公开。',
    },
  }

  function chooseCruelGuardBranch (task, event) {
    const pose = pilloryPose(task.poseId)
    return new Promise(resolve => {
      Dialog.show({
        title: '🛡️ 雾灯镇广场 · 黑甲看守',
        className: 'camp-tavern-modal pillory-modal pillory-story-modal',
        body: `<section class="pillory-story-hero"><i>🛡️</i><div><small>黑甲看守</small><h3>他决定给这场展示“加一点规矩”</h3><p>披着黑甲的看守拨开人群，绕到你的身后。他用藤条挑起你的臀部，又检查了一遍锁住颈首和双腕的木板。</p></div></section>
          <blockquote>“既然选了「${pose.name}」，就别只站在这里装样子。让广场上的人看看你能撑到什么程度。”</blockquote>
          <div class="pillory-story-whisper"><i>👁️</i><span>人群安静下来，等着听你会怎样回答。</span></div>
          <div class="pillory-story-choices">${Object.entries(CRUEL_GUARD_BRANCHES).map(([id, branch]) => `<button data-pillory-story="${id}"><i>${branch.icon}</i><span><b>${branch.name}</b><small>${branch.hint}</small></span><em>+${branch.bonus}G</em></button>`).join('')}</div>`,
        actions: [],
      })
      document.querySelectorAll('[data-pillory-story]').forEach(btn => {
        btn.onclick = () => { Dialog.close(); resolve(btn.dataset.pilloryStory) }
      })
    })
  }

  async function runCruelGuardStory (task, event) {
    const state = State.get()
    if (!event.storyChoice) {
      event.storyChoice = await chooseCruelGuardBranch(task, event)
      event.storyStage = 'task'
      task.event = event
      EventBus.emit('state:changed', state)
      State.save()
    }
    const branch = CRUEL_GUARD_BRANCHES[event.storyChoice] || CRUEL_GUARD_BRANCHES.endure
    if (event.storyStage !== 'complete') {
      await BattleUI.showTaskDialog({
        enemyName: '🛡️ 铁腕守卫与围观人群',
        attackName: branch.taskName,
        desc: branch.desc,
        bpm: branch.bpm,
        seconds: branch.seconds,
        dmg: branch.hpLoss,
        noDamage: branch.hpLoss <= 0,
        allowSkip: true,
        showFailure: false,
        completeLabel: '✅ 撑过这段惩戒',
        dialogClass: 'pillory-task-modal pillory-cruel-task',
        telemetry: { source: 'pillory_service', action: branch.action, part: branch.part, depth: 'none' },
      })
      event.storyStage = 'complete'
      task.event = event
      EventBus.emit('state:changed', state)
      State.save()
    }
    if (!event.consequencesApplied) {
      const beforeHp = state.hp
      state.hp = Math.max(1, state.hp - branch.hpLoss)
      const actualLoss = beforeHp - state.hp
      state._gloryWanted = Math.min(100, (state._gloryWanted || 0) + branch.wanted)
      event.bonus = branch.bonus
      event.consequencesApplied = true
      event.applied = true
      addPilloryResult(task, {
        icon: branch.icon,
        label: branch.name,
        detail: `${branch.seconds} 秒 · ${actualLoss ? `HP -${actualLoss} · ` : ''}危险 +${branch.wanted} · 额外 ${branch.bonus}G`,
        type: actualLoss ? 'danger' : 'dim',
      })
      EventBus.emit('ui:log', { text: `${branch.icon} ${branch.outcome}${actualLoss ? ` HP -${actualLoss}。` : ''} 危险值 +${branch.wanted}。`, type: actualLoss ? 'danger' : 'dim' })
      EventBus.emit('state:changed', state)
      State.save()
    }
  }

  async function runPilloryEvent (task) {
    const state = State.get()
    let event = task.event
    if (!event || event.applied) return
    const def = pilloryEventDef(event)
    if (def.story === 'cruel_guard') {
      await runCruelGuardStory(task, event)
      return
    }
    if (event.kind === 'ambient') {
      let detail = def.desc || '广场上发生了一阵小小骚动。'
      let type = def.type || 'dim'
      let icon = def.icon || '👥'
      if ((def.gold || 0) < 0) {
        const lost = Math.min(Math.abs(def.gold), Math.max(0, state.gold || 0))
        state.gold -= lost
        event.gold = -lost
        detail = lost > 0 ? `趁你无法动弹，身上的 ${lost}G 被摸走了。` : '小偷翻了半天，却发现你身上一枚金币都没有。'
        type = lost > 0 ? 'danger' : 'dim'
      } else if ((def.gold || 0) > 0) {
        event.gold = def.gold
        detail = task.source === 'voluntary'
          ? `铁碗里多了 ${def.gold}G，结算时一起交给你。`
          : task.source === 'mercenary'
            ? `铁碗里的 ${def.gold}G 会一并用于抵债。`
            : '围观者投下的金币被负责看守的卫兵收走了。'
      }
      event.applied = true
      addPilloryResult(task, { icon, label: def.name || '围观事件', detail, type })
      EventBus.emit('ui:log', { text: `${icon} 木枷事件「${def.name || '围观事件'}」：${detail}`, type })
      EventBus.emit('state:changed', state)
      State.save()
      return
    }
    if (event.part !== 'spank') {
      const route = routeTownService(event.part)
      if (route.mode === 'unavailable') event = { ...event, part: 'spank', bpm: 60, seconds: 30 }
      else event = { ...event, part: route.part }
      task.event = event
      State.save()
    }
    const names = { oral: '口部围观服务', anal: '后穴围观服务', vagina: '小穴围观服务', spank: '公开打屁股' }
    const descriptions = {
      oral: townServiceDesc('oral', '一名围观者'),
      anal: townServiceDesc('anal', '一名围观者'),
      vagina: townServiceDesc('vagina', '一名围观者'),
      spank: '三个可用部位都被装备挡住，围观者改为按节奏拍打你的屁股',
    }
    const eventName = event.part === def.part && def.name ? def.name : names[event.part]
    const style = def.style ? `，以${def.style}的方式，` : '，'
    const pose = pilloryPose(task.poseId)
    const exposure = task.poseId === 'classic'
      ? '你仍被木枷牢牢压着，无法躲开伸向身体的手。'
      : `你保持着「${pose.name}」的暴露姿势，既无法合拢身体，也无法回头看清身后的人。`
    EventBus.emit('ui:log', { text: `💋 木枷围观事件：${eventName}。`, type: 'danger' })
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      await BattleUI.showTaskDialog({
        enemyName: '👥 广场围观者',
        attackName: eventName,
        desc: `${exposure} ${descriptions[event.part]}${style}${event.bpm} BPM 持续 ${event.seconds} 秒。木枷每次晃动，周围都会响起一阵更近的笑声。`,
        bpm: event.bpm,
        seconds: event.seconds,
        dmg: 0,
        noDamage: true,
        allowSkip: true,
        showFailure: false,
        completeLabel: '✅ 确认事件完成',
        dialogClass: 'pillory-task-modal',
        telemetry: { source: 'pillory_service', action: event.part === 'spank' ? 'spanking' : event.part === 'oral' ? 'oral' : 'penetration', part: event.part === 'spank' ? 'body' : event.part, depth: event.part === 'spank' ? 'none' : 'medium' },
      })
    }
    // 公开成人服务视为无证经营风险；持证玩家不增加危险值。
    if (!state._prostituteLicensed && event.part !== 'spank') {
      state._gloryWanted = Math.min(100, (state._gloryWanted || 0) + 5)
      EventBus.emit('ui:log', { text: `🚨 广场成人服务被卫兵记下，无证危险值 +5（现 ${state._gloryWanted}%）。`, type: 'danger' })
    }
    event.applied = true
    task.event = event
    addPilloryResult(task, {
      icon: event.part === 'spank' ? '🍑' : '💋',
      label: eventName,
      detail: `${event.bpm} BPM · ${event.seconds} 秒${!state._prostituteLicensed && event.part !== 'spank' ? ' · 无证危险 +5' : ''}`,
      type: event.part === 'spank' ? 'dim' : 'danger',
    })
    EventBus.emit('state:changed', state)
    State.save()
  }

  function settlePillory (task) {
    const state = State.get()
    const pose = pilloryPose(task.poseId)
    const hadEvent = !!task.event
    const hadAdult = hadEvent && task.event.kind !== 'ambient'
    const adultBonus = (hadAdult && task.event.part !== 'spank'
      ? (task.event.part === 'oral' ? 10 : 15)
      : 0) + Math.max(0, Number(task.event && task.event.bonus) || 0)
    const ambientBonus = task.event && task.event.kind === 'ambient' ? Math.max(0, task.event.gold || 0) : 0
    let resultText = ''
    if (task.source === 'mercenary') {
      const requested = 40 + (hadAdult ? 10 : 0) + ambientBonus
      const result = typeof MercenaryContractSystem !== 'undefined'
        ? MercenaryContractSystem.repay(requested, '广场木枷契约', { external: true })
        : { ok: false, amount: 0 }
      resultText = result.ok ? `抵扣 ${result.amount}G 佣兵债务` : '木枷展示已经完成'
    } else if (task.source === 'fine') {
      resultText = '完成木枷处罚，抵销 100G 城门罚款'
      EventBus.emit('ui:log', { text: '🪵 你完成公开木枷处罚，卫兵勾掉了 100G 罚款。', type: 'good' })
    } else if (task.source === 'punishment') {
      state._gloryWanted = Math.max(0, (state._gloryWanted || 0) - 10)
      // 木枷已经替代本轮守卫盘查；清掉荣耀洞离场断点，避免回营地后再次判定抓捕。
      state._gloryJustCleared = false
      state._gloryByGuard = false
      state._gloryByCaptain = false
      resultText = `完成无证营业处罚 · 危险值降至 ${state._gloryWanted}`
      EventBus.emit('ui:log', { text: `🪵 你完成广场木枷处罚，危险值降至 ${state._gloryWanted}。`, type: 'good' })
    } else {
      const earned = Math.max(0, task.reward || 0) + adultBonus + ambientBonus
      state.gold += earned
      const extra = adultBonus + ambientBonus
      resultText = `获得 ${earned}G${extra ? `（含随机事件奖励 ${extra}G）` : ''}`
      EventBus.emit('ui:log', { text: `🪵 木枷展示完成，${resultText}。`, type: 'good' })
    }
    const resultRows = [
      { icon: pose.icon, label: pose.name, detail: `${task.duration} 秒 · 已完成`, type: 'good' },
      ...(Array.isArray(task.results) ? task.results : []),
    ]
    const eventSummary = !hadEvent
      ? '本轮没有触发随机事件。'
      : hadAdult
        ? `本轮触发了${task.event.part === 'spank' ? '公开打屁股' : '成人围观'}事件。`
        : '本轮触发了一项普通围观事件。'
    if (window.TownReputationSystem) TownReputationSystem.recordPillory()
    EventBus.emit('town:pilloryComplete', { seconds: task.duration, source: task.source })
    state._pillory = null
    EventBus.emit('state:changed', state)
    State.save()
    campShow({
      title: '🪵 木枷展示结束',
      className: 'camp-tavern-modal pillory-modal',
      body: `<section class="pillory-result"><i>✓</i><div><h3>${resultText}</h3><p>${eventSummary}${task.poseId === 'classic' ? '你重新活动发麻的手腕' : '木枷终于打开，你在围观目光中直起赤裸发麻的身体'}，走下广场台阶。</p></div></section>
        <div class="pillory-result-list">${resultRows.map(row => `<span class="is-${row.type || 'dim'}"><i>${row.icon}</i><b>${row.label}</b><small>${row.detail}</small></span>`).join('')}</div>`,
      actions: task.source === 'fine'
        ? [{ label: '离开城镇', cls: 'btn-primary', handler: doLeaveCamp }]
        : task.source === 'punishment'
          ? [{ kind: 'navigation', label: '返回营地', cls: 'btn-primary', handler: open }]
          : [
              { label: '再看看木枷', cls: 'btn-primary', handler: squarePillory },
              { kind: 'navigation', label: '返回营地', handler: open },
            ],
    })
  }


  return {
    open: squarePillory,
    resume: runPilloryFlow,
  }
})()

