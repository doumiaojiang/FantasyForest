/**
 * systems/equipment.js — 装备栏系统
 *
 * 武器 + 饰品槽位化，装备栏显示每个槽位穿戴/空缺状态，可随时切换/穿脱。
 * 饰品每类一件（项链/手环/戒指/印记），贞操装置归妖缚系统（不在装备栏）。
 */

window.EquipmentSystem = (function () {
  const SLOTS = [
    { id: 'necklace', name: '项链', icon: '📿', itemId: 'sacrificial_necklace' },
    { id: 'bracelet', name: '手环', icon: '💚', itemId: 'health_bracelet' },
    { id: 'ring', name: '戒指', icon: '💍', itemId: 'ring_of_love' },
    { id: 'seal', name: '印记', icon: '🛡️', itemId: 'seal_of_resilience' },
  ]

  function st () { return State.get() }
  function weapon () { return st().inventory.weapon }
  function owned () { return st().ownedEquipment || [] }
  function wornAccessories () { return st().inventory.accessories || [] }
  function wornCount () { return (weapon() ? 1 : 0) + SLOTS.filter(s => wornAccessories().includes(s.itemId)).length }
  function totalCount () { return 1 + SLOTS.length }

  function isWorn (itemId) {
    const item = ItemLib.get(itemId)
    if (item && item.type === 'weapon') return st().inventory.weapon === itemId
    return (st().inventory.accessories || []).includes(itemId)
  }

  /** 打开装备栏 */
  function openEquipment () {
    const stt = st()
    const ownedWeapons = (owned() || []).filter(id => { const it = ItemLib.get(id); return it && it.type === 'weapon' })
    const weaponHtml = ownedWeapons.length
      ? ownedWeapons.map(id => {
          const it = ItemLib.get(id)
          const isCur = weapon() === id
          return `<button class="eq-item${isCur ? ' is-owned' : ''}" data-eq="weapon" data-id="${id}" ${isCur ? 'disabled' : ''}>
            <span class="merchant-item-icon">${it.icon || '⚔️'}</span>
            <span class="merchant-item-info"><b>${it.name}</b><small>${it.desc}</small></span>
            <span class="merchant-item-price">${isCur ? '✓ 使用中' : '⚔️ 装备'}</span>
          </button>`
        }).join('')
      : '<p class="camp-muted">还没有武器——去铁匠铺买一把。</p>'

    const accessoryCards = SLOTS.map(s => {
      const worn = wornAccessories().includes(s.itemId)
      const item = ItemLib.get(s.itemId)
      const hasIt = (owned() || []).includes(s.itemId)
      return `<div class="eq-slot${worn ? ' is-worn' : hasIt ? ' is-owned' : ''}">
        <i>${s.icon}</i>
        <span><b>${s.name}</b><small>${worn ? item.name : hasIt ? `${item.name}（未穿戴）` : '空'}</small></span>
        ${worn
          ? `<button class="btn restr-btn" data-eq="unequip" data-id="${s.itemId}">✋ 取下</button>`
          : hasIt
            ? `<button class="btn restr-btn" data-eq="equip" data-id="${s.itemId}">📿 穿戴</button>`
            : `<em class="eq-empty">未拥有</em>`}
      </div>`
    }).join('')

    Dialog.show({
      title: '🛡️ 装备栏',
      className: 'restr-modal',
      body: `<div class="restr-top"><span>武器 + 饰品</span><em>已装备 ${wornCount()}/${totalCount()}</em></div>
        <div class="eq-section"><b class="eq-label">⚔️ 武器（点击切换）</b><div class="eq-weapon-list">${weaponHtml}</div></div>
        <div class="eq-section"><b class="eq-label">📿 饰品（每类一件）</b><div class="eq-grid">${accessoryCards}</div></div>
        <p class="camp-footnote">贞操装置属于妖缚系统，请从 ⛓️ 妖缚 进入查看。</p>`,
      actions: [{ label: '关闭', handler: () => Dialog.close() }],
    })
    setTimeout(() => {
      document.querySelectorAll('[data-eq]').forEach(btn => {
        btn.onclick = () => {
          const act = btn.dataset.eq
          const id = btn.dataset.id
          const r = (act === 'weapon' || act === 'equip') ? ShopSystem.equip(id) : ShopSystem.unequip(id)
          if (r && r.msg) EventBus.emit('ui:log', { text: r.msg, type: r.ok ? 'good' : 'danger' })
          Dialog.close()
          openEquipment()
        }
      })
    }, 0)
  }

  return { SLOTS, weapon, owned, isWorn, wornCount, totalCount, openEquipment }
})()