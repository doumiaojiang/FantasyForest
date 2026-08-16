/**
 * data/index.js — 数据层聚合入口
 *
 * 提供全局数据访问接口，统一查找逻辑。
 * 游戏逻辑只通过 DATA 对象访问数据，不直接引用全局数组。
 */

window.DATA = {
  monsters: MONSTERS,
  items: ITEMS,
  statuses: STATUS_EFFECTS,
  map: MAP_GRID,
  traps: TRAPS,
  treasures: TREASURES,

  /** 按 id 查找怪物 */
  monster (id) { return MONSTERS.find(m => m.id === id) || null },

  /** 按 id 查找物品 */
  item (id) { return ItemLib.get(id) },

  /** 获取网格格 */
  tile (x, y) { return MapLib.get(x, y) },

  /** 按 roll 值查找陷阱 */
  trapByRoll (roll) { return TRAPS.find(t => t.roll === roll) || null },

  /** 按 roll 值查找宝藏 */
  treasureByRoll (roll) { return TREASURES.find(t => t.roll === roll) || null },
}