/**
 * data/monsters.js — 怪物数据库
 *
 * 每只怪物为一个对象，支持 schema：
 *
 * @property {number}  id        — 唯一标识
 * @property {string}  name      — 显示名称
 * @property {number}  maxHp     — 最大 HP
 * @property {number}  minHp     — 可考虑不设，HP 固定
 * @property {string}  intro     — 首次遇见的描述（分阶段展开用）
 * @property {object}  props     — 特殊属性（如魅魔的生命链接）
 * @property {object[]} attacks  — 攻击表 [{ roll, name, desc, dmg, status?, turns?, bpm?, duration?, special? }]
 * @property {object}  loot      — 战利品 {
 *                                  gold: number,
 *                                  drops: [{ roll, itemId, chance? }]
 *                                }
 * @property {string}  dildo     — 推荐的假阳具类型
 * @property {string?} tagline   — 吐槽/描述
 *
 * 新增怪物：直接在 MONSTERS 数组中追加对象即可。
 */

window.MONSTERS = [
  {
    id: 'tentacle',
    name: '触手怪',
    maxHp: 10,
    intro: ['你被树根绊倒在地，感觉有滑溜溜的东西在试探你的屁眼。', '一只触手怪物开始干你。'],
    tagline: '它到底恶不恶心？还是说……它只是被世人误解了？',
    dildo: 'normal',
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
  },
  {
    id: 'orc',
    name: '兽人',
    maxHp: 15,
    intro: ['你坐下休息了一会儿，一道不祥的阴影笼罩了你。', '一个巨大的兽人从背后抓住你，干了你。'],
    tagline: '他的鸡巴很大，但他的梦想更大。',
    dildo: 'big',
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
  },
  {
    id: 'sorceress',
    name: '魔女',
    maxHp: 12,
    intro: ['你感觉双脚越来越沉，低头一看已经石化了。', '一个女孩朝你走来，对你下了诅咒。'],
    tagline: '她看起来人畜无害，但她真的会诅咒你的屁眼。',
    dildo: 'normal',
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
  },
  {
    id: 'succubus',
    name: '魅魔',
    maxHp: 8,
    intro: ['你面前的地面裂开，一道通往地狱的传送门打开了。', '一只魅魔掌控了你的性欲，开始享用你。'],
    tagline: '她靠吸取你的性能量为生——不过她也喜欢巧克力。',
    dildo: 'normal',
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
  },
  {
    id: 'goblins',
    name: '哥布林',
    maxHp: 5,    // 每只 5 HP，数量由 count 决定
    intro: ['一群哥布林从不同方向朝你冲来。', '它们轮流干你。'],
    tagline: '它们想要你的金币，但有洞插也行。',
    dildo: 'small',
    surrender: {
      tribute: 30,
      humiliation: { desc: '哥布林们围着你，让你学它们蹦跳着跳舞取乐，直到它们笑够才放你走。', dmg: 2, status: 'confusion', turns: 2 },
    },
    props: {
      packHunt: true,       // 群居，只剩 1 只时逃跑
      maxPack: 5,
      countRolls: [3, 3, 4, 4, 4, 5],   // Z 1-2:3, 3-5:4, 6:5
    },
    attacks: [
      { roll: 1, name: '内讧',     desc: '用一根小号假阴茎插入菊穴中等深度，180 BPM 抽插 45 秒（随机一只哥布林干你）', dmg: 3, special: 'infight' },
      { roll: 2, name: '轮换双插', desc: '一根小号假阴茎浅插菊穴，另一根（或手指）在嘴里，120 BPM 每 10 秒轮换一次', dmg: 4, status: 'confusion', turns: 3, special: 'goblin_rotate', taskBpm: 120, taskSecondsPerRound: 10 },
      { roll: 3, name: '深插',     desc: '用小号假阴茎深插菊穴，120 BPM，每只哥布林 15 秒', dmg: 2, special: 'goblin_deep', taskBpm: 120, taskSeconds: 15 },
      { roll: 4, name: '偷袭休息', desc: '假装闭眼休息，半数哥布林（向上取整）用小号假阴茎深插菊穴，60 BPM 每只 10-20 秒', dmg: 1, status: 'sleepy', turns: 3, special: 'goblin_rest', taskBpm: 60, taskTimeMin: 10, taskTimeMax: 20 },
      { roll: 5, name: '偷金',     desc: '用小号假阴茎浅插菊穴 30 秒，同时另外的哥布林偷走你的金币', dmg: 1, special: 'steal', gold: 40 },
      { roll: 6, name: '叫帮手',   desc: '召唤 1 只哥布林加入战斗', dmg: 0, special: 'summon_goblin' },
    ],
    loot: {
      gold: 30,              // × 初始哥布林数量
      drops: [
        { roll: 3, itemId: 'butt_plug' },
        { roll: 6, special: 'stolen_gold', gold: 200 },
      ],
    },
  },
  {
    id: 'werewolf',
    name: '狼人',
    maxHp: 15,
    intro: ['满月当空，你听到尖锐的嚎叫。', '下一秒你就被一只毛茸茸的生物压在身下。'],
    tagline: '不是他的错……他只是控制不住自己。',
    dildo: 'big_knotted',
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
  },
  {
    id: 'spirit_of_forest',
    name: '森林之灵',
    maxHp: 50,
    intro: [
      '你终于到达村庄，却发现这里已经空无一人。路中央站着一个陌生女孩，她正缓缓朝你走来。',
      '“我是这片森林的精灵。想见到你的小骚货，就必须打败我。”',
      '“希望你在我森林里的散步还算愉快——因为我一直很享受看着你。没错，你经历的一切都是我干的，还有更多好戏等着你呢。”',
    ],
    tagline: '她掌控着森林里的一切。想打倒她可没那么容易。',
    dildo: 'normal',
    bossRules: [
      { icon: '🎲', title: '双骰召唤', text: '每回合先掷 Y 决定敌人，再掷 Z 决定该敌人的攻击。' },
      { icon: '🌲', title: '短暂控制', text: '被控制的敌人只行动 1 回合；你只需击败森林之灵本体。' },
      { icon: '⚔️', title: '力量翻倍', text: '所有召唤攻击的伤害翻倍，状态持续回合也翻倍。' },
      { icon: '💚', title: '治疗反转', text: '所有治疗攻击转而治疗森林之灵，治疗量翻倍；你自己使用的治疗道具不受影响。魅魔再生仍按分流机制结算。' },
      { icon: '🔮', title: '援军规则', text: '魔女小兵照常出现；哥布林叫来的帮手视作同类小兵。' },
      { icon: '💾', title: '战前存档', text: '专用战前快照不会被战斗中的普通存档覆盖。' },
    ],
    props: {
      isBoss: true,
      summonEnemyEachTurn: true,      // 每回合召唤一只怪物
      summonDmgMult: 2,               // 召唤怪物伤害翻倍
    },
    // 森林之灵本身不直接攻击，每回合召唤怪物攻击
    attacks: [],
    loot: {
      gold: 0,
      drops: [],
    },
  },
]
