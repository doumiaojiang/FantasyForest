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

  /** 打开商店（初始化库存） */
  function open (tile) {
    const state = State.get()
    // tile=null 表示刷新后恢复商店，保留原来的返回目标。
    if (tile) state._shopReturnToCamp = tile.type === TILE.CAMP
    _open = true
    _stock = {}

    // 消耗品：每种 2 件（"重生商店"库存无限）；小鹿树枝不可购买
    const isRespawnShop = tile && tile.raw === '重生商店'
    ITEMS.consumables.forEach(item => {
      if (item.id === 'twig') return   // 树枝只能由小鹿剧情获得
      if (item.id === 'guard_pass') return   // 免检查卷只能由卫兵任务获得
      _stock[item.id] = isRespawnShop ? 99 : 2
    })

    // 同步 _freeUpgrade 标记与背包材料状态（防旧档不一致）
    if (state.inventory.consumables['weapon_upgrade_material'] > 0) {
      state._freeUpgrade = true
    }

    // 装备：靠购买记录控制唯一性，不设库存计数
    state.phase = 'shop'
    EventBus.emit('shop:open', { tile, isRespawnShop })
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

    // 女性专用塞入物：男性无法使用
    if ((itemId === 'vibrator_egg' || itemId === 'vibrating_dildo') && state.gender === 'male') {
      return { ok: false, msg: '这是女性专用的塞入物' }
    }

    const item = ItemLib.get(itemId)
    if (!item) return { ok: false, msg: '物品不存在' }
    if (itemId === 'twig') return { ok: false, msg: '树枝是武器，不能直接使用' }

    // 满血时不能使用治疗类道具（避免浪费）
    if (item.effect.heal && state.hp >= state.maxHp) {
      return { ok: false, msg: '你已是满血，无法使用治疗物品' }
    }

    // 可取下塞入物（巨肛塞 / 震动假阳具）：塞入时扣 1 个，取下/用尽时还回；菊穴只能塞一个
    if (itemId === 'big_butt_plug' || itemId === 'vibrating_dildo') {
      if (state._plugActive) return { ok: false, msg: '已塞入塞入物，可在物品菜单取下' }
      if (combat && combat.smallPlugBlocked > 0) return { ok: false, msg: '菊穴里已经塞了别的肛塞！' }
      state.inventory.consumables[itemId]--
      state._plugActive = itemId
      if (combat) {
        combat.plugBlocked = item.effect.block || 3
        combat.blocked = (combat.smallPlugBlocked || 0) + (combat.plugBlocked || 0)
      }
      EventBus.emit('ui:log', { text: `🍑 塞入${item.name}，可抵挡 ${item.effect.block || 3} 次攻击！`, type: 'good' })
      EventBus.emit('state:changed', state)
      return { ok: true, item }
    }

    // 其他一次性肛塞类（小肛塞 / 跳蛋）：菊穴只能塞一个肛塞
    if (item.effect.block) {
      if (state._plugActive) return { ok: false, msg: '已塞入塞入物，请先取下' }
      if (combat && (combat.smallPlugBlocked || 0) > 0) return { ok: false, msg: '菊穴里已经塞了别的肛塞！' }
    }

    state.inventory.consumables[itemId]--
    applyEffect(item.effect)
    EventBus.emit('ui:log', { text: `使用了 ${item.name}。`, type: 'good' })
    EventBus.emit('state:changed', state)
    return { ok: true, item }
  }

  /** 取下塞入物（还回背包，只移除自身的格挡，保留小肛塞格挡） */
  function removePlug () {
    const state = State.get()
    const combat = state._battle || state._ambush
    if (!state._plugActive) return { ok: false, msg: '没有已塞入的塞入物' }
    const plugId = state._plugActive
    state._plugActive = false
    if (combat) {
      combat.plugBlocked = 0
      combat.blocked = combat.smallPlugBlocked || 0
    }
    state.inventory.consumables[plugId] = (state.inventory.consumables[plugId] || 0) + 1
    const plugItem = ItemLib.get(plugId)
    EventBus.emit('ui:log', { text: `🍑 取下了${plugItem ? plugItem.name : '塞入物'}，放回背包。`, type: 'good' })
    EventBus.emit('state:changed', state)
    return { ok: true }
  }

  /** 塞入物格挡被消耗一次（由战斗结算调用），用尽时自动还回背包 */
  function consumePlugCharge () {
    const state = State.get()
    const combat = state._battle || state._ambush
    if (!state._plugActive || !combat) return
    const plugId = state._plugActive
    combat.plugBlocked = Math.max(0, (combat.plugBlocked || 0) - 1)
    combat.blocked = (combat.smallPlugBlocked || 0) + combat.plugBlocked
    if (combat.plugBlocked === 0) {
      state._plugActive = false
      state.inventory.consumables[plugId] = (state.inventory.consumables[plugId] || 0) + 1
      const plugItem = ItemLib.get(plugId)
      EventBus.emit('ui:log', { text: `🍑 ${plugItem ? plugItem.name : '塞入物'}用尽，自动取下放回背包。`, type: 'good' })
    }
  }

  /** 消耗一次肛塞格挡（巨肛塞优先，否则小肛塞），同步总计数 */
  function consumeBlockCharge () {
    const state = State.get()
    const combat = state._battle || state._ambush
    if (!combat) return
    if (state._plugActive) {
      consumePlugCharge()
    } else if ((combat.smallPlugBlocked || 0) > 0) {
      combat.smallPlugBlocked--
      combat.blocked = combat.smallPlugBlocked + (combat.plugBlocked || 0)
    }
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
    // 小肛塞类：独立计数（巨肛塞单独用 plugBlocked）
    if (effect.block) {
      if (combat) {
        combat.smallPlugBlocked = (combat.smallPlugBlocked || 0) + effect.block
        combat.blocked = (combat.smallPlugBlocked || 0) + (combat.plugBlocked || 0)
      }
    }
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
  function reviveMercenary () {
    const state = State.get()
    if (!state._mercenary || !state._mercenary.dead) return { ok: false, msg: '没有需要复活的佣兵' }
    const price = 50
    if (state.gold < price) return { ok: false, msg: '金币不足（需要 50G）' }
    state.gold -= price
    state._mercenary.dead = false
    EventBus.emit('ui:log', { text: `💚 ${state._mercenary.icon} ${state._mercenary.name} 在商店治好了伤，重新站了起来！`, type: 'good' })
    EventBus.emit('state:changed', state)
    return { ok: true }
  }

  return { open, buy, equip, unequip, close, useConsumable, removePlug, consumePlugCharge, consumeBlockCharge, getStock, buyClothes, reviveMercenary }
})()
