/** sorceress — 独立怪物数据。修改技能、文案、数值与专属任务配置请编辑本文件。 */
window.MONSTER_DEFINITIONS.push(
{
    id: 'sorceress',
    name: '魔女',
    maxHp: 12,
    intro: ['你感觉双脚越来越沉，低头一看已经石化了。', '一个女孩朝你走来，对你下了诅咒。'],
    tagline: '她看起来人畜无害，但她真的会诅咒你的屁眼。',
    dildo: 'normal',
    traits: ['summon', 'guard'],
    abilities: { guard: { start: 1, reduction: 0.5, breakDamage: 4 } },
    elitePool: ['armored', 'toxic', 'cunning'],
    props: { firstStrike: true },
    surrender: {
      tribute: 50,
      humiliation: { desc: '魔女对你念下缩小咒，让你在掌心里扭动求饶，她才肯放你一马。', dmg: 2, status: 'size_down', turns: 5 },
    },
    attacks: [
      { roll: 1, name: '召唤小兵', desc: '魔女召唤小兵！用普通假阴茎浅插菊穴，自行数 15 秒（小兵每回合会对你造成 1 点伤害，可攻击击杀）', dmg: 2, special: 'summon' },
      { roll: 2, name: '能量掌掴', desc: '用普通假阴茎抽打自己屁股 20 下，最后一击用力打翻自己', dmg: 1, status: 'stunned', turns: 1 },
      { roll: 3, name: '藤蔓插',   desc: '用普通假阴茎插入菊穴中等深度，150 BPM 抽插 30 秒', dmg: 2 },
      { roll: 4, name: '岩石操',   desc: '用普通假阴茎抵住菊穴口，60 BPM 上下蹲坐让它在原地抽插，持续 30 秒', dmg: 2 },
      { roll: 5, name: '缩小指插', desc: '想象手指变成假阴茎，用普通假阴茎浅插菊穴，200 BPM 飞快抽插 1 分钟', dmg: 3, status: 'size_up', turns: 10 },
      { roll: 6, name: '魅惑变身', desc: '闭上眼想象最火辣的画面让自己欲火焚身，保持 30 秒不动', dmg: 0, status: 'confusion', turns: 3 },
    ],
    loot: {
      gold: 75,
      drops: [
        { roll: 4, itemId: 'barrier_spell' },
        { roll: 5, special: 'reroll_encounter' },
      ],
    },
  }
)
