/**
 * data/status.js — 状态效果定义
 *
 * 每种状态效果定义：
 * @property {string}   id          — 唯一标识
 * @property {string}   name        — 显示名称
 * @property {string}   icon        — emoji 图标
 * @property {function} onApply     — 施加时回调 (state, effect) => void
 * @property {function} onTick      — 每回合开始时回调 (state, effect) => void
 * @property {function} onRemove    — 移除时回调 (state, effect) => void
 * @property {function} onAttack    — 攻击修改器 (state, effect, {roll, dmg}) => {roll, dmg}
 * @property {function} onDamageTaken — 受伤修改器 (state, effect, dmg) => dmg
 * @property {function} onMove      — 移动修改器 (state, effect, moveData) => moveData
 *
 * 新增状态效果：在 STATUS_EFFECTS 对象中添加键值对即可。
 * 系统层（systems/status.js）会自动遍历生效。
 */

window.STATUS_EFFECTS = {
  confusion: {
    id: 'confusion',
    name: '混乱',
    icon: '🌀',
    desc: '50% 概率攻击自己',
    onApply (state, effect) {},
    onTick (state, effect) {
      effect.turnsLeft--
    },
    onAttack (state, effect, { roll, dmg }) {
      // 50% 概率打自己
      const hitSelf = roll <= 3
      if (hitSelf) {
        if (!state._godMode) state.hp -= dmg
        return { roll, dmg, hitSelf: true }
      }
      return { roll, dmg, hitSelf: false }
    },
    onRemove (state, effect) {},
  },

  injured: {
    id: 'injured',
    name: '受伤',
    icon: '🩹',
    desc: '移动减速并扣血（难度不同效果不同）',
    onApply (state, effect) {
      effect.turnsLeft = 1
    },
    onTick (state, effect) {
      // 持续 1 次掷骰：移动一次后消失
      effect.turnsLeft = 0
    },
    onMove (state, effect, moveData) {
      const cfg = CONFIG.difficulty[state.difficulty]
      if (state.difficulty === 'brutal') {
        moveData.damage += cfg.injuredDmg
      } else if (state.difficulty === 'hard') {
        moveData.damage += cfg.injuredDmg * moveData.steps
      } else {
        moveData.steps = Math.ceil(moveData.steps * cfg.injuredMove)
        moveData.damage += cfg.injuredDmg * moveData.steps
      }
      return moveData
    },
    onRemove (state, effect) {},
  },

  poisoned: {
    id: 'poisoned',
    name: '中毒',
    icon: '☠️',
    desc: '每回合扣血（普通-1/困难-2/残酷-2），可用解毒剂治愈',
    onApply (state, effect) {},
    onTick (state, effect) {
      const cfg = CONFIG.difficulty[state.difficulty]
      if (!state._godMode) state.hp -= cfg.poisonDmg
      effect.turnsLeft--
      EventBus.emit('ui:log', { text: `☠️ 中毒发作！扣 ${cfg.poisonDmg} HP（剩 ${Math.max(0, effect.turnsLeft)} 回合）`, type: 'danger' })
    },
    onRemove (state, effect) {},
  },

  regeneration: {
    id: 'regeneration',
    name: '再生',
    icon: '💚',
    desc: '每回合回复 HP，等级越高回复越多',
    onApply (state, effect) {
      effect.level = effect.level || 1
    },
    onTick (state, effect) {
      const heal = effect.level
      state.hp = Math.min(state.maxHp, state.hp + heal)
      effect.turnsLeft--
      // 魅魔生命链接：50% 治疗转移给魅魔（无论来源）
      if (state._battle) {
        const enemy = DATA.monster(state._battle.enemyId)
        if (enemy && enemy.id === 'succubus') {
          const transfer = Math.ceil(heal * 0.5)
          state.hp -= transfer
          if (state._battle.targets[0]) {
            state._battle.targets[0].hp = Math.min(state._battle.targets[0].hp + transfer, 10)
          }
          EventBus.emit('ui:log', { text: `💚 再生回复了 ${heal - transfer} HP（魅魔吸走 ${transfer} HP）`, type: 'good' })
        }
        // 森林之灵：仅敌人施加的再生被反转（玩家特制药膏的再生正常回血）
        else if (enemy && enemy.props && enemy.props.isBoss && effect.source === 'enemy') {
          const transfer = Math.ceil(heal * 0.5) * 2
          state.hp -= Math.ceil(heal * 0.5)
          if (state._battle.targets[0]) {
            state._battle.targets[0].hp = Math.min(state._battle.targets[0].hp + transfer, state._battle.targets[0].maxHp)
          }
          EventBus.emit('ui:log', { text: `💚 敌人施加的再生被反转！森林之灵恢复了 ${transfer} HP！`, type: 'danger' })
        }
        // 普通战斗：正常回血
        else {
          EventBus.emit('ui:log', { text: `💚 再生回复了 ${heal} HP`, type: 'good' })
        }
      } else {
        EventBus.emit('ui:log', { text: `💚 再生回复了 ${heal} HP`, type: 'good' })
      }
    },
    onRemove (state, effect) {},
  },

  size_down: {
    id: 'size_down',
    name: '缩小',
    icon: '📉',
    desc: '假阳具体积 -1 级，可叠加',
    onApply (state, effect) {
      // 多次缩小叠加
      const existing = state.statuses.find(s => s.id === 'size_down')
      if (existing) {
        existing.turnsLeft = Math.max(existing.turnsLeft, effect.turnsLeft)
        existing.stacks = (existing.stacks || 1) + 1
      } else {
        effect.stacks = effect.stacks || 1
      }
    },
    onTick (state, effect) { effect.turnsLeft-- },
    onRemove (state, effect) {},
  },

  size_up: {
    id: 'size_up',
    name: '增大',
    icon: '📈',
    desc: '假阳具体积 +1 级，可叠加',
    onApply (state, effect) {
      const existing = state.statuses.find(s => s.id === 'size_up')
      if (existing) {
        existing.turnsLeft = Math.max(existing.turnsLeft, effect.turnsLeft)
        existing.stacks = (existing.stacks || 1) + 1
      } else {
        effect.stacks = effect.stacks || 1
      }
    },
    onTick (state, effect) { effect.turnsLeft-- },
    onRemove (state, effect) {},
  },

  sleepy: {
    id: 'sleepy',
    name: '困倦',
    icon: '💤',
    desc: '攻击伤害减半，可用清醒药剂治愈',
    onApply (state, effect) {},
    onTick (state, effect) { effect.turnsLeft-- },
    onAttack (state, effect, { roll, dmg }) {
      return { roll, dmg: Math.floor(dmg / 2), halved: true }
    },
    onRemove (state, effect) {},
  },

  stunned: {
    id: 'stunned',
    name: '眩晕',
    icon: '⚡',
    desc: '无法攻击/防御/逃跑/使用物品',
    onApply (state, effect) {},
    onTick (state, effect) { effect.turnsLeft-- },
    onAttack (state, effect, { roll, dmg }) {
      return { roll, dmg: 0, stunned: true }   // 不能攻击
    },
    onRemove (state, effect) {},
  },

  greed_demon: {
    id: 'greed_demon',
    name: '贪婪恶魔',
    icon: '😈',
    desc: '金币翻倍，死亡时消失',
    onApply (state, effect) {},
    onTick (state, effect) {},
    onRemove (state, effect) {},
  },

  naked: {
    id: 'naked',
    name: '全裸',
    icon: '👙',
    desc: '没有衣物保护，一定概率被敌人暴击（按难度提升）',
    onApply (state, effect) {},
    onTick (state, effect) {},
    onRemove (state, effect) {},
  },

  drunk: {
    id: 'drunk',
    name: '醉酒',
    icon: '🍺',
    desc: '晕乎乎的：攻击伤害减半，移动时有一定概率走错方向，醉酒越久越难熬',
    onApply (state, effect) {
      effect.level = effect.level || 1
    },
    onTick (state, effect) { effect.turnsLeft-- },
    onAttack (state, effect, { roll, dmg }) {
      return { roll, dmg: Math.floor(dmg / 2), halved: true }
    },
    onMove (state, effect, moveData) {
      // 30% 概率走错方向：移动步数减半（醉得连路都走不稳）
      if (Math.random() < 0.3) {
        moveData.steps = Math.max(1, Math.floor(moveData.steps / 2))
        moveData.wobble = true
      }
      return moveData
    },
    onRemove (state, effect) {},
  },

  tentacle_embedded: {
    id: 'tentacle_embedded',
    name: '断触手',
    icon: '🐙',
    desc: '假阴茎塞在菊穴里，保持到下一个敌人插入',
    onApply (state, effect) {},
    onTick (state, effect) {},
    onRemove (state, effect) {},
  },
}

/** 状态效果查找工具 */
window.StatusLib = {
  get (id) { return STATUS_EFFECTS[id] || null },
  has (state, id) { return state.statuses.some(s => s.id === id) },
  getActive (state, id) { return state.statuses.find(s => s.id === id) || null },
}