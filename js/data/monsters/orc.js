/** orc — 独立怪物数据。修改技能、文案、数值与专属任务配置请编辑本文件。 */
window.MONSTER_DEFINITIONS.push(
{
    id: 'orc',
    name: '兽人',
    maxHp: 15,
    intro: ['你坐下休息了一会儿，一道不祥的阴影笼罩了你。', '一个巨大的兽人从背后抓住你，干了你。'],
    tagline: '他的鸡巴很大，但他的梦想更大。',
    dildo: 'big',
    traits: ['charge'],
    abilities: { charge: { every: 3, multiplier: 1.75, interruptDamage: 4 } },
    elitePool: ['berserk', 'armored', 'toxic'],
    surrender: {
      tribute: 60,
      humiliation: { desc: '兽人让你趴在地上学狗叫，用大鸡巴拍打你的脸羞辱你，直到他满意。', dmg: 4, status: 'sleepy', turns: 2 },
    },
    attacks: [
      { roll: 1, name: '中深插', desc: '用大号假阴茎插入菊穴一半深度，180 BPM 快节奏抽插 30 秒',     dmg: 2 },
      { roll: 2, name: '口交',   desc: '用大号假阴茎塞进嘴里深喉吞吐，90 BPM 口交 30 秒，含到想吐', dmg: 0, status: 'poisoned', turns: 3 },
      { roll: 3, name: '锁喉深插', desc: '用大号假阴茎深插菊穴 45 秒（90 BPM），同时掐住自己的脖子模拟锁喉', dmg: 3, status: 'sleepy', turns: 3, special: 'choke' },
      { roll: 4, name: '深插',   desc: '用大号假阴茎整根没入菊穴，150 BPM 用力抽插直到喊停', dmg: 4 },
      { roll: 5, name: '中深插', desc: '用大号假阴茎插入菊穴一半，120 BPM 稳定抽插 45 秒',     dmg: 2 },
      { roll: 6, name: '慢深插', desc: '用大号假阴茎缓缓插入菊穴直到一插到底，30 BPM 极慢但每一下都顶到底，持续 30 秒',       dmg: 1 },
    ],
    loot: {
      gold: 90,
      drops: [
        { roll: 1, itemId: 'awakening' },
        { roll: 6, status: 'regeneration', turns: 2, level: 3, flavor: '被兽人腥臭的鸡巴所吸引，你获得了再生。' },    // 特殊：再生 III
      ],
    },
  }
)
