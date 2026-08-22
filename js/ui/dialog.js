/**
 * ui/dialog.js — 弹窗系统
 *
 * 职责：
 *  - 通用弹窗：标题 + 正文 + 按钮
 *  - 战斗弹窗（分阶段展开）
 *  - 商店弹窗
 *  - 骰子动画
 *
 * 事件：ui:modal / ui:modalclose
 */

window.Dialog = (function () {
  const layer = document.getElementById('modal-layer')
  const diceLayer = document.getElementById('dice-layer')
  const diceDisplay = document.getElementById('dice-display')
  let previousFocus = null
  let dialogId = 0
  let currentDialog = null

  /** 打开通用弹窗 */
  function show (options) {
    const { title, body, actions = [], className = '' } = options
    currentDialog = options
    if (layer.classList.contains('modal-hidden')) previousFocus = document.activeElement
    const titleId = `dialog-title-${++dialogId}`
    layer.innerHTML = `
      <div class="modal-box ${className}" role="dialog" aria-modal="true" ${title ? `aria-labelledby="${titleId}"` : 'aria-label="游戏提示"'}>
        ${title ? `<h3 class="modal-title" id="${titleId}">${title}</h3>` : ''}
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          ${actions.map((a, i) =>
            `<button class="btn ${a.cls || ''}" data-action="${i}">${a.label}</button>`
          ).join('')}
        </div>
      </div>`
    layer.classList.remove('modal-hidden')
    layer.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.action)
        const a = actions[idx]
        if (a && a.handler) a.handler()
      })
    })
    requestAnimationFrame(() => {
      const first = layer.querySelector('input:not([disabled]), button:not([disabled]), [tabindex="0"]')
      if (first) first.focus()
    })
    EventBus.emit('ui:modal', {})
  }

  function close () {
    currentDialog = null
    layer.classList.add('modal-hidden')
    layer.innerHTML = ''
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus()
    previousFocus = null
    EventBus.emit('ui:modalclose', {})
  }

  /** 返回当前弹窗配置，供临时设置菜单关闭后安全恢复流程。 */
  function getCurrent () {
    return currentDialog
  }

  layer.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || layer.classList.contains('modal-hidden')) return
    const focusable = [...layer.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })

  /** 骰子动画：显示数值并等待 */
  function showDice (value, label = '') {
    return new Promise(resolve => {
      diceDisplay.textContent = value
      diceDisplay.dataset.label = label
      diceLayer.classList.remove('dice-hidden')
      setTimeout(() => {
        diceLayer.classList.add('dice-hidden')
        delete diceDisplay.dataset.label
        resolve()
      }, 600)
    })
  }

  /** 分阶段展开的战斗弹窗 */
  function battleIntro (enemy, opts = {}) {
    if (enemy.props && enemy.props.isBoss) {
      // BOSS 台词按性别：男性救女友（小骚货），女性救男友（小男人）
      const gender = (typeof State !== 'undefined' && State.get()) ? State.get().gender : 'female'
      const intro = enemy.intro.map(line => {
        if (gender !== 'male') return line.replace('你的小骚货', '你的小男人')
        return line
      })
      const rules = (enemy.bossRules || []).map(rule => `
        <article class="boss-rule-card">
          <span>${rule.icon}</span>
          <div><b>${rule.title}</b><p>${rule.text}</p></div>
        </article>
      `).join('')
      const body = `
        <section class="boss-intro">
          <div class="boss-intro-hero">
            <span class="boss-sigil" aria-hidden="true">♛</span>
            <div><small>FINAL ENCOUNTER</small><h4>${enemy.name}</h4><p>${enemy.tagline}</p></div>
            <b class="boss-hp-badge">HP ${enemy.maxHp}</b>
          </div>
          <div class="boss-story">${intro.map((line, i) => `<p class="${i > 0 ? 'boss-quote' : ''}">${line}</p>`).join('')}</div>
          <div class="boss-flow" aria-label="BOSS 回合流程">
            <span><i>Y</i><b>召唤敌人</b></span><em>→</em><span><i>Z</i><b>决定攻击</b></span><em>→</em><span><i>×2</i><b>强化结算</b></span>
          </div>
          <div class="boss-rule-grid">${rules}</div>
          <div class="boss-objective"><span>唯一目标</span><b>击败森林之灵本体；无需清除仍存活的小兵</b></div>
        </section>`

      Dialog.show({
        title: '🌲 森林尽头的主人',
        body,
        className: 'boss-intro-modal',
        actions: [
          { label: '⚔️ 开始最终决战', cls: 'btn-danger', handler: () => { Dialog.close(); EventBus.emit('battle:ui:ready', {}) } },
        ],
      })
      return
    }

    const lines = [...enemy.intro]
    if (enemy.tagline) lines.push(`<em>${enemy.tagline}</em>`)
    if (opts.goblinCount) lines.unshift(`<b style="color:var(--danger)">👺 掷 Z → ${opts.goblinCount} 只哥布林扑了上来！</b>`)

    const dildo = DildoSystem.effective(enemy.id)
    const dildoText = dildo ? dildo.name : ''

    const body = lines.map(l => `<p>${l}</p>`).join('') +
      `<div style="margin-top:10px;display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;font-size:.85rem;color:var(--text);margin-bottom:4px">
            <span>${enemy.name}${opts.goblinCount ? ` ×${opts.goblinCount}` : ''} HP</span>
            <span>${enemy.maxHp}/${enemy.maxHp}</span>
          </div>
          <div style="height:14px;background:var(--hp-bg);border-radius:8px;overflow:hidden">
            <div style="height:100%;width:100%;background:linear-gradient(90deg,var(--danger),#ff8a8a);border-radius:8px"></div>
          </div>
        </div>
      </div>
      ${dildoText ? `<p style="margin-top:8px;color:var(--text-dim);font-size:.85rem">🍆 你需要使用：${dildoText}</p>` : ''}`

    Dialog.show({
      title: `⚔️ ${enemy.name}`,
      body,
      actions: [
        { label: '⚔️ 战斗开始！', cls: 'btn-primary', handler: () => { Dialog.close(); EventBus.emit('battle:ui:ready', {}) } },
      ],
    })
  }

  /** 商店弹窗 */
  function shop (tile, stock) {
    const state = State.get()
    // 半价基于当前位置（与 ShopSystem.getPrice 一致，读档后位置不变仍半价）
    const curTile = MapLib.get(state.position.x, state.position.y)
    const isHalf = state.difficulty === 'normal' && curTile && curTile.type === TILE.SHOP
    // 店铺类型：道具商只卖消耗品、铁匠铺只卖装备、其他全部
    const shopRaw = tile && tile.raw
    const isPotioneer = shopRaw === '道具商'
    const isBlacksmith = shopRaw === '铁匠铺'
    const ownedEquipment = state.ownedEquipment || []
    const hasMasterPrerequisites = ['sharp_rock', 'rusty_knife', 'basic_sword'].every(id => ownedEquipment.includes(id))
    const itemIcons = {
      ale: '🍺', antidote: '🧪', bandaid: '🩹', barrier_spell: '🔮', green_herb: '🌿', orb_of_power: '🔵', awakening: '☀️', special_cream: '🧴',
      butt_plug: '🔴', big_butt_plug: '🟣', vibrator_egg: '🥚', vibrating_dildo: '💗',
      sharp_rock: '🪨', rusty_knife: '🗡️', basic_sword: '⚔️', master_sword: '✨',
      sacrificial_necklace: '📿', health_bracelet: '💚', ring_of_love: '💍', seal_of_resilience: '🛡️',
    }
    let html = '<div class="shop-grid">'

    const renderItem = (item) => {
      const regularPrice = isHalf ? Math.floor(item.price / 2) : item.price
      let price = regularPrice
      if (state._freeUpgrade && item.type === 'weapon' && item.id !== 'master_sword') price = 0
      if (state._freeUpgrade && item.id === 'master_sword' && hasMasterPrerequisites) price = Math.max(0, regularPrice - 500)
      const owned = item.type === 'consumable' ? (state.inventory.consumables[item.id] || 0)
        : ownedEquipment.includes(item.id) ? 1 : 0
      const equipped = item.type === 'weapon' ? (state.inventory.weapon === item.id)
        : item.type === 'accessory' ? ((state.inventory.accessories || []).includes(item.id))
        : false
      const stockCount = stock[item.id]
      const canBuy = item.type === 'consumable' ? (stockCount > 0) : (owned === 0)
      const locked = item.id === 'master_sword' && !owned && !hasMasterPrerequisites
      const unaffordable = !owned && canBuy && !locked && state.gold < price
      const unavailable = (!owned && !canBuy) || locked || unaffordable

      let buttonHtml = ''
      if (item.type === 'consumable') {
        buttonHtml = canBuy
          ? `<button class="btn btn-primary btn-buy shop-btn" data-id="${item.id}" ${unaffordable ? 'disabled' : ''}>${unaffordable ? '金币不足' : '购买'}</button>`
          : `<span class="shop-item-status is-danger">售罄</span>`
      } else if (equipped) {
        // 武器：状态标签已显示“使用中”，按钮置灰；饰品显示“取下”
        buttonHtml = item.type === 'accessory'
          ? `<button class="btn btn-danger btn-unequip shop-btn" data-id="${item.id}">取下</button>`
          : `<span class="shop-item-status is-ok">装备中</span>`
      } else if (owned) {
        // 已购但未装备：可重新装备
        buttonHtml = `<button class="btn btn-success btn-equip shop-btn" data-id="${item.id}">装备</button>`
      } else {
        buttonHtml = `<button class="btn btn-primary btn-buy shop-btn" data-id="${item.id}" ${locked || unaffordable ? 'disabled' : ''}>${locked ? '尚未解锁' : unaffordable ? '金币不足' : '购买'}</button>`
      }

      return `
        <article class="shop-item${unavailable ? ' is-unavailable' : ''}${equipped || owned ? ' is-owned' : ''}">
          <div class="shop-item-main"><span class="shop-item-icon">${itemIcons[item.id] || (item.type === 'weapon' ? '⚔️' : item.type === 'accessory' ? '📿' : '🎒')}</span><div>
            <div class="shop-item-head"><b>${item.name}</b> ${(isHalf || price !== regularPrice) && price > 0 ? `<s>${item.price}G</s>` : ''} <span class="shop-price">${price === 0 ? '免费' : `${price}G`}</span></div>
            <div class="shop-item-desc">${item.desc}</div>
          </div></div>
          ${item.type === 'consumable'
            ? `<div class="shop-item-meta">
                <span>🎒 已有 <b>${owned}</b></span>
                <span>🛒 可购 <b class="${stockCount > 0 ? 'is-ok' : 'is-danger'}">${stockCount}</b></span>
              </div>`
            : equipped ? `<div class="shop-item-status is-ok">${item.type === 'accessory' ? '穿戴中' : '使用中'}</div>`
              : owned ? `<div class="shop-item-status is-ok">已拥有</div>` : ''}
          ${locked ? '<div class="shop-item-lock">🔒 需要先拥有尖石、锈刀和基础剑</div>' : ''}
          ${buttonHtml}
        </article>`
    }

    // 消耗品（排除商店不出售的特殊物品：升级材料、小鹿树枝、卫兵免检查卷；女性专用塞入物男性不可见）
    if (!isBlacksmith) {
      ITEMS.consumables.filter(it =>
        it.id !== 'weapon_upgrade_material' && it.id !== 'twig' && it.id !== 'guard_pass' &&
        !((it.id === 'vibrator_egg' || it.id === 'vibrating_dildo') && state.gender === 'male')
      ).forEach(item => { html += renderItem(item) })
    }
    // 装备（铁匠铺专售）
    if (!isPotioneer) {
      html += '</div><hr class="shop-divider"><h4 class="shop-section-title">装备</h4><div class="shop-grid">'
      ITEMS.weapons.forEach(item => { html += renderItem(item) })
      ITEMS.accessories.forEach(item => { html += renderItem(item) })
    }
    html += '</div>'

    // 全裸时显示"买回衣服"选项
    let clothesBtn = ''
    if (StatusSystem.has('naked')) {
      const canBuyClothes = state.gold >= 200
      clothesBtn = `
        <div class="shop-alert shop-alert--danger${canBuyClothes ? '' : ' is-unavailable'}">
          <div class="shop-alert-title">👙 你正处于全裸状态！</div>
          <button class="btn btn-danger" id="btn-buy-clothes" ${canBuyClothes ? '' : 'disabled'}>👕 ${canBuyClothes ? '买回衣服（200G）' : '金币不足（需要 200G）'}</button>
        </div>`
    }

    // 佣兵死亡时显示"复活"选项
    let mercBtn = ''
    if (state._mercenary && state._mercenary.dead) {
      const canRevive = state.gold >= 50
      mercBtn = `
        <div class="shop-alert shop-alert--success${canRevive ? '' : ' is-unavailable'}">
          <div class="shop-alert-title">💀 ${state._mercenary.icon} ${state._mercenary.name} 战死了！</div>
          <button class="btn btn-primary" id="btn-revive-merc" ${canRevive ? '' : 'disabled'}>💚 ${canRevive ? '复活佣兵（50G）' : '金币不足（需要 50G）'}</button>
        </div>`
    }

    const shopTitle = isPotioneer ? '🧪 道具商' : isBlacksmith ? '🔨 铁匠铺' : '🏪 旅行商店'
    Dialog.show({
      title: `${shopTitle} ${isHalf ? '(半价优惠)' : ''}`,
      className: `shop-modal ${isBlacksmith ? 'shop-modal-blacksmith' : isPotioneer ? 'shop-modal-potion' : 'shop-modal-travel'}`,
      body: `<section class="shop-hero"><span>${isBlacksmith ? '🔨' : isPotioneer ? '🧪' : '🏪'}</span><div><small>${isBlacksmith ? 'FORGE & ARMORY' : isPotioneer ? 'FOREST APOTHECARY' : 'TRAVELING GOODS'}</small><b>${isBlacksmith ? '为下一场战斗换件趁手装备。' : isPotioneer ? '药剂、咒术与旅途补给。' : '森林里能买到的东西都在这里。'}</b></div><strong>💎 ${state.gold}G</strong></section>${isHalf ? '<div class="shop-sale">🏷️ 普通难度停格优惠 · 本店商品半价</div>' : ''}${clothesBtn}${mercBtn}${html}`,
      actions: [
        { label: '离开商店', handler: () => { close(); ShopSystem.close() } },
      ],
    })

    // 绑定买回衣服按钮
    setTimeout(() => {
      const btnClothes = document.getElementById('btn-buy-clothes')
      if (btnClothes) {
        btnClothes.addEventListener('click', () => {
          const result = ShopSystem.buyClothes()
          if (result.ok) {
            shop(tile, ShopSystem.getStock())  // 刷新
          } else {
            alert(result.msg)
          }
        })
      }
      const btnRevive = document.getElementById('btn-revive-merc')
      if (btnRevive) {
        btnRevive.addEventListener('click', () => {
          const result = ShopSystem.reviveMercenary()
          if (result.ok) {
            shop(tile, ShopSystem.getStock())  // 刷新
          } else {
            alert(result.msg)
          }
        })
      }
    }, 50)

    // 绑定购买按钮事件
    setTimeout(() => {
      layer.querySelectorAll('.btn-buy').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id
          const result = ShopSystem.buy(id)
          if (result.ok) {
            shop(tile, ShopSystem.getStock())  // 刷新
          } else {
            alert(result.msg)
          }
        })
      })
      // 绑定重新装备按钮事件
      layer.querySelectorAll('.btn-equip').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id
          const result = ShopSystem.equip(id)
          if (result.ok) {
            shop(tile, ShopSystem.getStock())  // 刷新
          } else {
            alert(result.msg)
          }
        })
      })
      // 绑定取下饰品按钮事件
      layer.querySelectorAll('.btn-unequip').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id
          const result = ShopSystem.unequip(id)
          if (result.ok) {
            shop(tile, ShopSystem.getStock())  // 刷新
          } else {
            alert(result.msg)
          }
        })
      })
    }, 50)
  }

  /** 显示游戏规则 */
  function showRules () {
    const rules = [
      { title: '🎮 如何开始游玩', text: '先从难度章节中选择一个难度。<br>掷 Y 来决定你在棋盘上走几步。一旦你朝某个方向移动，在该回合内就不能回头。<br>移动前可以使用任意数量的消耗品。<br>你初始只有一双肉拳（1 点基础伤害）作为武器和一张创可贴（见物品列表）。' },
      { title: '🦌 新手选择', text: '开局会遇见森灵小鹿，三选一：<br>🌿 <b>坚韧树枝</b>：临时武器（2 伤害），可打 4 个敌人，战败则断裂。<br>🪨 <b>尖石武器</b>：永久武器（2 伤害），但必须脱光衣服进入<b>全裸</b>状态。<br>🙅 <b>不要帮助</b>：赤手空拳上路。' },
      { title: '🎲 移动规则', text: '每回合掷 Y 决定步数，自动沿路径前进。<br>空地不消耗步数，岔路暂停选择方向。<br>检查点经过即触发（回满 HP + 自动存档）。<br>伏击/宝箱经过即触发；陷阱等其余格子停格触发事件。' },
      { title: '🗺️ 地图格与事件', text: '🪤 <b>陷阱</b>（停格触发，掷 Z）：药水被抢（下怪 HP 翻倍）/ 迷路回检查点 / 伏击 / 双敌（每回合 2 次攻击）/ 坠树 HP 减半 / 荆棘受伤。<br>🎁 <b>宝箱</b>（经过即触发，掷 Z）：守卫宝箱（打怪拿 100G）/ 250 金币 / 武器升级材料 / 补给包 / 爱情药水（HP+10）/ 贪婪恶魔。每种只能获得一次；集齐六种后，第七份可自选一种重复领取，无需掷骰。<br>🌫️ <b>伏击</b>（经过即触发）：反复掷骰直到掷出双数才能脱身，每轮承受一次攻击；两次掷骰间可用 1 个物品。<br>😈 <b>贪婪恶魔</b>：金币翻倍，死亡时消失。<br>👑 <b>森林之灵</b>：最终 BOSS。' },
      { title: '⚔️ 战斗规则', text: `每回合掷 Y 攻击，掷 Z 决定敌人攻击。<br>伤害基于武器。未命中=0倍，普通=1倍，暴击=2倍。<br><br>
        <b>普通模式</b><br>1→未命中　2-4→普通命中　5-6→暴击<br>
        <b>困难模式</b><br>1→未命中　2-5→普通命中　6→暴击<br>
        <b>残酷模式</b><br>1-2→未命中　3-6→普通命中（无暴击）` },
      { title: '🛡️ 战斗操作', text: '🛡️ <b>防御</b>：本回合所受伤害减半（仅一次）。<br>🏳️ <b>投降</b>：二选一——上贡金币（付钱走人）或接受羞辱任务（承受惩罚后离开）。<br>🧪 <b>物品</b>：每回合可使用 1 个。<br>🍑 <b>塞入物</b>：一个穴只能塞一个。肛门塞/巨肛塞挡<b>菊穴</b>攻击（挡 1/3 次）；跳蛋/震动假阳具（女性专用）挡<b>小穴</b>攻击（挡 1/3 次）。可取下类用尽或取下会还回背包。<br>🪞 <b>屏障咒</b>：反射一半伤害给敌人，持续 2 回合。' },
      { title: '⚡ 状态效果', text: '🌀 混乱：50% 概率打自己。<br>🩹 受伤：移动减速并扣血。<br>☠️ 中毒：每回合扣血，解毒剂可解。<br>💚 再生：每回合回血（对魅魔/森林之灵会反转或分流）。<br>💤 困倦：攻击伤害减半，清醒药剂可解。<br>⚡ 眩晕：无法行动，只能跳过。<br>📉 缩小 / 📈 增大：假阳具体积 ±1，可叠加。<br>👙 全裸：一定概率被敌人暴击（按难度提升）。<br>😈 贪婪恶魔：金币翻倍，死亡消失。' },
      { title: '🎯 敌人任务', text: '敌人攻击后，会显示一个任务描述。<br>点击「完成任务」按正常伤害结算。<br>点击「没完成」伤害翻倍惩罚。<br>多目标时可选择攻击目标（如哥布林群、召唤物）。' },
      { title: '👺 特殊怪物', text: '💋 <b>魅魔</b>：治疗会分流一半给她；被你攻击时自伤；临死可能反击复活。<br>🔮 <b>魔女</b>：先手石化；可召唤小兵（每回合额外伤害）。<br>👺 <b>哥布林</b>：群体作战，掷 Z 定数量；会内讧、偷金、叫帮手；只剩 1 只逃跑。<br>🐺 <b>兽人/狼人</b>：有锁喉、爪伤等特殊状态攻击。<br>🌲 <b>森林之灵</b>：每回合先掷 Y 召唤敌人，再掷 Z 决定攻击；伤害与状态回合翻倍，治疗反转并翻倍。魔女及哥布林可留下持续攻击的小兵，但只需击败精灵本体即可通关。挑战前会建立独立战前存档。' },
      { title: '🛒 商店 & 装备', text: '商店可购买消耗品和装备（停格在商店格时普通难度半价）。<br>击败敌人后获得金币，再掷 Z 判定额外掉落。<br>⚔️ <b>武器</b>：伤害递增，可免费切换。<br>📿 <b>饰品</b>：可同时穿戴多件，属性叠加；牺牲项链攻击翻倍、受伤三倍、取下即消失。<br>🔧 <b>升级材料</b>：免费升级武器，或购买大师之剑时抵扣 500G。' },
      { title: '💀 死亡与存档', text: '死亡后在最近经过的检查点重生，金币减半。<br>如果没有检查点则回到起点。<br>检查点、新游戏、Boss 战前会自动存档；顶栏可随时手动存档。' },
    ]

    const difficultyTable = `<div class="rulebook-table-wrap">
      <div class="rulebook-subtitle">📊 难度速查</div>
      <table class="rulebook-table">
        <thead><tr><th>难度</th><th>移动</th><th>HP</th><th>暴击</th></tr></thead>
        <tbody>
          <tr><td class="rule-easy">普通</td><td>Y 格</td><td>25</td><td>5-6</td></tr>
          <tr><td class="rule-hard">困难</td><td>Y÷2 向上取整</td><td>25</td><td>仅 6</td></tr>
          <tr><td class="rule-brutal">残酷</td><td>固定 1 格</td><td>20</td><td>无</td></tr>
        </tbody>
      </table>
    </div>`

    const pages = [
      { icon: '🌙', label: '启程', title: '第一章 · 踏入妖林', note: '选好难度，带上第一件武器。', rules: [0, 1], extra: difficultyTable },
      { icon: '🗺️', label: '探索', title: '第二章 · 林间探索', note: '骰子决定脚步，落点决定遭遇。', rules: [2, 3] },
      { icon: '⚔️', label: '战斗', title: '第三章 · 战斗指南', note: '认清回合、伤害与保命手段。', rules: [4, 5] },
      { icon: '⚡', label: '状态', title: '第四章 · 状态与任务', note: '异常状态会改变下一步行动。', rules: [6, 7] },
      { icon: '👺', label: '怪物', title: '第五章 · 妖林生物志', note: '特殊怪物都有独有的战斗机制。', rules: [8] },
      { icon: '🎒', label: '补给', title: '第六章 · 补给与归途', note: '购买、装备、存档与死亡重生。', rules: [9, 10] },
    ]

    const body = `<div class="rulebook">
      <header class="rulebook-masthead">
        <div class="rulebook-seal" aria-hidden="true">📖</div>
        <div>
          <small>妖林旅人手册 · 第一版</small>
          <h3>妖林绮梦规则书</h3>
        </div>
        <span class="rulebook-motto">掷骰 · 探索 · 生还</span>
      </header>
      <div class="rulebook-spread">
        <nav class="rulebook-index" aria-label="规则书目录">
          <span class="rulebook-index-title">目录</span>
          ${pages.map((page, index) => `<button type="button" class="rulebook-index-btn" data-book-page="${index}">
            <span>${page.icon}</span><b>${page.label}</b><small>${String(index + 1).padStart(2, '0')}</small>
          </button>`).join('')}
        </nav>
        <article class="rulebook-page" aria-live="polite">
          <div class="rulebook-page-content"></div>
        </article>
      </div>
      <footer class="rulebook-nav">
        <button type="button" class="btn rulebook-nav-btn" id="rulebook-prev">← 上一章</button>
        <div class="rulebook-page-number"><span id="rulebook-current">01</span><i></i><span>${String(pages.length).padStart(2, '0')}</span></div>
        <button type="button" class="btn rulebook-nav-btn" id="rulebook-next">下一章 →</button>
      </footer>
    </div>`

    Dialog.show({
      body,
      className: 'rulebook-modal',
      actions: [{ label: '合上规则书', cls: 'btn-primary', handler: () => Dialog.close() }],
    })

    let currentPage = 0
    const pageContent = layer.querySelector('.rulebook-page-content')
    const pageNumber = layer.querySelector('#rulebook-current')
    const prevButton = layer.querySelector('#rulebook-prev')
    const nextButton = layer.querySelector('#rulebook-next')
    const indexButtons = [...layer.querySelectorAll('[data-book-page]')]

    function renderBookPage () {
      const page = pages[currentPage]
      pageContent.innerHTML = `
        <div class="rulebook-page-heading">
          <span>${page.icon}</span>
          <div><small>CHAPTER ${String(currentPage + 1).padStart(2, '0')}</small><h4>${page.title}</h4><p>${page.note}</p></div>
        </div>
        <div class="rulebook-page-rule"></div>
        ${page.rules.map(ruleIndex => {
          const rule = rules[ruleIndex]
          return `<section class="rulebook-entry"><h5>${rule.title}</h5><div>${rule.text}</div></section>`
        }).join('')}
        ${page.extra || ''}`
      pageNumber.textContent = String(currentPage + 1).padStart(2, '0')
      prevButton.disabled = currentPage === 0
      nextButton.disabled = currentPage === pages.length - 1
      indexButtons.forEach((button, index) => {
        button.classList.toggle('active', index === currentPage)
        button.setAttribute('aria-current', index === currentPage ? 'page' : 'false')
      })
      pageContent.parentElement.scrollTop = 0
    }

    prevButton.addEventListener('click', () => {
      if (currentPage > 0) { currentPage--; renderBookPage() }
    })
    nextButton.addEventListener('click', () => {
      if (currentPage < pages.length - 1) { currentPage++; renderBookPage() }
    })
    indexButtons.forEach((button, index) => {
      button.addEventListener('click', () => { currentPage = index; renderBookPage() })
    })
    renderBookPage()
  }

  return { show, close, getCurrent, showDice, battleIntro, shop, showRules }
})()

// 监听商店打开事件
EventBus.on('shop:open', (data) => {
  Dialog.shop(data.tile, ShopSystem.getStock())
})
