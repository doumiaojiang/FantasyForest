/**
 * data/restraints.js — 妖缚装置定义
 *
 * 妖缚装置 = 原创束缚系统（借鉴 DD 玩法思想，代码/名称/素材全部原创）。
 * 每个装置占一个身体槽位：neck / mouth / arms / legs / waist。
 * 分普通装置（可脱下）、上锁装置（钥匙/挣扎/割断/NPC）、剧情装置（剧情解除）。
 */

window.RESTRAINTS = [
  {
    id: 'slave_collar', name: '奴隶项圈', slot: 'neck', material: 'leather', price: 120, difficulty: 2,
    desc: '锁住脖子：被盘查/抓住时当成奴畜羞辱，越狱成功率降低。',
    effect: 'collar',
  },
  {
    id: 'leather_gag', name: '皮革口塞', slot: 'mouth', material: 'leather', price: 100, difficulty: 2,
    desc: '塞住嘴巴：口交/深喉类服务做不了，战斗中的口交攻击只能硬挨（单倍伤害）。',
    effect: 'gag',
  },
  {
    id: 'handcuffs', name: '手铐', slot: 'arms', material: 'metal', price: 150, difficulty: 3,
    desc: '锁住双手：武器伤害降低，战斗中无法使用物品。',
    effect: 'handcuffs',
  },
  {
    id: 'leg_cuffs', name: '脚镣', slot: 'legs', material: 'metal', price: 150, difficulty: 3,
    desc: '锁住双脚：每回合移动步数 -1（最低 1 格）。',
    effect: 'leg_cuffs',
  },
  {
    id: 'chastity_device', name: '贞操装置', slot: 'waist', material: 'metal', price: 200, difficulty: 3,
    desc: '锁死小穴：小穴/撸管/寸止任务一律改为肛交。',
    effect: 'chastity',
  },
  {
    id: 'prison_chastity', name: '监狱贞操锁', slot: 'waist', material: 'metal', price: 0, difficulty: 5,
    desc: '深喉监狱的剧情锁：只能通过剧情解除（攒积分出狱或铁匠契约）。',
    effect: 'chastity', story: true,
  },
  {
    id: 'armbinder', name: '反绑束臂器', slot: 'arms_heavy', material: 'metal', price: 300, difficulty: 4, heavy: true,
    desc: '双臂反绑在身后：武器伤害大幅下降，无法使用任何物品。',
    effect: 'armbinder',
  },
  {
    id: 'blindfold', name: '蒙眼罩', slot: 'eyes', material: 'leather', price: 80, difficulty: 2,
    desc: '蒙住双眼：战斗中被暴击概率提升，伏击时受到的伤害更大。',
    effect: 'blindfold',
  },
  {
    id: 'vibrating_chastity', name: '震动贞操带', slot: 'waist', material: 'metal', price: 280, difficulty: 4, heavy: true,
    desc: '锁死小穴（同贞操装置）且内置震动机关：战斗中 30% 概率失控颤抖，本回合攻击落空。',
    effect: 'chastity', vibrate: true,
  },
]