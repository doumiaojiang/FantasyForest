/** werewolf — 独立怪物数据。修改技能、文案、数值与专属任务配置请编辑本文件。 */
window.MONSTER_DEFINITIONS.push(
{
    id: 'werewolf',
    name: '狼人',
    maxHp: 15,
    intro: ['满月当空，你听到尖锐的嚎叫。', '下一秒你就被一只毛茸茸的生物压在身下。'],
    tagline: '不是他的错……他只是控制不住自己。',
    dildo: 'big_knotted',
    traits: ['charge'],
    abilities: { charge: { every: 3, multiplier: 1.75, interruptDamage: 4 } },
    elitePool: ['berserk', 'armored', 'cunning'],
    surrender: {
      tribute: 50,
      humiliation: { desc: '狼人让你趴在他脚边，他嗅了嗅你的全身，用爪子轻拍你的屁股取乐。', dmg: 3, status: 'confusion', turns: 3 },
    },
    attacks: [
      { roll: 1, name: '深插',   desc: '用带结大号假阴茎一插到底（让结卡在菊穴口），120 BPM 用力 30 秒', dmg: 3 },
      { roll: 2, name: '深插',   desc: '用带结大号假阴茎深插菊穴，90 BPM 缓慢 30 秒',      dmg: 1 },
      { roll: 3, name: '缩小',   desc: '云遮月，狼人力量减弱',        dmg: 0, status: 'size_down', turns: 7 },
      { roll: 4, name: '深插',   desc: '用带结大号假阴茎整根没入菊穴，150 BPM 持续抽插 1 分钟',    dmg: 3 },
      { roll: 5, name: '爪伤',   desc: '用带结大号假阴茎深插菊穴 30 秒（120 BPM），同时用指甲轻轻划过大腿模拟爪伤', dmg: 2, status: 'confusion', turns: 3 },
      { roll: 6, name: '中深插', desc: '用带结大号假阴茎插入菊穴中等深度，180 BPM 抽插 45 秒',  dmg: 2 },
    ],
    loot: {
      gold: 60,
      drops: [
        { roll: 1, itemId: 'orb_of_power' },
        { roll: 3, special: 'werewolf_final' },
      ],
    },
  }
)
