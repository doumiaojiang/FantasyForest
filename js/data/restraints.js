/**
 * data/restraints.js — 妖缚装置定义
 *
 * 妖缚装置 = 原创束缚系统（借鉴 DD 玩法思想，代码/名称/素材全部原创）。
 * 每个装置占一个身体槽位：neck / mouth / arms / legs / waist。
 * 分普通装置（可脱下）、上锁装置（钥匙/挣扎/割断/NPC）、剧情装置（剧情解除）。
 */

window.RESTRAINTS = [
  {
    id: 'slave_collar', name: '奴隶项圈', slot: 'neck', material: 'leather', price: 120, difficulty: 2, serviceGear: true,
    desc: '锁住脖子：被盘查/抓住时受到羞辱，越狱成功率降低；不触发“项圈”的接客加成。',
    effect: 'collar',
  },
  {
    id: 'leather_gag', name: '球形口塞', slot: 'mouth', material: 'leather', price: 100, difficulty: 2, serviceGear: true,
    desc: '封住嘴巴：无法触发接客口塞加成；战斗/伏击中的口交攻击只能硬挨（单倍伤害）。',
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
    id: 'chastity_device', name: '贞操带', slot: 'waist', material: 'metal', price: 200, difficulty: 3, femaleOnly: true,
    desc: '女性专用：封住小穴，涉及小穴的任务一律改为肛交。',
    effect: 'chastity',
  },
  {
    id: 'prison_chastity', name: '监狱贞操带', genderNames: { female: '监狱贞操带', male: '监狱贞操锁' }, slot: 'waist', material: 'metal', price: 0, difficulty: 5,
    desc: '深喉监狱的剧情锁：只能通过剧情解除（攒积分出狱或铁匠契约）。',
    effect: 'chastity', story: true,
  },
  {
    id: 'armbinder', name: '反绑束臂器', slot: 'arms_heavy', material: 'metal', price: 300, difficulty: 4, heavy: true,
    desc: '双臂反绑在身后：武器伤害大幅下降，无法使用任何物品。',
    effect: 'armbinder',
  },
  {
    id: 'blindfold', name: '眼罩', slot: 'eyes', material: 'leather', price: 80, difficulty: 2,
    desc: '蒙住双眼：战斗中被暴击概率提升，伏击时受到的伤害更大。',
    effect: 'blindfold',
  },
  {
    id: 'vibrating_chastity', name: '贞操锁', slot: 'waist', material: 'metal', price: 200, difficulty: 3, maleOnly: true,
    desc: '男性专用：锁住生殖器，涉及撸管或寸止的任务一律改为肛交。',
    effect: 'chastity',
  },
  {
    id: 'nipple_clamps', name: '乳夹', slot: 'chest', material: 'metal', price: 120, difficulty: 2,
    desc: '夹住乳头：战斗中每次受伤有 30% 概率额外 -1 HP（又麻又痛）。',
    effect: 'nipple',
  },
  {
    id: 'butterfly_clamps', name: '蝴蝶夹', slot: 'chest', material: 'metal', price: 160, difficulty: 3,
    desc: '蝶翼形夹具紧扣乳头：战斗中每次受伤有 30% 概率额外 -1 HP。',
    effect: 'nipple',
  },
  {
    id: 'chain_nipple_clamps', name: '链式乳夹', slot: 'chest', material: 'metal', price: 220, difficulty: 4, heavy: true,
    desc: '两枚乳夹由短链相连：战斗中每次受伤有 30% 概率额外 -1 HP；属于重型妖缚装备。',
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

  /* ============ 服务类妖缚装备（只有指定款式触发接客加成） ============ */
  {
    id: 'deepthroat_gag', name: '深喉口塞', slot: 'mouth', material: 'silicone', price: 140, difficulty: 3, serviceGear: true,
    desc: '固定张口与深喉姿势：无法触发接客口塞加成；战斗/伏击中的口交攻击只能硬挨。',
    effect: 'gag',
  },
  {
    id: 'slut_gag', name: '开口口塞', slot: 'mouth', material: 'leather', price: 160, difficulty: 2, buff: true, serviceGear: true,
    desc: '唯一能触发口塞接客加成的款式：插入任务强制 160 BPM（同时佩戴项圈时 180），金币翻倍。',
    effect: 'buff_gag',
  },
  {
    id: 'slut_collar', name: '项圈', slot: 'neck', material: 'leather', price: 150, difficulty: 2, buff: true, serviceGear: true,
    desc: '服务用项圈：插入任务强制 120 BPM，插入任务等级翻倍；奴隶项圈不触发此加成。',
    effect: 'buff_collar',
  },
  {
    id: 'lipstick', name: '口红', slot: 'lip', material: 'cosmetic', price: 50, difficulty: 1, buff: true, cosmetic: true, serviceGear: true,
    desc: '口唇妆容：口交服务额外 +20G。', effect: 'buff_lipstick',
  },
  {
    id: 'makeup', name: '全套妆容', slot: 'face', material: 'cosmetic', price: 150, difficulty: 1, buff: true, cosmetic: true, serviceGear: true,
    desc: '面部妆容：口交服务额外 +30G；可与口红同时装备。', effect: 'buff_makeup',
  },
  {
    id: 'heels', name: '8cm 高跟鞋', slot: 'feet', material: 'leather', price: 100, difficulty: 1, buff: true, serviceGear: true,
    desc: '服务类鞋履：8cm 鞋跟，适合日常接客。', effect: 'buff_heels',
  },
  {
    id: 'heels_10', name: '10cm 高跟鞋', slot: 'feet', material: 'leather', price: 130, difficulty: 1, buff: true, serviceGear: true,
    desc: '服务类鞋履：10cm 鞋跟。', effect: 'buff_heels',
  },
  {
    id: 'heels_12', name: '12cm 高跟鞋', slot: 'feet', material: 'leather', price: 170, difficulty: 2, buff: true, serviceGear: true,
    desc: '服务类鞋履：12cm 鞋跟。', effect: 'buff_heels',
  },
  {
    id: 'heels_14', name: '14cm 高跟鞋', slot: 'feet', material: 'leather', price: 220, difficulty: 3, buff: true, serviceGear: true,
    desc: '服务类鞋履：14cm 鞋跟。', effect: 'buff_heels',
  },
  {
    id: 'lingerie', name: '情趣内衣', slot: 'outfit', material: 'fabric', price: 200, difficulty: 1, buff: true, serviceGear: true,
    desc: '服装类妖缚装备：每项接客任务获得的等级翻倍。', effect: 'buff_lingerie',
  },
  {
    id: 'latex', name: '乳胶衣', slot: 'outfit', material: 'latex', price: 300, difficulty: 2, buff: true, serviceGear: true,
    desc: '服装类妖缚装备：每项接客任务获得的金币和等级都翻倍；与情趣内衣共用服装槽。', effect: 'buff_latex',
  },

  /* ============ 插入类妖缚装备（战斗格挡 + 接客加成，可自由穿脱） ============ */
  {
    id: 'butt_plug', name: '小肛塞', slot: 'anal', allowedSlots: ['anal'], material: 'silicone', price: 50, difficulty: 1,
    insert: true, sizeCm: 2.5, block: 1, prostituteBonus: 10,
    desc: '2.5 cm · 菊穴装备：防护充能上限 1 点；每点抵挡 1 次菊穴攻击及其效果，可找附魔师或在野外使用灵魂石补充；插入类接客 +10G。',
    effect: 'insert_block',
  },
  {
    id: 'medium_butt_plug', name: '中肛塞', slot: 'anal', allowedSlots: ['anal'], material: 'silicone', price: 80, difficulty: 1,
    insert: true, sizeCm: 3.5, block: 2, prostituteBonus: 15,
    desc: '3.5 cm · 菊穴装备：防护充能上限 2 点；每点抵挡 1 次菊穴攻击及其效果，可找附魔师或在野外使用灵魂石补充；插入类接客 +15G。',
    effect: 'insert_block',
  },
  {
    id: 'large_butt_plug', name: '大肛塞', slot: 'anal', allowedSlots: ['anal'], material: 'silicone', price: 120, difficulty: 2,
    insert: true, sizeCm: 4.2, block: 3, prostituteBonus: 20,
    desc: '4.2 cm · 菊穴装备：防护充能上限 3 点；每点抵挡 1 次菊穴攻击及其效果，可找附魔师或在野外使用灵魂石补充；插入类接客 +20G。',
    effect: 'insert_block',
  },
  {
    id: 'big_butt_plug', name: '巨肛塞', slot: 'anal', allowedSlots: ['anal'], material: 'silicone', price: 180, difficulty: 3,
    insert: true, sizeCm: 5.2, block: 4, prostituteBonus: 30, heavy: true,
    desc: '5.2 cm · 菊穴装备：防护充能上限 4 点；每点抵挡 1 次菊穴攻击及其效果，可找附魔师或在野外使用灵魂石补充；插入类接客 +30G。',
    effect: 'insert_block',
  },
  {
    id: 'vibrator_egg', name: '震动跳蛋', slot: 'vagina', allowedSlots: ['vagina'], material: 'silicone', price: 70, difficulty: 1,
    insert: true, stackable: true, maxStack: 4, femaleOnly: true, sizeCm: 2.8, block: 1, prostituteBonus: 10, vibrate: true,
    desc: '2.8 cm · 女性专用小穴装备：每颗增加 1 点防护充能上限（最多 4 点），可找附魔师或在野外使用灵魂石补充；插入类接客 +10G。',
    effect: 'insert_block',
  },
  {
    id: 'vibrating_dildo', name: '震动棒', slot: 'vagina', allowedSlots: ['vagina'], material: 'silicone', price: 130, difficulty: 2,
    insert: true, femaleOnly: true, sizeCm: 3.8, block: 3, prostituteBonus: 20, vibrate: true,
    desc: '3.8 cm · 女性专用小穴装备：防护充能上限 3 点；每点抵挡 1 次小穴攻击及其效果，可找附魔师或在野外使用灵魂石补充；插入类接客 +20G。',
    effect: 'insert_block',
  },
  {
    id: 'small_dildo', name: '小号假阳具', slot: 'anal', allowedSlots: ['anal', 'vagina'], material: 'silicone', price: 100, difficulty: 1,
    insert: true, dildo: true, maxOwn: 2, sizeCm: 2.5, block: 1, prostituteBonus: 10,
    desc: '2.5 cm · 可插入菊穴或小穴：对应部位防护充能上限 1 点，可找附魔师或在野外使用灵魂石补充；插入类接客 +10G。',
    effect: 'insert_block',
  },
  {
    id: 'medium_dildo', name: '中号假阳具', slot: 'anal', allowedSlots: ['anal', 'vagina'], material: 'silicone', price: 140, difficulty: 1,
    insert: true, dildo: true, maxOwn: 2, sizeCm: 3.5, block: 2, prostituteBonus: 15,
    desc: '3.5 cm · 可插入菊穴或小穴：对应部位防护充能上限 2 点，可找附魔师或在野外使用灵魂石补充；插入类接客 +15G。',
    effect: 'insert_block',
  },
  {
    id: 'dildo', name: '大号假阳具', slot: 'anal', allowedSlots: ['anal', 'vagina'], material: 'silicone', price: 180, difficulty: 2,
    insert: true, dildo: true, maxOwn: 2, sizeCm: 4.2, block: 3, prostituteBonus: 20,
    desc: '4.2 cm · 可插入菊穴或小穴：对应部位防护充能上限 3 点，可找附魔师或在野外使用灵魂石补充；插入类接客 +20G。',
    effect: 'insert_block',
  },
  {
    id: 'giant_dildo', name: '巨型假阳具', slot: 'anal', allowedSlots: ['anal', 'vagina'], material: 'silicone', price: 240, difficulty: 3,
    insert: true, dildo: true, maxOwn: 2, sizeCm: 5.2, block: 4, prostituteBonus: 30, heavy: true,
    desc: '5.2 cm · 可插入菊穴或小穴：对应部位防护充能上限 4 点，可找附魔师或在野外使用灵魂石补充；插入类接客 +30G。',
    effect: 'insert_block',
  },
]
