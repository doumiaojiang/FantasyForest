/** systems/camp.js — 出生点东侧的安全营地。 */
window.CampSystem = (function () {
  const GLORY_FEE = 30
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
  function setCampPhase () {
    const state = State.get()
    if (state.phase !== 'camp') {
      state.phase = 'camp'
      EventBus.emit('state:changed', state)
    }
    // 进入营地：隐藏操作栏与浮动方向键
    const actionBar = document.getElementById('action-bar')
    if (actionBar) actionBar.classList.add('hidden')
    const float = document.getElementById('dpad-float')
    if (float) float.classList.add('hidden')
  }

  /** 营地页面渲染：写入页面容器而非弹窗层 */
  function campShow (options) {
    const { title, body, actions = [], className = '' } = options
    const panel = document.getElementById('camp-panel')
    if (!panel) { Dialog.show(options); return }
    const mapPanel = document.getElementById('map-panel')
    if (mapPanel) mapPanel.classList.add('panel-hidden')
    panel.classList.remove('panel-hidden')
    panel.innerHTML = `
      <div class="camp-panel-inner modal-box ${className}">
        ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
        <div class="modal-body">${body}</div>
        ${actions.length ? `<div class="modal-actions">${actions.map((a, i) =>
          `<button class="btn ${a.cls || ''}" data-action="${i}">${a.label}</button>`
        ).join('')}</div>` : ''}
      </div>`
    panel.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.action)
        const a = actions[idx]
        if (a && a.handler) a.handler()
      })
    })
  }

  /** 营地页面关闭：恢复地图 */
  function campClose () {
    const panel = document.getElementById('camp-panel')
    if (panel) { panel.classList.add('panel-hidden'); panel.innerHTML = '' }
    const mapPanel = document.getElementById('map-panel')
    if (mapPanel) mapPanel.classList.remove('panel-hidden')
  }

  function open () {
    const state = State.get()
    setCampPhase()
    // 在监狱里：强制回到牢房工作，无法离开
    if (state._inPrison) {
      prisonWork()
      return
    }
    // 未完成的强制流程会持久化，刷新后不能绕过。
    if ((state._gloryDebt || 0) > 0 || state._gloryFreeService) {
      showGloryWork()
      return
    }
    // 接客计时中刷新：从尚未确认完成的当前阶段继续，不能跳过结算。
    if (state._prostitutePendingTask) {
      state._prostituteLicensed = true
      state._prostituteDressed = true
      const pending = state._prostitutePendingTask
      runCustomerTask(pending.customerKey, pending.z, pending.stepIndex)
      return
    }
    // 打工欠款同样属于强制流程，刷新或重进营地不能绕过。
    if ((state._prostituteDebt || 0) > 0) {
      state._prostituteLicensed = true
      state._prostituteDressed = true
      prostitute()
      return
    }
    const deerStatus = state._campDeerTaken ? '已领取' : '有礼物'
    const toiletStatus = state._gloryDiscovered ? '已解锁' : '可探索'
    const toiletHint = state._gloryDiscovered ? '普通厕所 · 隐藏隔间已发现' : '普通厕所 · 隔间有些不一样'
    campShow({
      title: '⛺ 林缘营地',
      className: 'camp-modal',
      body: `
        <section class="camp-hero">
          <div class="camp-fire" aria-hidden="true"><span>🔥</span></div>
          <div><small>SAFE HAVEN · 林缘休憩地</small><h3>篝火还暖着，森林暂时安静。</h3><p>补充物资、打听消息，准备好后再回到妖林。</p></div>
        </section>
        <div class="camp-stats" aria-label="营地状态"><span>❤️ ${state.hp}/${state.maxHp}</span><span>💎 ${state.gold} 金币</span><span>🧭 出生点东侧</span></div>
        <div class="camp-grid">
          <button class="camp-opt camp-opt-tavern" data-opt="tavern"><i>🍺</i><span><b>雾灯酒馆</b><small>摇骰子、买酒</small></span><em>营业中</em></button>
          <button class="camp-opt camp-opt-blacksmith" data-opt="blacksmith"><i>🔨</i><span><b>铁匠铺</b><small>武器与饰品</small></span><em>营业中</em></button>
          <button class="camp-opt camp-opt-potion" data-opt="potion"><i>🧪</i><span><b>道具商</b><small>药品与各种消耗品</small></span><em>营业中</em></button>
          <button class="camp-opt camp-opt-glory" data-opt="glory"><i>🚻</i><span><b>公共厕所</b><small>${toiletHint}</small></span><em>${toiletStatus}</em></button>
          <button class="camp-opt camp-opt-prison" data-opt="prison"><i>⛓️</i><span><b>监狱</b><small>无证卖淫的归宿</small></span><em>${state._inPrison ? '在押' : '戒备'}</em></button>
          <button class="camp-opt camp-opt-deer" data-opt="deer"><i>🦌</i><span><b>篝火旁的鹿</b><small>旅人的初次见面礼</small></span><em>${deerStatus}</em></button>
        </div>
        <p class="camp-footnote">营地不会消耗回合；离开后从当前格继续探索。</p>`,
      actions: [{ label: state._prostituteLicensed ? '⚠️ 离开营地，接受卫兵盘问' : '← 离开营地，继续冒险', cls: state._prostituteLicensed ? 'btn-danger' : 'btn-primary', handler: leaveCamp }],
    })
    document.querySelectorAll('.camp-opt').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.opt
        if (opt === 'potion') {
          state._shopReturnToCamp = true
          EventBus.emit('state:changed', state)
          ShopSystem.open({ type: TILE.CAMP, raw: '道具商' })
        } else if (opt === 'blacksmith') {
          blacksmith()
        } else if (opt === 'glory') gloryHole()
        else if (opt === 'tavern') tavern()
        else if (opt === 'prison') prisonDoor()
        else if (opt === 'deer') deer()
      }
    })
  }

  function leaveCamp () {
    const state = State.get()
    if ((state._gloryDebt || 0) > 0 || state._gloryFreeService || (state._prostituteDebt || 0) > 0) {
      if ((state._prostituteDebt || 0) > 0) {
        Dialog.close(); prostitute(); return
      }
      Dialog.close(); showGloryWork(); return
    }
    Dialog.close()
    // 兜底：荣耀洞还清欠款标记未清除（如刷新跳过）→ 回营地触发卫兵/队长事件，而非直接出城
    if (state._gloryJustCleared) {
      gloryClearedLeave()
      return
    }
    // 取得妓女许可证：出城会遇到卫兵
    if (state._prostituteLicensed) {
      guardEncounter()
      return
    }
    doLeaveCamp()
  }

  /** 出城卫兵事件（取得妓女许可证后触发） */
  function guardEncounter () {
    const state = State.get()
    // 持有出城免检查卷：直接放行并消耗一张
    const guardPassCount = (state.inventory.consumables.guard_pass || 0)
    if (guardPassCount > 0) {
      state.inventory.consumables.guard_pass = guardPassCount - 1
      EventBus.emit('ui:log', { text: '📜 你出示出城免检查卷，卫兵挥挥手放行（免检查卷剩余 ' + (guardPassCount - 1) + ' 张）。', type: 'good' })
      EventBus.emit('state:changed', state)
      Dialog.show({
        title: '🛡️ 城门口 · 卫兵', className: 'glory-modal',
        body: `<div class="glory-section"><h3><span>“哟，老熟人给的卷儿。”</span><small>卫兵看了一眼免检查卷，嘿嘿一笑放行</small></h3>
          <p class="camp-muted">“既然是熟人打了招呼，就放你一马。下回洞里见了，可别装不认识。”</p></div>`,
        actions: [{ label: '出城', cls: 'btn-primary', handler: () => { Dialog.close(); doLeaveCamp() } }],
      })
      return
    }
    const roll = Dice.rollZ()
    const guardMsg = (title, body, actions) => {
      Dialog.show({ title: '🛡️ 城门口 · 卫兵', className: 'glory-modal', body, actions })
    }

    // 卫兵事件概率表（用百分比模拟）
    // 10% 罚款100 / 50% 放行 / 5% 没收衣服 / 15% 口交1分钟 / 15% 肛交1分钟 / 5% 给血药
    const r = Math.random() * 100
    if (r < 10) {
      // 罚款 100
      guardMsg('🛡️ 卫兵拦住你', `<div class="glory-section"><h3><span>“妓女证？行，交 100G 罚款。”</span><small>卫兵伸手讨钱</small></h3>
        <p class="camp-muted">${state.gold >= 100 ? '你乖乖掏钱。' : '你掏不出钱，卫兵脸色一沉，把你丢进公共厕所：<b>"没钱？去厕所里干活把钱挣回来！"</b>'}</p></div>`,
        [{ label: state.gold >= 100 ? `💸 交 100G` : '🚻 被丢进厕所', cls: 'btn-primary', handler: () => {
          if (state.gold >= 100) {
            state.gold -= 100
            EventBus.emit('ui:log', { text: '💸 交了 100G 罚款。', type: 'danger' })
            EventBus.emit('state:changed', state); Dialog.close(); doLeaveCamp()
          } else {
            // 没钱：罚款变欠债，丢进公共厕所强制赚钱还债，另收 30G 入场管理费
            state._gloryDebt = (state._gloryDebt || 0) + 100 + GLORY_FEE
            state._gloryByGuard = true   // 标记：被卫兵丢进来的
            EventBus.emit('ui:log', { text: `💸 你付不起 100G 罚款，被卫兵丢进公共厕所！另收 ${GLORY_FEE}G 管理费，合计欠债 ${state._gloryDebt}G，赚够才能出来。`, type: 'danger' })
            EventBus.emit('state:changed', state)
            Dialog.close()
            showGloryWork()
          }
        } }])
    } else if (r < 60) {
      // 放行
      guardMsg('🛡️ 卫兵拦住你', '<div class="glory-section"><h3><span>“啊，老熟人了，过去吧。”</span><small>卫兵挥挥手放行</small></h3></div>',
        [{ label: '出城', cls: 'btn-primary', handler: () => { Dialog.close(); doLeaveCamp() } }])
    } else if (r < 65) {
      // 没收衣服 → 全裸
      guardMsg('🛡️ 卫兵拦住你', `<div class="glory-section"><h3><span>“${state.gender === 'male' ? '男雌婊也敢穿这么少出城？' : '妓女也敢穿这么少出城？'}衣服留下！”</span><small>卫兵一把扯下你的衣服</small></h3>
        <p class="camp-muted">你被扒光了，进入全裸状态。</p></div>`,
        [{ label: '👙 被扒光', cls: 'btn-danger', handler: () => {
          if (!StatusSystem.has('naked')) StatusSystem.apply('naked', 99999)
          EventBus.emit('ui:log', { text: '👙 卫兵没收了你的衣服，你现在全裸！', type: 'danger' })
          EventBus.emit('state:changed', state); Dialog.close(); doLeaveCamp()
        } }])
    } else if (r < 80) {
      // 口交 1 分钟
      guardBlowjob()
    } else if (r < 95) {
      // 肛交 1 分钟
      guardAnal()
    } else {
      // 给血药
      guardMsg('🛡️ 卫兵拦住你', `<div class="glory-section"><h3><span>“小心点，${state.gender === 'male' ? '男雌婊' : '婊子'}。”</span><small>卫兵塞给你一瓶血药</small></h3>
        <p class="camp-muted">获得一瓶麦酒（+10 HP）。</p></div>`,
        [{ label: '收下', cls: 'btn-primary', handler: () => {
          state.inventory.consumables.ale = (state.inventory.consumables.ale || 0) + 1
          EventBus.emit('ui:log', { text: '🍺 卫兵给了你一瓶麦酒。', type: 'good' })
          EventBus.emit('state:changed', state); Dialog.close(); doLeaveCamp()
        } }])
    }
  }

  /** 卫兵口交任务 */
  async function guardBlowjob () {
    const state = State.get()
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const failed = await BattleUI.showTaskDialog({
        enemyName: '🛡️ 卫兵',
        attackName: '',
        desc: '卫兵掏出鸡巴，你跪下来为他口交 1 分钟',
        bpm: 0,
        seconds: 60,
        dmg: 0,
        noDamage: true,
        dildoName: '卫兵那根粗壮的鸡巴',
      })
      Dialog.close()
      EventBus.emit('ui:log', { text: failed ? '🛡️ 你口交到一半，卫兵不耐烦地放你走了。' : '🛡️ 你卖力口交 1 分钟，卫兵满意地放你走。', type: 'dim' })
    } else {
      EventBus.emit('ui:log', { text: '🛡️ 卫兵让你口交，你照做了。', type: 'dim' })
    }
    EventBus.emit('state:changed', state)
    doLeaveCamp()
  }

  /** 卫兵肛交任务 */
  async function guardAnal () {
    const state = State.get()
    const holeText = state.gender !== 'male' ? '小穴' : '菊穴'
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const failed = await BattleUI.showTaskDialog({
        enemyName: '🛡️ 卫兵',
        attackName: '',
        desc: `卫兵让你趴下，从背后操进你的${holeText} 1 分钟`,
        bpm: 120,
        seconds: 60,
        dmg: 0,
        noDamage: true,
        dildoName: '卫兵那根粗壮的鸡巴',
      })
      Dialog.close()
      EventBus.emit('ui:log', { text: failed ? '🛡️ 你中途受不住，卫兵扫兴地放你走了。' : '🛡️ 你被卫兵操了 1 分钟，他满意地放你走。', type: 'dim' })
    } else {
      EventBus.emit('ui:log', { text: '🛡️ 卫兵操了你一顿，放你走了。', type: 'dim' })
    }
    EventBus.emit('state:changed', state)
    doLeaveCamp()
  }

  /** 真正离开营地 */
  function doLeaveCamp () {
    const state = State.get()
    // 离开营地：回到进入营地前的格子，避免困在营地格只能回头
    if (state._campReturnPos && state._campReturnPos.x !== undefined) {
      state.position = { x: state._campReturnPos.x, y: state._campReturnPos.y }
      state._campReturnPos = null
    }
    // 重置厕所 CD，下次进营地可再上一次
    state._toiletUsed = false
    state.phase = 'idle'
    campClose()
    // 离开营地：恢复操作栏与浮动方向键
    const actionBar = document.getElementById('action-bar')
    if (actionBar) actionBar.classList.remove('hidden')
    const float = document.getElementById('dpad-float')
    if (float) float.classList.remove('hidden')
    EventBus.emit('state:changed', state)
    GameFlow.afterEvent()
  }

  function gloryHole () {
    const state = State.get()
    setCampPhase()
    // 有未完成的强制流程（欠债/免费追加）直接回服务单
    if ((state._gloryDebt || 0) > 0 || state._gloryFreeService) { showGloryWork(); return }
    renderToilet()
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
          <div><small>CAMP RESTROOM · 24H</small><h3>灯管滋滋作响，最里面似乎不太对劲。</h3><p>空气里混着消毒水和潮湿木头的味道。</p></div>
        </section>
        <div class="toilet-grid">
          <button class="toilet-card toilet-card-safe ${state._toiletUsed ? 'is-used' : ''}" data-toilet="use"><i>🚽</i><span><b>普通隔间</b><small>${state._toiletUsed ? '今天已经上过了' : '门锁完好 · 免费使用'}</small></span><em>${state._toiletUsed ? '已使用' : '使用'}</em></button>
          <button class="toilet-card toilet-card-secret ${discovered ? 'is-discovered' : ''}" data-toilet="secret"><i>${discovered ? '🍑' : '🔍'}</i><span><b>${discovered ? '隐藏荣耀洞' : '最里面的隔间'}</b><small>${discovered ? '入口已经被你发现' : '门缝里传来压低的喘息'}</small></span><em>${discovered ? '已解锁' : '调查'}</em></button>
        </div>
        <div class="toilet-clue ${discovered ? 'is-discovered' : ''}"><i>${discovered ? '✓' : '!'}</i><span>${discovered ? '你已经知道墙后藏着什么，可以直接进去接单。' : '墙面有一道不自然的圆形轮廓，靠近后还有温热的气流。'}</span></div>`,
      actions: [
        { label: '返回营地', handler: () => { open() } },
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
        <div class="toilet-reveal"><span aria-hidden="true">🍑</span><small>SECRET FOUND · 隐藏区域</small><h3>墙后原来是一处荣耀洞</h3><p>你推开最里面的隔间，一股湿热气息迎面而来。墙上的圆洞后，有人已经等候多时。</p></div>
        <div class="toilet-reveal-info"><span><b>${GLORY_FEE}G</b><small>首次进入费用</small></span><span><b>${SERVICE_SECONDS}s</b><small>基础服务时间</small></span><span><b>💰</b><small>完成服务赚钱</small></span></div>
        <p class="camp-muted">可以用嘴或屁股完成服务${State.get().gender !== 'male' ? '（也可以用小穴）' : ''}。金币不足时能够赊账，但还清之前无法离开。</p>`,
      actions: [
        { label: '🍑 进入荣耀洞', cls: 'btn-primary', handler: () => { enterGlory() } },
        { label: '返回厕所', handler: () => { renderToilet() } },
      ],
    })
  }

  /** 进入荣耀洞：有妓女证免费；没证收费（没钱可赊账） */
  function enterGlory () {
    const state = State.get()
    setCampPhase()
    if ((state._gloryDebt || 0) > 0 || state._gloryFreeService) { showGloryWork(); return }
    const hasLicense = !!state._prostituteLicensed
    const hasGold = state.gold >= GLORY_FEE
    campShow({
      title: '🍑 荣耀洞 · 入场处', className: 'glory-entry-modal',
      body: `<div class="glory-entry-mark">🍑</div><p class="glory-entry-lead">洞里已经有人了。你能听到压抑的喘息和皮带碰撞的声响。</p>
        <div class="glory-rules"><span><b>${hasLicense ? '免费' : GLORY_FEE + 'G'}</b><small>${hasLicense ? '持证免费进入' : '给营地的服务费'}</small></span><span><b>${SERVICE_SECONDS}s</b><small>一次服务时长</small></span><span><b>Z</b><small>完事后的特殊惊喜</small></span></div>
        <p class="camp-muted">${hasLicense ? '你出示了妓女许可证，守卫挥挥手放你进洞。' : '没有许可证在这里接客是违法的——每次服务都会让你更危险，被抓到就要进监狱。'}</p>`,
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
        { label: '返回厕所', handler: () => { renderToilet() } },
      ],
    })
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
    const render = () => {
      const debt = Math.max(0, state._gloryDebt || 0)
      const isFree = !!state._gloryFreeService
      const forced = debt > 0 || isFree
      const notice = isFree
        ? '<div class="glory-notice glory-notice-free"><b>😠 客人还要白嫖一次</b><span>这次没钱拿，做完这单才能穿上裤子走人。</span></div>'
        : debt > 0
          ? `<div class="glory-notice"><b>💸 还欠营地 ${debt}G</b><span>你卖身挣的钱会先被扣去填债，填满前别想溜。</span></div>`
          : '<div class="glory-notice glory-notice-safe"><b>✓ 自由接客</b><span>现在想走就走，想干几单都行。</span></div>'
      // 女性角色额外提供小穴洞（男性只有嘴和屁股）
      const vaginaBtn = state.gender !== 'male'
        ? `<button class="glory-hole-btn" data-hole="vagina"><i>🌸</i><span><b>把小穴凑过去</b><small>张开双腿任客人使用</small></span></button>`
        : ''
      // 白嫖时：客人随机指定一个洞（指名），玩家不能选
      let namedHole = ''
      if (isFree) {
        const pool = state.gender !== 'male' ? ['oral', 'anal', 'vagina'] : ['oral', 'anal']
        const hole = pool[Math.floor(Math.random() * pool.length)]
        const holeInfo = {
          oral: { icon: '👄', name: '嘴穴', tip: '把嘴凑过去，任由客人操弄你的嘴' },
          anal: { icon: '🍑', name: '菊穴', tip: '撅起屁股，让客人从背后操进来' },
          vagina: { icon: '🌸', name: '小穴', tip: '张开双腿，任客人操弄你的小穴' },
        }[hole]
        namedHole = `<div class="glory-section"><h3><span>客人指名要你的${holeInfo.name}</span><small>“就用这里，快给我。”</small></h3>
          <div class="glory-hole-choice">
            <button class="glory-hole-btn" data-hole="${hole}"><i>${holeInfo.icon}</i><span><b>把${holeInfo.name === '嘴穴' ? '嘴' : holeInfo.name === '小穴' ? '小穴' : '屁股'}凑过去</b><small>${holeInfo.tip}</small></span></button>
          </div></div>`
      }
      // 危险值显示（无证卖淫时）
      const wantHtml = state._prostituteLicensed
        ? `<div class="glory-wanted glory-wanted-safe"><span>🛡️ 持证营业</span><em>安全，不会被抓</em></div>`
        : `<div class="glory-wanted"><span>🚨 危险值 <b>${state._gloryWanted || 0}%</b></span><em>越高越容易被抓</em></div>`
      campShow({
        title: '🍑 荣耀洞 · 接客', className: 'glory-modal',
        body: `${notice}${wantHtml}${isFree ? namedHole : `<div class="glory-section"><h3><span>洞后已经有人了</span><small>把身体凑过去，剩下的交给客人</small></h3>
          <div class="glory-hole-choice">
            <button class="glory-hole-btn" data-hole="oral"><i>👄</i><span><b>把嘴凑过去</b><small>任由客人操弄你的嘴</small></span></button>
            <button class="glory-hole-btn" data-hole="anal"><i>🍑</i><span><b>把屁股凑过去</b><small>撅起屁股任客人使用</small></span></button>
            ${vaginaBtn}
          </div></div>`}
          <p class="camp-footnote">你只负责把洞贴上去，客人会用多少钱、怎么干你，全凭他的心情——完事后掷 Z 看是否有额外惊喜。</p>`,
        actions: forced ? [] : [{ label: '返回营地', handler: () => { open() } }],
      })
      document.querySelectorAll('.glory-hole-btn').forEach(btn => {
        btn.onclick = () => {
          const hole = btn.dataset.hole
          performService(hole, render)
        }
      })
    }
    render()
  }

  function rollSpecialEvent () {
    // 加权概率：1=10% / 2=50% / 3=20% / 4=10% / 5=5% / 6=5%
    const roll = Math.random() * 100
    let z
    if (roll < 10) z = 1
    else if (roll < 60) z = 2
    else if (roll < 80) z = 3
    else if (roll < 90) z = 4
    else if (roll < 95) z = 5
    else z = 6
    return ({
      1: { z, basePay: false, tip: 0, msg: '👮 管理员走进来，白嫖了一发，一分钱没给。' },
      2: { z, basePay: true, tip: 0, msg: '🙂 客人舒服地哼哼着离开，一切如常。' },
      3: { z, basePay: true, tip: 5, msg: '💖 客人被你伺候得舒爽，往你嘴里塞了 5 金币小费。' },
      4: { z, basePay: true, tip: 10, msg: '💰 客人被你榨得腿软，大方地甩出 10 金币。' },
      5: { z, basePay: false, tip: 0, complain: true, msg: '😤 客人嫌你服务不行，向营地投诉了你！' },
      6: { z, basePay: true, tip: 0, free: true, msg: '😠 客人嫌你不够卖力，要求免费再来一次！' },
    })[z]
  }

  function runServiceTimer (service, seconds) {
    return new Promise(resolve => {
      let timer = null
      let finishAt = 0
      const cleanup = () => { if (timer) clearInterval(timer); timer = null }
      Dialog.show({
        title: `⏱ 服务 · ${service.name}`, className: 'camp-task-modal',
        body: `<div class="camp-task"><div class="camp-task-icon">${service.icon}</div><p>${service.desc}。你闭眼咬唇，任由客人享用你这 ${seconds} 秒，全程必须撑住。</p><strong id="camp-task-time" aria-live="polite">${seconds}</strong><span>秒</span><div class="camp-task-track"><i id="camp-task-fill"></i></div><small>撑满整段才拿得到钱；中途受不住可以撤，但拒绝服务要加 ${10} 金币债务。</small></div>`,
        actions: [
          { label: '▶ 开始服务', cls: 'btn-primary', handler: begin },
          { label: `🙅 拒绝服务`, cls: 'btn-danger', handler: () => { cleanup(); Dialog.close(); resolve('refuse') } },
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
          document.getElementById('camp-task-complete').onclick = () => { Dialog.close(); resolve(true) }
        }
      }
    })
  }

  async function performService (hole, rerender) {
    const state = State.get()
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
    const completed = await runServiceTimer(service, SERVICE_SECONDS + (event.extraSeconds || 0))
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
    const baseEarn = (!wasFree && event.basePay) ? service.pay : 0
    const tip = wasFree ? 0 : (event.tip || 0)
    let totalEarn = baseEarn + tip
    // 投诉：客人向营地投诉，加 30 欠款且这次不给钱
    if (event.complain) {
      state._gloryDebt = (state._gloryDebt || 0) + 30
      EventBus.emit('ui:log', { text: `😤 客人投诉你服务不行，被营地记了 30 金币欠款（现欠 ${state._gloryDebt}G）！`, type: 'danger' })
    }
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
    state.gold += totalEarn - repaid
    // 还清欠款：出城时根据来源触发——卫兵放行嘲笑 / 队长羞辱
    if (repaid > 0 && state._gloryDebt === 0 && (state._gloryByGuard || state._gloryByCaptain)) {
      state._gloryJustCleared = true
      state._gloryByGuard = false
    }
    if (event.free) state._gloryFreeService = true
    EventBus.emit('ui:log', { text: wasFree ? `🍑 你伺候完「${service.name}」，客人提起裤子就走，一分钱没给（白嫖）。` : `🍑 你伺候完「${service.name}」，累得腰酸背痛，赚了 ${totalEarn} 金币。`, type: totalEarn > 0 ? 'good' : 'dim' })
    if (repaid > 0) EventBus.emit('ui:log', { text: `💸 你挣的钱先被营地扣去还债 ${repaid} 金币，还剩 ${state._gloryDebt} 没还清。`, type: 'dim' })
    EventBus.emit('ui:log', { text: `🎲 Z=${event.z}：${wasFree && event.tip > 0 ? event.msg.replace(/小费|金币/g, '') : event.msg}`, type: event.tip > 0 && !wasFree ? 'good' : 'dim' })
    EventBus.emit('state:changed', state)
    // 无证卖淫：危险值处理（管理员使用 -10，否则 +2），越高越容易被抓
    if (!state._prostituteLicensed && !wasFree) {
      if (event.z === 1) {
        state._gloryWanted = Math.max(0, (state._gloryWanted || 0) - 10)
        EventBus.emit('ui:log', { text: `👮 管理员刚刚「使用」过你，给你罩着点，危险值 -10（现 ${state._gloryWanted}%）。`, type: 'good' })
      } else {
        state._gloryWanted = Math.min(100, (state._gloryWanted || 0) + 2)
        EventBus.emit('ui:log', { text: `🚨 无证卖淫，危险值 +2（现 ${state._gloryWanted}%）。越高越容易被抓！`, type: 'danger' })
      }
      EventBus.emit('state:changed', state)
      // 按危险值概率被抓进监狱（有队长豁免则不会被抓）
      const wantRoll = Math.floor(Math.random() * 100)
      if (wantRoll < state._gloryWanted && !state._prisonPardon) {
        EventBus.emit('ui:log', { text: `⛓️ 危险值过高，守卫冲进来把你逮个正着！`, type: 'danger' })
        state._gloryWanted = 0
        EventBus.emit('state:changed', state)
        Dialog.close()
        enterPrison()
        return
      }
      if (state._prisonPardon && wantRoll < state._gloryWanted) {
        EventBus.emit('ui:log', { text: `🕊️ 危险值 ${state._gloryWanted}% 触顶，但队长的豁免罩着你，守卫不敢抓你。`, type: 'good' })
        state._gloryWanted = Math.max(0, state._gloryWanted - 10)
        EventBus.emit('state:changed', state)
      }
    }
    const forced = state._gloryDebt > 0 || state._gloryFreeService
    campShow({
      title: '🍑 服务完成', className: 'glory-result-modal',
      body: `<div class="glory-result"><strong>${totalEarn > 0 ? `赚了 ${totalEarn}G` : '白干了一场'}</strong><p>${wasFree && event.tip > 0 ? event.msg.replace(/小费|金币/g, '') : event.msg}</p>${repaid > 0 ? `<span>还债 ${repaid}G · 还欠 ${state._gloryDebt}G</span>` : ''}${state._gloryFreeService ? '<span class="danger">还有个免费的得做完才能走</span>' : ''}</div>`,
      actions: [
        { label: forced ? '继续服务' : '继续接客', cls: 'btn-primary', handler: () => { Dialog.close(); rerender() } },
        ...(!forced ? [{ label: '返回营地', handler: () => { Dialog.close(); gloryClearedLeave() } }] : []),
      ],
    })
  }

  /* ============ 监狱系统 ============ */

  /** 出狱所需积分（按难度：普通 300 / 困难 400 / 残酷 500，越狱失败会加惩罚） */
  function prisonTarget () {
    const base = { normal: 300, hard: 400, brutal: 500 }[State.get().difficulty] || 300
    return base + (State.get()._prisonEscapePenalty || 0)
  }

  /** 监狱大门（平时查看） */
  function prisonDoor () {
    const state = State.get()
    if (state._inPrison) { prisonWork(); return }
    campShow({
      title: '⛓️ 营地监狱', className: 'prison-modal',
      body: `<div class="prison-intro"><div class="prison-mark" aria-hidden="true">⛓️</div>
        <p>营地角落的石砌监狱，铁门紧锁。</p>
        <p>没有<b>妓女许可证</b>就在荣耀洞卖淫是违法的——每次服务都会增加你的<b>危险值</b>，一旦被守卫抓到，就会被关进来，靠给犯人提供<b>口交 / 深喉服务</b>攒积分，积分攒够了才能出狱。</p>
        <p>墙内隐约传来压抑的呻吟和皮鞭声。</p></div>`,
      actions: [
        { label: '离开', handler: () => { open() } },
      ],
    })
  }

  /** 被抓进监狱：无证卖淫的惩罚，需按难度攒积分出狱 */
  function enterPrison () {
    const state = State.get()
    state._inPrison = true
    state._prisonPoints = 0
    state.phase = 'camp'
    EventBus.emit('state:changed', state)
    // 监狱专用贞操带/贞操锁：小穴被锁死（作为装备）
    state._prisonChastity = true
    if (!StatusSystem.has('chastity')) StatusSystem.apply('chastity', 99999)
    const target = prisonTarget()
    campShow({
      title: '⛓️ 营地监狱', className: 'prison-modal',
      body: `<div class="prison-intro"><div class="prison-mark" aria-hidden="true">⛓️</div>
        <p>你因犯下<b>非法卖淫罪</b>被守卫当场抓获，押进了营地监狱。</p>
        <p>判决如下：罚你进入<b>深喉监狱</b>——你的小穴会被锁进冰冷的<b>贞操笼</b>，"你这种废物肉虫，不配使用自己的身体，就像你一样。以后你就用你的<b>嘴穴</b>来服务大家吧。"</p>
        <p>要出狱，你得靠提供<b>口交 / 深喉服务</b>伺候牢房里的犯人和过往的村民，攒够 <b>${target} 积分</b>才行。</p></div>`,
      actions: [
        { label: '⛓️ 进入牢房', cls: 'btn-danger', handler: () => { prisonWork() } },
      ],
    })
  }

  /** 牢房工作界面：罪名 + 狱友 + 自选任务类型后掷 Z；攒够积分可自行选择出狱 */
  function prisonWork () {
    const state = State.get()
    const points = state._prisonPoints || 0
    const target = prisonTarget()
    const done = points >= target
    // 永久监禁：可以继续做任务，但没有越狱/出狱按钮（做了也无用）
    if (state._prisonLife) {
      campShow({
        title: '⛓️ 营地监狱 · 永久监禁', className: 'prison-modal',
        body: `<div class="prison-stats"><span>⛓️ 永久监禁</span><span>⚖️ 罪名 <b>非法卖淫罪</b></span><span>🔒 贞操锁焊死</span></div>
          <div class="prison-intro"><div class="prison-mark" aria-hidden="true">⛓️</div>
          <p>你越狱失败三次，被判处<b>永久监禁</b>。</p>
          <p>守卫当众给你戴上特制的贞操笼，焊死了锁眼："这辈子，你就老老实实当牢房的肉便器吧。"</p>
          <p>你已经无法出狱——但你仍然被要求继续提供口交/深喉服务，供牢房里的犯人取乐。</p>
          <p class="prison-guard">狱友投来同情的目光，没人再和你说话。</p></div>`,
        actions: [
          { label: '🎲 继续服刑（掷 Z）', cls: 'btn-danger', handler: () => { Dialog.close(); prisonTierChoice() } },
        ],
      })
      return
    }
    campShow({
      title: '⛓️ 营地监狱 · 集体牢房', className: 'prison-modal',
      body: `<div class="prison-stats"><span>⛓️ 出狱积分 <b>${points}/${target}</b></span><span>⚖️ 罪名 <b>非法卖淫罪</b></span><span>🔒 贞操笼已锁</span></div>
        <div class="prison-cell">
          <div class="camp-character"><i>🧔</i><div><b>五名囚犯挤在牢房里，表情阴郁。</b><p>“我们不过是偷了块面包、欠了点酒钱，就被关了进来。”其中一个压低声音，“这明显不公……嘘，守卫来了。”</p></div></div>
          <p class="prison-guard">“不要再说话了！是时候开始工作了！”</p>
        </div>
        <p class="camp-footnote">${points < 80 ? '积分不到 80，只能接基础任务。攒到 80 分后可解锁中级任务。' : '你已解锁中级任务，可以接更挣积分的活了。'}${done ? ' 你已经攒够了出狱积分，随时可以离开——也可以留下继续接活。' : ''}</p>`,
      actions: [
        { label: done ? '🔓 选择出狱' : '🎲 选择任务并掷 Z', cls: done ? 'btn-primary' : 'btn-danger', handler: () => { Dialog.close(); done ? prisonRelease() : prisonTierChoice() } },
        ...(done ? [{ label: '⛓️ 留下继续工作', handler: () => { Dialog.close(); prisonTierChoice() } }] : []),
        { label: '🪓 越狱（25%）', cls: 'btn-danger', handler: () => { Dialog.close(); prisonEscape() } },
      ],
    })
  }

  /** 越狱：25% 成功率；失败累积惩罚，第 3 次永久监禁 */
  function prisonEscape () {
    const state = State.get()
    const roll = Math.floor(Math.random() * 100)
    if (roll < 25) {
      // 成功越狱：出狱但贞操锁不解开
      state._inPrison = false
      state._prisonPoints = 0
      state._prisonEscapeFails = 0
      state._prisonEscapePenalty = 0
      EventBus.emit('state:changed', state)
      Dialog.show({
        title: '🪓 越狱成功', className: 'prison-modal',
        body: `<div class="prison-intro"><div class="prison-mark" aria-hidden="true">🪓</div>
          <p>你趁着守卫换班的空隙，撬开牢门溜了出去！（掷骰 ${roll}% < 25%）</p>
          <p>但——那把<b>贞操锁</b>还牢牢锁在你身上，钥匙只有守卫有。<br>你带着锁逃出了监狱。</p></div>`,
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
        title: '⛓️ 越狱失败 · 永久监禁', className: 'prison-modal',
        body: `<div class="prison-intro"><div class="prison-mark" aria-hidden="true">⛓️</div>
          <p>第 <b>3</b> 次越狱失败！（掷骰 ${roll}% ≥ 25%）</p>
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
      title: t.title, className: 'prison-modal',
      body: `<div class="prison-intro"><div class="prison-mark" aria-hidden="true">${t.mark}</div>
        <p>第 <b>${fail}</b> 次越狱失败！（掷骰 ${roll}% ≥ 25%）</p>
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
    campShow({
      title: '📋 选择任务类型', className: 'prison-modal',
      body: `<div class="prison-progress">
          <div class="prison-progress-head"><span>⛓️ 出狱积分</span><b>${points} / ${target}</b></div>
          <div class="prison-progress-bar"><i style="width:${pct}%"></i></div>
          <em>${pct}% · 中级任务需 80 积分，进阶任务需 300 积分</em>
        </div>
        <div class="prison-intro"><div class="prison-mark" aria-hidden="true">📋</div>
        <p>牢房守卫把任务板推到你面前。选择要接哪种任务，然后掷骰决定具体内容。</p>
        <div class="toilet-grid">
          <button class="toilet-card toilet-card-safe" data-tier="basic"><i>🔰</i><span><b>基础任务</b><small>2-16 积分 · 深喉/喉穴抽插</small></span><em>随时可接</em></button>
          <button class="toilet-card toilet-card-secret ${midUnlocked ? '' : 'is-locked'}" data-tier="${midUnlocked ? 'mid' : ''}"><i>📈</i><span><b>中级任务</b><small>15-27 积分 · 深喉百次/操到呕吐</small></span><em>${midUnlocked ? '可接' : '需 80 积分'}</em></button>
          <button class="toilet-card toilet-card-adv ${advUnlocked ? '' : 'is-locked'}" data-tier="${advUnlocked ? 'adv' : ''}"><i>💀</i><span><b>进阶任务</b><small>25-40 积分 · 极限深喉/喉咙旋转</small></span><em>${advUnlocked ? '可接' : '需 300 积分'}</em></button>
        </div></div>`,
      actions: [
        { label: '返回牢房', handler: () => { prisonWork() } },
      ],
    })
    document.querySelectorAll('[data-tier]').forEach(btn => {
      btn.onclick = () => {
        const tier = btn.dataset.tier
        if (!tier) {
          EventBus.emit('ui:log', { text: btn.dataset.tier === '' ? '⛓️ 积分未达标，该任务类型还没解锁。' : '⛓️ 积分未达标，该任务类型还没解锁。', type: 'dim' })
          return
        }
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
        body: `<div class="camp-task"><div class="camp-task-icon">🗣️</div><p>${desc}</p><small>完成这段后点击继续。</small></div>`,
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
    state._inPrison = false
    state._prisonPoints = 0
    state._prisonRehab = 0
    state._prisonEscapeFails = 0
    state._prisonEscapePenalty = 0
    state._prisonChastity = false   // 正常出狱：解锁监狱贞操装备
    if (StatusSystem.has('chastity')) StatusSystem.remove('chastity')
    EventBus.emit('state:changed', state)
    campShow({
      title: '⛓️ 监狱 · 释放', className: 'prison-modal',
      body: `<div class="prison-intro"><div class="prison-mark" aria-hidden="true">🔓</div>
        <p>你终于攒够了 <b>${prisonTarget()} 积分</b>，守卫解开了你的贞操笼和手铐。</p>
        <p>"出去吧。下次再敢无证卖淫，可就不是蹲几天这么简单了。"</p>
        <p>你拖着酸软的膝盖爬出牢房，重见天日。</p></div>`,
      actions: [
        { label: '回到营地', cls: 'btn-primary', handler: () => { open() } },
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
        title: '⛓️ 惩罚牢房 · 矫正教育', className: 'prison-punish-modal',
        body: `<div class="prison-intro"><div class="prison-mark" aria-hidden="true">🎓</div>
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
      state._prisonPoints = Math.min(prisonTarget(), (state._prisonPoints || 0) + task.points)
      EventBus.emit('ui:log', { text: `🎓 你完成再教育，获得 ${task.points} 积分（现 ${state._prisonPoints}/${prisonTarget()}）。专家仍不打算放你走，继续赎罪。`, type: 'good' })
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
        title: '⛓️ 进阶惩罚牢房 · 纯虐待', className: 'prison-punish-modal',
        body: `<div class="prison-intro"><div class="prison-mark" aria-hidden="true">👿</div>
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
            steps.push({ desc: task.phaseDesc || task.desc, bpm: 120, seconds: task.holdSeconds, restAfter: task.restSeconds > 0 && i < task.repeat - 1 })
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
      state._prisonPoints = Math.min(prisonTarget(), (state._prisonPoints || 0) + task.points)
      EventBus.emit('ui:log', { text: `👿 你熬过虐待，获得 ${task.points} 积分（现 ${state._prisonPoints}/${prisonTarget()}）。守卫仍不打算放你走，继续受刑。`, type: 'good' })
      EventBus.emit('state:changed', state)
      prisonAdvPunishment()
    }
    showPunish()
  }

  /** 还清欠款后离开荣耀洞：根据来源触发卫兵嘲笑 / 队长羞辱，再回营地 */
  function gloryClearedLeave () {
    const state = State.get()
    if (!state._gloryJustCleared) { open(); return }
    state._gloryJustCleared = false
    EventBus.emit('state:changed', state)
    if (state._gloryByCaptain) {
      state._gloryByCaptain = false
      EventBus.emit('state:changed', state)
      captainGloryHumiliation()
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
  function blacksmith () {
    const state = State.get()
    setCampPhase()
    // 已签订服务契约（解锁监狱贞操装备时）：每次进铺子都要先服务铁匠
    if (state._blacksmithContract) {
      Dialog.show({
        title: '🔨 铁匠', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🔨</i><div><b>“哟，签了契约的母狗来了。”</b><p>铁匠咧嘴一笑，放下锤子："规矩还记得吧？想进我的铺子，先把老子伺候舒坦了。"</p></div></div>
          <p class="camp-footnote">契约（永久）：每次进铁匠铺都要先给他<b>口交</b>，再给他<b>肛交/性交</b>。</p>`,
        actions: [
          { label: '💦 服务铁匠（进店）', cls: 'btn-primary', handler: () => { Dialog.close(); blacksmithService() } },
          { label: '🚶 转身就走', handler: () => { Dialog.close(); open() } },
        ],
      })
      return
    }
    // 正常进铁匠铺
    blacksmithShop()
  }

  /** 铁匠服务任务：口交 + 肛交/性交 */
  async function blacksmithService () {
    const state = State.get()
    const isFemale = state.gender !== 'male'
    const sexDesc = isFemale ? '你躺下来张开腿，让铁匠用粗鸡巴狠狠操进你的小穴' : '你趴跪在铁砧边，撅起屁股让铁匠从背后操进你的菊穴'
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const steps = [
        { desc: '你跪在铁匠腿间，含住他那根粗壮的鸡巴卖力吞吐深喉', bpm: 0, seconds: 30 },
        { desc: sexDesc, bpm: 90, seconds: 30 },
      ]
      for (let i = 0; i < steps.length; i++) {
        const f = await BattleUI.showTaskDialog({
          enemyName: `🔨 铁匠（第 ${i + 1}/2 段）`,
          attackName: '服务铁匠',
          desc: steps[i].desc,
          bpm: steps[i].bpm || 0,
          seconds: steps[i].seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName: '铁匠那根粗壮的鸡巴',
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm('服务铁匠：口交 + 肛交/性交（完成代表伺候完了）。')
    }
    if (failed) {
      EventBus.emit('ui:log', { text: '🏃 你伺候到一半就跑，铁匠骂骂咧咧："下次再来，别想进我的铺子！"', type: 'danger' })
      open()
      return
    }
    EventBus.emit('ui:log', { text: '💦 铁匠被你伺候舒服了，擦擦手："行，进来挑吧。"', type: 'good' })
    blacksmithShop()
  }

  /** 铁匠主界面：聊天 / 商店 / 解锁监狱贞操装备 */
  function blacksmithShop () {
    const state = State.get()
    campShow({
      title: '🔨 铁匠铺', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🔨</i><div><b>“想看点什么？”</b><p>铁匠磨着刀，扫了你一眼："家伙什儿都在架上，自己挑。"</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-bs="buy"><i>🛒</i><span><b>商店</b><small>武器与饰品</small></span><em>进店</em></button>
          <button class="camp-opt" data-bs="chat"><i>💬</i><span><b>聊天</b><small>听铁匠唠唠</small></span><em>搭话</em></button>
          ${state._prisonChastity ? `<button class="camp-opt" data-bs="unlock"><i>🔓</i><span><b>解锁监狱贞操装备</b><small>求铁匠打开你身上的锁</small></span><em>求解锁</em></button>` : ''}
        </div>`,
      actions: [{ label: '返回营地', handler: () => { Dialog.close(); open() } }],
    })
    document.querySelectorAll('[data-bs]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.bs
        Dialog.close()
        if (opt === 'buy') blacksmithBuy()
        else if (opt === 'chat') blacksmithChat()
        else if (opt === 'unlock') blacksmithUnlock()
      }
    })
  }

  /** 进铁匠商店 */
  function blacksmithBuy () {
    const state = State.get()
    state._shopReturnToCamp = true
    EventBus.emit('state:changed', state)
    ShopSystem.open({ type: TILE.CAMP, raw: '铁匠铺' })
  }

  /** 铁匠聊天：随机循环 */
  const BLACKSMITH_CHATS = [
    { title: '💬 铁匠 · 打铁', body: `<div class="camp-character"><i>🔨</i><div><b>“打了一辈子铁，什么家伙都见过。”</b><p>他敲了敲砧子：“你这小身板，扛得住好剑。”</p></div></div>` },
    { title: '💬 铁匠 · 兵器', body: `<div class="camp-character"><i>🔨</i><div><b>“好兵器要趁手，更要趁热。”</b><p>他指了指墙上的剑："想要好货，得先过我这关。"</p></div></div>` },
    { title: '💬 铁匠 · 镇子', body: `<div class="camp-character"><i>🔨</i><div><b>“镇上铁匠铺就我一家，不愁没生意。”</b><p>他咧嘴一笑："不过嘛，来我这儿的，多少得付出点代价。"</p></div></div>` },
  ]
  function blacksmithChat () {
    const state = State.get()
    const pool = BLACKSMITH_CHATS
    const pick = pool[Math.floor(Math.random() * pool.length)]
    campShow({
      title: pick.title, className: 'camp-tavern-modal', body: pick.body,
      actions: [
        { label: '再聊聊', handler: () => { Dialog.close(); blacksmithChat() } },
        { label: '返回铁匠', handler: () => { Dialog.close(); blacksmithShop() } },
      ],
    })
  }

  /** 解锁监狱贞操装备：500G + 大腿写"免费肉便器" */
  function blacksmithUnlock () {
    const state = State.get()
    campShow({
      title: '🔓 解锁监狱贞操装备', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🔨</i><div><b>“身上那把锁，我认得。”</b><p>铁匠盯着你腿间的贞操锁："监狱的货。想让我撬开？可以——<b>500G</b>，外加在大腿上烙上这几个字：<b>免费肉便器</b>。"</p></div></div>
        <p class="camp-footnote">但解这个锁是有条件的——你得先跟我<b>签个契约</b>：往后每次进我的铺子，都得先伺候我一顿（口交 + 肛交/性交）。</p>`,
      actions: [
        { label: state.gold >= 500 ? '📜 签契约 + 花 500G 解锁' : '💰 钱不够（500G）', cls: state.gold >= 500 ? 'btn-primary' : 'btn-danger', handler: () => {
          if (state.gold < 500) { EventBus.emit('ui:log', { text: '💰 钱不够解锁。', type: 'dim' }); blacksmithUnlock(); return }
          // 先签契约 + 服务，服务完才真正解锁
          Dialog.close()
          blacksmithContractService()
        } },
        { label: '算了', handler: () => { Dialog.close(); blacksmithShop() } },
      ],
    })
  }

  /** 签订契约：先服务铁匠（口交+肛交/性交），服务完才解锁 */
  async function blacksmithContractService () {
    const state = State.get()
    const isFemale = state.gender !== 'male'
    const sexDesc = isFemale ? '你躺下来张开腿，让铁匠用粗鸡巴狠狠操进你的小穴' : '你趴跪在铁砧边，撅起屁股让铁匠从背后操进你的菊穴'
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const steps = [
        { desc: '你跪在铁匠腿间，含住他那根粗壮的鸡巴卖力吞吐深喉', bpm: 0, seconds: 30 },
        { desc: sexDesc, bpm: 90, seconds: 30 },
      ]
      for (let i = 0; i < steps.length; i++) {
        const f = await BattleUI.showTaskDialog({
          enemyName: `🔨 铁匠（第 ${i + 1}/2 段）`,
          attackName: '签订契约 · 服务铁匠',
          desc: steps[i].desc,
          bpm: steps[i].bpm || 0,
          seconds: steps[i].seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName: '铁匠那根粗壮的鸡巴',
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm('服务铁匠：口交 + 肛交/性交。')
    }
    if (failed) {
      EventBus.emit('ui:log', { text: '🏃 你伺候到一半就跑，铁匠骂骂咧咧："契约不签了？锁也别想开！"', type: 'danger' })
      blacksmithShop()
      return
    }
    // 服务完成：签订契约 + 解锁
    state.gold -= 500
    state._prisonChastity = false
    state._freeMeatBrand = true
    state._blacksmithContract = true   // 永久契约：以后每次进铺子都要先服务
    if (StatusSystem.has('chastity')) StatusSystem.remove('chastity')
    EventBus.emit('ui:log', { text: '💦 铁匠被你伺候舒服了，签下契约，撬开了你的监狱贞操锁，并烙上"免费肉便器"。', type: 'good' })
    EventBus.emit('state:changed', state)
    Dialog.show({
      title: '🔓 契约签订 · 解锁完成', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🔨</i><div><b>“成了。锁开了，契约也签了。”</b><p>铁匠拍拍你的屁股："记住，往后每次进我这铺子，都得先伺候我一顿——这是你自己签的。"</p></div></div>
        <p class="camp-footnote">你的大腿上烙下了<b>免费肉便器</b>，监狱贞操装备已取下。</p>`,
      actions: [
        { label: '进店', cls: 'btn-primary', handler: () => { Dialog.close(); blacksmithShop() } },
      ],
    })
  }

  function deer () {
    const state = State.get(); setCampPhase()
    if (state._campDeerTaken) {
      campShow({ title: '🦌 篝火旁的鹿', className: 'camp-deer-modal', body: '<div class="camp-character"><i>🦌</i><div><b>“好好冒险吧，旅人。”</b><p>小鹿卧在火光边，温柔地朝你眨了眨眼。</p></div></div>', actions: [{ label: '返回营地', handler: () => { Dialog.close(); open() } }] }); return
    }
    campShow({
      title: '🦌 篝火旁的鹿', className: 'camp-deer-modal',
      body: `<div class="camp-character"><i>🦌</i><div><b>“初次踏入妖林的旅人，带上这些吧。”</b><p>她把一束扎好的补给推到你面前。</p></div></div><div class="camp-gifts"><span><i>🌿</i><b>坚韧树枝</b><small>2 伤害 · 可战斗 4 次</small></span><span><i>🩹</i><b>创可贴 ×1</b><small>基础治疗补给</small></span><span><i>🍺</i><b>麦酒 ×1</b><small>旅途中恢复体力</small></span></div>`,
      actions: [{ label: '收下见面礼', cls: 'btn-primary', handler: () => {
        if (state._campDeerTaken) { Dialog.close(); open(); return }
        state.inventory.consumables.twig = (state.inventory.consumables.twig || 0) + 4
        state.inventory.consumables.bandaid = (state.inventory.consumables.bandaid || 0) + 1
        state.inventory.consumables.ale = (state.inventory.consumables.ale || 0) + 1
        state._campDeerTaken = true
        EventBus.emit('ui:log', { text: '🦌 收下了鹿准备的树枝与基础补给。', type: 'good' })
        EventBus.emit('state:changed', state); Dialog.close(); open()
      } }],
    })
  }

  function tavern () {
    setCampPhase()
    renderTavern()
  }

  /** 酒馆主界面：两个人——老顾客 & 老板娘 */
  function renderTavern () {
    const state = State.get()
    const guestGone = (state._tavernGuest || 0) <= 0

    campShow({
      title: '🍺 雾灯酒馆', className: 'camp-tavern-modal',
      body: `<section class="tavern-hero"><div class="tavern-lamp" aria-hidden="true">🕯️</div><div><small>MISTLAMP TAVERN · 营业中</small><h3>杯盏轻响，炉火把木墙染成酒红色。</h3><p>老板娘守着吧台，角落的赌桌仍等着下一局。</p></div></section>
        <div class="tavern-stats"><span>💎 你有 <b>${state.gold}G</b></span><span>🎲 赌客资金 <b>${Math.max(0, state._tavernGuest || 0)}G</b></span><span>💼 打工 <b>${state._tavernWorkUnlocked ? '已解锁' : '未解锁'}</b></span></div>
        <div class="tavern-grid">
          <button class="tavern-card tavern-card-barkeep" data-tavern="barkeep"><i>💃</i><span><b>酒馆老板娘</b><small>酒单、闲聊与工作机会</small></span><em>去吧台</em></button>
          <button class="tavern-card tavern-card-captain" data-tavern="captain"><i>🛡️</i><span><b>守卫队队长</b><small>军官的架子与门道</small></span><em>搭话</em></button>
          ${state._mercenary ? '' : `<button class="tavern-card tavern-card-futa" data-tavern="futa"><i>⚔️</i><span><b>角落的女战士</b><small>沉默寡言，独自喝着不动的酒</small></span><em>搭话</em></button>`}
          <button class="tavern-card tavern-card-guest ${guestGone ? 'is-empty' : ''}" data-tavern="guest"><i>${guestGone ? '🪑' : '🎲'}</i><span><b>${guestGone ? '空着的赌桌' : '爱赌的老顾客'}</b><small>${guestGone ? '打赢敌人后他会带着 50G 回来' : `还剩 ${state._tavernGuest}G 可赢`}</small></span><em>${guestGone ? '查看' : '开一局'}</em></button>
        </div>`,
      actions: [{ label: '返回营地', handler: () => { open() } }],
    })
    document.querySelectorAll('[data-tavern]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.tavern
        if (opt === 'guest') tavernGuest()
        else if (opt === 'barkeep') tavernBarkeep()
        else if (opt === 'captain') tavernCaptain()
        else if (opt === 'futa') tavernFuta()
      }
    })
  }

  /** 老顾客：对话 + 赌博 */
  function tavernGuest () {
    const state = State.get()
    const guestGone = (state._tavernGuest || 0) <= 0
    if (guestGone) {
      campShow({
        title: '🎲 老顾客的位子',
        body: '<p>那张椅子空了。你把他的钱赢光，他气得骂骂咧咧地走了。<br><span style="color:var(--text-dim)">打赢一个敌人后，他还会揣着 50G 回来。</span></p>',
        actions: [{ label: '返回酒馆', handler: () => { renderTavern() } }],
      })
      return
    }
    campShow({
      title: '🎲 老顾客',
      className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🧔</i><div><b>“嘿，旅人，来两把骰子不？”</b><p>他晃了晃手里的骰子，咧嘴一笑。兜里还有 ${state._tavernGuest}G，看起来很好赢。</p></div></div>`,
      actions: [
        { label: '🎲 摇骰子赌博', cls: 'btn-primary', handler: () => { tavernGamble() } },
        { label: '返回酒馆', handler: () => { renderTavern() } },
      ],
    })
  }

  /** 守卫队队长：军官的架子 + 卖妓女许可证（比老板娘多条路子） */
  function tavernCaptain () {
    const state = State.get()
    const hasLicense = state._prostituteLicensed
    campShow({
      title: '🛡️ 守卫队队长', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🛡️</i><div><b>“哼，又是个想在这林子里讨生活的。”</b><p>军官抿了口酒，打量你几眼：“这城里不管做什么生意，都得在我这儿挂个号。懂？”</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-captain="chat"><i>💬</i><span><b>聊天</b><small>听他讲讲守卫队的门道</small></span><em>搭话</em></button>
          ${hasLicense ? '' : `<button class="camp-opt" data-captain="buy"><i>📜</i><span><b>购买妓女许可证</b><small>在队长这也能办证，200G</small></span><em>${state.gold >= 200 ? '可办' : '钱不够'}</em></button>`}
          ${hasLicense ? `<button class="camp-opt" data-captain="cancel"><i>🗑️</i><span><b>取消妓女许可证</b><small>退出这行，退出前先想清楚</small></span><em>${prostituteTitle(state._prostituteLevel).name}</em></button>` : ''}
          <button class="camp-opt" data-captain="pardon"><i>🕊️</i><span><b>求情免进监狱</b><small>${state._prisonPardon ? '已豁免' : '求队长别把你送进深喉监狱'}</small></span><em>${state._prisonPardon ? '已生效' : '求情'}</em></button>
        </div>`,
      actions: [{ label: '返回酒馆', handler: () => { renderTavern() } }],
    })
    document.querySelectorAll('[data-captain]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.captain
        if (opt === 'chat') captainChat()
        else if (opt === 'buy') captainBuyLicense()
        else if (opt === 'cancel') captainCancelLicense()
        else if (opt === 'pardon') captainPardon()
      }
    })
  }

  /** 队长求情免监狱：开关设置 + 求情流程 */
  function captainPardon () {
    const state = State.get()
    campShow({
      title: '🕊️ 求情免进监狱', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🛡️</i><div><b>“哼，想求我别把你扔进深喉监狱？”</b><p>队长翘着二郎腿打量你：“可以——但得看你识不识相。”</p></div></div>
        <div class="toilet-grid">
          <button class="toilet-card ${state._prisonPardonSetting ? 'is-discovered' : ''}" data-pardon="on"><i>🔓</i><span><b>求情（开）</b><small>求他 → 羞辱对话 → 给他口交 → 豁免</small></span><em>${state._prisonPardonSetting ? '当前' : '关闭'}</em></button>
          <button class="toilet-card ${!state._prisonPardonSetting ? 'is-discovered' : ''}" data-pardon="off"><i>🧎</i><span><b>求情（关）</b><small>不口交 · 磕头羞辱对话后豁免</small></span><em>${!state._prisonPardonSetting ? '当前' : '关闭'}</em></button>
        </div>`,
      actions: [
        { label: '返回队长', handler: () => { tavernCaptain() } },
      ],
    })
    document.querySelectorAll('[data-pardon]').forEach(btn => {
      btn.onclick = () => {
        state._prisonPardonSetting = btn.dataset.pardon === 'on'
        EventBus.emit('state:changed', state)
        Dialog.close()
        runPardon()
      }
    })
  }

  /** 执行求情流程 */
  function runPardon () {
    const state = State.get()
    if (state._prisonPardonSetting) {
      // 开：羞辱请求对话 + 口交任务
      Dialog.show({
        title: '🕊️ 队长 · 羞辱请求', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“跪下求我。”</b><p>队长把靴子踩在你面前：“求求我，说你是条贱狗，请大人别把你扔进深喉监狱。说得好听，我再考虑要不要你的嘴。”</p></div></div>`,
        actions: [
          { label: '🧎 跪下求情', cls: 'btn-danger', handler: () => {
            Dialog.close()
            EventBus.emit('ui:log', { text: '🧎 你跪下来磕头："队长大人，我是条贱狗，求您别把我送进深喉监狱……"', type: 'danger' })
            pardonBlowjob()
          } },
        ],
      })
    } else {
      // 关：磕头羞辱对话（不口交）
      Dialog.show({
        title: '🕊️ 队长 · 羞辱', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“求我？磕三个响头。”</b><p>队长冷笑：“想让我不送你去深喉监狱，就拿出点诚意来。”</p></div></div>`,
        actions: [
          { label: '🧎 磕头求饶', cls: 'btn-danger', handler: () => {
            Dialog.close()
            EventBus.emit('ui:log', { text: '🧎 你跪下磕了三个响头，队长满意地哼了一声。', type: 'danger' })
            grantPardon()
          } },
        ],
      })
    }
  }

  /** 口交求情任务 */
  async function pardonBlowjob () {
    const state = State.get()
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const f = await BattleUI.showTaskDialog({
        enemyName: '🛡️ 守卫队队长',
        attackName: '跪着口交求情',
        desc: '你跪在队长胯下，卖力地为他口交 30 秒，含着鸡巴含到嗓子眼',
        bpm: 0,
        seconds: 30,
        dmg: 0,
        noDamage: true,
        dildoName: '队长那根粗壮的鸡巴',
      })
      failed = f
    } else {
      failed = !confirm('给队长口交 30 秒求情。')
    }
    if (failed) {
      EventBus.emit('ui:log', { text: '🛡️ 你口交到一半，队长嫌你不够卖力，还是把你扔进了监狱！', type: 'danger' })
      Dialog.close()
      enterPrison()
      return
    }
    EventBus.emit('ui:log', { text: '🛡️ 队长被你伺候舒服了，挥挥手："行，放你一马。"', type: 'good' })
    grantPardon()
  }

  /** 授予豁免 */
  function grantPardon () {
    const state = State.get()
    state._prisonPardon = true
    state._gloryWanted = 0
    EventBus.emit('state:changed', state)
    Dialog.show({
      title: '🕊️ 队长 · 豁免生效', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🛡️</i><div><b>“记住，这是老子给你的恩典。”</b><p>队长拍拍你的脸："往后就算你把危险值作到 100，我也不会让手下把你扔进深喉监狱。滚吧。"</p></div></div>`,
      actions: [
        { label: '谢过队长', cls: 'btn-primary', handler: () => { Dialog.close(); tavernCaptain() } },
      ],
    })
  }

  /** 队长聊天：随机循环闲话 */
  const CAPTAIN_CHATS = [
    { title: '💬 守卫队队长 · 规矩', body: `<div class="camp-character"><i>🛡️</i><div><b>“营地里三教九流，出了事都得往我们这儿报。”</b><p>他指节敲着桌子：“你要是在城里犯了禁，出城那道关卡就是我的人在看着。”</p></div></div>` },
    { title: '💬 守卫队队长 · 许可证', body: `<div class="camp-character"><i>🛡️</i><div><b>“妓女这行，得挂我的号。”</b><p>他压低声音：“老板娘那娘们办的证，我们认。但你要是来我这儿办，以后出城，我手底下的人多少会看你顺眼些。”</p></div></div>` },
    { title: '💬 守卫队队长 · 怪物', body: `<div class="camp-character"><i>🛡️</i><div><b>“这林子里的怪物，可比人还难缠。”</b><p>他朝窗外吐了口烟：“别以为有了证就能横着走，规矩就是规矩。”</p></div></div>` },
    { title: '💬 守卫队队长 · 值夜', body: `<div class="camp-character"><i>🛡️</i><div><b>“值夜最烦的就是那些醉鬼。”</b><p>他灌了口酒：“喝完酒闹事的一律先铐起来，醒了再算账。”</p></div></div>` },
    { title: '💬 守卫队队长 · 新兵', body: `<div class="camp-character"><i>🛡️</i><div><b>“手底下新来了几个愣头青。”</b><p>他哼了一声：“见了怪物腿就打颤，还得老子亲自带。”</p></div></div>` },
    { title: '💬 守卫队队长 · 风声', body: `<div class="camp-character"><i>🛡️</i><div><b>“最近营地里风声紧。”</b><p>他压低嗓子：“你最好规矩点，别让我的人抓到你。”</p></div></div>` },
  ]
  function captainChat () {
    const state = State.get()
    state._captainChatCount = (state._captainChatCount || 0) + 1
    const n = state._captainChatCount
    let title, body
    if (n === 1) {
      title = '💬 守卫队队长 · 初识'
      body = `<div class="camp-character"><i>🛡️</i><div><b>“你就是那个总在营地里晃悠的旅人？”</b><p>他上下打量你几眼：“别给我惹麻烦，记住了。”</p></div></div>`
    } else {
      let pool = CAPTAIN_CHATS
      if (state._captainLastChat !== undefined && CAPTAIN_CHATS[state._captainLastChat]) {
        pool = CAPTAIN_CHATS.filter((_, i) => i !== state._captainLastChat)
      }
      const idx = Math.floor(Math.random() * pool.length)
      const pick = pool[idx]
      state._captainLastChat = CAPTAIN_CHATS.indexOf(pick)
      title = pick.title
      body = pick.body
    }
    EventBus.emit('state:changed', state)
    campShow({
      title, className: 'camp-tavern-modal', body,
      actions: [
        { label: '再聊两句', handler: () => { captainChat() } },
        { label: '返回队长', handler: () => { tavernCaptain() } },
      ],
    })
  }

  /** 队长处购买妓女许可证 */
  function captainBuyLicense () {
    const state = State.get()
    if (state._prostituteLicensed) { EventBus.emit('ui:log', { text: '🛡️ 你已经办过证了。', type: 'dim' }); tavernCaptain(); return }
    campShow({
      title: '📜 守卫队队长 · 办证', className: 'tavern-work-modal',
      body: `<section class="work-license"><span>📜</span><div><small>守卫队 · 营业许可</small><h3>一次付费，永久有效</h3><p>队长收取 <b>200G</b> 办证。你现在持有 <b>${state.gold}G</b>。</p></div></section>
        <p class="work-footnote">“证给你，规矩照旧。出城的时候，我的人会查你。”</p>`,
      actions: [
        { label: state.gold >= 200 ? `💸 花 200G 买许可证` : '💰 钱不够（200G）', cls: state.gold >= 200 ? 'btn-primary' : 'btn-danger', handler: () => {
          if (state.gold < 200) { EventBus.emit('ui:log', { text: '💰 钱不够买许可证。', type: 'dim' }); captainBuyLicense(); return }
          state.gold -= 200
          state._prostituteLicensed = true
          state._prostituteBoughtFromCaptain = true
          EventBus.emit('ui:log', { text: '🛡️ 队长把妓女许可证拍在桌上，你收好了。', type: 'good' })
          EventBus.emit('state:changed', state)
          Dialog.close(); tavernCaptain()
        } },
        { label: '返回队长', handler: () => { Dialog.close(); tavernCaptain() } },
      ],
    })
  }

  /** 队长处取消妓女许可证：按妓女等级分不同结局 */
  function captainCancelLicense () {
    const state = State.get()
    if (!state._prostituteLicensed) { EventBus.emit('ui:log', { text: '🛡️ 你还没办证呢。', type: 'dim' }); tavernCaptain(); return }
    const lv = state._prostituteLevel

    if (lv >= 100) {
      // 头牌妓畜：操一顿 + 扔荣耀洞罚金 200 + 30 入场费（欠债）
      campShow({
        title: '🛡️ 守卫队队长 · 撤销许可', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“头牌妓畜？呵，你这种货色想退行，问过我的老二没有。”</b><p>队长冷笑一声，把你按倒在桌上：“想退？先把这顿操给我挨完！”</p></div></div>`,
        actions: [
          { label: '🚫 被队长操一顿', cls: 'btn-danger', handler: () => { Dialog.close(); captainPunishFuck(lv) } },
          { label: '溜走（不取消）', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
    } else if (lv >= 70) {
      // 职业妓女：拒绝申请 + 操一顿
      campShow({
        title: '🛡️ 守卫队队长 · 撤销许可', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“职业妓女？你这种等级，还想金盆洗手？”</b><p>队长嗤笑一声：“证不能退，屁股得先给我用一用。”</p></div></div>`,
        actions: [
          { label: '🚫 被队长操一顿', cls: 'btn-danger', handler: () => { Dialog.close(); captainPunishFuck(lv) } },
          { label: '算了，不取消了', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
    } else if (lv >= 30) {
      // 顺从的妓女：1000G 可退
      campShow({
        title: '🛡️ 守卫队队长 · 撤销许可', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“顺从的妓女，想把证退了？”</b><p>队长翘着二郎腿：“行，拿 <b>1000G</b> 来，我把你的名字从册子上划掉。”</p></div></div>`,
        actions: [
          { label: state.gold >= 1000 ? '💸 花 1000G 退证' : '💰 钱不够（1000G）', cls: state.gold >= 1000 ? 'btn-primary' : 'btn-danger', handler: () => {
            if (state.gold < 1000) { EventBus.emit('ui:log', { text: '💰 钱不够退证。', type: 'dim' }); captainCancelLicense(); return }
            state.gold -= 1000
            doRevokeLicense()
            EventBus.emit('ui:log', { text: '📜 你花 1000G 退掉了妓女许可证，名字从册子上划掉了。', type: 'good' })
            EventBus.emit('state:changed', state)
            Dialog.close(); tavernCaptain()
          } },
          { label: '返回队长', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
    } else if (lv >= 10) {
      // 新手妓女：500G 可退
      campShow({
        title: '🛡️ 守卫队队长 · 撤销许可', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“新手妓女，想退行？”</b><p>队长挑眉：“入行容易退行难，拿 <b>500G</b> 来，我把你的号销了。”</p></div></div>`,
        actions: [
          { label: state.gold >= 500 ? '💸 花 500G 退证' : '💰 钱不够（500G）', cls: state.gold >= 500 ? 'btn-primary' : 'btn-danger', handler: () => {
            if (state.gold < 500) { EventBus.emit('ui:log', { text: '💰 钱不够退证。', type: 'dim' }); captainCancelLicense(); return }
            state.gold -= 500
            doRevokeLicense()
            EventBus.emit('ui:log', { text: '📜 你花 500G 退掉了妓女许可证，名字从册子上划掉了。', type: 'good' })
            EventBus.emit('state:changed', state)
            Dialog.close(); tavernCaptain()
          } },
          { label: '返回队长', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
    } else {
      // 雏妓（<10）：免费可退
      campShow({
        title: '🛡️ 守卫队队长 · 撤销许可', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“刚入行就想退？也行。”</b><p>队长摇摇头：“雏妓一个，还没干出啥名堂，我就当没发过这张证。”</p></div></div>`,
        actions: [
          { label: '📜 退掉许可证', cls: 'btn-primary', handler: () => {
            doRevokeLicense()
            EventBus.emit('ui:log', { text: '📜 队长收回你的妓女许可证，你退行了。', type: 'good' })
            EventBus.emit('state:changed', state)
            Dialog.close(); tavernCaptain()
          } },
          { label: '返回队长', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
    }
  }

  /** 职业妓女及以上：被队长操一顿（计时任务） */
  async function captainPunishFuck (lv) {
    const state = State.get()
    const isPerfect = lv >= 100
    EventBus.emit('ui:log', { text: '🚫 队长把你按在桌上，掏出了他那根又粗又长的家伙。', type: 'danger' })
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const steps = isPerfect
        ? [
            { desc: '你跪在桌前，被队长按着脑袋深喉口交 30 秒，口水顺着嘴角流下', bpm: 0, seconds: 30 },
            { desc: '他把你翻过去，从背后狠狠操进你的菊穴（90 BPM），你咬着桌沿承受', bpm: 90, seconds: 60 },
            { desc: '队长把滚烫的浓精射在你后背上，拍拍你的屁股', bpm: 0, seconds: 0 },
          ]
        : [
            { desc: '你被队长按在桌上，他掐着你的下巴把粗鸡巴操进你的嘴里 30 秒', bpm: 0, seconds: 30 },
            { desc: '他掀起你的裙子，从背后猛操你的菊穴（90 BPM），你被顶得说不出话', bpm: 90, seconds: 60 },
          ]
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const f = await BattleUI.showTaskDialog({
          enemyName: `🛡️ 守卫队队长（第 ${i + 1}/${steps.length} 段）`,
          attackName: step.desc,
          desc: step.desc,
          bpm: step.bpm || 0,
          seconds: step.seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName: '队长的粗鸡巴',
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm(`被队长操一顿：完成表示挨完了。`)
    }
    if (failed) {
      EventBus.emit('ui:log', { text: '🏃 你中途溜了，队长骂骂咧咧地放你走了。', type: 'dim' })
      EventBus.emit('state:changed', state); tavernCaptain(); return
    }
    EventBus.emit('ui:log', { text: '🚫 你被队长操得腿软，趴在地上喘气。', type: 'danger' })
    if (isPerfect) {
      // 头牌妓畜：罚金 200 + 30 入场费，丢荣耀洞（队长标记，出城时队长羞辱）
      state._gloryDebt = (state._gloryDebt || 0) + 200 + GLORY_FEE
      state._gloryByCaptain = true
      EventBus.emit('ui:log', { text: `💸 队长把你扔进荣耀洞：罚金 200G + ${GLORY_FEE}G 入场费，合计欠债 ${state._gloryDebt}G！`, type: 'danger' })
      EventBus.emit('state:changed', state)
      showGloryWork()
    } else {
      // 职业妓女：被操完后羞辱辱骂，明确不给注销
      EventBus.emit('ui:log', { text: '🛡️ 队长提上裤子："证不能退，下次再敢提，还操你。"', type: 'dim' })
      campShow({
        title: '🛡️ 守卫队队长 · 羞辱', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“还想退行？哼，你这种货色，除了被操还能干什么。”</b><p>队长居高临下地看着你：“你当职业妓女当出了名，你以为这证是你想退就能退的？”<br><br>他凑近你的脸，声音里全是轻蔑：“册子上你的名字，老子给你写得死死的。想注销？做梦。下次再来提，我还操你一顿，操到你服为止。”</p></div></div>
          <p class="work-footnote">你的名字被队长牢牢按在册子上，妓女证注销无望。</p>`,
        actions: [
          { label: '被羞辱得无地自容', cls: 'btn-danger', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
      EventBus.emit('state:changed', state)
    }
  }

  /** 头牌妓畜从荣耀洞出来：队长羞辱——下跪磕头、选羞辱话、口交一次，仍不退证 */
  function captainGloryHumiliation () {
    const state = State.get()
    const humiliate = () => {
      campShow({
        title: '🛡️ 守卫队队长 · 羞辱', className: 'glory-modal',
        body: `<div class="glory-section"><h3><span>“哟，头牌妓畜从洞里爬出来了？”</span><small>队长翘着二郎腿，居高临下地看着你</small></h3>
          <p class="camp-muted">“想退证？行啊——先跪下给老子磕三个头，再说两句能让我高兴的话。不然，你今天就别想出这个门。”</p></div>`,
        actions: [
          { label: '🧎 跪下磕头', cls: 'btn-danger', handler: () => {
            Dialog.close()
            EventBus.emit('ui:log', { text: '🧎 你双膝一软跪在队长面前，磕了三个响头。', type: 'danger' })
            pickInsult()
          } },
        ],
      })
    }
    const pickInsult = () => {
      const insults = [
        '「队长大人，我是您养的母畜，一辈子都是您的肉便器。」',
        '「我就是条贱母狗，活该被您操，还请队长大人饶了我。」',
        '「我是您最听话的畜牲，随时供您泄欲，求您高抬贵手。」',
      ]
      campShow({
        title: '🛡️ 守卫队队长 · 羞辱', className: 'glory-modal',
        body: `<div class="glory-section"><h3><span>“磕完了？说吧，怎么求我。”</span><small>队长把靴子踩在你面前，等你开口</small></h3>
          <p class="camp-muted">选一句羞辱自己的话，说给他听。</p></div>`,
        actions: insults.map(txt => ({
          label: txt, cls: 'btn-danger',
          handler: () => {
            Dialog.close()
            EventBus.emit('ui:log', { text: `🗣️ 你跪着说：${txt}`, type: 'danger' })
            suckTask()
          },
        })),
      })
    }
    const suckTask = async () => {
      let failed = false
      if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
        const f = await BattleUI.showTaskDialog({
          enemyName: '🛡️ 守卫队队长',
          attackName: '跪着口交',
          desc: '你跪在队长胯下，卖力地为他口交 30 秒，把鸡巴整根吞到底深喉',
          bpm: 0,
          seconds: 30,
          dmg: 0,
          noDamage: true,
          dildoName: '队长那根粗壮的鸡巴',
        })
        failed = f
      } else {
        failed = !confirm('给队长口交 30 秒（完成代表含到底）。')
      }
      EventBus.emit('ui:log', { text: failed ? '🛡️ 你口交到一半，队长嫌你不够卖力，但还是放过了你。' : '🛡️ 你跪着伺候完队长，他满意地收回了脚。', type: 'dim' })
      finalRefuse()
    }
    const finalRefuse = () => {
      campShow({
        title: '🛡️ 守卫队队长 · 结果', className: 'glory-modal',
        body: `<div class="glory-section"><h3><span>“行了，磕也磕了，骚话也说了。”</span><small>队长提起裤子，慢条斯理地系腰带</small></h3>
          <p class="camp-muted">“但是——证还是不能退。”<br><br>他拍拍你的脸：“你这头牌妓畜的名号，可是老子一手捧起来的。退证？你死了这条心吧。老老实实当你的头牌，爷高兴了少操你两顿。”</p></div>`,
        actions: [
          { label: '接受现实，回营地', cls: 'btn-danger', handler: () => { Dialog.close(); open() } },
        ],
      })
    }
    humiliate()
  }

  /** 真正撤销许可证 */
  function doRevokeLicense () {
    const state = State.get()
    state._prostituteLicensed = false
    state._prostituteDressed = false
    state._prostituteBoughtFromCaptain = false
  }

  /** 酒馆老板娘：卖酒 + 聊天（含打工话题）+ 打工 */
  function tavernBarkeep () {
    const state = State.get()
    const workUnlocked = state._tavernWorkUnlocked
    const workBtn = workUnlocked
      ? `<button class="camp-opt" data-tavern="work"><i>💼</i><span><b>打工</b><small>老板娘给指了条赚钱的路</small></span><em>${state._prostituteLicensed ? '营业中' : '看看'}</em></button>`
      : ''
    campShow({
      title: '💃 酒馆老板娘',
      className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>💃</i><div><b>“想喝点什么，还是想聊聊天？”</b><p>她托着腮，指尖轻叩吧台，眉眼带笑。</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-tavern="drink"><i>🍷</i><span><b>买酒</b><small>喝完有劲也有代价</small></span><em>开喝</em></button>
          <button class="camp-opt" data-tavern="chat"><i>💬</i><span><b>聊天</b><small>听老板娘说些有的没的</small></span><em>${workUnlocked ? '熟络' : '搭话'}</em></button>
          ${workBtn}
        </div>`,
      actions: [{ label: '返回酒馆', handler: () => { Dialog.close(); renderTavern() } }],
    })
    document.querySelectorAll('[data-tavern]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.tavern
        Dialog.close()
        if (opt === 'drink') tavernDrink()
        else if (opt === 'chat') barkeepChat()
        else if (opt === 'work') tavernWork()
      }
    })
  }

  /** 扶她战士芙蕾雅：坐在酒馆角落，可闲聊，花 1000G 招募后从酒馆消失 */
  const FUTA_WARRIOR = { id: 'futa_warrior', name: '芙蕾雅', icon: '⚔️', dmg: 2, price: 1000, desc: '沉默寡言的扶她女战士，据说身上有点特别——酒馆的人都避着她坐。' }
  function tavernFuta () {
    const state = State.get()
    const hired = !!state._mercenary
    campShow({
      title: '⚔️ 芙蕾雅', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>⚔️</i><div><b>“……有事？”</b><p>一个英气十足的扶她战士占着角落的座位，面前的酒没动过。她扫你一眼，又低头擦拭剑刃。</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-futa="chat"><i>💬</i><span><b>闲聊</b><small>听听她的来历</small></span><em>搭话</em></button>
          ${hired ? '' : `<button class="camp-opt" data-futa="hire"><i>🤝</i><span><b>招募她（1000G）</b><small>战斗中你攻击命中后，她补上 2 点伤害</small></span><em>${state.gold >= 1000 ? '可雇' : '钱不够'}</em></button>`}
        </div>`,
      actions: [{ label: '返回酒馆', handler: () => { Dialog.close(); renderTavern() } }],
    })
    document.querySelectorAll('[data-futa]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.futa
        Dialog.close()
        if (opt === 'chat') futaChat()
        else if (opt === 'hire') hireFuta()
      }
    })
  }

  /** 扶她战士闲聊：随机循环 */
  const FUTA_CHATS = [
    { title: '💬 芙蕾雅 · 来历', body: `<div class="camp-character"><i>⚔️</i><div><b>“我打过很多仗。”</b><p>她语气平淡：“命硬，死不了。你呢，看起来也像个能打的。”</p></div></div>` },
    { title: '💬 芙蕾雅 · 战利品', body: `<div class="camp-character"><i>⚔️</i><div><b>“森林里那些怪物，砍起来顺手。”</b><p>她掂了掂剑：“你要是敢去，我可以跟着。不过……价钱不低。”</p></div></div>` },
    { title: '💬 芙蕾雅 · 酒馆', body: `<div class="camp-character"><i>⚔️</i><div><b>“老板娘的酒不错，但我不能喝。”</b><p>她顿了顿：“喝多了，容易出事。”</p></div></div>` },
    { title: '💬 芙蕾雅 · 身体', body: `<div class="camp-character"><i>⚔️</i><div><b>“想问什么直说。”</b><p>她挑起眉：“我确实和普通女人不太一样。介意的话，现在就可以走。”</p></div></div>` },
    { title: '💬 芙蕾雅 · 雇主', body: `<div class="camp-character"><i>⚔️</i><div><b>“我跟过的雇主，没几个活到最后。”</b><p>她低低笑了一声：“但都不是我杀的——是他们自己蠢死的。”</p></div></div>` },
  ]
  function futaChat () {
    const state = State.get()
    let pool = FUTA_CHATS
    if (state._futaLastChat !== undefined && FUTA_CHATS[state._futaLastChat]) {
      pool = FUTA_CHATS.filter((_, i) => i !== state._futaLastChat)
    }
    const idx = Math.floor(Math.random() * pool.length)
    const pick = pool[idx]
    state._futaLastChat = FUTA_CHATS.indexOf(pick)
    EventBus.emit('state:changed', state)
    campShow({
      title: pick.title, className: 'camp-tavern-modal', body: pick.body,
      actions: [
        { label: '再聊聊', handler: () => { Dialog.close(); futaChat() } },
        { label: '返回她身边', handler: () => { Dialog.close(); tavernFuta() } },
      ],
    })
  }

  /** 招募扶她战士：1000G，永久常驻 */
  function hireFuta () {
    const state = State.get()
    if (state._mercenary) { tavernFuta(); return }
    if (state.gold < FUTA_WARRIOR.price) { EventBus.emit('ui:log', { text: '💰 钱不够招募芙蕾雅。', type: 'dim' }); tavernFuta(); return }
    campShow({
      title: '⚔️ 招募芙蕾雅', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>⚔️</i><div><b>“一千金币，买我这条命。”</b><p>她站起身，比你高出半个头：“你攻击的时候我会跟上补刀。你要是打空了，我也收招。”她顿了顿，“我不会死——但你要是死了，我会护到你咽气。”</p></div></div>`,
      actions: [
        { label: state.gold >= 1000 ? '💸 花 1000G 招募' : '💰 钱不够（1000G）', cls: state.gold >= 1000 ? 'btn-primary' : 'btn-danger', handler: () => {
          if (state.gold < 1000) { EventBus.emit('ui:log', { text: '💰 钱不够招募。', type: 'dim' }); hireFuta(); return }
          state.gold -= 1000
          state._mercenary = { id: 'futa_warrior', name: '芙蕾雅', icon: '⚔️', dmg: 2, lust: 0 }
          EventBus.emit('ui:log', { text: '⚔️ 芙蕾雅加入了你的队伍！你攻击命中后她会补上 2 点伤害。', type: 'good' })
          EventBus.emit('state:changed', state)
          Dialog.close(); renderTavern()
        } },
        { label: '返回', handler: () => { Dialog.close(); tavernFuta() } },
      ],
    })
  }

  /** 服务佣兵：选择服务方式降低性欲（口交 -40 / 肛交 -50 / 性交 -60 女性专用） */
  function serveMercenary () {
    const state = State.get()
    const merc = state._mercenary
    if (!merc || merc.dead) { EventBus.emit('ui:log', { text: '没有可服务的佣兵。', type: 'dim' }); return }
    if ((merc.lust || 0) < 25) {
      EventBus.emit('ui:log', { text: `${merc.icon} ${merc.name} 现在很冷静，暂时不需要服务。`, type: 'dim' })
      return
    }
    const isFemale = state.gender !== 'male'
    const sexBtn = isFemale
      ? `<button class="camp-opt" data-serve="sex"><i>🌸</i><span><b>性交服务</b><small>主动骑上去，用小穴好好伺候她</small></span><em>欲 -30</em></button>`
      : ''
    campShow({
      title: `💋 服务佣兵 · ${merc.icon} ${merc.name}`,
      className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>${merc.icon}</i><div><b>“嗯……人家有点忍不住了。”</b><p>她脸颊泛红，腿间已经湿了。性欲 <b>${Math.min(100, merc.lust || 0)}%</b>。选一种方式喂饱她吧。</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-serve="oral"><i>👄</i><span><b>口交服务</b><small>跪下来含住她的鸡巴卖力吞吐</small></span><em>欲 -20</em></button>
          <button class="camp-opt" data-serve="anal"><i>🍑</i><span><b>肛交服务</b><small>撅起屁股让她从背后操进来</small></span><em>欲 -30</em></button>
          ${sexBtn}
        </div>`,
      actions: [{ label: '返回', handler: () => { Dialog.close() } }],
    })
    document.querySelectorAll('[data-serve]').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.serve
        Dialog.close()
        runMercenaryService(type)
      }
    })
  }

  /** 执行佣兵服务任务 */
  async function runMercenaryService (type) {
    const state = State.get()
    const merc = state._mercenary
    if (!merc || merc.dead) return
    const cfg = {
      oral: { name: '口交服务', dmg: 20, steps: [
        { desc: '你跪在她腿间，含住她硬邦邦的鸡巴卖力吞吐，深喉吞到底', bpm: 0, seconds: 30 },
        { desc: '你一边深喉一边用手揉着她的蛋蛋，把她伺候得腿软', bpm: 0, seconds: 30 },
      ] },
      anal: { name: '肛交服务', dmg: 30, steps: [
        { desc: '你趴跪在床沿，撅起屁股，让她从背后狠狠操进你的菊穴', bpm: 90, seconds: 30 },
        { desc: '她掐着你的腰猛操，你咬着枕头承受，她越来越兴奋', bpm: 90, seconds: 30 },
      ] },
      sex: { name: '性交服务', dmg: 30, steps: [
        { desc: '你躺下来张开腿，让她挺着粗壮的鸡巴狠狠操进你的小穴', bpm: 90, seconds: 30 },
        { desc: '你主动用双腿缠住她的腰，迎合着她的抽插，浪叫连连', bpm: 90, seconds: 30 },
      ] },
    }[type]
    if (!cfg) return
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      for (let i = 0; i < cfg.steps.length; i++) {
        const step = cfg.steps[i]
        const f = await BattleUI.showTaskDialog({
          enemyName: `${merc.icon} ${merc.name}（第 ${i + 1}/${cfg.steps.length} 段）`,
          attackName: cfg.name,
          desc: step.desc,
          bpm: step.bpm || 0,
          seconds: step.seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName: '她那根粗壮的鸡巴',
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm(`给${merc.name}做${cfg.name}（完成代表伺候完了）。`)
    }
    if (failed) {
      EventBus.emit('ui:log', { text: `🏃 你半途停下来，${merc.icon} ${merc.name} 不满地瞪了你一眼（性欲没降）。`, type: 'danger' })
      EventBus.emit('state:changed', state)
      return
    }
    merc.lust = Math.max(0, (merc.lust || 0) - cfg.dmg)
    EventBus.emit('ui:log', { text: `💋 你给${merc.icon} ${merc.name}做了${cfg.name}，她满足地哼了一声，性欲降到 ${merc.lust}%。`, type: 'good' })
    EventBus.emit('state:changed', state)
  }

  /** 老板娘聊天：随机循环闲话；聊到打工话题后解锁打工 */
  const BARKEEP_CHATS = [
    { title: '💬 老板娘 · 营地的规矩', body: `<div class="camp-character"><i>💃</i><div><b>“厕所那间隔间，你进去过了吧？”</b><p>她压低声音，眼神暧昧：“那里能赚快钱。姐这儿，也有别的路子。”</p></div></div>` },
    { title: '💬 老板娘 · 缺人', body: `<div class="camp-character"><i>💃</i><div><b>“我这儿正好缺人手。”</b><p>她朝角落努努嘴：“当服务员跑跑腿，或者……穿上点凉快的衣裳，陪客人乐乐，来钱快。”</p></div></div>` },
    { title: '💬 老板娘 · 闲话家常', body: `<div class="camp-character"><i>💃</i><div><b>“老顾客那骰子可邪门，别把命搭进去。”</b><p>她给自己倒了杯酒：“要是手头紧，姐这儿随时欢迎你来干活。”</p></div></div>` },
    { title: '💬 老板娘 · 林子的传闻', body: `<div class="camp-character"><i>💃</i><div><b>“听说林子里最近多了些不长眼的怪物。”</b><p>她擦着酒杯：“你要是胆子够大，出门右转进林子里，能捡到不少好东西。”</p></div></div>` },
    { title: '💬 老板娘 · 酒馆的风云', body: `<div class="camp-character"><i>💃</i><div><b>“隔壁桌那些赌棍，输急了眼连裤子都敢押。”</b><p>她呷了口酒：“你可别学他们，姐这儿不赊账。”</p></div></div>` },
    { title: '💬 老板娘 · 今晚的风', body: `<div class="camp-character"><i>💃</i><div><b>“夜里风凉，当心别在林子里过夜。”</b><p>她往炉子里添了根柴：“我这酒馆，永远给你留着一盏灯。”</p></div></div>` },
    { title: '💬 老板娘 · 铁匠铺', body: `<div class="camp-character"><i>💃</i><div><b>“新来的铁匠可有一手好手艺。”</b><p>她朝门口努努嘴：“他打的家伙什儿结实，你要是想换把趁手的兵器，去找他准没错。”</p></div></div>` },
    { title: '💬 老板娘 · 道具商', body: `<div class="camp-character"><i>💃</i><div><b>“镇上那个道具商，进货的路子野得很。”</b><p>她压低声音：“药膏、肛塞、假阳具……什么稀奇古怪的玩意儿他都有。有钱尽管去逛逛。”</p></div></div>` },
    { title: '💬 老板娘 · 旅行商人走了', body: `<div class="camp-character"><i>💃</i><div><b>“诶，你听说了没？老旅行商人走了。”</b><p>她擦着吧台叹了口气：“说是咱这镇子越来越大了，他得赶去别的穷地方做生意。往后补给、装备，就得靠镇上的铁匠和道具商了。”</p></div></div>` },
    { title: '💬 老板娘 · 镇子变大了', body: `<div class="camp-character"><i>💃</i><div><b>“这几年镇子是一天比一天热闹。”</b><p>她给自己倒了杯酒：“铁匠铺、道具铺一个个开起来，就剩我这酒馆还守着老味道。”</p></div></div>` },
  ]
  function barkeepChat () {
    const state = State.get()
    state._barkeepChatCount = (state._barkeepChatCount || 0) + 1
    const n = state._barkeepChatCount
    let title, body, unlock = false

    // 已从队长那办证：老板娘的反应不一样
    if (state._prostituteLicensed && state._prostituteBoughtFromCaptain) {
      title = '💬 老板娘 · 哟，有证了'
      body = `<div class="camp-character"><i>💃</i><div><b>“哟，这是从队长那儿办的证？”</b><p>她挑眉扫了你一眼：“行啊，攀上军官的高枝了。那家伙办的证……啧，反正你也入行了，姐这儿的活，随时欢迎你。”</p></div></div>`
      if (!state._tavernWorkUnlocked) {
        unlock = true
        state._tavernWorkUnlocked = true
        body += `<p class="work-footnote">（老板娘认了你的证，打工入口已解锁）</p>`
      }
      EventBus.emit('state:changed', state)
      campShow({
        title, className: 'camp-tavern-modal', body,
        actions: [
          { label: unlock ? '💼 看看打工的事' : '再聊两句', cls: unlock ? 'btn-primary' : 'btn', handler: () => { Dialog.close(); unlock ? tavernWork() : barkeepChat() } },
          { label: '返回老板娘', handler: () => { Dialog.close(); tavernBarkeep() } },
        ],
      })
      return
    }

    // 第一次：打招呼
    if (n === 1) {
      title = '💬 老板娘 · 初来乍到'
      body = `<div class="camp-character"><i>💃</i><div><b>“新来的？第一次来姐这酒馆吧。”</b><p>她擦着杯子打量你：“营地里什么人都有，别惹麻烦，有事儿来找我。”</p></div></div>`
    } else {
      // 第 3 次聊天解锁打工
      if (n >= 3 && !state._tavernWorkUnlocked) {
        unlock = true
        state._tavernWorkUnlocked = true
      }
      // 随机循环对话（避免与上次重复）
      let pool = BARKEEP_CHATS
      if (state._barkeepLastChat !== undefined && BARKEEP_CHATS[state._barkeepLastChat]) {
        pool = BARKEEP_CHATS.filter((_, i) => i !== state._barkeepLastChat)
      }
      const idx = Math.floor(Math.random() * pool.length)
      const pick = pool[idx]
      state._barkeepLastChat = BARKEEP_CHATS.indexOf(pick)
      title = pick.title
      body = pick.body
      if (unlock) body += `<p class="work-footnote">（打工入口已解锁）</p>`
    }
    EventBus.emit('state:changed', state)
    campShow({
      title, className: 'camp-tavern-modal',
      body,
      actions: [
        { label: unlock ? '💼 看看打工的事' : '再聊两句', cls: unlock ? 'btn-primary' : 'btn', handler: () => { Dialog.close(); unlock ? tavernWork() : barkeepChat() } },
        { label: '返回老板娘', handler: () => { Dialog.close(); tavernBarkeep() } },
      ],
    })
  }

  /** 打工界面：服务员（暂不开放）/ 妓女 */
  function tavernWork () {
    const state = State.get()
    const workStatus = state._prostituteLicensed
      ? `${prostituteTitle(state._prostituteLevel).icon} ${state._prostituteLevel} 级`
      : '需许可证'
    campShow({
      title: '💼 老板娘的工作板', className: 'tavern-work-modal',
      body: `<section class="work-hero"><span aria-hidden="true">💃</span><div><small>THE MIST LANTERN · 招工中</small><h3>“想赚金币？挑个能做的活。”</h3><p>当前持有 <b>${state.gold}G</b></p></div></section>
      <div class="work-grid">
        <button class="work-card is-locked" type="button" disabled><i>🍽️</i><span><b>酒馆服务员</b><small>端茶倒水，收拾客桌</small></span><em>尚未开放</em></button>
        <button class="work-card is-active" type="button" data-work="prostitute"><i>💋</i><span><b>酒馆接客</b><small>按客人的要求完成计时任务</small></span><em>${workStatus}</em></button>
      </div>
      <p class="work-footnote">任务中途刷新会保留当前进度；未完成会欠老板娘 30G。</p>`,
      actions: [{ label: '返回老板娘', handler: () => { Dialog.close(); tavernBarkeep() } }],
    })
    const prostituteBtn = document.querySelector('[data-work="prostitute"]')
    if (prostituteBtn) prostituteBtn.onclick = () => { Dialog.close(); prostitute() }
  }

  /** 妓女：许可证 → 换衣 → 找顾客 */
  /** 妓女等级称号 */
  function prostituteTitle (level) {
    if (level >= 100) return { name: '头牌妓畜', icon: '👑', note: '必须全程佩戴贞操笼，服务时必须发出呻吟' }
    if (level >= 70) return { name: '职业妓女', icon: '💼', note: '服务时必须发出呻吟' }
    if (level >= 30) return { name: '顺从的妓女', icon: '🫦', note: '服务时必须发出呻吟' }
    if (level >= 10) return { name: '新手妓女', icon: '🐣', note: '' }
    return { name: '雏妓', icon: '🍼', note: '' }
  }

  function prostituteProgress (level) {
    const stages = [
      { level: 1, name: '雏妓' }, { level: 10, name: '新手妓女' },
      { level: 30, name: '顺从的妓女' }, { level: 70, name: '职业妓女' },
      { level: 100, name: '头牌妓畜' },
    ]
    const next = stages.find(stage => stage.level > level)
    if (!next) return { percent: 100, text: '已达到最高称号' }
    const current = [...stages].reverse().find(stage => stage.level <= level) || stages[0]
    const percent = Math.max(0, Math.min(100, ((level - current.level) / (next.level - current.level)) * 100))
    return { percent, text: `距「${next.name}」还差 ${next.level - level} 级` }
  }

  function prostitute () {
    const state = State.get()
    if (!state._prostituteLicensed) {
      campShow({
        title: '💋 接客许可证', className: 'tavern-work-modal',
        body: `<section class="work-license"><span>📜</span><div><small>雾灯酒馆 · 营业许可</small><h3>一次付费，永久有效</h3><p>老板娘收取 <b>200G</b> 办证。你现在持有 <b>${state.gold}G</b>。</p></div></section>
          <p class="work-footnote">“干这行得先办证。规矩写清楚，赚到的钱归你，失败欠款得还。”</p>`,
        actions: [
          { label: state.gold >= 200 ? `💸 花 200G 买许可证` : '💰 钱不够（200G）', cls: state.gold >= 200 ? 'btn-primary' : 'btn-danger', handler: () => {
            if (state.gold < 200) { EventBus.emit('ui:log', { text: '💰 钱不够买许可证。', type: 'dim' }); prostitute(); return }
            state.gold -= 200
            state._prostituteLicensed = true
            EventBus.emit('ui:log', { text: '💋 你买下了妓女许可证，老板娘朝你眨眨眼。', type: 'good' })
            EventBus.emit('state:changed', state)
            Dialog.close(); prostitute()
          } },
          { label: '返回打工', handler: () => { Dialog.close(); tavernWork() } },
        ],
      })
      return
    }
    if (!state._prostituteDressed) {
      // 全裸状态：不用脱衣服，老板娘直接让你上工
      if (StatusSystem.has('naked')) {
        campShow({
          title: '👗 酒馆更衣室', className: 'tavern-work-modal',
          body: `<section class="work-wardrobe"><span>👙</span><div><small>上工准备</small><h3>你都全裸了，还换什么衣服？</h3><p>老板娘打量着你："反正你也没衣服，直接去接客吧。"</p></div></section>`,
          actions: [
            { label: '🍑 直接去接客', cls: 'btn-primary', handler: () => {
              state._prostituteDressed = true
              EventBus.emit('ui:log', { text: '👙 你全裸着走向酒馆，老板娘点点头。', type: 'good' })
              EventBus.emit('state:changed', state)
              Dialog.close(); prostitute()
            } },
            { label: '返回打工', handler: () => { Dialog.close(); tavernWork() } },
          ],
        })
        return
      }
      campShow({
        title: '👗 酒馆更衣室', className: 'tavern-work-modal',
        body: `<section class="work-wardrobe"><span>🪞</span><div><small>上工准备</small><h3>换上老板娘准备的工作服</h3><p>完成更衣后即可在酒馆寻找顾客；没有欠款时可以随时换回冒险装备。</p></div></section>`,
        actions: [
          { label: '👗 脱衣换上妓女服', cls: 'btn-primary', handler: () => {
            state._prostituteDressed = true
            EventBus.emit('ui:log', { text: '💃 你换上妓女服，露出大片肌肤。', type: 'good' })
            EventBus.emit('state:changed', state)
            Dialog.close(); prostitute()
          } },
          { label: '返回打工', handler: () => { Dialog.close(); tavernWork() } },
        ],
      })
      return
    }
    // 已换衣：寻找顾客
    const title = prostituteTitle(state._prostituteLevel)
    const progress = prostituteProgress(state._prostituteLevel)
    const debt = state._prostituteDebt || 0
    const inDebt = debt > 0
    const debtHtml = inDebt
      ? `<div class="work-debt">💸 欠款 <b>${debt}G</b><small>收入会优先还债；还清前不能离开或换衣</small></div>`
      : ''
    // 已装备的妓女用品
    const ownedGear = (state._prostituteGear || {})
    const ownedList = MERCHANT_GOODS.filter(g => ownedGear[g.id])
    const gearHtml = ownedList.length
      ? `<div class="work-gear"><small>💄 已装备用品</small><div class="work-gear-list">${ownedList.map(g => `<span title="${g.desc}">${g.icon} ${g.name}</span>`).join('')}</div></div>`
      : `<div class="work-gear"><small>💄 已装备用品</small><div class="work-gear-list work-gear-empty">尚未装备任何用品</div></div>`
    campShow({
      title: '💋 今夜营业', className: 'tavern-work-modal',
      body: `${debtHtml}<section class="work-profile"><div class="work-rank"><i>${title.icon}</i><span><small>当前称号</small><b>${title.name}</b></span><em>Lv.${state._prostituteLevel}</em></div>
        <div class="work-progress" aria-label="称号进度"><span style="width:${progress.percent}%"></span></div><p>${progress.text}</p>
        ${title.note ? `<div class="work-rule">📌 ${title.note}</div>` : ''}</section>
        ${gearHtml}
        <p class="work-footnote">掷 Z 决定客人的要求。完成计时任务可获得金币和等级，跳过视为失败。</p>`,
      actions: [
        { label: inDebt ? '🔍 继续接客还债' : '🔍 寻找顾客', cls: 'btn-primary', handler: () => { Dialog.close(); findCustomer() } },
        { label: '💄 妓女用品供应商', handler: () => { Dialog.close(); merchant() } },
        // 全裸时无法换回衣服（本来就没衣服）；欠款时无法退出
        ...((!inDebt && !StatusSystem.has('naked')) ? [{ label: '👗 换回衣服', handler: () => { Dialog.close(); state._prostituteDressed = false; EventBus.emit('state:changed', state); tavernWork() } }] : []),
      ],
    })
  }

  /** 顾客任务表：每种顾客 6 个 Z 结果 */
  const CUSTOMER_TASKS = {
    goblin: {
      name: '哥布林',
      intro: '你在酒馆里遇到一群坐在吧台喝酒言欢的哥布林。其中一个决定当着所有客人的面，在桌上操你。小心——这可能会让他的朋友们也加入……',
      tasks: {
        1: {
          desc: '为哥布林口交 30 秒（深喉 2 次），然后站立后入式被操 30 秒。',
          gold: 20, level: 1,
          steps: [
            { desc: '你跪在桌上，把哥布林硬邦邦的小鸡巴含进嘴里吞吐 30 秒，深喉 2 次', bpm: 0, seconds: 30 },
            { desc: '转过身趴下，被哥布林从背后站立后入式操着菊穴 30 秒', bpm: 0, seconds: 30 },
          ],
        },
        2: {
          desc: '口交深喉 + 站立后入被操。',
          gold: 20, level: 1,
          steps: [
            { desc: '把哥布林的小鸡巴含进嘴里吞吐 30 秒，故意让它顶到嗓子眼深喉 2 次', bpm: 0, seconds: 30 },
            { desc: '转过身趴下，被它从背后操着菊穴 30 秒', bpm: 0, seconds: 30 },
          ],
        },
        3: {
          desc: '深喉 2 次 + 站立后入，一呻吟第二哥布林塞嘴。',
          gold: 40, level: 1,
          steps: [
            { desc: '你用嘴含住哥布林的鸡巴深喉 2 次', bpm: 0, seconds: 30 },
            { desc: '被哥布林站立后入猛操——你忍不住呻吟，第二个哥布林立刻把粗鸡巴塞进你嘴里', bpm: 0, seconds: 30 },
          ],
        },
        4: {
          desc: '被两只哥布林前后夹击，上下两张嘴同时被操。',
          gold: 40, level: 1,
          steps: [
            { desc: '你被按在桌上，前面的哥布林操着你的嘴', bpm: 0, seconds: 30 },
            { desc: '后面的哥布林从背后顶着你的菊穴猛操，你一叫出声，嘴里那根就捅得更深', bpm: 0, seconds: 30 },
          ],
        },
        5: {
          desc: '哥布林邀请另一个哥布林一起使用你：口交 + 前后夹击。',
          gold: 70, level: 2,
          steps: [
            { desc: '你跪下来，为第一个哥布林口交 30 秒，再为第二个哥布林口交 30 秒', bpm: 0, seconds: 60 },
            { desc: '站起身，被两个哥布林同时操菊穴和嘴穴 30 秒', bpm: 0, seconds: 30 },
            { desc: '他们交换位置，继续前后夹击你 30 秒', bpm: 0, seconds: 30 },
          ],
        },
        6: {
          desc: '哥布林邀请了两个朋友一起享用你。先跪下轮流口交 2 分钟，然后被前后夹击 3 分钟，最后脸上射精，他们抢走你的金币逃跑！',
          gold: -50, level: 3,
          steps: [
            { desc: '你跪下来，轮流为三个哥布林口交，每根都卖力吞吐深喉', bpm: 0, seconds: 120 },
            { desc: '被前后夹击：一根插进菊穴，一根塞进嘴里，疯狂抽送', bpm: 0, seconds: 60 },
            { desc: '第 2 分钟：换一个哥布林操你的菊穴，另一根继续捅你的嘴', bpm: 0, seconds: 60 },
            { desc: '第 3 分钟：再次交换，让新的鸡巴操进你的菊穴和嘴里', bpm: 0, seconds: 60 },
            { desc: '最后三个哥布林轮番把浓精射在你脸上……然后抢走你的金币逃跑！', bpm: 0, seconds: 0 },
          ],
        },
      },
    },
    werewolf: {
      name: '狼人',
      intro: '一只凶猛的狼人冲进酒馆，一把抓住你，把你带进卧室。他告诉你："我只会为了插入小穴/菊穴而付费。"所以如果他让你口交，你需要免费服务。',
      tasks: {
        1: { desc: '为狼人口交 1 分钟，让他射在你嘴里。他不会为此付钱。', bpm: 0, seconds: 60, gold: 0, level: 1 },
        2: { desc: '仰躺着让狼人粗暴地操你的嘴穴 1 分钟，直到他射在你脸上。始终保持眼神接触。', bpm: 0, seconds: 60, gold: 0, level: 2 },
        3: {
          desc: '为狼人口交 1 分钟，然后侧卧位被操 1 分钟，像个荡妇一样呻吟。',
          gold: 30, level: 2,
          steps: [
            { desc: '你跪下来，为狼人卖力口交 1 分钟', bpm: 0, seconds: 60 },
            { desc: '侧身躺下，让狼人从侧面狠狠操进你的菊穴，你像个荡妇一样呻吟', bpm: 0, seconds: 60 },
          ],
        },
        4: {
          desc: '舔弄狼鸡巴 + 侧卧位被操两轮，全程像个发情的母狗。',
          gold: 30, level: 2,
          steps: [
            { desc: '你跪在狼人腿间，卖力地舔弄他那根粗大的狼鸡巴整整 1 分钟', bpm: 0, seconds: 60 },
            { desc: '侧身躺下，让狼人从侧面狠狠操进你的菊穴 1 分钟，夹紧双腿淫叫', bpm: 0, seconds: 60 },
            { desc: '换个方向再来一轮，被操得双腿发软，呻吟不断', bpm: 0, seconds: 60 },
          ],
        },
        5: {
          desc: '为狼人口交 2 分钟，然后侧卧位、骑乘位各被操 1 分钟。',
          gold: 45, level: 2,
          steps: [
            { desc: '你跪下来，为狼人卖力口交 2 分钟，把那根粗大的狼鸡巴舔得湿漉漉', bpm: 0, seconds: 120 },
            { desc: '侧身躺下，让狼人从侧面狠狠操进你的菊穴 1 分钟', bpm: 0, seconds: 60 },
            { desc: '翻身骑到狼人身上，骑乘位上下吞吐 1 分钟', bpm: 0, seconds: 60 },
          ],
        },
        6: {
          desc: '为狼人口交 2 分钟，侧卧位、骑乘位、后入式各被操 1 分钟，最后射在你嘴里。全程像个发情的荡妇。',
          gold: 60, level: 3,
          steps: [
            { desc: '你跪下来，为狼人卖力口交 2 分钟，把那根粗大的狼鸡巴舔得湿漉漉', bpm: 0, seconds: 120 },
            { desc: '侧身躺下，让狼人从侧面狠狠操进你的菊穴', bpm: 0, seconds: 60 },
            { desc: '翻身骑到狼人身上，用骑乘位上下吞吐，浪叫个不停', bpm: 0, seconds: 60 },
            { desc: '趴跪着被狼人后入式猛操（120 BPM），你夹紧屁股迎合', bpm: 120, seconds: 60 },
            { desc: '最后跪回去，让狼人把滚烫的精液射进你嘴里', bpm: 0, seconds: 0 },
          ],
        },
      },
    },
    orc: {
      name: '兽人',
      intro: '一个肌肉发达的兽人命令你加入他和朋友的性交比赛，他想向朋友展示自己有多雄壮。',
      tasks: {
        1: { desc: '跪下伸出舌头，让兽人用大鸡巴拍打你的脸和舌头 1 分钟，然后为他口交 1 分钟。用顺从的眼神仰望他。', bpm: 0, seconds: 120, gold: 30, level: 2 },
        2: { desc: '跪下让兽人操你的嘴 2 分钟。不给他至少 10 次深喉，他不付钱。', bpm: 0, seconds: 120, gold: 30, level: 3 },
        3: {
          desc: '跪下被操嘴 1 分钟，然后站立后入式被操 2 分钟，朋友拍打你的阴蒂。',
          gold: 50, level: 4,
          steps: [
            { desc: '你跪在地上张大嘴，让兽人的大鸡巴操进嘴里 1 分钟', bpm: 0, seconds: 60 },
            { desc: '起身趴墙，被兽人站立后入式猛操（逐渐加速到 120 BPM），他的朋友用大肉棒拍打你的阴蒂/蛋蛋', bpm: 120, seconds: 120 },
          ],
        },
        4: {
          desc: '先被第一个兽人操嘴 1 分钟，然后被两个兽人前后夹击 2 分钟。',
          gold: 50, level: 4,
          steps: [
            { desc: '你跪在地上张大嘴，让第一个兽人的大鸡巴操进嘴里 1 分钟', bpm: 0, seconds: 60 },
            { desc: '起身趴墙，被两个兽人一前一后包夹：后面的操进菊穴，前面的捅进嘴里', bpm: 0, seconds: 60 },
            { desc: '两根大肉棒交错进出，你被夹在中间翻着白眼淫叫', bpm: 0, seconds: 60 },
          ],
        },
        5: {
          desc: '兽人邀请朋友比谁能把你操得爽上天。跪下口交 + 地板上被前后夹击，高潮迭起。',
          gold: 100, level: 5,
          steps: [
            { desc: '你跪在两个兽人面前，轮流为他们的口交，每根都深喉 10 次以上', bpm: 0, seconds: 120 },
            { desc: '被按在地板上前后夹击：一根操进菊穴，一根捅进嘴里', bpm: 0, seconds: 60 },
            { desc: '第 2 分钟：两个兽人交换位置，换根更猛的操你，每 10 秒被深喉一次', bpm: 0, seconds: 60 },
          ],
        },
        6: {
          desc: '被两个兽人按在地板上前后夹击，两根大肉棒轮流抽送。',
          gold: 100, level: 5,
          steps: [
            { desc: '你被两个兽人按在地板上，一根塞进你的嘴深喉，一根顶进你的菊穴猛操', bpm: 0, seconds: 60 },
            { desc: '120 BPM 疯狂进出，你被夹在中间翻着白眼淫叫，两根大肉棒在嘴里和屁股里轮流抽送', bpm: 120, seconds: 60 },
          ],
        },
      },
    },
    minotaur: {
      name: '牛头人',
      intro: '当传奇牛头人听说酒馆里有一个顺从的妓女在提供服务，他立刻就赶来了。他一进酒馆，就把你抱起来带到卧室。小心，他性欲极强……',
      tasks: {
        1: {
          desc: '手交亲蛋、口交、操嘴各 1 分钟，直到射在你脸上。',
          gold: 50, level: 4,
          steps: [
            { desc: '你跪下来，小手握住牛头人的马屌套弄，低头舔弄他的蛋蛋 1 分钟', bpm: 0, seconds: 60 },
            { desc: '温柔地含住龟头为他口交 1 分钟', bpm: 0, seconds: 60 },
            { desc: '他掐着你的下巴操你的嘴 1 分钟，滚烫的浓精喷了你一脸', bpm: 0, seconds: 60 },
          ],
        },
        2: {
          desc: '手交亲蛋、口交、操嘴各 1 分钟，直到射在你脸上。',
          gold: 50, level: 4,
          steps: [
            { desc: '握住牛头人又粗又长的马屌慢慢套弄，同时用舌头舔弄他的蛋蛋', bpm: 0, seconds: 60 },
            { desc: '温柔地含住龟头为他口交 1 分钟，卖力吞吐', bpm: 0, seconds: 60 },
            { desc: '他掐着你的下巴用大肉棒操你的嘴 1 分钟，滚烫的浓精喷了你一脸', bpm: 0, seconds: 60 },
          ],
        },
        3: {
          desc: '服侍牛头人 3 分钟（手交亲蛋、口交、操嘴各 1 分钟），然后传教士体位把你灌满。',
          gold: 70, level: 5,
          steps: [
            { desc: '你跪下来，小手握住牛头人的马屌套弄，低头用舌头舔弄他的蛋蛋', bpm: 0, seconds: 60 },
            { desc: '温柔地含住龟头为他口交 1 分钟，卖力吞吐', bpm: 0, seconds: 60 },
            { desc: '他掐着你的下巴，用大肉棒操你的嘴 1 分钟', bpm: 0, seconds: 60 },
            { desc: '他还硬着不肯射。他把你压倒在床上，传教士体位深深顶进你的小穴（90 BPM），把你灌满', bpm: 90, seconds: 60 },
          ],
        },
        4: {
          desc: '先服侍牛头人 3 分钟，然后被后入式猛操，每 15 秒挨一巴掌屁股。',
          gold: 80, level: 5,
          steps: [
            { desc: '你跪下来为牛头人手交并亲吻他的蛋蛋 1 分钟', bpm: 0, seconds: 60 },
            { desc: '温柔地为他口交 1 分钟，含住马屌吞吐', bpm: 0, seconds: 60 },
            { desc: '他让你张嘴，用大肉棒操你的嘴 1 分钟', bpm: 0, seconds: 60 },
            { desc: '他让你趴跪在地，从背后操进你的菊穴猛干（120 BPM），每 15 秒"啪"地打一下你白花花的屁股', bpm: 120, seconds: 60 },
          ],
        },
        5: {
          desc: '完整服侍牛头人：先手交亲蛋、口交、操嘴，再传教士灌满、后入挨打，最后跪地接精清理。',
          gold: 100, level: 10,
          steps: [
            { desc: '你跪下来，小手握住牛头人的马屌套弄，低头用舌头舔弄他的蛋蛋 1 分钟', bpm: 0, seconds: 60 },
            { desc: '温柔地含住龟头为他口交 1 分钟，卖力吞吐', bpm: 0, seconds: 60 },
            { desc: '他掐着你的下巴，用大肉棒操你的嘴 1 分钟', bpm: 0, seconds: 60 },
            { desc: '他还硬着不肯射。你被压倒在床上，传教士体位深深顶进小穴（90 BPM），把你灌满', bpm: 90, seconds: 60 },
            { desc: '趴跪着被牛头人后入式猛操（120 BPM），每 15 秒被打一下屁股，疼得你浪叫', bpm: 120, seconds: 60 },
            { desc: '他还不肯射。你跪下来，仰着脸让牛头人把浓精全射在你脸上', bpm: 0, seconds: 0 },
            { desc: '最后含住他软下来的马屌，卖力舔弄 1 分钟为他清理', bpm: 0, seconds: 60 },
          ],
        },
        6: {
          desc: '5 分钟全程奉陪发情的牛头人：手交亲蛋、口交、操嘴、传教士、后入挨打，最后跪地接精清理。',
          gold: 100, level: 10,
          steps: [
            { desc: '握住牛头人又粗又长的马屌套弄，同时用舌头舔弄他的蛋蛋 1 分钟', bpm: 0, seconds: 60 },
            { desc: '温柔地含住龟头为他口交 1 分钟，卖力吞吐', bpm: 0, seconds: 60 },
            { desc: '他掐着你的下巴，用大肉棒操你的嘴 1 分钟', bpm: 0, seconds: 60 },
            { desc: '被牛头人压在身下，传教士体位被操灌满小穴', bpm: 0, seconds: 60 },
            { desc: '转身撅起屁股，被后入式猛操，每 15 秒挨一巴掌', bpm: 0, seconds: 60 },
            { desc: '跪在牛头人胯下，仰着脸接住滚烫的精液', bpm: 0, seconds: 0 },
            { desc: '含住他的马屌卖力口交，把每一滴都吞下去', bpm: 0, seconds: 60 },
          ],
        },
      },
    },
    koopa: {
      name: '库帕',
      intro: '一个长满尖刺的怪物冲进酒馆，自称是所谓"库帕王国"的国王，他要求酒馆老板给他派一个婊子来帮他泄欲。酒馆老板把你带到他卧室，你将完全顺从于他。即使他尺寸太大，而且只为插穴付费，你也别无选择！',
      tasks: {
        1: {
          desc: '跪下为库帕口交 2 分钟，每 20 秒深喉一次并保持眼神接触，最后深喉 15 秒让他射在你喉咙里。他不会付钱。',
          gold: 0, level: 5,
          steps: [
            { desc: '你跪下来，含住库帕那根巨大的尖刺鸡巴卖力口交，每 20 秒深喉一次，眼睛一直盯着他', bpm: 0, seconds: 120 },
            { desc: '最后你深深吞到底，保持深喉 15 秒，让库帕把滚烫的精液射进你喉咙里', bpm: 0, seconds: 15 },
          ],
        },
        2: {
          desc: '与 Z=1 相同，跪着为库帕口交到射喉。',
          gold: 0, level: 5,
          steps: [
            { desc: '跪在库帕面前，含住他巨大的鸡巴吞吐口交，每 20 秒就深深吞到底深喉一次', bpm: 0, seconds: 120 },
            { desc: '最后深喉 15 秒，让库帕射在你喉咙里', bpm: 0, seconds: 15 },
          ],
        },
        3: {
          desc: '让库帕用大鸡巴拍打你的脸和嘴唇 1 分钟，然后让他操你的嘴 2 分钟直到射脸，每 30 秒挨一耳光。',
          gold: 0, level: 5,
          steps: [
            { desc: '跪下仰着脸，让库帕用粗大的鸡巴拍打你的脸颊和嘴唇，你顺从地迎接', bpm: 0, seconds: 60 },
            { desc: '他掐着你的头操你的嘴，每 30 秒"啪"地扇你一耳光，你保持眼神接触像妓女一样呻吟', bpm: 0, seconds: 120 },
            { desc: '最后库帕把浓精射在你脸上，你被扇得脸颊通红', bpm: 0, seconds: 0 },
          ],
        },
        4: {
          desc: '趴在床上肚子朝下，让库帕深深操你 3 分钟（逐渐加速到 120 BPM），射之前不许拔出来，直到他射精。',
          gold: 100, level: 7,
          steps: [
            { desc: '你趴在床上肚子朝下，库帕把巨大的鸡巴深深捅进你的菊穴', bpm: 0, seconds: 60 },
            { desc: '他逐渐加速到 120 BPM 猛操，你咬紧床单承受，射之前不许拔出来', bpm: 120, seconds: 60 },
            { desc: '他越操越狠，你被顶得说不出话，只能淫叫', bpm: 120, seconds: 60 },
            { desc: '库帕在你体内射精，把你灌满', bpm: 0, seconds: 0 },
          ],
        },
        5: {
          desc: '与 Z=4 相同，趴着被库帕深深操到射精。',
          gold: 100, level: 7,
          steps: [
            { desc: '你趴在床上，库帕从背后狠狠操进你的菊穴，越插越深', bpm: 0, seconds: 60 },
            { desc: '逐渐加速到 120 BPM 猛干，你不允许把鸡巴拔出来', bpm: 120, seconds: 60 },
            { desc: '库帕在你体内射精，把你灌满', bpm: 0, seconds: 60 },
          ],
        },
         6: {
          desc: '先做 Z=3（拍脸操嘴射脸），然后脸上带着精液做两遍 Z=4-5（趴床深操 3 分钟 + 内射），共射 3 次。',
          gold: 200, level: 10,
          steps: [
            { desc: '你跪下仰脸，让库帕用粗大的鸡巴拍打你的脸和嘴唇，你顺从地迎接', bpm: 0, seconds: 60 },
            { desc: '库帕掐着你的头操你的嘴，每 30 秒扇你一耳光，你保持眼神接触呻吟', bpm: 0, seconds: 120 },
            { desc: '他射在你脸上，精液顺着脸颊滴落', bpm: 0, seconds: 0 },
            { desc: '你带着满脸精液趴在床上肚子朝下，库帕把巨大的鸡巴深深捅进你的菊穴', bpm: 0, seconds: 60 },
            { desc: '他逐渐加速到 120 BPM 猛操，你咬紧床单承受，射之前不许拔出来', bpm: 120, seconds: 60 },
            { desc: '他越操越狠，你被顶得说不出话，只能淫叫', bpm: 120, seconds: 60 },
            { desc: '库帕在你体内射精，把你灌满', bpm: 0, seconds: 0 },
            { desc: '他意犹未尽，又一次深深捅进你还滴着精液的菊穴', bpm: 0, seconds: 60 },
            { desc: '再次加速到 120 BPM 猛操，你被顶得翻白眼', bpm: 120, seconds: 60 },
            { desc: '库帕第二次在你体内射精，把你灌得满满的', bpm: 0, seconds: 0 },
          ],
        },
      },
    },
    guard: {
      name: '卫兵',
      intro: '你在酒馆角落遇到一个下值的卫兵，军靴踩在凳沿上，裤裆已经撑起一团阴影。"城里的规矩你知道——公职人员操妓女是要犯禁的。"他慢悠悠掏出手铐，"所以你最好管住嘴。卖力点，不然按军规抽烂你的屁股。"',
      tasks: {
        1: {
          desc: '跪着给卫兵口交 30 秒，深喉吞到底，然后趴下撅起屁股，让他用中号假阳具操你的菊穴 30 秒。',
          gold: 0, level: 1,
          rewardItem: 'guard_pass',
          steps: [
            { desc: '你跪在卫兵腿间，含住他的粗鸡巴卖力口交，一次次深喉吞到底，口水顺着下巴流下', bpm: 0, seconds: 30 },
            { desc: '你趴下撅起屁股，卫兵握着中号假阳具狠狠操进你的菊穴，你咬着唇浪叫', bpm: 0, seconds: 30 },
          ],
        },
        2: {
          desc: '与 Z=1 相同，免费给卫兵口交后撅起屁股被假阳具操菊穴。',
          gold: 0, level: 1,
          rewardItem: 'guard_pass',
          steps: [
            { desc: '跪在卫兵腿间，把他硬邦邦的粗鸡巴含进嘴里吞吐深喉 30 秒', bpm: 0, seconds: 30 },
            { desc: '转过身趴下，撅起屁股，让卫兵用中号假阳具操进你的菊穴 30 秒，你夹紧迎合', bpm: 0, seconds: 30 },
          ],
        },
        3: {
          desc: '他掐着你的下巴，粗鸡巴操进你的嘴穴 30 秒，操得你口水直流；再把你按在桌沿，从背后猛操菊穴 1 分钟（90 BPM）；最后让你跪回去，用舌头把他那根舔舐得干干净净。',
          gold: 25, level: 2,
          steps: [
            { desc: '卫兵掐着你的下巴，粗鸡巴操进你的嘴穴 30 秒，操得你口水直流、眼睛翻白', bpm: 0, seconds: 30 },
            { desc: '他把鸡巴抽出来，把你按在桌沿，从背后猛操你的菊穴（90 BPM），你被顶得淫叫连连', bpm: 90, seconds: 60 },
            { desc: '你跪回去，用舌头把他那根肉棒从根部到顶端舔舐得干干净净，一滴不剩', bpm: 0, seconds: 30 },
          ],
        },
        4: {
          desc: '与 Z=3 相同：操嘴 30 秒、后入 1 分钟、舔干净。',
          gold: 25, level: 2,
          steps: [
            { desc: '你跪着张开嘴，卫兵的粗鸡巴狠狠操进你的嘴穴 30 秒，口水飞溅', bpm: 0, seconds: 30 },
            { desc: '他把你按在桌沿，从背后猛操菊穴 1 分钟（90 BPM），你的呻吟盖不住皮肉撞击声', bpm: 90, seconds: 60 },
            { desc: '你跪回去，卖力地用舌头把肉棒舔舐干净，含住龟头吸吮', bpm: 0, seconds: 30 },
          ],
        },
        5: {
          desc: '与 Z=3-4 相同：操嘴 30 秒、后入 1 分钟、舔干净，卫兵更粗暴。',
          gold: 25, level: 2,
          steps: [
            { desc: '卫兵掐住你的下巴，粗鸡巴操进你嘴里 30 秒，粗暴得让你干呕', bpm: 0, seconds: 30 },
            { desc: '他按住你的后颈，把你按在桌沿，从背后狠狠操进菊穴 1 分钟（90 BPM）', bpm: 90, seconds: 60 },
            { desc: '最后你跪在卫兵脚边，用舌头把他那根舔得干干净净，连卵蛋都含进嘴里吸吮', bpm: 0, seconds: 30 },
          ],
        },
        6: {
          desc: '卫兵叫来换班的同袍一起"盘查"。先跪着轮流给两根粗鸡巴口交 1 分钟，再被按住同时操嘴穴和菊穴 1 分钟，最后他们把滚烫的浓精射在你脸上和菊穴深处，让你含着精液跪好。',
          gold: 45, level: 3,
          steps: [
            { desc: '你跪在两个卫兵中间，轮流为两根粗鸡巴口交，深喉、舔卵蛋一样不少', bpm: 0, seconds: 60 },
            { desc: '他们把你按在墙上，两根鸡巴同时操进你的嘴穴和菊穴，前后夹击把你操得浪叫连连', bpm: 90, seconds: 60 },
            { desc: '两根粗鸡巴轮番把滚烫的浓精射在你脸上和菊穴深处，你含着精液跪好，一滴都不敢漏', bpm: 0, seconds: 0 },
          ],
        },
      },
    },
  }

  /** 寻找顾客：随机遇到哥布林 / 狼人 / 兽人 / 牛头人 / 库帕 */
  function findCustomer () {
    const state = State.get()
    const pool = ['goblin', 'werewolf', 'orc', 'minotaur', 'koopa', 'guard']
    const key = pool[Math.floor(Math.random() * pool.length)]
    const customer = CUSTOMER_TASKS[key]
    // 女性显示小穴/菊穴两个洞，男性只说菊穴
    const intro = state.gender === 'male'
      ? customer.intro.replace('小穴/菊穴', '菊穴').replace('插入小穴/菊穴', '插入菊穴')
      : customer.intro
    campShow({
      title: `🍻 你遇见了${customer.name}`,
      className: 'tavern-work-modal',
      body: `<div class="glory-section"><h3><span>${customer.name}看上了你</span><small>${customer.name === '哥布林' ? '小号假阳具（最多 3 个）' : customer.name === '狼人' ? '中号或大号假阳具' : customer.name === '兽人' ? '大号假阳具（最多 2 个）' : customer.name === '牛头人' ? '大号马/牛形假阳具' : customer.name === '卫兵' ? '中号假阳具' : '用你最大的假阳具'}</small></h3>
        <p class="camp-muted">${intro}</p></div>`,
      actions: [
        { label: '🍑 为他服务', cls: 'btn-primary', handler: () => { Dialog.close(); runCustomerTask(key) } },
        { label: `💸 换客人（${state._prostituteSwapCost || 20}G）`, handler: () => { Dialog.close(); swapCustomer() } },
      ],
    })
  }

  /** 换客人：花金币换掉当前客人，费用递增（20 起，每次 +10，最高 100）；没钱则变成欠款 */
  function swapCustomer () {
    const state = State.get()
    const cost = Math.min(100, state._prostituteSwapCost || 20)
    if (state.gold >= cost) {
      state.gold -= cost
      EventBus.emit('ui:log', { text: `💸 花 ${cost}G 打发了这个客人，换个新的。`, type: 'dim' })
    } else {
      state._prostituteDebt = (state._prostituteDebt || 0) + cost
      EventBus.emit('ui:log', { text: `💸 你付不起 ${cost}G，换客费用记成欠款（现欠 ${state._prostituteDebt}G）。`, type: 'danger' })
    }
    // 换客费用递增（上限 100）
    state._prostituteSwapCost = Math.min(100, cost + 10)
    EventBus.emit('state:changed', state)
    findCustomer()
  }

  /** 执行顾客任务：掷 Z → 任务弹窗（BPM + 完成/跳过）→ 结算 */
  async function runCustomerTask (customerKey, forcedZ, startStep = 0) {
    const state = State.get()
    const customer = CUSTOMER_TASKS[customerKey]
    if (!customer) { state._prostitutePendingTask = null; EventBus.emit('state:changed', state); prostitute(); return }
    const z = forcedZ || Dice.rollZ()
    let task = customer.tasks[z]
    if (!task) { state._prostitutePendingTask = null; EventBus.emit('state:changed', state); prostitute(); return }
    // 性别适配任务文本：
    //  - 女性：Z=1-3 操菊穴，Z=4-6 改操小穴（阴道）
    //  - 男性：一律操菊穴（任务里写死的小穴改回菊穴）
    const taskFullText = task.desc + (task.steps || []).map(s => s.desc).join('')
    if (state.gender === 'male') {
      if (/小穴/.test(taskFullText)) {
        const fix = s => String(s || '').replace(/小穴/g, '菊穴')
        task = {
          ...task,
          desc: fix(task.desc),
          steps: (task.steps || []).map(st => ({ ...st, desc: fix(st.desc) })),
        }
      }
    } else if (z >= 4 && /菊穴/.test(taskFullText)) {
      const fix = s => String(s || '').replace(/菊穴/g, '小穴')
      task = {
        ...task,
        desc: fix(task.desc),
        steps: (task.steps || []).map(st => ({ ...st, desc: fix(st.desc) })),
      }
    }
    state._prostitutePendingTask = { customerKey, z, stepIndex: Math.max(0, startStep) }
    EventBus.emit('state:changed', state)
    await Dialog.showDice(z, 'Z')

    EventBus.emit('ui:log', { text: `🎲 Z=${z}：${customer.name}要${task.desc}`, type: 'danger' })

    // 用战斗任务弹窗逐段执行：BPM + 计时 + 完成任务/跳过
    let failed = false
    const gear = state._prostituteGear || {}
    const isInsert = /操|插入|抽插|后入|骑乘|传教士/.test(task.desc)
    // 项圈：插入任务强制 120 BPM；口塞：插入任务强制 160（+项圈 180）BPM
    let forceBpm = 0
    if (isInsert) {
      if (gear.gag) forceBpm = gear.collar ? 180 : 160
      else if (gear.collar) forceBpm = 120
    }
    const dildoName = customer.name === '哥布林' ? '小号假阴茎' : customer.name === '狼人' ? '大号假阴茎' : customer.name === '兽人' ? '大号假阴茎' : customer.name === '牛头人' ? '马/牛形假阴茎' : customer.name === '卫兵' ? '中号假阴茎' : '最大的假阴茎'
    const steps = task.steps || [{ desc: task.desc, bpm: task.bpm || 0, seconds: task.seconds || 0 }]
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      for (let i = Math.min(startStep, steps.length - 1); i < steps.length; i++) {
        state._prostitutePendingTask = { customerKey, z, stepIndex: i }
        EventBus.emit('state:changed', state)
        const step = steps[i]
        const f = await BattleUI.showTaskDialog({
          enemyName: `🍻 ${customer.name}${steps.length > 1 ? `（第 ${i + 1}/${steps.length} 段）` : ''}`,
          attackName: step.desc,
          desc: step.desc,
          bpm: forceBpm > 0 && /操|插入|抽插|后入|骑乘|传教士/.test(step.desc) ? forceBpm : (step.bpm || 0),
          seconds: step.seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName,
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm(`为${customer.name}服务：${task.desc}\n\n确定代表完成，取消代表未完成。`)
    }

    // 结算
    const isOral = /口交|吞吐|深喉/.test(task.desc)

    let gold = task.gold
    let effLevel = task.level
    let goldMult = 1
    let levelMult = 1
    let goldBonus = 0

    // 抢钱任务（金币为负）：不受任何用品金币加成影响，保持原样
    if (gold >= 0) {
      // 口红 / 妆容：口交任务金币加成
      if (isOral) {
        if (gear.lipstick) goldBonus += 20
        if (gear.makeup) goldBonus += 30
      }
      // 乳胶衣：金币翻倍
      if (gear.latex) goldMult *= 2
      // 口塞：插入任务金币翻倍
      if (gear.gag && isInsert) goldMult *= 2
    }
    // 等级翻倍（封顶 ×2）
    if (gear.lingerie) levelMult *= 2
    if (gear.latex) levelMult *= 2
    if (gear.gag && isInsert && gear.collar) levelMult *= 2
    if (gear.collar && isInsert && !gear.gag) levelMult *= 2

    // 最高只能 ×2（不叠加成 ×4/×8）
    if (goldMult > 2) goldMult = 2
    if (levelMult > 2) levelMult = 2

    gold = gold * goldMult + goldBonus
    effLevel = effLevel * levelMult

    // 营地税率：按难度从接客收入中扣除（抢钱任务不征税）
    const taxRate = (CONFIG.difficulty[state.difficulty] || {}).campTax || 0
    let campTaxPaid = 0
    if (gold > 0 && taxRate > 0) {
      campTaxPaid = Math.floor(gold * taxRate)
      gold -= campTaxPaid
    }
    if (failed) {
      gold = 0
      state._prostituteDebt = (state._prostituteDebt || 0) + 30   // 没完成：欠款 +30
    } else {
      state._prostituteLevel += effLevel   // 只有完成才升级
      state._prostituteSwapCost = 20   // 服务完成，换客费用重置
    }
    state._prostitutePendingTask = null
    // 卫兵任务奖励：出城免检查卷
    let rewardItemText = ''
    if (!failed && task.rewardItem) {
      state.inventory.consumables[task.rewardItem] = (state.inventory.consumables[task.rewardItem] || 0) + 1
      const rewardItem = typeof ItemLib !== 'undefined' ? ItemLib.get(task.rewardItem) : null
      rewardItemText = rewardItem ? `<p style="color:var(--gold);margin-top:6px">📜 获得「${rewardItem.name}」×1</p>` : ''
      EventBus.emit('ui:log', { text: `📜 卫兵塞给你一张「出城免检查卷」。`, type: 'good' })
    }
    state.gold += gold
    if (gold < 0 && state.gold < 0) state.gold = 0
    // 赚的钱先还欠款
    let repaid = 0
    if (gold > 0 && (state._prostituteDebt || 0) > 0) {
      repaid = Math.min(state._prostituteDebt, gold)
      state._prostituteDebt -= repaid
      state.gold -= repaid
    }

    const incomeText = gold < 0 ? `被抢走 ${-gold} 金币` : `赚了 ${gold} 金币${campTaxPaid > 0 ? `（营地收税 ${campTaxPaid}G）` : ''}`
    EventBus.emit('ui:log', { text: `💋 你服务完${customer.name}，${failed ? `没做好，欠老板娘 30G（现欠 ${state._prostituteDebt}G），等级未提升` : `${incomeText}${repaid > 0 ? `，其中 ${repaid}G 用来还债（还剩 ${state._prostituteDebt}G）` : ''}，妓女等级 +${effLevel}（现 ${state._prostituteLevel} 级）`}`, type: gold > 0 ? 'good' : 'dim' })
    EventBus.emit('state:changed', state)

    const title = prostituteTitle(state._prostituteLevel)
    // 新称号达成提示（仅完成时）
    let titleUp = ''
    if (!failed) {
      if (state._prostituteLevel >= 100 && state._prostituteLevel - effLevel < 100) titleUp = '<p style="color:var(--gold);font-weight:800;margin-top:6px">👑 晋升为「头牌妓畜」！</p>'
      else if (state._prostituteLevel >= 70 && state._prostituteLevel - effLevel < 70) titleUp = '<p style="color:var(--gold);font-weight:800;margin-top:6px">💼 晋升为「职业妓女」！</p>'
      else if (state._prostituteLevel >= 30 && state._prostituteLevel - effLevel < 30) titleUp = '<p style="color:var(--gold);font-weight:800;margin-top:6px">🫦 晋升为「顺从的妓女」！</p>'
      else if (state._prostituteLevel >= 10 && state._prostituteLevel - effLevel < 10) titleUp = '<p style="color:var(--gold);font-weight:800;margin-top:6px">🐣 晋升为「新手妓女」！</p>'
    }

    const inDebt = (state._prostituteDebt || 0) > 0
    campShow({
      title: '💋 服务结束', className: 'glory-result-modal',
      body: `<div class="glory-result"><strong>${failed ? `没完成，欠老板娘 30G` : gold >= 0 ? `赚了 ${gold}G${campTaxPaid > 0 ? `（税 ${campTaxPaid}G）` : ''}` : `被抢走 ${-gold}G`}</strong><p>${failed ? `等级未提升（仍是 ${state._prostituteLevel} 级 · ${title.icon} ${title.name}）` : `妓女等级提升到 <b>${state._prostituteLevel}</b> 级 · ${title.icon} ${title.name}`}</p>${inDebt ? `<p style="color:var(--danger);margin-top:6px">💸 你欠老板娘 ${state._prostituteDebt}G，还清前不能离开！</p>` : ''}${titleUp || ''}${rewardItemText || ''}${title.note ? `<p style="color:var(--text-dim);font-size:.75rem;margin-top:4px">${title.note}</p>` : ''}</div>`,
      actions: [
        { label: inDebt ? '继续接客还债' : '继续接客', cls: 'btn-primary', handler: () => { Dialog.close(); prostitute() } },
      ],
    })
  }

  /** 妓女用品 */
  const MERCHANT_GOODS = [
    { id: 'lipstick', name: '口红', price: 50, icon: '💄', desc: '口交时额外赚 20G，记得在怪物鸡巴上留下口红印' },
    { id: 'makeup', name: '全套妆容与耳环', price: 150, icon: '💎', desc: '口交时额外赚 30G，连狼人和库帕都愿意付' },
    { id: 'heels', name: '高跟鞋', price: 100, icon: '👠', desc: '没有实际效果，但穿着被操的感觉无敌' },
    { id: 'lingerie', name: '情趣内衣', price: 200, icon: '🩲', desc: '穿上三件套情趣内衣，每项任务获得的等级翻倍' },
    { id: 'latex', name: '乳胶衣', price: 300, icon: '🖤', desc: '全身乳胶紧身衣，每项任务获得的金币和等级都翻倍' },
    { id: 'collar', name: '项圈与牵绳', price: 150, icon: '🐾', desc: '怪物把你当奴隶，所有插入任务以 120 BPM 完成，等级翻倍' },
    { id: 'gag', name: '口塞', price: 100, icon: '⛓️', desc: '插入任务以 160 BPM 完成，金币翻倍；有项圈则 180 BPM，金币等级都翻倍' },
    { id: 'buttplug', name: '肛塞', price: 50, icon: '🔴', desc: '没有实际效果，但怪物超爱，还能预先扩张屁股' },
    { id: 'chastity', name: '贞操笼', price: 200, icon: '🔒', desc: '提醒怪物你是他们的财产，「完美奴隶」模式的必备品' },
  ]

  /** 妓女用品供应商 */
  function merchant () {
    const state = State.get()
    const disc = state._merchantDiscount || 0
    const ownedCount = MERCHANT_GOODS.filter(goods => (state._prostituteGear || {})[goods.id]).length
    campShow({
      title: '💄 酒馆用品供应商', className: 'tavern-merchant-modal',
      body: `<section class="merchant-hero"><span aria-hidden="true">💄</span><div><small>BACKROOM SUPPLIER · 酒馆后场</small><h3>“姐姐来挑点好东西？”</h3><p>她守着一只暗红色皮箱，里面全是接客用的特殊用品。</p></div></section>
        <div class="merchant-stats"><span>💎 ${state.gold}G</span><span>🎒 已购 ${ownedCount}/${MERCHANT_GOODS.length}</span><span>${disc > 0 ? `🏷️ 下件 -${disc * 100}%` : '🏷️ 当前原价'}</span></div>
        <div class="merchant-menu">
          <button class="merchant-menu-card" data-merchant="shop"><i>🎒</i><span><b>查看用品</b><small>永久生效，可以同时拥有多件</small></span><em>${ownedCount === MERCHANT_GOODS.length ? '已全部拥有' : '打开货箱'}</em></button>
          <button class="merchant-menu-card" data-merchant="flirt"><i>💋</i><span><b>争取折扣</b><small>完成供应商的计时任务</small></span><em>${disc > 0 ? `已有 ${disc * 100}% 折扣` : '最多半价'}</em></button>
        </div>`,
      actions: [{ label: '返回营业', handler: () => { Dialog.close(); prostitute() } }],
    })
    document.querySelectorAll('[data-merchant]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.merchant
        Dialog.close()
        if (opt === 'shop') merchantShop()
        else if (opt === 'flirt') merchantFlirt()
      }
    })
  }

  /** 商人商店：第一件商品享折扣 */
  function merchantShop () {
    const state = State.get()
    const owned = state._prostituteGear || {}
    const disc = state._merchantDiscount || 0
    const discBanner = disc > 0
      ? `<div class="merchant-discount is-active"><b>🏷️ ${disc * 100}% 折扣已生效</b><span>仅限下一件用品，购买后恢复原价</span><strong class="merchant-wallet">💎 ${state.gold}G</strong></div>`
      : `<div class="merchant-discount"><b>🏷️ 当前按原价出售</b><span>完成供应商任务，可以让下一件享受折扣</span><strong class="merchant-wallet">💎 ${state.gold}G</strong></div>`
    campShow({
      title: '🎒 接客用品货箱', className: 'merchant-shop-modal',
      body: `${discBanner}<div class="merchant-catalog">${MERCHANT_GOODS.map(g => {
          const has = owned[g.id]
          const price = Math.ceil(g.price * (1 - disc))
          const canBuy = state.gold >= price
          return `<button class="merchant-item${has ? ' is-owned' : ''}${!has && !canBuy ? ' is-unaffordable' : ''}" data-goods="${g.id}" ${has ? 'disabled' : ''}>
            <span class="merchant-item-icon">${g.icon}</span><span class="merchant-item-info"><b>${g.name}</b><small>${g.desc}</small></span>
            <span class="merchant-item-price">${has ? '✓ 已拥有' : `<b>${price}G</b>${disc > 0 ? `<s>${g.price}G</s>` : ''}`}</span>
          </button>`
        }).join('')}</div><p class="work-footnote">用品购买后永久生效；没有“穿戴栏”限制，效果按说明自动计算。</p>`,
      actions: [{ label: '返回供应商', handler: () => { Dialog.close(); merchant() } }],
    })
    document.querySelectorAll('[data-goods]').forEach(btn => {
      btn.onclick = () => {
        const goods = MERCHANT_GOODS.find(g => g.id === btn.dataset.goods)
        if (!goods || (state._prostituteGear || {})[goods.id]) return
        Dialog.close()
        const price = Math.ceil(goods.price * (1 - disc))
        if (state.gold < price) { EventBus.emit('ui:log', { text: '💰 钱不够买这个。', type: 'dim' }); merchantShop(); return }
        state.gold -= price
        state._prostituteGear = state._prostituteGear || {}
        state._prostituteGear[goods.id] = true
        EventBus.emit('ui:log', { text: `💄 买下${goods.name}，花了 ${price}G${disc > 0 ? '（含折扣）' : ''}。`, type: 'good' })
        // 折扣只对第一件生效，买完重置
        state._merchantDiscount = 0
        EventBus.emit('state:changed', state)
        merchantShop()
      }
    })
  }

  /** 贿赂供应商：两个服务任务换折扣 */
  function merchantFlirt () {
    const state = State.get()
    if ((state._merchantDiscount || 0) > 0) {
      EventBus.emit('ui:log', { text: '💄 你已经有折扣了，买完这单再说。', type: 'dim' })
      merchantShop(); return
    }
    campShow({
      title: '💋 和供应商讲价', className: 'tavern-merchant-modal',
      body: `<section class="merchant-flirt-intro"><span>💋</span><div><small>用服务换折扣</small><h3>选一个你愿意完成的任务</h3><p>只有完整完成全部计时阶段，下一件商品才会打折。</p></div></section>
        <div class="merchant-offers">
          <button class="merchant-offer" data-flirt="25"><i>🏷️</i><span><b>七五折</b><small>口交 1 分钟，再完成 10 次深喉</small></span><em>下一件 -25%</em></button>
          <button class="merchant-offer is-premium" data-flirt="50"><i>🔥</i><span><b>半价</b><small>口交 1 分钟，再接受后入式 1 分钟</small></span><em>下一件 -50%</em></button>
          <button class="merchant-offer is-plain" data-flirt="no"><i>↩</i><span><b>保持原价</b><small>不做任务，直接返回货箱</small></span><em>跳过</em></button>
        </div>`,
      actions: [{ label: '返回供应商', handler: () => { Dialog.close(); merchant() } }],
    })
    document.querySelectorAll('[data-flirt]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.flirt
        Dialog.close()
        if (opt === 'no') { merchantShop(); return }
        merchantFlirtTask(opt === '25' ? 0.25 : 0.5)
      }
    })
  }

  /** 执行贿赂任务 */
  async function merchantFlirtTask (discount) {
    const state = State.get()
    const is25 = discount === 0.25
    const steps = is25 ? [
      { desc: '你跪下来，含住供应商的鸡巴卖力口交 1 分钟', bpm: 0, seconds: 60 },
      { desc: '对准她粗壮的肉棒，连续深喉 10 次', bpm: 0, seconds: 60 },
    ] : [
      { desc: '你跪下来，含住供应商的鸡巴卖力口交 1 分钟', bpm: 0, seconds: 60 },
      { desc: '你趴下撅起屁股，让供应商从背后后入式操你 1 分钟', bpm: 0, seconds: 60 },
    ]

    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const f = await BattleUI.showTaskDialog({
          enemyName: `💄 妓女用品供应商（第 ${i + 1}/${steps.length} 段）`,
          attackName: '',
          desc: step.desc,
          bpm: step.bpm || 0,
          seconds: step.seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName: '供应商那根粗壮的肉棒',
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm(`完成供应商的两段服务，换取 ${discount * 100}% 折扣？`)
    }

    if (failed) {
      EventBus.emit('ui:log', { text: '💄 你中途打了退堂鼓，供应商撇撇嘴，折扣泡汤了。', type: 'dim' })
      merchant()
      return
    }
    state._merchantDiscount = discount
    EventBus.emit('ui:log', { text: `💄 供应商被你伺候得舒坦，给你 ${discount * 100}% 折扣！`, type: 'good' })
    EventBus.emit('state:changed', state)
    merchantShop()
  }

  /** 摇骰子赌博：下注 1/3/5，60% 亏钱 */
  function tavernGamble () {
    const state = State.get()
    if ((state._tavernGuest || 0) <= 0) {
      EventBus.emit('ui:log', { text: '🍺 赌客不在，你得先打赢一个敌人他才会回来。', type: 'dim' })
      renderTavern(); return
    }
    // 连 5G 都掏不出来 → 嘲讽
    if (state.gold < 5) {
      EventBus.emit('ui:log', { text: '🧔 "穷逼！连 5G 都拿不出来还想赌？滚远点！"', type: 'danger' })
      campShow({
        title: '🎲 老顾客的嘲笑',
        body: '<p>他上下打量你一眼，嗤笑出声：<b>"穷逼，连 5G 都没有，别在这儿碍眼，滚！"</b></p>',
        actions: [{ label: '灰溜溜离开', handler: () => { Dialog.close(); tavernGuest() } }],
      })
      return
    }
    campShow({
      title: '🎲 摇骰子', className: 'glory-modal',
      body: `<div class="glory-section"><h3><span>下注多少？</span><small>60% 会输光，40% 赚</small></h3>
        <div class="glory-hole-choice">
          <button class="glory-hole-btn" data-bet="5"><span><b>下注 5G</b><small>小赌怡情</small></span></button>
          <button class="glory-hole-btn" data-bet="10"><span><b>下注 10G</b><small>有点刺激</small></span></button>
          ${state.gold > (state._tavernGuest || 0) ? `<button class="glory-hole-btn" data-bet="allin"><span><b>梭哈 ${state.gold}G</b><small>你钱比他多，赢一把大的</small></span></button>` : ''}
        </div></div>`,
      actions: [{ label: '返回老顾客', handler: () => { Dialog.close(); tavernGuest() } }],
    })
    document.querySelectorAll('[data-bet]').forEach(btn => {
      btn.onclick = () => {
        const v = btn.dataset.bet
        const bet = v === 'allin' ? state.gold : parseInt(v)
        Dialog.close(); doTavernRoll(bet)
      }
    })
  }

  async function doTavernRoll (bet) {
    const state = State.get()
    if (state.gold < bet) { EventBus.emit('ui:log', { text: '💰 你没那么多钱下注。', type: 'dim' }); tavernGamble(); return }

    const z = Dice.rollZ()
    await Dialog.showDice(z, 'Z')
    const win = Math.random() >= 0.6   // 60% 亏钱

    if (!win) {
      state.gold -= bet
      EventBus.emit('ui:log', { text: `🎲 Z=${z} → 你输了，赔掉 ${bet}G。`, type: 'danger' })
    } else {
      const payout = Math.min(bet, Math.max(0, state._tavernGuest || 0))
      state.gold += payout
      state._tavernGuest = Math.max(0, (state._tavernGuest || 0) - payout)
      EventBus.emit('ui:log', { text: `🎲 Z=${z} → 你赢了 ${payout}G！赌客脸色有点难看。`, type: 'good' })
      // 赌客的钱被赢光了 → 离开
      if (state._tavernGuest <= 0) {
        EventBus.emit('ui:log', { text: '🏃 赌客被你赢光了，气呼呼地离开了！打赢一个敌人后他才会回来。', type: 'good' })
      }
    }
    EventBus.emit('state:changed', state)
    if ((state._tavernGuest || 0) > 0) tavernGuest()
    else renderTavern()
  }

  /** 买酒：酒有 debuff 和效果 */
  const DRINKS = [
    { id: 'beer', name: '麦酒', price: 5, heal: 10, drunk: 1, desc: '回 10 HP，但会醉酒 1 回合（攻击减半、走路摇晃）' },
    { id: 'liquor', name: '烈酒', price: 10, heal: 15, drunk: 2, desc: '回 15 HP，但醉酒 2 回合，醉得更厉害' },
    { id: 'grog', name: '药酒', price: 15, heal: 20, drunk: 3, regen: true, desc: '回 20 HP + 再生 1 回合，但醉酒 3 回合，几乎走不了路' },
  ]

  function tavernDrink () {
    const state = State.get()
    campShow({
      title: '🍷 吧台酒单', className: 'glory-modal',
      body: `<div class="glory-section"><h3><span>想喝点什么？</span><small>喝完有劲，但也有代价</small></h3>
        <div class="drink-list">${DRINKS.map(d => `
          <button class="drink-option" data-drink="${d.id}">
            <span class="drink-emoji">${d.id === 'beer' ? '🍺' : d.id === 'liquor' ? '🥃' : '🍷'}</span>
            <span class="drink-info"><b>${d.name}</b><small>${d.desc}</small></span>
            <span class="drink-price">${d.price}G</span>
          </button>`).join('')}</div></div>`,
      actions: [{ label: '返回老板娘', handler: () => { Dialog.close(); tavernBarkeep() } }],
    })
    document.querySelectorAll('[data-drink]').forEach(btn => {
      btn.onclick = () => {
        const drink = DRINKS.find(d => d.id === btn.dataset.drink)
        Dialog.close()
        if (state.gold < drink.price) { EventBus.emit('ui:log', { text: '💰 钱不够买这杯。', type: 'dim' }); tavernDrink(); return }
        state.gold -= drink.price
        state.hp = Math.min(state.maxHp, state.hp + drink.heal)
        StatusSystem.apply('drunk', drink.drunk, { source: 'player' })
        if (drink.regen) StatusSystem.apply('regeneration', 1, { level: 1, source: 'player' })
        EventBus.emit('ui:log', { text: `🍷 灌下${drink.name}，身体热乎乎的，回 ${drink.heal} HP，但醉意上头了。`, type: 'good' })
        EventBus.emit('state:changed', state)
        tavernBarkeep()
      }
    })
  }

  return { open, gloryHole, renderToilet, investigateStall, enterGlory, useToilet, deer, tavern, serveMercenary }
})()
