/**
 * data/map.js — 第一章主地图（网格地图）
 *
 * 二维数组表示，每个元素是一个格子：
 *   "墙"      → 不可通行
 *   "空"      → 可通行，无事件
 *   "开始"    → 玩家出生点
 *   "BOSS"    → 最终 BOSS
 *   "敌人"    → 随机遭遇（掷 Z 决定怪物）
 *   "随机事件" → 随机事件（陷阱/宝藏/伏击等）
 *   "宝箱"    → 宝箱（掷 Z 判定奖励）
 *   "商店"    → 商店
 *   "检查点"  → 检查点（经过激活，满血）
 *
 * 数组行 = Y 轴（上小下大），行内元素 = X 轴（左小右大）。
 * 修改地图：直接编辑 MAP_GRID 二维数组即可，系统自动解析。
 */

window.MAP_GRID = [
  ["墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁"],
  ["空地", "宝箱", "空地", "墙壁", "陷阱", "战斗", "战斗", "墙壁", "战斗", "商店", "战斗", "墙壁", "墙壁", "战斗", "陷阱", "空地"],
  ["伏击", "墙壁", "战斗", "墙壁", "战斗", "墙壁", "战斗", "墙壁", "战斗", "墙壁", "战斗", "战斗", "伏击", "空地", "墙壁", "宝箱"],
  ["空地", "战斗", "空地", "战斗", "战斗", "墙壁", "伏击", "墙壁", "战斗", "墙壁", "墙壁", "战斗", "墙壁", "战斗", "陷阱", "空地"],
  ["墙壁", "墙壁", "墙壁", "墙壁", "战斗", "墙壁", "宝箱", "墙壁", "陷阱", "墙壁", "墙壁", "战斗", "墙壁", "墙壁", "墙壁", "墙壁"],
  ["墙壁", "boss", "检查", "商店", "战斗", "墙壁", "检查", "战斗", "战斗", "墙壁", "墙壁", "战斗", "墙壁", "墙壁", "墙壁", "墙壁"],
  ["墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "宝箱", "墙壁", "墙壁", "墙壁", "墙壁"],
  ["墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "战斗", "战斗", "战斗", "陷阱", "检查", "战斗", "墙壁", "墙壁", "墙壁", "墙壁"],
  ["墙壁", "宝箱", "战斗", "空地", "墙壁", "墙壁", "战斗", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁"],
  ["墙壁", "宝箱", "墙壁", "陷阱", "伏击", "陷阱", "战斗", "商店", "战斗", "战斗", "战斗", "战斗", "开始", "营地", "墙壁", "墙壁"],
  ["墙壁", "宝箱", "战斗", "空地", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁"],
  ["墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁", "墙壁"],
]

/* ---------- 格子类型常量 ---------- */
window.TILE = {
  WALL: 'wall',
  EMPTY: 'empty',
  START: 'start',
  BOSS: 'boss',
  MONSTER: 'monster',
  TRAP: 'trap',
  AMBUSH: 'ambush',
  EVENT: 'event',
  TREASURE: 'treasure',
  SHOP: 'shop',
  CHECKPOINT: 'checkpoint',
  CAMP: 'camp',           // 营地（菜单式：商店/卫生间/酒馆/鹿）
}

/* ---------- 字符串 → 类型映射 ---------- */
const TILE_MAP = {
  '墙壁': TILE.WALL,
  '墙': TILE.WALL,
  '空地': TILE.EMPTY,
  '空': TILE.EMPTY,
  '开始': TILE.START,
  'boss': TILE.BOSS,
  'BOSS': TILE.BOSS,
  '战斗': TILE.MONSTER,
  '敌人': TILE.MONSTER,
  '随机事件': TILE.EVENT,
  '陷阱': TILE.TRAP,
  '伏击': TILE.AMBUSH,
  '宝箱': TILE.TREASURE,
  '商店': TILE.SHOP,
  '重生商店': TILE.SHOP,        // 特殊商店，库存无限
  '检查': TILE.CHECKPOINT,
  '检查点': TILE.CHECKPOINT,
  '营地': TILE.CAMP,
}

window.TILE_ICONS = {
  [TILE.WALL]: '⬛',
  [TILE.EMPTY]: '🟫',
  [TILE.START]: '🏘️',
  [TILE.BOSS]: '👑',
  [TILE.MONSTER]: '👹',
  [TILE.TRAP]: '🪤',
  [TILE.AMBUSH]: '🌫️',
  [TILE.EVENT]: '❓',
  [TILE.TREASURE]: '🎁',
  [TILE.SHOP]: '🏪',
  [TILE.CHECKPOINT]: '🔥',
  [TILE.CAMP]: '⛺',
}

/* ---------- 网格解析 ---------- */
window.MapLib = {
  grid: [],
  rows: 0,
  cols: 0,

  /** 解析 MAP_GRID 为结构化网格 */
  parse () {
    this.rows = MAP_GRID.length
    this.cols = MAP_GRID[0].length
    this.grid = []
    for (let y = 0; y < this.rows; y++) {
      this.grid[y] = []
      for (let x = 0; x < this.cols; x++) {
        const raw = MAP_GRID[y][x]
        this.grid[y][x] = {
          x, y,
          type: TILE_MAP[raw] || TILE.EMPTY,
          raw,
        }
      }
    }
    // 记录起点 / BOSS 坐标
    this.start = this.findTile(TILE.START) || { x: 0, y: 0 }
    this.boss = this.findTile(TILE.BOSS)
  },

  /** 获取某格 */
  get (x, y) {
    if (x < 0 || y < 0 || y >= this.rows || x >= this.cols) return null
    return this.grid[y][x]
  },

  /** 是否可通行（非墙、非边界外） */
  isWalkable (x, y) {
    const t = this.get(x, y)
    return !!t && t.type !== TILE.WALL
  },

  /** 相邻可走的格子（上下左右） */
  neighbors (x, y) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]]
    const out = []
    for (const [dx, dy] of dirs) {
      const nx = x + dx
      const ny = y + dy
      if (this.isWalkable(nx, ny)) out.push({ x: nx, y: ny })
    }
    return out
  },

  /** 找第一个某类型格子 */
  findTile (type) {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x].type === type) return { x, y }
      }
    }
    return null
  },

/** BFS 计算从 (sx,sy) 出发可达的格子（空地免费，其余 1 步） */
  reachable (sx, sy, maxSteps) {
    const dist = {}
    const key = (x, y) => x + ',' + y
    const queue = [{ x: sx, y: sy, cost: 0 }]
    dist[key(sx, sy)] = 0

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost)
      const cur = queue.shift()
      if (cur.cost >= maxSteps) continue
      for (const n of this.neighbors(cur.x, cur.y)) {
        const tile = this.get(n.x, n.y)
        const add = (tile && tile.type === TILE.EMPTY) ? 0 : 1
        const nc = cur.cost + add
        const k = key(n.x, n.y)
        if (nc <= maxSteps && (dist[k] === undefined || nc < dist[k])) {
          dist[k] = nc
          queue.push({ x: n.x, y: n.y, cost: nc })
        }
      }
    }

    const out = []
    for (const [k, cost] of Object.entries(dist)) {
      const [x, y] = k.split(',').map(Number)
      if (x === sx && y === sy) continue
      out.push({ x, y, steps: cost })
    }
    return out
  },
}

MapLib.parse()

/* ---------- 陷阱表（掷 Z 判定） ---------- */
window.TRAPS = [
  { roll: 1, name: '药水失窃', desc: '捡到治疗药水，但被下一只怪物抢走喝掉，其 HP 翻倍', effect: 'enemy_hp_double' },
  { roll: 2, name: '迷路',     desc: '迷路了，回到上一个检查点', effect: 'back_to_checkpoint' },
  { roll: 3, name: '伏击',     desc: '被伏击！', effect: 'ambush' },
  { roll: 4, name: '双敌',     desc: '两只敌人同时干你，但你也每回合有 2 次攻击机会', effect: 'double_enemy' },
  { roll: 5, name: '坠树',     desc: '爬树侦察时摔落，HP 减半', effect: 'hp_halve' },
  { roll: 6, name: '荆棘刺伤', desc: '跌进荆棘丛，进入受伤状态', effect: 'injured' },
]

/* ---------- 宝藏表（掷 Z 判定） ---------- */
window.TREASURES = [
  { roll: 1, id: 'tentacle_chest', name: '触手宝箱',   desc: '打开宝箱，触手怪跳出来攻击！杀掉才能拿到 100 金币', effect: 'guardian', gold: 100, enemy: 'tentacle' },
  { roll: 2, id: 'gold_250',       name: '金币堆',     desc: '找到 250 金币', effect: 'gold', gold: 250 },
  { roll: 3, id: 'weapon_upgrade', name: '武器升级材料', desc: '免费升级武器的材料。购买大师之剑时可抵扣 500 金币', effect: 'free_upgrade' },
  { roll: 4, id: 'supply_pack',    name: '补给包',     desc: '麦酒 + 绿草 + 力量宝珠 + 巨肛塞', effect: 'items', items: ['ale', 'green_herb', 'orb_of_power', 'big_butt_plug'] },
  { roll: 5, id: 'love_potion',    name: '爱情药水',   desc: '喝下爱上自己，最大 HP +10', effect: 'maxhp', value: 10 },
  { roll: 6, id: 'greed_demon',    name: '贪婪恶魔',   desc: '抓住你的乳头，金币翻倍。死亡时消失', effect: 'greed_demon' },
]
