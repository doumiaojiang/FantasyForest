/**
 * systems/shop.js — 商店系统
 *
 * 职责：
 *  - 打开商店弹窗
 *  - 购买逻辑（消耗品限购 2 件、装备唯一、停格半价）
 *  - 使用消耗品
 *
 * 事件：shop:open / shop:buy / shop:close
 * 商品数据源：ITEMS（data/items.js）
 */

window.LifeLink = {
  applyHealing (state, amount) {
    const enemy = state._battle ? DATA.monster(state._battle.enemyId) : null
    // 玩家自己使用治疗道具：始终正常回血（不转给森林之灵，Boss 反转只针对攻击类治疗）
    if (!state._battle || !enemy || !enemy.props || !enemy.props.lifeLink || !state._battle.targets[0]) {
      state.hp = Math.min(state.maxHp, state.hp + amount)
      return null
    }
    // 魅魔：50% 治疗转移（生命链接）
    const toPlayer = Math.floor(amount / 2)
    const toEnemy = amount - toPlayer
    state.hp = Math.min(state.maxHp, state.hp + toPlayer)
    const cap = enemy.props.maxSelfHp || 10
    state._battle.targets[0].hp = Math.min(cap, state._battle.targets[0].hp + toEnemy)
    return { player: toPlayer, transfer: toEnemy }
  },
}

window.ShopSystem = (function () {
  let _open = false
  let _stock = {}      // { itemId: number } 当前库存

  // 野外旅行商人只携带应急妖缚补给；高级工具与满充灵魂石仍由城镇专营。
  const TRAVEL_RESTRAINT_STOCK = {
    restraint_lock: 1,
    restraint_key: 1,
    lockpick: 1,
    petty_soul_gem: 2,
    lesser_soul_gem: 1,
  }

  /** 打开商店（初始化库存） */
  function open (tile) {
    const state = State.get()
    // tile=null 表示刷新后恢复商店，保留原来的返回目标。
    if (tile) {
      state._shopReturnToCamp = tile.type === TILE.CAMP
      state._activeShopRaw = tile.raw || null
    }
    _open = true
    _stock = {}

    // 消耗品：每种 2 件（"重生商店"库存无限）；小鹿树枝不可购买
    // tile=null 为读档恢复，此时按玩家脚下格子还原商店类型。
    const currentTile = MapLib.get(state.position.x, state.position.y)
    const effectiveTile = tile || (currentTile ? { ...currentTile, raw: state._activeShopRaw || currentTile.raw } : null)
    const isRespawnShop = effectiveTile && effectiveTile.raw === '重生商店'
    const isTravelShop = effectiveTile && effectiveTile.type === TILE.SHOP && !isRespawnShop
    ITEMS.consumables.forEach(item => {
      if (item.id === 'twig') return   // 树枝只能由小鹿剧情获得
      if (item.id === 'guard_pass') return   // 免检查卷只能由卫兵任务获得
      if (Object.prototype.hasOwnProperty.call(TRAVEL_RESTRAINT_STOCK, item.id)) {
        if (isTravelShop) _stock[item.id] = TRAVEL_RESTRAINT_STOCK[item.id]
        return
      }
      if (['master_key', 'curse_remover', 'common_soul_gem'].includes(item.id)) return // 高级妖缚补给由城镇专营
      _stock[item.id] = isRespawnShop ? 99 : 2
    })

    // 同步 _freeUpgrade 标记与背包材料状态（防旧档不一致）
    if (state.inventory.consumables['weapon_upgrade_material'] > 0) {
      state._freeUpgrade = true
    }

    // 装备：靠购买记录控制唯一性，不设库存计数
    state.phase = 'shop'
    EventBus.emit('shop:open', { tile: effectiveTile, isRespawnShop })
  }

  /** 购买物品 */
  function buy (itemId) {
    const state = State.get()
    const item = ItemLib.get(itemId)
    if (!item) return { ok: false, msg: '物品不存在' }

    // 消耗品
    if (item.type === 'consumable') {
      if (itemId === 'twig') return { ok: false, msg: '树枝只能由小鹿剧情获得' }
      // 女性专用塞入物：男性无法购买/使用
      if ((itemId === 'vibrator_egg' || itemId === 'vibrating_dildo') && state.gender === 'male') {
        return { ok: false, msg: '这是女性专用的塞入物' }
      }
      if (!_stock[itemId] || _stock[itemId] <= 0) return { ok: false, msg: '已售罄' }
      const price = getPrice(item)
      if (state.gold < price) return { ok: false, msg: '金币不足' }
      state.gold -= price
      _stock[itemId]--
      state.inventory.consumables[itemId] = (state.inventory.consumables[itemId] || 0) + 1
      EventBus.emit('shop:buy', { item, price })
      EventBus.emit('state:changed', state)
      return { ok: true, item, price }
    }

    // 武器
    if (item.type === 'weapon') {
      if (state.ownedEquipment.includes(itemId)) return { ok: false, msg: '已拥有' }
      if (itemId === 'master_sword' && !hasAllWeapons()) return { ok: false, msg: '需持有尖石、锈刀、基础剑' }

      // 免费升级材料：首次武器免费（不适用于大师之剑）
      if (state._freeUpgrade && itemId !== 'master_sword') {
        state.inventory.weapon = itemId
        state.ownedEquipment.push(itemId)
        // 消耗背包材料
        state.inventory.consumables['weapon_upgrade_material'] = (state.inventory.consumables['weapon_upgrade_material'] || 1) - 1
        state._freeUpgrade = false
        EventBus.emit('ui:log', { text: '🛠️ 免费升级材料被使用，武器免费获得！', type: 'good' })
        EventBus.emit('shop:buy', { item, price: 0 })
        EventBus.emit('state:changed', state)
        return { ok: true, item, price: 0 }
      }

      // 持有免费升级材料时购买大师之剑：材料抵扣 500 金币，一次完成购买
      if (state._freeUpgrade && itemId === 'master_sword' && hasAllWeapons()) {
        const price = Math.max(0, getPrice(item) - 500)
        if (state.gold < price) return { ok: false, msg: '金币不足（材料抵扣后仍需 ' + price + 'G）' }
        state.gold -= price
        // 消耗背包材料
        state.inventory.consumables['weapon_upgrade_material'] = (state.inventory.consumables['weapon_upgrade_material'] || 1) - 1
        state._freeUpgrade = false
        state.inventory.weapon = itemId
        state.ownedEquipment.push(itemId)
        EventBus.emit('ui:log', { text: '⚔️ 材料抵扣 500G，成功购买大师之剑！', type: 'good' })
        EventBus.emit('shop:buy', { item, price })
        EventBus.emit('state:changed', state)
        return { ok: true, item, price }
      }

      const price = getPrice(item)
      if (state.gold < price) return { ok: false, msg: '金币不足' }
      state.gold -= price
      state.inventory.weapon = itemId
      state.ownedEquipment.push(itemId)
      EventBus.emit('shop:buy', { item, price })
      EventBus.emit('state:changed', state)
      return { ok: true, item, price }
    }

    // 饰品（可穿多件）
    if (item.type === 'accessory') {
      if (state.ownedEquipment.includes(itemId)) return { ok: false, msg: '已拥有' }
      const price = getPrice(item)
      if (state.gold < price) return { ok: false, msg: '金币不足' }
      state.gold -= price
      state.ownedEquipment.push(itemId)
      // 自动穿戴并立即生效
      if (!state.inventory.accessories.includes(itemId)) state.inventory.accessories.push(itemId)
      if (!state.inventory.accessory) state.inventory.accessory = itemId
      // 装备效果立即生效
      if (item.effect.stat === 'maxHp') {
        state.maxHp += item.effect.value
        state.hp += item.effect.value
      }
      EventBus.emit('shop:buy', { item, price })
      EventBus.emit('state:changed', state)
      return { ok: true, item, price }
    }

    return { ok: false, msg: '无法购买' }
  }

  /** 重新装备已购买的装备（免费切换） */
  function equip (itemId) {
    const state = State.get()
    const item = ItemLib.get(itemId)
    if (!item) return { ok: false, msg: '物品不存在' }
    if (!(state.ownedEquipment || []).includes(itemId)) return { ok: false, msg: '尚未购买' }
    if (item.type === 'weapon') {
      if (state.inventory.weapon === itemId) return { ok: false, msg: '已装备中' }
      state.inventory.weapon = itemId
      EventBus.emit('shop:buy', { item, price: 0, reequip: true })
      EventBus.emit('ui:log', { text: `⚔️ 重新装备了 ${item.name}`, type: 'good' })
      EventBus.emit('state:changed', state)
      return { ok: true, item, price: 0, reequip: true }
    }
    if (item.type === 'accessory') {
      if (state.inventory.accessories.includes(itemId)) return { ok: false, msg: '已装备中' }
      state.inventory.accessories.push(itemId)
      if (!state.inventory.accessory) state.inventory.accessory = itemId
      // 穿戴时立即生效：只提升上限，不回血（避免反复穿脱刷血）
      if (item.effect.stat === 'maxHp') {
        state.maxHp += item.effect.value
      }
      EventBus.emit('shop:buy', { item, price: 0, reequip: true })
      EventBus.emit('ui:log', { text: `📿 装备了 ${item.name}`, type: 'good' })
      EventBus.emit('state:changed', state)
      return { ok: true, item, price: 0, reequip: true }
    }
    return { ok: false, msg: '只能装备武器或饰品' }
  }

  /** 卸下饰品 */
  function unequip (itemId) {
    const state = State.get()
    const item = ItemLib.get(itemId)
    if (!item) return { ok: false, msg: '物品不存在' }
    if (!(state.inventory.accessories || []).includes(itemId)) return { ok: false, msg: '未穿戴该饰品' }

    // 移除属性加成
    if (item.effect.stat === 'maxHp') {
      state.maxHp = Math.max(1, state.maxHp - item.effect.value)
      state.hp = Math.min(state.hp, state.maxHp)
    }
    state.inventory.accessories = state.inventory.accessories.filter(id => id !== itemId)
    if (state.inventory.accessory === itemId) state.inventory.accessory = null

    // 牺牲项链：取下即消失（从已购记录删除）
    let vanished = false
    if (item.effect.special === 'sacrifice') {
      state.ownedEquipment = (state.ownedEquipment || []).filter(id => id !== itemId)
      vanished = true
    }

    EventBus.emit('ui:log', { text: `📿 取下了 ${item.name}${vanished ? '（已消失）' : ''}。`, type: 'good' })
    EventBus.emit('state:changed', state)
    return { ok: true, item, vanished }
  }

  /** 关闭商店 */
  function close () {
    _open = false
    const state = State.get()
    const returnToCamp = !!state._shopReturnToCamp
    state._shopReturnToCamp = false
    state._activeShopRaw = null
    state.phase = returnToCamp ? 'camp' : 'idle'
    EventBus.emit('shop:close', {})
    EventBus.emit('state:changed', state)
    if (returnToCamp && typeof CampSystem !== 'undefined') CampSystem.open()
    else GameFlow.afterEvent()
  }

  /** 在战斗中使用消耗品 */
  function useConsumable (itemId) {
    const state = State.get()
    const combat = state._battle || state._ambush
    const count = state.inventory.consumables[itemId] || 0
    if (count <= 0) return { ok: false, msg: '没有该物品' }

    const item = ItemLib.get(itemId)
    if (!item) return { ok: false, msg: '物品不存在' }
    if (itemId === 'twig') return { ok: false, msg: '树枝是武器，不能直接使用' }
    if (itemId === 'restraint_lock' || itemId === 'restraint_key' || itemId === 'master_key' || itemId === 'lockpick' || itemId === 'curse_remover') {
      return { ok: false, msg: '锁具、钥匙、开锁工具和驱咒符请在妖缚装置页面使用（HUD ⛓️）' }
    }
    if (itemId === 'petty_soul_gem' || itemId === 'lesser_soul_gem' || itemId === 'common_soul_gem') {
      return { ok: false, msg: '请先选择要充能的菊穴或小穴装备' }
    }

    // 满血时不能使用治疗类道具（避免浪费）
    if (item.effect.heal && state.hp >= state.maxHp) {
      return { ok: false, msg: '你已是满血，无法使用治疗物品' }
    }

    state.inventory.consumables[itemId]--
    applyEffect(item.effect)
    EventBus.emit('ui:log', { text: `使用了 ${item.name}。`, type: 'good' })
    EventBus.emit('state:changed', state)
    return { ok: true, item }
  }

  function isSoulGem (itemId) {
    return ['petty_soul_gem', 'lesser_soul_gem', 'common_soul_gem'].includes(itemId)
  }

  /** 使用一颗灵魂石给指定插入装备充能；城镇与野外均可。 */
  function useSoulGem (itemId, slot) {
    const state = State.get()
    const item = ItemLib.get(itemId)
    if (!item || !isSoulGem(itemId)) return { ok: false, msg: '这不是可用的灵魂石' }
    if ((state.inventory.consumables[itemId] || 0) <= 0) return { ok: false, msg: '没有该灵魂石' }
    if (typeof RestraintSystem === 'undefined') return { ok: false, msg: '妖缚装备系统尚未加载' }
    const entry = RestraintSystem.insertionDevice(slot)
    const info = RestraintSystem.insertionCharge(slot)
    if (!entry || !info) return { ok: false, msg: '该部位没有可充能的插入装备' }
    if (info.current >= info.max) return { ok: false, msg: `${entry.def.name}已经充满` }
    const power = Math.max(1, Math.floor(Number(item.effect && item.effect.charge) || 1))
    const added = Math.min(info.max - info.current, power)
    state.inventory.consumables[itemId]--
    const result = RestraintSystem.setInsertionCharge(slot, info.current + added)
    EventBus.emit('ui:log', { text: `💎 使用${item.name}，${RestraintSystem.SLOT_NAMES[slot]}装备恢复 ${added} 点防护充能（${result.current}/${result.max}）。`, type: 'good' })
    EventBus.emit('state:changed', state)
    return { ok: true, item, slot, added, current: result.current, max: result.max }
  }

  /** 弹出部位选择；onDone 只在成功消耗灵魂石后调用。 */
  function openSoulGemCharge (itemId, onDone, onCancel) {
    const item = ItemLib.get(itemId)
    const slots = ['anal', 'vagina'].filter(slot => {
      const info = typeof RestraintSystem !== 'undefined' ? RestraintSystem.insertionCharge(slot) : null
      return info && info.current < info.max
    })
    if (!item || !isSoulGem(itemId)) return false
    if (!slots.length) {
      EventBus.emit('ui:log', { text: '没有需要充能的插入装备，灵魂石未消耗。', type: 'dim' })
      return false
    }
    const cards = slots.map(slot => {
      const entry = RestraintSystem.insertionDevice(slot)
      const info = RestraintSystem.insertionCharge(slot)
      return `<button class="camp-opt" data-soul-slot="${slot}"><i>${RestraintSystem.SLOT_ICONS[slot]}</i><span><b>${entry.def.name}</b><small>${RestraintSystem.SLOT_NAMES[slot]} · 当前 ${info.current}/${info.max}</small></span><em>充能</em></button>`
    }).join('')
    Dialog.show({
      title: `💎 使用${item.name}`,
      body: `<p class="camp-muted">选择要注入灵魂力量的装备。满充装备不会显示，灵魂石不会被浪费。</p><div class="camp-grid">${cards}</div>`,
      actions: [{ label: '取消', handler: () => { Dialog.close(); if (onCancel) onCancel() } }],
    })
    document.querySelectorAll('[data-soul-slot]').forEach(btn => {
      btn.onclick = () => {
        const result = useSoulGem(itemId, btn.dataset.soulSlot)
        Dialog.close()
        if (!result.ok) EventBus.emit('ui:log', { text: result.msg, type: 'danger' })
        else if (onDone) onDone(result)
      }
    })
    return true
  }

  /** 消耗一次 DD 插入装备格挡（菊穴与小穴分别计数）。 */
  function consumeBlockForPart (part) {
    const state = State.get()
    const combat = state._battle || state._ambush
    if (!combat) return false
    if (combat.insertionBlocks && typeof combat.insertionBlocks === 'object') {
      const consumeSlot = slot => {
        if ((combat.insertionBlocks[slot] || 0) <= 0) return false
        combat.insertionBlocks[slot]--
        combat.blocked = Math.max(0, (combat.insertionBlocks.anal || 0) + (combat.insertionBlocks.vagina || 0))
        if (!state._insertionCharges || typeof state._insertionCharges !== 'object') state._insertionCharges = {}
        state._insertionCharges[slot] = combat.insertionBlocks[slot]
        const entry = typeof RestraintSystem !== 'undefined' ? RestraintSystem.insertionDevice(slot) : null
        if (entry) entry.device.charge = combat.insertionBlocks[slot]
        const slotName = slot === 'anal' ? '菊穴' : '小穴'
        const left = combat.insertionBlocks[slot]
        const deviceName = entry ? entry.def.name : slotName + '插入装备'
        const max = entry && typeof RestraintSystem !== 'undefined'
          ? (RestraintSystem.insertionCharge(slot)?.max || left + 1)
          : left + 1
        const notice = typeof RestraintSystem !== 'undefined' && RestraintSystem.chargeNoticeText
          ? RestraintSystem.chargeNoticeText(deviceName, left, max)
          : `⚡ ${deviceName}消耗 1 点防护充能，剩余 ${left} 点。`
        if (notice) EventBus.emit('ui:log', { text: notice, type: left > 0 ? 'good' : 'dim' })
        return true
      }
      if (part === 'anal' || part === 'vagina') return consumeSlot(part)
      return false
    }
    return false
  }

  function applyEffect (effect) {
    const state = State.get()
    const combat = state._battle || state._ambush
    if (effect.heal) {
      const actualHeal = LifeLink.applyHealing(state, effect.heal)
      if (actualHeal) EventBus.emit('ui:log', { text: `生命链接转移了 ${actualHeal.transfer} HP 给 ${state._battle ? DATA.monster(state._battle.enemyId)?.name : '敌人'}`, type: 'dim' })
    }
    if (effect.cure) effect.cure.forEach(id => StatusSystem.remove(id))
    if (effect.regen) StatusSystem.apply('regeneration', effect.regen.turns, { level: effect.regen.level, source: 'player' })
    if (effect.orb) { if (combat) combat.orbBoost = true }
    if (effect.reflect) { if (combat) combat.reflectTurns += effect.turns || 2 }
  }

  /** 价格计算（停格半价普通模式） */
  function getPrice (item) {
    const state = State.get()
    if (state.difficulty !== 'normal') return item.price
    // 检查是否停格在商店
    const tile = MapLib.get(state.position.x, state.position.y)
    if (tile && tile.type === TILE.SHOP) return Math.floor(item.price / 2)
    return item.price
  }

  function hasAllWeapons () {
    const owned = State.get().ownedEquipment || []
    const required = ['sharp_rock', 'rusty_knife', 'basic_sword']
    return required.every(id => owned.includes(id))
  }

  function getStock () { return { ..._stock } }

  /** 买回衣服（解除全裸状态），代价 200 金币 */
  function buyClothes () {
    const state = State.get()
    if (!StatusSystem.has('naked')) return { ok: false, msg: '你不需要衣服' }
    const price = 200
    if (state.gold < price) return { ok: false, msg: '金币不足（需要 200G）' }
    state.gold -= price
    StatusSystem.remove('naked')
    state.clothesDeposited = false
    EventBus.emit('ui:log', { text: '👕 你买回了衣服，不再全裸！', type: 'good' })
    return { ok: true }
  }

  /** 复活佣兵：死亡佣兵花 50G 复活 */
  function reviveMercenary (useDebt = false) {
    const state = State.get()
    if (!state._mercenary || !state._mercenary.dead) return { ok: false, msg: '没有需要复活的佣兵' }
    const price = 50
    if (!useDebt && state.gold < price) return { ok: false, msg: '金币不足（需要 50G）' }
    if (useDebt) {
      if (!window.MercenaryContractSystem || !MercenaryContractSystem.enabled()) return { ok: false, msg: '佣兵债务系统未启用' }
      const debtResult = MercenaryContractSystem.addDebt(price, '复活佣兵')
      if (!debtResult.ok) return debtResult
    } else state.gold -= price
    state._mercenary.dead = false
    EventBus.emit('ui:log', { text: `💚 ${state._mercenary.icon} ${state._mercenary.name} 在商店治好了伤，重新站了起来${useDebt ? '（费用记入佣兵债务）' : ''}！`, type: 'good' })
    EventBus.emit('state:changed', state)
    return { ok: true }
  }

  return { open, buy, equip, unequip, close, useConsumable, isSoulGem, useSoulGem, openSoulGemCharge, consumeBlockForPart, getStock, buyClothes, reviveMercenary }
})()
