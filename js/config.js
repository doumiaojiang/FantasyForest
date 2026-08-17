/**
 * config.js — 游戏全局配置
 *
 * 所有可调参数集中在此，方便改难度/数值，无需动系统逻辑。
 */

window.CONFIG = {
  version: '0.3.89',
  debug: {
    // 按游戏设计保留公开的作弊 / 调试入口。
    enabled: true,
  },

  /* ---------- 难度参数 ---------- */
  difficulty: {
    normal: {
      maxHp: 25,
      moveFn: 'Y',                 // 移动 Y 格
      moveScale: 1,
      moveRound: false,            // 是否向上取整
      poisonDmg: 1,
      injuredMove: 0.5,            // 受伤时移动减半(比例)
      injuredDmg: 2,               // 受伤每格扣血
      shopHalfPrice: true,         // 停商店格半价
      ambushMaxRounds: 4,          // 伏击轮数上限（普通快速脱身）
      campTax: 0,                  // 营地服务税率（厕所/接客）普通 0%
    },
    hard: {
      maxHp: 25,
      moveFn: 'Y_DIV2_CEIL',       // 移动 Y÷2 向上取整
      moveScale: 0.5,
      moveRound: true,
      poisonDmg: 2,
      injuredMove: 0.5,
      injuredDmg: 3,
      shopHalfPrice: false,
      ambushMaxRounds: 6,          // 伏击轮数上限（困难适中）
      campTax: 0.1,                // 营地服务税率 10%
    },
    brutal: {
      maxHp: 20,
      moveFn: 'FIXED_1',           // 每次移动 1 格
      moveScale: 1,
      moveRound: false,
      poisonDmg: 2,
      injuredDmg: 8,               // 受伤：下次移动-8（一次性）
      shopHalfPrice: false,
      ambushMaxRounds: 8,          // 伏击轮数上限（残酷煎熬更久）
      campTax: 0.3,                // 营地服务税率 30%
    },
  },

  /* ---------- 地图全局 ---------- */
  map: {
    start: { x: 12, y: 9 },
    boss: { x: 1, y: 5 },
  },

  /* ---------- 掷骰 ---------- */
  dice: {
    attackDie: 6,                  // Y / Z 均为 d6
    rerollMax: 6,                  // 伏击重掷上限
    ambushDubsEnd: true,           // 掷出双数结束伏击
    ambushMaxRounds: 6,            // 伏击最大轮数上限（达到后强制脱身，防止被打死）
  },

  /* ---------- 战斗 ---------- */
  battle: {
    missThreshold: { normal: 1, hard: 1, brutal: 2 },   // 未命中区间上限
    critThreshold: { normal: 5, hard: 6, brutal: 7 },   // 暴击起始点数（残酷无暴击）
    critMult: 2,
    normalMult: 1,
    defendMult: 0.5,        // 防御减伤比例
    fleeChance: { normal: 0.6, hard: 0.4, brutal: 0.25 },  // 逃跑成功率
  },

  /* ---------- 玩家初始 ---------- */
  player: {
    baseDamage: 1,                 // 赤手空拳
    startItem: 'bandaid',          // 初始物品
    baseWeapon: null,
  },

  /* ---------- 随机遭遇 ---------- */
  monsters: {
    randomPool: ['tentacle', 'orc', 'sorceress', 'succubus', 'goblins', 'werewolf'],
  },

  /* ---------- 存档 ---------- */
  save: {
    autoSave: true,
  },
}
