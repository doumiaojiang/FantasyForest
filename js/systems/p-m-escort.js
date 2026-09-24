/**
 * p-m-escort.js — 欲缚镇 M 线：城门至商团会馆的九格押送小游戏。
 *
 * 可编辑区：EVENTS / GUARD_EVENTS / BOARD。
 * 事件抽取、位置加重、断点恢复与界面渲染都封装在本文件中。
 */
window.PMEscortSystem = (function () {
  const BOARD = ['start', 'event', 'empty', 'event', 'guard', 'event', 'empty', 'event', 'finish']
  const ENTRY_RULES = {
    bellamyTollChance: 0.30,
    soloTollChance: 0.70,
  }

  const EVENTS = [
    { id: 'vendor', name: '摊布后面', icon: '🧺' },
    { id: 'tag', name: '挂牌引来的人', icon: '🏷️' },
    { id: 'drunk', name: '醉汉拦路', icon: '🍺' },
    { id: 'wall', name: '墙根', icon: '🧱' },
    { id: 'double', name: '前后夹住', icon: '↔️' },
    { id: 'display', name: '街边示众', icon: '👁️' },
    { id: 'throat', name: '强制深喉', icon: '🫦' },
  ]

  const GUARD_EVENTS = [
    { id: 'locks', name: '查锁', icon: '🔒' },
    { id: 'oral_check', name: '含着受检', icon: '🛡️' },
    { id: 'shift', name: '同事换岗', icon: '👥' },
    { id: 'report', name: '墙边报号', icon: '📋' },
    { id: 'shield', name: '盾面验收', icon: '🛡️' },
    { id: 'handoff', name: '交给围观者', icon: '👁️' },
  ]

  const state = () => State.get()
  const hole = () => state().gender === 'male' ? '菊穴' : '小穴'
  const save = () => { EventBus.emit('state:changed', state()); State.save() }
  const escort = () => state()._pMEscort
  const choose = list => list[Math.floor(Math.random() * list.length)]
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch])
  const dialogueNames = { '贝': '贝拉米', '墨': '墨菲', '派': '派克', '戴': '戴蒙德', '卫': '值守卫兵', '路': '路人' }
  const normalizeDialogue = html => typeof html === 'string'
    ? html.replace(/<section class="p-hall-order"><span>([^<]+)<\/span>/g, (match, name) => {
        const isPlayer = name === '你' || name === '玩家'
        const fullName = isPlayer ? (state().playerName || '玩家') : (dialogueNames[name] || name)
        return `<section class="p-hall-order gal-dialogue"><span class="${isPlayer ? 'is-player' : 'is-npc'}">${escapeHtml(fullName)}</span>`
      })
    : html

  function ensureEscortGag () {
    if (!window.RestraintSystem) return
    const current = RestraintSystem.get('mouth')
    if (current && current.id === 'leather_gag' && current.source === 'p_m_intake') return
    RestraintSystem.equip('mouth', 'leather_gag', {
      locked: true,
      lockType: 'story',
      source: 'p_m_intake',
      difficulty: 5,
    }, true)
    save()
  }

  function fresh (mode) {
    return {
      started: true,
      gateDone: false,
      mode: mode === 'solo' ? 'solo' : 'bellamy',
      position: 0,
      currentType: null,
      currentId: null,
      currentStep: 0,
      forcedTiles: [],
      publicNotice: false,
      completed: false,
      entryStep: 0,
      entryEvent: null,
      hallArrive: false,
      gagRemovedAtHall: false,
    }
  }

  function start (options = {}) {
    const s = state()
    if (!s._pMEscort || s._pMEscort.completed) s._pMEscort = fresh(options.mode || s._pMEscortMode)
    s._pMEscortMode = s._pMEscort.mode
    ensureEscortGag()
    save()
    resume()
  }

  function resume () {
    const e = escort()
    if (!e || !e.started || e.completed) return false
    ensureEscortGag()
    if (!e.gateDone) showEntryGate()
    else if (e.currentType) showCurrentEncounter()
    else showBoard()
    return true
  }

  function show (options) {
    options.className = `${options.className || ''} p-m-escort-modal`.trim()
    options.body = normalizeDialogue(options.body)
    return CampSystem.showScene(options)
  }

  async function task (options) {
    Dialog.close()
    return BattleUI.showTaskDialog({
      enemyName: options.actor,
      attackName: options.name,
      desc: options.desc,
      bpm: options.bpm || 0,
      seconds: options.seconds || 0,
      taskCount: options.count || 0,
      taskTool: options.tool || '',
      dmg: 0,
      noDamage: true,
      // 押送剧情可能连续出现多段计时任务；保留跳过计时器，方便回看与调试。
      allowSkip: options.allowSkip !== false,
      showFailure: options.showFailure !== false,
      completeLabel: options.completeLabel || '完成',
      dialogClass: 'p-m-escort-task-modal',
    })
  }

  async function mustComplete (options) {
    let failed = true
    while (failed) {
      failed = await task(options)
      if (failed) EventBus.emit('ui:log', { text: `⛓️ ${options.name}没有完成，卫兵命令你重新做。`, type: 'danger' })
    }
  }

  function showEntryGate () {
    const e = escort()
    if (e.entryEvent) {
      show({
        title: '🛡️ 通往街面的门 · 检查尚未结束',
        body: '<section class="scene-dialogue"><i>🛡️</i><div><p>卫兵仍挡在门前。你虽然你已经被检查，我认得你！再给我们检查一遍！</p></div></section>',
        actions: [{ label: '再次给卫兵检查', handler: resumeEntryEvent }],
      })
      return
    }
    if (e.mode === 'solo') {
      show({
        title: '🛡️ 通往街面的门 · 值守卫兵',
        body: `<section class="scene-dialogue"><i>🛡️</i><div><p>卫兵挡住登记桌通往街面的门。他逐一看过项圈、手铐、口塞，以及插入装备和外侧的挂饰。</p></div></section><section class="p-hall-order"><span>卫</span><blockquote>“谁家的货？”</blockquote></section><section class="p-hall-order"><span>你</span><blockquote>“唔……嗯……”</blockquote></section>`,
        actions: [
          { label: '点头，然后转身把妓女牌子夹在大腿中间展示给卫兵看。', handler: () => resolveSoloEntry(false) },
          { label: '摇头，拒绝承认奴隶身份', cls: 'btn-danger', handler: () => resolveSoloEntry(true) },
          { label: '朝登记牌含混地呜咽', handler: () => resolveSoloEntry(false) },
        ],
      })
      return
    }
    show({
      title: '🛡️ 通往街面的门 · 值守卫兵',
      body: `<section class="scene-dialogue"><i>🛡️</i><div><p>卫兵挡住门，先看你嘴上锁着的口塞。贝拉米把牵引链在手里绕了一圈，没有让你回答。</p></div></section><section class="p-hall-order"><span>贝</span><blockquote>“送去见派克。新登记的货物罢了。”</blockquote></section>`,
      actions: [{ label: '等待卫兵检查', handler: resolveBellamyEntry }],
    })
  }

  async function resolveBellamyEntry () {
    const e = escort()
    if (!e.entryEvent) {
      e.entryEvent = Math.random() < ENTRY_RULES.bellamyTollChance ? (Math.random() < 0.5 ? 'bellamy_oral' : 'bellamy_anal') : 'bellamy_pass'
      e.entryStep = 0; save()
    }
    await resumeEntryEvent()
  }

  async function resolveSoloEntry (denied) {
    const e = escort()
    if (denied) {
      e.publicNotice = true
      e.forcedTiles = [2, 6]
      e.entryEvent = 'solo_denied'
      e.entryStep = 0; save()
      EventBus.emit('ui:log', { text: '📣 卫兵向街里宣布有新的货物可以免费使用。（后续空地全部变成事件格）', type: 'danger' })
    } else {
      const roll = Math.random()
      e.entryEvent = roll >= ENTRY_RULES.soloTollChance ? 'solo_pass' : ['solo_oral', 'solo_anal', 'solo_both'][Math.floor(Math.random() * 3)]
      e.entryStep = 0; save()
    }
    await resumeEntryEvent()
  }

  function entryJobs (id) {
    const oral = actor => ({ actor, name: '支付通行费', bpm: 80, seconds: 20, desc: '卫兵临时解开口塞，命你跪在门边按 80 BPM 完成口交二十秒；结束后重新扣紧口塞。' })
    const anal = actor => ({ actor, name: '支付通行费', bpm: 90, seconds: 20, desc: `面对墙壁，按 90 BPM 操${hole()}二十秒。` })
    const jobs = {
      bellamy_pass: [],
      bellamy_oral: [oral('值守卫兵')],
      bellamy_anal: [anal('值守卫兵')],
      solo_pass: [],
      solo_oral: [oral('值守卫兵')],
      solo_anal: [anal('值守卫兵')],
      solo_both: [oral('值守卫兵'), anal('值守卫兵')],
      solo_denied: [
        { actor: '值守卫兵', name: '反抗的代价', count: 5, tool: '手掌', desc: '卫兵嘲笑你像个活体飞机杯一样没用，命令你抬起脸，逐下完成五记巴掌。' },
        oral('值守卫兵一'), oral('值守卫兵二'),
      ],
    }
    return jobs[id] || []
  }

  async function resumeEntryEvent () {
    const e = escort()
    const jobs = entryJobs(e.entryEvent)
    for (let i = e.entryStep || 0; i < jobs.length; i++) {
      await mustComplete(jobs[i])
      e.entryStep = i + 1; save()
    }
    if (e.entryStep === jobs.length) {
      const female = state().gender !== 'male'
      await mustComplete(female
        ? {
            actor: '值守卫兵',
            name: '摇铃取宠',
            seconds: 10,
            desc: '站在门前前后顶胯十秒，挺胸摇晃奶子，让震动棒尾端的铃铛一直作响。',
          }
        : {
            actor: '值守卫兵',
            name: '摇牌取宠',
            seconds: 10,
            desc: '站在门前前后顶胯十秒，把屁股摇得让肛塞下面的妓女牌来回晃动。',
          })
      e.entryStep++; save()
    }
    e.gateDone = true
    e.currentStep = 0
    save()
    showGateRelease()
  }

  function showGateRelease () {
    const female = state().gender !== 'male'
    show({
      title: '🚪 通往街面的门',
      body: female
        ? `<section class="scene-dialogue"><i>🚪</i><div><p>铃铛连响了十秒。卫兵笑着拍了拍门闩，总算让开通往街面的路。</p></div></section><section class="p-hall-order"><span>卫</span><blockquote>“真像个婊子。奶子和铃铛一起摇得这么起劲——（门打开了）行了，快进去吧，让街上的男人都看清楚奴隶制会给我们城镇带来什么好处”</blockquote></section>`
        : `<section class="scene-dialogue"><i>🚪</i><div><p>妓女牌在你身后来回摇了十秒。卫兵看够了，才笑着抽开门闩。</p></div></section><section class="p-hall-order"><span>卫</span><blockquote>“摇得真他妈像骚啊。把那块妓女牌给我夹紧咯——（门打开了）快进去吧，让街上的男人都看清楚奴隶制会给我们城镇带来什么好处。”</blockquote></section>`,
      actions: [{ label: '走进街面', cls: 'btn-primary', handler: showBoard }],
    })
  }

  function tileType (index) {
    const e = escort()
    if ((e.forcedTiles || []).includes(index)) return 'event'
    return BOARD[index]
  }

  function boardHtml () {
    const e = escort()
    const labels = { start: '出门', event: '事件', empty: '街道', guard: '卫兵', finish: '会馆' }
    const icons = { start: '🚪', event: '◆', empty: '·', guard: '🛡️', finish: '🏛️' }
    return `<div class="escort-board" aria-label="城门至商团会馆路线">${BOARD.map((_, i) => {
      const type = tileType(i)
      const status = i < e.position ? ' is-past' : i === e.position ? ' is-current' : ''
      return `<div class="escort-tile is-${type}${status}"><i>${i === e.position ? '♟️' : icons[type]}</i><b>${labels[type]}</b><small>${i + 1}</small></div>`
    }).join('<span class="escort-link">›</span>')}</div>`
  }

  function showBoard () {
    const e = escort()
    if (!e || e.completed) return
    show({
      title: '🏙️ 城门 → 商团会馆',
      body: `${boardHtml()}<section class="escort-status"><b>第 ${e.position + 1} / 9 格</b><span>${e.publicNotice ? '📣 街上已经传开消息，空地也不再安全。' : e.mode === 'solo' ? '牵引链在自己手里；没有贝拉米替你答话。' : '贝拉米牵着链子走在前面。'}</span></section>`,
      actions: e.position >= 8
        ? [{ label: '登上会馆台阶', cls: 'btn-primary', handler: complete }]
        : [{ label: '向前一格', cls: 'btn-primary', handler: moveForward }],
    })
  }

  function moveForward () {
    const e = escort()
    if (!e || e.currentType || e.position >= 8) return
    e.position++
    save()
    resolveTile()
  }

  function resolveTile () {
    const e = escort()
    const type = tileType(e.position)
    if (type === 'event') {
      e.currentType = 'event'; e.currentId = choose(EVENTS).id; e.currentStep = 0; save(); showCurrentEncounter(); return
    }
    if (type === 'guard') {
      e.currentType = 'guard'; e.currentId = choose(GUARD_EVENTS).id; e.currentStep = 0; save(); showCurrentEncounter(); return
    }
    if (type === 'finish') { showBoard(); return }
    show({
      title: '👣 欲缚镇街道',
      body: `${boardHtml()}<section class="scene-dialogue"><i>👣</i><div><p>锁链和挂饰随着脚步轻响。这一段街面暂时没有人拦住你。</p></div></section>`,
      actions: [{ label: '继续', handler: showBoard }],
    })
  }

  function positionRules () {
    const pos = escort().position
    return {
      duration: pos === 3 ? 1.5 : 1,
      people: pos === 7 ? 3 : pos === 5 ? 2 : 1,
      addPeople: pos === 5 ? 1 : 0,
      fixedPeople: pos === 7 ? 3 : 0,
      label: pos === 7 ? '会馆前 · 三人' : pos === 5 ? '后街 · 增加一人' : pos === 3 ? '街心 · 加重一半' : '门前街道',
    }
  }

  function showCurrentEncounter () {
    const e = escort()
    const pool = e.currentType === 'guard' ? GUARD_EVENTS : EVENTS
    const def = pool.find(item => item.id === e.currentId)
    if (!def) { clearEncounter(); return }
    const rules = positionRules()
    show({
      title: `${def.icon} ${e.currentType === 'guard' ? '街心卫兵' : rules.label} · ${def.name}`,
      body: `${boardHtml()}<section class="scene-dialogue"><i>${def.icon}</i><div><h3>${def.name}</h3><p>${encounterPreview(e.currentType, def.id, rules)}</p></div></section>`,
      actions: [
        { label: '接受', cls: 'btn-submissive', handler: runCurrentEncounter },
        { label: '拒绝 / 反抗', cls: 'btn-danger', handler: punishRefusal },
      ],
    })
  }

  function encounterPreview (type, id, rules) {
    if (type === 'guard') return '卫兵拦住你重新检查登记状态。完成这一项检查后才能继续向会馆前进。'
    const extra = rules.people > 1 ? `这一次有 ${rules.people} 个人参与。` : ''
    const map = {
      vendor: '摊贩把摊布掀开一角，指向后面的狭窄空隙。',
      tag: '路人看见肛塞外侧的妓女牌，伸手拽住挂饰。',
      drunk: '醉汉横在路中，骂声引来周围人的目光。',
      wall: `有人把你拉到墙根，手掌按住你的腰。`,
      double: '两个人一前一后堵住退路。',
      display: '有人把你按到街边，叫围观者停下来看。',
      throat: '路人抓住牵引链，把你拉到身前。',
    }
    return `${map[id] || ''}${extra}`
  }

  const scaled = (base, rules) => Math.max(1, Math.round(base * rules.duration))
  const participants = (base, rules) => rules.fixedPeople || Math.max(1, base + rules.addPeople)

  async function runCurrentEncounter () {
    const e = escort()
    let completed = true
    if (e.currentType === 'guard') await runGuardEvent(e.currentId)
    else completed = await runStreetEvent(e.currentId)
    if (completed === false) return
    clearEncounter()
  }

  async function eachPerson (rules, makeTask, basePeople = 1) {
    const total = participants(basePeople, rules)
    for (let i = escort().currentStep || 0; i < total; i++) {
      await mustComplete(makeTask(i, total))
      escort().currentStep = i + 1; save()
    }
  }

  async function runStreetEvent (id) {
    const e = escort()
    const rules = positionRules()
    if (id === 'vendor') {
      await eachPerson(rules, (i, total) => ({ actor: total > 1 ? `摊贩与路人 ${i + 1}/${total}` : '摊贩', name: '摊后口交', bpm: 80, seconds: scaled(20, rules), desc: `在摊布后跪好，按 80 BPM 完成口交。` }))
    } else if (id === 'tag') {
      if (e.currentStep === 0) {
        show({ title: '🏷️ 挂牌引来的人', body: '<section class="p-hall-order"><span>路</span><blockquote>“牌子挂着。自己选，跪下，还是转过去。”</blockquote></section>', actions: [
          { label: '跪下口交', handler: () => { escort().currentStep = 10; save(); runCurrentEncounter() } },
          { label: `转身接受${hole()}使用`, handler: () => { escort().currentStep = 20; save(); runCurrentEncounter() } },
        ] }); return false
      }
      const oral = e.currentStep >= 10 && e.currentStep < 20
      const done = e.currentStep % 10
      e.currentStep = done; save()
      await eachPerson(rules, (i, total) => ({ actor: `路人 ${i + 1}/${total}`, name: oral ? '可以随意使用的口交杯子' : '墙边操穴', bpm: oral ? 100 : 90, seconds: scaled(20, rules), desc: oral ? '（临时打开口塞，结束后再带上）按 100 BPM 完成口交。' : `面对墙壁，按 90 BPM 完成${hole()}插入。` }), 2)
    } else if (id === 'drunk') {
      const count = scaled(5, rules) * rules.people
      await mustComplete({ actor: '醉汉', name: '当街羞辱', count, tool: '手掌', desc: `醉汉大声辱骂，命令你完成 ${count} 下扇脸或揪乳头拉伸并旋转。` })
      forceNextEmpty()
    } else if (id === 'wall') {
      await eachPerson(rules, (i, total) => ({ actor: `路人 ${i + 1}/${total}`, name: '又来了一个免费的便器耶', bpm: 90, seconds: scaled(30, rules), desc: `面对墙根，按 90 BPM 完成${hole()}插入。` }))
    } else if (id === 'double') {
      const total = participants(2, rules)
      for (let i = e.currentStep || 0; i < total; i++) {
        const oral = i % 2 === 0
        await mustComplete({ actor: `围堵者 ${i + 1}/${total}`, name: oral ? '前方口交' : '后方插入', bpm: oral ? 100 : 90, seconds: scaled(20, rules), desc: oral ? '（临时打开口塞，结束后再带上）按 100 BPM 完成前方口交。' : `按 90 BPM 完成${hole()}插入。` })
        e.currentStep = i + 1; save()
      }
    } else if (id === 'display') {
      await mustComplete({ actor: '围观路人', name: '街边示众', count: scaled(6, rules), tool: '出声报句', desc: '保持母猪蹲姿势，按规定次顶胯展示自己是可以免费体验的妓女。' })
      e.publicNotice = true
      ;[2, 6].forEach(index => { if (index > e.position && !e.forcedTiles.includes(index)) e.forcedTiles.push(index) })
      save()
    } else if (id === 'throat') {
      await eachPerson(rules, (i, total) => ({ actor: `路人 ${i + 1}/${total}`, name: '深喉保持', seconds: scaled(15, rules), desc: '（临时打开口塞，结束后再带上）按住姿势完成深喉保持，计时结束前不能松开。' }))
    }
    return true
  }

  function hasStoryDevice (slot, id) {
    const d = window.RestraintSystem && RestraintSystem.get(slot)
    return !!(d && d.id === id && d.source === 'p_m_intake')
  }

  async function runGuardEvent (id) {
    const female = state().gender !== 'male'
    const e = escort()
    const runGuardSteps = async steps => {
      for (let i = e.currentStep || 0; i < steps.length; i++) {
        await mustComplete(steps[i])
        e.currentStep = i + 1; save()
      }
    }
    if (id === 'locks') {
      const required = hasStoryDevice('anal', 'medium_butt_plug') && (!female || hasStoryDevice('vagina', 'vibrating_dildo')) && !!(RestraintSystem.get('neck'))
      if (required) await runGuardSteps([{ actor: '街心卫兵', name: '插入装备查验', count: 20, tool: female ? 'M码震动棒' : 'M码肛塞', desc: female ? '把M码震动棒拔出再插入二十次，检查铃铛是否仍会作响。' : '把M码肛塞拔出再插入二十次，检查妓女牌连接是否牢固。' }])
      else await runGuardSteps([
        { actor: '街心卫兵', name: '缺锁处罚', bpm: 90, seconds: 20, desc: `缺少登记锁具。按 90 BPM 完成${hole()}插入二十秒。` },
        { actor: '街心卫兵', name: '缺锁处罚', bpm: 90, seconds: 20, desc: '（临时打开口塞，结束后再带上）继续完成口部插入二十秒。' },
      ])
    } else if (id === 'oral_check') {
      await runGuardSteps([{ actor: '街心卫兵', name: '含着受检', bpm: 80, seconds: 20, desc: '卫兵临时解开口塞。保持检查姿势，按 80 BPM 完成口交二十秒；检查结束后口塞重新上锁。' }])
    } else if (id === 'shift') {
      await runGuardSteps([
        { actor: '卫兵一', name: '换岗口交', bpm: 90, seconds: 20, desc: '（临时打开口塞，结束后再带上）先完成口交二十秒。' },
        { actor: '卫兵二', name: '换岗插入', bpm: 90, seconds: 20, desc: `再完成${hole()}插入二十秒。` },
      ])
    } else if (id === 'report') {
      await runGuardSteps([{ actor: '街心卫兵', name: '墙边认号', count: 5, tool: '点头或摇头', desc: '口塞仍锁着。保持蹲姿，由卫兵逐项念出编号、奴隶身份与派克的名字；正确就点头，错误就摇头，每次迟疑补一记巴掌。' }])
    } else if (id === 'shield') {
      await runGuardSteps([{ actor: '街心卫兵', name: '盾面验收', bpm: 90, seconds: 30, desc: `身体压在盾面上，按 90 BPM 完成${hole()}插入三十秒。` }])
    } else if (id === 'handoff') {
      await runGuardSteps([
        { actor: '围观者一', name: '前方口交', bpm: 100, seconds: 20, desc: '（临时打开口塞，结束后再带上）按 100 BPM 完成口交二十秒。' },
        { actor: '围观者二', name: '后方插入', bpm: 90, seconds: 20, desc: `按 90 BPM 完成${hole()}插入二十秒。` },
      ])
    }
  }

  function forceNextEmpty () {
    const e = escort()
    const next = BOARD.findIndex((type, index) => index > e.position && type === 'empty' && !e.forcedTiles.includes(index))
    if (next >= 0) e.forcedTiles.push(next)
    save()
  }

  async function punishRefusal () {
    const e = escort()
    Dialog.close()
    for (let i = e.currentStep || 0; i < 3; i++) {
      const oral = Math.random() < 0.5
      await mustComplete({ actor: `检查点卫兵 ${i + 1}/3`, name: '反抗惩罚', bpm: 90, seconds: 20, desc: oral ? '被押回检查点，（临时打开口塞，结束后再带上）按 90 BPM 完成口交二十秒。' : `被押回检查点，按 90 BPM 完成${hole()}惩罚二十秒。` })
      e.currentStep = i + 1; save()
    }
    const refusedPosition = e.position
    e.position = refusedPosition >= 4 ? 4 : 0
    e.currentType = null; e.currentId = null; e.currentStep = 0
    save()
    if (e.position === 4) resolveTile()
    else showBoard()
  }

  function clearEncounter () {
    const e = escort()
    e.currentType = null; e.currentId = null; e.currentStep = 0
    save()
    showBoard()
  }

  function complete () {
    const e = escort()
    e.completed = true
    e.currentType = null; e.currentId = null; e.currentStep = 0
    save()
    EventBus.emit('ui:log', { text: '🏛️ 穿过九格街道，抵达商团会馆台阶。', type: 'warning' })
    if (window.PMEnslavementSystem && PMEnslavementSystem.finishEscort) PMEnslavementSystem.finishEscort()
  }

  return { start, resume, complete, BOARD, ENTRY_RULES, EVENTS, GUARD_EVENTS }
})()
