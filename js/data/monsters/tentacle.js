/** tentacle — 独立怪物数据。修改技能、文案、数值与专属任务配置请编辑本文件。 */
window.MONSTER_DEFINITIONS.push(
{
    id: 'tentacle',
    name: '触手怪',
    maxHp: 10,
    intro: ['你被树根绊倒在地，感觉有滑溜溜的东西在试探你的屁眼。', '一只触手怪物开始干你。'],
    tagline: '它到底恶不恶心？还是说……它只是被世人误解了？',
    dildo: 'normal',
    traits: ['poison'],
    abilities: { poison: { chance: 0.2, turns: 2 } },
    elitePool: ['toxic', 'armored', 'cunning'],
    surrender: {
      tribute: 30,
      humiliation: { desc: '你跪下来，让触手怪用滑腻的触手在你脸上轻轻蹭过，逼你说出「我是它的肉便器」才能离开。', dmg: 3 },
    },
    attacks: [
      { roll: 1, name: '深插',     desc: '将普通假阴茎整根没入菊穴，以 120 BPM 的节奏用力抽插 1 分钟',   dmg: 3 },
      { roll: 2, name: '浅插',     desc: '用普通假阴茎只在菊穴口附近浅浅抽插，60 BPM 缓慢进行 30 秒',     dmg: 1 },
      { roll: 3, name: '浅插',     desc: '用普通假阴茎浅浅抽插菊穴，120 BPM 持续 45 秒',    dmg: 2 },
      { roll: 4, name: '滑动',     desc: '不插入，用普通假阴茎的头部贴着菊穴口来回缓慢滑动摩擦，全程 30 秒（不需要节拍，自己感受节奏）',    dmg: 0, status: 'poisoned', turns: 2 },
      { roll: 5, name: '双插',     desc: '用普通假阴茎深插菊穴，同时用手指在嘴里模拟另一根触手，120 BPM 双洞同时进行 45 秒', dmg: 3, status: 'stunned', turns: 1 },
      { roll: 6, name: '深插',     desc: '用普通假阴茎深深插入菊穴，90 BPM 缓缓抽插 30 秒',      dmg: 2 },
    ],
    loot: {
      gold: 45,
      drops: [
        { roll: 3, itemId: 'special_cream' },
        { roll: 6, special: 'tentacle_embedded' },
      ],
    },
  }
)
