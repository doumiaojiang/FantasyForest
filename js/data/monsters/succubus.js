/** succubus — 独立怪物数据。修改技能、文案、数值与专属任务配置请编辑本文件。 */
window.MONSTER_DEFINITIONS.push(
{
    id: 'succubus',
    name: '魅魔',
    maxHp: 8,
    intro: ['你面前的地面裂开，一道通往地狱的传送门打开了。', '一只魅魔掌控了你的性欲，开始享用你。'],
    tagline: '她靠吸取你的性能量为生——不过她也喜欢巧克力。',
    dildo: 'normal',
    traits: ['life_link', 'escape'],
    abilities: { escape: { threshold: 0.25 } },
    elitePool: ['cunning', 'toxic', 'berserk'],
    surrender: {
      tribute: 40,
      humiliation: { desc: '魅魔让你亲吻她的脚尖示好，她吸走你一半的精力才肯放过你。', dmg: 3, status: 'sleepy', turns: 2 },
    },
    props: {
      lifeLink: true,         // 50% 治疗分流
      selfDamageOnHit: true,  // 每次攻击自伤 1（暴击 2）
      maxSelfHp: 10,          // 回血上限
    },
    attacks: [
      { roll: 1, name: '再生之吻', desc: '在你额头上轻轻一吻，赋予你再生印记。再生 II，持续 3 回合（记住，一半回血会转移给她）', dmg: 0, status: 'regeneration', turns: 3, level: 2 },
      { roll: 2, name: '让你干她', desc: '用飞机杯（或手模拟）干她的小穴，以 150 BPM 持续 1 分钟或直到你寸止一次。她 +2 HP', dmg: 0, special: 'heal_self', heal: 2 },
      { roll: 3, name: '深插',     desc: '用普通假阴茎每次一插到底地操你的菊穴，150 BPM 用力 30 秒', dmg: 3 },
      { roll: 4, name: '自由插',   desc: '用普通假阴茎以任意速度和深度干你的菊穴，自由发挥 45 秒', dmg: 2 },
      { roll: 5, name: '缩小粉',   desc: '你嫌她鸡巴太大。她飞到云层撒下魔法粉末，森林里所有怪物的鸡巴都开始缩小', dmg: 0, status: 'size_down', turns: 10 },
      { roll: 6, name: '吸取',     desc: '用手套弄自己的鸡巴直到快要射精就停下（寸止），从中吸收 1 HP。你 -1 HP，她 +1 HP', dmg: 1, special: 'drain_self', heal: 1 },
    ],
    loot: {
      gold: 60,
      drops: [
        { roll: 1, itemId: 'green_herb' },
        // roll 4 特殊：临死反击（游戏内特殊处理）
      ],
    },
  }
)
