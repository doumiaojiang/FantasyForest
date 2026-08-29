/**
 * systems/restraint-contract.js — 酒馆妖缚委托
 *
 * 委托装备由酒馆暂借并使用契约锁固定。普通钥匙、挣扎、铁匠与 Boss 均不能破坏；
 * 完成指定数量的普通战斗后回酒馆领奖，或支付解约金提前放弃。
 */
window.RestraintContractSystem = (function () {
  const ABANDON_FEE = 20
  const TEMPLATES = [
    { id: 'veiled_path', rank: 'easy', icon: '🙈', name: '蒙眼巡林', desc: '戴着眼罩赢得 2 场普通战斗。', required: 2, rewardGold: 55, gear: [{ slot: 'eyes', id: 'blindfold' }] },
    { id: 'collared_path', rank: 'easy', icon: '🐕', name: '项圈试炼', desc: '戴着奴隶项圈赢得 2 场普通战斗。', required: 2, rewardGold: 60, gear: [{ slot: 'neck', id: 'slave_collar' }] },
    { id: 'chained_steps', rank: 'easy', icon: '⛓️', name: '负链而行', desc: '戴着脚链赢得 2 场普通战斗。', required: 2, rewardGold: 65, gear: [{ slot: 'ankles', id: 'ankle_chains' }] },
    { id: 'iron_march', rank: 'normal', icon: '🔗', name: '铁锁行军', desc: '戴着手铐与脚镣赢得 3 场普通战斗。', required: 3, rewardGold: 110, gear: [{ slot: 'arms', id: 'handcuffs' }, { slot: 'legs', id: 'leg_cuffs' }] },
    { id: 'silent_oath', rank: 'normal', icon: '🤐', name: '沉默誓约', desc: '戴着球形口塞和奴隶项圈赢得 3 场普通战斗。', required: 3, rewardGold: 105, gear: [{ slot: 'mouth', id: 'leather_gag' }, { slot: 'neck', id: 'slave_collar' }] },
    { id: 'bound_hunt', rank: 'hard', icon: '🪢', name: '缚身狩猎', desc: '佩戴反绑束臂器、脚镣与项圈赢得 4 场普通战斗。', required: 4, rewardGold: 175, rewardItem: 'petty_soul_gem', gear: [{ slot: 'arms_heavy', id: 'armbinder' }, { slot: 'legs', id: 'leg_cuffs' }, { slot: 'neck', id: 'slave_collar' }] },
  ]

  function state () { return State.get() }
  function active () { return state()._restraintContract || null }
  function template (id) { return TEMPLATES.find(entry => entry.id === id) || null }

  function ensureOffers () {
    const st = state()
    const valid = Array.isArray(st._restraintContractOffers)
      ? st._restraintContractOffers.filter(id => !!template(id))
      : []
    if (valid.length === 3) return valid.map(template)
    const byRank = ['easy', 'normal', 'hard'].map(rank => TEMPLATES.filter(entry => entry.rank === rank))
    st._restraintContractOffers = byRank.map(pool => pool[Math.floor(Math.random() * pool.length)].id)
    EventBus.emit('state:changed', st)
    return st._restraintContractOffers.map(template)
  }

  function availability (offer) {
    if (!offer) return { ok: false, reason: '委托不存在' }
    if (active()) return { ok: false, reason: '已有进行中的委托' }
    const occupied = offer.gear.filter(entry => RestraintSystem.get(entry.slot))
    if (occupied.length) {
      return { ok: false, reason: `${occupied.map(entry => RestraintSystem.SLOT_NAMES[entry.slot]).join('、')}槽位已占用` }
    }
    const invalid = offer.gear.find(entry => !RestraintSystem.defOf(entry.id))
    if (invalid) return { ok: false, reason: '委托装备数据缺失' }
    return { ok: true, reason: '' }
  }

  function accept (templateId) {
    const offer = template(templateId)
    const available = availability(offer)
    if (!available.ok) return { ok: false, msg: available.reason }
    const st = state()
    const contractId = `rc-${Date.now()}-${Math.floor(Math.random() * 100000)}`
    const equipped = []
    for (const entry of offer.gear) {
      const result = RestraintSystem.equip(entry.slot, entry.id, {
        locked: true,
        lockType: 'contract',
        source: 'restraint_contract',
        difficulty: RestraintSystem.defOf(entry.id).difficulty || 2,
      }, true)
      if (!result.ok) {
        equipped.forEach(done => RestraintSystem.remove(done.slot, true))
        return { ok: false, msg: result.msg || '契约装备穿戴失败' }
      }
      result.device.contractId = contractId
      equipped.push(entry)
    }
    st._restraintContract = {
      id: contractId,
      templateId: offer.id,
      name: offer.name,
      rank: offer.rank,
      required: offer.required,
      progress: 0,
      rewardGold: offer.rewardGold,
      rewardItem: offer.rewardItem || null,
      gear: offer.gear.map(entry => ({ ...entry })),
      ready: false,
      acceptedAt: Date.now(),
    }
    EventBus.emit('ui:log', { text: `📜 已接取妖缚委托「${offer.name}」：赢得 ${offer.required} 场普通战斗后回酒馆领奖。`, type: 'good' })
    EventBus.emit('state:changed', st)
    State.save()
    return { ok: true, contract: st._restraintContract }
  }

  function gearIntact (contract = active()) {
    return !!contract && contract.gear.every(entry => {
      const worn = RestraintSystem.get(entry.slot)
      return worn && worn.id === entry.id && worn.locked && worn.lockType === 'contract' && worn.contractId === contract.id
    })
  }

  function releaseGear (contract) {
    if (!contract || !Array.isArray(contract.gear)) return
    contract.gear.forEach(entry => {
      const worn = RestraintSystem.get(entry.slot)
      if (worn && worn.lockType === 'contract' && worn.contractId === contract.id) {
        RestraintSystem.remove(entry.slot, true)
      }
    })
  }

  function recordBattle (result) {
    const contract = active()
    if (!contract || contract.ready || !result || !result.victory || result.fled || !result.enemyId || result.enemyId === 'spirit_of_forest') return false
    if (!gearIntact(contract)) {
      EventBus.emit('ui:log', { text: `📜 妖缚委托「${contract.name}」的契约装备不完整，本场不计进度。`, type: 'danger' })
      return false
    }
    contract.progress = Math.min(contract.required, contract.progress + 1)
    contract.ready = contract.progress >= contract.required
    EventBus.emit('ui:log', {
      text: contract.ready
        ? `🏅 妖缚委托「${contract.name}」已完成！回雾灯酒馆领取报酬。`
        : `📜 妖缚委托进度：${contract.progress}/${contract.required} 场胜利。`,
      type: contract.ready ? 'good' : 'dim',
    })
    EventBus.emit('state:changed', state())
    State.save()
    return true
  }

  function claim () {
    const st = state()
    const contract = active()
    if (!contract || !contract.ready || contract.progress < contract.required) return { ok: false, msg: '委托尚未完成' }
    releaseGear(contract)
    st.gold += contract.rewardGold
    let itemText = ''
    if (contract.rewardItem) {
      st.inventory.consumables[contract.rewardItem] = (st.inventory.consumables[contract.rewardItem] || 0) + 1
      const item = window.ItemLib && ItemLib.get ? ItemLib.get(contract.rewardItem) : null
      itemText = item ? `，并获得${item.name} ×1` : ''
    }
    st._restraintContractCompleted = (st._restraintContractCompleted || 0) + 1
    st._restraintContract = null
    st._restraintContractOffers = []
    EventBus.emit('ui:log', { text: `🏅 妖缚委托结算：获得 ${contract.rewardGold}G${itemText}，契约装备已回收。`, type: 'good' })
    EventBus.emit('state:changed', st)
    State.save()
    return { ok: true, gold: contract.rewardGold, itemText }
  }

  function abandon () {
    const st = state()
    const contract = active()
    if (!contract) return { ok: false, msg: '当前没有委托' }
    const paid = Math.min(ABANDON_FEE, Math.max(0, st.gold || 0))
    st.gold -= paid
    releaseGear(contract)
    st._restraintContract = null
    st._restraintContractOffers = []
    EventBus.emit('ui:log', { text: `📜 已放弃「${contract.name}」，支付 ${paid}G 解约金，契约装备已回收。`, type: 'dim' })
    EventBus.emit('state:changed', st)
    State.save()
    return { ok: true, paid }
  }

  EventBus.on('battle:end', recordBattle)

  return { TEMPLATES, ABANDON_FEE, active, template, ensureOffers, availability, accept, gearIntact, claim, abandon }
})()
