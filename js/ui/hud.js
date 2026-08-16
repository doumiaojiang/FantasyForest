/**
 * ui/hud.js — HUD 渲染组件
 *
 * 监听 state:changed 事件，自动更新：
 *  - HP 条 + 数值
 *  - 金币
 *  - 当前位置
 *  - 武器
 *  - 状态效果标签
 *
 * 事件：ui:hudUpdate
 */

window.HUD = (function () {
const hpFill = document.getElementById('hp-fill')
const hpText = document.getElementById('hp-text')
const goldEl = document.getElementById('hud-gold')
const posEl = document.getElementById('hud-pos')
const weaponEl = document.getElementById('hud-weapon')
const accessoryEl = document.getElementById('hud-accessory')
const playerNameEl = document.getElementById('hud-player-name')
const diffEl = document.getElementById('hud-diff')
const statusEl = document.getElementById('hud-status')
const itemsListEl = document.getElementById('hud-items-list')
const mercenaryEl = document.getElementById('hud-mercenary')
const enemyContainer = document.getElementById('hud-enemy')
const enemyTargets = document.getElementById('hud-enemy-targets')

const DIFF_NAMES = { normal: '普通', hard: '困难', brutal: '残酷' }

function init () {
  EventBus.on('state:changed', render)
}

function render (state) {
    if (!state) state = State.get()
    if (!state) return

    // 玩家名 + 难度（名字前显示性别标签，有妓院许可证时再加妓女称号）
    if (playerNameEl) {
      let name = state.playerName || '妖林勇者'
      const genderLabel = state.genderLabel || (state.gender === 'male' ? '男性' : '女性')
      name = `${genderLabel} ${name}`
      if (state._prostituteLicensed) {
        const lv = state._prostituteLevel || 1
        let title = ''
        if (lv >= 100) title = '👑 头牌妓畜'
        else if (lv >= 70) title = '💼 职业妓女'
        else if (lv >= 30) title = '🫦 顺从的妓女'
        else if (lv >= 10) title = '🐣 新手妓女'
        if (title) name = `${title} · ${name}`
      }
      playerNameEl.textContent = name
    }
    if (diffEl) diffEl.textContent = DIFF_NAMES[state.difficulty] || state.difficulty

    // HP
    const pct = Math.max(0, (state.hp / state.maxHp) * 100)
    hpFill.style.width = pct + '%'
    hpText.textContent = `${state.hp}/${state.maxHp}`

    // 金币
    goldEl.textContent = state.gold

    // 位置
    const tile = MapLib.get(state.position.x, state.position.y)
    posEl.textContent = tile ? `(${state.position.x},${state.position.y})` : '—'

    // 武器
    weaponEl.textContent = state.inventory.weapon
      ? (ItemLib.weapon(state.inventory.weapon)?.name || state.inventory.weapon)
      : '赤手空拳'

    // 饰品（可穿多件）
    const accs = state.inventory.accessories || []
    accessoryEl.textContent = accs.length
      ? accs.map(id => (ItemLib.accessory(id)?.name || id)).join('、')
      : '无'

    // 物品框（消耗品 + 妓院许可证）
    const consumables = Object.entries(state.inventory.consumables || {}).filter(([, n]) => n > 0)
    if (itemsListEl) {
      let chips = ''
      if (state._prostituteLicensed) {
        chips += `<span class="item-chip item-chip-license" title="妓院许可证">📜 妓院许可证</span>`
      }
      if (consumables.length === 0) {
        itemsListEl.innerHTML = chips || '<span class="hud-items-empty">空</span>'
      } else {
        itemsListEl.innerHTML = chips + consumables.map(([id, count]) => {
          const item = ItemLib.get(id)
          const name = item ? item.name : id
          return `<span class="item-chip">${name}<span class="count">×${count}</span></span>`
        }).join('')
      }
    }

    // 状态效果
    statusEl.innerHTML = state.statuses.map(s => {
      const def = STATUS_EFFECTS[s.id]
      const icon = def ? def.icon : '❓'
      const name = def ? def.name : s.id
      const desc = def && def.desc ? def.desc : ''
      const turns = s.turnsLeft
      const level = s.level ? ` Lv${s.level}` : ''
      return `<span class="status-chip active" title="${name}: ${desc} (剩余 ${turns} 回合${level})">${icon} ${name} (${turns})${level}</span>`
    }).join('')

    // 佣兵（主角下方）
    if (mercenaryEl) {
      mercenaryEl.classList.remove('hud-hidden')
      if (!state._mercenary) {
        mercenaryEl.innerHTML = `<span class="mercenary-avatar" style="opacity:.35">⚔️</span><span class="mercenary-meta"><small>MERCENARY</small><b style="color:var(--text-dim)">无</b></span>`
      } else if (state._mercenary.dead) {
        mercenaryEl.innerHTML = `<span class="mercenary-avatar" style="opacity:.45">${state._mercenary.icon}</span><span class="mercenary-meta"><small>MERCENARY</small><b style="color:var(--danger)">${state._mercenary.name}（已阵亡）</b><em style="color:var(--danger)">💔 可到商店花 50G 复活</em></span>`
      } else {
        mercenaryEl.innerHTML = `<span class="mercenary-avatar">${state._mercenary.icon}</span><span class="mercenary-meta"><small>MERCENARY</small><b>${state._mercenary.name}</b><em>⚔️ 帮你攻击 ${state._mercenary.dmg} 伤害</em></span>`
      }
    }

    // 敌人血条（独立框）
    if (state.phase === 'battle' && state._battle && state._battle.targets) {
      enemyContainer.classList.add('show')
      enemyContainer.classList.remove('hud-hidden')
      const enemy = DATA.monster(state._battle.enemyId)
      const dildo = enemy ? DildoSystem.effective(enemy.id) : null
      const dildoText = dildo ? dildo.name : ''
      enemyTargets.innerHTML = state._battle.targets.map(t => {
        const pct2 = Math.max(0, (t.hp / t.maxHp) * 100)
        const targetIcon = t.type === 'goblin' ? '👺'
          : (t.type === 'minion' || t.type === 'boss-minion') ? '✦'
            : ({ tentacle: '🦑', orc: '👹', sorceress: '🔮', succubus: '💋', goblins: '👺', werewolf: '🐺', spirit_of_forest: '🌲' }[enemy && enemy.id] || '◆')
        return `<div class="enemy-row">
          <span class="enemy-avatar" aria-hidden="true">${targetIcon}</span>
          <span class="enemy-vitals">
            <span class="enemy-meta"><b class="enemy-name">${t.name}</b><span class="enemy-hp">${t.hp}/${t.maxHp}</span></span>
            <span class="enemy-bar"><span class="enemy-fill" style="width:${pct2}%"></span></span>
          </span>
        </div>`
      }).join('') +
      (dildoText ? `<div class="enemy-requirement"><span>战斗需求</span><b>🍆 ${dildoText}</b></div>` : '')
    } else {
      enemyContainer.classList.remove('show')
      enemyContainer.classList.add('hud-hidden')
    }
  }

  return { init, render }
})()
