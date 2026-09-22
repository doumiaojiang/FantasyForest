/**
 * systems/camp-shops.js — 铁匠铺、道具商与铁匠剧情服务。
 */
window.TownShopSystem = (function () {
  const campShow = options => CampSystem.showScene(options)
  const open = opts => CampSystem.open(opts)
  const setCampPhase = () => CampSystem.ensurePhase()
  const routeTownService = part => CampSystem.routeTownService(part)
  const townServiceDesc = (part, actor) => CampSystem.townServiceDesc(part, actor)
  const wrongCommissionLead = kind => CampSystem.recordCommissionLead(kind)

  function blacksmith () {
    const state = State.get()
    setCampPhase()
    // 已签订服务契约（解锁监狱贞操装备时）：每次进铺子都要先服务铁匠
    if (state._blacksmithContract) {
      Dialog.show({
        title: '🔨 铁匠', className: 'blacksmith-modal',
        body: `<div class="camp-character"><i>🔨</i><div><b>“哟，签了契约的母狗来了。”</b><p>铁匠咧嘴一笑，放下锤子："规矩还记得吧？想进我的铺子，先把老子伺候舒坦了。"</p></div></div>
          <details class="scene-notes"><summary>查看契约内容</summary><p>这份契约永久有效；每次进入铁匠铺前，都要先完成约定的服务。</p></details>`,
        actions: [
          { label: '💦 服务铁匠（进店）', cls: 'btn-primary', handler: () => { Dialog.close(); blacksmithService() } },
          { label: '🚶 转身就走', handler: () => { Dialog.close(); blacksmithLeaveAttempt() } },
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
    const oralRoute = routeTownService('oral')
    const penetrationRoute = routeTownService(isFemale ? 'vagina' : 'anal')
    if (oralRoute.mode === 'unavailable' || penetrationRoute.mode === 'unavailable') {
      EventBus.emit('ui:log', { text: '🔒 妖缚装备封死了所有可用部位，铁匠拒绝让你进店。', type: 'danger' })
      open()
      return
    }
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const steps = [
        { desc: townServiceDesc(oralRoute.part, '铁匠'), bpm: oralRoute.part === 'oral' ? 0 : 90, seconds: 30 },
        { desc: townServiceDesc(penetrationRoute.part, '铁匠'), bpm: penetrationRoute.part === 'oral' ? 0 : 90, seconds: 30 },
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

  /** 转身就走：5% 几率被铁匠抓住，强操一顿才放人 */
  async function blacksmithLeaveAttempt () {
    const state = State.get()
    const roll = Math.floor(Math.random() * 100) + 1
    if (roll > 5) {
      EventBus.emit('ui:log', { text: '🚶 你趁铁匠低头打铁，转身溜出了铺子。', type: 'dim' })
      open()
      return
    }
    EventBus.emit('ui:log', { text: '👿 你刚转身，铁匠的巨掌就钳住了你的后颈："签了契约还想跑？给老子趴好！"', type: 'danger' })
    const route = routeTownService(state.gender !== 'male' ? 'vagina' : 'anal')
    if (route.mode === 'unavailable') {
      EventBus.emit('ui:log', { text: '🔒 所有部位都被锁死，铁匠无从下手，骂了几句后把你赶了出去。', type: 'dim' })
      open()
      return
    }
    const holeDesc = townServiceDesc(route.part, '铁匠')
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const f = await BattleUI.showTaskDialog({
        enemyName: '🔨 铁匠（怒火）',
        attackName: '强制惩罚',
        desc: `${holeDesc}，120 BPM 持续 1 分钟，被他操得浪叫连连`,
        bpm: 120,
        seconds: 60,
        dmg: 0,
        noDamage: true,
        dildoName: '铁匠那根粗壮的鸡巴',
      })
      failed = f
    } else {
      failed = !confirm('铁匠抓住你强操一顿（完成代表挨完了）。')
    }
    if (failed) {
      if (!State.get()._godMode) state.hp = Math.max(0, state.hp - 10)
      EventBus.emit('ui:log', { text: '🥵 你被铁匠按着操，腿软得跪在地上，挨了 -10 HP。', type: 'danger' })
      EventBus.emit('state:changed', state)
      if (state.hp <= 0) {
        state.phase = 'gameover'
        EventBus.emit('game:gameover', {})
        return
      }
    } else {
      EventBus.emit('ui:log', { text: '💦 铁匠泄了火，松开手："下次再跑，可没这么便宜。"', type: 'good' })
    }
    open()
  }

  /** 道具商主界面：商店 / 聊天 */
  function potionShop () {
    const state = State.get()
    campShow({
      title: '🧪 道具商', className: 'potion-modal',
      body: `<div class="camp-character"><i>🧪</i><div><b>“要点什么？都是硬货。”</b><p>道具商掀开皮箱一角，瓶瓶罐罐叮当响："药剂、药膏、咒术补给——自己挑。"</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-ps="buy"><i>🛒</i><span><b>商店</b><small>药品与旅途消耗品</small></span><em>进店</em></button>
          <button class="camp-opt" data-ps="chat"><i>💬</i><span><b>聊天</b><small>听他唠唠进货门道</small></span><em>搭话</em></button>
        </div>`,
      actions: [{ kind: 'navigation', label: '返回营地', handler: () => { Dialog.close(); open() } }],
    })
    document.querySelectorAll('[data-ps]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.ps
        Dialog.close()
        if (opt === 'buy') potionBuy()
        else if (opt === 'chat') potionChat()
      }
    })
  }

  /** 进道具商商店 */
  function potionBuy () {
    const state = State.get()
    state._shopReturnToCamp = true
    EventBus.emit('state:changed', state)
    ShopSystem.open({ type: TILE.CAMP, raw: '道具商' })
  }

  /** 道具商聊天：随机循环 */
  const POTION_CHATS = [
    { title: '💬 道具商 · 进货', body: `<div class="camp-character"><i>🧪</i><div><b>“我这的货，路子野得很。”</b><p>他拍了拍皮箱："药草、药膏、假阳具……都是从深山里收来的。好使。"</p></div></div>` },
    { title: '💬 道具商 · 药草', body: `<div class="camp-character"><i>🧪</i><div><b>“森林里的药草，懂的人才知道金贵。”</b><p>他捻了捻干草："受伤了就来找我，比光挨着强。"</p></div></div>` },
    { title: '💬 道具商 · 梦幻商店', body: `<div class="camp-character"><i>🧪</i><div><b>“找那些稀奇的塞入物？去梦幻商店。”</b><p>他朝营地深处努努嘴："那类货现在归妖缚商行管，我这里只留药品和旅途补给。"</p></div></div>` },
  ]
  function potionChat () {
    const state = State.get()
    const pool = POTION_CHATS
    const pick = pool[Math.floor(Math.random() * pool.length)]
    campShow({
      title: pick.title, className: 'potion-modal', body: pick.body,
      actions: [
        { label: '再聊聊', handler: () => { Dialog.close(); potionChat() } },
        { kind: 'navigation', label: '返回道具商', handler: () => { Dialog.close(); potionShop() } },
      ],
    })
  }

  /** 铁匠主界面：聊天 / 商店 / 解锁监狱贞操装备 */
  function blacksmithShop () {
    const state = State.get()
    const commissionReady = state._wrongCommissionStage === 3
    const commissionAsked = !!(state._wrongCommissionLeads && state._wrongCommissionLeads.blacksmith)
    const unlockableRestraints = typeof RestraintSystem !== 'undefined'
      ? RestraintSystem.SLOT_ORDER.filter(slot => RestraintSystem.isLocked(slot) && !RestraintSystem.isStory(slot) && !RestraintSystem.isContractLock(slot))
      : []
    campShow({
      title: '🔨 铁匠铺', className: 'blacksmith-modal',
      body: `<div class="camp-character"><i>🔨</i><div><b>“想看点什么？”</b><p>铁匠磨着刀，扫了你一眼："家伙什儿都在架上，自己挑。"</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-bs="buy"><i>🛒</i><span><b>商店</b><small>武器与饰品</small></span><em>进店</em></button>
          <button class="camp-opt" data-bs="chat"><i>💬</i><span><b>聊天</b><small>听铁匠唠唠</small></span><em>搭话</em></button>
          ${commissionReady ? `<button class="camp-opt camp-opt-clue${commissionAsked ? ' is-seen' : ''}" data-bs="wrong-letter"><i>✉️</i><span><b>${commissionAsked ? '再问那批锁具' : '出示派克的货单'}</b><small>${commissionAsked ? '确认运输许可丢失的位置' : '桥边的新锁环带着铁匠的锉痕'}</small></span><em>${commissionAsked ? '追问' : '调查'}</em></button>` : ''}
          ${unlockableRestraints.length ? `<button class="camp-opt" data-bs="unlockrestr"><i>⛓️</i><span><b>解开妖缚装置</b><small>付费开锁，金属装置也能拆</small></span><em>${unlockableRestraints.length} 件</em></button>` : ''}
          ${state._prisonChastity ? `<button class="camp-opt" data-bs="unlock"><i>🔓</i><span><b>解锁监狱贞操装备</b><small>求铁匠打开你身上的锁</small></span><em>求解锁</em></button>` : ''}
        </div>`,
      actions: [{ kind: 'navigation', label: '返回营地', handler: () => { Dialog.close(); open() } }],
    })
    document.querySelectorAll('[data-bs]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.bs
        Dialog.close()
        if (opt === 'buy') blacksmithBuy()
        else if (opt === 'chat') blacksmithChat()
        else if (opt === 'wrong-letter') blacksmithWrongCommission()
        else if (opt === 'unlockrestr') blacksmithUnlockRestraint()
        else if (opt === 'unlock') blacksmithUnlock()
      }
    })
  }

  function blacksmithWrongCommission () {
    const state = State.get()
    const asked = !!(state._wrongCommissionLeads && state._wrongCommissionLeads.blacksmith)
    if (asked) {
      campShow({
        title: '🔨 铁匠 · 运货锁具', className: 'blacksmith-modal wrong-letter-reaction-modal',
        body: `<section class="scene-dialogue"><i aria-hidden="true">🔨</i><div><h3>“我只负责改锁，不负责问货给谁用。”</h3><p>铁匠压低声音提醒你：车夫在旧桥换轮轴时丢了一只装许可的皮卷。镇里的监督官正在派人回去寻找。</p></div></section>`,
        actions: [{ kind: 'navigation', label: '不再追问', handler: blacksmithShop }],
      })
      return
    }
    campShow({
      title: '🔨 铁匠铺 · 钳台', className: 'blacksmith-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">✉️</i><div><h3>你把派克的货单和桥边捡到的锁环放上铁砧。</h3><p>铁匠只看了一眼锉口，就知道已经无法否认。这些锁出自他的钳台，而且并不是给箱子用的。</p></div></section>
        <div class="wrong-letter-evidence"><span>锁环内侧</span><p>尺寸与妖缚项圈和腕铐完全一致；其中几枚还预留了统一编号的位置。</p></div>
        <div class="scene-choice-list wrong-letter-choices">
          <button data-smith-letter="direct"><i>▸</i><span><b>“这些锁是给谁准备的？”</b><small>追问真正的订货人</small></span><em>追问</em></button>
          <button data-smith-letter="permit"><i>▸</i><span><b>“车队凭什么能直接进镇？”</b><small>询问运输许可的来源</small></span><em>查证</em></button>
        </div>`,
      actions: [{ kind: 'navigation', label: '先不声张', handler: blacksmithShop }],
    })
    document.querySelectorAll('[data-smith-letter]').forEach(btn => {
      btn.onclick = () => finishBlacksmithWrongCommission(btn.dataset.smithLetter)
    })
  }

  function finishBlacksmithWrongCommission (choice) {
    const state = State.get()
    if (!state._pInvestigationChoices || typeof state._pInvestigationChoices !== 'object') state._pInvestigationChoices = {}
    state._pInvestigationChoices.blacksmith = choice
    const complete = wrongCommissionLead('blacksmith')
    EventBus.emit('ui:log', { text: '🔨 铁匠承认改装过派克送来的约束锁具，订单由镇方许可。', type: 'warning' })
    campShow({
      title: '🔨 铁匠 · 订单', className: 'blacksmith-modal wrong-letter-reaction-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🔨</i><div><h3>“锁是镇里订的。派克出钱，我照图改装，仅此而已。”</h3><p>${choice === 'permit' ? '他承认车队拿着正式许可，因此卫兵没有检查货箱。' : '他说锁具已经被人取走，送往城门旁的新仓库。'}</p></div></section>
        <div class="wrong-letter-evidence is-found"><span>车夫遗失的东西</span><p>车队在旧桥更换过断裂的轮轴，装着正式许可的皮卷就是在那里丢的。</p></div>
        ${complete ? '<p class="wrong-letter-after">酒馆和铁匠的说法终于对上了：派克的车队持有镇方许可，而能证明这一点的皮卷还遗落在旧桥。</p>' : ''}`,
      actions: [{ kind: 'navigation', label: '离开钳台', handler: blacksmithShop }],
    })
  }

  /** 铁匠付费开锁：为妖缚装置开锁（金属也能拆，卡死/诅咒收费更高；剧情锁不可拆） */
  function blacksmithUnlockRestraint () {
    const state = State.get()
    const locked = (typeof RestraintSystem !== 'undefined' ? RestraintSystem.SLOT_ORDER : []).filter(slot => RestraintSystem.isLocked(slot) && !RestraintSystem.isStory(slot) && !RestraintSystem.isContractLock(slot))
    const cards = locked.length
      ? locked.map(slot => {
        const d = RestraintSystem.get(slot)
        const def = RestraintSystem.defOf(d.id)
        const cost = RestraintSystem.npcUnlockCost(slot)
        const canPay = state.gold >= cost
        return `<button class="camp-opt camp-opt-teleport" data-ul="${slot}" ${canPay ? '' : 'disabled'}>
          <i>${RestraintSystem.SLOT_ICONS[slot]}</i><span><b>${def.name}</b><small>${RestraintSystem.SLOT_NAMES[slot]} · ${d.jammed ? '卡死（双倍）' : RestraintSystem.isCursed(slot) ? '诅咒（三倍）' : '上锁'}</small></span><em>${canPay ? `${cost}G` : '钱不够'}</em></button>`
      }).join('')
      : '<p class="camp-muted">你身上没有可开锁的妖缚装置。</p>'
    campShow({
      title: '⛓️ 铁匠 · 开锁', className: 'blacksmith-modal',
      body: `<div class="camp-character"><i>🔨</i><div><b>“锁在身上的玩意儿？我拆得动。”</b><p>铁匠抄起钳子和锤子："金属的我也能开，卡死的翻倍收费。"</p></div></div>
        <div class="camp-grid">${cards}</div>`,
      actions: [{ kind: 'navigation', label: '返回铁匠', handler: () => { Dialog.close(); blacksmithShop() } }],
    })
    document.querySelectorAll('[data-ul]').forEach(btn => {
      btn.onclick = () => {
        const slot = btn.dataset.ul
        const result = RestraintSystem.npcUnlock(slot)
        if (result && !result.ok) EventBus.emit('ui:log', { text: result.msg, type: 'danger' })
        EventBus.emit('state:changed', state)
        blacksmithUnlockRestraint()
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
      title: pick.title, className: 'blacksmith-modal', body: pick.body,
      actions: [
        { label: '再聊聊', handler: () => { Dialog.close(); blacksmithChat() } },
        { kind: 'navigation', label: '返回铁匠', handler: () => { Dialog.close(); blacksmithShop() } },
      ],
    })
  }

  /** 解锁监狱贞操装备：500G + 大腿写"免费肉便器" */
  function blacksmithUnlock () {
    const state = State.get()
    campShow({
      title: '🔓 解锁监狱贞操装备', className: 'blacksmith-modal',
      body: `<div class="camp-character"><i>🔨</i><div><b>“身上那把锁，我认得。”</b><p>铁匠盯着你腿间的贞操锁："监狱的货。想让我撬开？可以——<b>500G</b>，外加在大腿上烙上这几个字：<b>免费肉便器</b>。"</p></div></div>
        <details class="scene-notes"><summary>查看铁匠的条件</summary><p>支付费用并签下永久契约；以后每次进铺子，都要先完成约定的服务。</p></details>`,
      actions: [
        { label: state.gold >= 500 ? '📜 签契约 + 花 500G 解锁' : '💰 钱不够（500G）', cls: state.gold >= 500 ? 'btn-primary' : 'btn-danger', handler: () => {
          if (state.gold < 500) { EventBus.emit('ui:log', { text: '💰 钱不够解锁。', type: 'dim' }); blacksmithUnlock(); return }
          // 先签契约 + 服务，服务完才真正解锁
          Dialog.close()
          blacksmithContractService()
        } },
        { kind: 'navigation', label: '算了', handler: () => { Dialog.close(); blacksmithShop() } },
      ],
    })
  }

  /** 签订契约：先服务铁匠（口交+肛交/性交），服务完才解锁 */
  async function blacksmithContractService () {
    const state = State.get()
    const isFemale = state.gender !== 'male'
    const oralRoute = routeTownService('oral')
    const penetrationRoute = routeTownService(isFemale ? 'vagina' : 'anal')
    if (oralRoute.mode === 'unavailable' || penetrationRoute.mode === 'unavailable') {
      EventBus.emit('ui:log', { text: '🔒 妖缚装备封死了所有可用部位，契约无法履行，铁匠拒绝解锁。', type: 'danger' })
      blacksmithShop()
      return
    }
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const steps = [
        { desc: townServiceDesc(oralRoute.part, '铁匠'), bpm: oralRoute.part === 'oral' ? 0 : 90, seconds: 30 },
        { desc: townServiceDesc(penetrationRoute.part, '铁匠'), bpm: penetrationRoute.part === 'oral' ? 0 : 90, seconds: 30 },
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
    if (typeof RestraintSystem !== 'undefined') {
      const prev = state._prisonWaistPrev
      state._prisonWaistPrev = null
      if (prev) RestraintSystem.restore('waist', prev)   // 还原入狱前的腰部装置
      else if (RestraintSystem.get('waist') && RestraintSystem.get('waist').id === 'prison_chastity') RestraintSystem.remove('waist')
    }
    state._freeMeatBrand = true
    state._blacksmithContract = true   // 永久契约：以后每次进铺子都要先服务
    if (StatusSystem.has('chastity')) StatusSystem.remove('chastity')
    EventBus.emit('ui:log', { text: '💦 铁匠被你伺候舒服了，签下契约，撬开了你的监狱贞操锁，并烙上"免费肉便器"。', type: 'good' })
    EventBus.emit('state:changed', state)
    Dialog.show({
      title: '🔓 契约签订 · 解锁完成', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🔨</i><div><b>“成了。锁开了，契约也签了。”</b><p>铁匠拍拍你的屁股："记住，往后每次进我这铺子，都得先伺候我一顿——这是你自己签的。"</p></div></div>
        <p class="scene-status-line is-risk"><span>监狱装备已经取下</span><b>通缉仍然有效</b></p>`,
      actions: [
        { label: '进店', cls: 'btn-primary', handler: () => { Dialog.close(); blacksmithShop() } },
      ],
    })
  }


  return {
    openBlacksmith: blacksmith,
    openPotionShop: potionShop,
  }
})()

