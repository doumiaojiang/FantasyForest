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
  const SLOT_ORDER = ['eyes', 'mouth', 'neck', 'chest', 'arms', 'arms_heavy', 'torso', 'waist', 'legs', 'ankles', 'anal', 'vagina']
  const SLOT_NAMES = { eyes: '眼部', mouth: '嘴部', neck: '颈部', chest: '胸部', arms: '手臂', arms_heavy: '束臂', torso: '躯干', waist: '腰部', legs: '腿部', ankles: '脚踝', anal: '菊穴', vagina: '小穴' }
  const SLOT_ICONS = { eyes: '😵', mouth: '🤐', neck: '🐕', chest: '🎀', arms: '⛓️', arms_heavy: '🪢', torso: '🩱', waist: '🔒', legs: '🦶', ankles: '⛓️', anal: '🍑', vagina: '🌸' }
  // 妆容栏（独立区域，不占身体槽位）
  const COSMETIC_SLOTS = ['lip', 'face']
  const COSMETIC_NAMES = { lip: '口唇', face: '面妆' }
  const COSMETIC_ICONS = { lip: '💄', face: '💋' }
  const BLADES = ['rusty_knife', 'basic_sword', 'master_sword', 'sharp_rock']

  function raw () { return State.get()._restraints || {} }
  function get (slot) { return raw()[slot] || null }
  function defOf (id) { return (RESTRAINTS || []).find(r => r.id === id) }
  function isWorn (slot) { return !!get(slot) }
  function isLocked (slot) { const d = get(slot); return !!(d && d.locked) }
  function countLocked () { return SLOT_ORDER.filter(isLocked).length }
  function countWorn () { return SLOT_ORDER.concat(COSMETIC_SLOTS).filter(isWorn).length }

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

  /** 检查装置是否能穿到指定部位。 */
  function canEquip (slot, id) {
    const def = defOf(id)
    if (!def) return { ok: false, msg: '装置不存在' }
    if (!allowedSlotsOf(def).includes(slot)) return { ok: false, msg: `${def.name}不能装备到${SLOT_NAMES[slot] || '该部位'}` }
    const state = State.get()
    if ((def.femaleOnly || slot === 'vagina') && state.gender === 'male') return { ok: false, msg: '男性没有可用的小穴槽位' }
    if (slot === 'vagina' && hasWaistChastity()) return { ok: false, msg: '小穴被贞操装置阻挡，无法插入装备' }
    if (hasDevice(id)) return { ok: false, msg: `${def.name}已经装备在其他部位` }
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
      set('vagina', null)
      EventBus.emit('ui:log', { text: '🔒 贞操装置合拢前，小穴里的插入装备被迫取出。', type: 'danger' })
    }
    const device = {
      id, slot,
      locked: !!opts.locked,
      lockType: opts.lockType || 'common',
      difficulty: opts.difficulty || def.difficulty || 3,
      material: def.material,
      source: opts.source || 'self',
      escapeBonus: 0,
      jammed: !!opts.jammed,
      count: def.stackable ? Math.max(1, Math.min(ownedCount(id), Math.floor(Number(opts.count) || 1))) : 1,
    }
    set(slot, device)
    return { ok: true, device }
  }

  /** 直接还原一个装置对象（监狱恢复用） */
  function restore (slot, device) {
    set(slot, device)
  }

  function remove (slot) {
    const d = get(slot)
    if (!d) return { ok: false, msg: '这里没有装置' }
    set(slot, null)
    // 同步旧酒馆用品标志：脱下后清除，避免读档时又被迁移回去
    const st = State.get()
    if (st._prostituteGear) {
      const GEAR_FLAG = { chastity_device: 'chastity', lipstick: 'lipstick', makeup: 'makeup', heels: 'heels', lingerie: 'lingerie', latex: 'latex', slut_collar: 'collar', slut_gag: 'gag', butt_plug: 'buttplug', medium_butt_plug: 'buttplug' }
      if (GEAR_FLAG[d.id]) st._prostituteGear[GEAR_FLAG[d.id]] = false
    }
    return { ok: true, msg: '已脱下' }
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
    const def = defOf(d.id)
    if (def && def.material === 'metal') return false
    return BLADES.includes(State.get().inventory.weapon)
  }

  function cut (slot) {
    const d = get(slot)
    if (!d) return { ok: false, msg: '这里没有装置' }
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
    if (!d.locked) { remove(slot); return { ok: true, msg: '已脱下' } }
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
  /** 震动装置：战斗中失控颤抖 */
  function hasVibrating () {
    const d = get('waist')
    const def = d && defOf(d.id)
    return !!(def && def.vibrate)
  }
  function hasNipple () { return hasEffect('nipple') }
  function hasCorset () { return hasEffect('corset') }
  function hasAnkleChains () { return hasEffect('ankle_chains') }
  /** 是否正穿着某件装置（按装置 id；含妆容栏） */
  function hasDevice (id) {
    const allSlots = SLOT_ORDER.concat(COSMETIC_SLOTS)
    return allSlots.some(slot => { const d = get(slot); return d && d.id === id })
  }
  function ownedCount (id) {
    const def = defOf(id)
    const state = State.get()
    const owned = Array.isArray(state._ownedRestraints) && state._ownedRestraints.includes(id)
    if (!def || !def.stackable) return (owned || hasDevice(id)) ? 1 : 0
    state._ownedRestraintCounts = state._ownedRestraintCounts && typeof state._ownedRestraintCounts === 'object' ? state._ownedRestraintCounts : {}
    const saved = Math.max(0, Math.floor(Number(state._ownedRestraintCounts[id]) || 0))
    return Math.min(def.maxStack || 99, Math.max((owned || hasDevice(id)) ? 1 : 0, saved))
  }
  function grant (id, amount = 1) {
    const def = defOf(id)
    if (!def || def.story) return { ok: false, msg: '装置不存在或不能获得' }
    const state = State.get()
    state._ownedRestraints = Array.isArray(state._ownedRestraints) ? state._ownedRestraints : []
    if (def.stackable) {
      state._ownedRestraintCounts = state._ownedRestraintCounts && typeof state._ownedRestraintCounts === 'object' ? state._ownedRestraintCounts : {}
      const before = ownedCount(id)
      const after = Math.min(def.maxStack || 99, before + Math.max(1, Math.floor(Number(amount) || 1)))
      if (!state._ownedRestraints.includes(id)) state._ownedRestraints.push(id)
      state._ownedRestraintCounts[id] = after
      EventBus.emit('state:changed', state)
      return { ok: true, owned: before >= (def.maxStack || 99), full: after >= (def.maxStack || 99), count: after, added: after - before, def }
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
      if (entry) result[slot] = Math.max(0, entry.def.block || 0) * (entry.def.stackable ? Math.max(1, entry.device.count || 1) : 1)
    })
    return result
  }
  function insertionProstituteBonus () {
    return ['anal', 'vagina'].reduce((sum, slot) => {
      const entry = insertionDevice(slot)
      return sum + (entry ? Math.max(0, entry.def.prostituteBonus || 0) * (entry.def.stackable ? Math.max(1, entry.device.count || 1) : 1) : 0)
    }, 0)
  }
  /** 上锁槽位列表 */
  function lockedSlots () { return SLOT_ORDER.filter(isLocked) }

  /* ---------- 设置 ---------- */

  function settings () {
    const st = State.get()
    if (!st._restraintSettings || typeof st._restraintSettings !== 'object') st._restraintSettings = {}
    st._restraintSettings.allowTrap = st._restraintSettings.allowTrap !== false
    return st._restraintSettings
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
      const mark = d
        ? (d.locked ? (isCursed(slot) ? '🧿' : '🔒') : '✓')
        : '·'
      return `<div class="${cls}" title="${SLOT_NAMES[slot]}：${label}">
        <i>${SLOT_ICONS[slot]}</i><b>${SLOT_NAMES[slot]}</b><span>${mark}</span>
      </div>`
    }).join('')}</div>`
  }

  /* ---------- 管理页 ---------- */

  /** 妖缚设置页：开关 + 一键脱下未上锁 + 城门检查设置 */
  function openSettings () {
    const s = settings()
    const gs = State.get()._guardSearchSettings || {}
    const unlocked = SLOT_ORDER.filter(slot => { const d = get(slot); return d && !d.locked })
    const FREQ = { low: '低（10%/15%）', standard: '标准（25%/35%）', high: '高（40%/60%）', always: '每次（100%）' }
    const DUR = { fast: '快速（5~10 秒）', standard: '标准（10~30 秒）', immersive: '沉浸（30~60 秒）', fixed: '固定（60 秒）' }
    const gval = (k, def) => gs[k] === undefined ? def : gs[k]
    Dialog.show({
      title: '⚙️ 设置',
      className: 'inventory-modal restraint-modal',
      body: `<div class="restr-settings">
        <div class="restr-setting-row">
          <span><b>允许陷阱上锁</b><small>关闭后森林陷阱不再往你身上锁装置</small></span>
          <label class="restr-switch"><input type="checkbox" id="restr-set-trap" ${s.allowTrap ? 'checked' : ''}><i></i></label>
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
        <p class="camp-footnote">已佩戴 ${countWorn()} 件 · 上锁 ${countLocked()} 件 · 战斗金币加成 +${Math.round(goldBonus() * 100)}%。</p>
      </div>`,
      actions: [
        { label: '← 返回装置', handler: () => { Dialog.close(); openManage() } },
        { label: '关闭', handler: () => Dialog.close() },
      ],
    })
    const trapToggle = document.getElementById('restr-set-trap')
    if (trapToggle) trapToggle.onchange = () => { toggleTrap() }
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
        const body = document.getElementById('restr-guard-body')
        if (body) body.hidden = !body.hidden
      }
    })
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
        // 空槽：列出该槽位所有已拥有的装置，可选穿戴
        const ownedHere = ownedIds.filter(id => { const od = defOf(id); return od && allowedSlotsOf(od).includes(slot) && !hasDevice(id) })
        if (ownedHere.length) {
          const blockedHint = slot === 'vagina' && state.gender === 'male'
            ? '男性不可用'
            : slot === 'vagina' && hasWaistChastity() ? '被贞操装置阻挡' : ''
          const wearBtns = ownedHere.map(oid => {
            const od = defOf(oid)
            const check = canEquip(slot, oid)
            const countLabel = od.stackable ? ` ×${ownedCount(oid)}` : ''
            return `<button class="btn restr-btn" data-act="wear" data-slot="${slot}" data-id="${oid}" ${check.ok ? '' : 'disabled'} title="${check.ok ? `装备到${SLOT_NAMES[slot]}` : check.msg}">📿 ${od.name}${countLabel}${check.ok ? '' : ' · 不可用'}</button>`
          }).join('')
          return `<div class="restr-card restr-empty has-owned"><i>${SLOT_ICONS[slot]}</i><span><b>${SLOT_NAMES[slot]}</b><small>${blockedHint ? `${blockedHint} · ` : ''}已拥有 ${ownedHere.map(id => defOf(id).name).join('、')}</small></span><div class="restr-actions">${wearBtns}</div></div>`
        }
        const emptyHint = slot === 'vagina' && state.gender === 'male' ? '男性不可用' : slot === 'vagina' && hasWaistChastity() ? '被贞操装置阻挡' : '空'
        return `<div class="restr-card restr-empty"><i>${SLOT_ICONS[slot]}</i><span><b>${SLOT_NAMES[slot]}</b><small>${emptyHint}</small></span></div>`
      }
      const lockTag = d.locked
        ? `<em class="restr-lock">${d.jammed ? '⛓️ 卡死' : isCursed(slot) ? '🧿 诅咒锁' : isStory(slot) ? '📜 剧情锁' : '🔒 上锁'}${d.timer ? ` · ⏲️${d.timer}` : ''}</em>`
        : `<em class="restr-open">✓ 未锁</em>`
      const actionsHtml = d.locked
        ? `<div class="restr-actions">
             ${d.jammed ? '' : `<button class="btn restr-btn" data-act="struggle" data-slot="${slot}">💪 挣扎</button>`}
             ${canCut(slot) ? `<button class="btn restr-btn" data-act="cut" data-slot="${slot}">🔪 割断</button>` : ''}
             ${isCursed(slot) ? `<button class="btn restr-btn" data-act="curse" data-slot="${slot}">🧿 驱咒符</button>` : `<button class="btn restr-btn" data-act="key" data-slot="${slot}">🔑 钥匙</button>`}
             ${isCursed(slot) ? '' : `<button class="btn restr-btn" data-act="lockpick" data-slot="${slot}">🛠️ 撬锁</button>`}
             ${isStory(slot) ? '' : `<button class="btn restr-btn" data-act="npc" data-slot="${slot}">🔧 求助铁匠</button>`}
           </div>`
        : def.stackable
          ? `<div class="restr-actions">
               <button class="btn restr-btn" data-act="stack-minus" data-slot="${slot}" ${(d.count || 1) <= 1 ? 'disabled' : ''}>➖ 取出一颗</button>
               <button class="btn restr-btn" data-act="stack-plus" data-slot="${slot}" ${(d.count || 1) >= ownedCount(d.id) ? 'disabled' : ''}>➕ 再塞一颗</button>
               <button class="btn restr-btn" data-act="remove" data-slot="${slot}">✋ 全部取出</button>
             </div>`
          : `<button class="btn restr-btn" data-act="remove" data-slot="${slot}">✋ 脱下</button>`
      const countLabel = def.stackable ? ` ×${Math.max(1, d.count || 1)}` : ''
      return `<div class="restr-card"><i>${SLOT_ICONS[slot]}</i><span><b>${def.name}${countLabel}</b><small>${def.desc}</small></span>${lockTag}${actionsHtml}</div>`
    }).join('')

    // 妆容栏（独立区域，口唇 + 面妆可同时穿戴）
    const cosmeticCards = COSMETIC_SLOTS.map(slot => {
      const d = get(slot)
      const def = d && defOf(d.id)
      if (!d) {
        const ownedHere = ownedIds.filter(id => { const od = defOf(id); return od && od.cosmetic && allowedSlotsOf(od).includes(slot) && !hasDevice(id) })
        if (ownedHere.length) {
          const wearBtns = ownedHere.map(oid => {
            const od = defOf(oid)
            const check = canEquip(slot, oid)
            return `<button class="btn restr-btn" data-act="wear" data-slot="${slot}" data-id="${oid}" ${check.ok ? '' : 'disabled'} title="${check.ok ? `装备到${COSMETIC_NAMES[slot]}` : check.msg}">📿 ${od.name}${check.ok ? '' : ' · 不可用'}</button>`
          }).join('')
          return `<div class="restr-card restr-empty has-owned"><i>${COSMETIC_ICONS[slot]}</i><span><b>${COSMETIC_NAMES[slot]}</b><small>已拥有 ${ownedHere.map(id => defOf(id).name).join('、')}</small></span><div class="restr-actions">${wearBtns}</div></div>`
        }
        return `<div class="restr-card restr-empty"><i>${COSMETIC_ICONS[slot]}</i><span><b>${COSMETIC_NAMES[slot]}</b><small>空</small></span></div>`
      }
      return `<div class="restr-card"><i>${COSMETIC_ICONS[slot]}</i><span><b>${def.name}</b><small>${COSMETIC_NAMES[slot]} · ${def.desc}</small></span><button class="btn restr-btn" data-act="remove" data-slot="${slot}">✋ 卸下</button></div>`
    }).join('')

    Dialog.show({
      title: '⛓️ 妖缚装置',
      className: 'inventory-modal restraint-modal',
      body: `<div class="restr-top"><span>已佩戴 <b>${countWorn()}</b> 件 · 上锁 <b>${countLocked()}</b> 件</span><em>战斗金币 +${bonus}%</em></div>
        ${bodyDiagram()}
        <div class="restr-grid">${cards}</div>
        <div class="restr-cosmetic"><b class="eq-label">💄 妆容（口唇 + 面妆可同时装备）</b><div class="restr-grid">${cosmeticCards}</div></div>
        <p class="camp-footnote">普通钥匙开普通锁；万能钥匙开任意非剧情/非诅咒锁；开锁工具 60% 成功。挣扎失败永久 +10% 成功率，失败 3 次后必定成功；皮革/绳索可用尖石/刀/剑割断；诅咒锁需铁匠或驱咒符。</p>`,
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
          } else if (act === 'struggle') result = struggle(slot)
          else if (act === 'cut') result = cut(slot)
          else if (act === 'key') result = useKey(slot)
          else if (act === 'lockpick') result = useLockpick(slot)
          else if (act === 'curse') result = useCurseRemover(slot)
          else if (act === 'npc') result = npcUnlock(slot)
          else if (act === 'stack-minus') result = adjustStack(slot, -1)
          else if (act === 'stack-plus') result = adjustStack(slot, 1)
          else if (act === 'remove') result = remove(slot)
          if (result && result.msg) EventBus.emit('ui:log', { text: result.msg, type: result.ok ? 'good' : 'danger' })
          Dialog.close()
          openManage()
        }
      })
    }, 0)
  }

  return {
    SLOT_ORDER, SLOT_NAMES, SLOT_ICONS, COSMETIC_SLOTS, COSMETIC_NAMES, COSMETIC_ICONS,
    get, defOf, isWorn, isLocked, countLocked, countWorn, goldBonus,
    equip, remove, restore, isStory, isHeavy, isCursed, canCut, cut, struggle,
    useKey, useLockpick, useCurseRemover, npcUnlock, npcUnlockCost,
    setTimer, tickTimers, lockedSlots,
    hasGag, hasHandcuffs, hasLegCuffs, hasCollar, hasArmbinder, hasBlindfold, hasWaistChastity, hasHandsBlocked, hasVibrating,
    hasNipple, hasCorset, hasAnkleChains, hasDevice, ownedCount, grant, adjustStack,
    allowedSlotsOf, canEquip, insertionDevice, insertionBlocks, insertionProstituteBonus,
    settings, toggleTrap, removeAllUnlocked, bodyDiagram,
    openManage, openSettings,
  }
})()
