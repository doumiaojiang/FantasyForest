/**
 * achievements.js — 成就定义与敌人任务的结构化分类
 * 统计系统只读取这些稳定字段，不从展示文案反推玩法数据。
 */
window.ACHIEVEMENTS = [
  { id: 'first_task', category: 'task', icon: '🎯', name: '第一次服从', desc: '完成 1 次计时或节拍任务', metric: 'tasksCompleted', target: 1, reward: { gold: 10 } },
  { id: 'thrust_1k', category: 'task', icon: '💨', name: '渐入佳境', desc: '累计估算动作次数达到 1,000', metric: 'estimatedThrusts', target: 1000, reward: { gold: 30 } },
  { id: 'thrust_10k', category: 'task', icon: '🔥', name: '节奏机器', desc: '累计估算动作次数达到 10,000', metric: 'estimatedThrusts', target: 10000, reward: { gold: 100 } },
  { id: 'task_hour', category: 'task', icon: '⏱️', name: '一小时试炼', desc: '累计任务时间达到 60 分钟', metric: 'taskSeconds', target: 3600, reward: { gold: 80 } },
  { id: 'streak_10', category: 'task', icon: '✨', name: '绝不失手', desc: '连续完成 10 次任务', metric: 'bestStreak', target: 10, reward: { gold: 50 } },
  { id: 'fail_10', category: 'task', icon: '🩹', name: '屡败屡战', desc: '累计 10 次任务未完成', metric: 'tasksFailed', target: 10, reward: { gold: 25 } },
  { id: 'all_parts', category: 'task', icon: '🌈', name: '全面体验', desc: '完成口部、菊穴、小穴、手部与打屁股任务', check: 'allParts', target: 5, reward: { gold: 60 } },
  { id: 'all_actions', category: 'task', icon: '🎭', name: '花样百出', desc: '完成抽插、口交、手交、寸止与打屁股任务', check: 'allActions', target: 5, reward: { gold: 60 } },
  { id: 'all_depths', category: 'task', icon: '📏', name: '深浅皆宜', desc: '完成浅、中、深三种深度任务', check: 'allDepths', target: 3, reward: { gold: 35 } },
  { id: 'battle_10', category: 'battle', icon: '⚔️', name: '森林猎手', desc: '赢得 10 场战斗', metric: 'wins', target: 10, reward: { gold: 50 } },
  { id: 'damage_500', category: 'battle', icon: '💥', name: '重击专家', desc: '累计造成 500 点伤害', metric: 'damageDealt', target: 500, reward: { gold: 75 } },
  { id: 'critical_20', category: 'battle', icon: '🎲', name: '幸运眷顾', desc: '触发 20 次暴击', metric: 'criticalHits', target: 20, reward: { gold: 40 } },
  { id: 'all_enemies', category: 'battle', icon: '📖', name: '妖林图鉴', desc: '至少与全部 6 种普通怪物交战一次', check: 'allEnemies', target: 6, reward: { gold: 80 } },
  { id: 'elite_5', category: 'battle', icon: '💠', name: '精英克星', desc: '击败 5 只精英怪', metric: 'eliteKills', target: 5, reward: { item: 'mutant_crystal', count: 2 } },
  { id: 'boss_clear', category: 'battle', icon: '🌲', name: '森林终章', desc: '击败森林之灵', metric: 'bossKills', target: 1, reward: { gold: 150 } },
  { id: 'block_20', category: 'restraint', icon: '🔒', name: '滴水不漏', desc: '插入装备累计抵挡 20 次攻击', metric: 'insertionBlocks', target: 20, reward: { gold: 50 } },
  { id: 'guard_10', category: 'town', icon: '🛡️', name: '城门熟客', desc: '接受 10 次城门检查', metric: 'guardChecks', target: 10, reward: { gold: 40 } },
  { id: 'pillory_10m', category: 'town', icon: '🪵', name: '广场焦点', desc: '累计公开木枷 10 分钟', metric: 'pillorySeconds', target: 600, reward: { gold: 60 } },
  { id: 'glory_20', category: 'town', icon: '🍑', name: '接待达人', desc: '完成 20 次城镇服务', metric: 'townServices', target: 20, reward: { gold: 80 } },
]

// 六种普通敌人的攻击分类。运行时改攻的实际部位会覆盖这里的默认部位。
window.ENEMY_TASK_META = {
  tentacle: {
    1: { action: 'penetration', part: 'anal', depth: 'deep' }, 2: { action: 'penetration', part: 'anal', depth: 'shallow' },
    3: { action: 'penetration', part: 'anal', depth: 'shallow' }, 4: { action: 'edging', part: 'anal', depth: 'none' },
    5: { action: 'penetration', part: 'anal', depth: 'deep' }, 6: { action: 'penetration', part: 'anal', depth: 'deep' },
  },
  orc: {
    1: { action: 'penetration', part: 'anal', depth: 'medium' }, 2: { action: 'oral', part: 'oral', depth: 'deep' },
    3: { action: 'penetration', part: 'anal', depth: 'deep' }, 4: { action: 'penetration', part: 'anal', depth: 'deep' },
    5: { action: 'penetration', part: 'anal', depth: 'medium' }, 6: { action: 'penetration', part: 'anal', depth: 'deep' },
  },
  sorceress: {
    1: { action: 'penetration', part: 'anal', depth: 'shallow' }, 2: { action: 'spanking', part: 'body', depth: 'none' },
    3: { action: 'penetration', part: 'anal', depth: 'medium' }, 4: { action: 'penetration', part: 'anal', depth: 'shallow' },
    5: { action: 'penetration', part: 'anal', depth: 'shallow' }, 6: { action: 'other', part: 'body', depth: 'none' },
  },
  succubus: {
    1: { action: 'other', part: 'body', depth: 'none' }, 2: { action: 'penetration', part: 'vagina', depth: 'medium' },
    3: { action: 'penetration', part: 'anal', depth: 'deep' }, 4: { action: 'penetration', part: 'anal', depth: 'free' },
    5: { action: 'other', part: 'body', depth: 'none' }, 6: { action: 'edging', part: 'hand', depth: 'none' },
  },
  goblins: {
    1: { action: 'penetration', part: 'anal', depth: 'medium' }, 2: { action: 'penetration', part: 'anal', depth: 'shallow' },
    3: { action: 'penetration', part: 'anal', depth: 'deep' }, 4: { action: 'penetration', part: 'anal', depth: 'deep' },
    5: { action: 'penetration', part: 'anal', depth: 'shallow' }, 6: { action: 'other', part: 'body', depth: 'none' },
  },
  werewolf: {
    1: { action: 'penetration', part: 'anal', depth: 'deep' }, 2: { action: 'penetration', part: 'anal', depth: 'deep' },
    3: { action: 'other', part: 'body', depth: 'none' }, 4: { action: 'penetration', part: 'anal', depth: 'deep' },
    5: { action: 'penetration', part: 'anal', depth: 'deep' }, 6: { action: 'penetration', part: 'anal', depth: 'medium' },
  },
}
