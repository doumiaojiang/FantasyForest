/**
 * systems/restraint.js — 妖缚装置系统（原创束缚系统）
 *
 * 借鉴 Devious Devices 的玩法思想（身体槽位 + 上锁 + 钥匙 + 挣脱 + 事件联动），
 * 代码、名称、素材全部原创。
 *
 * 槽位：neck 颈部 / mouth 嘴部 / arms 手臂 / legs 腿部 / waist 腰部
 * 解除方式：钥匙（普通/万能）、开锁工具、挣扎、割断（皮革/绳索）、求助铁匠。
 * 防卡死规则：挣扎失败永久 +10% 成功率，失败 3 次后必定成功；剧情锁始终有多条解除路线。
 */

window.RestraintSystem = (function () {
  // 身体槽位（部位图展示）
  const SLOT_ORDER = ['eyes', 'lip', 'face', 'mouth', 'neck', 'chest', 'arms', 'arms_heavy', 'torso', 'outfit', 'waist', 'legs', 'feet', 'ankles', 'anal', 'vagina']
  const SLOT_NAMES = { eyes: '眼部', lip: '口唇妆容', face: '面部妆容', mouth: '嘴部', neck: '颈部', chest: '胸部', arms: '手臂', arms_heavy: '束臂', torso: '躯干', outfit: '服装', waist: '腰部', legs: '腿部', feet: '鞋履', ankles: '脚踝', anal: '菊穴', vagina: '小穴' }
  const SLOT_ICONS = { eyes: '😵', lip: '💄', face: '✨', mouth: '🤐', neck: '🐕', chest: '🎀', arms: '⛓️', arms_heavy: '🪢', torso: '🩱', outfit: '👗', waist: '🔒', legs: '🦶', feet: '👠', ankles: '⛓️', anal: '🍑', vagina: '🌸' }
  const BLADES = ['rusty_knife', 'basic_sword', 'master_sword', 'sharp_rock']
  const VIBRATION_MODES = {
    off: { label: '关闭', icon: '○', serviceRate: 0, distraction: 0, escapePenalty: 0 },
    low: { label: '低档', icon: '〰️', serviceRate: 0.25, distraction: 0.05, escapePenalty: 0.05 },
    high: { label: '高档', icon: '⚡', serviceRate: 0.50, distraction: 0.15, escapePenalty: 0.15 },
  }

  function raw () { return State.get()._restraints || {} }
  function get (slot) { return raw()[slot] || null }
  function defOf (id) {
    const def = (RESTRAINTS || []).find(r => r.id === id)
    if (!def || !def.genderNames) return def
    const gender = State.get().gender === 'male' ? 'male' : 'female'
    return { ...def, name: def.genderNames[gender] || def.name }
  }
  function isWorn (slot) { return !!get(slot) }
  function isLocked (slot) { const d = get(slot); return !!(d && d.locked) }
  function countLocked () { return SLOT_ORDER.filter(isLocked).length }
  function countWorn () { return SLOT_ORDER.filter(isWorn).length }

  /** 上锁装置金币加成：普通 +5%，重型/诅咒 +10%，上限 +30% */
  function goldBonus () {
    let sum = 0
    SLOT_ORDER.forEach(slot => {
      if (!isLocked(slot)) return
      sum += (isHeavy(slot) || isCursed(slot)) ? 0.10 : 0.05
    })
    return Math.min(0.30, sum)
  }

  function isHeavy (slot) {
    const d = get(slot)
    const def = d && defOf(d.id)
    return !!(def && def.heavy)
  }

  function isCursed (slot) {
    const d = get(slot)
    return !!(d && d.lockType === 'cursed')
  }

  function set (slot, device) {
    const r = raw()
    if (device === null) delete r[slot]
    else r[slot] = device
    State.get()._restraints = r
    EventBus.emit('state:changed', State.get())
  }

  function allowedSlotsOf (def) { return def && Array.isArray(def.allowedSlots) ? def.allowedSlots : (def ? [def.slot] : []) }

  function insertChargeMax (def, device) {
    if (!def || !def.insert) return 0
    const count = def.stackable ? Math.max(1, Math.floor(Number(device && device.count) || 1)) : 1
    return Math.max(0, Math.floor(Number(def.block) || 0)) * count
  }

  /** 未穿戴插入装备的充能库存；同 ID 多件装备分别保存。 */
  function storedChargePool () {
    const state = State.get()
    if (!state._storedInsertionCharges || typeof state._storedInsertionCharges !== 'object' || Array.isArray(state._storedInsertionCharges)) {
      state._storedInsertionCharges = {}
    }
    return state._storedInsertionCharges
  }

  function takeStoredInsertion (id) {
    const pool = storedChargePool()
    const list = Array.isArray(pool[id]) ? pool[id] : []
    const stored = list.shift() || null
    if (list.length) pool[id] = list
    else delete pool[id]
    return stored
  }

  function storeInsertion (device, def) {
    if (!device || !def || !def.insert) return
    const pool = storedChargePool()
    const list = Array.isArray(pool[device.id]) ? pool[device.id] : []
    list.push({
      charge: Math.max(0, Math.min(insertChargeMax(def, device), Math.floor(Number(device.charge) || 0))),
      count: def.stackable ? Math.max(1, Math.floor(Number(device.count) || 1)) : 1,
      vibrationMode: def.vibrate && VIBRATION_MODES[device.vibrationMode] ? device.vibrationMode : 'off',
    })
    pool[device.id] = list
  }

  function insertSizeText (def) {
    if (!def || !Number.isFinite(def.sizeCm)) return '未标注'
    if (def.id.includes('butt_plug') || def.dildo) return `${def.sizeCm} cm${def.sizeCm >= 5.2 ? '以上' : '以下'}`
    return `${def.sizeCm} cm`
  }

  function insertDetailsHtml (def, charge, device) {
    const slotLabel = allowedSlotsOf(def).map(s => SLOT_NAMES[s] || s).join(' / ')
    const chargeLimit = def.stackable ? `${def.block} 次/颗` : `${charge.max} 次`
    const bonus = `${def.prostituteBonus} 金币${def.stackable ? '/颗' : ''}`
    const vibration = def.vibrate ? vibrationInfo(device && device.slot) : null
    const vibrationHtml = vibration ? `<span class="restr-vibration mode-${vibration.mode}${vibration.controlEnabled ? '' : ' is-paused'}">
      <b>${VIBRATION_MODES[vibration.mode].icon} 震动：${VIBRATION_MODES[vibration.mode].label}${vibration.controlEnabled ? '' : '（MCM 已暂停）'}</b>
      <small>${vibration.mode === 'off' ? '无额外收益或战斗影响' : `服务额外 +${vibration.serviceExtra}G · 攻击分心 ${Math.round(vibration.distractionChance * 100)}% · 逃跑 -${Math.round(vibration.escapePenalty * 100)}%`}${vibration.locked ? ' · 上锁后无法调档' : ''}</small>
    </span>` : ''
    return `<span class="rpg-gear-details">
      <span class="rpg-gear-kicker">插入装备 · ${slotLabel}</span>
      <span class="rpg-gear-stat"><em>尺寸</em><strong>${insertSizeText(def)}</strong></span>
      <span class="rpg-gear-stat"><em>防护充能</em><strong>可充能 ${chargeLimit}</strong></span>
      <small class="rpg-gear-hint">每点充能完全抵挡一次对应部位的攻击：0 伤害、0 效果</small>
      <span class="rpg-gear-special"><em>特殊</em><strong>酒馆妓女：+${bonus}</strong></span>
      <span class="rpg-gear-warning">🔒 上锁后：酒馆妓女与荣耀洞均不可用</span>
      <span class="restr-charge${charge.current <= 0 ? ' is-empty' : ''}">⚡ 当前充能 ${charge.current}/${charge.max}${charge.current < charge.max ? ' · 去酒馆找附魔师' : ''}</span>
      ${vibrationHtml}
    </span>`
  }

  function gearTone (def) {
    if (def.cosmetic) return 'cosmetic'
    if (def.slot === 'mouth') return 'mouth'
    if (def.buff) return 'service'
    return 'restraint'
  }

  function serviceDetailsHtml (def) {
    const fixed = {
      lipstick: { kind: '妆容装备 · 口唇', stats: [['类型', '口唇妆容'], ['锁具', '不可上锁']], hint: '可以与全套妆容同时装备', special: '酒馆妓女：口交服务 +20 金币' },
      makeup: { kind: '妆容装备 · 面部', stats: [['类型', '全脸妆容'], ['锁具', '不可上锁']], hint: '可以与口红同时装备', special: '酒馆妓女：口交服务 +30 金币' },
      leather_gag: { kind: '口部装备 · 嘴部', stats: [['束缚难度', `${def.difficulty} 级`]], hint: '堵住嘴，口交任务无法完成；战斗口交攻击承受单倍伤害', special: '酒馆妓女：不触发口塞加成', warning: '上锁后：酒馆妓女与荣耀洞均不可用' },
      deepthroat_gag: { kind: '口部装备 · 嘴部', stats: [['束缚难度', `${def.difficulty} 级`]], hint: '固定张口与深喉姿势，口交任务无法完成', special: '酒馆妓女：不触发口塞加成', warning: '上锁后：酒馆妓女与荣耀洞均不可用' },
      slut_gag: { kind: '口部装备 · 嘴部', stats: [['束缚难度', `${def.difficulty} 级`]], hint: '同时佩戴项圈时，插入任务提升到 180 BPM', special: '酒馆妓女与荣耀洞可用；插入任务 160 BPM · 金币 ×2', warning: '开口结构：上锁后仍可进行性服务', allowLockedService: true },
    }[def.id]
    const meta = fixed || {
      kind: `${def.buff ? '服务装备' : (def.heavy ? '重型妖缚装备' : '妖缚装备')} · ${SLOT_NAMES[def.slot] || def.slot}`,
      stats: [['束缚难度', `${def.difficulty || 1} 级`]],
      hint: def.story ? '剧情装备，只能通过对应剧情解除' : (def.heavy ? '重型装备，挣脱与解除更加困难' : '可以穿戴，也可以使用普通锁主动上锁'),
      special: def.desc,
    }
    return `<span class="rpg-gear-details">
      <span class="rpg-gear-kicker">${meta.kind}</span>
      ${meta.stats.map(([label, value]) => `<span class="rpg-gear-stat"><em>${label}</em><strong>${value}</strong></span>`).join('')}
      <small class="rpg-gear-hint">${meta.hint}</small>
      <span class="rpg-gear-special"><em>特殊</em><strong>${meta.special}</strong></span>
      ${meta.warning ? `<span class="rpg-gear-warning${meta.allowLockedService ? ' is-allowed' : ''}">${meta.allowLockedService ? '✓' : '🔒'} ${meta.warning}</span>` : ''}
    </span>`
  }

  /** 该装置在当前性别下的最大拥有数（男性一律 1） */
  function effectiveMaxOwn (def) {
    const max = def && def.maxOwn ? def.maxOwn : 1
    return State.get().gender === 'male' ? 1 : max
  }

  /** 已穿戴在某部位的该装置数量 */
  function wornCountOf (id) {
    return SLOT_ORDER.filter(slot => { const d = get(slot); return d && d.id === id }).length
  }

  /** 检查装置是否能穿到指定部位。 */
  function canEquip (slot, id) {
    const def = defOf(id)
    if (!def) return { ok: false, msg: '装置不存在' }
    if (!allowedSlotsOf(def).includes(slot)) return { ok: false, msg: `${def.name}不能装备到${SLOT_NAMES[slot] || '该部位'}` }
    const state = State.get()
    if (def.femaleOnly && state.gender === 'male') return { ok: false, msg: `${def.name}仅限女性使用` }
    if (def.maleOnly && state.gender !== 'male') return { ok: false, msg: `${def.name}仅限男性使用` }
    if (slot === 'vagina' && state.gender === 'male') return { ok: false, msg: '男性没有可用的小穴槽位' }
    if (slot === 'vagina' && hasWaistChastity()) return { ok: false, msg: '小穴被贞操带阻挡，无法插入装备' }
    // 已装备数量小于已拥有数量时，允许同 ID 装备到另一部位（如女性同尺寸 2 根假阳具）
    if (wornCountOf(id) >= ownedCount(id)) {
      return { ok: false, msg: wornCountOf(id) > 0 ? `${def.name}已全部穿戴（${wornCountOf(id)}/${ownedCount(id)}）` : `${def.name}已经装备在其他部位` }
    }
    return { ok: true }
  }

  /** 佩戴装置（可上锁或普通佩戴）；force=true 可覆盖已有槽位 */
  function equip (slot, id, opts = {}, force = false) {
    if (!force && get(slot)) return { ok: false, msg: '该部位已经锁着东西了' }
    const def = defOf(id)
    if (!def) return { ok: false, msg: '装置不存在' }
    if (!force) {
      const check = canEquip(slot, id)
      if (!check.ok) return check
    } else if (!allowedSlotsOf(def).includes(slot)) {
      return { ok: false, msg: `${def.name}不能装备到${SLOT_NAMES[slot] || '该部位'}` }
    }
    // 贞操类占用腰部并封住小穴；强制装备时也必须先取出小穴装备。
    if (def.effect === 'chastity' && get('vagina')) {
      remove('vagina')
      EventBus.emit('ui:log', { text: '🔒 贞操带合拢前，小穴里的插入装备被迫取出。', type: 'danger' })
    }
    const storedInsertion = def.insert ? takeStoredInsertion(id) : null
    const storedCount = storedInsertion && def.stackable ? storedInsertion.count : 1
    const device = {
      id, slot,
      locked: !!opts.locked,
      lockType: opts.lockType || 'common',
      difficulty: opts.difficulty || def.difficulty || 3,
      material: def.material,
      source: opts.source || 'self',
      escapeBonus: 0,
      jammed: !!opts.jammed,
      count: def.stackable ? Math.max(1, Math.min(ownedCount(id), Math.floor(Number(opts.count) || storedCount || 1))) : 1,
    }
    if (def.vibrate) {
      const savedMode = opts.vibrationMode || (storedInsertion && storedInsertion.vibrationMode)
      device.vibrationMode = VIBRATION_MODES[savedMode] ? savedMode : 'off'
    }
    if (def.insert) {
      const state = State.get()
      if (!state._insertionCharges || typeof state._insertionCharges !== 'object') state._insertionCharges = {}
      const legacyCharge = Number.isFinite(state._insertionCharges[slot]) ? state._insertionCharges[slot] : 0
      device.charge = Math.max(0, Math.min(insertChargeMax(def, device), storedInsertion ? storedInsertion.charge : legacyCharge))
      state._insertionCharges[slot] = device.charge
      const combat = state._battle || state._ambush
      if (combat && combat.insertionBlocks && typeof combat.insertionBlocks === 'object') {
        combat.insertionBlocks[slot] = device.charge
        combat.blocked = Math.max(0, (combat.insertionBlocks.anal || 0) + (combat.insertionBlocks.vagina || 0))
      }
    }
    set(slot, device)
    return { ok: true, device }
  }

  /** 直接还原一个装置对象（监狱恢复用） */
  function restore (slot, device) {
    set(slot, device)
  }

  function isContractLock (slot) {
    const d = get(slot)
    return !!(d && d.locked && ['contract', 'mercenary_contract'].includes(d.lockType))
  }

  function remove (slot, force = false) {
    const d = get(slot)
    if (!d) return { ok: false, msg: '这里没有装置' }
    if (!force && isContractLock(slot)) return { ok: false, msg: '契约锁只能在对应契约面板结算或解约' }
    const def = defOf(d.id)
    storeInsertion(d, def)
    if (def && def.insert) {
      const state = State.get()
      if (!state._insertionCharges || typeof state._insertionCharges !== 'object') state._insertionCharges = {}
      state._insertionCharges[slot] = 0
      const combat = state._battle || state._ambush
      if (combat && combat.insertionBlocks && typeof combat.insertionBlocks === 'object') {
        combat.insertionBlocks[slot] = 0
        combat.blocked = Math.max(0, (combat.insertionBlocks.anal || 0) + (combat.insertionBlocks.vagina || 0))
      }
    }
    set(slot, null)
    // 贪婪恶魔依附在胸部装置上；主动脱下或解锁取下时，金币翻倍同步结束。
    if ((d.source === 'greed_demon' || d.greedBound) && typeof StatusSystem !== 'undefined') {
      StatusSystem.remove('greed_demon')
      EventBus.emit('ui:log', { text: '😈 乳夹被取下，贪婪恶魔离开了；金币不再翻倍。', type: 'dim' })
    }
    // 同步旧酒馆用品标志：脱下后清除，避免读档时又被迁移回去
    const st = State.get()
    if (st._prostituteGear) {
      const GEAR_FLAG = { chastity_device: 'chastity', vibrating_chastity: 'chastity', lipstick: 'lipstick', makeup: 'makeup', heels: 'heels', lingerie: 'lingerie', latex: 'latex', slut_collar: 'collar', slut_gag: 'gag', butt_plug: 'buttplug', medium_butt_plug: 'buttplug' }
      if (GEAR_FLAG[d.id]) st._prostituteGear[GEAR_FLAG[d.id]] = false
    }
    return { ok: true, msg: '已脱下' }
  }

  /** 玩家使用普通锁，主动锁住一件已穿戴的妖缚装备。 */
  function lockDevice (slot) {
    const d = get(slot)
    const def = d && defOf(d.id)
    if (!d || !def) return { ok: false, msg: '这里没有可上锁的装置' }
    if (d.locked) return { ok: false, msg: '这件装置已经上锁' }
    if (def.cosmetic) return { ok: false, msg: '妆容不能上锁' }
    if (def.story) return { ok: false, msg: '剧情装备不能手动上锁' }
    const inv = State.get().inventory.consumables
    if ((inv.restraint_lock || 0) <= 0) return { ok: false, msg: '没有普通锁，请到梦幻商店购买' }
    inv.restraint_lock--
    d.locked = true
    d.lockType = 'common'
    d.source = 'self_locked'
    d.escapeBonus = 0
    d.jammed = false
    delete d.timer
    EventBus.emit('ui:log', { text: `🔒 你用普通锁锁住了${def.name}。`, type: 'danger' })
    EventBus.emit('state:changed', State.get())
    return { ok: true, msg: '装置已上锁' }
  }

  /** 是否剧情锁（只能剧情解除） */
  function isStory (slot) {
    const d = get(slot)
    const def = d && defOf(d.id)
    return !!(def && def.story)
  }

  /* ---------- 解除方式 ---------- */

  /** 能否用刃具割断（仅皮革/绳索，且未卡死） */
  function canCut (slot) {
    const d = get(slot)
    if (!d || !d.locked || d.jammed) return false
    if (isContractLock(slot)) return false
    if (isStory(slot)) return false
    const def = defOf(d.id)
    if (def && def.material === 'metal') return false
    return BLADES.includes(State.get().inventory.weapon)
  }

  function cut (slot) {
    const d = get(slot)
    if (!d) return { ok: false, msg: '这里没有装置' }
    if (isContractLock(slot)) return { ok: false, msg: '契约锁受魔法保护，无法割断' }
    if (!d.locked) { remove(slot); return { ok: true, msg: '已脱下' } }
    if (isCursed(slot)) return { ok: false, msg: '诅咒锁割不断，需要驱咒符' }
    if (!canCut(slot)) return { ok: false, msg: '需要尖石/刀/剑割断皮革或绳索' }
    remove(slot)
    EventBus.emit('ui:log', { text: '🔪 你用刃具割断了束缚，装置脱落。', type: 'good' })
    return { ok: true, msg: '割断了装置' }
  }

  /** 挣扎：成功率 25% 起，失败永久 +10%，失败 3 次后必定成功 */
  function struggle (slot) {
    const d = get(slot)
    if (!d) return { ok: false, msg: '这里没有装置' }
    if (isContractLock(slot)) return { ok: false, msg: '契约锁不会因挣扎松动；请完成委托或回酒馆解约' }
    if (!d.locked) { remove(slot); return { ok: true, msg: '已脱下' } }
    if (isStory(slot)) return { ok: false, msg: '剧情锁只能通过对应剧情解除' }
    if (d.jammed) return { ok: false, msg: '锁卡住了，挣扎没用' }
    if (isCursed(slot)) return { ok: false, msg: '诅咒缠身，挣扎毫无作用' }
    const bonus = d.escapeBonus || 0
    const rate = 25 + bonus
    const roll = Math.random() * 100
    if (roll < rate || bonus >= 30) {
      remove(slot)
      EventBus.emit('ui:log', { text: '💪 你拼命挣扎，终于从束缚里脱了出来！', type: 'good' })
      return { ok: true, msg: '挣脱成功' }
    }
    d.escapeBonus = bonus + 10
    EventBus.emit('state:changed', State.get())
    EventBus.emit('ui:log', { text: `⛓️ 挣扎失败，锁得更紧了（下次成功率提升至 ${25 + d.escapeBonus}%）。`, type: 'danger' })
    return { ok: false, msg: `挣脱失败，下次成功率 ${25 + d.escapeBonus}%` }
  }

  /** 使用钥匙：普通钥匙优先开普通锁，万能钥匙兜底 */
  function useKey (slot) {
    const d = get(slot)
    if (!d || !d.locked) return { ok: false, msg: '这里没有上锁的装置' }
    if (isContractLock(slot)) return { ok: false, msg: '普通钥匙打不开契约锁' }
    if (isCursed(slot)) return { ok: false, msg: '诅咒锁钥匙打不开，需要驱咒符' }
    if (isStory(slot)) return { ok: false, msg: '剧情锁只能走剧情解除' }
    const inv = State.get().inventory.consumables
    if ((inv.restraint_key || 0) <= 0 && (inv.master_key || 0) <= 0) return { ok: false, msg: '没有钥匙' }
    if ((inv.restraint_key || 0) > 0) inv.restraint_key--
    else inv.master_key--
    remove(slot)
    EventBus.emit('ui:log', { text: '🔑 钥匙咔哒一声，锁开了，装置脱落。', type: 'good' })
    EventBus.emit('state:changed', State.get())
    return { ok: true, msg: '用钥匙解开了' }
  }

  /** 开锁工具：60% 成功，失败损耗（诅咒锁无效） */
  function useLockpick (slot) {
    const d = get(slot)
    if (!d || !d.locked) return { ok: false, msg: '这里没有上锁的装置' }
    if (isContractLock(slot)) return { ok: false, msg: '契约锁没有可撬开的机械锁芯' }
    if (isCursed(slot)) return { ok: false, msg: '诅咒锁撬不动，需要驱咒符' }
    const inv = State.get().inventory.consumables
    if ((inv.lockpick || 0) <= 0) return { ok: false, msg: '没有开锁工具' }
    if (isStory(slot)) return { ok: false, msg: '剧情锁撬不动' }
    inv.lockpick--
    if (Math.random() < 0.6) {
      remove(slot)
      EventBus.emit('ui:log', { text: '🛠️ 开锁工具探进锁孔，咔哒一声成功了！', type: 'good' })
      EventBus.emit('state:changed', State.get())
      return { ok: true, msg: '撬锁成功' }
    }
    EventBus.emit('ui:log', { text: '🛠️ 撬锁失败，工具报废了。', type: 'danger' })
    EventBus.emit('state:changed', State.get())
    return { ok: false, msg: '撬锁失败，工具报废' }
  }

  /** 驱咒符：解除一件诅咒锁 */
  function useCurseRemover (slot) {
    const d = get(slot)
    if (!d || !d.locked) return { ok: false, msg: '这里没有上锁的装置' }
    if (isContractLock(slot)) return { ok: false, msg: '契约锁不是诅咒，驱咒符无效' }
    if (!isCursed(slot)) return { ok: false, msg: '这没被诅咒，驱咒符没用' }
    const inv = State.get().inventory.consumables
    if ((inv.curse_remover || 0) <= 0) return { ok: false, msg: '没有驱咒符' }
    inv.curse_remover--
    remove(slot)
    EventBus.emit('ui:log', { text: '🧿 驱咒符化为一缕青烟，诅咒连同锁一起散去了！', type: 'good' })
    EventBus.emit('state:changed', State.get())
    return { ok: true, msg: '诅咒解除了' }
  }

  /* ---------- 定时锁 ---------- */

  /** 设置定时锁：剩余回合数（移动/战斗回合都会递减，到 0 自动解开） */
  function setTimer (slot, rounds) {
    const d = get(slot)
    if (!d) return
    d.timer = Math.max(1, Math.floor(rounds))
    EventBus.emit('state:changed', State.get())
  }

  /** 每回合递减定时锁；返回自动解开的槽位 */
  function tickTimers () {
    const unlocked = []
    SLOT_ORDER.forEach(slot => {
      const d = get(slot)
      if (!d || !d.locked || !d.timer) return
      d.timer--
      if (d.timer <= 0) {
        delete d.timer
        remove(slot)
        unlocked.push(slot)
      }
    })
    if (unlocked.length) {
      EventBus.emit('ui:log', { text: `⏲️ 定时锁到点自动打开：${unlocked.map(s => SLOT_NAMES[s]).join('、')}的束缚脱落了。`, type: 'good' })
      EventBus.emit('state:changed', State.get())
    }
    return unlocked
  }

  /* ---------- NPC 帮助 ---------- */

  function npcUnlockCost (slot) {
    const d = get(slot)
    if (!d) return 0
    const def = defOf(d.id)
    const base = (def && def.material === 'metal') ? 250 : 150
    const cursed = isCursed(slot) ? 3 : 1
    const jammed = d.jammed ? 2 : 1
    return base * cursed * jammed
  }

  function npcUnlock (slot) {
    const d = get(slot)
    if (!d) return { ok: false, msg: '这里没有装置' }
    if (isContractLock(slot)) return { ok: false, msg: '铁匠拒绝破坏契约锁；请回对应契约面板处理' }
    if (!d.locked) { remove(slot); return { ok: true, msg: '已脱下' } }
    if (isStory(slot)) return { ok: false, msg: '这是剧情锁，只有剧情能解除（攒积分出狱或铁匠契约）' }
    const state = State.get()
    const wasCursed = isCursed(slot)
    const cost = npcUnlockCost(slot)
    if (state.gold < cost) return { ok: false, msg: `钱不够（需要 ${cost}G）` }
    state.gold -= cost
    remove(slot)
    EventBus.emit('ui:log', { text: wasCursed ? `🧿 铁匠连拆带驱，收了 ${cost}G，解开了诅咒锁。` : `🔓 铁匠收了 ${cost}G，帮你解开了束缚。`, type: 'good' })
    EventBus.emit('state:changed', state)
    return { ok: true, msg: '铁匠帮忙解开了' }
  }

  /* ---------- 效果查询 ---------- */

  function hasEffect (eff) {
    return SLOT_ORDER.some(slot => {
      const d = get(slot)
      const def = d && defOf(d.id)
      return !!(def && def.effect === eff)
    })
  }

  function hasGag () { return hasEffect('gag') }
  function hasHandcuffs () { return hasEffect('handcuffs') }
  function hasLegCuffs () { return hasEffect('leg_cuffs') }
  function hasCollar () { return hasEffect('collar') }
  function hasArmbinder () { return hasEffect('armbinder') }
  function hasBlindfold () { return hasEffect('blindfold') }
  function hasWaistChastity () {
    const d = get('waist')
    const def = d && defOf(d.id)
    return !!(def && def.effect === 'chastity')
  }
  /** 双手受限（手铐或反绑束臂器）：无法使用物品 */
  function hasHandsBlocked () { return hasHandcuffs() || hasArmbinder() }
  function hasNipple () { return hasEffect('nipple') }
  function hasCorset () { return hasEffect('corset') }
  function hasAnkleChains () { return hasEffect('ankle_chains') }
  /** 是否正穿着某件装置（按装置 id；含妆容栏） */
  function hasDevice (id) {
    return SLOT_ORDER.some(slot => { const d = get(slot); return d && d.id === id })
  }
  function ownedCount (id) {
    const def = defOf(id)
    const state = State.get()
    const owned = Array.isArray(state._ownedRestraints) && state._ownedRestraints.includes(id)
    if (!def) return (owned || hasDevice(id)) ? 1 : 0
    if (def.stackable || (def.maxOwn && def.maxOwn > 1)) {
      state._ownedRestraintCounts = state._ownedRestraintCounts && typeof state._ownedRestraintCounts === 'object' ? state._ownedRestraintCounts : {}
      const saved = Math.max(0, Math.floor(Number(state._ownedRestraintCounts[id]) || 0))
      const max = def.stackable ? (def.maxStack || 99) : effectiveMaxOwn(def)
      return Math.min(max, Math.max((owned || hasDevice(id)) ? 1 : 0, saved))
    }
    return (owned || hasDevice(id)) ? 1 : 0
  }
  function grant (id, amount = 1) {
    const def = defOf(id)
    if (!def || def.story) return { ok: false, msg: '装置不存在或不能获得' }
    const state = State.get()
    state._ownedRestraints = Array.isArray(state._ownedRestraints) ? state._ownedRestraints : []
    if (def.stackable || (def.maxOwn && def.maxOwn > 1)) {
      state._ownedRestraintCounts = state._ownedRestraintCounts && typeof state._ownedRestraintCounts === 'object' ? state._ownedRestraintCounts : {}
      const before = ownedCount(id)
      const max = def.stackable ? (def.maxStack || 99) : effectiveMaxOwn(def)
      const after = Math.min(max, before + Math.max(1, Math.floor(Number(amount) || 1)))
      if (!state._ownedRestraints.includes(id)) state._ownedRestraints.push(id)
      state._ownedRestraintCounts[id] = after
      EventBus.emit('state:changed', state)
      return { ok: true, owned: before >= max, full: after >= max, count: after, added: after - before, def }
    }
    if (state._ownedRestraints.includes(id) || hasDevice(id)) return { ok: true, owned: true, def }
    state._ownedRestraints.push(id)
    EventBus.emit('state:changed', state)
    return { ok: true, owned: false, def }
  }
  function adjustStack (slot, delta) {
    const d = get(slot)
    const def = d && defOf(d.id)
    if (!d || !def || !def.stackable) return { ok: false, msg: '这里没有可按数量调整的装备' }
    if (d.locked) return { ok: false, msg: '上锁后不能调整数量' }
    const max = Math.min(def.maxStack || 99, ownedCount(d.id))
    const current = Math.max(1, Math.min(max, Math.floor(Number(d.count) || 1)))
    const next = Math.max(1, Math.min(max, current + Math.sign(Number(delta) || 0)))
    if (next === current) return { ok: false, msg: delta > 0 ? `最多只能塞入 ${max} 颗` : '只剩 1 颗；要全部取出请点“全部取出”' }
    d.count = next
    if (!State.get()._insertionCharges || typeof State.get()._insertionCharges !== 'object') State.get()._insertionCharges = {}
    const nextMax = Math.max(0, def.block || 0) * next
    State.get()._insertionCharges[slot] = Math.min(nextMax, Math.max(0, State.get()._insertionCharges[slot] || 0))
    EventBus.emit('state:changed', State.get())
    return { ok: true, msg: delta > 0 ? `又塞入 1 颗${def.name}，现在共 ${next} 颗` : `取出 1 颗${def.name}，还剩 ${next} 颗`, count: next }
  }
  function insertionDevice (slot) {
    const d = get(slot)
    const def = d && defOf(d.id)
    return def && def.insert ? { device: d, def } : null
  }
  function insertionBlocks () {
    const result = { anal: 0, vagina: 0 }
    ;['anal', 'vagina'].forEach(slot => {
      const entry = insertionDevice(slot)
      if (!entry) return
      const max = insertChargeMax(entry.def, entry.device)
      const stored = entry.device.charge
      result[slot] = Math.max(0, Math.min(max, Number.isFinite(stored) ? stored : 0))
    })
    return result
  }
  /** 插入装备的持久防护充能；战斗中优先读取本场同步值。 */
  function insertionCharge (slot) {
    const entry = insertionDevice(slot)
    if (!entry) return null
    const max = insertChargeMax(entry.def, entry.device)
    const state = State.get()
    const combat = state._battle || state._ambush
    const combatStored = combat && combat.insertionBlocks && typeof combat.insertionBlocks === 'object'
      ? combat.insertionBlocks[slot]
      : null
    const saved = entry.device.charge
    const current = combat
      ? Math.max(0, Math.min(max, Number.isFinite(combatStored) ? combatStored : 0))
      : Math.max(0, Math.min(max, Number.isFinite(saved) ? saved : 0))
    return { current, max, inCombat: !!combat }
  }
  function setInsertionCharge (slot, value) {
    const info = insertionCharge(slot)
    if (!info) return { ok: false, msg: '该部位没有插入装备' }
    const state = State.get()
    if (!state._insertionCharges || typeof state._insertionCharges !== 'object') state._insertionCharges = {}
    const next = Math.max(0, Math.min(info.max, Math.floor(Number(value) || 0)))
    const entry = insertionDevice(slot)
    if (entry) entry.device.charge = next
    state._insertionCharges[slot] = next
    const combat = state._battle || state._ambush
    if (combat && combat.insertionBlocks) {
      combat.insertionBlocks[slot] = next
      combat.blocked = Math.max(0, (combat.insertionBlocks.anal || 0) + (combat.insertionBlocks.vagina || 0))
    }
    EventBus.emit('state:changed', state)
    return { ok: true, current: next, max: info.max }
  }
  /** 当前震动装备档位与统一收益/风险；关闭 MCM 时保留所选档位但暂停效果。 */
  function vibrationInfo (slot = 'vagina') {
    const entry = insertionDevice(slot)
    if (!entry || !entry.def.vibrate) return null
    const configuredMode = VIBRATION_MODES[entry.device.vibrationMode] ? entry.device.vibrationMode : 'off'
    const controlEnabled = settings().vibrationControl !== false
    const mode = controlEnabled ? configuredMode : 'off'
    const rule = VIBRATION_MODES[mode]
    const count = entry.def.stackable ? Math.max(1, Math.floor(Number(entry.device.count) || 1)) : 1
    const baseBonus = Math.max(0, Number(entry.def.prostituteBonus) || 0) * count
    const inCombat = !!(State.get()._battle || State.get()._ambush || ['battle', 'boss'].includes(State.get().phase))
    return {
      slot, device: entry.device, def: entry.def, configuredMode, mode, controlEnabled,
      count, locked: !!entry.device.locked, inCombat,
      serviceExtra: Math.round(baseBonus * rule.serviceRate),
      distractionChance: rule.distraction,
      escapePenalty: rule.escapePenalty,
      adjustable: controlEnabled && !entry.device.locked && !inCombat,
    }
  }

  function setVibrationMode (slot, mode) {
    const info = vibrationInfo(slot)
    if (!info) return { ok: false, msg: '该部位没有可调档的震动装备' }
    if (!VIBRATION_MODES[mode]) return { ok: false, msg: '未知震动档位' }
    if (!info.controlEnabled) return { ok: false, msg: '震动控制玩法已在妖缚 MCM 中关闭' }
    if (info.locked) return { ok: false, msg: '装备已经上锁，无法手动调整震动档位' }
    if (info.inCombat) return { ok: false, msg: '战斗已经开始，现在无法调整震动档位' }
    info.device.vibrationMode = mode
    const rule = VIBRATION_MODES[mode]
    EventBus.emit('ui:log', { text: `${rule.icon} ${info.def.name}已切换为${rule.label}${mode === 'off' ? '。' : `：服务收入提高，但攻击和逃跑会受到影响。`}`, type: mode === 'high' ? 'danger' : mode === 'low' ? 'dim' : 'good' })
    EventBus.emit('state:changed', State.get())
    State.save()
    return { ok: true, msg: `已切换为${rule.label}`, mode }
  }

  function vibrationServiceBonus (slot = 'vagina') {
    const info = vibrationInfo(slot)
    return info && !info.locked ? info.serviceExtra : 0
  }

  function vibrationDistraction (random = Math.random) {
    const info = vibrationInfo('vagina')
    if (!info || info.distractionChance <= 0) return { triggered: false, chance: 0, mode: 'off' }
    const triggered = Math.max(0, Math.min(1, Number(random()) || 0)) < info.distractionChance
    return { triggered, chance: info.distractionChance, mode: info.mode, name: info.def.name }
  }

  function vibrationEscapePenalty () {
    const info = vibrationInfo('vagina')
    return info ? info.escapePenalty : 0
  }

  function insertionProstituteBonus () {
    return ['anal', 'vagina'].reduce((sum, slot) => {
      const entry = insertionDevice(slot)
      if (!entry || entry.device.locked) return sum
      const base = Math.max(0, entry.def.prostituteBonus || 0) * (entry.def.stackable ? Math.max(1, entry.device.count || 1) : 1)
      return sum + base + (entry.def.vibrate ? vibrationServiceBonus(slot) : 0)
    }, 0)
  }
  /** 酒馆禁止携带上锁的插入装备工作。 */
  function lockedInsertionDevices () {
    return ['anal', 'vagina'].map(slot => {
      const entry = insertionDevice(slot)
      return entry && entry.device.locked ? { slot, ...entry } : null
    }).filter(Boolean)
  }
  /** 酒馆与荣耀洞共用：上锁的口部或插入装备会阻止性服务。 */
  function lockedServiceDevices () {
    return ['mouth', 'anal', 'vagina'].map(slot => {
      const device = get(slot)
      const def = device && defOf(device.id)
      if (!device || !def || !device.locked) return null
      if (slot === 'mouth' && def.id === 'slut_gag') return null
      if (slot !== 'mouth' && !def.insert) return null
      return { slot, device, def }
    }).filter(Boolean)
  }

  /** 普通怪物战：处理被口部/插入装备占用的攻击目标。 */
  function resolveMonsterOrifice (originalPart, random = Math.random, options = {}) {
    if (!['oral', 'anal', 'vagina'].includes(originalPart)) return { mode: 'original', part: originalPart, events: [] }
    const state = State.get()
    const rules = settings()
    const events = []
    const label = { oral: '嘴穴', anal: '菊穴', vagina: '小穴' }

    const inspect = (part, mutate) => {
      if (part === 'vagina' && (state.gender === 'male' || hasWaistChastity())) {
        return { available: false, reason: 'sealed', name: state.gender === 'male' ? '身体结构' : '贞操装备' }
      }
      if (part === 'oral') {
        const mouth = get('mouth')
        const mouthDef = mouth && defOf(mouth.id)
        if (mouthDef && mouthDef.id !== 'slut_gag') return { available: false, reason: 'sealed', name: mouthDef.name }
        return { available: true }
      }
      const entry = insertionDevice(part)
      if (!entry) return { available: true }
      const charge = insertionCharge(part)
      if (charge && charge.current > 0) {
        if (mutate) {
          setInsertionCharge(part, charge.current - 1)
          const notice = chargeNoticeText(entry.def.name, charge.current - 1, charge.max)
          if (notice) events.push(notice)
        }
        return { available: false, reason: 'charged', name: entry.def.name }
      }
      if (entry.device.locked) return { available: false, reason: 'locked', name: entry.def.name }
      if (mutate) {
        remove(part)
        events.push(`💥 怪物拔掉了已经失效且未上锁的${entry.def.name}`)
      }
      return { available: true, removed: true, name: entry.def.name }
    }

    const original = inspect(originalPart, true)
    if (original.available) return { mode: original.removed ? 'removed' : 'original', part: originalPart, from: originalPart, events }
    if (original.reason === 'charged') return { mode: 'blocked', part: originalPart, from: originalPart, events }
    if (original.reason === 'locked') events.push(`🔒 ${original.name}已经上锁，怪物无法拔出`)
    if (original.reason === 'sealed') events.push(`🚫 ${label[originalPart]}被${original.name}挡住`)

    const candidates = ['oral', 'anal']
    if (state.gender !== 'male') candidates.push('vagina')
    const available = rules.redirectAttacks
      ? candidates.filter(part => part !== originalPart && inspect(part, false).available)
      : []
    if (!available.length) {
      const battle = state._battle
      if (options.boss && rules.bossForcedUnlock && battle && !battle.bossForcedUnlockUsed) {
        const forcedTargets = []
        candidates.forEach(part => {
          let slot = part === 'oral' ? 'mouth' : part
          let device = get(slot)
          let def = device && defOf(device.id)
          if (part === 'vagina' && !device && hasWaistChastity()) {
            slot = 'waist'
            device = get(slot)
            def = device && defOf(device.id)
          }
          if (!device || !def || !device.locked || device.jammed || isStory(slot) || isCursed(slot) || isContractLock(slot)) return
          const blocksPart = part === 'oral'
            ? def.id !== 'slut_gag'
            : part === 'anal'
              ? !!def.insert
              : slot === 'waist' ? def.effect === 'chastity' : !!def.insert
          if (!blocksPart) return
          forcedTargets.push({ part, slot, device, def })
        })
        if (forcedTargets.length) {
          const preferred = forcedTargets.find(target => target.part === originalPart)
          const target = preferred || forcedTargets[Math.min(forcedTargets.length - 1, Math.floor(Math.max(0, Number(random()) || 0) * forcedTargets.length))]
          battle.bossForcedUnlockUsed = true
          remove(target.slot)
          events.push(`🌿 森林之灵发动「藤蔓破锁」，强行破坏了${target.def.name}的普通锁并拔下装备`)
          events.push(`↪️ ${label[target.part]}重新暴露，召唤怪物继续原攻击`)
          return { mode: 'forced_unlock', part: target.part, from: originalPart, removed: true, events }
        }
      }
      events.push('🍑 所有可用部位都被挡住，怪物改为打屁股')
      return { mode: 'spank', part: 'body', from: originalPart, events }
    }

    const index = Math.min(available.length - 1, Math.floor(Math.max(0, Number(random()) || 0) * available.length))
    const nextPart = available[index]
    const next = inspect(nextPart, true)
    events.push(`↪️ 怪物放弃${label[originalPart]}，改攻${label[nextPart]}`)
    return { mode: 'redirect', part: nextPart, from: originalPart, removed: next.removed, events }
  }

  /**
   * 城镇/NPC 服务：上锁的封口与插入装备不能使用，改走其他可用部位。
   * 与怪物攻击不同，这里不消耗防护充能，也不会擅自拔掉玩家装备。
   */
  function resolveServiceOrifice (originalPart, random = Math.random) {
    if (!['oral', 'anal', 'vagina'].includes(originalPart)) return { mode: 'original', part: originalPart, events: [] }
    const state = State.get()
    const events = []
    const label = { oral: '嘴穴', anal: '菊穴', vagina: '小穴' }

    const inspect = part => {
      if (part === 'vagina' && state.gender === 'male') return { available: false, name: '身体结构' }
      if (part === 'vagina' && hasWaistChastity()) return { available: false, name: '贞操装备' }
      if (part === 'oral') {
        const mouth = get('mouth')
        const def = mouth && defOf(mouth.id)
        if (mouth && mouth.locked && def && def.id !== 'slut_gag') return { available: false, name: def.name }
        return { available: true }
      }
      const entry = insertionDevice(part)
      if (entry && entry.device.locked) return { available: false, name: entry.def.name }
      return { available: true }
    }

    const original = inspect(originalPart)
    if (original.available) return { mode: 'original', part: originalPart, from: originalPart, events }
    events.push(`🔒 ${label[originalPart]}被${original.name}锁住，无法用于这次服务`)

    const candidates = ['oral', 'anal']
    if (state.gender !== 'male') candidates.push('vagina')
    const available = candidates.filter(part => part !== originalPart && inspect(part).available)
    if (!available.length) {
      events.push('🚫 嘴穴、菊穴和小穴都无法使用，这次服务无法进行')
      return { mode: 'unavailable', part: null, from: originalPart, events }
    }
    const index = Math.min(available.length - 1, Math.floor(Math.max(0, Number(random()) || 0) * available.length))
    const nextPart = available[index]
    events.push(`↪️ 改用${label[nextPart]}完成服务`)
    return { mode: 'redirect', part: nextPart, from: originalPart, events }
  }
  /** 上锁槽位列表 */
  function lockedSlots () { return SLOT_ORDER.filter(isLocked) }

  /* ---------- 设置 ---------- */

  function settings () {
    const st = State.get()
    if (!st._restraintSettings || typeof st._restraintSettings !== 'object') st._restraintSettings = {}
    st._restraintSettings.allowTrap = st._restraintSettings.allowTrap !== false
    st._restraintSettings.trapAutoLock = st._restraintSettings.trapAutoLock !== false
    st._restraintSettings.redirectAttacks = st._restraintSettings.redirectAttacks !== false
    st._restraintSettings.bossForcedUnlock = st._restraintSettings.bossForcedUnlock !== false
    st._restraintSettings.vibrationControl = st._restraintSettings.vibrationControl !== false
    st._restraintSettings.chargeNotice = ['detail', 'compact', 'off'].includes(st._restraintSettings.chargeNotice)
      ? st._restraintSettings.chargeNotice
      : 'detail'
    return st._restraintSettings
  }

  function chargeNoticeText (deviceName, left, max) {
    const mode = settings().chargeNotice
    if (mode === 'off') return ''
    if (mode === 'compact') return `⚡ ${deviceName}充能 -1（${left}/${max}）`
    return `⚡ ${deviceName}消耗 1 点充能，完全抵挡本次攻击与效果（剩余 ${left}/${max}）`
  }

  function toggleTrap () {
    const s = settings()
    s.allowTrap = !s.allowTrap
    EventBus.emit('state:changed', State.get())
    return s.allowTrap
  }

  /** 一键脱下所有未上锁装置 */
  function removeAllUnlocked () {
    let n = 0
    SLOT_ORDER.forEach(slot => {
      const d = get(slot)
      if (d && !d.locked) { set(slot, null); n++ }
    })
    if (n) EventBus.emit('ui:log', { text: `✋ 脱下 ${n} 件未上锁的妖缚装置。`, type: 'good' })
    return n
  }

  /** 身体部位图（装备栏顶部）：显示每个槽位穿了什么/空着 */
  function bodyDiagram () {
    return `<div class="restr-body">${SLOT_ORDER.map(slot => {
      const d = get(slot)
      const def = d && defOf(d.id)
      const cls = d
        ? (d.locked ? ' restr-body-slot is-locked' : ' restr-body-slot is-worn')
        : ' restr-body-slot is-empty'
      const label = d ? def.name : SLOT_NAMES[slot]
      const equippedName = d
        ? `${d.locked ? (isCursed(slot) ? '🧿 ' : '🔒 ') : ''}${def.name}`
        : '未装备'
      return `<div class="${cls}" title="${SLOT_NAMES[slot]}：${label}">
        <i>${SLOT_ICONS[slot]}</i><b>${SLOT_NAMES[slot]}</b><span>${equippedName}</span>
      </div>`
    }).join('')}</div>`
  }

  /* ---------- 管理页 ---------- */

  /** 妖缚设置页：开关 + 一键脱下未上锁 + 城门检查设置 */
  function openSettings () {
    const s = settings()
    const gs = State.get()._guardSearchSettings || {}
    const ps = State.get()._pillorySettings || (State.get()._pillorySettings = {})
    const mcs = State.get()._mercenaryContractSettings || (State.get()._mercenaryContractSettings = {})
    const unlocked = SLOT_ORDER.filter(slot => { const d = get(slot); return d && !d.locked })
    const FREQ = { low: '低（10%/15%）', standard: '标准（25%/35%）', high: '高（40%/60%）', always: '每次（100%）' }
    const DUR = { fast: '快速（5~10 秒）', standard: '标准（10~30 秒）', immersive: '沉浸（30~60 秒）', fixed: '固定（60 秒）' }
    const NOTICE = { detail: '详细日志', compact: '简短日志', off: '不提示' }
    const gval = (k, def) => gs[k] === undefined ? def : gs[k]
    const presetIs = key => {
      if (key === 'casual') return s.allowTrap && !s.trapAutoLock && !s.redirectAttacks && !s.bossForcedUnlock && gval('frequency', 'standard') === 'low' && gval('duration', 'standard') === 'fast'
      if (key === 'immersive') return s.allowTrap && s.trapAutoLock && s.redirectAttacks && s.bossForcedUnlock && gval('frequency', 'standard') === 'high' && gval('duration', 'standard') === 'immersive'
      return s.allowTrap && s.trapAutoLock && s.redirectAttacks && s.bossForcedUnlock && gval('frequency', 'standard') === 'standard' && gval('duration', 'standard') === 'standard'
    }
    Dialog.show({
      title: '⚙️ 妖缚 MCM',
      className: 'inventory-modal restraint-modal',
      body: `<div class="restr-settings">
        <div class="restr-mcm-intro">
          <span>妖缚规则预设</span>
          <small>选择预设后仍可单独调整每项规则，修改会立即存档。</small>
        </div>
        <div class="restr-preset-grid">
          <button class="restr-preset${presetIs('casual') ? ' is-active' : ''}" data-restr-preset="casual">${presetIs('casual') ? '<em>使用中</em>' : ''}<i>🌿</i><b>休闲</b><small>佩戴不锁 · 不转移 · Boss 不破锁</small></button>
          <button class="restr-preset${presetIs('standard') ? ' is-active' : ''}" data-restr-preset="standard">${presetIs('standard') ? '<em>使用中</em>' : ''}<i>⚖️</i><b>标准</b><small>当前推荐规则</small></button>
          <button class="restr-preset${presetIs('immersive') ? ' is-active' : ''}" data-restr-preset="immersive">${presetIs('immersive') ? '<em>使用中</em>' : ''}<i>⛓️</i><b>沉浸</b><small>高频检查 · 沉浸时长</small></button>
        </div>
        <div class="restr-setting-row">
          <span><b>允许陷阱穿戴装置</b><small>关闭后森林陷阱不再添加妖缚装备</small></span>
          <label class="restr-switch"><input type="checkbox" id="restr-set-trap" ${s.allowTrap ? 'checked' : ''}><i></i></label>
        </div>
        <div class="restr-setting-row${s.allowTrap ? '' : ' is-muted'}">
          <span><b>陷阱装备自动上锁</b><small>关闭后陷阱只会替你穿戴，可直接脱下</small></span>
          <label class="restr-switch"><input type="checkbox" id="restr-set-auto-lock" ${s.trapAutoLock ? 'checked' : ''} ${s.allowTrap ? '' : 'disabled'}><i></i></label>
        </div>
        <div class="restr-setting-row">
          <span><b>怪物改攻其他部位</b><small>关闭后遇到封闭部位会改为打屁股，不触发插入状态</small></span>
          <label class="restr-switch"><input type="checkbox" id="restr-set-redirect" ${s.redirectAttacks ? 'checked' : ''}><i></i></label>
        </div>
        <div class="restr-setting-row">
          <span><b>Boss 藤蔓破锁</b><small>允许森林之灵每场战斗破坏一次普通锁</small></span>
          <label class="restr-switch"><input type="checkbox" id="restr-set-boss-unlock" ${s.bossForcedUnlock ? 'checked' : ''}><i></i></label>
        </div>
        <div class="restr-setting-row">
          <span><b>充能消耗提示</b><small>${NOTICE[s.chargeNotice]}</small></span>
          <button class="btn restr-btn" data-rule-cycle="chargeNotice">切换</button>
        </div>
        <div class="restr-setting-row">
          <span><b>一键脱下未上锁装置</b><small>${unlocked.length ? `当前有 ${unlocked.length} 件可脱下` : '没有未上锁的装置'}</small></span>
          <button class="btn restr-btn" data-act="strip" ${unlocked.length ? '' : 'disabled'}>✋ 脱下</button>
        </div>
        <div class="restr-collapse" data-collapse="guard"><span>🛡️ 城门检查</span><i>▾</i></div>
        <div class="restr-collapse-body" id="restr-guard-body" ${gval('_guardCollapsed', false) ? 'hidden' : ''}>
          <div class="restr-setting-row">
            <span><b>启用城门检查</b><small>进出营地时可能被卫兵拦下搜身</small></span>
            <label class="restr-switch"><input type="checkbox" id="gs-enabled" ${gval('enabled', true) ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row">
            <span><b>检查频率</b><small>${FREQ[gval('frequency', 'standard')]}</small></span>
            <button class="btn restr-btn" data-cycle="frequency">切换</button>
          </div>
          <div class="restr-setting-row">
            <span><b>检查时间</b><small>${DUR[gval('duration', 'standard')]}</small></span>
            <button class="btn restr-btn" data-cycle="duration">切换</button>
          </div>
          <div class="restr-setting-row">
            <span><b>没收开锁工具</b><small>搜到开锁工具时没收 1 个</small></span>
            <label class="restr-switch"><input type="checkbox" id="gs-confiscate" ${gval('confiscateLockpick', true) ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row">
            <span><b>允许贿赂</b><small>可花 50G 快速放行</small></span>
            <label class="restr-switch"><input type="checkbox" id="gs-bribe" ${gval('allowBribe', true) ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row">
            <span><b>妖缚特殊台词</b><small>卫兵对项圈/口塞/手铐等装置发表评论</small></span>
            <label class="restr-switch"><input type="checkbox" id="gs-device" ${gval('deviceComments', true) ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row">
            <span><b>恢复城门检查默认</b><small>重置为开启/标准/标准</small></span>
            <button class="btn restr-btn" data-act="gs-reset">↺ 恢复默认</button>
          </div>
        </div>
        <div class="restr-collapse" data-collapse="service" data-target="restr-service-body"><span>💋 服务联动</span><i>▾</i></div>
        <div class="restr-collapse-body" id="restr-service-body" hidden>
          <div class="restr-setting-row">
            <span><b>震动控制玩法</b><small>启用跳蛋与震动棒档位、服务加成和战斗代价</small></span>
            <label class="restr-switch"><input type="checkbox" id="restr-set-vibration" ${s.vibrationControl ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row">
            <span><b>荣耀洞足交服务</b><small>关闭后隐藏荣耀洞的足交选项</small></span>
            <label class="restr-switch"><input type="checkbox" id="glory-foot" ${((State.get()._glorySettings || {}).footService) !== false ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row">
            <span><b>广场木枷</b><small>在营地显示公开展示与抵债设施</small></span>
            <label class="restr-switch"><input type="checkbox" id="pillory-enabled" ${ps.enabled !== false ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row${ps.enabled === false ? ' is-muted' : ''}">
            <span><b>木枷成人围观事件</b><small>每 15 秒有 30% 概率；一次展示最多触发一项</small></span>
            <label class="restr-switch"><input type="checkbox" id="pillory-adult" ${ps.adultEvents !== false ? 'checked' : ''} ${ps.enabled === false ? 'disabled' : ''}><i></i></label>
          </div>
        </div>
        <div class="restr-collapse" data-collapse="mercenary" data-target="restr-mercenary-body"><span>⚔️ 佣兵债务契约</span><i>▾</i></div>
        <div class="restr-collapse-body" id="restr-mercenary-body" hidden>
          <div class="restr-setting-row">
            <span><b>启用佣兵债务系统</b><small>招募后不收日薪，仅借款、代付与违约产生债务</small></span>
            <label class="restr-switch"><input type="checkbox" id="merc-contract-enabled" ${mcs.enabled !== false ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row">
            <span><b>允许借款与代付</b><small>启用现金借款、招募分期和必要费用代付</small></span>
            <label class="restr-switch"><input type="checkbox" id="merc-contract-advance" ${mcs.allowAdvance !== false ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row">
            <span><b>妖缚装备契约</b><small>抵债契约可以暂借并锁上兼容装备</small></span>
            <label class="restr-switch"><input type="checkbox" id="merc-contract-gear" ${mcs.gearContracts !== false ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row">
            <span><b>酒馆服务契约</b><small>允许通过酒馆、荣耀洞与足交任务抵债</small></span>
            <label class="restr-switch"><input type="checkbox" id="merc-contract-tavern" ${mcs.tavernContracts !== false ? 'checked' : ''}><i></i></label>
          </div>
          <div class="restr-setting-row">
            <span><b>债务难度</b><small>${({ lenient: '宽松 · 上限400G', standard: '标准 · 上限300G', strict: '严格 · 上限200G' })[mcs.difficulty || 'standard']}</small></span>
            <button class="btn restr-btn" data-merc-cycle="difficulty">切换</button>
          </div>
          <div class="restr-setting-row">
            <span><b>违约处罚</b><small>${({ warning: '仅警告', standard: '标准', strict: '严格' })[mcs.penalty || 'standard']}</small></span>
            <button class="btn restr-btn" data-merc-cycle="penalty">切换</button>
          </div>
          ${State.get()._mercenary ? '<button class="btn restr-btn merc-open-contract" data-act="merc-open">打开芙蕾雅契约面板</button>' : '<p class="camp-footnote">招募芙蕾雅后可使用此系统。</p>'}
        </div>
        <p class="camp-footnote">已佩戴 ${countWorn()} 件 · 上锁 ${countLocked()} 件 · 战斗金币加成 +${Math.round(goldBonus() * 100)}%。</p>
      </div>`,
      actions: [
        { label: '← 返回装置', handler: () => { Dialog.close(); openManage() } },
        { label: '关闭', handler: () => Dialog.close() },
      ],
    })
    const bindRuleToggle = (id, key, rerender = false) => {
      const el = document.getElementById(id)
      if (el) el.onchange = () => {
        settings()[key] = el.checked
        EventBus.emit('state:changed', State.get())
        State.save()
        if (rerender) { Dialog.close(); openSettings() }
      }
    }
    bindRuleToggle('restr-set-trap', 'allowTrap', true)
    bindRuleToggle('restr-set-auto-lock', 'trapAutoLock')
    bindRuleToggle('restr-set-redirect', 'redirectAttacks')
    bindRuleToggle('restr-set-boss-unlock', 'bossForcedUnlock')
    bindRuleToggle('restr-set-vibration', 'vibrationControl', true)
    document.querySelectorAll('[data-rule-cycle]').forEach(btn => {
      btn.onclick = () => {
        const modes = Object.keys(NOTICE)
        const rules = settings()
        rules.chargeNotice = modes[(modes.indexOf(rules.chargeNotice) + 1) % modes.length]
        EventBus.emit('state:changed', State.get())
        State.save()
        Dialog.close()
        openSettings()
      }
    })
    document.querySelectorAll('[data-restr-preset]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.restrPreset
        const rules = settings()
        const guard = State.get()._guardSearchSettings || (State.get()._guardSearchSettings = {})
        if (key === 'casual') {
          Object.assign(rules, { allowTrap: true, trapAutoLock: false, redirectAttacks: false, bossForcedUnlock: false, chargeNotice: 'detail' })
          Object.assign(guard, { enabled: true, frequency: 'low', duration: 'fast' })
        } else if (key === 'immersive') {
          Object.assign(rules, { allowTrap: true, trapAutoLock: true, redirectAttacks: true, bossForcedUnlock: true, chargeNotice: 'detail' })
          Object.assign(guard, { enabled: true, frequency: 'high', duration: 'immersive' })
        } else {
          Object.assign(rules, { allowTrap: true, trapAutoLock: true, redirectAttacks: true, bossForcedUnlock: true, chargeNotice: 'detail' })
          Object.assign(guard, { enabled: true, frequency: 'standard', duration: 'standard' })
        }
        EventBus.emit('state:changed', State.get())
        State.save()
        Dialog.close()
        openSettings()
      }
    })
    // 城门设置开关：立即保存
    const bindToggle = (id, key) => {
      const el = document.getElementById(id)
      if (el) el.onchange = () => {
        const g = State.get()._guardSearchSettings || (State.get()._guardSearchSettings = {})
        g[key] = el.checked
        EventBus.emit('state:changed', State.get())
        State.save()
      }
    }
    bindToggle('gs-enabled', 'enabled')
    bindToggle('gs-confiscate', 'confiscateLockpick')
    bindToggle('gs-bribe', 'allowBribe')
    bindToggle('gs-device', 'deviceComments')
    const bindMercToggle = (id, key) => {
      const el = document.getElementById(id)
      if (el) el.onchange = () => {
        const cfg = State.get()._mercenaryContractSettings || (State.get()._mercenaryContractSettings = {})
        cfg[key] = el.checked
        EventBus.emit('state:changed', State.get())
        State.save()
      }
    }
    bindMercToggle('merc-contract-enabled', 'enabled')
    bindMercToggle('merc-contract-advance', 'allowAdvance')
    bindMercToggle('merc-contract-gear', 'gearContracts')
    bindMercToggle('merc-contract-tavern', 'tavernContracts')
    document.querySelectorAll('[data-merc-cycle]').forEach(btn => {
      btn.onclick = () => {
        const cfg = State.get()._mercenaryContractSettings || (State.get()._mercenaryContractSettings = {})
        if (btn.dataset.mercCycle === 'difficulty') {
          const modes = ['lenient', 'standard', 'strict']
          cfg.difficulty = modes[(modes.indexOf(cfg.difficulty || 'standard') + 1) % modes.length]
        } else {
          const modes = ['warning', 'standard', 'strict']
          cfg.penalty = modes[(modes.indexOf(cfg.penalty || 'standard') + 1) % modes.length]
        }
        EventBus.emit('state:changed', State.get()); State.save(); Dialog.close(); openSettings()
      }
    })
    const mercOpen = document.querySelector('[data-act="merc-open"]')
    if (mercOpen) mercOpen.onclick = () => { Dialog.close(); MercenaryContractSystem.openPanel() }
    // 频率/时长循环切换
    document.querySelectorAll('[data-cycle]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.cycle
        const opts = key === 'frequency' ? Object.keys(FREQ) : Object.keys(DUR)
        const g = State.get()._guardSearchSettings || (State.get()._guardSearchSettings = {})
        const cur = opts.indexOf(g[key]) >= 0 ? g[key] : 'standard'
        g[key] = opts[(opts.indexOf(cur) + 1) % opts.length]
        EventBus.emit('state:changed', State.get())
        State.save()
        Dialog.close()
        openSettings()
      }
    })
    // 折叠展开
    document.querySelectorAll('[data-collapse]').forEach(btn => {
      btn.onclick = () => {
        const target = btn.dataset.target || 'restr-guard-body'
        const body = document.getElementById(target)
        if (body) body.hidden = !body.hidden
      }
    })
    // 荣耀洞足交服务开关：立即保存（妖缚预设不修改该开关）
    const footToggle = document.getElementById('glory-foot')
    if (footToggle) footToggle.onchange = () => {
      const g = State.get()._glorySettings || (State.get()._glorySettings = {})
      g.footService = footToggle.checked
      EventBus.emit('state:changed', State.get())
      State.save()
    }
    const bindPilloryToggle = (id, key, rerender = false) => {
      const el = document.getElementById(id)
      if (!el) return
      el.onchange = () => {
        const cfg = State.get()._pillorySettings || (State.get()._pillorySettings = {})
        cfg[key] = el.checked
        EventBus.emit('state:changed', State.get())
        State.save()
        if (rerender) { Dialog.close(); openSettings() }
      }
    }
    bindPilloryToggle('pillory-enabled', 'enabled', true)
    bindPilloryToggle('pillory-adult', 'adultEvents')
    // 恢复默认
    document.querySelectorAll('[data-act="gs-reset"]').forEach(btn => {
      btn.onclick = () => {
        State.get()._guardSearchSettings = { enabled: true, frequency: 'standard', duration: 'standard', confiscateLockpick: true, allowBribe: true, deviceComments: true }
        EventBus.emit('state:changed', State.get())
        State.save()
        Dialog.close()
        openSettings()
      }
    })
    setTimeout(() => {
      document.querySelectorAll('[data-act="strip"]').forEach(btn => {
        btn.onclick = () => {
          removeAllUnlocked()
          Dialog.close()
          openSettings()
        }
      })
    }, 0)
  }

  function openManage () {
    const state = State.get()
    const ownedIds = state._ownedRestraints || []
    const bonus = Math.round(goldBonus() * 100)
    const cards = SLOT_ORDER.map(slot => {
      const d = get(slot)
      const def = d && defOf(d.id)
      if (!d) {
        // 空槽：列出该槽位所有已拥有且尚未全部穿戴的装置，可选穿戴
        const ownedHere = ownedIds.filter(id => { const od = defOf(id); return od && allowedSlotsOf(od).includes(slot) && wornCountOf(id) < ownedCount(id) })
        if (ownedHere.length) {
          const blockedHint = slot === 'vagina' && state.gender === 'male'
            ? '男性不可用'
            : slot === 'vagina' && hasWaistChastity() ? '被贞操带阻挡' : ''
          const wearBtns = ownedHere.map(oid => {
            const od = defOf(oid)
            const check = canEquip(slot, oid)
            const countLabel = (od.stackable || (od.maxOwn && od.maxOwn > 1)) ? ` ×${ownedCount(oid)}` : ''
            const worn = wornCountOf(oid)
            const multiHint = (od.maxOwn && od.maxOwn > 1 && worn > 0) ? `<small>已装备 ${worn}/${ownedCount(oid)}，可在另一槽位继续装备</small>` : ''
            return `<button class="btn restr-btn" data-act="wear" data-slot="${slot}" data-id="${oid}" ${check.ok ? '' : 'disabled'} title="${check.ok ? `装备到${SLOT_NAMES[slot]}` : check.msg}">📿 ${od.name}${countLabel}${check.ok ? '' : ' · 不可用'}</button>${multiHint}`
          }).join('')
          return `<div class="restr-card restr-empty has-owned"><i>${SLOT_ICONS[slot]}</i><span><b>${SLOT_NAMES[slot]}</b><small>${blockedHint ? `${blockedHint} · ` : ''}已拥有 ${ownedHere.map(id => defOf(id).name).join('、')}</small></span><div class="restr-actions">${wearBtns}</div></div>`
        }
        const emptyHint = slot === 'vagina' && state.gender === 'male' ? '男性不可用' : slot === 'vagina' && hasWaistChastity() ? '被贞操带阻挡' : '空'
        return `<div class="restr-card restr-empty"><i>${SLOT_ICONS[slot]}</i><span><b>${SLOT_NAMES[slot]}</b><small>${emptyHint}</small></span></div>`
      }
      const lockTag = d.locked
        ? `<em class="restr-lock${isContractLock(slot) ? ' is-contract' : ''}">${d.jammed ? '⛓️ 卡死' : isCursed(slot) ? '🧿 诅咒锁' : isStory(slot) ? '📜 剧情锁' : isContractLock(slot) ? '📜 契约锁' : '🔒 上锁'}${d.timer ? ` · ⏲️${d.timer}` : ''}</em>`
        : `<em class="restr-open">✓ 未锁</em>`
      const lockCount = State.get().inventory.consumables.restraint_lock || 0
      const lockButton = !def.cosmetic && !def.story
        ? `<button class="btn restr-btn" data-act="lock" data-slot="${slot}" ${lockCount > 0 ? '' : 'disabled'}>🔒 ${lockCount > 0 ? `上锁（剩 ${lockCount}）` : '没有普通锁'}</button>`
        : ''
      const vibration = def.vibrate ? vibrationInfo(slot) : null
      const vibrationButtons = vibration
        ? Object.entries(VIBRATION_MODES).map(([mode, rule]) => `<button class="btn restr-btn restr-vibration-btn${vibration.configuredMode === mode ? ' is-active' : ''}" data-act="vibration" data-mode="${mode}" data-slot="${slot}" ${vibration.adjustable && vibration.configuredMode !== mode ? '' : 'disabled'}>${rule.icon} ${rule.label}</button>`).join('')
        : ''
      const actionsHtml = d.locked
        ? (isStory(slot) || isContractLock(slot))
          ? `<div class="restr-actions"><span class="camp-muted">${isContractLock(slot) ? '📜 契约装备：完成任务或回对应契约面板解约' : '📜 剧情锁只能通过对应剧情解除'}</span></div>`
          : `<div class="restr-actions">
             ${d.jammed ? '' : `<button class="btn restr-btn" data-act="struggle" data-slot="${slot}">💪 挣扎</button>`}
             ${canCut(slot) ? `<button class="btn restr-btn" data-act="cut" data-slot="${slot}">🔪 割断</button>` : ''}
             ${isCursed(slot) ? `<button class="btn restr-btn" data-act="curse" data-slot="${slot}">🧿 驱咒符</button>` : `<button class="btn restr-btn" data-act="key" data-slot="${slot}">🔑 钥匙</button>`}
             ${isCursed(slot) ? '' : `<button class="btn restr-btn" data-act="lockpick" data-slot="${slot}">🛠️ 撬锁</button>`}
             <button class="btn restr-btn" data-act="npc" data-slot="${slot}">🔧 求助铁匠</button>
           </div>`
        : def.stackable
          ? `<div class="restr-actions">
               <button class="btn restr-btn" data-act="stack-minus" data-slot="${slot}" ${(d.count || 1) <= 1 ? 'disabled' : ''}>➖ 取出一颗</button>
               <button class="btn restr-btn" data-act="stack-plus" data-slot="${slot}" ${(d.count || 1) >= ownedCount(d.id) ? 'disabled' : ''}>➕ 再塞一颗</button>
               <button class="btn restr-btn" data-act="remove" data-slot="${slot}">✋ 全部取出</button>
               ${vibrationButtons}
               ${lockButton}
             </div>`
          : `<div class="restr-actions"><button class="btn restr-btn" data-act="remove" data-slot="${slot}">✋ 脱下</button>${vibrationButtons}${lockButton}</div>`
      const countLabel = def.stackable ? ` ×${Math.max(1, d.count || 1)}` : ''
      const charge = def.insert ? insertionCharge(slot) : null
      const chargeHtml = charge
        ? insertDetailsHtml(def, charge, d)
        : ''
      const serviceHtml = !def.insert ? serviceDetailsHtml(def) : ''
      const tone = def.insert ? 'insert' : gearTone(def)
      return `<div class="restr-card rpg-equipped-card rpg-gear-${tone}"><i>${SLOT_ICONS[slot]}</i><span><b class="rpg-gear-name">${def.name}${countLabel}</b>${def.insert ? chargeHtml : serviceHtml}</span>${lockTag}${actionsHtml}</div>`
    }).join('')

    Dialog.show({
      title: '⛓️ 妖缚装置',
      className: 'inventory-modal restraint-modal',
      body: `<div class="restr-top"><span>已佩戴 <b>${countWorn()}</b> 件 · 上锁 <b>${countLocked()}</b> 件</span><em>战斗金币 +${bonus}%</em></div>
        ${bodyDiagram()}
        <div class="restr-grid">${cards}</div>
        <p class="camp-footnote">怪物攻击被占用的部位时，每点充能会完全抵挡一次攻击（0伤害、0效果）；充能耗尽且未上锁会被拔掉并继续原攻击，已上锁则改攻其他部位。全部部位不可用时怪物会改打屁股。充能跨战斗与存档保留，可找附魔师或使用灵魂石补充。</p>`,
      actions: [
        { label: '⚙️ 设置', handler: () => { Dialog.close(); openSettings() } },
        { label: '关闭', handler: () => Dialog.close() },
      ],
    })
    setTimeout(() => {
      document.querySelectorAll('[data-act]').forEach(btn => {
        btn.onclick = () => {
          const slot = btn.dataset.slot
          const act = btn.dataset.act
          let result = null
          if (act === 'wear') {
            const ownedId = btn.dataset.id
            result = equip(slot, ownedId, { locked: false, source: 'tavern' })
          } else if (act === 'lock') result = lockDevice(slot)
          else if (act === 'struggle') result = struggle(slot)
          else if (act === 'cut') result = cut(slot)
          else if (act === 'key') result = useKey(slot)
          else if (act === 'lockpick') result = useLockpick(slot)
          else if (act === 'curse') result = useCurseRemover(slot)
          else if (act === 'npc') result = npcUnlock(slot)
          else if (act === 'stack-minus') result = adjustStack(slot, -1)
          else if (act === 'stack-plus') result = adjustStack(slot, 1)
          else if (act === 'vibration') result = setVibrationMode(slot, btn.dataset.mode)
          else if (act === 'remove') result = remove(slot)
          if (result && result.msg) EventBus.emit('ui:log', { text: result.msg, type: result.ok ? 'good' : 'danger' })
          Dialog.close()
          openManage()
        }
      })
    }, 0)
  }

  return {
    SLOT_ORDER, SLOT_NAMES, SLOT_ICONS,
    get, defOf, isWorn, isLocked, countLocked, countWorn, goldBonus,
    equip, remove, restore, lockDevice, isStory, isContractLock, isHeavy, isCursed, canCut, cut, struggle,
    useKey, useLockpick, useCurseRemover, npcUnlock, npcUnlockCost,
    setTimer, tickTimers, lockedSlots,
    hasGag, hasHandcuffs, hasLegCuffs, hasCollar, hasArmbinder, hasBlindfold, hasWaistChastity, hasHandsBlocked,
    hasNipple, hasCorset, hasAnkleChains, hasDevice, ownedCount, grant, adjustStack,
    allowedSlotsOf, canEquip, insertionDevice, insertionBlocks, insertionCharge, setInsertionCharge, insertionProstituteBonus, lockedInsertionDevices, lockedServiceDevices, resolveMonsterOrifice, resolveServiceOrifice,
    VIBRATION_MODES, vibrationInfo, setVibrationMode, vibrationServiceBonus, vibrationDistraction, vibrationEscapePenalty,
    effectiveMaxOwn, wornCountOf,
    settings, chargeNoticeText, toggleTrap, removeAllUnlocked, bodyDiagram,
    openManage, openSettings,
  }
})()
