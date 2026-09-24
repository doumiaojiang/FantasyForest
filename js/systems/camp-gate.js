/**
 * systems/camp-gate.js — 离营、城门检查、通缉处置与卫兵服务。
 */
window.TownGateSystem = (function () {
  const GLORY_FEE = CampSystem.gloryFee
  const campShow = options => CampSystem.showScene(options)
  const campClose = () => CampSystem.closeScene()
  const open = opts => CampSystem.open(opts)
  const showGloryWork = () => CampSystem.showGloryWork()
  const routeTownService = part => CampSystem.routeTownService(part)
  const townServiceDesc = (part, actor) => CampSystem.townServiceDesc(part, actor)

  function leaveCamp () {
    const state = State.get()
    if ((state._pBanditClothesLocked || (state._pBanditDefeatCount || 0) > 0) && StatusSystem.has('naked')) {
      showBanditNakedGate('exit')
      return
    }
    // 1. 强制流程（厕所/酒馆欠债）优先
    if ((state._gloryDebt || 0) > 0 || state._gloryFreeService || (state._prostituteDebt || 0) > 0) {
      if ((state._prostituteDebt || 0) > 0) {
        Dialog.close(); TownTavernWorkSystem.open(); return
      }
      Dialog.close(); showGloryWork(); return
    }
    Dialog.close()
    // 兜底：荣耀洞还清欠款标记未清除（如刷新跳过）→ 回营地触发卫兵/队长事件，而非直接出城
    if (state._gloryJustCleared) {
      TownGlorySystem.finishClearedLeave()
      return
    }
    // 2. 通缉犯：优先于一切检查，不能用搜身/贿赂/免检查卷逃过
    if (state._wanted) {
      guardWantedFlow()
      return
    }
    // 3. 出城免检查卷：只出城有效，消耗 1 张直接放行
    if ((state.inventory.consumables.guard_pass || 0) > 0) {
      useGuardPass()
      return
    }
    // 4. 本次进城已检查过 → 不再触发任何卫兵拦截（一次营地访问最多一次）
    if (state._guardCheckedThisVisit) {
      doLeaveCamp(); return
    }
    // 5. 新的卫兵搜身（普通玩家 35% 概率；持证玩家由 guardEncounter 表内 30% 处理）
    if (!state._prostituteLicensed && shouldGuardSearch('exit')) {
      showGuardSearchPrompt('exit')
      return
    }
    // 6. 持证：原有出城卫兵事件
    if (state._prostituteLicensed) {
      guardEncounter()
      return
    }
    // 7. 正常离开
    doLeaveCamp()
  }

  async function banditGateService (direction) {
    const state = State.get()
    Dialog.close()
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      await BattleUI.showTaskDialog({
        enemyName: '🛡️ 城门卫兵', attackName: '查验桥下记号',
        desc: '卫兵命你跪下用嘴证明不是从谁家逃出的奴隶，持续三十秒。',
        bpm: 0, seconds: 30, dmg: 0, noDamage: true, allowSkip: false,
        dildoName: '卫兵的鸡巴', completeLabel: '完成查验', dialogClass: 'p-bandit-gate-task-modal',
      })
    }
    state._pBanditGateReactionPending = false
    state._guardCheckedThisVisit = true
    EventBus.emit('ui:log', { text: '🛡️ 卫兵看够了桥下记号，嘲笑着放你通过。', type: 'danger' })
    EventBus.emit('state:changed', state); State.save()
    if (direction === 'exit') doLeaveCamp()
    else CampSystem.open()
  }

  function showBanditNakedGate (direction = 'enter') {
    const state = State.get()
    const canExplain = (state._wrongCommissionStage || 0) >= 6 || !!state._pBridgePermitAcquired
    Dialog.show({
      title: '🛡️ 城门 · 桥下记号',
      className: 'guard-search-modal commission-bridge-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">🛡️</i><div><h3>卫兵的长矛横到你身前，视线落在全裸身体与尚未褪净的炭字上。</h3><p>“旧桥记号，不是镇上发的。有衣服的人走门，没衣服的${state.gender === 'male' ? '男婊子' : '母畜'}先报身份。”</p></div></section>
        <div class="wrong-letter-evidence"><span>锁在桥洞里的原衣</span><p>这不是通缉，也不会把你送进荣耀洞；卫兵只是要当场确认你不是逃奴。</p></div>`,
      actions: [
        ...(canExplain ? [{ label: '拿旧桥线索解释', cls: 'btn-primary', handler: () => {
          state._pBanditGateReactionPending = false
          state._guardCheckedThisVisit = true
          if (window.TownReputationSystem) TownReputationSystem.addFame(1, '带着强盗记号穿过城门')
          EventBus.emit('ui:log', { text: '🛡️ 卫兵核对许可后放行，却把“桥下母猪”的称呼喊给整条街听。', type: 'danger' })
          EventBus.emit('state:changed', state); State.save(); Dialog.close()
          if (direction === 'exit') doLeaveCamp(); else CampSystem.open()
        } }] : []),
        { label: '跪下接受查验', cls: 'btn-danger', handler: () => banditGateService(direction) },
        ...(state.gold >= 50 ? [{ label: '付 50G 披上值勤破布', handler: () => {
          state.gold -= 50
          state._pBanditGateReactionPending = false
          state._guardCheckedThisVisit = true
          EventBus.emit('ui:log', { text: '🧥 你花 50G 披上一块值勤破布；原衣仍锁在桥洞，状态依旧是全裸。', type: 'warning' })
          EventBus.emit('state:changed', state); State.save(); Dialog.close()
          if (direction === 'exit') doLeaveCamp(); else CampSystem.open()
        } }] : []),
        ...(direction === 'exit' ? [{ label: '硬闯出去', cls: 'btn-danger', handler: () => {
          state._pBanditGateReactionPending = false
          if (window.TownReputationSystem) TownReputationSystem.addScore(-3, '全裸硬闯城门')
          EventBus.emit('ui:log', { text: '⚠️ 你趁换岗撞开长矛冲出城门，卫兵把这笔麻烦记在了值勤簿上。', type: 'danger' })
          EventBus.emit('state:changed', state); State.save(); Dialog.close(); doLeaveCamp()
        } }] : []),
      ],
    })
  }

  /** 出城卫兵事件（取得妓女许可证后触发） */
  function guardEncounter () {
    const state = State.get()
    const guardMsg = (title, body, actions) => {
      Dialog.show({ title: '🛡️ 城门口 · 卫兵', className: 'glory-modal', body, actions })
    }

    const roll = Dice.rollZ()

    // 卫兵事件概率表（用百分比模拟）
    // 10% 罚款100 / 30% 搜身 / 20% 放行 / 5% 没收衣服 / 15% 口交1分钟 / 15% 肛交1分钟 / 5% 给血药
    const r = Math.random() * 100
    if (r < 10) {
      guardMsg('🛡️ 卫兵拦住你', `<div class="glory-section"><h3><span>“妓女证？行，交 100G 罚款。”</span><small>卫兵伸手讨钱</small></h3>
        <p class="camp-muted">${state.gold >= 100 ? '你乖乖掏钱。' : '你掏不出钱，卫兵脸色一沉，把你丢进公共厕所：<b>"没钱？去厕所里干活把钱挣回来！"</b>'}</p></div>`,
        [
        ...(state.gold < 100 && window.MercenaryContractSystem && MercenaryContractSystem.enabled() ? [{ label: '⚔️ 让芙蕾雅垫付', cls: 'btn-primary', handler: () => {
          MercenaryContractSystem.offerAdvance(100, '卫兵罚款', () => { Dialog.close(); doLeaveCamp() })
        } }] : []),
        ...((state._pillorySettings || {}).enabled !== false ? [{ label: '🪵 木枷抵罚（60秒）', cls: 'btn-danger', handler: () => {
          Dialog.close()
          TownPillorySystem.start('fine', 60, 0)
        } }] : []),
        { label: state.gold >= 100 ? `💸 交 100G` : '🚻 被丢进厕所', cls: state.gold >= 100 ? 'btn-primary' : 'btn-danger', handler: () => {
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
    } else if (r < 40) {
      // 搜身检查（30%）；总开关关闭则直接放行
      if (!guardSettings().enabled) {
        guardMsg('🛡️ 卫兵拦住你', '<div class="glory-section"><h3><span>“啊，老熟人了，过去吧。”</span><small>卫兵挥挥手放行</small></h3></div>',
          [{ label: '出城', cls: 'btn-primary', handler: () => { Dialog.close(); doLeaveCamp() } }])
      } else {
        showGuardSearchPrompt('exit')
      }
    } else if (r < 60) {
      // 放行（20%，佩戴奴隶项圈则被当成奴畜盘查）
      if (typeof RestraintSystem !== 'undefined' && RestraintSystem.hasCollar()) {
        guardMsg('🛡️ 卫兵拦住你', `<div class="glory-section"><h3><span>“项圈？哪家的奴畜也敢到处跑。”</span><small>卫兵拽了拽你脖子上的项圈，一脸戏谑</small></h3>
          <p class="camp-muted">“想过去？交 <b>50G</b> 贡品，或者跪下来把老子伺候舒坦了。”</p></div>`,
          [
            ...(state.gold >= 50 ? [{ label: '💸 交 50G 贡品', cls: 'btn-primary', handler: () => {
              state.gold -= 50
              EventBus.emit('ui:log', { text: '🐕 交了 50G 贡品，卫兵牵着项圈放你出城。', type: 'danger' })
              EventBus.emit('state:changed', state); Dialog.close(); doLeaveCamp()
            } }] : []),
            ...(state.gold < 50 && window.MercenaryContractSystem && MercenaryContractSystem.enabled() ? [{ label: '⚔️ 让芙蕾雅垫付', cls: 'btn-primary', handler: () => {
              MercenaryContractSystem.offerAdvance(50, '卫兵贡品', () => { Dialog.close(); doLeaveCamp() })
            } }] : []),
            { label: '👄 服务卫兵', cls: 'btn-danger', handler: () => { Dialog.close(); guardBlowjob() } },
          ])
      } else {
        guardMsg('🛡️ 卫兵拦住你', '<div class="glory-section"><h3><span>“啊，老熟人了，过去吧。”</span><small>卫兵挥挥手放行</small></h3></div>',
          [{ label: '出城', cls: 'btn-primary', handler: () => { Dialog.close(); doLeaveCamp() } }])
      }
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

  /** 出示出城免检查卷：只出城有效，消耗 1 张直接放行 */
  function useGuardPass () {
    const state = State.get()
    const count = state.inventory.consumables.guard_pass || 0
    if (count <= 0) { doLeaveCamp(); return }
    state.inventory.consumables.guard_pass = count - 1
    EventBus.emit('ui:log', { text: '📜 你出示出城免检查卷，卫兵挥挥手放行（免检查卷剩余 ' + (count - 1) + ' 张）。', type: 'good' })
    EventBus.emit('state:changed', state)
    Dialog.show({
      title: '🛡️ 城门口 · 卫兵', className: 'glory-modal',
      body: `<div class="glory-section"><h3><span>“哟，老熟人给的卷儿。”</span><small>卫兵看了一眼免检查卷，嘿嘿一笑放行</small></h3>
        <p class="camp-muted">“既然是熟人打了招呼，就放你一马。下回洞里见了，可别装不认识。”</p></div>`,
      actions: [{ label: '出城', cls: 'btn-primary', handler: () => { Dialog.close(); doLeaveCamp() } }],
    })
  }

  /** 通缉犯出城：卫兵认出逃犯（优先于普通检查，不可被贿赂/免检查卷绕过） */
  function guardWantedFlow () {
    const state = State.get()
    const lockClue = state._prisonChastity
      ? '“站住——监狱的锁？你是从深喉监狱逃出来的！”'
      : '“站住——你就是那个越狱的逃犯！”'
    const lockClueSmall = state._prisonChastity
      ? '卫兵一眼认出你腿间的贞操锁，挡在你面前'
      : '卫兵对照通缉令，一眼认出你就是越狱的逃犯'
    const serviceTip = state._prisonChastity
      ? '要么跪下来用<b>嘴和屁股</b>把老子伺候舒坦了——锁都锁了，小穴你就别想了。'
      : '要么跪下来把老子伺候舒坦了——销案底的事，找队长去。'
    Dialog.show({
      title: '🛡️ 城门口 · 卫兵', className: 'glory-modal',
      body: `<div class="glory-section"><h3><span>${lockClue}</span><small>${lockClueSmall}</small></h3>
        <p class="camp-muted">“想让我闭嘴？要么交 <b>150G</b> 封口费，${serviceTip}”</p></div>`,
      actions: [
        ...(state.gold >= 150 ? [{ label: '💸 交 150G 封口费', cls: 'btn-primary', handler: () => {
          state.gold -= 150
          EventBus.emit('ui:log', { text: '💸 交了 150G 封口费，卫兵让开道放你出城。', type: 'danger' })
          EventBus.emit('state:changed', state); Dialog.close(); doLeaveCamp()
        } }] : []),
        ...(state.gold < 150 && window.MercenaryContractSystem && MercenaryContractSystem.enabled() ? [{ label: '⚔️ 让芙蕾雅垫付', cls: 'btn-primary', handler: () => {
          MercenaryContractSystem.offerAdvance(150, '卫兵封口费', () => { Dialog.close(); doLeaveCamp() })
        } }] : []),
        { label: state._prisonChastity ? '👄🍑 服务卫兵' : '👄 服务卫兵', cls: 'btn-danger', handler: () => { Dialog.close(); guardPrisonChastityService() } },
      ],
    })
  }

  /* ============ 城门卫兵搜身检查 ============ */

  /** 检查频率表（进城/出城概率） */
  const GUARD_FREQ = {
    low: { enter: 0.10, exit: 0.15 },
    standard: { enter: 0.25, exit: 0.35 },
    high: { enter: 0.40, exit: 0.60 },
    always: { enter: 1, exit: 1 },
  }

  /** 检查时长表 [min, max] 秒 */
  const GUARD_DURATION = {
    fast: [5, 10],
    standard: [10, 30],
    immersive: [30, 60],
    fixed: [60, 60],
  }

  /** 城门检查设置读取（带默认值） */
  function guardSettings () {
    const s = State.get()._guardSearchSettings || {}
    return {
      enabled: s.enabled !== false,
      frequency: GUARD_FREQ[s.frequency] ? s.frequency : 'standard',
      duration: GUARD_DURATION[s.duration] ? s.duration : 'standard',
      confiscateLockpick: s.confiscateLockpick !== false,
      allowBribe: s.allowBribe !== false,
      deviceComments: s.deviceComments !== false,
    }
  }

  /** 本次是否触发卫兵搜身：按频率表 */
  function shouldGuardSearch (direction) {
    const state = State.get()
    const s = guardSettings()
    if (!s.enabled) return false
    if (state._guardCheckedThisVisit) return false
    const freq = GUARD_FREQ[s.frequency]
    const multiplier = window.TownReputationSystem ? TownReputationSystem.guardMultiplier() : 1
    return Math.random() < Math.min(1, (direction === 'enter' ? freq.enter : freq.exit) * multiplier)
  }

  /** 妖缚装置台词：最多显示三条，额外装备汇总，避免移动端弹窗过长。 */
  function guardDeviceComment () {
    if (typeof RestraintSystem === 'undefined') return ''
    if (!guardSettings().deviceComments) return ''
    const comments = []
    const neck = RestraintSystem.get('neck')
    const mouth = RestraintSystem.get('mouth')
    const arms = RestraintSystem.get('arms_heavy') || RestraintSystem.get('arms')
    const waist = RestraintSystem.get('waist')
    if (neck) {
      const def = RestraintSystem.defOf(neck.id)
      comments.push(`“${def ? def.name : '项圈'}戴得挺显眼。哪家的奴畜也敢一个人乱跑？”`)
    }
    if (mouth) {
      const def = RestraintSystem.defOf(mouth.id)
      comments.push(def && def.id === 'slut_gag'
        ? `“开口口塞？嘴倒是还留着能用。”`
        : `“${def ? def.name : '口塞'}把嘴堵得这么严？那就老实站好。”`)
    }
    if (arms) {
      const def = RestraintSystem.defOf(arms.id)
      comments.push(`“手被${def ? def.name : '束缚装置'}锁成这样，应该翻不出什么花样。”`)
    }
    if (waist) {
      const def = RestraintSystem.defOf(waist.id)
      comments.push(`“腰上的${def ? def.name : '锁具'}可不像普通首饰，我得记下来。”`)
    }
    ;['anal', 'vagina'].forEach(slot => {
      const entry = RestraintSystem.insertionDevice(slot)
      if (!entry) return
      const charge = RestraintSystem.insertionCharge(slot)
      const part = slot === 'anal' ? '菊穴' : '小穴'
      const count = entry.def.stackable ? ` ×${Math.max(1, entry.device.count || 1)}` : ''
      const lock = entry.device.locked ? '，而且还上了锁' : ''
      const power = charge ? `，充能 ${charge.current}/${charge.max}` : ''
      comments.push(`“${part}里塞着${entry.def.name}${count}${lock}${power}——带着这种东西也敢过关？”`)
    })
    if (!comments.length) return ''
    const shown = comments.slice(0, 3)
    const remaining = comments.length - shown.length
    return `<div class="guard-search-comments">${shown.map(line => `<p class="guard-search-warning">${line}</p>`).join('')}${remaining > 0 ? `<p class="guard-search-more">另有 ${remaining} 件装备已被卫兵登记。</p>` : ''}</div>`
  }

  /** 检查前对话：状态摘要 + 四个选项 */
  function showGuardSearchPrompt (direction) {
    const state = State.get()
    const s = guardSettings()
    const isEnter = direction === 'enter'
    const hasLockpick = (state.inventory.consumables.lockpick || 0) > 0
    const hasPass = (state.inventory.consumables.guard_pass || 0) > 0
    const wearing = typeof RestraintSystem !== 'undefined' ? RestraintSystem.countWorn() : 0
    const reputation = window.TownReputationSystem ? TownReputationSystem.rank() : null
    const guardGreeting = window.TownReputationSystem ? TownReputationSystem.guardGreeting() : '“站住，例行检查。”'
    const body = `
      <div class="guard-search-hero"><i>🛡️</i><div><small>城门例行检查</small><b>${guardGreeting}</b><p>卫兵抬手挡住去路，目光在你的武器、背包和身上的束缚装置间来回扫视。<br>“最近有人往城里带违禁品。站好别动，检查一小会儿。”</p></div></div>
      <div class="guard-search-status">
        <div><span>金币</span><b>${state.gold}G</b></div>
        <div><span>城镇评价</span><b>${reputation ? `${reputation.icon} ${reputation.name}` : '中立'}</b></div>
        <div><span>妓女许可证</span><b>${state._prostituteLicensed ? '📜 持证' : '无'}</b></div>
        <div><span>妖缚装置</span><b>${wearing ? `⛓️ ${wearing} 件` : '无'}</b></div>
        <div><span>开锁工具</span><b>${hasLockpick ? `🛠️ ×${state.inventory.consumables.lockpick}` : '无'}</b></div>
        <div><span>免检查卷</span><b>${hasPass ? `📜 ×${state.inventory.consumables.guard_pass}` : '无'}</b></div>
      </div>
      ${guardDeviceComment()}
    `
    const actions = [
      { label: '🔍 接受检查', cls: 'btn-primary', handler: () => { Dialog.close(); startGuardSearch(direction) } },
      ...(s.allowBribe ? [{
        label: '💸 交 50G 快速放行', cls: 'btn-danger',
        disabled: state.gold < 50,
        handler: () => {
          if (state.gold < 50) return
          Dialog.close()
          state.gold -= 50
          EventBus.emit('ui:log', { text: '💸 交了 50G，卫兵痛快放行。', type: 'danger' })
          EventBus.emit('state:changed', state)
          finishGuardPass(direction, false)
        },
      }] : []),
      ...(!isEnter && hasPass ? [{ label: '📜 出示免检查卷', cls: 'btn-success', handler: () => { Dialog.close(); useGuardPass() } }] : []),
      { kind: 'navigation', label: isEnter ? '暂不进城' : '返回营地', handler: () => { Dialog.close(); cancelGuardSearch(direction) } },
    ]
    Dialog.show({
      title: '🛡️ 城门检查 · 卫兵',
      className: 'guard-search-modal inventory-modal restraint-modal',
      body,
      actions,
    })
  }

  /** 开始搜身：按设置时长随机；记录断点 + 立即存档（防刷新绕过），复用任务倒计时 */
  async function startGuardSearch (direction) {
    const state = State.get()
    const s = guardSettings()
    const dur = GUARD_DURATION[s.duration]
    const duration = dur[0] === dur[1] ? dur[0] : (dur[0] + Math.floor(Math.random() * (dur[1] - dur[0] + 1)))
    state._guardSearchPending = { direction, startedAt: Date.now(), duration }
    EventBus.emit('state:changed', state)
    State.save()
    await runGuardSearchTask(direction, duration)
  }

  async function runGuardSearchTask (direction, seconds) {
    let skipped = !!(State.get()._guardSearchPending && State.get()._guardSearchPending.skipped)
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      await BattleUI.showTaskDialog({
        enemyName: '🛡️ 城门卫兵',
        attackName: '例行搜身',
        desc: `站在原地接受卫兵检查，持续 ${seconds} 秒`,
        bpm: 0,
        seconds,
        dmg: 0,
        noDamage: true,
        allowSkip: true,
        skipWarning: '跳过搜身有 50% 几率被卫兵栽赃，“搜出”价值 20–300G 的赃物并当场罚没金币。请确认后再点击。',
        onSkip: () => {
          skipped = true
          const pending = State.get()._guardSearchPending
          if (pending) pending.skipped = true
          EventBus.emit('state:changed', State.get())
          State.save()
        },
        showFailure: false,
        completeLabel: '✅ 检查结束',
        dialogClass: 'guard-search-task-modal',
      })
    }
    if (State.get()._guardSearchPending) {
      State.get()._guardSearchPending = null
      EventBus.emit('state:changed', State.get())
    }
    resolveGuardSearch(direction, { skipped })
  }

  /** 搜身结算：按设置决定是否没收开锁工具（只没收 1 个），然后放行 */
  function resolveGuardSearch (direction, options = {}) {
    const state = State.get()
    const s = guardSettings()
    const framed = !!options.skipped && Math.random() < 0.5
    const framedValue = framed ? 20 + Math.floor(Math.random() * 281) : 0
    const confiscatedGold = framed ? Math.min(Math.max(0, Number(state.gold) || 0), framedValue) : 0
    const framedDebt = framed ? Math.max(0, framedValue - confiscatedGold) : 0
    if (confiscatedGold > 0) state.gold -= confiscatedGold
    if (framedDebt > 0) {
      state._gloryDebt = Math.max(0, Number(state._gloryDebt) || 0) + framedDebt
      state._gloryByGuard = true
    }
    const confiscated = s.confiscateLockpick && (state.inventory.consumables.lockpick || 0) > 0
    if (confiscated) {
      state.inventory.consumables.lockpick--
      EventBus.emit('ui:log', { text: '🛡️ 卫兵搜出并没收了 1 个开锁工具。', type: 'danger' })
      EventBus.emit('state:changed', state)
    }
    if (framed) {
      EventBus.emit('ui:log', { text: `🛡️ 你跳过了例行搜身，卫兵随即栽赃了一包价值 ${framedValue}G 的赃物，当场罚没 ${confiscatedGold}G${framedDebt > 0 ? `，剩余 ${framedDebt}G 转为厕所欠债` : ''}。`, type: 'danger' })
      EventBus.emit('state:changed', state)
    }
    const resultTitle = framed ? '“赃物搜到了。还想走得这么快？”' : confiscated ? '“开锁工具？我可记下了。”' : '“没发现违禁品。走吧，别在门口磨蹭。”'
    const resultText = framed
      ? `卫兵从自己袖口里抖出一包“赃物”，当众说它价值 ${framedValue}G，并从你身上罚没了 ${confiscatedGold}G。${framedDebt > 0 ? `还差的 ${framedDebt}G 被记成欠债，卫兵要把你直接送去公共厕所赚回来。` : ''}`
      : confiscated ? '卫兵把搜出的开锁工具收进口袋，侧身让你过去。' : '卫兵收起打量的目光，侧身让开道。'
    Dialog.show({
      title: '🛡️ 城门检查 · 卫兵',
      className: 'guard-search-modal inventory-modal restraint-modal',
      body: `<div class="guard-search-hero"><i>🛡️</i><div><small>${framed ? '跳过检查 · 被栽赃' : '检查结果'}</small><b>${resultTitle}</b><p>${resultText}</p></div>${guardDeviceComment()}</div>`,
      actions: [{
        label: framedDebt > 0 ? `🚻 去公共厕所还 ${framedDebt}G` : direction === 'enter' ? '✅ 进城' : '✅ 出城',
        cls: framedDebt > 0 ? 'btn-danger' : 'btn-primary',
        handler: () => {
          Dialog.close()
          if (framedDebt > 0) {
            state._guardCheckedThisVisit = true
            EventBus.emit('town:guardCheck', { direction })
            EventBus.emit('state:changed', state)
            State.save()
            showGloryWork()
          } else finishGuardPass(direction, true)
        },
      }],
    })
  }

  /** 检查通过：进入/离开统一收尾（每个分支只执行一次位置切换） */
  function finishGuardPass (direction, inspected = false) {
    const state = State.get()
    state._guardCheckedThisVisit = true
    if (inspected && window.TownReputationSystem && state._townReputation && state._townReputation.counters) {
      const counters = state._townReputation.counters
      counters.guardChecks = (counters.guardChecks || 0) + 1
      if (counters.guardChecks % 3 === 0) TownReputationSystem.addScore(1, '多次配合城门例行检查')
    }
    if (inspected) EventBus.emit('town:guardCheck', { direction })
    EventBus.emit('state:changed', state)
    if (direction === 'enter') {
      open()
    } else {
      doLeaveCamp()
    }
  }

  /** 放弃检查：不扣钱、不耗回合、不清除检查可能，下次重新判定 */
  function cancelGuardSearch (direction) {
    const state = State.get()
    if (direction === 'enter') {
      // 暂不进城：回到进入营地前的位置（避免站在营地格绕过检查）
      if (state._campReturnPos && state._campReturnPos.x !== undefined) {
        state.position = { x: state._campReturnPos.x, y: state._campReturnPos.y }
        state._campReturnPos = null
      }
      state.phase = 'idle'
      campClose()
      EventBus.emit('state:changed', state)
      GameFlow.afterEvent()
    } else {
      open()
    }
  }

  /** 刷新恢复：搜身中断档后重开检查页面（剩余时间恢复，不重复结算） */
  function resumeGuardSearch () {
    const state = State.get()
    const pending = state._guardSearchPending
    if (!pending) return
    const remaining = Math.max(0, pending.duration - Math.floor((Date.now() - pending.startedAt) / 1000))
    if (remaining <= 0) {
      state._guardSearchPending = null
      EventBus.emit('state:changed', state)
      resolveGuardSearch(pending.direction, { skipped: !!pending.skipped })
    } else {
      runGuardSearchTask(pending.direction, remaining)
    }
  }

  /** 通缉犯出城被卫兵抓：用身体伺候（佩戴贞操锁则只能嘴和屁股） */
  async function guardPrisonChastityService () {
    const state = State.get()
    const oralRoute = routeTownService('oral')
    const penetrationRoute = routeTownService(state.gender !== 'male' ? 'vagina' : 'anal')
    if (oralRoute.mode === 'unavailable' || penetrationRoute.mode === 'unavailable') {
      EventBus.emit('ui:log', { text: '⛓️ 妖缚装备封死了所有可用部位，卫兵无法完成交易，直接把你押回监狱。', type: 'danger' })
      TownPrisonSystem.enter()
      return
    }
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const steps = [
        { desc: townServiceDesc(oralRoute.part, '卫兵'), bpm: oralRoute.part === 'oral' ? 0 : 90, seconds: 30 },
        { desc: townServiceDesc(penetrationRoute.part, '卫兵'), bpm: penetrationRoute.part === 'oral' ? 0 : 90, seconds: 30 },
      ]
      for (let i = 0; i < steps.length; i++) {
        const f = await BattleUI.showTaskDialog({
          enemyName: `🛡️ 卫兵（第 ${i + 1}/2 段）`,
          attackName: '封口服务',
          desc: steps[i].desc,
          bpm: steps[i].bpm || 0,
          seconds: steps[i].seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName: '卫兵那根粗壮的鸡巴',
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm('服务卫兵：口交 + 肛交（完成代表伺候完了）。')
    }
    if (failed) {
      EventBus.emit('ui:log', { text: '⛓️ 你伺候到一半停下，卫兵脸色一沉——把你押回了深喉监狱！', type: 'danger' })
      state._prisonEscapePenalty = (state._prisonEscapePenalty || 0) + 150
      TownPrisonSystem.enter()
      return
    }
    EventBus.emit('ui:log', { text: '💦 卫兵满意地提上裤子，挥手放行："嘴和屁股都不赖，走吧。"', type: 'good' })
    doLeaveCamp()
  }

  /** 卫兵口交任务 */
  async function guardBlowjob () {
    const state = State.get()
    const route = routeTownService('oral')
    if (route.mode === 'unavailable') {
      EventBus.emit('ui:log', { text: '🛡️ 所有部位都被锁死，卫兵嫌麻烦地挥手让你离开。', type: 'dim' })
      doLeaveCamp()
      return
    }
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const failed = await BattleUI.showTaskDialog({
        enemyName: '🛡️ 卫兵',
        attackName: '',
        desc: townServiceDesc(route.part, '卫兵'),
        bpm: route.part === 'oral' ? 0 : 90,
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
    const route = routeTownService(state.gender !== 'male' && !ChastitySystem.isWorn() ? 'vagina' : 'anal')
    if (route.mode === 'unavailable') {
      EventBus.emit('ui:log', { text: '🛡️ 所有部位都被锁死，卫兵无从下手，只能放你离开。', type: 'dim' })
      doLeaveCamp()
      return
    }
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const failed = await BattleUI.showTaskDialog({
        enemyName: '🛡️ 卫兵',
        attackName: '',
        desc: `${townServiceDesc(route.part, '卫兵')}，持续 1 分钟`,
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
    // 真正离开后重置本次进城检查标记（下次进城重新判定）
    state._guardCheckedThisVisit = false
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

  /** 营地传送阵：选择已激活的传送阵（城镇传送阵始终可用） */

  return {
    leave: leaveCamp,
    finishLeave: doLeaveCamp,
    showBanditNakedGate,
    shouldSearch: shouldGuardSearch,
    showSearchPrompt: showGuardSearchPrompt,
    resumeSearch: resumeGuardSearch,
  }
})()
