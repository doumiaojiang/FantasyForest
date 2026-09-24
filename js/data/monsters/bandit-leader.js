/**
 * 强盗头目完整目录
 * - BanditLeaderContent：性别部位、战败多日任务池。
 * - 怪物定义顶部：头目、哨探、扒手、蓄力与召唤。
 * - attacks：Z1～Z6、喽啰存活时的变体。
 * - storyHooks：胜败、再挑战与刷新恢复入口。
 */
window.BanditLeaderContent = (function () {
  function orifice (kind) {
    const male = State.get().gender === 'male'
    if (kind === 'anal') return '菊穴'
    if (kind === 'vagina') return male ? '菊穴' : '小穴'
    if (kind === 'oral') return '嘴穴'
    return '身体'
  }

  function useEntry (pick) {
    return {
      actor: pick.actor,
      name: pick.name,
      desc: pick.desc,
      bpm: pick.bpm || 0,
      seconds: pick.seconds || 0,
      taskCount: pick.count || 0,
      taskTool: pick.tool || '',
    }
  }

  /** 强盗头目战败后，被扣留期间每天抽取一段使用任务和一段惩罚任务。 */
  function pickDefeatToyUses (days, livingCrewIds = []) {
    const anal = orifice('anal')
    const oral = orifice('oral')
    const frontalUse = {
      crewId: 'bandit-cutpurse',
      name: '广场母猪蹲寸止', actor: '🗡️ 翻箱扒手', count: 2, tool: '双手',
      desc: '扒手把你拖到强盗营地广场中央，命你双腿打开保持母猪蹲，用双手刺激自己的下体。全程保持阿黑颜、吐舌，在即将高潮时立刻停下；平复后重新开始，一共完成两次寸止。“广场上的人都看着。没有我的命令，不准高潮。”',
    }
    const penetration = [
      { name: '后入飞机杯', actor: '☠️ 劫货强盗头目', bpm: 120, seconds: 40, desc: `头目按在货箱上当飞机杯用，从身后整根操进你的${anal}，每一下都顶到最深。以 120BPM 操你的菊穴”` },
      { crewId: 'bandit-lookout', name: '操嘴泄火', actor: '🗡️ 桥洞哨探', bpm: 90, seconds: 35, desc: `哨探揪着头发把鸡巴塞进${oral}，快速着抽插你的嘴穴，唾液顺着下巴往下滴。用鸡巴操你的嘴穴35秒` },
      frontalUse,
      { name: '深喉停住', actor: '☠️ 劫货强盗头目', bpm: 90, seconds: 15, desc: `头目按住后脑做深喉。“飞机杯不需要喘气，只要会吞鸡巴就行。阴茎插入你的喉穴，并且让你保持15秒。”` },
    ]
    const punishment = [
      { crewId: 'bandit-lookout', name: '拱穴展示', actor: '🗡️ 桥洞哨探', bpm: 60, seconds: 30, desc: '哨探命你双手抱头、双腿打开，按拍子反复下蹲并向后拱起臀部，让营火边所有人看清被操开的穴口。' },
      { name: '打屁股', actor: '☠️ 劫货强盗头目', count: 20, tool: '手掌或皮带', desc: '头目把你按过膝弯，连续抽打臀部并逼你报数。' },
      { crewId: 'bandit-lookout', name: '扇巴掌', actor: '🗡️ 桥洞哨探', count: 12, tool: '手掌', desc: '哨探左右开弓扇脸，每一下都要你把嘴张开吐舌给大家展示你那贱嘴穴，方便大家下次使用你。' },
      { crewId: 'bandit-cutpurse', name: '拧乳泄愤', actor: '🗡️ 翻箱扒手', count: 16, tool: '双手', desc: '扒手左右交替拧乳头并逼你报数。乳尖被拧得又红又肿，他还故意往上面抹精液。' },
    ]
    const living = new Set(Array.isArray(livingCrewIds) ? livingCrewIds : [])
    const availablePenetration = penetration.filter(entry => !entry.crewId || living.has(entry.crewId))
    const availablePunishment = punishment.filter(entry => !entry.crewId || living.has(entry.crewId))
    const uses = []
    for (let day = 0; day < days; day++) {
      uses.push(useEntry(availablePenetration[Math.floor(Math.random() * availablePenetration.length)]))
      uses.push(useEntry(availablePunishment[Math.floor(Math.random() * availablePunishment.length)]))
    }
    return uses
  }

  return { orifice, pickDefeatToyUses }
})()

window.MONSTER_DEFINITIONS.push(
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
      banditSummonEvery: 3,
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
        desc: '扒手笑着割开衣带，把你按在翻倒的货箱上。“名单呢？藏在穴里了？”先打，再用手指按拍子往里翻，另一只手扯走钱袋。',
        dmg: 0, special: 'steal', gold: 12, requiresCrew: 'bandit-cutpurse',
        taskSequence: [
          { name: '剥衣臀罚', desc: '衣带被割开后，扶稳货箱，用手掌责打臀部十五下，每一下报数。', count: 15, tool: '手掌' },
          { name: '腔内搜赃', desc: '双手扶稳货箱，手指按 100 BPM 在穴里翻 25 秒。腰不许躲，翻完才割钱袋。', bpm: 100, seconds: 25 },
        ],
        repeat: {
          name: '裸身搜赃',
          desc: '衣服早已被扒走。扒手把你重新按上货箱，先按拍子检查穴，再补几下，然后割走剩下的金币。',
          taskSequence: [
            { name: '裸身检查', desc: '全裸趴在货箱上，双腿被踢开。手指按 100 BPM 在穴里翻 25 秒，腰不许躲。', bpm: 100, seconds: 25 },
            { name: '补打', desc: '检查结束后用手掌再打臀部八下，每一下报数。', count: 8, tool: '手掌' },
          ],
        },
        solo: {
          actor: '劫货强盗头目', name: '盾下搜身', part: 'anal',
          desc: '头目用盾牌压住后背，粗暴扒开双腿。“扒手不在，我自己问。名单呢？”',
          dmg: 1,
          taskSequence: [
            { name: '盾面责打', desc: '上身被盾牌压在货箱上，用手掌责打臀部十五下，每一下报数。', count: 15, tool: '手掌' },
            { name: '盾下搜穴', desc: '双手扶稳盾沿，手指按 100 BPM 在穴里翻 25 秒。腰不许躲。', bpm: 100, seconds: 25 },
          ],
        },
      },
      {
        roll: 3, actor: '桥洞哨探与扒手', name: '双穴夹击', part: 'anal', secondaryPart: 'oral', genderedPart: true,
        desc: '扒手把固定好的假阴茎从身后插入菊穴，哨探同时从正面强迫深喉。“镇里的人？还是车队漏网的？”头目在营火边翻着半张名单。',
        dmg: 1, status: 'confusion', turns: 1, taskBpm: 120, taskSeconds: 25,
        requiresAllCrew: ['bandit-lookout', 'bandit-cutpurse'],
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
    storyHooks: {
      onVictory: result => window.PrologueSystem && PrologueSystem.handleMonsterVictory('p_bandit_leader', result),
      onDefeat: result => window.PrologueSystem && PrologueSystem.handleMonsterDefeat('p_bandit_leader', result),
      resume: state => window.PrologueSystem && PrologueSystem.resumeMonsterStory('p_bandit_leader', state),
    },
    loot: { gold: 22, drops: [{ roll: 4, itemId: 'bandaid' }] },
  }
)
