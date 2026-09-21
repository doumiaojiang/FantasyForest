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
 * @property {string[]} traits   — 战斗前显示的特性 id
 * @property {object} abilities  — 数据驱动战斗能力（poison/charge/guard/escape）
 * @property {string[]} elitePool — 可随机获得的精英词缀
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
  },
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
  },
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
  },
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
  },
  {
    id: 'p_caravan_guard',
    name: 'P 的车队看守',
    maxHp: 6,
    intro: ['桥下传来皮靴踩碎枯枝的声音。', '一个回来寻找许可的车队看守挡住了桥墩。'],
    tagline: '他只是个落单的看守；除非你非要把他的同伙也叫下来。',
    dildo: 'normal',
    traits: [],
    elitePool: ['berserk'],
    props: { storyEncounter: true, adultCombatTasks: true },
    attacks: [
      {
        roll: 1, name: '强制搜身',
        desc: '看守把你抵在断桥栏上，从腰包到鞋底一层层翻查。他根本不在找许可——只是想看看今天能从你身上刮走什么。',
        dmg: 0, special: 'caravan_search', searchTier: 1, part: 'inventory', inspectionPart: 'anal',
        provoked: {
          name: '双人抄检',
          desc: '被你叫来的同伙堵住另一边，一人扣住手腕，另一人把背包倒在桥板上。“挑一件值钱的；没有，就给他记账。”',
          dmg: 0, special: 'caravan_search', searchTier: 2, part: 'inventory', inspectionPart: 'anal',
        },
      },
      {
        roll: 2, name: '皮带惩戒',
        desc: '看守把你踹向断栏，扯下腰带连续抽向臀部。“二十下。每挨一下就报一次数，少一下就从头重新算。”服从回响把你钉在受罚姿势里，直到规定次数全部结束。',
        dmg: 1, part: 'body', taskCount: 20, taskTool: '皮带、拍子、鞭子或手掌',
        taskSteps: [
          { at: 0, label: '二十下报数', text: '上身前倾撑稳，选择一种工具击打臀部；每一下都要出声报数，完成二十下后点击完成。' },
        ],
        provoked: {
          name: '双人轮罚',
          desc: '同伙扣住你的手腕，把你整个人压在桥栏上。两条皮带从左右轮流落下。“三十下，一边十五。挑衅的时候不是很有胆子吗？把屁股抬高，报清楚。”',
          dmg: 2, part: 'body', taskCount: 30, taskTool: '两种工具交替，或左右手交替',
          taskSteps: [
            { at: 0, label: '三十下轮罚', text: '上身压低撑稳，左右交替击打臀部；每一下出声报数，完成三十下后点击完成。' },
          ],
        },
      },
      {
        roll: 3, name: '封口审讯',
        desc: '看守抓住头发迫你仰起脸，膝盖顶住肩膀，解开裤裆堵住你未说完的话。“偷贼不需要交代，会听命令就够了。”你的头颈被服从回响接管，只能跟随他的节奏。',
        dmg: 1, part: 'oral', taskBpm: 100, taskSeconds: 30,
        taskSteps: [
          { at: 0, label: '被迫仰头', text: '保持跪姿，一手放在后颈，抬起下巴等待命令。' },
          { at: 8, label: '强制吞吐', text: '按100 BPM连续前后动作，每八拍停住一拍。' },
          { at: 23, label: '禁止开口', text: '继续保持节奏，双手回到背后，不许抬头躲开。' },
        ],
        provoked: {
          name: '轮流封口',
          desc: '两名看守一人扣住一边肩膀，轮流抓着你的头发把脸拉向自己。“既然你这么喜欢叫人，嘴就别停。”服从回响每十秒更换一次主人，不给你完整喘息的间隙。',
          dmg: 2, part: 'oral', taskBpm: 140, taskSeconds: 40,
          taskSteps: [
            { at: 0, label: '第一人', text: '跪好，双手背后，按140 BPM开始连续前后动作。' },
            { at: 10, label: '换到另一边', text: '偏向另一侧，保持原节奏，每八拍停一拍。' },
            { at: 20, label: '再次轮换', text: '重新换边，手仍放在背后，不许减速。' },
            { at: 30, label: '最后十秒', text: '两边每四拍轮换一次，直到看守放手。' },
          ],
        },
      },
      {
        roll: 4, name: '断桥后入',
        desc: '看守将你的双臂重重压上断裂桥栏，一脚踢开双腿，从身后插入菊穴。“许可不肯交，那就用这个姿势受审。”他抓紧腰胯猛力抽插，世界规则迫使你的身体迎合每一次冲撞。',
        dmg: 2, part: 'anal', taskBpm: 140, taskSeconds: 35,
        taskSteps: [
          { at: 0, label: '压上断栏', text: '双手或前臂向前撑稳，双腿分开，上身压低。' },
          { at: 8, label: '强制迎合', text: '按140 BPM连续前后摆动髋部，每八拍停住一拍。' },
          { at: 27, label: '压到最深', text: '幅度加大，每四拍停顿一次，姿势不得改变。' },
        ],
        provoked: {
          name: '前后夹击',
          desc: '一名看守把你的上身压过桥栏，从身后插入菊穴猛烈抽插；另一人绕到面前，掐住下巴逼你仰头。“两边都伺候你，这下满意了？”服从回响同时锁定你的腰胯与头颈，连躲开视线都做不到。',
          dmg: 3, part: 'anal', taskBpm: 170, taskSeconds: 45,
          taskSteps: [
            { at: 0, label: '前后锁定', text: '上身压低，双手向前撑稳，下巴抬起。' },
            { at: 10, label: '连续夹击', text: '按170 BPM摆动髋部，每八拍停一拍，保持抬头。' },
            { at: 30, label: '最后加速', text: '每四拍改变一次幅度，双腿不许合拢。' },
          ],
        },
      },
      {
        roll: 5, name: '编号示众',
        desc: '看守把你的衣服全部收走，拖到桥面最显眼的位置，再把车队墨印重重拍上赤裸的身体。“双手抱头，腿打开。蹲下去，把编号拱起来给所有人看清。”服从回响逼迫你按他的拍子反复展示。',
        dmg: 1, status: 'confusion', turns: 1, taskBpm: 60, taskSeconds: 30,
        taskSteps: [
          { at: 0, label: '衣物没收', text: '脱下全部衣物，双手抱头，双脚打开，保持半蹲。' },
          { at: 5, label: '拱穴示众', text: '按60 BPM反复下蹲并向后拱臀，每一拍完成一次展示动作。' },
          { at: 25, label: '定格验号', text: '保持双手抱头、双腿打开和臀部后拱，直到看守核对完编号。' },
        ],
        repeat: {
          name: '二次编号示众',
          desc: '看守发现你的衣服早已被收走，便捏住下巴把你重新推到桥中央。“没东西可脱了？那就自己提着乳头，把后面拱起来。眼睛翻上去，舌头伸出来。”墨印旁又添上一道记号，围观的笑声比第一次更近。',
          taskBpm: 60, taskSeconds: 30,
          taskSteps: [
            { at: 0, label: '二次验货', text: '双脚打开半蹲，双手提住乳头，臀部向后拱起。' },
            { at: 5, label: '表情展示', text: '保持阿黑颜与吐舌，按60 BPM反复下蹲、拱臀。' },
            { at: 25, label: '追加编号', text: '维持动作和表情，在原有墨印旁等待追加记号。' },
          ],
        },
        provoked: {
          name: '公开登记',
          desc: '同伙们从林边聚到桥头，一人收走你的全部衣物，另一人将更大的车队印记拍在赤裸的身体上。“挑衅车队的货，就该让所有人看清。”你被按成抱头半蹲的姿势，在一圈哄笑中按拍子反复拱起臀部。',
          dmg: 2, status: 'confusion', turns: 2, taskBpm: 60, taskSeconds: 40,
          taskSteps: [
            { at: 0, label: '公开没收', text: '脱下全部衣物，双手抱头，双脚打开，保持半蹲。' },
            { at: 5, label: '集体示众', text: '按60 BPM反复下蹲并向后拱臀，每一拍完成一次展示动作。' },
            { at: 32, label: '公开验号', text: '保持双手抱头和臀部后拱，让所有看守逐一核对编号。' },
          ],
          repeat: {
            name: '公开复验',
            desc: '同伙发现你早已全裸，便把你重新拖到桥头最大的车队印记前。“衣服已经没了，就把货物的样子做足。”他们命你提住乳头、向后拱起臀部，在所有人的注视下保持翻眼吐舌的表情。',
            taskBpm: 60, taskSeconds: 40,
            taskSteps: [
              { at: 0, label: '公开复验', text: '双脚打开半蹲，双手提住乳头，臀部向后拱起。' },
              { at: 5, label: '集体验货', text: '保持翻眼吐舌，按60 BPM反复下蹲、拱臀。' },
              { at: 32, label: '追加印记', text: '维持动作和表情，让看守在原有编号旁追加公开验货记号。' },
            ],
          },
        },
      },
      {
        roll: 6, name: '车队束缚',
        desc: '看守从货箱里抽出一件带编号的束缚器具，不由分说地扣到你身上。锁扣还没完全咬死；你只有两个行动回合能把它挣开。',
        dmg: 0, special: 'caravan_restraint',
        provoked: {
          name: '车队联合束缚',
          desc: '几名看守熟练地传递锁具，将下一件编号器具扣到你身上。“还有两个回合。挣不开，就算正式入库。”',
          dmg: 0, special: 'caravan_restraint',
        },
      },
    ],
    loot: { gold: 12, drops: [] },
  },
  {
    id: 'p_hall_enforcers',
    name: '商团执法者',
    maxHp: 9,
    intro: ['长桌被掀翻，登记册散了一地。', '贝拉米与两名执法者封住会馆出口。'],
    tagline: '这是你主动挑起的冲突；击倒他们可以逃出会馆，落败则会被当场登记。',
    dildo: 'normal',
    traits: ['armored'],
    elitePool: [],
    props: { storyEncounter: true },
    attacks: [
      { roll: 1, name: '锁臂压制', desc: '执法者从两侧扣住你的手臂，把你重重按向登记长桌。', dmg: 1 },
      { roll: 2, name: '短棍击腹', desc: '贝拉米用短棍扫过腹部，逼你弯腰失去反击姿势。', dmg: 2 },
      { roll: 3, name: '编号烙印', desc: '滚烫的编号印贴近皮肤，在挣扎间留下短暂而刺痛的红痕。', dmg: 1 },
      { roll: 4, name: '跪地示众', desc: '他们踢弯你的膝盖，把你按跪在 P 的长桌前，逼你抬头接受审视。', dmg: 1 },
      { roll: 5, name: '锁链绊倒', desc: '墨菲甩出的登记链缠住脚踝，将你拖倒在散落的文件之间。', dmg: 1 },
      { roll: 6, name: '合围猛击', desc: '三人同时收紧包围，用盾肩和短棍把你撞回大厅中央。', dmg: 2 },
    ],
    loot: { gold: 0, drops: [] },
  },
  {
    id: 'p_bandit_leader',
    name: '劫货强盗头目',
    maxHp: 9,
    intro: [
      '斜坡上的哨探先看见你。他没有喊人，一只手已经捂住你的嘴，把你按进货箱阴影。',
      '扒手闻声过来割开衣带翻找名单。营火旁的头目这才放下木盾：“车队漏网的，还是镇里派来灭口的？先问清楚。”',
    ],
    tagline: '哨探负责按住你的嘴，扒手负责翻你的身体和钱袋；头目要的是名单，也会把你当战利品用完。',
    dildo: 'normal',
    traits: [
      { id: 'bandit_crew', icon: '👥', name: '桥洞匪帮', desc: '哨探与扒手会各替头目挡下一次命中；击倒对应喽啰可关闭封口压制或偷窃剥衣。' },
      { id: 'charge', icon: '⚡', name: '断桥处刑', desc: '每 4 个敌方回合开始蓄力；单次造成至少 3 点伤害即可打断。' },
    ],
    abilities: {
      charge: { every: 4, multiplier: 1.75, interruptDamage: 3 },
    },
    elitePool: [],
    props: {
      storyEncounter: true,
      adultCombatTasks: true,
      banditCrew: [
        { id: 'bandit-lookout', name: '桥洞哨探', hp: 3 },
        { id: 'bandit-cutpurse', name: '翻箱扒手', hp: 3 },
      ],
      chargedAttack: {
        actor: '劫货强盗头目', name: '断桥处刑', part: 'anal', secondaryPart: 'oral', genderedPart: true, keepChargeName: true,
        desc: '头目把你的双腕捆上断裂桥墩横梁，身体悬在浅滩上方。“藏名单的货，就该在桥下结算。”固定好的假阴茎从身后插入菊穴；最后十秒，他又从正面强迫深喉。',
        dmg: 3, taskBpm: 150, taskSeconds: 40,
        taskSteps: [
          { at: 0, label: '悬空八秒', text: '双腕举过头顶，脚尖离地，先保持悬空姿势八秒。' },
          { at: 8, label: '处刑抽插', text: '按 150 BPM 承受后入，每八拍停在最深处一次。' },
          { at: 30, label: '插入保持 · 正面深喉', text: '插入用具固定在原位继续150 BPM；一只手控制口部用具，另一只手扶稳身体，最后十秒深喉。' },
        ],
      },
    },
    attacks: [
      {
        roll: 1, actor: '桥洞哨探', name: '封口示警', part: 'oral',
        desc: '哨探从斜坡阴影里扑上来，一只手捂住你的嘴，另一只手按住后脑。“别喊。头目还在烧名单。”他解开裤带，把阴茎塞进你嘴里，低声把你当成送上门的货。',
        dmg: 1, special: 'choke', taskBpm: 90, taskSeconds: 20, requiresCrew: 'bandit-lookout',
        taskSteps: [
          { at: 0, label: '按进阴影', text: '跪在货箱后，后脑被按住，张开嘴，不许出声。' },
          { at: 6, label: '八拍一停', text: '一只手固定假阴茎，按 90 BPM 前后动作；每八拍停在深处，屏住呼吸。另一只手保持空闲。' },
          { at: 15, label: '按到最深', text: '他按住后脑停在最深处，让你听清桥洞里的笑声。' },
        ],
        solo: {
          actor: '劫货强盗头目', name: '跪地封口', part: 'oral',
          desc: '哨探已经倒下，头目只能一边看守营火一边把你拉跪到身前，动作明显仓促。',
          dmg: 1, special: 'choke', taskBpm: 60, taskSeconds: 15,
          taskSteps: [
            { at: 0, label: '皮带勒颈', text: '跪下，下巴被皮带向上拽起，张开嘴。' },
            { at: 5, label: '单手吞吐 · 单手扇脸', text: '一只手固定假阴茎按 60 BPM 动作；另一只手在十五秒内左右交替扇脸八下。' },
          ],
        },
      },
      {
        roll: 2, actor: '翻箱扒手', name: '剥衣搜赃', part: 'anal',
        desc: '扒手笑着割开衣带，把你按在翻倒的货箱上。“名单呢？藏在穴里了？”手指探进菊穴搅动，另一只手扯走钱袋。',
        dmg: 0, special: 'steal', gold: 12, taskSeconds: 20, requiresCrew: 'bandit-cutpurse',
        taskSequence: [
          { name: '剥衣臀罚', desc: '衣带被割开后，扶稳货箱，用手掌责打臀部十下并报数。', count: 10, tool: '手掌' },
          { name: '腔内搜赃', desc: '随后双手扶稳货箱，接受十秒腔道检查。', seconds: 10 },
        ],
        taskSteps: [
          { at: 0, label: '剥开搜身', text: '被按在货箱上，衣物被扯乱，双腿分开。' },
          { at: 6, label: '腔内翻找', text: '手指在体内抠挖，腰不许躲开，直到他把钱袋割走。' },
        ],
        repeat: {
          name: '裸身搜赃',
          desc: '衣服早已被扒走，扒手便把你重新按上货箱，检查菊穴与散落的行囊，再割走钱袋里剩下的金币。',
          taskSteps: [
            { at: 0, label: '重新按上货箱', text: '全裸趴在货箱上，双腿被踢开。' },
            { at: 6, label: '继续搜赃', text: '接受腔道与行囊检查，直到扒手搜完。' },
          ],
        },
        solo: {
          actor: '劫货强盗头目', name: '盾下搜身', part: 'anal',
          desc: '头目用盾牌压住后背，粗暴扒开双腿检查身体与菊穴。“扒手不在，我自己问。名单呢？”',
          dmg: 1, taskSeconds: 20,
          taskSequence: [
            { name: '盾下搜穴', desc: '双手扶稳盾沿，接受十秒腔道检查。', seconds: 10 },
            { name: '盾面责打', desc: '检查结束后用手掌责打臀部十下并报数。', count: 10, tool: '手掌' },
          ],
          taskSteps: [
            { at: 0, label: '盾牌压背', text: '上身被压在货箱上，双腿被踢开。' },
            { at: 8, label: '检查腔道', text: '手指探入翻找，直到他确认你没有藏住纸页。' },
          ],
        },
      },
      {
        roll: 3, actor: '桥洞哨探与扒手', name: '双穴夹击', part: 'anal', secondaryPart: 'oral', genderedPart: true,
        desc: '扒手把固定好的假阴茎从身后插入菊穴，哨探同时从正面强迫深喉。“镇里的人？还是车队漏网的？”头目在营火边翻着半张名单。',
        dmg: 1, status: 'confusion', turns: 1, taskBpm: 120, taskSeconds: 25, requiresCrew: 'bandit-lookout',
        taskSteps: [
          { at: 0, label: '两处同时占用', text: '插入用具固定在身后，一只手控制口部用具，另一只手扶稳身体。' },
          { at: 6, label: '双穴夹击', text: '保持后入120 BPM，同时进行深喉；每八拍两边一起停住。' },
          { at: 18, label: '同时停深', text: '两处同时停在深处，屏住呼吸等待头目问话。' },
        ],
        solo: {
          actor: '劫货强盗头目', name: '桥壁压制', part: 'anal', genderedPart: true,
          desc: '头目把你压在潮湿桥壁上，从身后插入菊穴。“同伙倒了也没关系。货还在，问话照旧。”',
          dmg: 1, taskBpm: 80, taskSeconds: 18,
          taskSteps: [
            { at: 0, label: '压上桥壁', text: '脸贴着湿石壁，腰被他端住。' },
            { at: 6, label: '单人后入', text: '一只手固定假阴茎按80 BPM后入，另一只手扶稳桥壁；没有哨探，口部保持空闲。' },
          ],
        },
      },
      {
        roll: 4, actor: '劫货强盗头目', name: '盾面责打', part: 'body',
        desc: '头目把你压过木盾，命你扶稳盾沿。他用缴来的皮带重重责打臀部，逼你一下一下报数。',
        dmg: 2,
        taskSequence: [
          { name: '盾面臀罚', desc: '上身压在盾面，用皮带、拍子或手掌责打臀部十五下，每一下报数。', count: 15, tool: '皮带、拍子或手掌' },
          { name: '抬头受罚', desc: '放下工具，左右交替扇脸五下；完成后才能重新站稳。', count: 5, tool: '手掌' },
        ],
      },
      {
        roll: 5, actor: '桥洞哨探与头目', name: '双人深喉审讯', part: 'oral', special: 'choke', requiresCrew: 'bandit-lookout',
        desc: '哨探从背后按住你的后脑，头目从正面强迫深喉。最后五秒哨探封住退路，逼你停在深处憋气。',
        dmg: 1, status: 'stunned', turns: 1, taskBpm: 110, taskSeconds: 25,
        taskSteps: [
          { at: 0, label: '双人固定', text: '一只手控制口部用具，另一只手扶稳身体，按110 BPM深喉。' },
          { at: 20, label: '最后五秒憋气', text: '停在深处保持五秒，等待憋气判定。' },
        ],
        solo: {
          actor: '劫货强盗头目', name: '绳套深喉', part: 'oral', special: 'choke',
          desc: '哨探倒下后，头目亲自用绳套拽你跪下。一只手固定假阴茎，以 110 BPM 深喉二十五秒；最后五秒停在深处憋气，另一只手只负责扶稳身体。',
          dmg: 1, status: 'sleepy', turns: 1, taskBpm: 90, taskSeconds: 20,
          taskSteps: [
            { at: 0, label: '绳套勒腕', text: '跪下，一只手固定假阴茎，另一只手扶稳身体。' },
            { at: 15, label: '最后五秒憋气', text: '停在深处保持五秒，等待憋气判定。' },
          ],
        },
      },
      {
        roll: 6, actor: '桥洞匪帮', name: '战利品轮用', part: 'anal', special: 'bandit_rotate',
        desc: '头目把你按过货箱，当作刚抢来的战利品。“问完了。轮着用，用完再决定扔不扔回去。”',
        dmg: 2, taskBpm: 150, taskSeconds: 36, requiresCrew: true,
        rotate: {
          3: {
            actor: '桥洞匪帮', name: '三人轮用', part: 'anal',
            desc: '头目先从身后插入菊穴，抽插十二秒后把你推给哨探，再推给扒手。每人 150 BPM、15 秒，交接时都不让你并拢双腿。“镇里的货，也该知道桥下的规矩。”',
            dmg: 2, taskBpm: 150, taskSeconds: 45,
            taskSteps: [
              { at: 0, label: '头目先用', text: '上身压过货箱，按 150 BPM 承受后入。' },
              { at: 15, label: '交给哨探', text: '换人时双腿保持分开；一只手固定假阴茎，空手扇脸三下，再继续原节奏。' },
              { at: 30, label: '扒手收尾', text: '再次交接时用空手左右拧乳四下，然后继续最后十五秒后入。' },
            ],
          },
          2: {
            actor: '桥洞匪帮', name: '两人轮用', part: 'anal',
            desc: '头目把你按在货箱上抽插十五秒，再把腰交给还站着的那名同伙。“少一个人，时间均分。别让这件货空着。”',
            dmg: 2, taskBpm: 150, taskSeconds: 30,
            taskSteps: [
              { at: 0, label: '头目先用', text: '上身压过货箱，按 150 BPM 承受后入。' },
              { at: 15, label: '同伙接上', text: '换人时一只手继续固定假阴茎，空手扇脸三下，再维持原节奏直到结束。' },
            ],
          },
          1: {
            actor: '劫货强盗头目', name: '独占战利品', part: 'anal',
            desc: '同伙都倒下后，头目独自把你压过货箱，从身后插入菊穴。“只剩我。那这件货今晚只进我的账。”',
            dmg: 2, taskBpm: 150, taskSeconds: 30,
            taskSteps: [
              { at: 0, label: '独自占用', text: '上身压过货箱，双腿分开。' },
              { at: 8, label: '停住掌臀', text: '一只手固定假阴茎按150 BPM后入；每八拍停住，用空手责打臀部一下。' },
            ],
          },
        },
        solo: {
          actor: '劫货强盗头目', name: '独占战利品', part: 'anal',
          desc: '同伙都倒下后，头目独自把你压过货箱，从身后插入菊穴。“只剩我。那这件货今晚只进我的账。”',
          dmg: 2, taskBpm: 150, taskSeconds: 30,
          taskSteps: [
            { at: 0, label: '独自占用', text: '上身压过货箱，双腿分开。' },
            { at: 8, label: '停住掌臀', text: '一只手固定假阴茎按150 BPM后入；每八拍停住，用空手责打臀部一下。' },
          ],
        },
      },
    ],
    loot: { gold: 22, drops: [{ roll: 4, itemId: 'bandaid' }] },
  },
  {
    id: 'goblins',
    name: '哥布林',
    maxHp: 5,    // 实际单体生命会按难度读取 props.hpByDifficulty
    intro: ['一群哥布林从不同方向朝你冲来。', '它们轮流干你。'],
    tagline: '它们想要你的金币，但有洞插也行。',
    dildo: 'small',
    traits: ['pack'],
    elitePool: ['toxic', 'armored', 'berserk'],
    surrender: {
      tribute: 30,
      humiliation: { desc: '哥布林们围着你，让你学它们蹦跳着跳舞取乐，直到它们笑够才放你走。', dmg: 2, status: 'confusion', turns: 2 },
    },
    props: {
      packHunt: true,       // 群居，只剩 1 只时逃跑
      maxPack: 5,
      hpByDifficulty: { normal: 4, hard: 5, brutal: 5 },
      countRollsByDifficulty: {
        normal: [2, 2, 3, 3, 3, 4], // 普通：保留群战感，但避免徒手开局被数量碾压
        hard: [3, 3, 4, 4, 4, 5],
        brutal: [3, 4, 4, 5, 5, 5],
      },
      countRolls: [3, 3, 4, 4, 4, 5],   // 旧存档与未知难度的回退值
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
