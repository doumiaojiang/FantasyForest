/**
 * systems/camp-prison.js — 收监、牢房工作、惩罚、越狱与释放流程。
 */
window.TownPrisonSystem = (function () {
  const campShow = options => CampSystem.showScene(options)
  const open = opts => CampSystem.open(opts)

  function prisonTarget () {
    const base = { normal: 300, hard: 400, brutal: 500 }[State.get().difficulty] || 300
    return base + (State.get()._prisonEscapePenalty || 0)
  }

  /** 监狱任务固定使用嘴部：暂存封闭式口塞，开口口塞可继续佩戴。 */
  function preparePrisonMouth () {
    if (typeof RestraintSystem === 'undefined') return false
    const state = State.get()
    const mouth = RestraintSystem.get('mouth')
    const def = mouth && RestraintSystem.defOf(mouth.id)
    if (!mouth || !def || def.id === 'slut_gag') return false
    if (!state._prisonMouthPrev) state._prisonMouthPrev = { ...mouth }
    RestraintSystem.remove('mouth')
    EventBus.emit('ui:log', { text: `⛓️ 入狱检查时，守卫暂时取下并保管了${def.name}；释放或越狱后会归还。`, type: 'danger' })
    return true
  }

  function restorePrisonMouth () {
    if (typeof RestraintSystem === 'undefined') return false
    const state = State.get()
    const prev = state._prisonMouthPrev
    if (!prev) return false
    state._prisonMouthPrev = null
    if (RestraintSystem.get('mouth')) RestraintSystem.remove('mouth')
    RestraintSystem.restore('mouth', prev)
    const def = RestraintSystem.defOf(prev.id)
    EventBus.emit('ui:log', { text: `🔓 守卫归还了此前保管的${def ? def.name : '口部装备'}，原有锁定状态保持不变。`, type: 'dim' })
    return true
  }

  /** 收监时接管车队临时锁具；保留战前装备快照，释放或越狱时归还。 */
  function preparePrisonCaravanBindings (records) {
    if (typeof RestraintSystem === 'undefined') return false
    const state = State.get()
    const supplied = Array.isArray(records) ? records : []
    const custody = supplied.filter(binding => binding && binding.slot).map(binding => ({
      stage: Math.max(0, Math.min(3, Math.floor(Number(binding.stage) || 0))),
      slot: binding.slot,
      borrowed: !!binding.borrowed,
      original: binding.original ? { ...binding.original } : null,
    }))

    // 兼容已经走到收监页的旧档：至少移除仍标记为车队来源的临时锁具。
    if (!custody.length) {
      ;(RestraintSystem.SLOT_ORDER || []).forEach(slot => {
        const current = RestraintSystem.get(slot)
        if (current && current.source === 'p_caravan_guard') custody.push({ stage: 0, slot, borrowed: false, original: null })
      })
    }
    if (!custody.length) return false

    custody.forEach(binding => {
      const current = RestraintSystem.get(binding.slot)
      if (current && current.source === 'p_caravan_guard') RestraintSystem.restore(binding.slot, null)
    })
    state._prisonCaravanBindings = custody
    state._pDefeatCaravanBindings = null
    EventBus.emit('ui:log', { text: '🔐 收监检查解除并扣押了车队临时锁具；战前原装备将在离开监狱时归还。', type: 'dim' })
    return true
  }

  function restorePrisonCaravanBindings () {
    if (typeof RestraintSystem === 'undefined') return false
    const state = State.get()
    const records = Array.isArray(state._prisonCaravanBindings) ? state._prisonCaravanBindings : []
    state._prisonCaravanBindings = []
    if (!records.length) return false
    records.forEach(binding => {
      if (!binding || !binding.slot || !binding.borrowed || !binding.original) return
      RestraintSystem.restore(binding.slot, { ...binding.original })
    })
    EventBus.emit('ui:log', { text: '🔓 守卫归还了被车队封条覆盖前的原装备。', type: 'dim' })
    return true
  }

  /** 监狱大门（平时查看） */
  function prisonDoor () {
    const state = State.get()
    if (state._inPrison) { prisonWork(); return }
    campShow({
      title: '⛓️ 雾灯镇监牢', className: 'prison-modal prison-story-page-modal',
      body: `<div class="prison-narrative"><div class="prison-scene-mark" aria-hidden="true">⛓️</div>
        <p>营地尽头的石墙比别处潮湿。铁栏后没有灯，只有一束发黄的光从天窗落下，照着地上一排旧锁。</p>
        <p>里面传来铁链拖过石板的声音。有人在黑暗里咳了一声，随后又彻底安静下去。</p>
        <blockquote><b>守门人</b>“参观完了就走。等名字被写进那本册子，你就只能从里面看这扇门了。”</blockquote>
      </div>`,
      actions: [
        { kind: 'navigation', label: '离开这里', handler: () => { open() } },
      ],
    })
  }

  /** 被抓进监狱：无证卖淫的惩罚，需按难度攒积分出狱 */
  function enterPrison (options = {}) {
    const state = State.get()
    const wasInPrison = !!state._inPrison
    const charge = typeof options.charge === 'string' && options.charge.trim()
      ? options.charge.trim()
      : (state._prisonCharge || '无证营业')
    const prisonDevice = state.gender === 'male' ? '贞操锁' : '贞操带'
    const lockedPart = state.gender === 'male' ? '生殖器' : '小穴'
    state._inPrison = true
    state._prisonPoints = 0
    state._wanted = false   // 已被收监，不再通缉
    state._prisonCharge = charge
    state.phase = 'camp'
    if (!wasInPrison && window.TownReputationSystem) {
      TownReputationSystem.addScore(-3, `因${charge}被收监`)
      TownReputationSystem.addFame(3, '入狱消息传遍雾灯镇')
    }
    EventBus.emit('state:changed', state)
    // 监狱专用贞操带/贞操锁：小穴被锁死（作为装备 + 妖缚腰部槽剧情锁）
    state._prisonChastity = true
    if (typeof RestraintSystem !== 'undefined') {
      preparePrisonCaravanBindings(options.caravanBindings)
      // 记录入狱前的腰部装置（已是监狱锁则不记录），出狱时还原；监狱锁强制戴上
      const curWaist = RestraintSystem.get('waist')
      if (curWaist && curWaist.id !== 'prison_chastity' && !state._prisonWaistPrev) state._prisonWaistPrev = { ...curWaist }
      RestraintSystem.equip('waist', 'prison_chastity', { locked: true, lockType: 'story', difficulty: 5, source: 'prison' }, true)
      preparePrisonMouth()
    }
    if (!StatusSystem.has('chastity')) StatusSystem.apply('chastity', 99999)
    const target = prisonTarget()
    campShow({
      title: '⛓️ 收监', className: 'prison-modal prison-story-page-modal',
      body: `<div class="prison-narrative is-confined"><div class="prison-scene-mark" aria-hidden="true">🔒</div>
        <p>手腕上的车队锁具被收走时，铁门已经在身后合拢。守卫把你推到灯下，念出册子上的罪名：<b>${charge}</b>。</p>
        <p>冰冷的${prisonDevice}扣住你的${lockedPart}，钥匙则被扔进守卫腰间的皮袋。他在墙上划下第一道痕迹。</p>
        <blockquote><b>牢房守卫</b>“这面墙记满 <strong>${target}</strong> 道，门才会开。至于怎么记——里面的人会教你。”</blockquote>
      </div>`,
      actions: [
        { label: '走进集体牢房', cls: 'btn-danger', handler: () => { prisonWork() } },
      ],
    })
  }

  /** 牢房工作界面：罪名 + 狱友 + 自选任务类型后掷 Z；攒够积分可自行选择出狱 */
  function prisonWork () {
    const state = State.get()
    preparePrisonMouth()
    const prisonDevice = state.gender === 'male' ? '贞操锁' : '贞操带'
    const points = state._prisonPoints || 0
    const target = prisonTarget()
    const done = points >= target
    if (state._prisonLife) {
      campShow({
        title: '⛓️ 没有期限的清晨', className: 'prison-modal prison-story-page-modal',
        body: `<div class="prison-narrative is-confined"><div class="prison-scene-mark" aria-hidden="true">⛓️</div>
          <p>天窗又亮了一次。墙上的刻痕已经多到无法辨认，但守卫从来没有数过它们。</p>
          <p>被焊死的${prisonDevice}在起身时撞出一声轻响。狱友们避开你的视线，只有铁栏外那双靴子越来越近。</p>
          <blockquote><b>牢房守卫</b>“别看门。今天的活还没干。”</blockquote>
        </div>`,
        actions: [
          { label: '从地上爬起来', cls: 'btn-danger', handler: () => { Dialog.close(); prisonTierChoice() } },
        ],
      })
      return
    }
    const pct = Math.min(100, Math.round((points / target) * 100))
    campShow({
      title: done ? '⛓️ 铁门前' : '⛓️ 集体牢房', className: 'prison-modal prison-story-page-modal',
      body: `<div class="prison-narrative is-confined"><div class="prison-scene-mark" aria-hidden="true">${done ? '🔑' : '🧱'}</div>
        <p>${done ? '墙上最后一道刻痕已经划完。守卫站在铁门另一边，拇指勾着钥匙环，等你把记分木牌递过去。' : `牢房里挤着五个人。一个欠了酒钱，一个偷过面包；剩下的人什么也没说。他们看了一眼你身上的${prisonDevice}，便为你腾出了靠墙的位置。`}</p>
        <p>${done ? '牢房里没人催你。门是否在今天打开，由你决定。' : '铁栏外响起纸张翻动的声音。守卫把今天的名册卷起来，敲了敲栏杆。'}</p>
        <blockquote><b>${done ? '牢房守卫' : '年长的狱友'}</b>${done ? '“分数够了。想清楚再把木牌伸出来。”' : '“别问他要做多久。他只看墙上的刻痕。”'}</blockquote>
      </div>
      <div class="prison-ledger"><span>墙上的刻痕</span><b>${points} / ${target}</b><i aria-hidden="true"><em style="width:${pct}%"></em></i></div>
      <div class="prison-action-list">
        <button data-prison-action="${done ? 'release' : 'work'}"><span>${done ? '把记分木牌递出去' : '走到铁栏前，听今天的安排'}</span><small>${done ? '铁门后的钥匙已经备好' : '守卫会从你目前能承受的活里挑一件'}</small></button>
        ${done ? '<button data-prison-action="work"><span>把木牌收回来</span><small>暂时不离开，继续接下今天的安排</small></button>' : ''}
        <button class="is-danger" data-prison-action="escape"><span>趁换岗时观察牢门</span><small>西侧合页有些松，但守卫从不会走得太远</small></button>
      </div>`,
      actions: [],
    })
    document.querySelectorAll('[data-prison-action]').forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.prisonAction
        Dialog.close()
        if (action === 'release') prisonRelease()
        else if (action === 'escape') prisonEscapePrompt()
        else prisonTierChoice()
      }
    })
  }

  /** 先观察牢门，只在真正尝试前透出风险。 */
  function prisonEscapePrompt () {
    const collared = typeof RestraintSystem !== 'undefined' && RestraintSystem.hasCollar()
    const chance = collared ? 15 : 25
    campShow({
      title: '🪓 换岗的空隙', className: 'prison-modal prison-story-page-modal',
      body: `<div class="prison-narrative is-escape"><div class="prison-scene-mark" aria-hidden="true">🪓</div>
        <p>夜班守卫的脚步声从东边绕过去。你贴着墙蹲下，把一截磨尖的铁片送进西侧合页。铁锈簌簌落在掌心，声音比想象中更响。</p>
        <p>${collared ? '颈上的项圈让你无法完全贴地，每一次呼吸都会蹭过石墙。' : '再撬一下，合页也许会松；也许会惊动整条走廊。'}</p>
        <blockquote><b>黑暗里的声音</b>“现在收手，还能当作什么都没发生。”</blockquote>
      </div>
      <div class="prison-action-list">
        <button class="is-danger" data-prison-escape="go"><span>把铁片继续压下去</span><small>成功机会 ${chance}%；失败会丢掉已有刻痕，并加重刑期</small></button>
        <button data-prison-escape="back"><span>藏起铁片</span><small>回到墙边，等下一次机会</small></button>
      </div>`,
      actions: [],
    })
    document.querySelectorAll('[data-prison-escape]').forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.prisonEscape
        Dialog.close()
        action === 'go' ? prisonEscape() : prisonWork()
      }
    })
  }

  /** 越狱：25% 成功率（佩戴奴隶项圈 -10%）；失败累积惩罚，第 3 次永久监禁 */
  function prisonEscape () {
    const state = State.get()
    const threshold = 25 - (typeof RestraintSystem !== 'undefined' && RestraintSystem.hasCollar() ? 10 : 0)
    const roll = Math.floor(Math.random() * 100)
    if (roll < threshold) {
      // 成功越狱：出狱但贞操锁不解开，且成为通缉犯
      state._inPrison = false
      state._prisonPoints = 0
      state._prisonEscapeFails = 0
      state._prisonEscapePenalty = 0
      state._wanted = true   // 越狱 = 犯罪，出城会被卫兵查、找队长会被抓
      if (window.TownReputationSystem) {
        TownReputationSystem.addScore(-20, '从深喉监狱越狱')
        TownReputationSystem.addFame(15, '成为监狱通缉犯')
      }
      restorePrisonMouth()
      restorePrisonCaravanBindings()
      state._prisonCharge = null
      EventBus.emit('state:changed', state)
      Dialog.show({
        title: '🪓 越狱成功', className: 'prison-modal prison-story-page-modal',
        body: `<div class="prison-narrative is-escape"><div class="prison-scene-mark" aria-hidden="true">🪓</div>
          <p>合页在脚步声折返前松开了。你挤过牢门，沿着沟渠爬出高墙。</p>
          <p>但——那把<b>贞操锁</b>还牢牢锁在你身上，钥匙只有守卫有。<br>你带着锁逃出了监狱。</p>
          <p class="prison-guard">不过逃狱是重罪：你现在是<b>通缉犯</b>——出城会被卫兵查，去找守卫队队长也会被当场认出抓回去。</p></div>`,
        actions: [
          { label: '逃回营地', cls: 'btn-primary', handler: () => { Dialog.close(); open() } },
        ],
      })
      return
    }
    // 失败
    state._prisonEscapeFails = (state._prisonEscapeFails || 0) + 1
    const fail = state._prisonEscapeFails
    if (fail >= 3) {
      // 第 3 次：永久监禁（狱警嘲讽，仍被扔进进阶惩罚牢房）
      state._prisonLife = true
      state._prisonPoints = 0
      EventBus.emit('state:changed', state)
      Dialog.show({
        title: '⛓️ 越狱失败 · 永久监禁', className: 'prison-modal prison-story-page-modal',
        body: `<div class="prison-narrative is-escape"><div class="prison-scene-mark" aria-hidden="true">⛓️</div>
          <p>还没站稳，火把的光就从背后盖了过来。这是你第 <b>3</b> 次被拖回同一扇铁门。</p>
          <p class="prison-guard">“三顾茅庐？你倒挺执着。不过这回，连茅庐你都别想出了。”</p>
          <p>守卫把你按在地上，当众宣布：<b>永久监禁</b>。</p>
          <p>“你以为这里是你想来就来想走就走的？这辈子，你就烂在牢房里吧。”——然后把你扔进了<b>进阶惩罚牢房</b>。</p></div>`,
        actions: [
          { label: '被拖去受刑', cls: 'btn-danger', handler: () => { Dialog.close(); prisonAdvPunishment() } },
        ],
      })
      return
    }
    // 第 1/2 次失败：积分清零 + 惩罚，然后被扔进进阶惩罚牢房（狱警嘲讽）
    const penalty = fail === 1 ? 200 : 350
    state._prisonPoints = 0
    state._prisonEscapePenalty = (state._prisonEscapePenalty || 0) + penalty
    EventBus.emit('state:changed', state)
    const taunts = {
      1: {
        title: '⛓️ 越狱失败 · 第一次',
        line: '“哟，第一次就想越狱？天真。”',
        mark: '🪓',
      },
      2: {
        title: '⛓️ 越狱失败 · 第二次',
        line: '“又来了？上次的教训还没吃够？”',
        mark: '⛓️',
      },
    }
    const t = taunts[fail] || taunts[2]
    Dialog.show({
      title: t.title, className: 'prison-modal prison-story-page-modal',
      body: `<div class="prison-narrative is-escape"><div class="prison-scene-mark" aria-hidden="true">${t.mark}</div>
        <p>铁片在合页里折断了。守卫的火把照亮你的手，也照亮地上那堆还来不及藏起的铁锈。</p>
        <p class="prison-guard">${t.line}这牢房是你想进就进、想出就出的？行啊，带你去见个人——"</p>
        <p>你被拖进了<b>进阶惩罚牢房</b>。已攒积分全部清零，出狱所需积分 <b>+${penalty}</b>（现需 ${prisonTarget()}）。</p></div>`,
      actions: [
        { label: '被拖去受刑', cls: 'btn-danger', handler: () => { Dialog.close(); prisonAdvPunishment() } },
      ],
    })
  }

  /** 自选任务类型（基础/中级），再掷 Z；中级需积分 ≥80 解锁 */
  function prisonTierChoice () {
    const state = State.get()
    const points = state._prisonPoints || 0
    const target = prisonTarget()
    const midUnlocked = points >= 80
    const advUnlocked = points >= 300
    const pct = Math.min(100, Math.round((points / target) * 100))
    const ledgerHtml = state._prisonLife
      ? '<div class="prison-ledger is-life"><span>锁眼已被焊死</span><b>无期</b></div>'
      : `<div class="prison-ledger"><span>墙上的刻痕</span><b>${points} / ${target}</b><i aria-hidden="true"><em style="width:${pct}%"></em></i></div>`
    const midChoice = midUnlocked
      ? '<button data-tier="mid"><span>接过染着深色污迹的木牌</span><small>守卫把时间记得更长，刻痕也给得更多</small></button>'
      : ''
    const advChoice = advUnlocked
      ? '<button class="is-danger" data-tier="adv"><span>拿起被单独压在最下面的铁牌</span><small>守卫没有念上面的内容，只问你是否确定</small></button>'
      : ''
    campShow({
      title: '📋 守卫的名册', className: 'prison-modal prison-story-page-modal',
      body: `<div class="prison-narrative is-confined"><div class="prison-scene-mark" aria-hidden="true">📋</div>
        <p>守卫在栏外摆下几块木牌，字面朝下。他的指节在桌面上敲了三下，却没有告诉你每一块后面究竟写了什么。</p>
        <blockquote><b>牢房守卫</b>“挑一块。你在这里待得越久，我才会把更重的活放到桌上。”</blockquote>
      </div>
      ${ledgerHtml}
      <div class="prison-action-list">
        <button data-tier="basic"><span>抽出离他最近的木牌</span><small>上面的字迹潦草，看起来是常规差事</small></button>
        ${midChoice}
        ${advChoice}
      </div>`,
      actions: [
        { kind: 'navigation', label: '不拿，先回墙边', handler: () => { prisonWork() } },
      ],
    })
    document.querySelectorAll('[data-tier]').forEach(btn => {
      btn.onclick = () => {
        const tier = btn.dataset.tier
        Dialog.close()
        prisonRollTask(tier)
      }
    })
  }

  /** 掷骰决定任务（按所选类型；进阶任务掷 X） */
  async function prisonRollTask (tier) {
    const isAdv = tier === 'adv'
    const roll = isAdv ? Dice.rollZ() : Dice.rollZ()
    await Dialog.showDice(roll, isAdv ? 'X' : 'Z')
    const state = State.get()
    // 掷到 6 送惩罚牢房（基础/中级→矫正教育，进阶→最可畏守卫）
    if (roll === 6) {
      isAdv ? prisonAdvPunishment() : prisonPunishment()
      return
    }
    // 使用所选任务类型
    const table = tier === 'mid' ? PRISON_MID : tier === 'adv' ? PRISON_ADV : PRISON_BASIC
    const task = table[roll]
    if (!task) { prisonWork(); return }
    EventBus.emit('ui:log', { text: `⛓️ ${isAdv ? '守卫指定进阶任务' : '守卫指定任务'}：${task.desc}（${task.points} 积分）`, type: 'danger' })
    await prisonTaskTimer(task)
  }

  /** 监狱休息按钮：点击确认开始休息 */
  /** 监狱纯文字提示弹窗：无需计时/计数，看完点继续 */
  function prisonTextDialog (desc, enemyName) {
    return new Promise(resolve => {
      Dialog.show({
        title: '⛓️ ' + enemyName,
        className: 'camp-task-modal',
        body: `<div class="camp-task"><div class="camp-task-icon">🗣️</div><p>${desc}</p></div>`,
        actions: [
          { label: '继续', cls: 'btn-primary', handler: () => { Dialog.close(); resolve(false) } },
        ],
      })
    })
  }

  /** 监狱计数弹窗：数呕吐/干呕次数，达标自动完成 */
  function prisonCountDialog (desc, target, countDesc, enemyName, dildoName) {
    return new Promise(resolve => {
      let count = 0
      const render = () => {
        Dialog.show({
          title: '🗯️ 计数任务', className: 'camp-task-modal',
          body: `<div class="camp-task"><div class="camp-task-icon">🗯️</div><p>${desc}</p>
            <div style="text-align:center;margin:10px 0"><strong style="font-size:1.5rem;color:var(--danger)">${count}</strong><span style="color:var(--text-dim);font-size:.8rem"> / ${target}</span></div>
            <div class="camp-task-track"><i style="width:${Math.min(100, (count / target) * 100)}%"></i></div>
            <small>每${countDesc}一次点一下「再${countDesc}一次」，达到 ${target} 次自动完成。</small></div>`,
          actions: [
            { label: `🤮 再${countDesc}一次`, cls: 'btn-danger', handler: () => {
              count++
              if (count >= target) { Dialog.close(); resolve(false) }
              else render()
            } },
            { label: '🏃 中途放弃', handler: () => { Dialog.close(); resolve(true) } },
          ],
        })
      }
      render()
    })
  }

  /** 监狱暂停计时器：倒计时 + 暂停休息按钮（暂停5秒自动恢复，5秒CD） */
  function prisonPauseTimerDialog (desc, seconds, bpm, enemyName, pauseDuration) {
    pauseDuration = pauseDuration || 5
    return new Promise(resolve => {
      let left = seconds
      let paused = false
      let pauseLeft = 0
      let cdUntil = 0   // 冷却结束时间戳
      let timer = null
      let fail = false
      const cleanup = () => { if (timer) clearInterval(timer); timer = null }

      const render = () => {
        const el = document.getElementById('prison-pause-time')
        const fill = document.getElementById('prison-pause-fill')
        const btn = document.getElementById('prison-pause-btn')
        if (el) el.textContent = Math.max(0, left)
        if (fill) fill.style.width = `${Math.max(0, Math.min(100, (left / seconds) * 100))}%`
        if (btn) {
          const now = Date.now()
          if (paused) {
            btn.textContent = `⏸ 休息中（${Math.ceil(pauseLeft)}秒）`
            btn.disabled = true
          } else if (now < cdUntil) {
            btn.textContent = `⏸ 休息（冷却 ${Math.ceil((cdUntil - now) / 1000)}秒）`
            btn.disabled = true
          } else {
            btn.textContent = `⏸ 暂停休息（${pauseDuration}秒）`
            btn.disabled = false
          }
        }
      }

      const tick = () => {
        if (paused) {
          pauseLeft -= 1
          if (pauseLeft <= 0) {
            paused = false
            EventBus.emit('ui:log', { text: '⏸ 休息结束，计时自动恢复！', type: 'dim' })
          }
          render()
          return
        }
        left -= 1
        render()
        if (left <= 0) {
          cleanup()
          Dialog.close()
          resolve(false)
        }
      }

      Dialog.show({
        title: `⏱ ${enemyName} · ${desc}`,
        className: 'camp-task-modal',
        body: `<div class="camp-task"><div class="camp-task-icon">⏱</div><p>${desc}</p><strong id="prison-pause-time" aria-live="polite">${seconds}</strong><span>秒</span><div class="camp-task-track"><i id="prison-pause-fill"></i></div><small>点「暂停休息」可暂停计时 ${pauseDuration} 秒，自动恢复；有 ${pauseDuration} 秒冷却。</small>
          <div style="margin-top:10px"><button class="btn" id="prison-pause-btn" style="width:100%">⏸ 暂停休息（${pauseDuration}秒）</button></div></div>`,
        actions: [
          { label: '🏃 放弃任务', cls: 'btn-danger', handler: () => { cleanup(); Dialog.close(); resolve(true) } },
        ],
      })
      const pauseBtn = document.getElementById('prison-pause-btn')
      if (pauseBtn) {
        pauseBtn.onclick = () => {
          const now = Date.now()
          if (paused || now < cdUntil) return
          paused = true
          pauseLeft = pauseDuration
          cdUntil = now + (pauseDuration * 2000)   // 暂停后冷却 = 暂停时长 × 2
          EventBus.emit('ui:log', { text: `⏸ 你暂停休息 ${pauseDuration} 秒……`, type: 'dim' })
          render()
        }
      }
      timer = setInterval(tick, 1000)
    })
  }

  function prisonRestButton (restSeconds) {
    return new Promise(resolve => {
      let count = restSeconds
      Dialog.show({
        title: '💤 休息时间',
        body: `<p style="color:var(--text-dim);font-size:.82rem;text-align:center">守卫允许你休息 <b>${restSeconds} 秒</b>再继续。</p>
          <div style="text-align:center;margin:10px 0"><strong id="prison-rest-count" style="font-size:1.6rem;color:var(--accent-bright)">${count}</strong></div>
          <p style="color:var(--text-dim);font-size:.7rem;text-align:center">读完自动开始下一段。</p>`,
        actions: [
          { label: '▶ 开始休息', cls: 'btn-primary', handler: () => {
            const layer = document.getElementById('modal-layer')
            if (layer) layer.querySelectorAll('[data-action]').forEach(b => b.style.display = 'none')
            EventBus.emit('ui:log', { text: `💤 你休息 ${restSeconds} 秒……`, type: 'dim' })
            const timer = setInterval(() => {
              count--
              const el = document.getElementById('prison-rest-count')
              if (el) el.textContent = count
              if (count <= 0) {
                clearInterval(timer)
                Dialog.close()
                resolve()
              }
            }, 1000)
          } },
        ],
      })
    })
  }

  /** 执行监狱任务计时（支持分段 steps + restAfter 休息按钮） */
  async function prisonTaskTimer (task) {
    const state = State.get()
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      // 构造步骤列表：steps 数组，或 holdSeconds/repeat 循环，或单段
      let steps = []
      if (Array.isArray(task.steps)) {
        steps = task.steps
      } else if (task.holdSeconds && task.repeat) {
        for (let i = 0; i < task.repeat; i++) {
          steps.push({ desc: task.phaseDesc || task.desc, bpm: task.bpm || 0, seconds: task.holdSeconds, restAfter: task.restSeconds > 0 && i < task.repeat - 1 })
        }
      } else {
        steps = [{ desc: task.desc, bpm: task.bpm || 0, seconds: task.seconds || 0, countTarget: task.countTarget || 0, countDesc: task.countDesc }]
      }
      for (let i = 0; i < steps.length; i++) {
        if (failed) break
        const step = steps[i]
        let f
        if (step.textOnly) {
          f = await prisonTextDialog(step.desc, '⛓️ 监狱守卫')
        } else if (step.pauseTimer) {
          f = await prisonPauseTimerDialog(step.desc, step.pauseSeconds || 90, step.bpm || 0, '⛓️ 监狱守卫', step.pauseLimit || 5)
        } else if (step.countTarget) {
          f = await prisonCountDialog(step.desc, step.countTarget, step.countDesc || '干呕', '⛓️ 监狱守卫', '守卫的粗鸡巴')
        } else {
          f = await BattleUI.showTaskDialog({
            enemyName: steps.length > 1 ? `⛓️ 监狱守卫（第 ${i + 1}/${steps.length} 段）` : '⛓️ 监狱守卫',
            attackName: task.name,
            desc: step.desc,
            bpm: step.bpm || 0,
            seconds: step.seconds || 0,
            dmg: 0,
            noDamage: true,
            dildoName: '守卫的粗鸡巴',
          })
        }
        if (f) { failed = true; break }
        if (step.restAfter) {
          await prisonRestButton(5)
        }
      }
      if (failed) {
        EventBus.emit('ui:log', { text: '⛓️ 你干呕着停下，守卫冷眼瞪着你，没加积分。', type: 'danger' })
        EventBus.emit('state:changed', state)
        prisonWork(); return
      }
    } else {
      failed = !confirm(`完成监狱任务：${task.desc}`)
      if (failed) {
        EventBus.emit('ui:log', { text: '⛓️ 你干呕着停下，守卫冷眼瞪着你，没加积分。', type: 'danger' })
        EventBus.emit('state:changed', state)
        prisonWork(); return
      }
    }
    state._prisonPoints = Math.min(prisonTarget(), (state._prisonPoints || 0) + task.points)
    EventBus.emit('ui:log', { text: `⛓️ 你卖力服务，获得 ${task.points} 积分（现 ${state._prisonPoints}/${prisonTarget()}）。`, type: 'good' })
    EventBus.emit('state:changed', state)
    prisonWork()
  }

  /** 出狱 */
  function prisonRelease () {
    const state = State.get()
    const charge = state._prisonCharge || '无证营业'
    const prisonDevice = state.gender === 'male' ? '贞操锁' : '贞操带'
    const completedTarget = prisonTarget()
    state._inPrison = false
    state._prisonPoints = 0
    state._prisonEscapeFails = 0
    state._prisonEscapePenalty = 0
    state._prisonChastity = false   // 正常出狱：解锁监狱贞操装备
    if (window.TownReputationSystem) {
      if (state._townReputation && state._townReputation.counters) state._townReputation.counters.prisonReleases = (state._townReputation.counters.prisonReleases || 0) + 1
      TownReputationSystem.addScore(5, '服满刑期并正常获释')
    }
    if (typeof RestraintSystem !== 'undefined') {
      const prev = state._prisonWaistPrev
      state._prisonWaistPrev = null
      if (prev) RestraintSystem.restore('waist', prev)   // 还原入狱前的腰部装置
      else if (RestraintSystem.get('waist') && RestraintSystem.get('waist').id === 'prison_chastity') RestraintSystem.remove('waist')
      restorePrisonMouth()
      restorePrisonCaravanBindings()
    }
    state._prisonCharge = null
    if (StatusSystem.has('chastity')) StatusSystem.remove('chastity')
    EventBus.emit('state:changed', state)
    campShow({
      title: '⛓️ 监狱 · 释放', className: 'prison-modal prison-story-page-modal',
      body: `<div class="prison-narrative"><div class="prison-scene-mark" aria-hidden="true">🔓</div>
        <p>你终于攒够了 <b>${completedTarget} 积分</b>，守卫解开了你的${prisonDevice}。</p>
        <p>“出去吧。下次再犯${charge}，可就不是蹲几天这么简单了。”</p>
        <p>你拖着酸软的膝盖爬出牢房，重见天日。</p></div>`,
      actions: [
        { kind: 'navigation', label: '回到营地', cls: 'btn-primary', handler: () => { open() } },
      ],
    })
  }

  /** 基础任务表（点数 <80）：掷 Z 决定 */
  const PRISON_BASIC = {
    1: { name: '深喉', desc: '深喉 25 次，每次都吞到底', points: 2, textOnly: true },
    2: { name: '深喉保持', desc: '保持深喉 15 秒，鸡巴顶在嗓子眼里不许动', points: 4, seconds: 15 },
    3: { name: '深喉连击', desc: '深喉 50 次，节奏稳定', points: 7, textOnly: true },
    4: { name: '喉穴抽插', desc: '以 60 BPM 的速度抽插你的喉穴 30 秒', points: 7, bpm: 60, seconds: 30 },
    5: { name: '深喉不干呕', desc: '深喉 10 次，全程忍住不许干呕', points: 16, textOnly: true },
  }

  /** 中级任务表（点数 ≥80）：掷 Z 决定 */
  const PRISON_MID = {
    1: { name: '深喉百次', desc: '深喉 100 次，喉咙被操到发麻', points: 15, textOnly: true },
    2: { name: '深喉舔蛋', desc: '保持深喉 15 秒，期间舔舐蛋蛋，重复 1 次', points: 17, holdSeconds: 15, repeat: 1, phaseDesc: '保持深喉 15 秒，期间舔舐蛋蛋', restSeconds: 0 },
    3: { name: '喉穴猛操', desc: '以 90 BPM 的速度操你的喉穴 90 秒（可暂停休息呼吸，每次不超过 10 秒）', points: 20, bpm: 90, pauseTimer: true, pauseSeconds: 90, pauseLimit: 10 },
    4: { name: '干呕两次', desc: '操你喉穴直到你干呕 2 次', points: 24, countTarget: 2, countDesc: '干呕' },
    5: { name: '操到呕吐', desc: '多喝水，操你的喉穴直到你呕吐', points: 27, textOnly: true },
  }

  /** 进阶任务表（积分 ≥300）：掷 X 决定 */
  const PRISON_ADV = {
    1: { name: '深喉三分钟', desc: '在 3 分钟内深喉 150 次，节奏紧凑不停歇', points: 25, seconds: 180 },
    2: { name: '深喉循环', desc: '深喉保持 15 秒，休息 5 秒，重复 3 次', points: 27, holdSeconds: 15, restSeconds: 5, repeat: 3, phaseDesc: '深喉保持 15 秒', restDesc: '休息 5 秒' },
    3: { name: '深喉猛操', desc: '深喉 120 BPM 直到你干呕 5 次，然后以 120 BPM 操你的喉穴 90 秒（可暂停休息，每次 5 秒，有 5 秒冷却）', points: 30, bpm: 120, steps: [
      { desc: '深喉 120 BPM 直到你干呕 5 次', countTarget: 5, countDesc: '干呕' },
      { desc: '以 120 BPM 操你的喉穴 90 秒', bpm: 120, pauseTimer: true, pauseSeconds: 90 },
    ] },
    4: { name: '喉咙旋转', desc: '按顺序：假阳具在喉咙中旋转 360 度 5 次；操喉穴直到干呕 5 次；深喉 3 次，每次保持 30 秒', points: 34, steps: [
      { desc: '将假阳具在喉咙中旋转 360 度 5 次', countTarget: 5, countDesc: '旋转', restAfter: true },
      { desc: '操你的喉穴直到干呕 5 次', countTarget: 5, countDesc: '干呕', restAfter: true },
      { desc: '深喉 3 次，每次保持 30 秒', bpm: 0, seconds: 90 },
    ] },
    5: { name: '极限深喉', desc: '操你喉咙 150 下尽可能快，然后喝很多水，操喉咙直到呕吐 3 次', points: 40, steps: [
      { desc: '操你喉咙 150 下，尽可能快', textOnly: true },
      { desc: '喝很多水', textOnly: true },
      { desc: '操你的喉咙直到呕吐 3 次', countTarget: 3, countDesc: '呕吐' },
    ] },
  }

  /** 惩罚牢房：狱警主管/矫正专家再教育（掷 Z 随机决定，只有 Z=1/4/6 才释放） */
  function prisonPunishment () {
    const state = State.get()
    const points = state._prisonPoints || 0
    const tier = points < 80 ? 'basic' : 'mid'
    const showPunish = () => {
      campShow({
        title: '⛓️ 惩罚牢房 · 矫正教育', className: 'prison-punish-modal prison-story-page-modal',
        body: `<div class="prison-narrative is-confined"><div class="prison-scene-mark" aria-hidden="true">🎓</div>
          <p>狱警主管认为你的<b>服务态度不够好</b>，将你送进了惩罚室。</p>
          <p>在这里，<b>矫正教育专家</b>将对你进行再教育。她无意将你从这个牢房中释放出来，直到你完全反思自己的行为。</p>
          <p class="prison-guard">"选一个赎罪的方式吧，小婊子。"</p></div>`,
        actions: [
          { label: '🎲 掷 Z 决定赎罪方式', cls: 'btn-danger', handler: () => { Dialog.close(); prisonPunishRoll() } },
        ],
      })
    }
    const prisonPunishRoll = async () => {
      const z = Dice.rollZ()
      await Dialog.showDice(z, 'Z')
      // 释放规则：基础 1/4/6 释放，中级 1/4 释放
      if (z === 1 || z === 4 || (tier === 'basic' && z === 6)) {
        EventBus.emit('ui:log', { text: `🎲 Z=${z}：矫正专家网开一面，放你回牢房。`, type: 'good' })
        prisonWork()
        return
      }
      // 赎罪任务
      const tasks = tier === 'basic'
        ? {
            2: { name: '深喉 50 下', desc: '深喉 50 下', points: 8, textOnly: true },
            3: { name: '保持深喉 15 秒', desc: '保持深喉 15 秒', points: 6, seconds: 15 },
            5: { name: '干呕两次', desc: '深喉直到你干呕 2 次', points: 10, countTarget: 2, countDesc: '干呕' },
          }
        : {
            2: { name: '深喉 100 下', desc: '深喉 100 下', points: 15, textOnly: true },
            3: { name: '保持深喉 30 秒', desc: '保持深喉 30 秒', points: 18, seconds: 30 },
            5: { name: '干呕十次', desc: '深喉直到你干呕 10 次', points: 24, countTarget: 10, countDesc: '干呕' },
            6: { name: '操到呕吐', desc: '多喝水，操你的喉穴直到你呕吐', points: 20, textOnly: true },
          }
      const task = tasks[z]
      if (!task) { prisonWork(); return }
      EventBus.emit('ui:log', { text: `🎲 Z=${z}：矫正专家指定赎罪任务：${task.desc}`, type: 'danger' })
      await doPunishTask(task)
    }
    const doPunishTask = async (task) => {
      let failed = false
      if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
        if (task.countTarget) {
          failed = await prisonCountDialog(task.desc, task.countTarget, task.countDesc || '干呕', '🎓 矫正教育专家', '矫正专家的鸡巴')
        } else {
          const f = await BattleUI.showTaskDialog({
            enemyName: '🎓 矫正教育专家',
            attackName: task.name,
            desc: task.desc,
            bpm: 0,
            seconds: task.seconds || 0,
            dmg: 0,
            noDamage: true,
            dildoName: '矫正专家的鸡巴',
          })
          failed = f
        }
      } else {
        failed = !confirm(`完成惩罚任务：${task.desc}`)
      }
      if (failed) {
        EventBus.emit('ui:log', { text: '🎓 你干呕着认错，但专家还不满意——继续赎罪。', type: 'danger' })
        EventBus.emit('state:changed', state)
        prisonPunishment(); return
      }
      EventBus.emit('ui:log', { text: '🎓 你完成再教育，但惩罚牢房不给积分。', type: 'dim' })
      EventBus.emit('state:changed', state)
      prisonPunishment()
    }
    showPunish()
  }

  /** 进阶惩罚牢房：最令人畏惧的守卫，纯虐待（掷 Z，1/4/6 才释放） */
  function prisonAdvPunishment () {
    const state = State.get()
    const showPunish = () => {
      campShow({
        title: '⛓️ 进阶惩罚牢房 · 纯虐待', className: 'prison-punish-modal prison-story-page-modal',
        body: `<div class="prison-narrative is-confined"><div class="prison-scene-mark" aria-hidden="true">👿</div>
          <p>有一个守卫在囚犯中最令人畏惧。她施加的既不是矫正教育也不是惩罚，而是<b>纯粹的虐待</b>。</p>
          <p class="prison-guard">"来了就别想轻易走。掷骰吧，废物。"</p></div>`,
        actions: [
          { label: '🎲 掷 Z 决定', cls: 'btn-danger', handler: () => { Dialog.close(); prisonAdvPunishRoll() } },
        ],
      })
    }
    const prisonAdvPunishRoll = async () => {
      const z = Dice.rollZ()
      await Dialog.showDice(z, 'Z')
      // 只有 Z=1 才释放
      if (z === 1) {
        EventBus.emit('ui:log', { text: `🎲 Z=${z}：最可畏的守卫狞笑一声，放你回牢房。`, type: 'good' })
        prisonWork()
        return
      }
      const tasks = {
        2: { name: '深喉 300 下', desc: '深喉 300 下，喉咙几乎报废', points: 20, textOnly: true },
        3: { name: '深喉循环', desc: '深喉保持 30 秒，休息 5 秒，重复 3 次', points: 22, holdSeconds: 30, restSeconds: 5, repeat: 3, phaseDesc: '深喉保持 30 秒', restDesc: '休息 5 秒' },
        4: { name: '喉咙旋转', desc: '将假阳具在喉咙中旋转 360 度 10 次', points: 26, countTarget: 10, countDesc: '旋转' },
        5: { name: '深喉干呕十次', desc: '深喉直到你干呕 10 次', points: 30, countTarget: 10, countDesc: '干呕' },
        6: { name: '操到呕吐两次', desc: '多喝水，操你的喉穴直到你呕吐 2 次', points: 34, countTarget: 2, countDesc: '呕吐' },
      }
      const task = tasks[z]
      if (!task) { prisonWork(); return }
      EventBus.emit('ui:log', { text: `🎲 Z=${z}：守卫指定虐待任务：${task.desc}`, type: 'danger' })
      await doAdvPunishTask(task)
    }
    const doAdvPunishTask = async (task) => {
      let failed = false
      if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
        let steps = []
        if (Array.isArray(task.steps)) {
          steps = task.steps
        } else if (task.holdSeconds && task.repeat) {
          for (let i = 0; i < task.repeat; i++) {
            steps.push({ desc: task.phaseDesc || task.desc, bpm: 0, seconds: task.holdSeconds, restAfter: task.restSeconds > 0 && i < task.repeat - 1 })
          }
        } else {
          steps = [{ desc: task.desc, bpm: 120, seconds: task.seconds || 0, countTarget: task.countTarget || 0, countDesc: task.countDesc, textOnly: !!task.textOnly }]
        }
        for (let i = 0; i < steps.length; i++) {
          if (failed) break
          const step = steps[i]
          let f
          if (step.textOnly) {
            f = await prisonTextDialog(step.desc, '👿 最可畏的守卫')
          } else if (step.pauseTimer) {
            f = await prisonPauseTimerDialog(step.desc, step.pauseSeconds || 90, step.bpm || 120, '👿 最可畏的守卫', step.pauseLimit || 5)
          } else if (step.countTarget) {
            f = await prisonCountDialog(step.desc, step.countTarget, step.countDesc || '干呕', '👿 最可畏的守卫', '守卫那根粗壮的鸡巴')
          } else {
            f = await BattleUI.showTaskDialog({
              enemyName: steps.length > 1 ? `👿 最可畏的守卫（第 ${i + 1}/${steps.length} 段）` : '👿 最可畏的守卫',
              attackName: task.name,
              desc: step.desc,
              bpm: step.bpm || 120,
              seconds: step.seconds || 0,
              dmg: 0,
              noDamage: true,
              dildoName: '守卫那根粗壮的鸡巴',
            })
          }
          if (f) { failed = true; break }
          if (step.restAfter) {
            await prisonRestButton(5)
          }
        }
      } else {
        failed = !confirm(`完成虐待任务：${task.desc}`)
      }
      if (failed) {
        EventBus.emit('ui:log', { text: '👿 你干呕着求饶，守卫却更兴奋了——继续受刑。', type: 'danger' })
        EventBus.emit('state:changed', state)
        prisonAdvPunishment(); return
      }
      EventBus.emit('ui:log', { text: '👿 你熬过虐待，但惩罚牢房不给积分。守卫仍不打算放你走，继续受刑。', type: 'dim' })
      EventBus.emit('state:changed', state)
      prisonAdvPunishment()
    }
    showPunish()
  }

  /** 离开荣耀洞时的实际抓捕率：20 点安全线，之后每 2 点 +1%，最高 40%。 */

  return {
    open: prisonDoor,
    enter: enterPrison,
    resume: prisonWork,
  }
})()
