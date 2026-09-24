/** goblins — 独立怪物数据。修改技能、文案、数值与专属任务配置请编辑本文件。 */
window.MONSTER_DEFINITIONS.push(
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
  }
)
