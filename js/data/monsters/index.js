/** 汇总已注册的独立怪物定义，保持 DATA.monster(id) 与存档敌人 ID 完全兼容。 */
window.MONSTERS = Array.isArray(window.MONSTER_DEFINITIONS)
  ? window.MONSTER_DEFINITIONS.slice()
  : []
