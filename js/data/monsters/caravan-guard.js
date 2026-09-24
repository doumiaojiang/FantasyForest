/**
 * 车队看守完整目录
 * - 顶部：基础数值、普通/狂暴属性。
 * - attacks：Z1～Z6、挑衅变体与阶段任务。
 * - storyHooks：胜败结算和刷新恢复入口。
 * - CaravanGuardBehavior：束缚佩戴、确认与战败专属任务。
 */
window.MONSTER_DEFINITIONS.push(
{
    id: 'p_caravan_guard',
    name: '派克的车队看守',
    maxHp: 6,
    intro: ['桥下传来皮靴踩碎枯枝的声音。', '一个回来寻找许可的车队看守挡住了桥墩。'],
    tagline: '他只是个落单的看守；除非你非要把他的同伙也叫下来。',
    dildo: 'normal',
    traits: [],
    elitePool: ['berserk'],
    props: {
      storyEncounter: true,
      adultCombatTasks: true,
      autoBerserkTurn: 10,
      provokedMaxHp: 14,
      disableEliteCharge: true,
    },
    attacks: [
      {
        roll: 1, name: '强制搜身',
        desc: '看守将你的服装褪到一半处，并且命令你双手掰开自己小穴/菊穴。他要查的不是口袋。”',
        dmg: 0, special: 'caravan_search', searchTier: 1, part: 'inventory', inspectionPart: 'anal',
        searchTasks: {
          male: [{ part: 'anal', seconds: 25, bpm: 100, label: '菊穴搜查' }],
          female: [{ part: 'anal', seconds: 25, bpm: 100, label: '菊穴搜查' }],
        },
        provoked: {
          name: '双人搜身',
          desc: '两名看守将你的服装褪到一半处，并且命令你双手掰开自己小穴/菊穴。”',
          dmg: 0, special: 'caravan_search', searchTier: 2, part: 'inventory', inspectionPart: 'anal',
          searchTasks: {
            male: [{ part: 'anal', seconds: 30, bpm: 0, label: '菊穴搜查' }],
            female: [
              { part: 'vagina', seconds: 15, bpm: 0, label: '小穴搜查' },
              { part: 'anal', seconds: 15, bpm: 0, label: '菊穴搜查' },
            ],
          },
        },
        /** Z1 的任务与搜查结算直接放在技能内，修改时不必再找第二段代码。 */
        async resolve (showTaskDialog) {
          const state = State.get()
          const tier = Math.max(1, Number(this.searchTier) || 1)
          const genderKey = state.gender === 'male' ? 'male' : 'female'
          const configured = this.searchTasks && this.searchTasks[genderKey]
          const tasks = Array.isArray(configured) && configured.length
            ? configured
            : [{ part: 'anal', seconds: tier > 1 ? 30 : 25, bpm: 100, label: '菊穴搜查' }]
          const partNames = { oral: '嘴穴', anal: '菊穴', vagina: '小穴' }
          for (let index = 0; index < tasks.length; index++) {
            const task = tasks[index]
            const partName = partNames[task.part] || '身体'
            const seconds = Math.max(1, Number(task.seconds) || 1)
            const bpm = Number(task.bpm) || 100
            await showTaskDialog({
              enemyName: tasks.length > 1 ? `车队看守（${index + 1}/${tasks.length}）` : '车队看守',
              attackName: `${this.name} · ${task.label}`,
              desc: `先用双手掰开${partName}展示，再完成 ${seconds} 秒${task.label}。`,
              bpm,
              seconds,
              taskSteps: [
                { at: 0, label: '掰开展示', text: `双手掰开${partName}，保持俯身和双腿张开。` },
                { at: Math.min(3, Math.max(1, seconds - 1)), label: task.label, text: `按 ${bpm} BPM 迎合对${partName}的插入搜查。` },
              ],
              dmg: 0, noDamage: true, showFailure: false, allowSkip: true,
              completeLabel: '完成',
            })
          }

          const inventory = state.inventory.consumables || {}
          const ordinaryItems = Object.keys(inventory).filter(id => {
            if (inventory[id] <= 0) return false
            const item = DATA.item(id)
            return item && item.type === 'consumable' && !(item.effect && item.effect.special)
          })
          const choices = ordinaryItems.length ? ['item', 'gold', 'debt'] : ['gold', 'debt']
          let kind = choices[Math.floor(Math.random() * choices.length)]
          if (kind === 'gold' && state.gold <= 0) kind = 'debt'

          let icon = '🧾'
          let title = '车队欠条'
          let detail = ''
          if (kind === 'item') {
            const id = ordinaryItems[Math.floor(Math.random() * ordinaryItems.length)]
            const item = DATA.item(id)
            inventory[id]--
            if (inventory[id] <= 0) delete inventory[id]
            icon = '🎒'; title = `${item.name}被扣下`; detail = `看守把${item.name}塞进自己的腰包，宣称这是“车队遗失物”。`
          } else if (kind === 'gold') {
            const wanted = tier > 1 ? 15 + Math.floor(Math.random() * 11) : 5 + Math.floor(Math.random() * 11)
            const taken = Math.min(state.gold, wanted)
            state.gold -= taken
            icon = '🪙'; title = `${taken}G 被没收`; detail = '看守把钱袋在手里掂了掂，只留下一句“搜查费”。'
          } else {
            const debt = tier > 1 ? 40 : 20
            state._pCaravanDebt = Math.max(0, Number(state._pCaravanDebt) || 0) + debt
            title = `被记下 ${debt}G 车队债务`; detail = `看守在货单背面写下你的名字。车队现在声称你共欠 ${state._pCaravanDebt}G。`
          }
          EventBus.emit('ui:log', { text: `${icon} ${title}。`, type: 'danger' })
          EventBus.emit('state:changed', state)
          State.save()
          return new Promise(resolve => {
            Dialog.show({
              title: `🔎 ${this.name}`,
              className: 'battle-choice-modal',
              body: `<section class="scene-dialogue"><i>${icon}</i><div><h3>${title}</h3><p>${detail}</p></div></section>`,
              actions: [{ label: '继续战斗', cls: 'btn-primary', handler: () => { Dialog.close(); resolve() } }],
            })
          })
        },
      },
      {
        roll: 2, name: 'SP惩戒',
        desc: '看守把踩在地上，扯下腰带连续抽向臀部。“二十下。每挨一下就报一次数，少一下就从头重新算。”他把你狠狠踩在了受罚的姿势里，直到规定次数全部结束。',
        dmg: 1, part: 'body', taskCount: 20, taskTool: '皮带、拍子、鞭子或手掌',
        taskSteps: [
          { at: 0, label: '打屁股惩戒', text: '趴在地上，选择一种工具击打臀部；每一下都要出声报数，直到完成二十下。' },
        ],
        provoked: {
          name: '双人SP惩戒',
          desc: '看守把踩在地上，同伙用鞋子顶着你的脸，让你的脸抬起来。两条皮带从左右轮流落下。“四十下，一边二十。挑衅的时候不是很有胆子吗？把屁股抬高，报清楚。”',
          dmg: 2, part: 'body', taskCount: 40, taskTool: '两种工具交替，或左右手交替',
          taskSteps: [
            { at: 0, label: '打屁股惩戒', text: '趴在地上，头仰起来。左右交替击打臀部；每一下出声报数，直到完成四十下。' },
          ],
        },
      },
      {
        roll: 3, name: '闭嘴',
        desc: '看守抓住头发迫你仰起脸，解开裤裆堵住你未说完的话。“偷听贼不需要解释，会听命令就够了。”他抓住你的头发，你只能跟随他的节奏被迫为他口交。',
        dmg: 1, part: 'oral',
        taskSequence: [
          { name: '被迫仰头', desc: '保持跪姿，一手抓住你后发，抬起下巴等待命令。', seconds: 8 },
          { name: '强制口交', desc: '按 90 BPM 的速度操你的嘴穴15秒。', bpm: 90, seconds: 15 },
          { name: '放弃抵抗', desc: '继续按 90 BPM 的速度操你的嘴穴10秒，保持节奏。双手回到背后，不许歪头躲开。', bpm: 90, seconds: 10 },
        ],
        provoked: {
          name: '你应该学会闭上嘴巴',
          desc: '两名看守一人扣住一边肩膀，轮流抓着你的头发把脸拉向自己。“既然你这么喜欢叫人，那嘴就别停。”每十秒更换一次主人，不要给你完整喘息的间隙。',
          dmg: 2, part: 'oral',
          taskSequence: [
            { name: '第一人', desc: '跪好，双手背后，按 120 BPM 的速度操你的嘴穴10秒。', bpm: 120, seconds: 10 },
            { name: '第二人', desc: '换向另一侧，保持原节奏，按 120 BPM 的速度操你的嘴穴10秒。', bpm: 120, seconds: 10 },
            { name: '再次轮换', desc: '重新换边，手仍放在背后，不许减速。按 120 BPM 的速度操你的嘴穴10秒。', bpm: 120, seconds: 10 },
            { name: '最后十秒', desc: '继续换边，按 120 BPM 的速度操你的嘴穴10秒。', bpm: 120, seconds: 10 },
          ],
        },
      },
      {
        roll: 4, name: '操菊穴',
        desc: '你被看守强行按到地上，一脚踢开了你的双腿，从身后插入菊穴。他抓紧腰胯猛力抽插，迫使你的身体迎合每一次冲撞。',
        dmg: 2, part: 'anal',
        taskSequence: [
          { name: '按倒在地', desc: '爬在地板上，双腿分开，上身压低。', seconds: 5 },
          { name: '菊穴强奸', desc: '以 90 BPM 操自己的菊穴。', bpm: 90, seconds: 20 },
          { name: '插到最深处', desc: '加速至 90 BPM 并加大幅度的操自己的菊穴，姿势不得改变。', bpm: 90, seconds: 10 },
        ],
        provoked: {
          name: '前后夹击',
          desc: '一名看守把你强行按到地上，从身后插入菊穴猛烈抽插；另一人绕到面前，掐住下巴逼你仰头。两根大鸡巴同时贯穿你的双穴，你连躲开都没办法躲开。',
          dmg: 3, part: 'anal',
          taskSequence: [
            { name: '前后锁定', desc: '上身压低，双手向前撑稳，下巴抬起。', seconds: 5 },
            { name: '连续夹击', desc: '一根鸡巴插入嘴穴，同时以 90 BPM 操自己的菊穴，保持抬头。', bpm: 90, seconds: 20 },
            { name: '最后加速', desc: '继续保持一根鸡巴插入嘴穴，同时以 90 BPM 操自己的菊穴，并加大幅度的操自己的菊穴，姿势不得改变。保持抬头。', bpm: 90, seconds: 15 },
          ],
        },
      },
      {
        roll: 5, name: '露出示众',
        desc: '看守把你的衣服全部收走，拖到桥面最显眼的位置，并且让你保持姿势。“双手抱头，腿打开。蹲下去，把你的穴和奶子拱起来给所有人看清。”他们逼迫你按他的拍子反复拱穴展示。',
        dmg: 1, status: 'confusion', turns: 1,
        taskSequence: [
          { name: '衣物没收', desc: '脱下全部衣物，双手抱头，双脚打开，保持半蹲。', seconds: 5 },
          { name: '拱穴示众', desc: '下蹲后，按 45 BPM 反复前后拱穴，展示你的贱穴和奶子。', bpm: 45, seconds: 20 },
          { name: '记录档案', desc: '保持双手抱头、做出黑阿颜的表情，直到看守允许你动了。他在你身上写了一个“拱穴母猪”的字（如果已有重复的可以自己想一想别的写上）。', seconds: 5 },
        ],
        repeat: {
          name: '再次示众',
          desc: '看守发现你的衣服早已被收走，便捏住下巴把你重新推到桥中央。“没东西可脱了？那就自己提着乳头，把后面拱起来。眼睛翻上去，舌头伸出来。”围观的笑声比第一次更近。',
          taskSequence: [
            { name: '提乳拱穴', desc: '双脚打开半蹲，双手提住乳头，臀部向后拱起。', seconds: 10 },
            { name: '表情展示', desc: '他想让你尽显丑态，让你保持之前的姿势并且，阿黑颜与吐舌（禁止吞咽口水），按 45 BPM 反复前后拱穴，展示你的贱穴和奶子。', bpm: 45, seconds: 20 },
            { name: '标记', desc: '维持动作和表情，直到看守允许你动了。他在你身上写了一个“白痴荡妇”的字（如果已有重复的可以自己想一想别的写上）。', seconds: 5 },
          ],
        },
        provoked: {
          name: '公开羞辱',
          desc: '看守们从把你拉到桥头，一人收走你的全部衣物，另一人将鸡巴插入你的菊穴。“还敢挑衅我们，那就让所有人看你是一个什么样的人。”你被按成抱头半蹲的姿势，在一圈哄笑中按拍子反复拱穴。',
          dmg: 2, status: 'confusion', turns: 2,
          taskSequence: [
            { name: '公开没收', desc: '脱下全部衣物，双手抱头，双脚打开，保持半蹲。然后将肉棒插入你的菊穴，要加紧了哦，掉出算输。', seconds: 5 },
            { name: '夹紧拱穴示众', desc: '保持肉棒插在你的穴里，按 60 BPM 反复前后拱穴，展示你的贱穴和奶子。', bpm: 60, seconds: 40 },
            { name: '公开标记', desc: '保持双手抱头、做出黑阿颜的表情，直到看守允许你动了。他在你身上写了三个“肉便器”、“免费使用”、“欠操母猪”的字（如果已有重复的可以自己想一想别的写上）。最后将肉棒从穴里挤出（禁止用手辅助）。', seconds: 8 },
          ],
          repeat: {
            name: '公开复验',
            desc: '同伙发现你早已全裸，便把你重新拖到桥头最大的车队印记前。“衣服已经没了，就把货物的样子做足。”他们命你提住乳头、向后拱起臀部，在所有人的注视下保持翻眼吐舌的表情。',
            taskSequence: [
              { name: '公开复验', desc: '双脚打开半蹲，双手提住乳头，臀部向后拱起。', seconds: 5 },
              { name: '夹紧拱穴展示', desc: '他想让你尽显丑态，保持肉棒插在你的穴里，让你保持之前的姿势并且，阿黑颜与吐舌（禁止吞咽口水），按 60 BPM 反复前后拱穴，展示你的贱穴和奶子，同时要提拉或旋转你的乳头。', bpm: 60, seconds: 40 },
              { name: '羞辱标记', desc: '保持双手抱头、做出黑阿颜的表情，直到看守允许你动了。他在你身上写了三个“精液便所”、“人形飞机杯”、“妓女”的字（如果已有重复的可以自己想一想别的写上）。最后将肉棒从穴里挤出，同时疯狂搓揉自己的乳头（禁止用手辅助）。', seconds: 8 },
            ],
          },
        },
      },
      {
        roll: 6, name: '束缚捆绑',
        desc: '看守从货箱里抽出一件带编号的束缚器具，不由分说地扣到你身上。锁扣还没完全咬死；你只有两个行动回合能把它挣开。',
        dmg: 0, special: 'caravan_restraint', restraintCount: 1,
        provoked: {
          name: '束缚捆绑',
          desc: '几名看守熟练地传递锁具，将下两件编号器具扣到你身上。“还有两个回合。挣不开，就算正式入库。”',
          dmg: 0, special: 'caravan_restraint', restraintCount: 2,
        },
      },
    ],
    storyHooks: {
      onVictory: result => window.PrologueSystem && PrologueSystem.handleMonsterVictory('p_caravan_guard', result),
      onDefeat: result => window.PrologueSystem && PrologueSystem.handleMonsterDefeat('p_caravan_guard', result),
      resume: state => window.PrologueSystem && PrologueSystem.resumeMonsterStory('p_caravan_guard', state),
    },
    loot: { gold: 12, drops: [] },
  }
)

/**
 * 车队看守专属战斗行为。
 * Z6 的分段佩戴、狂暴连续两件与佩戴确认均在本文件维护。
 */
window.CaravanGuardBehavior = (function () {
  function isGroupBattle (battle) {
    return battle?.story === 'commission-provoked' ||
      !!battle?.caravanEnraged ||
      battle?.enemyState?.elite === 'berserk'
  }

  function restraintTasks (battle) {
    const extra = isGroupBattle(battle) ? 5 : 0
    const held = extra ? '旁边的人按着你，这段再加五秒。' : ''
    return {
      neck: {
        name: '奴隶项圈', bpm: 0, seconds: 10 + extra,
        desc: `下巴抬起，双手背到身后。让看守检查奴隶项圈。${held}`,
      },
      arms: {
        name: '手铐', bpm: 0, seconds: 10 + extra,
        desc: `保持被铐住的姿势。${held}`,
      },
      mouth: {
        name: '球形口塞', bpm: 0, seconds: 10 + extra,
        desc: `戴上球形口塞。${held}`,
      },
      anal: {
        name: '小肛塞', bpm: 0, seconds: 10 + extra,
        desc: `自行把小肛塞塞入菊穴。${held}`,
      },
    }
  }

  function battleActive () {
    return State.get().phase === 'battle' && !!State.get()._battle
  }

  async function showRestraintTask (binding, attack, index, total, showTaskDialog) {
    const task = restraintTasks(State.get()._battle)[binding.slot]
    if (!task) return
    const sequenceLabel = total > 1 ? ` · 第 ${index}/${total} 件` : ''
    await showTaskDialog({
      enemyName: '车队看守（1/2）',
      attackName: '控制姿势',
      desc: `看守取出${task.name}，命令你保持姿势，不许碰正在收紧的锁扣。`,
      bpm: 0,
      seconds: 5,
      dmg: 0,
      noDamage: true,
      allowSkip: true,
      showFailure: true,
      completeLabel: '✅ 完成',
      dialogTitle: `⛓️ ${attack.name}${sequenceLabel}`,
    })
    if (!battleActive()) return
    await showTaskDialog({
      enemyName: '车队看守（2/2）',
      attackName: task.name,
      desc: task.desc,
      bpm: task.bpm,
      seconds: task.seconds,
      dmg: 0,
      noDamage: true,
      allowSkip: true,
      showFailure: true,
      completeLabel: '✅ 完成',
      dialogTitle: `⛓️ ${attack.name}${sequenceLabel}`,
    })
  }

  function confirmBinding (result, index, total) {
    if (!result?.ok || !result.binding) return Promise.resolve()
    const binding = result.binding
    const battle = State.get()._battle
    const equipped = battle?.caravanBindings?.length || 0
    const locked = battle?.caravanBindings?.filter(entry => entry.locked).length || 0
    return new Promise(resolve => {
      Dialog.show({
        title: `${binding.icon || '⛓️'} ${binding.label}已佩戴${total > 1 ? ` · ${index}/${total}` : ''}`,
        className: 'battle-choice-modal',
        body: `<section class="scene-dialogue"><i>${binding.icon || '⛓️'}</i><div><h3>确认${binding.label}已经戴好</h3><p>锁扣已经开始收紧。再消耗 2 个行动回合，${binding.label}就会彻底上锁；下个玩家回合可以选择挣开一件车队束缚。</p></div></section>
          <div class="wrong-letter-evidence"><span>车队束缚</span><p>已佩戴 ${equipped}/4 · 已上锁 ${locked}/4 · 第 4 件上锁时自动战败并被押走。</p></div>`,
        actions: [{ label: `确认${binding.label}已佩戴`, cls: 'btn-danger', handler: () => { Dialog.close(); resolve() } }],
      })
    })
  }

  async function runRestraintAttack (attack, battle, showTaskDialog) {
    const configuredCount = Math.max(1, Math.floor(Number(attack?.restraintCount) || 1))
    const total = isGroupBattle(battle) ? Math.max(2, configuredCount) : configuredCount
    for (let i = 0; i < total; i++) {
      const binding = BattleSystem.peekCaravanBinding()
      if (!binding) break
      await showRestraintTask(binding, attack, i + 1, total, showTaskDialog)
      if (!battleActive()) return false
      const result = BattleSystem.applyCaravanBinding()
      if (!battleActive()) return false
      await confirmBinding(result, i + 1, total)
    }
    return battleActive()
  }

  async function runDefeatTask (enemyName, attackName, desc, options = {}) {
    if (typeof BattleUI === 'undefined' || !BattleUI.showTaskDialog) return false
    const segments = Array.isArray(options.segments) && options.segments.length
      ? options.segments
      : [{ name: attackName, desc, ...options }]
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index]
      await BattleUI.showTaskDialog({
        enemyName: `${enemyName}（${index + 1}/${segments.length}）`,
        attackName: segment.name || attackName,
        desc: segment.desc || desc,
        bpm: Number(segment.bpm) || 0,
        seconds: Number(segment.seconds) || 0,
        taskCount: Number(segment.count) || 0,
        taskTool: segment.tool || '',
        dmg: 0,
        noDamage: true,
        allowSkip: segment.allowSkip !== false && options.allowSkip !== false,
        completeLabel: '完成',
        dialogTitle: `🎯 ${attackName}`,
        dialogClass: 'commission-bandit-aftermath-task',
      })
    }
    return false
  }

  /** 车队看守战败专属惩罚；阶段进度由主线状态负责存档。 */
  async function runDefeatPunishment (provoked, done, options = {}) {
    const male = State.get().gender === 'male'
    const anal = '菊穴'
    const hole = male ? anal : '小穴'
    const steps = provoked
      ? [
          ['车队看守', '战败惩罚 · 口交', '你跪在桥板上，已经没有还手的力气。一个看守抓住你的头。“哈哈哈，又白捡一个免费的鸡巴清洁器，真爽啊！”', { segments: [
            { name: '按住跪好', desc: '跪在桥板上，双手放到背后，抬头张嘴。', seconds: 5 },
            { name: '口交', desc: '看守将肉棒插进嘴穴，按 90 BPM 连续口交。', bpm: 90, seconds: 20 },
            { name: '深喉收尾', desc: '含到喉咙深处，按 60 BPM 保持最后一段。', bpm: 60, seconds: 10 },
          ] }],
          ['车队看守', '战败惩罚 · 人肉飞机杯', `他们一人抱着你的头，一人抓住你的腰，两根肉棒同时对准嘴穴和${anal}。`, { segments: [
            { name: '前后固定', desc: '保持跪趴姿势，抬头张嘴，同时向后拱起臀部。', seconds: 5 },
            { name: '前后同时使用', desc: `一根插进嘴穴，另一根插进${anal}，按 160 BPM 同时迎合。`, bpm: 160, seconds: 25 },
            { name: '压到最深', desc: '前后同时停在最深处，再维持最后十秒。', seconds: 10 },
          ] }],
        ]
      : [
          ['车队看守', '战败惩罚 · 人肉飞机杯', `看守揪住头发迫使你仰起脸。“先用嘴，再把${male ? anal : `${hole}和${anal}`}轮流送上来。”`, { segments: [
            { name: '深喉', desc: '仰起脸，把肉棒含到喉咙深处，深喉保持。', bpm: 0, seconds: 15 },
            ...(male
              ? [{ name: '肛交', desc: `转身趴下，肉棒插进${anal}里，按 120 BPM 抽插。`, bpm: 120, seconds: 20 }]
              : [
                  { name: '性交', desc: `肉棒插进${hole}里，按 120 BPM 抽插。`, bpm: 120, seconds: 10 },
                  { name: '肛交', desc: `再换成${anal}，保持 120 BPM 抽插。`, bpm: 120, seconds: 10 },
                ]),
          ] }],
          ['车队看守', '战败惩罚 · 粗暴肛交', `他掰开你的${anal}，按着腰从身后整根插入，同时用手拍打臀部。`, { segments: [
            { name: '掰开检查', desc: `趴稳并用双手掰开${anal}，等待看守插入。`, seconds: 5 },
            { name: '粗暴肛交', desc: `肉棒整根插进${anal}，按 120 BPM 前后迎合。`, bpm: 120, seconds: 25 },
            { name: '拍红臀部', desc: '保持趴姿，用手掌逐下拍打臀部，完成规定次数。', count: 30, tool: '手掌' },
          ] }],
        ]
    const startStep = Math.max(0, Math.min(steps.length, Math.floor(Number(options.startStep) || 0)))
    for (let index = startStep; index < steps.length; index++) {
      await runDefeatTask(...steps[index])
      if (typeof options.onStep === 'function') options.onStep(index + 1)
    }
    if (done) done()
  }

  return { runRestraintAttack, runDefeatPunishment }
})()
