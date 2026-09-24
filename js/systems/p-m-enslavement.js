/**
 * systems/p-m-enslavement.js — 欲缚镇 M 路线第一章「入库」。
 *
 * 章节只保存可序列化进度；营地负责入口，BattleUI 负责计时/计数任务。
 * 每个任务前后都写入断点，刷新后不会跳过或重复结算已经完成的段落。
 */
window.PMEnslavementSystem = (function () {
  const openCamp = () => CampSystem.open()
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch])
  const dialogueNames = { '贝': '贝拉米', '墨': '墨菲', '派': '派克', '戴': '戴蒙德', '卫': '值守卫兵', '路': '路人' }
  const normalizeDialogue = html => typeof html === 'string'
    ? html.replace(/<section class="p-hall-order"><span>([^<]+)<\/span>/g, (match, name) => {
        const isPlayer = name === '你' || name === '玩家'
        const fullName = isPlayer ? (State.get().playerName || '玩家') : (dialogueNames[name] || name)
        return `<section class="p-hall-order gal-dialogue"><span class="${isPlayer ? 'is-player' : 'is-npc'}">${escapeHtml(fullName)}</span>`
      })
    : html
  const show = options => {
    options.body = normalizeDialogue(options.body)
    options.actions = (options.actions || []).map(action => {
      const normalized = { ...action }
      delete normalized.cls
      if (action.tone === 'submit') normalized.cls = 'btn-submissive'
      if (action.tone === 'resist') normalized.cls = 'btn-danger'
      delete normalized.tone
      return normalized
    })
    return CampSystem.showScene(options)
  }

  let groomResist = 0

  /* ==================== 通用状态与任务工具 ==================== */

  function state () { return State.get() }

  function save () {
    const s = state()
    EventBus.emit('state:changed', s)
    State.save()
  }

  function hole () { return state().gender === 'male' ? '菊穴' : '小穴' }

  function chapterBranch () { return state()._pMChapterBranch || 'novice' }

  function eligible () {
    const s = state()
    return s._pRole === 'slave' && s._pMainlineStage >= 2 && !s._pMChapterCompleted
  }

  function setStage (stage, step = 0) {
    const s = state()
    s._pMChapterStage = stage
    s._pMChapterStep = step
    save()
  }

  async function task (options) {
    if (typeof BattleUI === 'undefined' || !BattleUI.showTaskDialog) return false
    return BattleUI.showTaskDialog({
      enemyName: options.actor,
      attackName: options.name,
      desc: options.desc,
      bpm: options.bpm || 0,
      seconds: options.seconds || 0,
      taskCount: options.count || 0,
      taskTool: options.tool || '',
      taskSteps: options.steps || [],
      dmg: 0,
      noDamage: true,
      completeLabel: options.completeLabel || '完成',
      dialogClass: 'p-m-enslavement-task-modal',
    })
  }

  function recordFailure (failed) {
    if (!failed) return
    const s = state()
    s._pMChapterFailures = Math.min(99, (s._pMChapterFailures || 0) + 1)
    EventBus.emit('ui:log', { text: '⛓️ 入库任务没有完成；墨菲在记录旁添了一道失败记号。剧情仍会继续。', type: 'danger' })
    save()
  }

  function clone (value, fallback) {
    try { return JSON.parse(JSON.stringify(value)) } catch (_) { return fallback }
  }

  function confiscateOnKnockout () {
    const s = state()
    if (s._pMConfiscated) return
    const legacy = s._pMChapterEscrow && typeof s._pMChapterEscrow === 'object' ? s._pMChapterEscrow : {}
    s._pMConfiscationEscrow = {
      gold: Math.max(0, Number(s.gold) || 0),
      inventory: {
        weapon: legacy.weapon || s.inventory.weapon || null,
        accessory: s.inventory.accessory || null,
        accessories: Array.isArray(legacy.accessories) && legacy.accessories.length ? [...legacy.accessories] : [...(s.inventory.accessories || [])],
        consumables: clone(s.inventory.consumables || {}, {}),
      },
      ownedEquipment: [...(s.ownedEquipment || [])],
      restraints: {
        worn: clone(s._restraints || {}, {}),
        owned: [...(s._ownedRestraints || [])],
        ownedCounts: clone(s._ownedRestraintCounts || {}, {}),
        insertionCharges: clone(s._insertionCharges || {}, {}),
        storedInsertionCharges: clone(s._storedInsertionCharges || {}, {}),
      },
      prostitute: {
        gear: clone(s._prostituteGear || {}, {}),
        ownedGear: [...(s._ownedProstituteGear || [])],
        equippedGear: clone(s._equippedProstituteGear || {}, {}),
        dressed: !!s._prostituteDressed,
      },
    }
    if (window.RestraintSystem) {
      RestraintSystem.SLOT_ORDER.forEach(slot => {
        if (RestraintSystem.get(slot)) RestraintSystem.remove(slot, true)
      })
    }
    s.gold = 0
    s.inventory.weapon = null
    s.inventory.accessory = null
    s.inventory.accessories = []
    s.inventory.consumables = {}
    s.ownedEquipment = []
    s._restraints = {}
    s._ownedRestraints = []
    s._ownedRestraintCounts = {}
    s._insertionCharges = {}
    s._storedInsertionCharges = {}
    s._restraintContract = null
    s._prostituteGear = {}
    s._ownedProstituteGear = []
    s._equippedProstituteGear = {}
    s._prostituteDressed = false
    s._pMWakeGearEscrow = null
    s._pMChapterEscrow = null
    s._pMConfiscated = true
    if (window.StatusSystem && !StatusSystem.has('naked')) StatusSystem.apply('naked', 99999, { source: 'p_m_intake' })
    EventBus.emit('ui:log', { text: '📦 你昏迷时身上的妖缚与姓女装备已被全部解除；金币、武器和所有道具被商团没收。', type: 'danger' })
    save()
  }

  function wearWakeGear (slot, id) {
    if (!window.RestraintSystem) return
    const current = RestraintSystem.get(slot)
    if (current && current.id === id && current.source === 'p_m_wake') return
    const s = state()
    if (!s._pMWakeGearEscrow || typeof s._pMWakeGearEscrow !== 'object') s._pMWakeGearEscrow = {}
    if (current && current.source !== 'p_m_wake' && !s._pMWakeGearEscrow[slot]) {
      s._pMWakeGearEscrow[slot] = JSON.parse(JSON.stringify(current))
    }
    RestraintSystem.equip(slot, id, { locked: true, lockType: 'story', source: 'p_m_wake', difficulty: 5 }, true)
    save()
  }

  function dropWakeGear (slot, id) {
    if (!window.RestraintSystem) return
    const current = RestraintSystem.get(slot)
    if (!current || current.id !== id || current.source !== 'p_m_wake') return
    RestraintSystem.remove(slot, true)
    const previous = state()._pMWakeGearEscrow && state()._pMWakeGearEscrow[slot]
    if (previous) RestraintSystem.restore(slot, previous)
    save()
  }

  function markWakeResist () {
    const s = state()
    s._pMWakeResist = Math.min(3, (s._pMWakeResist || 0) + 1)
    save()
  }

  /* ==================== Stage 0 · 打晕、没收与醒来 ==================== */

  function showStage0 () {
    confiscateOnKnockout()
    state()._pMWakeResist = 0
    state()._pMSpankStack = 1
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🌑</i><div><h3>眼前一黑。</h3></div></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: showWakeBlindfoldEquip }],
    })
  }

  function showWakeBlindfoldEquip () {
    wearWakeGear('eyes', 'blindfold')
    show({
      title: '⛓️ 收容笼 · 眼罩',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: '<section class="scene-dialogue"><i aria-hidden="true">🌑</i><div><p>在你还没醒来时，一条厚皮带覆住双眼，绕到脑后收紧。最后一点光被完全挡住。</p></div></section>',
      actions: [{ label: '确认眼罩已佩戴', cls: 'btn-primary', handler: showWakeGagEquip }],
    })
  }

  function showWakeGagEquip () {
    wearWakeGear('mouth', 'leather_gag')
    show({
      title: '⛓️ 收容笼 · 口塞',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: '<section class="scene-dialogue"><i aria-hidden="true">🤐</i><div><p>球形口塞被压进嘴里，扣带紧贴脸颊系好。你尚未恢复意识，嘴已经无法合上。</p></div></section>',
      actions: [{ label: '确认球形口塞已佩戴', cls: 'btn-primary', handler: showWakeCuffsEquip }],
    })
  }

  function showWakeCuffsEquip () {
    wearWakeGear('arms', 'handcuffs')
    show({
      title: '⛓️ 收容笼 · 手铐',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: '<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><p>双臂被拉到身后。铁环依次扣住手腕，中间的短链只留下很小的活动余地。</p></div></section>',
      actions: [{ label: '确认反铐手铐已佩戴', cls: 'btn-primary', handler: showWakeLegCuffsEquip }],
    })
  }

  function showWakeLegCuffsEquip () {
    wearWakeGear('legs', 'leg_cuffs')
    show({
      title: '⛓️ 收容笼 · 脚镣',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: '<section class="scene-dialogue"><i aria-hidden="true">🔗</i><div><p>两枚脚镣在脚踝上合拢，短链垂到冰冷的石板上。你被放成跪姿，四件临时束缚到此全部扣好。</p></div></section>',
      actions: [{ label: '确认短链脚镣已佩戴', cls: 'btn-primary', handler: showHeadache }],
    })
  }

  function showHeadache () {
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🌑</i><div><p>头好疼。后颈那一记还在跳，像被人从后面砸晕过。</p><p>你想抬手去摸。手被铐在身后，肩一扯就到头了，指尖碰不到头发，也碰不到那块肿起来的地方。</p></div></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: showBlindfold }],
    })
  }

  function showBlindfold () {
    wearWakeGear('eyes', 'blindfold')
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🌑</i><div><p>眼前还是黑的。眼罩勒在眼睛上。</p><p>你光着跪在凉石板上。手仍然反铐着，只能把发晕的头垂下去。</p></div></section>`,
      actions: [{ label: '挣扎', tone: 'resist', handler: showBlindStruggle }],
    })
  }

  function showBlindStruggle () {
    wearWakeGear('mouth', 'leather_gag')
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><p>你一挣，才知道自己是什么姿势。</p><p>双手被铐在身后，肩被拉得往后张。脚腕上的链子很短，并拢了也迈不开。嘴里塞着口塞，舌头顶上去，只挤出一声含混的声音，唾液顺着下巴往胸口滴。</p></div></section>`,
      actions: [{ label: '聆听', cls: 'btn-primary', handler: showBlindListen }],
    })
  }

  function showBlindListen () {
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">👂</i><div><p>你停下来听。不止你一个。</p><p>旁边有女人的声音，被口塞压成又短又湿的呜咽。锁链跟着那声音轻轻响。有人在笑，像是在看她们怎么跪。</p></div></section>`,
      actions: [{ label: '探索', cls: 'btn-primary', handler: showBlindSearch }],
    })
  }

  function showBlindSearch () {
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">✋</i><div><p>你想摸索身边有什么。手铐把两只手锁在身后，指尖只能碰到自己的腰和光裸的臀。</p><p>再往前探，什么都没有。没有笼门，没有别人的身体，只有自己被分开的腿，和还塞在嘴里的口塞。</p></div></section>`,
      actions: [{ label: '有脚步声。', cls: 'btn-primary', handler: showBlindfoldRemoved }],
    })
  }

  function showBlindfoldRemoved () {
    dropWakeGear('eyes', 'blindfold')
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">👁️</i><div><p>眼罩被扯下，灯光刺得你立刻偏过头。贝拉米捏住下巴，把你的脸转回来。墨菲站在桌后，登记刚刚收走的金币和装备。</p></div></section><section class="p-hall-order"><span>贝</span><blockquote>“看着我。”</blockquote></section>`,
      actions: [
        { label: '……', cls: 'btn-primary', handler: showGagRemoved },
        { label: '挣扎', tone: 'resist', handler: showBlindfoldStruggle },
      ],
    })
  }

  function showBlindfoldStruggle () {
    markWakeResist()
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><p>你偏开脸。手铐扯紧肩膀，人还是跪在原地。贝拉米把你的脸转回来，手没有松开。</p></div></section><section class="p-hall-order"><span>贝</span><blockquote>“再他妈乱动，我他妈揍死你。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: showGagRemoved }],
    })
  }

  function showGagRemoved () {
    dropWakeGear('mouth', 'leather_gag')
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🤐</i><div><p>贝拉米摘掉了你的口塞。</p><p>口水拉成一条线，挂在下巴上。你能张嘴了，他还没有让你说话。</p></div></section>`,
      actions: [
        { label: '......(我……不知道该说什么)', cls: 'btn-primary', handler: showWhipIntro },
        { label: '反抗', tone: 'resist', handler: showGagResist },
      ],
    })
  }

  function showGagResist () {
    markWakeResist()
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">👄</i><div><p>你刚张开嘴，想骂他。贝拉米把短鞭柄抵住你的舌头，话被堵了回去。口水顺着鞭柄往下滴。</p></div></section><section class="p-hall-order"><span>贝</span><blockquote>“让你说话了吗。嘴给我闭上。”</blockquote></section>`,
      actions: [{ label: '......', cls: 'btn-primary', handler: showWhipIntro }],
    })
  }

  function showWhipIntro () {
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“你是我们的新奴隶。不用说话。我先把你准备好，然后去见派克。”</blockquote></section>`,
      actions: [{ label: '现在会怎样？', cls: 'btn-primary', handler: showWhipIntro2 }],
    })
  }

  function showWhipIntro2 () {
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“你现在是我们的奴隶。去见派克之前，先抽一顿。奴隶都要定期挨鞭子。”</blockquote></section>`,
      actions: [
        { label: '不要。这鞭子疼死了。', tone: 'resist', handler: showWhipNo },
        { label: '我能做点什么，让你别打吗？', tone: 'submit', handler: showWhipSpare },
        { label: '听话就会少挨打？', tone: 'submit', handler: showWhipObey },
      ],
    })
  }

  function showWhipNo () {
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“   你会恨这个。可你得学会忍真正的疼。贱货。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: showFirstOrder }],
    })
  }

  function showWhipSpare () {
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“现在？不能。你得学。做个乖奴隶，主人会少抽你。但还是会抽。”</blockquote></section>`,
      actions: [{ label: '所以我听话、接受，就会少挨打？', tone: 'submit', handler: showWhipObey }],
    })
  }

  function showWhipObey () {
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“当然。听话就少罚，只有出错才罚。别的奴隶出错，你也要一起挨，就像我们对戴蒙德那样。主人想听你叫，也会抽。现在开始。让我听见你叫。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: showFirstOrder }],
    })
  }

  function showFirstOrder () {
    const extra = (state()._pMWakeResist || 0) * 10
    const hits = 20 + extra
    show({
      title: '⛓️ 城门 · 惩罚台',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🔒</i><div><p>贝拉米用短鞭抵着你的锁骨。${extra ? '他看了一眼你刚才挣过的地方，下数已经加进去了。' : ''}</p></div></section><section class="p-hall-order"><span>贝</span><blockquote>“趴好，别乱动。等会儿鞭子抽一下，你报一下数。听见没。”</blockquote></section>${extra ? '<section class="p-hall-order"><span>贝</span><blockquote>“刚才乱动那些，算这轮里。报错就再来。”</blockquote></section>' : ''}`,
      actions: [
        { label: '……照做。', tone: 'submit', handler: () => begin('spank') },
        { label: '挣扎', tone: 'resist', handler: showOrderStruggle },
      ],
    })
  }

  function showOrderStruggle () {
    markWakeResist()
    show({
      title: '⛓️ 城门 · 惩罚台',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><p>贝拉米眯起眼，指节在桌边上敲了两下。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“哟，还敢动？”</blockquote></section>
        <section class="scene-dialogue"><i aria-hidden="true">✋</i><div><p>他揪住你后脑的头发，把你的脸拽起来，对上他的眼睛。另一只手解下腰上的短鞭，在掌心里绕了两圈。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“行啊。我在城门干了这么多年，拧过的人比你见过的都多。你现在扭得欢，等下趴这桌上，有你哭的时候。”</blockquote></section>
        <section class="scene-dialogue"><i aria-hidden="true">👁️</i><div><p>他退开半步，从上到下看了你一遍。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“最后问你一次。自己趴上去，还是我帮你摆？”</blockquote></section>`,
      actions: [
        { label: '自己趴上去。', tone: 'submit', handler: () => begin('spank') },
        { label: '让他摆。', tone: 'submit', handler: () => { markWakeResist(); begin('spank') } },
      ],
    })
  }

  /* ==================== Stage 500 · 第一轮惩罚 ==================== */

  function begin (attitude) {
    const s = state()
    if (!eligible()) { openCamp(); return }
    s._pMChapterAttitude = ['spank', 'oral', 'spread'].includes(attitude) ? attitude : 'spank'
    s._pMChapterStage = 500
    s._pMChapterStep = 0
    s._pChapterOneLocked = true
    EventBus.emit('ui:log', { text: '⛓️ 入库的第一条命令开始执行。', type: 'danger' })
    save()
    runStage500()
  }

  async function runStage500 () {
    Dialog.close()
    const s = state()
    if ((s._pMChapterStep || 0) < 1) {
      s._pMChapterStep = 0; save()
      const base = 20 + (s._pMWakeResist || 0) * 10
      if (!s._pMSpankStack || s._pMSpankStack < 1) s._pMSpankStack = 1
      let failed = true
      while (failed) {
        const hits = base * s._pMSpankStack
        failed = await task({
          actor: '贝拉米', name: '挨打',
          desc: `双手锁在身后，腰趴下去，把屁股送到短鞭底下。${hits}下，一下一声报数。没打完就翻倍再来。`,
          count: hits, tool: '手掌或短鞭',
          completeLabel: '打完了',
        })
        if (!failed) break
        s._pMSpankStack *= 2
        save()
        EventBus.emit('ui:log', { text: `⛓️ 贝拉米：“没打完？翻倍。哭也接着打。下一轮 ${base * s._pMSpankStack} 下。”`, type: 'danger' })
      }
      s._pMSpankStack = 1
      state()._pMChapterStep = 1; save()
    }
    showAfterSpank()
  }

  function showAfterSpank () {
    show({
      title: '⛓️ 城门 · 收容笼',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><p>短鞭停了。你还趴着，刚挨过的地方一阵一阵地热。贝拉米用鞭梢在你腰上点了一下，示意你起来。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“起来。打完了。去水槽那边。脏成这样，不能见派克。”</blockquote></section>`,
      actions: [{ label: '跟着他走。', cls: 'btn-primary', handler: showIntakePreparation }],
    })
  }

  /* ==================== Stage 500 → 1000 · 清洗、剪理与正式锁具 ==================== */

  

  function showIntakePreparation () {
    groomResist = 0
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🪒</i><div><p>贝拉米把你带到水槽前，按住肩膀迫使你站稳。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“腿分开。”</blockquote></section>`,
      actions: [
        { label: '……', handler: showIntakeWash },
        { label: '挣扎', tone: 'resist', handler: showIntakeDragStruggle },
      ],
    })
  }

  function showIntakeDragStruggle () {
    groomResist += 1
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">✋</i><div><p>你想挣开。贝拉米没拉你，抬手就是三巴掌，糊在脸上。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“还想抵抗？三下。一下一声。没挨完就翻倍。”</blockquote></section>`,
      actions: [{ label: '把脸转过来。', cls: 'btn-danger', handler: runIntakeSlaps }],
    })
  }

  async function runIntakePunish (kind, next) {
    Dialog.close()
    const spec = kind === 'pinch'
      ? { name: '揪乳头', tool: '手指', line: '两边乳头揪', done: '揪完了' }
      : { name: '巴掌', tool: '手掌', line: '左右扇', done: '打完了' }
    let stack = 1
    let failed = true
    while (failed) {
      const hits = 3 * stack
      failed = await task({
        actor: '贝拉米', name: spec.name,
        desc: `${spec.line} ${hits} 下，一下一声报数。没做完就翻倍再来。`,
        count: hits, tool: spec.tool,
        completeLabel: spec.done,
      })
      if (!failed) break
      stack *= 2
      EventBus.emit('ui:log', { text: `✋ 贝拉米：“没做完？翻倍。下一轮 ${3 * stack} 下。”`, type: 'danger' })
    }
    next()
  }

  function runIntakeSlaps () { return runIntakePunish('slap', showIntakeWash) }

  function showIntakeWash () {
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">💧</i><div><p>冷水从后颈浇下来。墨菲低头看了一眼记录纸。</p></div></section>
        <section class="p-hall-order"><span>墨</span><blockquote>“转过去。把下面冲干净。”</blockquote></section>`,
      actions: [
        { label: '……', handler: showIntakeShave },
        { label: '挣扎', tone: 'resist', handler: showIntakeWashStruggle },
      ],
    })
  }

  function showIntakeWashStruggle () {
    groomResist += 1
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">💧</i><div><p>你并紧双腿，清洗的人停了手。贝拉米把短鞭往腰带上一挂，歪着头看你。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“啧……又闹？”</blockquote></section>
        <section class="scene-dialogue"><i aria-hidden="true">👢</i><div><p>他走到你面前半步，居高临下看着你还在发抖的肩膀。拇指蹭过你脸上没干的水。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“你以为这就完了？身上的血汗不洗干净，伤口烂了，吃亏的是你自己。你非要这么拖着去笼子里躺，我也不拦。正好省我一桶水。”</blockquote></section>
        <section class="scene-dialogue"><i aria-hidden="true">⏳</i><div><p>他说完不催，就站在那儿等。自己过去，或者等他再动手，洗还是要洗。</p></div></section>`,
      actions: [
        { label: '自己走到水槽前。', tone: 'submit', handler: showIntakeShave },
        { label: '不动。', tone: 'resist', handler: () => runIntakePunish('pinch', showIntakeWashForced) },
      ],
    })
  }

  function showIntakeWashForced () {
    groomResist += 1
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">💧</i><div><p>贝拉米拽住你的胳膊，把你按回水槽边。冷水重新浇下来，他按着你的后颈，直到身上的血汗冲掉。一桶水还是用了。</p></div></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: showIntakeShave }],
    })
  }

  function showIntakeShave () {
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🪒</i><div><p>刀片贴着小腹。毛掉进水槽。贝拉米靠在锁具柜上，看着你的腿。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“腿张开，别躲。毛得刮干净，锁才扣得上去。”</blockquote></section>`,
      actions: [
        { label: '……', handler: showIntakeMeasure },
        { label: '反抗', tone: 'resist', handler: showIntakeShaveStruggle },
      ],
    })
  }

  function showIntakeShaveStruggle () {
    groomResist += 1
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🪒</i><div><p>你一缩，刀片在腿根停住。墨菲抬起手。贝拉米没有马上按你，只看了一眼那把刀。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“刀都搁腿上了还缩？刮不干净，锁扣不贴肉。你爱留着毛去磨，磨破了也是你自己疼。腿自己打开，还是我按着你刮完。”</blockquote></section>`,
      actions: [
        { label: '把腿打开。', tone: 'submit', handler: showIntakeMeasure },
        { label: '不打开。', tone: 'resist', handler: () => runIntakePunish('slap', showIntakeShaveForced) },
      ],
    })
  }

  function showIntakeShaveForced () {
    groomResist += 1
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🪒</i><div><p>贝拉米按住你的大腿，把腿扳开。墨菲顺着那道红把剩下的毛刮完。刀没有停。</p></div></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: showIntakeMeasure }],
    })
  }

  function showIntakeMeasure () {
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📏</i><div><p>墨菲用软尺量过你的脖子和四肢，把数字逐项写进表里。</p></div></section>
        <section class="p-hall-order"><span>墨</span><blockquote>“项圈收紧一格。手铐用最短的链。”</blockquote></section>
        <section class="scene-dialogue"><i aria-hidden="true">🔒</i><div><p>贝拉米捏着你的下巴看了一会儿。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“腰上的也换小号。别留空隙，省得你往里藏东西。”</blockquote></section>`,
      actions: [
        { label: '……', cls: 'btn-danger', handler: finishIntakePreparation },
        { label: '挣扎', cls: 'btn-danger', handler: showIntakeMeasureStruggle },
      ],
    })
  }

  function showIntakeMeasureStruggle () {
    groomResist += 1
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📏</i><div><p>你吸气，想把腰从软尺里撤出来。墨菲的手停在尺上，没有马上收紧。贝拉米看着那圈松出来的尺寸。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“尺都在腰上了你还吸气？写下来的就是要扣的尺寸。你缩，我就按最紧的写。”</blockquote></section>`,
      actions: [
        { label: '把气吐出来。', tone: 'submit', handler: finishIntakePreparation },
        { label: '继续缩着。', tone: 'resist', handler: () => runIntakePunish('pinch', showIntakeMeasureForced) },
      ],
    })
  }

  function showIntakeMeasureForced () {
    groomResist += 1
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📏</i><div><p>贝拉米按住你的肚子，把那口气压出去。墨菲把软尺收到最紧的一格，数字重写了一遍。</p></div></section>
        <section class="p-hall-order"><span>墨</span><blockquote>“按最紧的那一圈写。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: finishIntakePreparation }],
    })
  }
  function installIntakeRestraints () {
    const s = state()
    if (s._pMChapterRestraintEscrow || !window.RestraintSystem) return
    const devices = [
      ['neck', 'slave_collar'],
      ['arms', 'handcuffs'],
      ['legs', 'leg_cuffs'],
      ['waist', s.gender === 'male' ? 'vibrating_chastity' : 'chastity_device'],
    ]
    s._pMChapterRestraintEscrow = {}
    devices.forEach(([slot, id]) => {
      const previous = RestraintSystem.get(slot)
      if (previous) s._pMChapterRestraintEscrow[slot] = JSON.parse(JSON.stringify(previous))
      RestraintSystem.equip(slot, id, { locked: true, lockType: 'story', source: 'p_m_intake', difficulty: 5 + groomResist }, true)
    })
    EventBus.emit('ui:log', { text: '🔒 商团为你扣上正式项圈、手铐、脚镣和贞操锁；这些是奴役线剧情锁。', type: 'danger' })
    save()
  }

  function finishIntakePreparation () {
    const s = state()
    s._pMGroomed = true
    installIntakeRestraints()
    setStage(1000)
    showAfterLocks()
  }
  function showAfterLocks () {
    show({
      title: '🪒 城门 · 笼子前',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📏</i><div><p>他把软尺收起来，你的身体各项尺寸已经写进表里。项圈、手铐、脚镣和腰上的锁也扣死了。墨菲把表夹在腋下。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“量完了。起来。登记桌在那边。”</blockquote></section>`,
      actions: [{ label: '被他拉起来。', cls: 'btn-primary', handler: showWalkToDesk }],
    })
  }

  function showWalkToDesk () {
    show({
      title: '📖 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><p>贝拉米抓住你的项圈链，把你从笼子前拖到登记桌。脚镣磕在石板上。他在桌后坐下，链子一收，你被拉到他的靴子前面。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“跪下。问你话，看着我答。”</blockquote></section>`,
      actions: [{ label: '跪在他脚前。', cls: 'btn-danger', handler: showKneelForQuestion }],
    })
  }

  function showKneelForQuestion () {
    const s = state()
    s._pMChapterStep = 1
    save()
    show({
      title: '📖 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🧎</i><div><p>你跪在贝拉米脚前。他的靴尖抵着你的膝盖。墨菲站在桌侧，把记录翻到下一栏。</p></div></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: showStage1000 }],
    })
  }



  /* ==================== Stage 1000 · 经历询问与路线分支 ==================== */

  function showStage1000 () {
    show({
      title: '📖 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📖</i><div><p>你还跪在他脚前。墨菲的笔尖停在下一栏。贝拉米低头看着你。</p></div></section>
        <section class="p-hall-order"><span>墨</span><blockquote>“你还是雏穴不？”</blockquote></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“自己说。”</blockquote></section>`,
      actions: [
        { label: '是。我还是。', cls: 'btn-danger', handler: () => chooseBranch('novice') },
        { label: '不是。我被人操过,我自愿的。', handler: () => chooseBranch('experienced') },
        { label: '不是。我以前被强奸过。', handler: () => chooseBranch('surrender') },
      ],
    })
  }

  function chooseBranch (branch) {
    const s = state()
    s._pMChapterBranch = branch
    save()
    if (branch === 'novice') showVirginYes()
    else if (branch === 'experienced') showNeverRaped()
    else showAlreadyRaped()
  }

  function showVirginYes () {
    show({
      title: '📖 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“什么？你是说你……你还是雏穴？”</blockquote></section>`,
      actions: [{ label: '是。我还是。求你别这样。', cls: 'btn-danger', handler: showVirginBeg }],
    })
  }

  function showVirginBeg () {
    show({
      title: '📖 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“没想到这么漂亮的奴隶还没被人碰过。那正好。第一次由我来。我会好好干你。第一次会疼，会出血。没人说过变成一个真正的奴隶很容易。”</blockquote></section>`,
      actions: [
        { label: '不能这样。不......', cls: 'btn-danger', handler: showVirginRefuse },
        { label: '你的东西太大了。会把我弄伤的。', handler: showVirginSize },
      ],
    })
  }

  function showVirginRefuse () {
    show({
      title: '📖 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“呵呵,先给你破个处，再变成我们听话的奴隶。派克要是想要，以后再训练成性奴隶。”</blockquote></section>`,
      actions: [{ label: '你的东西太大了。会把我弄伤的。', cls: 'btn-danger', handler: showVirginSize }],
    })
  }

  function showVirginSize () {
    show({
      title: '📖 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“那不是东西，是鸡巴。是大鸡巴,懂了吗!!!你下面那么紧。倒霉的是你,痛的又不是我,我不在乎。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: runStage1500 }],
    })
  }

  function showNeverRaped () {
    state()._pMChapterBranch = 'experienced'
    save()
    show({
      title: '📖 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“那就好。希望你下面还没被操成烂屄。墨菲，看着。强奸一个奴隶的穴就是这么简单：一下整根捅进去，然后按着怼着深处就是猛干。你到死都会记住我是你第一个强奸你的人。过几周，用过你的男人会有几十个,甚至上百个,哈哈哈哈哈。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: runStage1500 }],
    })
  }

  function showAlreadyRaped () {
    show({
      title: '📖 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“真扫兴。这样我现在没兴趣强奸你。如果不是第一个强奸你的人，那将毫无意义。滚吧，烂屄贱货。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: () => { setStage(2000); open() } }],
    })
  }

  /* ==================== Stage 1500 · 第一次验收 ==================== */

  function showStage1500 () {
    if ((state()._pMChapterStep || 0) >= 1) { showStage1500After(); return }
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">◇</i><div><p>墨菲在「雏穴」那一栏写下「是」。贝拉米看完，把验收凳踢到你面前。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“还是第一次？行。凳子上趴好。手背到后面，腿打开。我现在就让你知道破处什么感觉。”</blockquote></section>`,
      actions: [
        { label: '趴上去。', tone: 'submit', handler: runStage1500 },
        { label: '不趴。', tone: 'resist', handler: showStage1500Forced },
      ],
    })
  }

  function showStage1500Forced () {
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">◇</i><div><p>贝拉米按住你的后颈，把你按到凳面上。腿被他踢开，手拉到背后。墨菲的笔停在半空。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“不趴也得趴。第一次我来摆。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: runStage1500 }],
    })
  }

  async function runStage1500 () {
    Dialog.close()
    const failed = await task({
      actor: '贝拉米', name: '破处之日', bpm: 90, seconds: 60,
      desc: `你趴在验收凳上，双手背在身后。贝拉米抵进${hole()}，按 90 BPM 抽六十秒。腿不许并上。`,
      steps: [
        { at: 0, label: '趴稳', text: '胸口贴着凳面，腿分开，手背到后面。按 90 BPM 做六十秒。' },
      ],
    })
    recordFailure(failed)
    state()._pMChapterStep = 1
    save()
    showStage1500After()
  }

  function showStage1500After () {
    const novice = chapterBranch() === 'novice'
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">◇</i><div><p>他退出来。你还趴着。</p></div></section>
        <section class="p-hall-order"><span>你</span><blockquote>${novice ? '“你拿走了我的第一次。我本来想要它是浪漫的……”' : '“你强迫了我。以前从没有人这样对过我……”'}</blockquote></section>
        <section class="p-hall-order"><span>贝</span><blockquote>${novice ? '“对，我拿走了。以后别人强奸你，都可以拿来跟我比。第一根鸡巴永远最记得住。你会梦见我射在里面，混着你的第一滴血淌出来。”' : '“那就记住这一次。以前那些情人会问你愿不愿意，我不会。以后用你的男人也不会。”'}</blockquote></section>`,
      actions: [
        { label: '我没有爽。你胡说。', tone: 'resist', handler: showStage1500Deny },
        { label: '别人会看不起我。', handler: showStage1500ShamePublic },
      ],
    })
  }

  function showStage1500Deny () {
    const novice = chapterBranch() === 'novice'
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>你</span><blockquote>“我....我怎么可能爽？我不会那样。”</blockquote></section>
        <section class="p-hall-order"><span>贝</span><blockquote>${novice ? '“你高潮了。我破你处的时候，大家都看见了。别结巴。今天还会有很多鸡巴干你。第一根永远最记得住。我的就是你的第一根。”' : '“你高潮了，墨菲也看见了。别拿以前那些情人当借口；今天还会有很多男人用你，而他们不会先问。”'}</blockquote></section>`,
      actions: [
        { label: '我为什么会高潮？这是错的。', tone: 'resist', handler: showStage1500Why },
        { label: '你的东西太大了，疼。', handler: showStage1500Cock },
        { label: '我好羞耻。', cls: 'btn-primary', handler: showStage1500Shame },
      ],
    })
  }

  function showStage1500Why () {
    const novice = chapterBranch() === 'novice'
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>${novice ? '“别结巴。今天还会有很多鸡巴干你。第一根永远最记得住。我的就是你的第一根，干你，还让你高潮。”' : '“身体有反应不等于有人问过你。今天还会有很多男人用你。记住这一次，因为这是你第一次明白奴隶没有选择。”'}</blockquote></section>`,
      actions: [
        { label: '你的东西太大了，疼。', cls: 'btn-danger', handler: showStage1500Cock },
        { label: '我好羞耻。', handler: showStage1500Shame },
      ],
    })
  }

  function showStage1500ShamePublic () {
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>你</span><blockquote>“别人会看不起我，笑话我。”</blockquote></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“会的。路上还会碰到想强奸你的男人。这就是规矩。男人被吩咐先干奴隶。你现在就是其中一个。习惯吧。”</blockquote></section>`,
      actions: [
        { label: '我习惯不了。', tone: 'submit', handler: () => { setStage(2000); open() } },
        { label: '（贝拉米会留在这里，不会跟你一起进城）那你别带我上街，你留下陪她，我自己去。', handler: showStage1500Alone },
      ],
    })
  }

  function showStage1500Alone () {
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“你自己去会馆。我会留在这儿，陪戴蒙德。”</blockquote></section>`,
      actions: [{ label: '（贝拉米会留在这里，不会跟你一起进城）继续完成登记。', cls: 'btn-danger', handler: () => {
        state()._pMEscortMode = 'solo'
        setStage(2000)
        open()
      } }],
    })
  }

  function showStage1500Cock () {
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“什么东西？那是鸡巴。一根大的、硬的大鸡巴。懂了吗？说。我用什么干的你？”</blockquote></section>`,
      actions: [{ label: '一根……大鸡巴。可是那太大了。', cls: 'btn-danger', handler: showStage1500Cock2 }],
    })
  }

  function showStage1500Cock2 () {
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“别说废话，快！再说一遍。男人有什么？”</blockquote></section>`,
      actions: [{ label: '鸡巴。大鸡巴。', cls: 'btn-danger', handler: showStage1500Cock3 }],
    })
  }

  function showStage1500Cock3 () {
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“接着说，我有什么？”</blockquote></section>`,
      actions: [{ label: '一根很大、很硬的鸡巴！！！', cls: 'btn-danger', handler: () => {
        show({
          title: '⛓️ 城门 · 验收凳',
          className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
          body: `<section class="p-hall-order"><span>贝</span><blockquote>“记住，你的穴就是拿来装男人的鸡巴的物品罢了，你要学会喜欢鸡巴在里面搅动的感觉。”</blockquote></section>`,
          actions: [{ label: '……', cls: 'btn-primary', handler: () => { setStage(2000); open() } }],
        })
      } }],
    })
  }

  function showStage1500Shame () {
    show({
      title: '⛓️ 城门 · 验收凳',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>你</span><blockquote>“我好羞耻。这是错的。我本来不想这样。”</blockquote></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“你想要什么已经无所谓了。你爽到了。你会被操得很听话。我知道。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: () => { setStage(2000); open() } }],
    })
  }

  /* ==================== Stage 2000 · 请求、口部任务与惩罚 ==================== */

  function showStage2000 () {
    const step = state()._pMChapterStep || 0
    if (step >= 2) { showStage2000After(); return }
    if (step >= 1) { showStage2000Punish(); return }
    if (state()._pMStage2000SlapPending) { showStage2000Beg1(); return }
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">◆</i><div><p>贝拉米牵我的短链后，拉着我走到登记桌前。</p></div></section>
        <section class="p-hall-order"><span>你</span><blockquote>“这太羞辱了，我不是个性奴隶。”</blockquote></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“是啊，你现在确实还不是。因为你是不是奴隶是由派克决定的，我说了可不算～。
        但是可就算是劳役奴隶，每个男人也都可以强奸你。别废话了，你现在快求我让你给我口交。”</blockquote></section>`,
      actions: [
        { label: '我可以拒绝吗。', tone: 'resist', handler: () => startStage2000Refusal('start') },
        { label: '嗯姆……我……我能给你口交吗？', tone: 'submit', handler: showStage2000Beg2 },
      ],
    })
  }

  function startStage2000Refusal (returnTo = 'start') {
    const s = state()
    s._pMStage2000SlapCount = Math.max(0, Number(s._pMStage2000SlapCount) || 0) + 5
    s._pMStage2000SlapPending = true
    s._pMStage2000SlapReturn = ['beg2', 'beg3'].includes(returnTo) ? returnTo : 'start'
    save()
    showStage2000Beg1()
  }

  function showStage2000Beg1 () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">✋</i><div><p>你没有照他说的回答。贝拉米扯紧短链，把你的脸转了回来。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“这次 ${state()._pMStage2000SlapCount || 5} 下。挨完重新回答。下次还敢拒绝，再加五下。”</blockquote></section>`,
      actions: [{ label: '把脸转回来。', tone: 'resist', handler: runStage2000RefusalSlap }],
    })
  }

  async function runStage2000RefusalSlap () {
    Dialog.close()
    const s = state()
    let failed = true
    while (failed) {
      const hits = Math.max(5, Number(s._pMStage2000SlapCount) || 5)
      failed = await task({
        actor: '贝拉米', name: '拒答惩罚', count: hits, tool: '手掌',
        desc: `把脸转回来，左右扇 ${hits} 下，一下一声报数。完成后重新回答刚才的问题。`,
        completeLabel: '挨完了',
      })
      if (!failed) break
      s._pMStage2000SlapCount = hits + 10
      save()
      EventBus.emit('ui:log', { text: `✋ 贝拉米：“没完成？再加十下。现在是 ${s._pMStage2000SlapCount} 下。”`, type: 'danger' })
    }
    const returnTo = s._pMStage2000SlapReturn
    s._pMStage2000SlapPending = false
    s._pMStage2000SlapReturn = null
    save()
    if (returnTo === 'beg3') showStage2000Beg3()
    else if (returnTo === 'beg2') showStage2000Beg2()
    else showStage2000()
  }

  function showStage2000Beg2 () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“太差。求我。叫我先生。求我射在你脸上。”</blockquote></section>`,
      actions: [
        { label: '我不想这样说。', tone: 'resist', handler: () => startStage2000Refusal('beg2') },
        { label: '求您，先生，我可以给您口交吗？您可以射在我的脸上。', tone: 'submit', handler: showStage2000Beg3 },
      ],
    })
  }

  function showStage2000Beg3 () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“看见了吗，你学得会。再来一遍。求我干你的嘴。求我的精液。”</blockquote></section>`,
      actions: [
        { label: '我拒绝再说。', tone: 'resist', handler: () => startStage2000Refusal('beg3') },
        { label: '求您让我含您的鸡巴。求您射在我脸上，先生。', tone: 'submit', handler: showStage2000Beg4 },
      ],
    })
  }

  function showStage2000Beg4 () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“很好。你是个听话的女孩。我知道你学得会。好奴隶。”</blockquote></section>`,
      actions: [{ label: '谢谢……先生。', tone: 'submit', handler: () => {
        show({
          title: '⛓️ 城门 · 登记桌',
          className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
          body: `<section class="p-hall-order"><span>贝</span><blockquote>“上路之前，先给你奖赏。我们没那么多时间。到会馆之前，可能还有别的男人要强奸你。”</blockquote></section>`,
          actions: [{ label: '跪下。', tone: 'submit', handler: runStage2000Oral }],
        })
      } }],
    })
  }

  function showStage2000Forced () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">◆</i><div><p>你没跪。贝拉米按着你的肩膀把你压下去，拇指抵进你的腮，嘴被扳开。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“不跪也得跪。嘴张开。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: runStage2000Oral }],
    })
  }

  async function runStage2000Oral () {
    Dialog.close()
    const failed = await task({
      actor: '贝拉米', name: '含住', bpm: 100, seconds: 30,
      desc: '跪在登记桌前，手背在身后。按 100 BPM 口交三十秒。',
      steps: [
        { at: 0, label: '跪下', text: '跪在桌前，嘴张开，手不要抬起来。按 100 BPM 口交假阳具三十秒。' },
      ],
    })
    recordFailure(failed)
    state()._pMChapterStep = 1
    save()
    showStage2000Punish()
  }

  function showStage2000Punish () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">✋</i><div><p>三十秒到了。口水挂在下巴上。墨菲看了一眼刚写的那栏，把笔放下。贝拉米的手还按在你后脑。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“含完了？脸抬起来。十五下，一下一声。打完这栏才算过。”</blockquote></section>`,
      actions: [{ label: '把脸抬起来。', tone: 'submit', handler: runStage2000Punish }],
    })
  }

  async function runStage2000Punish () {
    Dialog.close()
    const failed = await task({
      actor: '贝拉米', name: '扇脸', count: 15, tool: '手掌',
      desc: '跪着，脸抬起来。左右扇十五下，一下一声报数。',
    })
    recordFailure(failed)
    state()._pMChapterStep = 2
    save()
    showStage2000After()
  }

  function showStage2000After () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">◆</i><div><p>贝拉米甩了甩手。墨菲把这一栏画上勾，合上登记册。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“起来。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: () => { setStage(2500); open() } }],
    })
  }

  /* ==================== Stage 2500 · 后入、经历回应与剧情塞具 ==================== */

  function installStage2500Devices () {
    if (!window.RestraintSystem) return
    const s = state()
    let changed = false
    const anal = RestraintSystem.get('anal')
    if (!anal || anal.id !== 'medium_butt_plug' || anal.source !== 'p_m_intake' || anal.attachment !== 'prostitute_tag') {
      RestraintSystem.equip('anal', 'medium_butt_plug', { locked: true, lockType: 'story', source: 'p_m_intake', difficulty: 5, attachment: 'prostitute_tag' }, true)
      changed = true
    }
    if (s.gender !== 'male') {
      const vagina = RestraintSystem.get('vagina')
      if (!vagina || vagina.id !== 'vibrating_dildo' || vagina.source !== 'p_m_intake' || vagina.attachment !== 'bell') {
        RestraintSystem.equip('vagina', 'vibrating_dildo', { locked: true, lockType: 'story', source: 'p_m_intake', difficulty: 5, attachment: 'bell', vibrationMode: 'low' }, true)
        changed = true
      }
    } else {
      const vagina = RestraintSystem.get('vagina')
      if (vagina && vagina.source === 'p_m_intake') {
        RestraintSystem.remove('vagina', true)
        changed = true
      }
    }
    if (changed) {
      EventBus.emit('ui:log', { text: s.gender === 'male' ? '🔒 M码肛塞已连上妓女牌并锁进妖缚栏。' : '🔒 M码肛塞与M码震动棒已锁进妖缚栏，妓女牌与铃铛挂饰已连接。', type: 'danger' })
      save()
    }
  }

  function installEscortGag () {
    if (!window.RestraintSystem) return
    const current = RestraintSystem.get('mouth')
    if (current && current.id === 'leather_gag' && current.source === 'p_m_intake') return
    RestraintSystem.equip('mouth', 'leather_gag', {
      locked: true,
      lockType: 'story',
      source: 'p_m_intake',
      difficulty: 5,
    }, true)
    EventBus.emit('ui:log', { text: '🤐 贝拉米重新扣紧球形口塞；抵达派克面前以前无法正常说话。', type: 'danger' })
    save()
  }

  function removeEscortGag () {
    if (!window.RestraintSystem) return
    const current = RestraintSystem.get('mouth')
    if (!current || current.id !== 'leather_gag' || current.source !== 'p_m_intake') return
    RestraintSystem.remove('mouth', true)
    EventBus.emit('ui:log', { text: '🔓 派克摘下了入库口塞，开始检查牙齿与舌头。', type: 'warning' })
    save()
  }

  function showStage2500 () {
    if (state()._pMStage2500GearConfirming) { showStage2500Leave(); return }
    if ((state()._pMChapterStep || 0) >= 1) { installStage2500Devices(); showStage2500Talk(); return }
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🍑</i><div><p>口交做完，他没有让你起来。手按在你腰上，把你翻过去。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“你后面这么紧。我先用手指，再用鸡巴。你会喜欢的。奴隶都喜欢。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: runStage2500Anal }],
    })
  }

  async function runStage2500Anal () {
    Dialog.close()
    const failed = await task({
      actor: '贝拉米', name: '后面', bpm: 90, seconds: 30,
      desc: '他将鸡巴插入你的菊穴。以 90 BPM 操你的菊穴三十秒。',
      steps: [{ at: 0, label: '趴好', text: '脸贴着桌面，腰压低。以 90 BPM 操你的菊穴三十秒。' }],
    })
    recordFailure(failed)
    state()._pMChapterStep = 1
    save()
    installStage2500Devices()
    showStage2500Talk()
  }

  function showStage2500Talk () {
    const branch = chapterBranch()
    const thirdChoice = branch === 'novice'
      ? { label: '咦哦哦哦哦齁,用那东西捅我。我以为你要弄死我。', tone: 'resist', handler: showStage2500Thing }
      : branch === 'experienced'
        ? { label: 'TA没有这样用过我的后面。', cls: 'btn-danger', handler: showStage2500Experienced }
        : { label: '你不是第一个。别装作你改变了我。', tone: 'resist', handler: showStage2500Survivor }
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🍑</i><div><p>他从你菊穴里把鸡巴拔出来。你浑身颤抖着。</p></div></section>
        <section class="p-hall-order"><span>你</span><blockquote>“后面……天哪……混蛋……”</blockquote></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“哦，你还想让我再干一次你的屁眼？我看你喜欢我的大鸡巴捅进去。”</blockquote></section>`,
      actions: [
        { label: '我的菊穴被你操裂了,哦哦哦哦。fuck!', tone: 'resist', handler: showStage2500Angry },
        { label: '菊穴好疼。求你别再惩罚了，先生。', tone: 'submit', handler: showStage2500Beg },
        thirdChoice,
      ],
    })
  }

  function showStage2500Experienced () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: '<section class="p-hall-order"><span>贝</span><blockquote>“那就把以前忘了。这里没人哄你，也没人等你点头。记住第一次被当成奴隶使用是什么感觉。”</blockquote></section>',
      actions: [{ label: '……', cls: 'btn-danger', handler: showStage2500Plugs }],
    })
  }

  function showStage2500Survivor () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: '<section class="p-hall-order"><span>贝</span><blockquote>“是不是第一个不重要。现在你的经历也写进了册子。下一个人会知道你忍得住，只会用得更狠。”</blockquote></section>',
      actions: [{ label: '……', cls: 'btn-danger', handler: showStage2500Plugs }],
    })
  }

  function showStage2500Thing () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“那不是东西，是鸡巴。我的鸡巴，又大又硬。你喜欢它进你后面。别撒谎。你又高潮了。我在你那脏屁眼里感觉到你在抖。”</blockquote></section>`,
      actions: [{ label: '不是。我哭着求你停。', cls: 'btn-danger', handler: showStage2500Lied }],
    })
  }

  function showStage2500Lied () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“你是求了。可你还是高潮了。第一次被干后面就高潮了。我知道，你也知道。你天生就是干这个的。”</blockquote></section>`,
      actions: [{ label: '我还是雏穴。我怎么会有这种感觉？', cls: 'btn-danger', handler: showStage2500Innocent }],
    })
  }

  function showStage2500Innocent () {
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>“你以前也许是雏穴。但是你现在就是奴隶。一个有人形飞机杯罢了，被使用，被操，被轮奸都是正常的。派克你说是不是?! 然后我们把你调成跟戴蒙德一样，只喜欢被操菊穴、只以精液为食的贱货。”</blockquote></section>`,
      actions: [{ label: '不。我不想要这个。', cls: 'btn-danger', handler: showStage2500Plugs }],
    })
  }

  function showStage2500Plugs () {
    installStage2500Devices()
    const male = state().gender === 'male'
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>${male ? '“不，你想要。这个塞子留在你后面，牌子挂在外面。进会馆以前不准取下来。”' : '“不，你想要。你看这个塞子。一头插在你的菊穴里，伸出来的挂着妓女的牌子。另外一个塞在你的逼里，下面连着铃铛。我看你喜欢它们待在穴里。现在让我摇一摇。”'}</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: showStage2500Leave }],
    })
  }

  function showStage2500Angry () {
    const male = state().gender === 'male'
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>${male ? '“得了吧。这肯定不是最后一次。再抱怨，我们还有更狠的。塞子和牌子留着，去会馆。”' : '“得了吧，贱货。这肯定不是最后一次。再抱怨，我们还有更狠的。现在让我摇一摇你逼里塞的震动棒下面挂着的那个铃铛。”'}</blockquote></section>`,
      actions: [{ label: '太丢人了。求你把这个拿掉。', cls: 'btn-danger', handler: showStage2500Leave }],
    })
  }

  function showStage2500Beg () {
    const novice = chapterBranch() === 'novice'
    const male = state().gender === 'male'
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>${male ? '“行，让你歇一会儿。别的男人可不会像我这么客气。后面的牌子留着，别人一眼就知道你刚登记完。”' : '“行，让你歇一会儿。别的男人可不会像我这么客气。逼里塞着震动棒,下面的铃铛挂在你腿中间，发情的人很快就会注意到你。”'}</blockquote></section>`,
      actions: [{ label: novice ? '你拿走了我的第一次。现在连后面也是。' : '够了。让我起来。', cls: 'btn-danger', handler: novice ? showStage2500Blood : showStage2500Plugs }],
    })
  }

  function showStage2500Blood () {
    const male = state().gender === 'male'
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>贝</span><blockquote>${male ? '“现在连后面这一次也归我。抱怨够了。这不会是最后一次。”' : '“真甜。我把你前后都破了。你看，后面也在流血，前面也是。精液混着血，从两个穴里往外流。别抱怨,这又不是最后一次。”'}</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: showStage2500Leave }],
    })
  }

  function showStage2500Leave () {
    const s = state()
    if (!s._pMStage2500GearConfirming) {
      s._pMStage2500GearConfirming = true
      s._pMStage2500GearConfirmStep = 0
      save()
    }
    installStage2500Devices()
    const step = Math.max(0, Number(s._pMStage2500GearConfirmStep) || 0)
    if (step < 1) {
      show({
        title: '⛓️ 登记桌 · 插入装备',
        className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🏷️</i><div><h3>M码肛塞已佩戴</h3><p>菊穴被塞入M码肛塞，外端连接着妓女牌挂饰；锁扣已经闭合。</p></div></section>`,
        actions: [{ label: '确认M码肛塞已佩戴', cls: 'btn-primary', handler: () => { s._pMStage2500GearConfirmStep = 1; save(); showStage2500Leave() } }],
      })
      return
    }
    if (s.gender !== 'male' && step < 2) {
      show({
        title: '⛓️ 登记桌 · 插入装备',
        className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🔔</i><div><h3>M码震动棒已佩戴</h3><p>小穴被塞入M码震动棒，尾端连接着铃铛挂饰；震动档位保持在低档。</p></div></section>`,
        actions: [{ label: '确认M码震动棒已佩戴', cls: 'btn-primary', handler: () => { s._pMStage2500GearConfirmStep = 2; save(); showStage2500Leave() } }],
      })
      return
    }
    if (s.gender === 'male' && step < 2) {
      s._pMStage2500GearConfirmStep = 2
      save()
    }
    if ((s._pMStage2500GearConfirmStep || 0) < 3) {
      installEscortGag()
      show({
        title: '⛓️ 登记桌 · 口部束缚',
        className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🤐</i><div><h3>球形口塞已佩戴</h3><p>球体被压入口中，皮带绕到脑后扣紧；抵达派克面前以前无法正常说话。</p></div></section>`,
        actions: [{ label: '确认球形口塞已佩戴', cls: 'btn-primary', handler: () => { s._pMStage2500GearConfirmStep = 3; save(); showStage2500Leave() } }],
      })
      return
    }
    s._pMStage2500GearConfirming = false
    save()
    showStage2500Departure()
  }

  function showStage2500Departure () {
    const solo = state()._pMEscortMode === 'solo'
    show({
      title: '⛓️ 城门 · 登记桌',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🤐</i><div><p>插入装备与口球都已锁好。你试着出声，只剩含混的呜咽。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>${solo ? '“我留下。牵引链给你。自己穿过街面去会馆。有人问，就给他看牌子；你不需要替自己解释。”' : '“起来。我可以押你走到会馆。要是你非想自己走，就拿好牵引链；进了街面可没人替你回答。”'}</blockquote></section>`,
      actions: solo
        ? [{ label: '拿着牵引链，独自离开登记桌', cls: 'btn-primary', handler: () => beginStage2500Escort('solo') }]
        : [
            { label: '跟着贝拉米前往会馆', cls: 'btn-primary', handler: () => beginStage2500Escort('bellamy') },
            { label: '摇头，拿过牵引链自己走', handler: () => beginStage2500Escort('solo') },
          ],
    })
  }

  function beginStage2500Escort (mode) {
    const s = state()
    s._pMEscortMode = mode === 'solo' ? 'solo' : 'bellamy'
    save()
    if (window.PMEscortSystem) PMEscortSystem.start({ mode: s._pMEscortMode })
  }

  function finishEscort () {
    const s = state()
    s._pMChapterStage = 3000
    s._pMChapterStep = 0
    if (s._pMEscort) s._pMEscort.hallArrive = false
    save()
    showArriveAtHall()
  }

  function showArriveAtHall () {
    const solo = state()._pMEscortMode === 'solo'
    show({
      title: '🏛️ 商团会馆 · 台阶',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🏛️</i><div><p>你登上会馆台阶。门开着，里面是长厅。派克的桌子在左边。${solo ? '你握着牵引链还走到了门口。' : '你跟着贝拉米走到门口。'}</p></div></section>`,
      actions: [{ label: '走进长厅。', cls: 'btn-primary', handler: () => {
        const s = state()
        if (s._pMEscort) s._pMEscort.hallArrive = true
        save()
        showStage3000()
      } }],
    })
  }

  /* ==================== Stage 3000 · 初见派克 ==================== */

  function showStage3000 () {
    const e = state()._pMEscort
    if (e && e.completed && e.hallArrive === false) { showArriveAtHall(); return }
    const step = state()._pMChapterStep || 0
    if (step >= 4) { showStage3000ReleaseEnd(); return }
    if (step >= 3) { showPikeVerdict(); return }
    if (step >= 1) { runStage3000(); return }
    if (e && e.gagRemovedAtHall) { showPikeAfterGag('派克已经摘下口塞，正等你回答。'); return }
    const solo = state()._pMEscortMode === 'solo'
    const escortNote = solo
      ? '你把牵引链攥在自己手里，一路上的锁响还没停。你抬起登记牌，朝派克含混地呜了一声。'
      : '贝拉米把链子递到桌边，自己替你报上编号：“城门新登记的，送来验收。”'
    show({
      title: '🏛️ 商团会馆 · 长厅',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🏛️</i><div><p>派克把登记册翻到有你编号的那页。${escortNote}</p></div></section>
        <section class="p-hall-order"><span>派</span><blockquote>“新收的货？不错。贝拉米准备得很好。抬头。”</blockquote></section>
        <section class="p-hall-order"><span>你</span><blockquote>“唔……嗯……”</blockquote></section>`,
      actions: [
        { label: '点头', tone: 'submit', handler: () => showPikeRemoveGag('obey') },
        { label: '摇头', tone: 'resist', handler: () => showPikeRemoveGag('resist') },
        { label: '含着口塞发出呜咽', handler: () => showPikeRemoveGag('muffle') },
      ],
    })
  }

  function showPikeRemoveGag (response) {
    removeEscortGag()
    const reaction = response === 'obey'
      ? '你点了点头。派克捏住口塞前端，把扣带从脑后解开。'
      : response === 'resist'
        ? '你摇头后退。派克抓住项圈把你拉回桌前，亲手解开口塞。'
        : '含混的声音没有组成一句话。派克抬起你的下巴，解开口塞。'
    const e = state()._pMEscort
    if (e) e.gagRemovedAtHall = true
    save()
    showPikeAfterGag(reaction)
  }

  function showPikeAfterGag (reaction) {
    show({
      title: '🏛️ 商团会馆 · 长厅',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🤐</i><div><p>${reaction}</p><p>球形口塞离开嘴后，派克没有让你休息，只用拇指压住下唇检查牙齿与舌头。</p></div></section>
        <section class="p-hall-order"><span>派</span><blockquote>“嘴张开。让我看看牙齿和舌头。然后告诉我：知不知道自己现在是什么？”</blockquote></section>`,
      actions: [
        { label: '“是……我知道。”', tone: 'submit', handler: showPikeObey },
        { label: '“您不能这样。我们可以谈条件。”', tone: 'resist', handler: showPikeHaggle },
      ],
    })
  }

  function showPikeObey () {
    show({
      title: '🏛️ 商团会馆 · 长厅',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>派</span><blockquote>“好。从现在起叫我奴隶主，其他男人叫先生。我要检查你值多少。别动，别反抗，不然罚得很重。让我看看你的穴和后面进过几根。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: runStage3000 }],
    })
  }

  function showPikeHaggle () {
    show({
      title: '🏛️ 商团会馆 · 长厅',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>派</span><blockquote>“贱货，你还敢跟我谈条件。你没有权利，只会服从。从现在起叫我奴隶主，其他男人叫先生。我要检查你值多少。这次你不会喜欢，也没人在乎。让我看看你的穴和后面进过几根。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-danger', handler: runStage3000 }],
    })
  }

  async function runStage3000 () {
    Dialog.close()
    let s = state()
    if ((s._pMChapterStep || 0) < 1) {
      const failed = await task({
        actor: '派克', name: '张开嘴', seconds: 15,
        desc: '嘴张开。派克看牙齿和舌头。双手放在背后，不要合上。',
      })
      recordFailure(failed)
      state()._pMChapterStep = 1; save()
    }
    s = state()
    if ((s._pMChapterStep || 0) < 2) {
      const failed = await task({
        actor: '派克', name: '身体检查', seconds: 25,
        desc: `派克检查胸、臀和锁具留下的痕迹，再检查${hole()}。双手放在背后，按他的指令转身、弯腰。`,
      })
      recordFailure(failed)
      state()._pMChapterStep = 2; save()
    }
    s = state()
    if ((s._pMChapterStep || 0) < 3) {
      const failed = await task({
        actor: '派克', name: '派克验收', bpm: 110, seconds: 30,
        desc: `检查结束后，派克亲自验证${hole()}会不会按命令迎合。按 110 BPM 做三十秒。`,
      })
      recordFailure(failed)
      state()._pMChapterStep = 3; save()
    }
    showPikeVerdict()
  }

  function showPikeVerdict () {
    const male = state().gender === 'male'
    const chest = male
      ? '身体结实，脸也干净。你现在几乎不会用。至少身体会配合，这个能练。'
      : '胸不大，身体结实，脸很干净。你现在几乎不会用。至少很容易湿，这个能练。'
    show({
      title: '🏛️ 商团会馆 · 长厅',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal p-m-chapter-modal',
      body: `<section class="p-hall-order"><span>你</span><blockquote>“……奴隶主，您看出来了吗？”</blockquote></section>
        <section class="p-hall-order"><span>派</span><blockquote>“身体还行。可以卖给农户干活，也可以卖给镇上当佣人。我先留下。训练完再看能卖什么价，适合当性奴隶还是劳役奴隶。${chest}详细评估完会给你出一份奴隶证明。”</blockquote></section>`,
      actions: [{ label: '……', cls: 'btn-primary', handler: () => {
        const s = state()
        s._pMChapterStep = 4
        save()
        showStage3000ReleaseEnd()
      } }],
    })
  }

  function showStage3000ReleaseEnd () {
    show({
      title: '🏛️ 奴隶线·第一章 · 当前进度',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal p-m-chapter-modal',
      body: '<section class="scene-dialogue"><i aria-hidden="true">🏛️</i><div><h3>初见派克已经完成。</h3><p>当前版本的奴役线开放到 Stage 3000。返回城门、戴蒙德押送与后续入库流程将在后续内容完成后开放。</p></div></section>',
      actions: [{ label: '返回欲缚镇', handler: openCamp }],
    })
  }

  /* ==================== Stage 3500 → 9500 · 戴蒙德、市场与回厅 ==================== */

  async function returnToBellamy () {
    const s = state()
    if (s._pMChapterStage !== 3500) { openCamp(); return }
    show({
      title: '⛓️ 城门岗哨',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-gate-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><p>贝拉米把你的短链扣到戴蒙德的链子上。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“跟上。报号。丢了自己爬回来。”</blockquote></section>
        <section class="p-hall-order"><span>戴</span><blockquote>“……别在街上停。”</blockquote></section>`,
      actions: [
        { label: '尽量护住戴蒙德', handler: () => prepareEscort('protect') },
        { label: '只保证自己不受罚', handler: () => prepareEscort('self') },
        { label: '完全按贝拉米的命令走', tone: 'submit', handler: () => prepareEscort('obey') },
      ],
    })
  }

  function prepareEscort (choice) {
    const s = state()
    s._pMDayaChoice = choice
    s._pMChapterStage = 4000
    s._pMChapterStep = 0
    s._pMainlineStage = 4
    EventBus.emit('ui:log', { text: '⛓️ 你与戴蒙德被编入同一支押送队，下一站是商团会馆。', type: 'danger' })
    save(); Dialog.close(); openCamp()
  }

  function escortConsequence () {
    const s = state()
    if (s._pMDayaChoice === 'protect') return '你主动靠到戴蒙德外侧，卫兵把本来落在她身上的短链也扣到你腰间。'
    if (s._pMDayaChoice === 'obey') return '你没有等戴蒙德提醒就跪到指定位置，贝拉米满意地让她跟在你后面。'
    return '你只护住自己的步子，戴蒙德独自承受了卫兵收紧的另一端链子。'
  }

  function showSisterBinding () {
    const s = state()
    const memory = '链子收在标准长度。一人停步，另一人会被拉倒。'
    show({
      title: '⛓️ 城门 · 押送准备',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><p>一条更粗的腰链穿过你和戴蒙德的项圈，两人的手铐锁在同一枚铁环上。</p><p>${memory}${escortConsequence()}</p></div></section>
        <section class="p-hall-order"><span>墨</span><blockquote>“一人停，另一个也倒。”</blockquote></section>`,
      actions: [{ label: '和戴蒙德一起走向城门', cls: 'btn-danger', handler: () => { const latest = state(); latest._pMSisterBond = true; latest._pMChapterStep = 1; save(); returnToHall() } }],
    })
  }

  function showMarketChoice () {
    show({
      title: '🎪 市场中央',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🎪</i><div><p>押送队在市场中央停下。铜铃响了。</p></div></section>
        <section class="p-hall-order"><span>贝</span><blockquote>“站好。让他们看这件货。”</blockquote></section>`,
      actions: [
        { label: '忍住围观，和她保持同一姿势', handler: () => setMarketResponse('endure') },
        { label: '往前挺半步，挡住戴蒙德', handler: () => setMarketResponse('shield') },
        { label: '抬头直视贝拉米', tone: 'resist', handler: () => setMarketResponse('defy') },
      ],
    })
  }

  function setMarketResponse (response) {
    const s = state()
    s._pMMarketResponse = response
    s._pMChapterStep = 3
    save()
    returnToHall()
  }

  function showBranding () {
    const s = state()
    const mark = s._pMMarketResponse === 'defy' ? '不驯标记与正式编号' : '正式编号与商团印记'
    show({
      title: '🔥 城门 · 炭盆',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🔥</i><div><h3>城门旁的炭盆里，一枚细铁印已经烧红；旁边的记号师也调好了奴隶纹身的黑色颜料。</h3><p>这不是桥下强盗的涂写，而是要记入黑皮册的${mark}。先用针将商团纹身留在腰侧，再用铁印完成登记。戴蒙德被锁在你身边，低声数着呼吸，要你别在印记落下时把两人一起拽倒。</p></div></section>`,
      actions: [{ label: '咬住声音，接受纹身与烙印', tone: 'submit', handler: () => { const latest = state(); latest._pMBranded = true; latest._pMChapterStep = 5; save(); returnToHall() } }],
    })
  }

  async function returnToHall () {
    let s = state()
    if (s._pMChapterStage !== 4000) { openCamp(); return }
    const step = s._pMChapterStep || 0
    if (step === 0) { showSisterBinding(); return }
    Dialog.close()
    if (step === 1) {
      const reports = 8
      const failed = await task({
        actor: '押送卫兵', name: '城门报号', count: reports, tool: '出声报号',
        desc: `你与戴蒙德被同一条链子拉到城门中央。跪下报出自己的编号、M 身份和监管者，共 ${reports} 次。`,
      })
      recordFailure(failed)
      state()._pMChapterStep = 2; save(); showMarketChoice(); return
    }
    if (step === 2) { showMarketChoice(); return }
    if (step === 3) {
      s = state()
      const extra = s._pMDayaChoice === 'protect' || s._pMMarketResponse === 'shield' ? 5 : 0
      const defiant = s._pMMarketResponse === 'defy' ? 10 : 0
      const count = 10 + extra + defiant
      const failed = await task({
        actor: '贝拉米', name: '市场纪律', count, tool: '手掌或拍子',
        desc: `${s._pMMarketResponse === 'shield' ? '你替戴蒙德挡下了前半段处罚。' : s._pMMarketResponse === 'defy' ? '直视监管者的代价被当场加到记录里。' : '你们被命令保持并排跪姿。'}完成 ${count} 下臀罚，每一下都要与戴蒙德保持同一高度。`,
      })
      recordFailure(failed)
      state()._pMChapterStep = 4; save(); showBranding(); return
    }
    if (step === 4) { showBranding(); return }
    if (step === 5) {
      const latestState = state()
      const failed = await task({
        actor: '贝拉米', name: '奴隶姐妹押送', bpm: 60, seconds: 45,
        desc: `烙印后不准停步。你与戴蒙德被腰链绑在一起，按 60 BPM 穿过市场：八拍行走，四拍停下展示项圈与腰部锁具。${latestState._pMDayaChoice === 'protect' ? '戴蒙德开始主动配合你的步子。' : latestState._pMDayaChoice === 'obey' ? '戴蒙德只在链子收紧时才被迫跟上。' : '两人各自盯着自己脚下，没有人再替对方承担停顿。'}`,
      })
      recordFailure(failed)
      state()._pMChapterStep = 6; save()
    }
    const latest = state()
    latest._pMChapterStage = 9500
    latest._pMChapterStep = 0
    latest._pMainlineStage = 5
    save()
    showPikeSecondAudience()
  }

  /* ==================== 章节结束与统一入口 ==================== */

  /** Stage 9500：奴隶线第一章专属的第二次派克会面。 */
  function showPikeSecondAudience () {
    const s = state()
    if (s._pRole !== 'slave' || s._pMChapterStage !== 9500 || s._pMainlineStage !== 5) { openCamp(); return }
    const assessment = s._pMDayaChoice === 'protect'
      ? '戴蒙德主动替你报上了最后一段押送记录。派克看得出你在市场替她挡过处罚，便把“会保护同链者”写进评估。'
      : s._pMDayaChoice === 'obey'
        ? '贝拉米对你的服从没有异议，戴蒙德却始终没有看你。派克在评估上写下“服从快，不会照顾同链者”。'
        : '你与戴蒙德各自保全了自己，也把距离一直留到会馆。派克把这点记为“会判断，不会付出”。'
    show({
      title: '🏛️ 商团会馆 · 第二次会面',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><h3>你与戴蒙德被同一条腰链带到派克面前，新的印记还没有冷透。</h3><p>${assessment}</p></div></section>
        <section class="p-hall-order"><span>派克</span><blockquote>“戴蒙德只是命令的一部分。真正送到我面前的，是你选择成为的那个人。”</blockquote></section>`,
      actions: [{ label: '完成入库，领取第一册记录', cls: 'btn-danger', handler: completeChapter }],
    })
  }

  function completeChapter () {
    const s = state()
    s._pMChapterStage = 10000
    s._pMChapterCompleted = true
    s._pMChapterEscrow = null
    s._pMainlineStage = 6
    s._pChapterOneLocked = true
    EventBus.emit('ui:log', { text: '📕 奴隶线·第一章完成。下一任务是寻找伊凡娜；基础奴隶训练尚未开始。', type: 'warning' })
    save()
    show({
      title: '📕 商团会馆 · 长厅',
      className: 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal p-m-chapter-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">📕</i><div><h3>派克在入库记录末页签名，把第一册奴隶记录扔到你面前。</h3><p>你昏迷时被收走的金币、武器、道具和旧妖缚仍留在商团仓库，没有随入库结束归还。项圈、手铐、脚镣、贞操锁和新印记都保留下来。${s._pMDayaChoice === 'protect' ? '戴蒙德在被解开姐妹链前，第一次低声对你说了“谢谢”。' : s._pMDayaChoice === 'obey' ? '戴蒙德沉默地等着姐妹链被解开，从头到尾没有再朝你看一眼。' : '姐妹链解开时，戴蒙德只说你至少学会了不把两个人一起拉倒。'}派克没有安排基础训练，而是让书记官翻出一名叫伊凡娜的失踪者资料。</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>下一章</span><p>捕获伊凡娜。完成那条任务以后，基础奴隶训练才会开放。</p></div>`,
      actions: [{ label: '收起记录，返回欲缚镇', cls: 'btn-primary', handler: openCamp }],
    })
  }

  function open () {
    const s = state()
    if (!eligible()) { openCamp(); return }
    if (!s._pMConfiscated) confiscateOnKnockout()
    if (s._pMEscort && s._pMEscort.started && !s._pMEscort.completed && window.PMEscortSystem) {
      PMEscortSystem.resume()
      return
    }
    switch (Number(s._pMChapterStage) || 0) {
      case 0: showStage0(); break
      case 500: runStage500(); break
      case 1000: (state()._pMChapterStep || 0) < 1 ? showAfterLocks() : showStage1000(); break
      case 1500: showStage1500(); break
      case 2000: showStage2000(); break
      case 2500: showStage2500(); break
      case 3000: showStage3000(); break
      case 3500: returnToBellamy(); break
      case 4000: returnToHall(); break
      case 9500:
        showPikeSecondAudience()
        break
      default: openCamp()
    }
  }

  return { open, finishEscort, eligible }
  })()
