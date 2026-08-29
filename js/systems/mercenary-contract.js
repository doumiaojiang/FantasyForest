/**
 * systems/mercenary-contract.js — 芙蕾雅债务与抵债契约
 *
 * 长期雇佣不收日薪；只有玩家明确接受借款、代付或违约才产生债务。
 * 本模块统一处理债务、自动还款、契约装备和界面，避免各场景重复实现。
 */
window.MercenaryContractSystem = (function () {
  const LIMITS = { lenient: 400, standard: 300, strict: 200 }
  const CASH_LOANS = [50, 100, 200]
  const LOAN_FEE_RATE = 0.10
  const DIFF_LABEL = { lenient: '宽松', standard: '标准', strict: '严格' }
  const PENALTY_LABEL = { warning: '仅警告', standard: '标准', strict: '严格' }
  const GEAR = [
    { slot: 'eyes', id: 'blindfold', name: '蒙眼巡林' },
    { slot: 'neck', id: 'slave_collar', name: '项圈同行' },
    { slot: 'ankles', id: 'ankle_chains', name: '负链而行' },
    { slot: 'arms', id: 'handcuffs', name: '铐手狩猎' },
    { slot: 'mouth', id: 'leather_gag', name: '沉默誓约' },
  ]
  let observedState = null
  let observedGold = 0
  let settlingIncome = false

  function st () { return State.get() }
  function data () { return st()._mercenaryContract }
  function settings () { return st()._mercenaryContractSettings }
  function hasMercenary () { return !!(st() && st()._mercenary) }
  function enabled () { return hasMercenary() && settings().enabled !== false }
  function limit () { return LIMITS[settings().difficulty] || LIMITS.standard }
  function debt () { return Math.max(0, data().debt || 0) }
  function escapeHtml (value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch])
  }
  function tier () {
    const value = debt()
    if (!value) return { key: 'free', label: '自由', icon: '✓', rate: 0 }
    if (value < 100) return { key: 'notice', label: '提醒', icon: '💸', rate: 0 }
    if (value < 200) return { key: 'negotiate', label: '交涉', icon: '📜', rate: 0.20 }
    if (value <= limit()) return { key: 'control', label: '管控', icon: '⚠️', rate: 0.35 }
    return { key: 'over', label: '超限', icon: '⛓️', rate: 0.60 }
  }

  function emit (save = true) {
    EventBus.emit('state:changed', st())
    if (save) State.save()
  }

  function addDebt (amount, reason, options = {}) {
    if (!enabled()) return { ok: false, msg: '佣兵债务系统未启用' }
    const value = Math.max(0, Math.floor(Number(amount) || 0))
    if (!value) return { ok: false, msg: '债务金额无效' }
    if (debt() > limit() && !options.allowOverLimit) return { ok: false, msg: '债务已超限，芙蕾雅拒绝继续垫付' }
    data().debt = Math.min(9999, debt() + value)
    EventBus.emit('ui:log', { text: `💸 芙蕾雅替你垫付 ${value}G${reason ? `（${reason}）` : ''}，佣兵债务现为 ${data().debt}G。`, type: 'danger' })
    emit()
    return { ok: true, amount: value, debt: data().debt }
  }

  /** 真正到账的应急借款；本金与 10% 手续费一并计入债务。 */
  function borrowCash (amount) {
    if (!enabled() || settings().allowAdvance === false) return { ok: false, msg: '应急借款未启用' }
    const principal = Math.max(0, Math.floor(Number(amount) || 0))
    if (!CASH_LOANS.includes(principal)) return { ok: false, msg: '借款金额无效' }
    const fee = Math.ceil(principal * LOAN_FEE_RATE)
    if (debt() + principal + fee > limit()) return { ok: false, msg: `债务上限不足（本次需要 ${principal + fee}G 额度）` }
    data().debt += principal + fee
    st().gold = Math.max(0, st().gold || 0) + principal
    // 借款到账不是经营收入，不能在同一轮被自动还款逻辑扣回。
    observedState = st()
    observedGold = st().gold
    EventBus.emit('ui:log', { text: `💰 芙蕾雅借给你 ${principal}G，连同 ${fee}G 手续费共记债 ${principal + fee}G。`, type: 'good' })
    emit()
    return { ok: true, principal, fee, debt: data().debt }
  }

  function canFinanceRecruitment (price) {
    const state = st()
    return !hasMercenary() && settings().enabled !== false && settings().allowAdvance !== false && Math.max(0, state.gold || 0) < price
  }

  /** 招募分期不受普通额度限制；超过额度后，在债务降回上限前不能继续借款。 */
  function offerRecruitmentFinance (mercenary, price, onAccept) {
    if (!mercenary || !canFinanceRecruitment(price)) return false
    const upfront = Math.min(Math.max(0, st().gold || 0), price)
    const principal = Math.max(0, price - upfront)
    const fee = Math.ceil(principal * LOAN_FEE_RATE)
    const financed = principal + fee
    Dialog.show({
      title: '⚔️ 分期招募芙蕾雅', className: 'merc-contract-modal',
      body: `<section class="merc-advance-card"><i>🤝</i><div><small>长期雇佣 · 招募分期</small><h3>先付 ${upfront}G，剩余费用记入佣兵债务？</h3><p>芙蕾雅会立即加入。未付雇佣费 <b>${principal}G</b>，手续费 <b>${fee}G</b>，合计新增债务 <b>${financed}G</b>。债务高于普通上限期间不能再次借款。</p></div></section>`,
      actions: [
        { label: `确认分期 · 欠 ${financed}G`, cls: 'btn-primary', handler: () => {
          const state = st()
          if (hasMercenary()) { Dialog.close(); return }
          state.gold = Math.max(0, (state.gold || 0) - upfront)
          state._mercenary = { ...mercenary, dead: false, lust: Math.max(0, mercenary.lust || 0) }
          data().introSeen = true
          data().debt = Math.min(9999, debt() + financed)
          settings().enabled = true
          observedState = state
          observedGold = state.gold
          EventBus.emit('ui:log', { text: `⚔️ 芙蕾雅接受分期招募并加入队伍：支付 ${upfront}G，佣兵债务 ${data().debt}G。`, type: 'good' })
          emit()
          Dialog.close()
          if (typeof onAccept === 'function') onAccept({ upfront, principal, fee, debt: data().debt })
        } },
        { label: '再想想', handler: () => Dialog.close() },
      ],
    })
    return true
  }

  function repay (amount, source = '主动还款', options = {}) {
    if (!hasMercenary() || !debt()) return { ok: false, msg: '当前没有佣兵债务' }
    let value = Math.max(0, Math.floor(Number(amount) || 0))
    if (!options.external) value = Math.min(value, Math.max(0, st().gold || 0))
    value = Math.min(value, debt())
    if (!value) return { ok: false, msg: '没有可用于还款的金币' }
    if (!options.external) st().gold -= value
    data().debt -= value
    if (!options.silent) EventBus.emit('ui:log', { text: `💰 ${source}偿还芙蕾雅 ${value}G，剩余债务 ${data().debt}G。`, type: data().debt ? 'dim' : 'good' })
    emit(options.save !== false)
    return { ok: true, amount: value, debt: data().debt }
  }

  /** 观察同一状态对象的净金币增长，自动按债务等级还款。加载存档时对象会更换，不会误扣。 */
  function observeGold (state) {
    if (!state) return
    if (state !== observedState) {
      observedState = state
      observedGold = Math.max(0, state.gold || 0)
      return
    }
    const now = Math.max(0, state.gold || 0)
    if (settlingIncome) { observedGold = now; return }
    const gain = now - observedGold
    observedGold = now
    if (gain <= 0 || !enabled() || !debt()) return
    const active = data().active
    const rate = active && active.type === 'income' ? 0.60 : tier().rate
    if (rate <= 0) return
    const paid = Math.min(debt(), Math.max(1, Math.floor(gain * rate)))
    settlingIncome = true
    state.gold -= paid
    data().debt -= paid
    if (active && active.type === 'income' && !active.ready) {
      active.progress = Math.min(active.required, active.progress + paid)
      active.ready = active.progress >= active.required
      if (active.ready) finishActive('收入托管目标已达成')
    }
    observedGold = state.gold
    EventBus.emit('ui:log', { text: `💰 本次收入 ${gain}G，其中 ${paid}G 自动偿还芙蕾雅（剩余 ${data().debt}G）。`, type: 'dim' })
    settlingIncome = false
    State.save()
  }

  function offerAdvance (amount, reason, onAccept, onDecline) {
    if (!enabled() || settings().allowAdvance === false) return false
    const value = Math.max(1, Math.floor(Number(amount) || 0))
    const fee = /保释/.test(reason || '') ? 20 : /罚款|贡品|封口/.test(reason || '') ? 10 : 0
    const total = value + fee
    if (debt() > limit()) return false
    Dialog.show({
      title: '⚔️ 芙蕾雅愿意垫付', className: 'merc-contract-modal',
      body: `<section class="merc-advance-card"><i>💰</i><div><small>必要费用 · ${escapeHtml(reason || '垫付款')}</small><h3>由芙蕾雅先支付 ${value}G？</h3><p>这会增加 <b>${total}G</b> 佣兵债务${fee ? `（含 ${fee}G 交涉费）` : ''}。所有垫付都需要你亲自确认。</p></div></section>`,
      actions: [
        { label: `接受垫付 · 欠 ${total}G`, cls: 'btn-primary', handler: () => {
          const result = addDebt(total, reason, { allowOverLimit: true })
          Dialog.close()
          if (result.ok && typeof onAccept === 'function') onAccept(result)
        } },
        { label: '不用了', handler: () => { Dialog.close(); if (typeof onDecline === 'function') onDecline() } },
      ],
    })
    return true
  }

  function showIntro (onClose) {
    if (!hasMercenary() || data().introSeen) { if (onClose) onClose(); return }
    Dialog.show({
      title: '⚔️ 芙蕾雅的佣兵契约', className: 'merc-contract-modal',
      body: `<section class="merc-contract-intro"><i>⚔️</i><div><small>FREYA · MERCENARY BOND</small><h3>一次性雇佣费已经付清</h3><p>芙蕾雅不会收日薪。只有在你主动借款、请求代付或违反契约时，才会产生佣兵债务。</p></div></section><div class="merc-rule-list"><span>✓ 借款与代付均需确认</span><span>✓ 可以直接还钱</span><span>✓ 也能完成契约抵债</span><span>✓ 债务清零后可以解雇</span></div>`,
      actions: [
        { label: '启用债务契约', cls: 'btn-primary', handler: () => { data().introSeen = true; settings().enabled = true; emit(); Dialog.close(); if (onClose) onClose() } },
        { label: '暂时不用', handler: () => { data().introSeen = true; settings().enabled = false; emit(); Dialog.close(); if (onClose) onClose() } },
      ],
    })
  }

  function compatibleGear () {
    if (!window.RestraintSystem || settings().gearContracts === false || st()._restraintContract) return []
    return GEAR.filter(entry => {
      const def = RestraintSystem.defOf(entry.id)
      if (!def || RestraintSystem.get(entry.slot) || !RestraintSystem.allowedSlotsOf(def).includes(entry.slot)) return false
      if (def.femaleOnly && st().gender === 'male') return false
      if (def.maleOnly && st().gender !== 'male') return false
      return true
    })
  }

  function buildOffers () {
    const offers = []
    const debtNow = debt()
    const rank = debtNow >= 200 ? 'hard' : debtNow >= 100 ? 'normal' : 'easy'
    const battleCfg = rank === 'hard' ? { required: 4, relief: 100 } : rank === 'normal' ? { required: 3, relief: 70 } : { required: 2, relief: 40 }
    const gear = compatibleGear()
    if (gear.length) {
      const pick = gear[Math.floor(Math.random() * gear.length)]
      offers.push({ id: `mc-${Date.now()}-battle`, type: 'battle', name: pick.name, difficulty: rank, required: battleCfg.required, relief: battleCfg.relief, device: { slot: pick.slot, id: pick.id }, desc: `佩戴指定装备赢得 ${battleCfg.required} 场普通战斗。` })
    }
    const incomeGoal = Math.min(debtNow, rank === 'hard' ? 150 : rank === 'normal' ? 100 : 60)
    offers.push({ id: `mc-${Date.now()}-income`, type: 'income', name: '收入托管', difficulty: rank, required: Math.max(1, incomeGoal), relief: 0, desc: `新收入的 60% 自动还债，累计偿还 ${incomeGoal}G 后结束。` })
    if (settings().tavernContracts !== false) offers.push({ id: `mc-${Date.now()}-tavern`, type: 'tavern', name: '酒馆抵债', difficulty: 'normal', required: 1, relief: 50, service: 'any', desc: '完成一次酒馆、荣耀洞或足交服务。' })
    if ((st()._mercenary.lust || 0) >= 25) offers.push({ id: `mc-${Date.now()}-merc`, type: 'mercenary', name: '照顾雇佣兵', difficulty: 'easy', required: 1, relief: 40, service: 'mercenary', desc: '完成一次芙蕾雅服务。' })
    return offers.slice(0, 3)
  }

  function acceptOffer (offer) {
    if (!enabled() || !offer || data().active) return { ok: false, msg: '当前无法接受契约' }
    const active = { ...offer, progress: 0, violations: 0, ready: false }
    delete active.desc
    if (active.type === 'battle') {
      const result = RestraintSystem.equip(active.device.slot, active.device.id, { locked: true, lockType: 'mercenary_contract', source: 'mercenary_contract' }, true)
      if (!result.ok) return { ok: false, msg: result.msg || '契约装备穿戴失败' }
      result.device.contractId = active.id
    }
    data().active = active
    EventBus.emit('ui:log', { text: `📜 已接受芙蕾雅契约「${active.name}」。`, type: 'good' })
    emit()
    return { ok: true }
  }

  function releaseGear (active) {
    if (!active || !active.device || !window.RestraintSystem) return
    const worn = RestraintSystem.get(active.device.slot)
    if (worn && worn.lockType === 'mercenary_contract' && worn.contractId === active.id) RestraintSystem.remove(active.device.slot, true)
  }

  function finishActive (reason) {
    const active = data().active
    if (!active) return false
    releaseGear(active)
    const relief = Math.min(debt(), active.relief || 0)
    data().debt -= relief
    data().completedCount = (data().completedCount || 0) + 1
    data().violationCount = 0
    data().active = null
    EventBus.emit('ui:log', { text: `🏅 芙蕾雅契约「${active.name}」完成${reason ? `：${reason}` : ''}${relief ? `，抵扣 ${relief}G 债务` : ''}。`, type: 'good' })
    emit()
    return true
  }

  function recordViolation (reason) {
    const active = data().active
    if (!active) return
    active.violations = (active.violations || 0) + 1
    data().violationCount = active.violations
    if (active.violations === 1 || settings().penalty === 'warning') {
      EventBus.emit('ui:log', { text: `⚠️ 芙蕾雅警告你：${reason}。再犯会按违约处理。`, type: 'danger' })
    } else if (active.violations === 2) {
      addDebt(settings().penalty === 'strict' ? 30 : 15, '违反佣兵契约', { allowOverLimit: true })
      active.progress = 0
    } else {
      data().supportDisabledBattles = settings().penalty === 'strict' ? 5 : 3
      EventBus.emit('ui:log', { text: `⚔️ 芙蕾雅暂停战斗支援 ${data().supportDisabledBattles} 场。`, type: 'danger' })
    }
    emit()
  }

  function onBattleEnd (result) {
    if (!hasMercenary()) return
    if (data().supportDisabledBattles > 0 && result && !result.fled) data().supportDisabledBattles--
    const active = data().active
    if (!enabled() || !active || active.type !== 'battle' || active.ready || !result || !result.victory || result.fled || !result.enemyId || result.enemyId === 'spirit_of_forest') { emit(false); return }
    const worn = RestraintSystem.get(active.device.slot)
    if (!worn || worn.id !== active.device.id || worn.contractId !== active.id) { recordViolation('契约装备不完整'); return }
    active.progress = Math.min(active.required, active.progress + 1)
    if (active.progress >= active.required) finishActive('战斗目标已达成')
    else {
      EventBus.emit('ui:log', { text: `📜 芙蕾雅契约进度 ${active.progress}/${active.required}。`, type: 'dim' })
      emit()
    }
  }

  function recordService (kind) {
    const active = data().active
    if (!enabled() || !active) return false
    const matches = active.type === 'mercenary' ? kind === 'mercenary' : active.type === 'tavern' && ['tavern', 'glory', 'foot'].includes(kind)
    if (!matches) return false
    active.progress = active.required
    return finishActive('服务任务已完成')
  }

  function abandon (free = false) {
    const active = data().active
    if (!active) return { ok: false, msg: '当前没有契约' }
    const fee = free ? 0 : active.difficulty === 'hard' ? 30 : active.difficulty === 'normal' ? 20 : 10
    releaseGear(active)
    data().active = null
    if (fee) addDebt(fee, `放弃「${active.name}」`, { allowOverLimit: true })
    else emit()
    return { ok: true, fee }
  }

  function dismissMercenary () {
    if (!hasMercenary()) return { ok: false, msg: '当前没有佣兵' }
    if (data().active) return { ok: false, msg: '请先完成或放弃当前抵债契约' }
    if (debt()) return { ok: false, msg: `请先还清 ${debt()}G 佣兵债务` }
    const name = st()._mercenary.name || '芙蕾雅'
    st()._mercenary = null
    st()._mercenaryContract = {
      introSeen: false,
      debt: 0,
      violationCount: 0,
      supportDisabledBattles: 0,
      completedCount: data().completedCount || 0,
      active: null,
    }
    observedState = st()
    observedGold = Math.max(0, st().gold || 0)
    EventBus.emit('ui:log', { text: `👋 你解除了与${name}的雇佣关系。她回到了雾灯酒馆，之后仍可重新招募。`, type: 'dim' })
    emit()
    return { ok: true }
  }

  function requestDismiss () {
    if (!hasMercenary()) return
    if (data().active || debt()) {
      const reason = data().active ? '先完成或放弃当前抵债契约。' : `先还清剩余 ${debt()}G 债务。`
      alert(`暂时无法解除雇佣关系：${reason}`)
      return
    }
    const name = st()._mercenary.name || '芙蕾雅'
    Dialog.show({
      title: '👋 解除佣兵契约？', className: 'merc-contract-modal',
      body: `<section class="merc-contract-intro"><i>⚔️</i><div><small>END MERCENARY BOND</small><h3>${escapeHtml(name)}将离开队伍</h3><p>解除后她会回到雾灯酒馆。战斗支援和佣兵服务立即停止，以后可以重新支付雇佣费招募。</p></div></section>`,
      actions: [
        { label: '确认解除雇佣', cls: 'btn-danger', handler: () => {
          Dialog.close()
          const result = dismissMercenary()
          if (result.ok && st().phase === 'camp' && window.CampSystem && CampSystem.tavern) CampSystem.tavern()
        } },
        { label: '继续同行', handler: () => { Dialog.close(); openPanel() } },
      ],
    })
  }

  function supportAvailable () { return !data() || (data().supportDisabledBattles || 0) <= 0 }

  function showOffers () {
    if (!debt()) { openPanel(); return }
    if (data().active) { openPanel(); return }
    const offers = buildOffers()
    Dialog.show({
      title: '📜 芙蕾雅的抵债契约', className: 'merc-contract-modal',
      body: `<div class="merc-offer-list">${offers.map((offer, index) => `<button class="merc-offer" data-merc-offer="${index}"><i>${offer.type === 'battle' ? '⛓️' : offer.type === 'income' ? '💰' : offer.type === 'mercenary' ? '💋' : '🍺'}</i><span><small>${offer.difficulty === 'hard' ? '困难' : offer.difficulty === 'normal' ? '普通' : '简单'}契约</small><b>${escapeHtml(offer.name)}</b><em>${escapeHtml(offer.desc)}</em></span><strong>${offer.relief ? `-${offer.relief}G` : '托管'}</strong></button>`).join('')}</div>`,
      actions: [{ label: '返回债务面板', handler: () => { Dialog.close(); openPanel() } }],
    })
    document.querySelectorAll('[data-merc-offer]').forEach(btn => {
      btn.onclick = () => {
        const result = acceptOffer(offers[Number(btn.dataset.mercOffer)])
        if (!result.ok) { alert(result.msg); return }
        Dialog.close(); openPanel()
      }
    })
  }

  function openPanel () {
    if (!hasMercenary()) return
    if (!data().introSeen) { showIntro(openPanel); return }
    const merc = st()._mercenary
    const active = data().active
    const t = tier()
    const pct = Math.min(100, Math.round((debt() / Math.max(1, limit())) * 100))
    Dialog.show({
      title: `⚔️ 佣兵契约 · ${escapeHtml(merc.name)}`, className: 'merc-contract-modal',
      body: `<section class="merc-profile"><i>${merc.icon}</i><div><small>MERCENARY BOND</small><h3>${escapeHtml(merc.name)}</h3><p>攻击 ${merc.dmg} · 性欲 ${merc.lust || 0}%${merc.dead ? ' · 已阵亡' : ''}</p></div><strong class="is-${t.key}">${t.icon} ${t.label}</strong></section>
        <section class="merc-debt-card"><div><small>当前债务</small><b>${debt()}G</b><em>上限 ${limit()}G · 收入自动还款 ${Math.round((active && active.type === 'income' ? 0.60 : t.rate) * 100)}%</em></div><span><i style="width:${pct}%"></i></span></section>
        ${active ? `<section class="merc-active-contract"><small>进行中的契约</small><h3>📜 ${escapeHtml(active.name)}</h3><p>${active.type === 'battle' ? `普通战斗 ${active.progress}/${active.required}` : active.type === 'income' ? `已托管 ${active.progress}/${active.required}G` : `任务进度 ${active.progress}/${active.required}`}</p><div class="merc-contract-progress"><i style="width:${Math.min(100, active.progress / active.required * 100)}%"></i></div></section>` : '<p class="merc-empty">当前没有进行中的抵债契约。</p>'}
        <div class="merc-repay-grid"><button data-merc-pay="10" ${!debt() || st().gold < 10 ? 'disabled' : ''}>偿还 10G</button><button data-merc-pay="50" ${!debt() || st().gold < 1 ? 'disabled' : ''}>偿还最多 50G</button><button data-merc-pay="half" ${!debt() || st().gold < 1 ? 'disabled' : ''}>偿还一半</button><button data-merc-pay="all" ${!debt() || st().gold < 1 ? 'disabled' : ''}>尽量还清</button></div>
        <section class="merc-active-contract"><small>应急现金借款 · 10% 手续费</small><p>借款会直接进入背包；债务达到上限后不能继续借。</p><div class="merc-repay-grid">${CASH_LOANS.map(value => { const total = value + Math.ceil(value * LOAN_FEE_RATE); return `<button data-merc-borrow="${value}" ${settings().allowAdvance === false || debt() + total > limit() ? 'disabled' : ''}>借 ${value}G · 记债 ${total}G</button>` }).join('')}</div></section>
        <p class="merc-empty">${active ? '解除雇佣前必须先结束当前抵债契约。' : debt() ? `还清剩余 ${debt()}G 后可以解除雇佣。` : '当前没有债务或任务，可以解除雇佣关系。'}</p>`,
      actions: [
        ...(debt() && !active ? [{ label: '查看抵债契约', cls: 'btn-primary', handler: () => { Dialog.close(); showOffers() } }] : []),
        ...(active ? [{ label: '放弃当前契约', cls: 'btn-danger', handler: () => { abandon(false); Dialog.close(); openPanel() } }] : []),
        { label: debt() || active ? '解除雇佣（尚未满足条件）' : '解除雇佣关系', cls: debt() || active ? '' : 'btn-danger', handler: requestDismiss },
        { label: '关闭', handler: () => Dialog.close() },
      ],
    })
    document.querySelectorAll('[data-merc-pay]').forEach(btn => {
      btn.onclick = () => {
        const mode = btn.dataset.mercPay
        const amount = mode === 'all' ? debt() : mode === 'half' ? Math.ceil(debt() / 2) : Number(mode)
        repay(amount)
        Dialog.close(); openPanel()
      }
    })
    document.querySelectorAll('[data-merc-borrow]').forEach(btn => {
      btn.onclick = () => {
        const result = borrowCash(Number(btn.dataset.mercBorrow))
        if (!result.ok) alert(result.msg)
        Dialog.close(); openPanel()
      }
    })
  }

  EventBus.on('state:changed', observeGold)
  EventBus.on('battle:end', onBattleEnd)

  return {
    LIMITS, CASH_LOANS, DIFF_LABEL, PENALTY_LABEL, enabled, limit, debt, tier, addDebt, repay, borrowCash,
    offerAdvance, canFinanceRecruitment, offerRecruitmentFinance, showIntro, openPanel, showOffers, recordService, abandon, dismissMercenary,
    supportAvailable, settings,
  }
})()
