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
    desc: '塞住嘴巴：战斗/伏击中的口交攻击只能硬挨（单倍伤害）。',
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
  {
    id: 'nipple_clamps', name: '乳夹', slot: 'chest', material: 'metal', price: 120, difficulty: 2,
    desc: '夹住乳头：战斗中每次受伤有 30% 概率额外 -1 HP（又麻又痛）。',
    effect: 'nipple',
  },
  {
    id: 'corset', name: '束腰', slot: 'torso', material: 'metal', price: 180, difficulty: 3,
    desc: '勒紧腰身：战斗中摆不出防御姿态（无法防御）。',
    effect: 'corset',
  },
  {
    id: 'ankle_chains', name: '脚链', slot: 'ankles', material: 'metal', price: 130, difficulty: 2,
    desc: '拖着脚链：移动步数 -1（可与脚镣叠加）。',
    effect: 'ankle_chains',
  },

  /* ============ 媚奴用品（原酒馆妓女用品，整合进妖缚槽位，buff 类，可自由穿脱） ============ */
  {
    id: 'lipstick', name: '口红', slot: 'lip', material: 'cosmetic', price: 50, difficulty: 1, buff: true, cosmetic: true,
    desc: '媚奴妆容（口唇）：口交服务额外 +20G。',
    effect: 'buff_lipstick',
  },
  {
    id: 'makeup', name: '全套妆容', slot: 'face', material: 'cosmetic', price: 150, difficulty: 1, buff: true, cosmetic: true,
    desc: '媚奴妆容（面妆）：口交服务额外 +30G；与口红同时装备合计 +50G。',
    effect: 'buff_makeup',
  },
  {
    id: 'slut_gag', name: '媚奴口塞', slot: 'mouth', material: 'leather', price: 100, difficulty: 2, buff: true,
    desc: '媚奴用品：插入任务强制 160 BPM（+媚奴项圈则 180），插入任务金币翻倍。',
    effect: 'buff_gag',
  },
  {
    id: 'slut_collar', name: '媚奴项圈', slot: 'neck', material: 'leather', price: 150, difficulty: 2, buff: true,
    desc: '媚奴用品：插入任务强制 120 BPM，插入任务等级翻倍。',
    effect: 'buff_collar',
  },
  {
    id: 'heels', name: '高跟鞋', slot: 'legs', material: 'leather', price: 100, difficulty: 1, buff: true,
    desc: '媚奴用品：没有实际效果，但穿着被操的感觉无敌。',
    effect: 'buff_heels',
  },
  {
    id: 'lingerie', name: '情趣内衣', slot: 'torso', material: 'fabric', price: 200, difficulty: 1, buff: true,
    desc: '媚奴用品：每项接客任务获得的等级翻倍。',
    effect: 'buff_lingerie',
  },
  {
    id: 'latex', name: '乳胶衣', slot: 'torso', material: 'fabric', price: 300, difficulty: 1, buff: true,
    desc: '媚奴用品：每项接客任务获得的金币和等级都翻倍。',
    effect: 'buff_latex',
  },
  /* ============ 插入类 DD 装备（战斗格挡 + 接客加成，可自由穿脱） ============ */
  {
    id: 'butt_plug', name: '小肛塞', slot: 'anal', allowedSlots: ['anal'], material: 'silicone', price: 50, difficulty: 1,
    insert: true, sizeCm: 2.5, block: 1, prostituteBonus: 10,
    desc: '2.5 cm · 菊穴装备：每场战斗抵挡 1 次菊穴攻击及其效果；插入类接客 +10G。',
    effect: 'insert_block',
  },
  {
    id: 'medium_butt_plug', name: '中肛塞', slot: 'anal', allowedSlots: ['anal'], material: 'silicone', price: 80, difficulty: 1,
    insert: true, sizeCm: 3.5, block: 2, prostituteBonus: 15,
    desc: '3.5 cm · 菊穴装备：每场战斗抵挡 2 次菊穴攻击及其效果；插入类接客 +15G。',
    effect: 'insert_block',
  },
  {
    id: 'large_butt_plug', name: '大肛塞', slot: 'anal', allowedSlots: ['anal'], material: 'silicone', price: 120, difficulty: 2,
    insert: true, sizeCm: 4.2, block: 3, prostituteBonus: 20,
    desc: '4.2 cm · 菊穴装备：每场战斗抵挡 3 次菊穴攻击及其效果；插入类接客 +20G。',
    effect: 'insert_block',
  },
  {
    id: 'big_butt_plug', name: '巨肛塞', slot: 'anal', allowedSlots: ['anal'], material: 'silicone', price: 180, difficulty: 3,
    insert: true, sizeCm: 5.2, block: 4, prostituteBonus: 30, heavy: true,
    desc: '5.2 cm · 菊穴装备：每场战斗抵挡 4 次菊穴攻击及其效果；插入类接客 +30G。',
    effect: 'insert_block',
  },
  {
    id: 'vibrator_egg', name: '震动跳蛋', slot: 'vagina', allowedSlots: ['vagina'], material: 'silicone', price: 70, difficulty: 1,
    insert: true, stackable: true, maxStack: 4, femaleOnly: true, sizeCm: 2.8, block: 1, prostituteBonus: 10, vibrate: true,
    desc: '2.8 cm · 女性专用小穴装备：可按颗塞入（最多 4 颗）；每颗抵挡 1 次小穴攻击，插入类接客 +10G。',
    effect: 'insert_block',
  },
  {
    id: 'vibrating_dildo', name: '震动棒', slot: 'vagina', allowedSlots: ['vagina'], material: 'silicone', price: 130, difficulty: 2,
    insert: true, femaleOnly: true, sizeCm: 3.8, block: 3, prostituteBonus: 20, vibrate: true,
    desc: '3.8 cm · 女性专用小穴装备：每场战斗抵挡 3 次小穴攻击及其效果；插入类接客 +20G。',
    effect: 'insert_block',
  },
  {
    id: 'small_dildo', name: '小号假阳具', slot: 'anal', allowedSlots: ['anal', 'vagina'], material: 'silicone', price: 100, difficulty: 1,
    insert: true, dildo: true, maxOwn: 2, sizeCm: 2.5, block: 1, prostituteBonus: 10,
    desc: '2.5 cm · 可插入菊穴或小穴：每场抵挡对应部位 1 次攻击；插入类接客 +10G。',
    effect: 'insert_block',
  },
  {
    id: 'medium_dildo', name: '中号假阳具', slot: 'anal', allowedSlots: ['anal', 'vagina'], material: 'silicone', price: 140, difficulty: 1,
    insert: true, dildo: true, maxOwn: 2, sizeCm: 3.5, block: 2, prostituteBonus: 15,
    desc: '3.5 cm · 可插入菊穴或小穴：每场抵挡对应部位 2 次攻击；插入类接客 +15G。',
    effect: 'insert_block',
  },
  {
    id: 'dildo', name: '大号假阳具', slot: 'anal', allowedSlots: ['anal', 'vagina'], material: 'silicone', price: 180, difficulty: 2,
    insert: true, dildo: true, maxOwn: 2, sizeCm: 4.2, block: 3, prostituteBonus: 20,
    desc: '4.2 cm · 可插入菊穴或小穴：每场抵挡对应部位 3 次攻击；插入类接客 +20G。',
    effect: 'insert_block',
  },
  {
    id: 'giant_dildo', name: '巨型假阳具', slot: 'anal', allowedSlots: ['anal', 'vagina'], material: 'silicone', price: 240, difficulty: 3,
    insert: true, dildo: true, maxOwn: 2, sizeCm: 5.2, block: 4, prostituteBonus: 30, heavy: true,
    desc: '5.2 cm · 可插入菊穴或小穴：每场抵挡对应部位 4 次攻击；插入类接客 +30G。',
    effect: 'insert_block',
  },
]
