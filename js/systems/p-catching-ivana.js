/**
 * systems/p-catching-ivana.js — 奴隶线后续任务「捕获伊凡娜」。
 *
 * 原版任务关系（不要写回第一章）：
 *   SLV_EnslavePC 4000 End/End2/Enda → 9500，同时启动 SLV_CatchingIvana Stage 0
 *
 * 原版 CatchingIvana 阶段与对白来源：
 *   0     SLV_CatchingIvana0000Topic～Topic4  回城门，把派克要戴蒙德的口信告诉贝拉米
 *         Topic2 服从：他只要一个受过训练的 → CatchingIvana1b
 *         Topic3 抗命：把两个人都带去就能离开 → CatchingIvana1（鞭打，伊凡娜登场）
 *   0→500 CatchingIvana1 / 1b / 3_Goodbye
 *         城门同时处理蒙眼新奴（伊凡娜）。GoodPC 场景启动 WalkOfShame Stage 1500；
 *         BadPC 场景启动 WalkOfShame Stage 0。
 *   500   0500Topic     伊凡娜相关
 *   1000  1000Topic     带伊凡娜行动
 *   1500  1500Topic
 *   2000  2000Topic     伊凡娜姓名确认等
 *   2500  2500Topic     可转入 BabyGotBoobs
 *   2600 / 2800 / 3000  中段
 *   3500  3500Topic
 *   4000  4000Topic     派克如何处置伊凡娜
 *   4500～6000          后续处置
 *   9500→10000          CatchingIvana14 启动 SlaveTraining Stage 1500，发放第二册
 *
 * 原版 WalkOfShame2（当街押送、公开展示、奴隶姐妹）独立任务，不写进第一章：
 *   0 / 500 / 1000 / 1500 / 2000 / 2500 / 3000 / 3500
 *   4000 Walking1  当街行走
 *   4500 Walking2
 *   5000 Walking3
 *   5500 Walking4
 *   9000 / 9500 / 10000 End
 * 网页后续若展开，新建 game/js/systems/p-walk-of-shame.js，不要塞回 p-m-enslavement.js。
 *
 * 网页映射（本轮只实现 Stage 0 贝拉米交接）：
 *   CatchingIvana 0  objective → gate → bellamy-ask → bellamy-done
 *   其后未开放：伊凡娜登场、WalkOfShame 戴蒙德押送、Stage 500 起
 */
window.PCatchingIvanaSystem = (function () {
  const state = () => State.get()
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch])
  const names = { '贝': '贝拉米', '墨': '墨菲', '派': '派克' }
  const normalize = html => typeof html === 'string'
    ? html.replace(/<section class="p-hall-order"><span>([^<]+)<\/span>/g, (match, name) => {
        const isPlayer = name === '你' || name === '玩家'
        const fullName = isPlayer ? (State.get().playerName || '玩家') : (names[name] || name)
        return `<section class="p-hall-order gal-dialogue"><span class="${isPlayer ? 'is-player' : 'is-npc'}">${escapeHtml(fullName)}</span>`
      })
    : html
  const modal = 'camp-tavern-modal wrong-letter-reaction-modal p-hall-modal p-m-chapter-modal'

  function save () {
    const s = state()
    EventBus.emit('state:changed', s)
    State.save()
  }

  function quest () {
    const q = state()._pCatchingIvana
    return q && typeof q === 'object' && !Array.isArray(q) ? q : null
  }

  function eligible () {
    const s = state()
    const q = quest()
    return s._pRole === 'slave' && !!s._pMChapterCompleted && !!q && q.started && !q.completed
  }

  function setPage (page) {
    const q = quest()
    if (!q) return null
    q.page = page
    save()
    return q
  }

  function show (options) {
    options.body = normalize(options.body)
    options.actions = (options.actions || []).map(action => {
      const normalized = { ...action }
      if (action.tone === 'submit') normalized.cls = 'btn-submissive'
      else if (action.tone === 'resist') normalized.cls = 'btn-danger'
      delete normalized.tone
      return normalized
    })
    return CampSystem.showScene(options)
  }

  /** 幂等启动；第一章的完成状态由调用方在本次保存前写入。 */
  function start () {
    const s = state()
    let q = quest()
    const created = !q
    if (!q) {
      q = { version: 1, stage: 0, page: 'objective', started: true, completed: false }
      s._pCatchingIvana = q
    }
    if (created) EventBus.emit('ui:log', { text: '📜 新任务：捕获伊凡娜。先返回城门，把派克的口信告诉贝拉米。', type: 'warning' })
    save()
    open()
    return q
  }

  function showObjective () {
    const q = quest()
    if (q && !q.page) q.page = 'objective'
    save()
    show({
      title: '📜 奴隶线后续任务 · 捕获伊凡娜',
      className: modal,
      body: '<section class="scene-dialogue"><i aria-hidden="true">📕</i><div><h3>派克在第一册记录末页签名，把它推到你面前。</h3><p>第一章已经结束。你昏迷时被收走的金币、武器和道具仍留在商团仓库，当前妖缚装备也没有解除。</p></div></section><section class="p-hall-order"><span>派</span><blockquote>“回城门找贝拉米。告诉他，我要戴蒙德到会馆来。其他事情等你把口信送到再说。”</blockquote></section><div class="wrong-letter-evidence is-found"><span>当前目标</span><p>返回城门，把派克的口信告诉贝拉米。</p></div>',
      actions: [
        { label: '前往城门找贝拉米', cls: 'btn-primary', handler: showGate },
        { label: '记下命令，返回欲缚镇', handler: () => CampSystem.open() },
      ],
    })
  }

  function showGate () {
    setPage('gate')
    show({
      title: '⛓️ 城门 · 登记桌',
      className: modal,
      body: '<section class="scene-dialogue"><i aria-hidden="true">⛓️</i><div><p>链声还没散。贝拉米靠在登记桌边，墨菲把册子翻到你的编号。</p></div></section><section class="p-hall-order"><span>墨</span><blockquote>“编号还在。说。”</blockquote></section>',
      actions: [{ label: '把派克的口信告诉贝拉米。', cls: 'btn-primary', handler: showBellamyAsk }],
    })
  }

  function showBellamyAsk () {
    setPage('bellamy-ask')
    show({
      title: '⛓️ 城门 · 登记桌',
      className: modal,
      body: '<section class="p-hall-order"><span>贝</span><blockquote>“回来了。这么快。他说要戴蒙德做什么？”</blockquote></section>',
      actions: [
        { label: '“奴隶主要戴蒙德去会馆。他说需要一个受过训练的。”', tone: 'submit', handler: () => showBellamyReply('obey') },
        { label: '“我把她们两个都带去，就能离开。”', tone: 'resist', handler: () => showBellamyReply('resist') },
      ],
    })
  }

  function showBellamyReply (answer) {
    const q = quest()
    if (q) q.bellamyAnswer = answer === 'resist' ? 'resist' : 'obey'
    setPage('bellamy-reply')
    const body = answer === 'resist'
      ? '<section class="p-hall-order"><span>贝</span><blockquote>“还敢谈离开。你不是自由人。只会服从。”</blockquote></section><section class="p-hall-order"><span>贝</span><blockquote>“口信听清楚：派克要戴蒙德。街上怎么走，轮到你的时候再说。”</blockquote></section>'
      : '<section class="p-hall-order"><span>贝</span><blockquote>“很好。主人怎么说你怎么做。”</blockquote></section><section class="p-hall-order"><span>贝</span><blockquote>“戴蒙德先留在城门。带上街的时候，别停。现在回营地。”</blockquote></section>'
    show({
      title: '⛓️ 城门 · 登记桌',
      className: modal,
      body,
      actions: [{ label: '……', handler: showBellamyHold }],
    })
  }

  function showBellamyHold () {
    setPage('bellamy-done')
    show({
      title: '⛓️ 城门 · 登记桌',
      className: modal,
      body: '<section class="scene-dialogue"><i aria-hidden="true">📜</i><div><p>墨菲在册子上记下口信。戴蒙德仍在城门一侧。</p></div></section><section class="p-hall-order"><span>墨</span><blockquote>“口信入册。戴蒙德编号还在城门。”</blockquote></section><div class="wrong-letter-evidence is-found"><span>当前进度</span><p>Stage 0 贝拉米交接已完成。伊凡娜登场、戴蒙德当街押送（WalkOfShame）与 Stage 500 尚未开放。</p></div>',
      actions: [{ label: '返回欲缚镇', cls: 'btn-primary', handler: () => CampSystem.open() }],
    })
  }

  function open () {
    if (!eligible()) {
      CampSystem.open()
      return false
    }
    const page = quest().page
    if (page === 'gate') showGate()
    else if (page === 'bellamy-ask') showBellamyAsk()
    else if (page === 'bellamy-reply') showBellamyReply(quest().bellamyAnswer)
    else if (page === 'bellamy-done') showBellamyHold()
    else showObjective()
    return true
  }

  return { start, open, eligible }
})()
