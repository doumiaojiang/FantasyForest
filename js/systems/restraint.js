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
  const SLOT_ORDER = ['neck', 'mouth', 'arms', 'legs', 'waist']
  const SLOT_NAMES = { neck: '颈部', mouth: '嘴部', arms: '手臂', legs: '腿部', waist: '腰部' }
  const SLOT_ICONS = { neck: '🐕', mouth: '🤐', arms: '⛓️', legs: '🦶', waist: '🔒' }
  const BLADES = ['rusty_knife', 'basic_sword', 'master_sword', 'sharp_rock']

  function raw () { return State.get()._restraints || {} }
  function get (slot) { return raw()[slot] || null }
  function defOf (id) { return (RESTRAINTS || []).find(r => r.id === id) }
  function isWorn (slot) { return !!get(slot) }
  function isLocked (slot) { const d = get(slot); return !!(d && d.locked) }
  function countLocked () { return SLOT_ORDER.filter(isLocked).length }
  function countWorn () { return SLOT_ORDER.filter(isWorn).length }

  /** 上锁装置金币加成：每件 +5%，上限 +30% */
  function goldBonus () { return Math.min(0.30, countLocked() * 0.05) }

  function set (slot, device) {
    const r = raw()
    if (device === null) delete r[slot]
    else r[slot] = device
    State.get()._restraints = r
    EventBus.emit('state:changed', State.get())
  }

  /** 佩戴装置（可上锁或普通佩戴） */
  function equip (slot, id, opts = {}) {
    if (get(slot)) return { ok: false, msg: '该部位已经锁着东西了' }
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

  function remove (slot) {
    if (!get(slot)) return { ok: false, msg: '这里没有装置' }
    set(slot, null)
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

  /** 使用钥匙：普通钥匙开普通锁；万能钥匙开任意非剧情锁 */
  function useKey (slot) {
    const d = get(slot)
    if (!d || !d.locked) return { ok: false, msg: '这里没有上锁的装置' }
    const inv = State.get().inventory.consumables
    if ((inv.master_key || 0) <= 0 && (inv.restraint_key || 0) <= 0) return { ok: false, msg: '没有钥匙' }
    if (isStory(slot) && (inv.master_key || 0) <= 0) return { ok: false, msg: '这是剧情锁，普通钥匙打不开' }
    if ((inv.master_key || 0) > 0) {
      if (isStory(slot)) return { ok: false, msg: '剧情锁只能走剧情解除' }
      inv.master_key--
    } else {
      inv.restraint_key--
    }
    remove(slot)
    EventBus.emit('ui:log', { text: '🔑 钥匙咔哒一声，锁开了，装置脱落。', type: 'good' })
    EventBus.emit('state:changed', State.get())
    return { ok: true, msg: '用钥匙解开了' }
  }

  /** 开锁工具：60% 成功，失败损耗 */
  function useLockpick (slot) {
    const d = get(slot)
    if (!d || !d.locked) return { ok: false, msg: '这里没有上锁的装置' }
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

  /* ---------- NPC 帮助 ---------- */

  function npcUnlockCost (slot) {
    const d = get(slot)
    if (!d) return 0
    const def = defOf(d.id)
    return (def && def.material === 'metal') ? 250 : 150
  }

  function npcUnlock (slot) {
    const d = get(slot)
    if (!d) return { ok: false, msg: '这里没有装置' }
    if (!d.locked) { remove(slot); return { ok: true, msg: '已脱下' } }
    const state = State.get()
    const cost = npcUnlockCost(slot)
    if (state.gold < cost) return { ok: false, msg: `钱不够（需要 ${cost}G）` }
    state.gold -= cost
    remove(slot)
    EventBus.emit('ui:log', { text: `🔓 铁匠收了 ${cost}G，帮你解开了束缚。`, type: 'good' })
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
  function hasWaistChastity () {
    const d = get('waist')
    const def = d && defOf(d.id)
    return !!(def && def.effect === 'chastity')
  }

  /* ---------- 管理页 ---------- */

  function openManage () {
    const state = State.get()
    const bonus = Math.round(goldBonus() * 100)
    const cards = SLOT_ORDER.map(slot => {
      const d = get(slot)
      const def = d && defOf(d.id)
      if (!d) {
        return `<div class="restr-card restr-empty"><i>${SLOT_ICONS[slot]}</i><span><b>${SLOT_NAMES[slot]}</b><small>空</small></span></div>`
      }
      const lockTag = d.locked
        ? `<em class="restr-lock">${d.jammed ? '⛓️ 卡死' : isStory(slot) ? '📜 剧情锁' : '🔒 上锁'}</em>`
        : `<em class="restr-open">✓ 未锁</em>`
      const actionsHtml = d.locked
        ? `<div class="restr-actions">
             ${d.jammed ? '' : `<button class="btn restr-btn" data-act="struggle" data-slot="${slot}">💪 挣扎</button>`}
             ${canCut(slot) ? `<button class="btn restr-btn" data-act="cut" data-slot="${slot}">🔪 割断</button>` : ''}
             <button class="btn restr-btn" data-act="key" data-slot="${slot}">🔑 钥匙</button>
             <button class="btn restr-btn" data-act="lockpick" data-slot="${slot}">🛠️ 撬锁</button>
             <button class="btn restr-btn" data-act="npc" data-slot="${slot}">🔧 求助铁匠</button>
           </div>`
        : `<button class="btn restr-btn" data-act="remove" data-slot="${slot}">✋ 脱下</button>`
      return `<div class="restr-card"><i>${SLOT_ICONS[slot]}</i><span><b>${def.name}</b><small>${def.desc}</small></span>${lockTag}${actionsHtml}</div>`
    }).join('')

    Dialog.show({
      title: '⛓️ 妖缚装置',
      className: 'restr-modal',
      body: `<div class="restr-top"><span>已佩戴 <b>${countWorn()}</b> 件 · 上锁 <b>${countLocked()}</b> 件</span><em>战斗金币 +${bonus}%</em></div>
        <div class="restr-grid">${cards}</div>
        <p class="camp-footnote">普通钥匙开普通锁；万能钥匙开任意非剧情锁；开锁工具 60% 成功。挣扎失败永久 +10% 成功率，失败 3 次后必定成功；皮革/绳索可用尖石/刀/剑割断。</p>`,
      actions: [{ label: '关闭', handler: () => Dialog.close() }],
    })
    setTimeout(() => {
      document.querySelectorAll('[data-act]').forEach(btn => {
        btn.onclick = () => {
          const slot = btn.dataset.slot
          const act = btn.dataset.act
          let result = null
          if (act === 'struggle') result = struggle(slot)
          else if (act === 'cut') result = cut(slot)
          else if (act === 'key') result = useKey(slot)
          else if (act === 'lockpick') result = useLockpick(slot)
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
    equip, remove, isStory, canCut, cut, struggle, useKey, useLockpick, npcUnlock, npcUnlockCost,
    hasGag, hasHandcuffs, hasLegCuffs, hasCollar, hasWaistChastity,
    openManage,
  }
})()