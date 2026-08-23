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
  const SLOT_ORDER = ['eyes', 'face', 'mouth', 'neck', 'chest', 'arms', 'arms_heavy', 'torso', 'waist', 'legs', 'ankles', 'anal']
  const SLOT_NAMES = { eyes: '眼部', face: '脸面', mouth: '嘴部', neck: '颈部', chest: '胸部', arms: '手臂', arms_heavy: '束臂', torso: '躯干', waist: '腰部', legs: '腿部', ankles: '脚踝', anal: '菊穴' }
  const SLOT_ICONS = { eyes: '😵', face: '🎭', mouth: '🤐', neck: '🐕', chest: '🎀', arms: '⛓️', arms_heavy: '🪢', torso: '🩱', waist: '🔒', legs: '🦶', ankles: '⛓️', anal: '🔴' }
  const BLADES = ['rusty_knife', 'basic_sword', 'master_sword', 'sharp_rock']

  function raw () { return State.get()._restraints || {} }
  function get (slot) { return raw()[slot] || null }
  function defOf (id) { return (RESTRAINTS || []).find(r => r.id === id) }
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

  /** 佩戴装置（可上锁或普通佩戴）；force=true 可覆盖已有槽位 */
  function equip (slot, id, opts = {}, force = false) {
    if (!force && get(slot)) return { ok: false, msg: '该部位已经锁着东西了' }
    const def = defOf(id)
    if (!def) return { ok: false, msg: '装置不存在' }
    const device = {
      id, slot,
      locked: !!opts.locked,
      lockType: opts.lockType || 'common',
      difficulty: opts.difficulty || def.difficulty || 3,
      material: def.material,
      source: opts.source || 'self',
      escapeBonus: 0,
      jammed: !!opts.jammed,
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
      const GEAR_FLAG = { chastity_device: 'chastity', lipstick: 'lipstick', makeup: 'makeup', heels: 'heels', lingerie: 'lingerie', latex: 'latex', slut_collar: 'collar', slut_gag: 'gag', buttplug: 'buttplug' }
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
  /** 是否正穿着某件装置（按装置 id，区分同槽位的多件装置） */
  function hasDevice (id) {
    return SLOT_ORDER.some(slot => { const d = get(slot); return d && d.id === id })
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

  /** 妖缚设置页：开关 + 一键脱下未上锁 */
  function openSettings () {
    const s = settings()
    const unlocked = SLOT_ORDER.filter(slot => { const d = get(slot); return d && !d.locked })
    Dialog.show({
      title: '⚙️ 妖缚设置',
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
        <p class="camp-footnote">已佩戴 ${countWorn()} 件 · 上锁 ${countLocked()} 件 · 战斗金币加成 +${Math.round(goldBonus() * 100)}%。</p>
      </div>`,
      actions: [
        { label: '← 返回装置', handler: () => { Dialog.close(); openManage() } },
        { label: '关闭', handler: () => Dialog.close() },
      ],
    })
    const trapToggle = document.getElementById('restr-set-trap')
    if (trapToggle) trapToggle.onchange = () => { toggleTrap() }
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
        const ownedHere = ownedIds.filter(id => { const od = defOf(id); return od && od.slot === slot })
        if (ownedHere.length) {
          const wearBtns = ownedHere.map(oid => {
            const od = defOf(oid)
            return `<button class="btn restr-btn" data-act="wear" data-slot="${slot}" data-id="${oid}">📿 ${od.name}</button>`
          }).join('')
          return `<div class="restr-card restr-empty has-owned"><i>${SLOT_ICONS[slot]}</i><span><b>${SLOT_NAMES[slot]}</b><small>已拥有 ${ownedHere.map(id => defOf(id).name).join('、')}</small></span><div class="restr-actions">${wearBtns}</div></div>`
        }
        return `<div class="restr-card restr-empty"><i>${SLOT_ICONS[slot]}</i><span><b>${SLOT_NAMES[slot]}</b><small>空</small></span></div>`
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
        : `<button class="btn restr-btn" data-act="remove" data-slot="${slot}">✋ 脱下</button>`
      return `<div class="restr-card"><i>${SLOT_ICONS[slot]}</i><span><b>${def.name}</b><small>${def.desc}</small></span>${lockTag}${actionsHtml}</div>`
    }).join('')

    Dialog.show({
      title: '⛓️ 妖缚装置',
      className: 'inventory-modal restraint-modal',
      body: `<div class="restr-top"><span>已佩戴 <b>${countWorn()}</b> 件 · 上锁 <b>${countLocked()}</b> 件</span><em>战斗金币 +${bonus}%</em></div>
        ${bodyDiagram()}
        <div class="restr-grid">${cards}</div>
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
    equip, remove, restore, isStory, isHeavy, isCursed, canCut, cut, struggle,
    useKey, useLockpick, useCurseRemover, npcUnlock, npcUnlockCost,
    setTimer, tickTimers, lockedSlots,
    hasGag, hasHandcuffs, hasLegCuffs, hasCollar, hasArmbinder, hasBlindfold, hasWaistChastity, hasHandsBlocked, hasVibrating,
    hasNipple, hasCorset, hasAnkleChains, hasDevice,
    settings, toggleTrap, removeAllUnlocked, bodyDiagram,
    openManage, openSettings,
  }
})()
