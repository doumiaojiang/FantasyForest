/**
 * data/items.js — 道具与装备数据库
 *
 * 物品 schema：
 * @property {string}  id      — 唯一标识
 * @property {string}  name    — 名称
 * @property {'consumable'|'weapon'|'accessory'|'special'} type
 * @property {number}  price   — 商店售价
 * @property {string}  desc    — 描述（效果说明）
 * @property {object}  effect  — 效果定义（由 systems 解释执行）
 *                              consumable:  { heal?, cure?: string[], regen?: {level, turns},
 *                                             reflect?: number, orb?: boolean, damage?, block? }
 *                              weapon:      { damage: number }
 *                              accessory:   { stat?: 'maxHp', value?: number, special?: string }
 *
 * 新增物品：直接向数组追加对象，并在 systems/shop.js 无需改动即可售卖。
 */

window.ITEMS = {
  /* ============ 消耗品 ============ */
  consumables: [
    {
      id: 'ale', name: '麦酒', type: 'consumable', price: 80,
      desc: '恢复 10 HP',
      effect: { heal: 10 },
    },
    {
      id: 'antidote', name: '解毒剂', type: 'consumable', price: 50,
      desc: '治愈中毒',
      effect: { cure: ['poisoned'] },
    },
    {
      id: 'bandaid', name: '创可贴', type: 'consumable', price: 50,
      desc: '恢复 5 HP',
      effect: { heal: 5 },
    },
    {
      id: 'barrier_spell', name: '屏障咒', type: 'consumable', price: 120,
      desc: '将所受伤害一半反射给敌人，持续 2 回合',
      effect: { reflect: 0.5, turns: 2 },
    },
    {
      id: 'green_herb', name: '绿草', type: 'consumable', price: 60,
      desc: '治愈混乱',
      effect: { cure: ['confusion'] },
    },
    {
      id: 'orb_of_power', name: '力量宝珠', type: 'consumable', price: 100,
      desc: '下次攻击附加武器基础伤害',
      effect: { orb: true },
    },
    {
      id: 'awakening', name: '清醒药剂', type: 'consumable', price: 60,
      desc: '治愈困倦',
      effect: { cure: ['sleepy'] },
    },
    {
      id: 'special_cream', name: '特制药膏', type: 'consumable', price: 40,
      desc: '再生 I，持续 5 回合',
      effect: { regen: { level: 1, turns: 5 } },
    },
    {
      id: 'weapon_upgrade_material', name: '武器升级材料', type: 'consumable', price: 500,
      desc: '到商店可免费升级武器（不适用大师之剑）；购买大师之剑时抵扣 500 金币',
      effect: { special: 'free_upgrade' },
    },
    {
      id: 'twig', name: '坚韧树枝', type: 'consumable', price: 0,
      desc: '森灵小鹿送的临时武器，可在 4 场战斗中作为武器使用（2 点伤害），战败则断裂',
      effect: { special: 'twig' },
    },
    {
      id: 'guard_pass', name: '出城免检查卷', type: 'consumable', price: 0,
      desc: '卫兵给的通行凭据，出城时免于卫兵检查，直接放行',
      effect: { special: 'guard_pass' },
    },
    {
      id: 'restraint_lock', name: '普通锁', type: 'consumable', price: 80,
      desc: '在妖缚装备栏中给一件已穿戴且未上锁的装置上锁；使用后消耗',
      effect: { special: 'restraint_lock' },
    },
    {
      id: 'restraint_key', name: '普通钥匙', type: 'consumable', price: 200,
      desc: '解开一把普通上锁的妖缚装置（剧情锁无效）',
      effect: { special: 'restraint_key' },
    },
    {
      id: 'master_key', name: '万能钥匙', type: 'consumable', price: 500,
      desc: '解开任意非剧情的上锁妖缚装置',
      effect: { special: 'master_key' },
    },
    {
      id: 'lockpick', name: '开锁工具', type: 'consumable', price: 150,
      desc: '60% 概率解开一把普通上锁的妖缚装置，失败则损耗',
      effect: { special: 'lockpick' },
    },
    {
      id: 'curse_remover', name: '驱咒符', type: 'consumable', price: 250,
      desc: '解除一件被诅咒锁住的妖缚装置（钥匙/撬锁/挣扎都无效的锁）',
      effect: { special: 'curse_remover' },
    },
    {
      id: 'petty_soul_gem', name: '微型灵魂石', type: 'consumable', price: 60,
      desc: '为一件插入装备恢复 1 点防护充能；城镇与野外均可使用',
      effect: { special: 'soul_charge', charge: 1 },
    },
    {
      id: 'lesser_soul_gem', name: '次级灵魂石', type: 'consumable', price: 110,
      desc: '为一件插入装备恢复 2 点防护充能；城镇与野外均可使用',
      effect: { special: 'soul_charge', charge: 2 },
    },
    {
      id: 'common_soul_gem', name: '普通灵魂石', type: 'consumable', price: 180,
      desc: '将一件插入装备恢复至满充；城镇与野外均可使用',
      effect: { special: 'soul_charge', charge: 99 },
    },
  ],

  /* ============ 装备 ============ */
  weapons: [
    { id: 'sharp_rock', name: '尖石', type: 'weapon', price: 5, desc: '2 点伤害', effect: { damage: 2 } },
    { id: 'rusty_knife', name: '锈刀', type: 'weapon', price: 250, desc: '2.5 点伤害', effect: { damage: 2.5 } },
    { id: 'basic_sword', name: '基础剑', type: 'weapon', price: 500, desc: '3 点伤害', effect: { damage: 3 } },
    {
      id: 'master_sword', name: '大师之剑', type: 'weapon', price: 1000,
      desc: '4 点伤害，需持有全部前三件武器', effect: { damage: 4 },
    },
  ],

  accessories: [
    { id: 'sacrificial_necklace', name: '牺牲项链', type: 'accessory', price: 250, desc: '攻击伤害翻倍，但受到伤害三倍，取下即消失', effect: { special: 'sacrifice' } },
    { id: 'health_bracelet', name: '健康手环', type: 'accessory', price: 200, desc: '最大 HP +5', effect: { stat: 'maxHp', value: 5 } },
    { id: 'ring_of_love', name: '爱之戒', type: 'accessory', price: 300, desc: '最大 HP +5', effect: { stat: 'maxHp', value: 5 } },
    { id: 'seal_of_resilience', name: '坚韧之印', type: 'accessory', price: 400, desc: '最大 HP +5', effect: { stat: 'maxHp', value: 5 } },
  ],

  /* ============ 特殊（任务获得，不入商店） ============ */
  special: [
    { id: 'love_potion', name: '爱情药水', type: 'special', desc: '喝下后爱上自己，最大 HP +10' },
  ],
}

/** 便捷查询 */
window.ItemLib = {
  get (id) {
    for (const list of Object.values(ITEMS)) {
      const it = list.find(i => i.id === id)
      if (it) return it
    }
    return null
  },
  weapon (id) { return ITEMS.weapons.find(i => i.id === id) || null },
  accessory (id) { return ITEMS.accessories.find(i => i.id === id) || null },
}
