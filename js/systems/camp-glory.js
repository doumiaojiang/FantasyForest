/**
 * systems/camp-glory.js — 公共厕所、荣耀洞、服务任务、欠债与离场检查。
 */
window.TownGlorySystem = (function () {
  const GLORY_FEE = CampSystem.gloryFee
  const campShow = options => CampSystem.showScene(options)
  const open = opts => CampSystem.open(opts)
  const setCampPhase = () => CampSystem.ensurePhase()

  function getStatus () {
    const state = State.get()
    const debt = Math.max(0, Number(state && state._gloryDebt) || 0)
    const freeService = !!(state && state._gloryFreeService)
    return {
      debt,
      freeService,
      forced: debt > 0 || freeService,
      source: state && state._gloryByCaptain ? 'captain' : state && state._gloryByGuard ? 'guard' : null,
      justCleared: !!(state && state._gloryJustCleared),
      gearBlocked: !!(state && (debt > 0 || freeService) && lockedServiceGear().length > 0),
    }
  }

  /** 外部系统只能通过此入口增加厕所欠债，避免漏写来源、日志或存档。 */
  function addDebt (options = {}) {
    const state = State.get()
    const amount = Math.max(0, Math.floor(Number(options.amount) || 0))
    const fee = options.includeEntryFee ? GLORY_FEE : 0
    const added = amount + fee
    state._gloryDebt = Math.max(0, Number(state._gloryDebt) || 0) + added
    if (options.source === 'captain') state._gloryByCaptain = true
    else if (['guard', 'manager', 'prologue'].includes(options.source)) state._gloryByGuard = true
    const reason = typeof options.reason === 'string' && options.reason.trim() ? options.reason.trim() : '强制罚款'
    EventBus.emit('ui:log', { text: `🚻 ${reason}：新增厕所欠债 ${added}G${fee ? `（含 ${fee}G 入场费）` : ''}，当前共欠 ${state._gloryDebt}G。`, type: 'danger' })
    EventBus.emit('state:changed', state)
    State.save()
    if (options.openWork) {
      Dialog.close()
      showGloryWork()
    }
    return state._gloryDebt
  }

  function hasForcedWork () {
    return getStatus().forced
  }

  function resumeForcedWork (options = {}) {
    const status = getStatus()
    if (!status.forced) return false
    if (options.deferWhenBlocked && status.gearBlocked) return false
    showGloryWork()
    return true
  }

  function clearEnforcementSource () {
    const state = State.get()
    state._gloryJustCleared = false
    state._gloryByGuard = false
    state._gloryByCaptain = false
    EventBus.emit('state:changed', state)
    State.save()
  }

  const SERVICE_SECONDS = 30
  const ORAL_SERVICES = [
    { id: 'lick', icon: '👄', name: '舔舐阴茎', pay: 2, desc: '用湿滑的舌头上下舔弄粗硬的阴茎' },
    { id: 'balls', icon: '👄', name: '舔舐蛋蛋', pay: 3, desc: '含住蛋蛋细细舔弄，让客人双腿发软' },
    { id: 'tip', icon: '👄', name: '舔舐龟头', pay: 4, desc: '专攻敏感的龟头，吸得客人直抽气' },
    { id: 'oral', icon: '👄', name: '完整口交', pay: 5, desc: '整根含进嘴里吞吐，卖力地吸吮' },
    { id: 'deep', icon: '👄', name: '深喉', pay: 7, desc: '深喉至少保持 5 秒，顶到嗓子眼' },
    { id: 'mouth', icon: '👄', name: '操嘴穴', pay: 10, desc: '把嘴当成穴任由阴茎操弄' },
  ]
  const ANAL_SERVICES = [
    { id: 'head', icon: '🍑', name: '只入龟头', pay: 6, desc: '只让龟头挤进后穴，一寸一寸试探' },
    { id: 'slow', icon: '🍑', name: '慢速抽插', pay: 10, desc: '假阳具缓缓进出，磨得你难耐' },
    { id: 'medium', icon: '🍑', name: '中速抽插', pay: 12, desc: '节奏加快，假阳具顶弄后穴深处' },
    { id: 'fast', icon: '🍑', name: '快速抽插', pay: 15, desc: '狂风暴雨般猛操你的后穴' },
    { id: 'hard', icon: '🍑', name: '全力操干', pay: 20, desc: '屁股贴墙被狠狠操干，最后浇进滚烫的润滑液' },
  ]
  const VAGINA_SERVICES = [
    { id: 'vhead', icon: '🌸', name: '只入龟头', pay: 6, desc: '只让龟头挤进小穴，一寸一寸试探' },
    { id: 'vslow', icon: '🌸', name: '慢速抽插', pay: 10, desc: '假阳具缓缓进出小穴，磨得你难耐' },
    { id: 'vmedium', icon: '🌸', name: '中速抽插', pay: 12, desc: '节奏加快，假阳具顶弄小穴深处' },
    { id: 'vfast', icon: '🌸', name: '快速抽插', pay: 15, desc: '狂风暴雨般猛操你的小穴' },
    { id: 'vhard', icon: '🌸', name: '全力操干', pay: 20, desc: '双腿大开被狠狠操干，最后浇进滚烫的精液' },
  ]
  /** 荣耀洞足交服务池：固定 60 秒，随机等概率抽取 */
  const FOOT_SERVICES = [
    { id: 'foot_60', icon: '🦶', name: '缓慢足交', bpm: 60, seconds: 60, pay: 8 },
    { id: 'foot_90', icon: '🦶', name: '标准足交', bpm: 90, seconds: 60, pay: 11 },
    { id: 'foot_120', icon: '👠', name: '快速足交', bpm: 120, seconds: 60, pay: 14 },
    { id: 'foot_150', icon: '👠', name: '激烈足交', bpm: 150, seconds: 60, pay: 17 },
    { id: 'foot_180', icon: '🔥', name: '极限足交', bpm: 180, seconds: 60, pay: 20 },
  ]
  /** 高跟鞋足交加成（仅检查脚部槽实际穿戴，未穿戴不生效；不含芭蕾舞高跟鞋） */
  const HEEL_BONUSES = {
    heels: { pay: 2, insideChance: 25 },
    heels_10: { pay: 3, insideChance: 35 },
    heels_12: { pay: 5, insideChance: 45 },
    heels_14: { pay: 7, insideChance: 60 },
  }

  function gloryHole () {
    const state = State.get()
    setCampPhase()
    if (showServiceGearLockout('荣耀洞', renderToilet)) return
    // 有未完成的强制流程（欠债/免费追加）直接回服务单
    if ((state._gloryDebt || 0) > 0 || state._gloryFreeService) { showGloryWork(); return }
    renderToilet()
  }

  function lockedServiceGear () {
    return typeof RestraintSystem !== 'undefined' ? RestraintSystem.lockedServiceDevices() : []
  }

  function serviceGearNames (entries) {
    return entries.map(entry => `${RestraintSystem.SLOT_NAMES[entry.slot]}的${entry.def.name}`).join('、')
  }

  /** 城镇服务只处理上锁造成的部位占用，不消耗战斗用防护充能。 */
  function routeTownService (requestedPart) {
    const result = typeof RestraintSystem !== 'undefined' && RestraintSystem.resolveServiceOrifice
      ? RestraintSystem.resolveServiceOrifice(requestedPart)
      : { mode: 'original', part: requestedPart, events: [] }
    ;(result.events || []).forEach(text => EventBus.emit('ui:log', { text, type: result.mode === 'unavailable' ? 'danger' : 'dim' }))
    return result
  }

  function townServiceDesc (part, actor) {
    if (part === 'oral') return `${actor}把你按跪在身前，粗暴地操弄你的嘴穴`
    if (part === 'vagina') return `${actor}把你压住，抬起你的腿，狠狠操进你的小穴`
    return `${actor}把你按住，从背后狠狠操进你的菊穴`
  }

  function townServicePartLocked (part) {
    const state = State.get()
    if (part === 'vagina' && (state.gender === 'male' || ChastitySystem.isWorn())) return true
    // 服务逻辑使用 oral，妖缚装备槽使用 mouth；统一后再判断，
    // 避免上锁的球形/深喉口塞仍能被佣兵服务选中。
    const slot = part === 'oral' ? 'mouth' : part
    return lockedServiceGear().some(entry => entry.slot === slot)
  }

  /** 上锁的口部/插入装备会同时阻止酒馆妓女和荣耀洞服务。 */
  function showServiceGearLockout (venue, backHandler) {
    const blocked = lockedServiceGear()
    if (!blocked.length) return false
    campShow({
      title: `🔒 ${venue}拒绝服务`, className: 'tavern-work-modal',
      body: `<section class="work-wardrobe"><span>🚫</span><div><small>${venue} · 装备检查</small><h3>上锁的口部或插入装备不能带去接客</h3><p><b>${serviceGearNames(blocked)}</b>仍处于上锁状态。先解开装备，才能继续服务。</p></div></section>
        <div class="work-rule">球形口塞、深喉口塞，以及肛塞、假阳具、跳蛋或震动棒只要上锁，就会同时禁止酒馆妓女和荣耀洞；开口口塞不受此限制。</div>`,
      actions: [
        { label: '⛓️ 整理妖缚装备', cls: 'btn-primary', handler: () => { Dialog.close(); RestraintSystem.openManage() } },
        { kind: 'navigation', label: venue === '荣耀洞' ? '返回厕所' : '返回打工', handler: () => { Dialog.close(); backHandler() } },
      ],
    })
    return true
  }

  /** 厕所主界面：普通厕所 + 调查隔间 + 荣耀洞（调查后解锁） */
  function renderToilet () {
    const state = State.get()
    const discovered = !!state._gloryDiscovered
    campShow({
      title: '🚻 营地公共厕所', className: 'toilet-modal',
      body: `
        <section class="toilet-scene">
          <div class="toilet-sign" aria-hidden="true"><span>🚻</span></div>
          <div><h3>灯管滋滋作响，最里面似乎不太对劲。</h3><p>空气里混着消毒水和潮湿木头的味道。</p></div>
        </section>
        <div class="toilet-grid">
          <button class="toilet-card toilet-card-safe ${state._toiletUsed ? 'is-used' : ''}" data-toilet="use"><i>🚽</i><span><b>普通隔间</b><small>${state._toiletUsed ? '今天已经上过了' : '门锁完好 · 免费使用'}</small></span><em>${state._toiletUsed ? '已使用' : '使用'}</em></button>
          <button class="toilet-card toilet-card-secret ${discovered ? 'is-discovered' : ''}" data-toilet="secret"><i>${discovered ? '🍑' : '🔍'}</i><span><b>${discovered ? '隐藏荣耀洞' : '最里面的隔间'}</b><small>${discovered ? '入口已经被你发现' : '门缝里传来压低的喘息'}</small></span><em>${discovered ? '已解锁' : '调查'}</em></button>
        </div>
        <div class="toilet-clue ${discovered ? 'is-discovered' : ''}"><i>${discovered ? '✓' : '!'}</i><span>${discovered ? '你已经知道墙后藏着什么，可以直接进去接单。' : '墙面有一道不自然的圆形轮廓，靠近后还有温热的气流。'}</span></div>`,
      actions: [
        { kind: 'navigation', label: '返回营地', handler: () => { open() } },
      ],
    })
    document.querySelectorAll('[data-toilet]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.toilet
        if (opt === 'use') {
          if (state._toiletUsed) { EventBus.emit('ui:log', { text: '🚽 你已经上过一次厕所了，再挤也挤不出来。', type: 'dim' }); return }
          useToilet()
        } else {
          if (discovered) enterGlory()
          else investigateStall()
        }
      }
    })
  }

  /** 调查隔间：首次发现荣耀洞 */
  function investigateStall () {
    const state = State.get()
    state._gloryDiscovered = true
    EventBus.emit('state:changed', state)
    campShow({
      title: '🔍 隐藏隔间已发现', className: 'toilet-discovery-modal',
      body: `
        <div class="toilet-reveal"><span aria-hidden="true">🍑</span><h3>墙后原来藏着一处接待间。</h3><p>你推开最里面的隔间，一股湿热气息迎面而来。墙洞后的人敲了两下木板，像是在催促。</p></div>
        <p class="scene-status-line"><span>入场费</span><b>${GLORY_FEE}G</b></p>
        <details class="scene-notes"><summary>查看这里的规矩</summary><p>完成接待可以获得报酬。金币不足时可以赊账，但还清之前无法离开营地。</p></details>`,
      actions: [
        { label: '🍑 进入荣耀洞', cls: 'btn-primary', handler: () => { enterGlory() } },
        { kind: 'navigation', label: '返回厕所', handler: () => { renderToilet() } },
      ],
    })
  }

  /** 进入荣耀洞：有妓女证免费；没证收费（没钱可赊账） */
  function enterGlory () {
    const state = State.get()
    setCampPhase()
    if (showServiceGearLockout('荣耀洞', renderToilet)) return
    if ((state._gloryDebt || 0) > 0 || state._gloryFreeService) { showGloryWork(); return }
    const hasLicense = !!state._prostituteLicensed
    const hasGold = state.gold >= GLORY_FEE
    const footOn = (state._glorySettings || {}).footService !== false
    campShow({
      title: '🍑 荣耀洞 · 入场处', className: 'glory-entry-modal',
      body: `<section class="glory-scene scene-dialogue">
          <div class="glory-scene-mark" aria-hidden="true">🍑</div>
          <div><h3>墙后的客人已经在等你。</h3><p>木板后传来指节轻敲的声音。</p></div>
        </section>
        <p class="scene-status-line ${hasLicense ? 'is-safe' : 'is-risk'}"><span>${hasLicense ? '许可证有效' : '无证入场'}</span><b>${hasLicense ? '免费' : GLORY_FEE + 'G'}</b></p>
        <div class="glory-option-row"><span><i>👠</i><span><b>足交服务</b><small>${footOn ? '已开启，接客时可以选择双脚服务' : '已关闭，不会显示足交选项'}</small></span></span><label class="restr-switch"><input type="checkbox" id="glory-entry-foot" ${footOn ? 'checked' : ''}><i></i></label></div>
        ${hasLicense ? '' : '<details class="scene-notes"><summary>查看无证入场风险</summary><p>每次接待都会提高危险值，离开时可能被守卫拦下。金币不足可赊账，欠款结清前无法离开营地。</p></details>'}`,
      actions: [
        { label: hasLicense ? '免费进洞' : hasGold ? `付 ${GLORY_FEE}G 进洞` : `先欠 ${GLORY_FEE}G 进洞`, cls: hasLicense ? 'btn-primary' : (hasGold ? 'btn-primary' : 'btn-danger'), handler: () => {
          if (!hasLicense) {
            if (hasGold) state.gold -= GLORY_FEE
            else {
              state._gloryDebt = GLORY_FEE
              EventBus.emit('ui:log', { text: `💸 你身无分文，只能向营地赊账 ${GLORY_FEE}G，签下卖身契进洞。`, type: 'danger' })
            }
          }
          EventBus.emit('state:changed', state); showGloryWork()
        } },
        { kind: 'navigation', label: '返回厕所', handler: () => { renderToilet() } },
      ],
    })
    // 足交开关：立即保存
    const footToggle = document.getElementById('glory-entry-foot')
    if (footToggle) footToggle.onchange = () => {
      const g = state._glorySettings || (state._glorySettings = {})
      g.footService = footToggle.checked
      EventBus.emit('state:changed', state)
      State.save()
      enterGlory()
    }
  }

  /** 上厕所：免费使用，随机小事件 */
  function useToilet () {
    const state = State.get()
    state._toiletUsed = true   // 本次进营地只能上一次厕所
    const z = Dice.rollZ()
    let msg = ''
    switch (z) {
      case 1:
        state.hp = Math.min(state.maxHp, state.hp + 5)
        msg = '💚 你蹲下痛快地释放，仿佛连之前的疲惫和爱液都一起冲走了，恢复 5 HP。'
        break
      case 2:
        state.hp = Math.min(state.maxHp, state.hp + 3)
        msg = '💚 畅快淋漓地解决了，身体轻快了些，恢复 3 HP。'
        break
      case 3:
        if (state.statuses && state.statuses.length) {
          state.statuses = state.statuses.filter(s => s.id !== 'poisoned' && s.id !== 'sleepy')
          msg = '✨ 你排出那些黏腻的秽物，中毒与困倦随水流冲走，身体清爽了。'
        } else {
          msg = '🫢 你发现隔壁隔间的人弄出的动静有点大……你红着脸快速解决。'
        }
        break
      case 4:
        msg = '🚽 这厕所意外的干净，你心无杂念地完成了例行公事。'
        break
      case 5:
        state.hp = Math.min(state.maxHp, state.hp + 1)
        msg = '🫢 你有些紧张，隔壁的喘息让你分心，草草解决，恢复 1 HP。'
        break
      default:
        state.hp = Math.min(state.maxHp, state.hp + 5)
        msg = '🎉 释放完神清气爽，甚至觉得今晚还能再来几次，恢复 5 HP。'
        break
    }
    EventBus.emit('ui:log', { text: `🚻 上厕所：${msg}`, type: 'good' })
    EventBus.emit('state:changed', state)
    campShow({
      title: '🚽 上厕所完成', className: 'toilet-result-modal',
      body: `<div class="toilet-result"><i>✨</i><b>整个人轻松多了</b><p>${msg}</p></div>`,
      actions: [
        { label: '继续', cls: 'btn-primary', handler: () => { open() } },
      ],
    })
  }

  function showGloryWork () {
    const state = State.get()
    setCampPhase()
    if (showServiceGearLockout('荣耀洞', renderToilet)) return
    const render = () => {
      const debt = Math.max(0, state._gloryDebt || 0)
      const isFree = !!state._gloryFreeService
      const forced = debt > 0 || isFree
      const notice = isFree
        ? '<div class="glory-status-card is-forced"><i>!</i><span><b>追加服务</b><small>本次没有报酬，完成后才能离开</small></span></div>'
        : debt > 0
          ? `<div class="glory-status-card is-debt"><i>💸</i><span><b>欠款 ${debt}G</b><small>本次收入会优先用于偿还欠款</small></span></div>`
          : '<div class="glory-status-card is-safe"><i>✓</i><span><b>自由接客</b><small>没有欠款，可以随时结束工作</small></span></div>'
      // 女性角色额外提供小穴洞（男性只有嘴和屁股）；贞操装置锁死小穴，只留嘴和屁股
      const canUseVagina = state.gender !== 'male' && !ChastitySystem.isWorn()
      const vaginaBtn = canUseVagina
        ? `<button class="glory-service-card" data-hole="vagina"><i>🌸</i><span><b>小穴服务</b><small>使用小穴完成本次接待</small></span><em>选择</em></button>`
        : ''
      // 足交服务（玩家主动选择，不进入白嫖指定池；可在 MCM 关闭）
      const footEnabled = (state._glorySettings || {}).footService !== false
      const footBtn = footEnabled
        ? `<button class="glory-service-card" data-hole="foot"><i>👠</i><span><b>足交服务</b><small>使用双脚完成 BPM 计时任务</small></span><em>选择</em></button>`
        : ''
      const footHint = footEnabled ? `<div class="glory-gear-strip"><i>👠</i><span><b>当前鞋履联动</b><small>${footServiceHint()}</small></span></div>` : ''
      // 白嫖时：客人随机指定一个洞（指名），玩家不能选
      let namedHole = ''
      if (isFree) {
        const pool = canUseVagina ? ['oral', 'anal', 'vagina'] : ['oral', 'anal']
        const hole = pool[Math.floor(Math.random() * pool.length)]
        const holeInfo = {
          oral: { icon: '👄', name: '嘴穴', tip: '把嘴凑过去，任由客人操弄你的嘴' },
          anal: { icon: '🍑', name: '菊穴', tip: '撅起屁股，让客人从背后操进来' },
          vagina: { icon: '🌸', name: '小穴', tip: '张开双腿，任客人操弄你的小穴' },
        }[hole]
        namedHole = `<section class="glory-work-head"><small>指定服务</small><h3>客人已经选好了服务方式</h3><p>完成这次追加服务后才能离开。</p></section>
          <div class="glory-service-grid is-single">
            <button class="glory-service-card" data-hole="${hole}"><i>${holeInfo.icon}</i><span><b>${holeInfo.name}服务</b><small>${holeInfo.tip}</small></span><em>开始</em></button>
          </div>`
      }
      // 危险值显示（无证卖淫时）
      const exitRisk = gloryArrestChance(state._gloryWanted || 0)
      const wantHtml = state._prostituteLicensed
        ? `<div class="glory-status-card is-safe"><i>🛡️</i><span><b>持证营业</b><small>本次服务不会增加危险值</small></span></div>`
        : state._prisonPardon
          ? `<div class="glory-status-card is-safe"><i>🕊️</i><span><b>队长豁免</b><small>危险值 ${state._gloryWanted || 0} · 当前不会入狱</small></span></div>`
          : `<div class="glory-status-card is-risk"><i>🚨</i><span><b>危险值 ${state._gloryWanted || 0}</b><small>离开时被拦概率 ${exitRisk}%</small></span></div>`
      campShow({
        title: '🍑 荣耀洞 · 接客', className: 'glory-modal',
        body: `<div class="glory-status-grid">${notice}${wantHtml}</div>${isFree ? namedHole : `<section class="glory-work-head"><small>可选服务</small><h3>选择本次接待方式</h3><p>每项服务都会进入独立的计时任务，完成后自动结算。</p></section>
          <div class="glory-service-grid">
            <button class="glory-service-card" data-hole="oral"><i>👄</i><span><b>口部服务</b><small>使用嘴部完成本次接待</small></span><em>选择</em></button>
            <button class="glory-service-card" data-hole="anal"><i>🍑</i><span><b>菊穴服务</b><small>使用菊穴完成本次接待</small></span><em>选择</em></button>
            ${vaginaBtn}
            ${footBtn}
          </div>
          ${footHint}`}`,
        actions: forced ? [] : [{ kind: 'navigation', label: '返回营地', handler: () => { open() } }],
      })
      document.querySelectorAll('.glory-service-card').forEach(btn => {
        btn.onclick = () => {
          const hole = btn.dataset.hole
          performService(hole, render)
        }
      })
    }
    render()
  }

  function rollManagerEvent (state) {
    if (state._prostituteLicensed || state._gloryByGuard) return null
    const cooldown = Math.max(0, Number(state._gloryManagerCooldown) || 0)
    if (cooldown > 0) {
      state._gloryManagerCooldown = cooldown - 1
      return null
    }
    const chance = Math.min(25, 5 + Math.floor((state._gloryWanted || 0) / 5))
    if (Math.random() * 100 >= chance) return null
    state._gloryManagerCooldown = 3
    const z = Dice.rollZ()
    return ({
      1: { z, manager: true, basePay: true, payMultiplier: 1, wantedDelta: -3, msg: '👮 管理员按普通客人的规矩付钱，并替你压下了一点风声。' },
      2: { z, manager: true, basePay: false, wantedDelta: -8, msg: '👮 管理员以检查为名免费使用了一次，但暂时替你遮住了无证记录。' },
      3: { z, manager: true, basePay: true, payMultiplier: 1.5, wantedDelta: 0, msg: '👮 管理员付了封口费，这一单按一点五倍结算，但不会替你消除记录。' },
      4: { z, manager: true, basePay: true, payMultiplier: 2, extraSeconds: 30, wantedDelta: -5, msg: '👮 管理员要求加做一段服务；完成后支付双倍报酬，并替你压下一部分危险值。' },
      5: { z, manager: true, basePay: false, free: true, wantedDelta: 10, msg: '👮 管理员认定服务不合格：本单没有报酬，还要追加一单免费惩罚。' },
      6: { z, manager: true, basePay: false, enforcement: true, wantedDelta: 0, msg: '🚨 管理员翻出无证记录，现场查封并按当前危险值处罚。' },
    })[z]
  }

  function rollSpecialEvent () {
    const state = State.get()
    const manager = rollManagerEvent(state)
    if (manager) return manager
    // 普通客人事件；管理员已经独立判定，不再混在这张表里。
    const roll = Math.random() * 100
    let z
    if (roll < 55) z = 2
    else if (roll < 75) z = 3
    else if (roll < 90) z = 4
    else if (roll < 95) z = 5
    else z = 6
    return ({
      2: { z, basePay: true, tip: 0, msg: '🙂 客人舒服地哼哼着离开，一切如常。' },
      3: { z, basePay: true, tip: 5, msg: '💖 客人被你伺候得舒爽，往你嘴里塞了 5 金币小费。' },
      4: { z, basePay: true, tip: 10, msg: '💰 客人被你榨得腿软，大方地甩出 10 金币。' },
      5: { z, basePay: false, tip: 0, complain: true, msg: '😤 客人嫌你服务不行，向营地投诉了你！' },
      6: { z, basePay: true, tip: 0, free: true, msg: '😠 客人嫌你不够卖力，要求免费再来一次！' },
    })[z]
  }

  function serviceRiskGain (pay) {
    if (pay >= 20) return 5
    if (pay >= 15) return 3
    return 2
  }

  /** Z6 查封：低危险没收本单，中危险罚款/转欠债，高危险直接收监。 */
  function resolveManagerEnforcement (state, totalEarn, event) {
    if (!state || !event || !event.enforcement) return { totalEarn, arrested: false, text: '' }
    const wanted = Math.max(0, Number(state._gloryWanted) || 0)
    if (wanted < 40) {
      state._gloryWanted = Math.min(100, wanted + 15)
      return { totalEarn: 0, arrested: false, text: `本次收入被没收，危险值升至 ${state._gloryWanted}。` }
    }
    if (wanted < 70) {
      let fine = 100
      const fromEarn = Math.min(totalEarn, fine)
      totalEarn -= fromEarn
      fine -= fromEarn
      const fromGold = Math.min(Math.max(0, state.gold || 0), fine)
      state.gold -= fromGold
      fine -= fromGold
      if (fine > 0) {
        addDebt({ amount: fine, source: 'manager', reason: '管理员查封罚款' })
      }
      return { totalEarn, arrested: false, text: fine > 0 ? `罚款 100G；不足的 ${fine}G 转为厕所欠债。` : '罚款 100G 已缴清。' }
    }
    EventBus.emit('state:changed', state)
    State.save()
    TownPrisonSystem.enter({ charge: '无证营业查封' })
    return { totalEarn: 0, arrested: true, text: '危险值过高，管理员将你直接押进监狱。' }
  }

  function applyUnauthorizedRisk (state, event, servicePay) {
    if (state._prostituteLicensed || state._gloryByGuard) return
    if (event.manager) {
      state._gloryWanted = Math.max(0, Math.min(100, (state._gloryWanted || 0) + (event.wantedDelta || 0)))
      EventBus.emit('ui:log', { text: `👮 管理员处理后，危险值为 ${state._gloryWanted}。`, type: event.wantedDelta < 0 ? 'good' : 'danger' })
      return
    }
    const gain = serviceRiskGain(servicePay)
    state._gloryWanted = Math.min(100, (state._gloryWanted || 0) + gain)
    EventBus.emit('ui:log', { text: `🚨 无证营业，危险值 +${gain}（现 ${state._gloryWanted}%）。`, type: 'danger' })
  }

  function runServiceTimer (service, seconds, telemetry = null) {
    return new Promise(resolve => {
      let timer = null
      let finishAt = 0
      const cleanup = () => { if (timer) clearInterval(timer); timer = null }
      Dialog.show({
        title: `⏱ 服务 · ${service.name}`, className: 'camp-task-modal',
        body: `<div class="camp-task"><div class="camp-task-icon">${service.icon}</div><p>${service.desc}。你闭眼咬唇，任由客人享用你这 ${seconds} 秒，全程必须撑住。</p><strong id="camp-task-time" aria-live="polite">${seconds}</strong><span>秒</span><div class="camp-task-track"><i id="camp-task-fill"></i></div><small>撑满整段才拿得到钱；中途受不住可以撤，但拒绝服务要加 ${10} 金币债务。</small></div>`,
        actions: [
          { label: '▶ 开始服务', cls: 'btn-primary', handler: begin },
          { label: '🙅 拒绝接待', cls: 'btn-danger', handler: () => { cleanup(); Dialog.close(); resolve('refuse') } },
        ],
      })
      function begin () {
        if (timer) return
        finishAt = Date.now() + seconds * 1000
        const actions = document.querySelector('#modal-layer .modal-actions')
        if (actions) actions.innerHTML = '<button class="btn" id="camp-task-cancel">⏭ 跳过（无惩罚）</button>'
        const cancel = document.getElementById('camp-task-cancel')
        if (cancel) cancel.onclick = () => { cleanup(); Dialog.close(); resolve('skip') }
        tick(); timer = setInterval(tick, 200)
      }
      function tick () {
        const leftMs = Math.max(0, finishAt - Date.now())
        const timeEl = document.getElementById('camp-task-time')
        const fillEl = document.getElementById('camp-task-fill')
        if (timeEl) timeEl.textContent = Math.ceil(leftMs / 1000)
        if (fillEl) fillEl.style.width = `${Math.max(0, Math.min(100, leftMs / (seconds * 10)))}%`
        if (leftMs > 0) return
        cleanup()
        const actions = document.querySelector('#modal-layer .modal-actions')
        if (actions) {
          actions.innerHTML = '<button class="btn btn-success" id="camp-task-complete">✓ 撑过来了，收钱！</button>'
          document.getElementById('camp-task-complete').onclick = () => {
            if (telemetry) EventBus.emit('task:complete', { ...telemetry, seconds, bpm: Number(service.bpm) || 0, completed: true, damage: 0 })
            Dialog.close(); resolve(true)
          }
        }
      }
    })
  }

  /** 拒绝荣耀洞服务前二次确认，取消后由调用方重新打开原任务。 */
  function confirmGloryRefusal (serviceName) {
    return new Promise(resolve => {
      Dialog.show({
        title: '⚠️ 确认拒绝接待？', className: 'glory-refuse-modal',
        body: `<section class="glory-refuse-card"><i>🙅</i><div><small>拒绝「${serviceName}」</small><h3>现在退出会被记上一笔欠款</h3><p>确认拒绝后，本次服务立即结束，并增加 <b>10G</b> 荣耀洞债务。</p></div></section>
          <div class="glory-entry-note is-risk"><i>!</i><span>返回任务不会产生任何惩罚，计时也会重新开始。</span></div>`,
        actions: [
          { label: '继续接待', cls: 'btn-primary', handler: () => { Dialog.close(); resolve(false) } },
          { label: '确认拒绝（+10G 欠款）', cls: 'btn-danger', handler: () => { Dialog.close(); resolve(true) } },
        ],
      })
    })
  }

  async function performService (hole, rerender) {
    const state = State.get()
    if (showServiceGearLockout('荣耀洞', rerender)) return
    if (hole === 'foot') { performFootService(rerender); return }
    const wasFree = !!state._gloryFreeService
    // 客人随机决定怎么用你（玩家只选了用哪个洞）
    const pool = hole === 'oral' ? ORAL_SERVICES : hole === 'vagina' ? VAGINA_SERVICES : ANAL_SERVICES
    const service = pool[Math.floor(Math.random() * pool.length)]
    const holeName = hole === 'oral' ? '嘴' : hole === 'vagina' ? '小穴' : '屁股'
    EventBus.emit('ui:log', { text: `🍑 你把${holeName}凑了过去，客人开始「${service.name}」。`, type: 'danger' })
    // 白嫖服务：不掷 Z 特殊事件（不会有钱、不会有免费追加、不会加时）
    const event = wasFree
      ? { z: 0, basePay: false, tip: 0, msg: '客人要求免费的服务，白嫖完后直接走人。' }
      : rollSpecialEvent()
    let completed
    do {
      completed = await runServiceTimer(service, SERVICE_SECONDS + (event.extraSeconds || 0), { source: 'glory', action: hole === 'oral' ? 'oral' : 'penetration', part: hole, depth: 'medium' })
      if (completed !== 'refuse') break
    } while (!(await confirmGloryRefusal(service.name)))
    if (completed === 'refuse') {
      // 拒绝服务：一开始就不做，债务 +10
      state._gloryDebt = (state._gloryDebt || 0) + 10
      EventBus.emit('ui:log', { text: `🙅 你拒绝服务「${service.name}」，被营地加了 10 金币债务！`, type: 'danger' })
      EventBus.emit('state:changed', state)
      rerender(); return
    }
    if (!completed) {
      // 中途溜走（跳过）：无惩罚，只是没报酬
      EventBus.emit('ui:log', { text: `🏃 你中途受不住溜了，没拿报酬但也没欠债。`, type: 'dim' }); rerender(); return
    }
    if (wasFree) state._gloryFreeService = false
    // 白嫖服务：一毛钱都不给（基础费和小费都归零）
    const baseEarn = (!wasFree && event.basePay) ? Math.round(service.pay * (event.payMultiplier || 1)) : 0
    const tip = wasFree ? 0 : (event.tip || 0)
    let totalEarn = baseEarn + tip
    // 投诉：客人向营地投诉，加 30 欠款且这次不给钱
    if (event.complain) {
      state._gloryDebt = (state._gloryDebt || 0) + 30
      EventBus.emit('ui:log', { text: `😤 客人投诉你服务不行，被营地记了 30 金币欠款（现欠 ${state._gloryDebt}G）！`, type: 'danger' })
    }
    // 小穴服务可获得当前震动档位加成；白嫖或投诉事件不发放额外收入。
    const vibrationBonus = !wasFree && !event.complain && hole === 'vagina' && typeof RestraintSystem !== 'undefined' && RestraintSystem.vibrationServiceBonus
      ? RestraintSystem.vibrationServiceBonus('vagina')
      : 0
    if (vibrationBonus > 0) {
      totalEarn += vibrationBonus
      const vibration = RestraintSystem.vibrationInfo('vagina')
      EventBus.emit('ui:log', { text: `${vibration && vibration.mode === 'high' ? '⚡' : '〰️'} 震动档位使这次小穴服务额外获得 ${vibrationBonus}G。`, type: 'good' })
    }
    if (!wasFree && !event.complain && window.TownReputationSystem) totalEarn = TownReputationSystem.getServiceIncome(totalEarn)
    // 营地税率：按难度从收入中扣除（厕所也交税）
    const taxRate = (CONFIG.difficulty[state.difficulty] || {}).campTax || 0
    const tax = Math.floor(totalEarn * taxRate)
    if (tax > 0) {
      totalEarn -= tax
      EventBus.emit('ui:log', { text: `💸 营地收取 ${tax}G 税费（${state.difficulty === 'brutal' ? '残酷' : '困难'} ${taxRate * 100}%）。`, type: 'dim' })
    }
    const debtBefore = Math.max(0, state._gloryDebt || 0)
    const repaid = Math.min(debtBefore, totalEarn)
    state._gloryDebt = debtBefore - repaid
    if (!wasFree) applyUnauthorizedRisk(state, event, service.pay)
    const enforcement = resolveManagerEnforcement(state, totalEarn - repaid, event)
    if (enforcement.arrested) return
    totalEarn = enforcement.totalEarn + repaid
    state.gold += totalEarn - repaid
    // 还清欠款：出城时根据来源触发——卫兵放行嘲笑 / 队长羞辱
    if (repaid > 0 && state._gloryDebt === 0 && (state._gloryByGuard || state._gloryByCaptain)) {
      state._gloryJustCleared = true
    }
    if (event.free) state._gloryFreeService = true
    if (window.MercenaryContractSystem) MercenaryContractSystem.recordService('glory')
    if (window.TownReputationSystem) TownReputationSystem.recordLegalService('公共厕所')
    EventBus.emit('ui:log', { text: wasFree ? `🍑 你伺候完「${service.name}」，客人提起裤子就走，一分钱没给（白嫖）。` : `🍑 你伺候完「${service.name}」，累得腰酸背痛，赚了 ${totalEarn} 金币。`, type: totalEarn > 0 ? 'good' : 'dim' })
    if (repaid > 0) EventBus.emit('ui:log', { text: `💸 你挣的钱先被营地扣去还债 ${repaid} 金币，还剩 ${state._gloryDebt} 没还清。`, type: 'dim' })
    EventBus.emit('ui:log', { text: `🎲 Z=${event.z}：${wasFree && event.tip > 0 ? event.msg.replace(/小费|金币/g, '') : event.msg}`, type: event.tip > 0 && !wasFree ? 'good' : 'dim' })
    EventBus.emit('state:changed', state)
    if (enforcement.text) EventBus.emit('ui:log', { text: `🚨 ${enforcement.text}`, type: 'danger' })
    const forced = state._gloryDebt > 0 || state._gloryFreeService
    const guardDebtCleared = !forced && !!state._gloryJustCleared && !!state._gloryByGuard
    campShow({
      title: '🍑 服务完成', className: 'glory-result-modal',
      body: `<div class="glory-result"><strong>${totalEarn > 0 ? `赚了 ${totalEarn}G` : '白干了一场'}</strong><p>${wasFree && event.tip > 0 ? event.msg.replace(/小费|金币/g, '') : event.msg}</p>${enforcement.text ? `<span class="danger">${enforcement.text}</span>` : ''}${repaid > 0 ? `<span>还债 ${repaid}G · 还欠 ${state._gloryDebt}G</span>` : ''}${state._gloryFreeService ? '<span class="danger">还有个免费的得做完才能走</span>' : ''}</div>`,
      actions: guardDebtCleared
        ? [{ kind: 'navigation', label: '还清欠款，返回营地', cls: 'btn-primary', handler: () => { Dialog.close(); gloryClearedLeave() } }]
        : [
            { label: forced ? '继续服务' : '继续接客', cls: 'btn-primary', handler: () => { Dialog.close(); rerender() } },
            ...(!forced ? [{ kind: 'navigation', label: '返回营地', handler: () => { Dialog.close(); gloryClearedLeave() } }] : []),
          ],
    })
  }

  /* ============ 荣耀洞 · 足交服务 ============ */

  /** 足交按钮下方的动态联动提示 */
  function footServiceHint () {
    const state = State.get()
    if (typeof RestraintSystem === 'undefined') return '赤脚服务 · 60～180 BPM · 无装备加成'
    const feet = RestraintSystem.get('feet')
    const id = feet && feet.id
    const def = id ? RestraintSystem.defOf(id) : null
    const bonus = id ? HEEL_BONUSES[id] : null
    if (id && bonus && def) {
      return `${def.name} · 报酬 +${bonus.pay}G · 鞋内概率 ${bonus.insideChance}%${feet.locked ? ' · 已上锁' : ' · 有丢失风险'}`
    }
    if (id && def) {
      return `${def.name} · 60～180 BPM · 无装备加成${feet.locked ? ' · 已上锁' : ''}`
    }
    return '赤脚服务 · 60～180 BPM · 无装备加成'
  }

  /** 足交服务：60 秒 BPM 任务 + 高跟鞋联动 + 射精位置 + 偷鞋判定 */
  async function performFootService (rerender) {
    const state = State.get()
    if (showServiceGearLockout('荣耀洞', rerender)) return
    const service = FOOT_SERVICES[Math.floor(Math.random() * FOOT_SERVICES.length)]
    // 任务开始时记录高跟鞋 ID（即使结算时鞋被拿走，本次加成仍有效）
    const feetEntry = typeof RestraintSystem !== 'undefined' ? RestraintSystem.get('feet') : null
    const heelId = feetEntry && HEEL_BONUSES[feetEntry.id] ? feetEntry.id : null
    const heelBonus = heelId ? HEEL_BONUSES[heelId] : null
    const heelLocked = !!(feetEntry && feetEntry.locked)
    const heelDef = heelId ? RestraintSystem.defOf(heelId) : null
    const event = rollSpecialEvent()
    const taskSeconds = service.seconds + (event.extraSeconds || 0)
    EventBus.emit('ui:log', { text: `👠 你伸出双脚，客人开始「${service.name}」。`, type: 'danger' })

    let result
    do {
      result = (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog)
        ? await BattleUI.showTaskDialog({
            enemyName: '🍑 荣耀洞客人',
            attackName: service.name,
            desc: `用双脚为客人足交，${service.bpm} BPM 持续 ${taskSeconds} 秒`,
            bpm: service.bpm,
            seconds: taskSeconds,
            dmg: 0,
            noDamage: true,
            refuseLabel: '🙅 拒绝接待',
            telemetry: { source: 'glory', action: 'handjob', part: 'foot', depth: 'none' },
          })
        : (confirm('足交服务：完成代表伺候完了。') ? false : true)
      if (result !== 'refuse') break
    } while (!(await confirmGloryRefusal(service.name)))

    if (result === 'refuse') {
      // 拒绝服务：沿用荣耀洞规则，+10 债务
      state._gloryDebt = (state._gloryDebt || 0) + 10
      EventBus.emit('ui:log', { text: `🙅 你拒绝足交服务「${service.name}」，被营地加了 10 金币债务！`, type: 'danger' })
      EventBus.emit('state:changed', state)
      rerender(); return
    }
    if (result === true) {
      // 跳过/中途失败：无报酬，不触发鞋内射精或偷鞋
      EventBus.emit('ui:log', { text: '🏃 你中途收回了脚，没拿报酬也没欠债。', type: 'dim' })
      rerender(); return
    }

    // 完成：按任务开始前抽出的特殊事件结算。
    const multiplier = event.payMultiplier || 1
    const baseEarn = event.basePay ? Math.round(service.pay * multiplier) : 0
    const heelPay = (event.basePay && heelBonus) ? Math.round(heelBonus.pay * multiplier) : 0
    const tip = event.tip || 0
    let totalEarn = baseEarn + heelPay + tip
    // 投诉：加 30 欠款且这次不给钱
    if (event.complain) {
      state._gloryDebt = (state._gloryDebt || 0) + 30
      EventBus.emit('ui:log', { text: `😤 客人投诉你服务不行，被营地记了 30 金币欠款（现欠 ${state._gloryDebt}G）！`, type: 'danger' })
    }
    if (!event.complain && window.TownReputationSystem) totalEarn = TownReputationSystem.getServiceIncome(totalEarn)

    // 射精位置事件（独立掷骰，不替换 Z 特殊事件）
    let shoeInside = false
    if (heelBonus) shoeInside = Math.floor(Math.random() * 100) < heelBonus.insideChance
    let ejacText
    if (!heelId) ejacText = '💦 客人最后射在了你的脚背和脚趾上。'
    else if (shoeInside) ejacText = '👠 客人掰开鞋口，把精液全部射进了你的高跟鞋里。'
    else ejacText = '💦 客人把精液射在鞋面和你的双脚上。'

    // 偷鞋判定：射在鞋内 + 服务类高跟鞋 + 未上锁 + 任务成功 → 4%
    let shoeStolen = false
    if (heelBonus && shoeInside && !heelLocked) {
      if (Math.random() < 0.04) {
        RestraintSystem.remove('feet')
        state._ownedRestraints = (state._ownedRestraints || []).filter(id => id !== heelId)
        if (state._ownedRestraintCounts && state._ownedRestraintCounts[heelId]) delete state._ownedRestraintCounts[heelId]
        if (heelId === 'heels' && state._prostituteGear) state._prostituteGear.heels = false
        shoeStolen = true
      }
    } else if (heelBonus && shoeInside && heelLocked) {
      EventBus.emit('ui:log', { text: '🔒 客人试着扯走你的高跟鞋，但锁具牢牢扣着，他只能悻悻离开。', type: 'dim' })
    }

    // 营地税率
    const taxRate = (CONFIG.difficulty[state.difficulty] || {}).campTax || 0
    const tax = Math.floor(totalEarn * taxRate)
    if (tax > 0) {
      totalEarn -= tax
      EventBus.emit('ui:log', { text: `💸 营地收取 ${tax}G 税费（${state.difficulty === 'brutal' ? '残酷' : '困难'} ${taxRate * 100}%）。`, type: 'dim' })
    }
    const debtBefore = Math.max(0, state._gloryDebt || 0)
    const repaid = Math.min(debtBefore, totalEarn)
    state._gloryDebt = debtBefore - repaid
    applyUnauthorizedRisk(state, event, service.pay)
    const enforcement = resolveManagerEnforcement(state, totalEarn - repaid, event)
    if (enforcement.arrested) return
    totalEarn = enforcement.totalEarn + repaid
    state.gold += totalEarn - repaid
    if (repaid > 0 && state._gloryDebt === 0 && (state._gloryByGuard || state._gloryByCaptain)) {
      state._gloryJustCleared = true
    }
    if (event.free) state._gloryFreeService = true
    if (window.MercenaryContractSystem) MercenaryContractSystem.recordService('foot')
    if (window.TownReputationSystem) TownReputationSystem.recordLegalService('足交服务')
    EventBus.emit('ui:log', { text: `👠 你伺候完「${service.name}」，累得双脚发酸，赚了 ${totalEarn} 金币。`, type: totalEarn > 0 ? 'good' : 'dim' })
    if (repaid > 0) EventBus.emit('ui:log', { text: `💸 你挣的钱先被营地扣去还债 ${repaid} 金币，还剩 ${state._gloryDebt} 没还清。`, type: 'dim' })
    EventBus.emit('ui:log', { text: `🎲 Z=${event.z}：${event.msg}`, type: event.tip > 0 ? 'good' : 'dim' })
    EventBus.emit('ui:log', { text: ejacText, type: 'dim' })
    if (shoeStolen) EventBus.emit('ui:log', { text: `🏃 客人趁你还没反应过来，抓起沾满精液的${heelDef ? heelDef.name : '高跟鞋'}从另一边逃走了！`, type: 'danger' })
    EventBus.emit('state:changed', state)
    State.save()

    if (enforcement.text) EventBus.emit('ui:log', { text: `🚨 ${enforcement.text}`, type: 'danger' })

    const forced = state._gloryDebt > 0 || state._gloryFreeService
    const guardDebtCleared = !forced && !!state._gloryJustCleared && !!state._gloryByGuard
    const shoeRow = shoeStolen
      ? `<span class="danger">🏃 ${heelDef ? heelDef.name : '高跟鞋'}已被客人拿走</span>`
      : (heelLocked && shoeInside) ? '<span>🔒 上锁的高跟鞋没被扯走</span>' : ''
    campShow({
      title: '👠 足交完成', className: 'glory-result-modal',
      body: `<div class="glory-result"><strong>${totalEarn > 0 ? `赚了 ${totalEarn}G` : '白干了一场'}</strong>
        <p>${service.name}（${service.bpm} BPM · ${taskSeconds} 秒）</p>
        <p>${event.msg}</p>
        ${enforcement.text ? `<span class="danger">${enforcement.text}</span>` : ''}
        <p>${ejacText}</p>
        ${heelBonus ? `<span>${heelDef.name} 奖金 +${heelPay}G</span>` : ''}
        ${repaid > 0 ? `<span>还债 ${repaid}G · 还欠 ${state._gloryDebt}G</span>` : ''}
        ${tax > 0 ? `<span>税费 ${tax}G</span>` : ''}
        ${shoeRow}
        ${state._gloryFreeService ? '<span class="danger">还有个免费的得做完才能走</span>' : ''}</div>`,
      actions: guardDebtCleared
        ? [{ kind: 'navigation', label: '还清欠款，返回营地', cls: 'btn-primary', handler: () => { Dialog.close(); gloryClearedLeave() } }]
        : [
            { label: forced ? '继续服务' : '继续接客', cls: 'btn-primary', handler: () => { Dialog.close(); rerender() } },
            ...(!forced ? [{ kind: 'navigation', label: '返回营地', handler: () => { Dialog.close(); gloryClearedLeave() } }] : []),
          ],
    })
  }

  /* ============ 监狱系统 ============ */

  /** 出狱所需积分（按难度：普通 300 / 困难 400 / 残酷 500，越狱失败会加惩罚） */
  function gloryArrestChance (wanted) {
    return Math.min(40, Math.max(0, (Math.max(0, wanted) - 20) / 2))
  }

  function sendGloryToPrison () {
    const state = State.get()
    state._gloryWanted = 0
    state._gloryJustCleared = false
    state._gloryByGuard = false
    state._gloryByCaptain = false
    EventBus.emit('state:changed', state)
    State.save()
    Dialog.close()
    TownPrisonSystem.enter()
  }

  /** 守卫拦下后先给玩家处理机会，不再直接送进监狱。 */
  function gloryGuardInterception (chance) {
    const state = State.get()
    const wanted = state._gloryWanted || 0
    campShow({
      title: '🛡️ 荣耀洞出口 · 守卫盘查', className: 'glory-guard-modal',
      body: `<section class="glory-guard-card"><i>🛡️</i><div><small>出口盘查</small><h3>守卫叫住了你</h3><p>你的无证营业引起了注意。先处理这次盘查，否则会被押进监狱。</p></div></section>
        <div class="glory-overview"><span><i>🚨</i><b>${wanted}</b><small>当前危险值</small></span><span class="is-risk"><i>⚠️</i><b>${chance}%</b><small>本次拦截率</small></span><span><i>💎</i><b>${state.gold}G</b><small>随身金币</small></span></div>
        <div class="glory-entry-note is-risk"><i>!</i><span>可以缴纳罚款、接受木枷处罚，或冒险求情与逃跑。</span></div>`,
      actions: [
        ...(state.gold >= 50 ? [{ label: '💎 缴纳 50G 罚款', cls: 'btn-primary', handler: () => {
          state.gold -= 50
          state._gloryWanted = Math.max(0, wanted - 30)
          EventBus.emit('ui:log', { text: `💎 你缴纳 50G 罚款，守卫将危险值降到 ${state._gloryWanted} 后放行。`, type: 'good' })
          EventBus.emit('state:changed', state)
          finishGloryLeave()
        } }] : []),
        { label: '🕊️ 尝试求情（40%）', handler: () => {
          if (Math.random() < 0.4) {
            state._gloryWanted = Math.max(0, wanted - 15)
            EventBus.emit('ui:log', { text: `🕊️ 守卫接受了你的求情，危险值降到 ${state._gloryWanted}。`, type: 'good' })
            EventBus.emit('state:changed', state)
            finishGloryLeave()
          } else {
            EventBus.emit('ui:log', { text: '⛓️ 求情失败，守卫不再听你解释，将你押进监狱。', type: 'danger' })
            sendGloryToPrison()
          }
        } },
        { label: '🏃 尝试逃跑（50%）', handler: () => {
          if (Math.random() < 0.5) {
            state._gloryWanted = Math.min(100, wanted + 10)
            EventBus.emit('ui:log', { text: `🏃 你甩开守卫逃回营地，但危险值升到 ${state._gloryWanted}。`, type: 'good' })
            EventBus.emit('state:changed', state)
            finishGloryLeave()
          } else {
            EventBus.emit('ui:log', { text: '⛓️ 逃跑失败，守卫将你按倒并押进监狱。', type: 'danger' })
            sendGloryToPrison()
          }
        } },
        ...((state._pillorySettings || {}).enabled !== false ? [{ label: '🪵 接受广场木枷处罚', cls: 'btn-danger', handler: () => {
          EventBus.emit('ui:log', { text: '🪵 你接受 90 秒广场木枷处罚，避免被直接押进监狱。', type: 'danger' })
          TownPillorySystem.start('punishment', 90, 0)
        } }] : []),
        { label: '⛓️ 放弃抵抗', cls: 'btn-danger', handler: () => {
          EventBus.emit('ui:log', { text: '⛓️ 你放弃抵抗，被守卫押进监狱。', type: 'danger' })
          sendGloryToPrison()
        } },
      ],
    })
  }

  /** 仅在离开荣耀洞时判定一次，服务过程中不再反复抓捕。 */
  function gloryClearedLeave () {
    const state = State.get()
    if (!state._prostituteLicensed && !state._gloryByGuard) {
      const chance = gloryArrestChance(state._gloryWanted || 0)
      if (chance > 0 && Math.random() * 100 < chance) {
        if (state._prisonPardon) {
          state._gloryWanted = Math.max(0, (state._gloryWanted || 0) - 10)
          EventBus.emit('ui:log', { text: `🕊️ 队长豁免让守卫放行，危险值降到 ${state._gloryWanted}。`, type: 'good' })
          EventBus.emit('state:changed', state)
        } else {
          EventBus.emit('ui:log', { text: `🛡️ 离开荣耀洞时触发守卫盘查（${chance}%）。`, type: 'danger' })
          gloryGuardInterception(chance)
          return
        }
      }
    }
    finishGloryLeave()
  }

  /** 完成出口判定后，根据原有来源触发嘲笑 / 队长羞辱并回营地。 */
  function finishGloryLeave () {
    const state = State.get()
    if (!state._gloryJustCleared) { open(); return }
    state._gloryJustCleared = false
    const clearedGuardDebt = !!state._gloryByGuard
    if (clearedGuardDebt) state._gloryByGuard = false
    EventBus.emit('state:changed', state)
    State.save()
    if (state._gloryByCaptain) {
      state._gloryByCaptain = false
      EventBus.emit('state:changed', state)
      TownTavernCaptainSystem.showGloryHumiliation()
      return
    }
    campShow({
      title: '🛡️ 荣耀洞出口 · 卫兵', className: 'glory-modal',
      body: `<div class="glory-section"><h3><span>“哟，厕所的味儿都还没散呢。”</span><small>卫兵捂着鼻子，露出嫌弃又好笑的表情</small></h3>
        <p class="camp-muted">“看你${state.gender === 'male' ? '男雌婊' : '丫头'}是刚从洞里爬出来还清了债——行，滚回营地去歇着吧。下次想溜号，记得先掂量掂量自己的屁股值几个钱。”</p></div>`,
      actions: [{ label: '回营地', cls: 'btn-primary', handler: () => { Dialog.close(); open() } }],
    })
  }

  /* ============ 铁匠铺：普通NPC + 佩戴监狱贞操装备时有特殊求情 ============ */

  /** 铁匠铺入口：正常进主界面；若已和铁匠签了服务契约则先服务 */

  return {
    open: gloryHole,
    addDebt,
    getStatus,
    hasForcedWork,
    resumeForcedWork,
    clearEnforcementSource,
    lockedServiceGear,
    showServiceGearLockout,
    serviceGearNames,
    routeTownService,
    townServiceDesc,
    isServicePartLocked: townServicePartLocked,
    finishClearedLeave: gloryClearedLeave,
  }
})()
