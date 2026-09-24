/**
 * systems/camp-tavern-work.js — 酒馆接客、顾客任务、赌博与饮酒。
 */
window.TownTavernWorkSystem = (function () {
  const GLORY_FEE = CampSystem.gloryFee
  const campShow = options => CampSystem.showScene(options)
  const openCamp = opts => CampSystem.open(opts)
  const townPrice = (price, category) => CampSystem.townPrice(price, category)
  const routeTownService = part => CampSystem.routeTownService(part)
  const townServiceDesc = (part, actor) => CampSystem.townServiceDesc(part, actor)
  const wrongCommissionLead = kind => PrologueSystem.recordLead(kind)
  const serviceGearNames = entries => TownGlorySystem.serviceGearNames(entries)

  function tavernWork () {
    const state = State.get()
    const lockedService = TownGlorySystem.lockedServiceGear()
    const serviceBlocked = lockedService.length > 0
    const workStatus = state._prostituteLicensed
      ? `${prostituteTitle(state._prostituteLevel).icon} ${state._prostituteLevel} 级`
      : '需许可证'
    campShow({
      title: '💼 老板娘的工作板', className: 'tavern-work-modal',
      body: `<section class="scene-dialogue"><i aria-hidden="true">💃</i><div><h3>“想赚金币？我这里正缺人。”</h3><p>老板娘把一本薄薄的工作簿推到你面前。</p></div></section>
      <p class="scene-wallet">钱袋 · <b>${state.gold}G</b></p>
      <div class="work-grid">
        <button class="work-card ${serviceBlocked ? 'is-locked' : 'is-active'}" type="button" ${serviceBlocked ? 'disabled' : 'data-work="prostitute"'}><i>${serviceBlocked ? '🔒' : '💋'}</i><span><b>酒馆接客</b><small>${serviceBlocked ? '必须先解开口部或插入装备上的锁' : '按客人的要求完成计时任务'}</small></span><em>${serviceBlocked ? '禁止上工' : workStatus}</em></button>
      </div>
      ${serviceBlocked ? `<div class="work-rule">🔒 老板娘拒绝让你上工：${serviceGearNames(lockedService)}仍处于上锁状态。</div>` : ''}
      <details class="scene-notes"><summary>查看工作规矩</summary><p>工作进度会随存档保留。中途放弃会欠老板娘 30G，之后的收入优先用于还债。</p></details>`,
      actions: [
        ...(serviceBlocked ? [{ label: '⛓️ 整理妖缚装备', cls: 'btn-primary', handler: () => { Dialog.close(); RestraintSystem.openManage() } }] : []),
        { kind: 'navigation', label: '返回老板娘', handler: () => { Dialog.close(); TownTavernPatronsSystem.openBarkeep() } },
      ],
    })
    const prostituteBtn = document.querySelector('[data-work="prostitute"]')
    if (prostituteBtn) prostituteBtn.onclick = () => { Dialog.close(); prostitute() }
  }

  /** 妓女：许可证 → 换衣 → 找顾客 */
  /** 妓女等级称号 */
  function prostituteTitle (level) {
    if (level >= 100) return { name: '头牌妓畜', icon: '👑', note: '必须全程佩戴贞操装备，服务时必须发出呻吟' }
    if (level >= 70) return { name: '职业妓女', icon: '💼', note: '服务时必须发出呻吟' }
    if (level >= 30) return { name: '顺从的妓女', icon: '🫦', note: '服务时必须发出呻吟' }
    if (level >= 10) return { name: '新手妓女', icon: '🐣', note: '' }
    return { name: '雏妓', icon: '🍼', note: '' }
  }

  function prostituteProgress (level) {
    const stages = [
      { level: 1, name: '雏妓' }, { level: 10, name: '新手妓女' },
      { level: 30, name: '顺从的妓女' }, { level: 70, name: '职业妓女' },
      { level: 100, name: '头牌妓畜' },
    ]
    const next = stages.find(stage => stage.level > level)
    if (!next) return { percent: 100, text: '已达到最高称号' }
    const current = [...stages].reverse().find(stage => stage.level <= level) || stages[0]
    const percent = Math.max(0, Math.min(100, ((level - current.level) / (next.level - current.level)) * 100))
    return { percent, text: `距「${next.name}」还差 ${next.level - level} 级` }
  }

  function prostitute () {
    const state = State.get()
    if (TownGlorySystem.showServiceGearLockout('酒馆', tavernWork)) return
    if (!state._prostituteLicensed) {
      campShow({
        title: '💋 接客许可证', className: 'tavern-work-modal',
        body: `<section class="scene-dialogue"><i>📜</i><div><h3>老板娘翻开柜台下的登记册。</h3><p>“名字写在这里。二百金币，往后不用再办第二次。”</p></div></section>
          <p class="scene-wallet">钱袋 · <b>${state.gold}G</b>　办证 · <b>200G</b></p>`,
        actions: [
          { label: state.gold >= 200 ? `💸 花 200G 买许可证` : '💰 钱不够（200G）', cls: state.gold >= 200 ? 'btn-primary' : 'btn-danger', handler: () => {
            if (state.gold < 200) { EventBus.emit('ui:log', { text: '💰 钱不够买许可证。', type: 'dim' }); prostitute(); return }
            state.gold -= 200
            state._prostituteLicensed = true
            EventBus.emit('ui:log', { text: '💋 你买下了妓女许可证，老板娘朝你眨眨眼。', type: 'good' })
            EventBus.emit('state:changed', state)
            Dialog.close(); prostitute()
          } },
          { kind: 'navigation', label: '返回打工', handler: () => { Dialog.close(); tavernWork() } },
        ],
      })
      return
    }
    if (!state._prostituteDressed) {
      // 全裸状态：不用脱衣服，老板娘直接让你上工
      if (StatusSystem.has('naked')) {
        campShow({
          title: '👗 酒馆更衣室', className: 'tavern-work-modal',
          body: `<section class="work-wardrobe"><span>👙</span><div><small>上工准备</small><h3>你都全裸了，还换什么衣服？</h3><p>老板娘打量着你："反正你也没衣服，直接去接客吧。"</p></div></section>`,
          actions: [
            { label: '🍑 直接去接客', cls: 'btn-primary', handler: () => {
              state._prostituteDressed = true
              EventBus.emit('ui:log', { text: '👙 你全裸着走向酒馆，老板娘点点头。', type: 'good' })
              EventBus.emit('state:changed', state)
              Dialog.close(); prostitute()
            } },
            { kind: 'navigation', label: '返回打工', handler: () => { Dialog.close(); tavernWork() } },
          ],
        })
        return
      }
      campShow({
        title: '👗 酒馆更衣室', className: 'tavern-work-modal',
        body: `<section class="work-wardrobe"><span>🪞</span><div><small>上工准备</small><h3>换上老板娘准备的工作服</h3><p>完成更衣后即可在酒馆寻找顾客；没有欠款时可以随时换回冒险装备。</p></div></section>`,
        actions: [
          { label: '👗 脱衣换上妓女服', cls: 'btn-primary', handler: () => {
            state._prostituteDressed = true
            EventBus.emit('ui:log', { text: '💃 你换上妓女服，露出大片肌肤。', type: 'good' })
            EventBus.emit('state:changed', state)
            Dialog.close(); prostitute()
          } },
          { kind: 'navigation', label: '返回打工', handler: () => { Dialog.close(); tavernWork() } },
        ],
      })
      return
    }
    // 已换衣：寻找顾客
    const title = prostituteTitle(state._prostituteLevel)
    const progress = prostituteProgress(state._prostituteLevel)
    const debt = state._prostituteDebt || 0
    const inDebt = debt > 0
    const debtHtml = inDebt
      ? `<div class="work-debt">💸 欠款 <b>${debt}G</b><small>收入会优先还债；还清前不能离开或换衣</small></div>`
      : ''
    // 已装备且会影响接客的服务类妖缚装备
    const BUFF_GEAR = [
      { id: 'lipstick', name: '口红', icon: '💄', desc: '口交服务额外 +20G' },
      { id: 'makeup', name: '全套妆容', icon: '💎', desc: '口交服务额外 +30G' },
      { id: 'heels', name: '8cm 高跟鞋', icon: '👠', desc: '服务类鞋履' },
      { id: 'heels_10', name: '10cm 高跟鞋', icon: '👠', desc: '服务类鞋履' },
      { id: 'heels_12', name: '12cm 高跟鞋', icon: '👠', desc: '服务类鞋履' },
      { id: 'heels_14', name: '14cm 高跟鞋', icon: '👠', desc: '服务类鞋履' },
      { id: 'lingerie', name: '情趣内衣', icon: '🩲', desc: '每项接客任务获得的等级翻倍' },
      { id: 'latex', name: '乳胶衣', icon: '🖤', desc: '每项接客任务获得的金币和等级都翻倍' },
      { id: 'slut_collar', name: '项圈', icon: '🐕', desc: '插入任务强制 120 BPM，等级翻倍' },
      { id: 'slut_gag', name: '开口口塞', icon: '🤐', desc: '唯一触发口塞加成：160/180 BPM，金币翻倍' },
    ]
    const ownedList = (typeof RestraintSystem !== 'undefined')
      ? BUFF_GEAR.filter(g => RestraintSystem.hasDevice(g.id))
      : []
    if (typeof RestraintSystem !== 'undefined') {
      ;['anal', 'vagina'].forEach(slot => {
        const entry = RestraintSystem.insertionDevice(slot)
        if (!entry) return
        const baseBonus = Math.max(0, entry.def.prostituteBonus || 0) * (entry.def.stackable ? Math.max(1, entry.device.count || 1) : 1)
        const vibration = entry.def.vibrate && RestraintSystem.vibrationInfo ? RestraintSystem.vibrationInfo(slot) : null
        const vibrationText = vibration && vibration.mode !== 'off' ? ` · ${RestraintSystem.VIBRATION_MODES[vibration.mode].label}额外 +${vibration.serviceExtra}G` : ''
        ownedList.push({
          id: entry.def.id,
          name: entry.def.name,
          icon: slot === 'vagina' ? '🌸' : '🍑',
          desc: `${RestraintSystem.SLOT_NAMES[slot]} · 插入任务额外 +${baseBonus}G${vibrationText}`,
        })
      })
    }
    const gearHtml = ownedList.length
      ? `<details class="scene-notes work-gear"><summary>查看当前装备加成</summary><div class="work-gear-list">${ownedList.map(g => `<span title="${g.desc}">${g.icon} ${g.name}</span>`).join('')}</div></details>`
      : ''
    campShow({
      title: '💋 今夜营业', className: 'tavern-work-modal',
      body: `${debtHtml}<section class="work-profile"><div class="work-rank"><i>${title.icon}</i><span><small>当前称号</small><b>${title.name}</b></span><em>Lv.${state._prostituteLevel}</em></div>
        <div class="work-progress" aria-label="称号进度"><span style="width:${progress.percent}%"></span></div><p>${progress.text}</p>
        ${title.note ? `<div class="work-rule">📌 ${title.note}</div>` : ''}</section>
        ${gearHtml}
        <details class="scene-notes"><summary>查看接客规则</summary><p>找到顾客后会随机决定要求。完成任务获得金币和等级，中途放弃视为失败。</p></details>`,
      actions: [
        { label: inDebt ? '🔍 继续接客还债' : '🔍 寻找顾客', cls: 'btn-primary', handler: () => { Dialog.close(); findCustomer() } },
        { label: '⛓️ 整理妖缚装备', handler: () => { Dialog.close(); RestraintSystem.openManage() } },
        // 全裸时无法换回衣服（本来就没衣服）；欠款时无法退出
        ...((!inDebt && !StatusSystem.has('naked')) ? [{ label: '👗 换回衣服', handler: () => { Dialog.close(); state._prostituteDressed = false; EventBus.emit('state:changed', state); tavernWork() } }] : []),
      ],
    })
  }

  /** 顾客任务表：每种顾客 6 个 Z 结果 */
  const CUSTOMER_TASKS = {
    goblin: {
      name: '哥布林',
      intro: '你在酒馆里遇到一群坐在吧台喝酒言欢的哥布林。其中一个决定当着所有客人的面，在桌上操你。小心——这可能会让他的朋友们也加入……',
      tasks: {
        1: {
          desc: '为哥布林口交 30 秒（深喉 2 次），然后站立后入式被操 30 秒。',
          gold: 20, level: 1,
          steps: [
            { desc: '你跪在桌上，把哥布林硬邦邦的小鸡巴含进嘴里吞吐 30 秒，深喉 2 次', bpm: 0, seconds: 30 },
            { desc: '转过身趴下，被哥布林从背后站立后入式操着菊穴 30 秒', bpm: 0, seconds: 30 },
          ],
        },
        2: {
          desc: '口交深喉 + 站立后入被操。',
          gold: 20, level: 1,
          steps: [
            { desc: '把哥布林的小鸡巴含进嘴里吞吐 30 秒，故意让它顶到嗓子眼深喉 2 次', bpm: 0, seconds: 30 },
            { desc: '转过身趴下，被它从背后操着菊穴 30 秒', bpm: 0, seconds: 30 },
          ],
        },
        3: {
          desc: '深喉 2 次 + 站立后入，一呻吟第二哥布林塞嘴。',
          gold: 40, level: 1,
          steps: [
            { desc: '你用嘴含住哥布林的鸡巴深喉 2 次', bpm: 0, seconds: 30 },
            { desc: '被哥布林站立后入猛操——你忍不住呻吟，第二个哥布林立刻把粗鸡巴塞进你嘴里', bpm: 0, seconds: 30 },
          ],
        },
        4: {
          desc: '被两只哥布林前后夹击，上下两张嘴同时被操。',
          gold: 40, level: 1,
          steps: [
            { desc: '你被按在桌上，前面的哥布林操着你的嘴', bpm: 0, seconds: 30 },
            { desc: '后面的哥布林从背后顶着你的菊穴猛操，你一叫出声，嘴里那根就捅得更深', bpm: 0, seconds: 30 },
          ],
        },
        5: {
          desc: '哥布林邀请另一个哥布林一起使用你：口交 + 前后夹击。',
          gold: 70, level: 2,
          steps: [
            { desc: '你跪下来，为第一个哥布林口交 30 秒，再为第二个哥布林口交 30 秒', bpm: 0, seconds: 60 },
            { desc: '站起身，被两个哥布林同时操菊穴和嘴穴 30 秒', bpm: 0, seconds: 30 },
            { desc: '他们交换位置，继续前后夹击你 30 秒', bpm: 0, seconds: 30 },
          ],
        },
        6: {
          desc: '哥布林邀请了两个朋友一起享用你。先跪下轮流口交 2 分钟，然后被前后夹击 3 分钟，最后脸上射精，他们抢走你的金币逃跑！',
          gold: -50, level: 3,
          steps: [
            { desc: '你跪下来，轮流为三个哥布林口交，每根都卖力吞吐深喉', bpm: 0, seconds: 120 },
            { desc: '被前后夹击：一根插进菊穴，一根塞进嘴里，疯狂抽送', bpm: 0, seconds: 60 },
            { desc: '第 2 分钟：换一个哥布林操你的菊穴，另一根继续捅你的嘴', bpm: 0, seconds: 60 },
            { desc: '第 3 分钟：再次交换，让新的鸡巴操进你的菊穴和嘴里', bpm: 0, seconds: 60 },
            { desc: '最后三个哥布林轮番把浓精射在你脸上……然后抢走你的金币逃跑！', bpm: 0, seconds: 0 },
          ],
        },
      },
    },
    werewolf: {
      name: '狼人',
      intro: '一只凶猛的狼人冲进酒馆，一把抓住你，把你带进卧室。他告诉你："我只会为了插入小穴/菊穴而付费。"所以如果他让你口交，你需要免费服务。',
      tasks: {
        1: { desc: '为狼人口交 1 分钟，让他射在你嘴里。他不会为此付钱。', bpm: 0, seconds: 60, gold: 0, level: 1 },
        2: { desc: '仰躺着让狼人粗暴地操你的嘴穴 1 分钟，直到他射在你脸上。始终保持眼神接触。', bpm: 0, seconds: 60, gold: 0, level: 2 },
        3: {
          desc: '为狼人口交 1 分钟，然后侧卧位被操 1 分钟，像个荡妇一样呻吟。',
          gold: 30, level: 2,
          steps: [
            { desc: '你跪下来，为狼人卖力口交 1 分钟', bpm: 0, seconds: 60 },
            { desc: '侧身躺下，让狼人从侧面狠狠操进你的菊穴，你像个荡妇一样呻吟', bpm: 0, seconds: 60 },
          ],
        },
        4: {
          desc: '舔弄狼鸡巴 + 侧卧位被操两轮，全程像个发情的母狗。',
          gold: 30, level: 2,
          steps: [
            { desc: '你跪在狼人腿间，卖力地舔弄他那根粗大的狼鸡巴整整 1 分钟', bpm: 0, seconds: 60 },
            { desc: '侧身躺下，让狼人从侧面狠狠操进你的菊穴 1 分钟，夹紧双腿淫叫', bpm: 0, seconds: 60 },
            { desc: '换个方向再来一轮，被操得双腿发软，呻吟不断', bpm: 0, seconds: 60 },
          ],
        },
        5: {
          desc: '为狼人口交 2 分钟，然后侧卧位、骑乘位各被操 1 分钟。',
          gold: 45, level: 2,
          steps: [
            { desc: '你跪下来，为狼人卖力口交 2 分钟，把那根粗大的狼鸡巴舔得湿漉漉', bpm: 0, seconds: 120 },
            { desc: '侧身躺下，让狼人从侧面狠狠操进你的菊穴 1 分钟', bpm: 0, seconds: 60 },
            { desc: '翻身骑到狼人身上，骑乘位上下吞吐 1 分钟', bpm: 0, seconds: 60 },
          ],
        },
        6: {
          desc: '为狼人口交 2 分钟，侧卧位、骑乘位、后入式各被操 1 分钟，最后射在你嘴里。全程像个发情的荡妇。',
          gold: 60, level: 3,
          steps: [
            { desc: '你跪下来，为狼人卖力口交 2 分钟，把那根粗大的狼鸡巴舔得湿漉漉', bpm: 0, seconds: 120 },
            { desc: '侧身躺下，让狼人从侧面狠狠操进你的菊穴', bpm: 0, seconds: 60 },
            { desc: '翻身骑到狼人身上，用骑乘位上下吞吐，浪叫个不停', bpm: 0, seconds: 60 },
            { desc: '趴跪着被狼人后入式猛操（120 BPM），你夹紧屁股迎合', bpm: 120, seconds: 60 },
            { desc: '最后跪回去，让狼人把滚烫的精液射进你嘴里', bpm: 0, seconds: 0 },
          ],
        },
      },
    },
    orc: {
      name: '兽人',
      intro: '一个肌肉发达的兽人命令你加入他和朋友的性交比赛，他想向朋友展示自己有多雄壮。',
      tasks: {
        1: { desc: '跪下伸出舌头，让兽人用大鸡巴拍打你的脸和舌头 1 分钟，然后为他口交 1 分钟。用顺从的眼神仰望他。', bpm: 0, seconds: 120, gold: 30, level: 2 },
        2: { desc: '跪下让兽人操你的嘴 2 分钟。不给他至少 10 次深喉，他不付钱。', bpm: 0, seconds: 120, gold: 30, level: 3 },
        3: {
          desc: '跪下被操嘴 1 分钟，然后站立后入式被操 2 分钟，朋友拍打你的阴蒂。',
          gold: 50, level: 4,
          steps: [
            { desc: '你跪在地上张大嘴，让兽人的大鸡巴操进嘴里 1 分钟', bpm: 0, seconds: 60 },
            { desc: '起身趴墙，被兽人站立后入式猛操（逐渐加速到 120 BPM），他的朋友用大肉棒拍打你的阴蒂/蛋蛋', bpm: 120, seconds: 120 },
          ],
        },
        4: {
          desc: '先被第一个兽人操嘴 1 分钟，然后被两个兽人前后夹击 2 分钟。',
          gold: 50, level: 4,
          steps: [
            { desc: '你跪在地上张大嘴，让第一个兽人的大鸡巴操进嘴里 1 分钟', bpm: 0, seconds: 60 },
            { desc: '起身趴墙，被两个兽人一前一后包夹：后面的操进菊穴，前面的捅进嘴里', bpm: 0, seconds: 60 },
            { desc: '两根大肉棒交错进出，你被夹在中间翻着白眼淫叫', bpm: 0, seconds: 60 },
          ],
        },
        5: {
          desc: '兽人邀请朋友比谁能把你操得爽上天。跪下口交 + 地板上被前后夹击，高潮迭起。',
          gold: 100, level: 5,
          steps: [
            { desc: '你跪在两个兽人面前，轮流为他们的口交，每根都深喉 10 次以上', bpm: 0, seconds: 120 },
            { desc: '被按在地板上前后夹击：一根操进菊穴，一根捅进嘴里', bpm: 0, seconds: 60 },
            { desc: '第 2 分钟：两个兽人交换位置，换根更猛的操你，每 10 秒被深喉一次', bpm: 0, seconds: 60 },
          ],
        },
        6: {
          desc: '被两个兽人按在地板上前后夹击，两根大肉棒轮流抽送。',
          gold: 100, level: 5,
          steps: [
            { desc: '你被两个兽人按在地板上，一根塞进你的嘴深喉，一根顶进你的菊穴猛操', bpm: 0, seconds: 60 },
            { desc: '120 BPM 疯狂进出，你被夹在中间翻着白眼淫叫，两根大肉棒在嘴里和屁股里轮流抽送', bpm: 120, seconds: 60 },
          ],
        },
      },
    },
    minotaur: {
      name: '牛头人',
      intro: '当传奇牛头人听说酒馆里有一个顺从的妓女在提供服务，他立刻就赶来了。他一进酒馆，就把你抱起来带到卧室。小心，他性欲极强……',
      tasks: {
        1: {
          desc: '手交亲蛋、口交、操嘴各 1 分钟，直到射在你脸上。',
          gold: 50, level: 4,
          steps: [
            { desc: '你跪下来，小手握住牛头人的马屌套弄，低头舔弄他的蛋蛋 1 分钟', bpm: 0, seconds: 60 },
            { desc: '温柔地含住龟头为他口交 1 分钟', bpm: 0, seconds: 60 },
            { desc: '他掐着你的下巴操你的嘴 1 分钟，滚烫的浓精喷了你一脸', bpm: 0, seconds: 60 },
          ],
        },
        2: {
          desc: '手交亲蛋、口交、操嘴各 1 分钟，直到射在你脸上。',
          gold: 50, level: 4,
          steps: [
            { desc: '握住牛头人又粗又长的马屌慢慢套弄，同时用舌头舔弄他的蛋蛋', bpm: 0, seconds: 60 },
            { desc: '温柔地含住龟头为他口交 1 分钟，卖力吞吐', bpm: 0, seconds: 60 },
            { desc: '他掐着你的下巴用大肉棒操你的嘴 1 分钟，滚烫的浓精喷了你一脸', bpm: 0, seconds: 60 },
          ],
        },
        3: {
          desc: '服侍牛头人 3 分钟（手交亲蛋、口交、操嘴各 1 分钟），然后传教士体位把你灌满。',
          gold: 70, level: 5,
          steps: [
            { desc: '你跪下来，小手握住牛头人的马屌套弄，低头用舌头舔弄他的蛋蛋', bpm: 0, seconds: 60 },
            { desc: '温柔地含住龟头为他口交 1 分钟，卖力吞吐', bpm: 0, seconds: 60 },
            { desc: '他掐着你的下巴，用大肉棒操你的嘴 1 分钟', bpm: 0, seconds: 60 },
            { desc: '他还硬着不肯射。他把你压倒在床上，传教士体位深深顶进你的小穴（90 BPM），把你灌满', bpm: 90, seconds: 60 },
          ],
        },
        4: {
          desc: '先服侍牛头人 3 分钟，然后被后入式猛操，每 15 秒挨一巴掌屁股。',
          gold: 80, level: 5,
          steps: [
            { desc: '你跪下来为牛头人手交并亲吻他的蛋蛋 1 分钟', bpm: 0, seconds: 60 },
            { desc: '温柔地为他口交 1 分钟，含住马屌吞吐', bpm: 0, seconds: 60 },
            { desc: '他让你张嘴，用大肉棒操你的嘴 1 分钟', bpm: 0, seconds: 60 },
            { desc: '他让你趴跪在地，从背后操进你的菊穴猛干（120 BPM），每 15 秒"啪"地打一下你白花花的屁股', bpm: 120, seconds: 60 },
          ],
        },
        5: {
          desc: '完整服侍牛头人：先手交亲蛋、口交、操嘴，再传教士灌满、后入挨打，最后跪地接精清理。',
          gold: 100, level: 10,
          steps: [
            { desc: '你跪下来，小手握住牛头人的马屌套弄，低头用舌头舔弄他的蛋蛋 1 分钟', bpm: 0, seconds: 60 },
            { desc: '温柔地含住龟头为他口交 1 分钟，卖力吞吐', bpm: 0, seconds: 60 },
            { desc: '他掐着你的下巴，用大肉棒操你的嘴 1 分钟', bpm: 0, seconds: 60 },
            { desc: '他还硬着不肯射。你被压倒在床上，传教士体位深深顶进小穴（90 BPM），把你灌满', bpm: 90, seconds: 60 },
            { desc: '趴跪着被牛头人后入式猛操（120 BPM），每 15 秒被打一下屁股，疼得你浪叫', bpm: 120, seconds: 60 },
            { desc: '他还不肯射。你跪下来，仰着脸让牛头人把浓精全射在你脸上', bpm: 0, seconds: 0 },
            { desc: '最后含住他软下来的马屌，卖力舔弄 1 分钟为他清理', bpm: 0, seconds: 60 },
          ],
        },
        6: {
          desc: '5 分钟全程奉陪发情的牛头人：手交亲蛋、口交、操嘴、传教士、后入挨打，最后跪地接精清理。',
          gold: 100, level: 10,
          steps: [
            { desc: '握住牛头人又粗又长的马屌套弄，同时用舌头舔弄他的蛋蛋 1 分钟', bpm: 0, seconds: 60 },
            { desc: '温柔地含住龟头为他口交 1 分钟，卖力吞吐', bpm: 0, seconds: 60 },
            { desc: '他掐着你的下巴，用大肉棒操你的嘴 1 分钟', bpm: 0, seconds: 60 },
            { desc: '被牛头人压在身下，传教士体位被操灌满小穴', bpm: 0, seconds: 60 },
            { desc: '转身撅起屁股，被后入式猛操，每 15 秒挨一巴掌', bpm: 0, seconds: 60 },
            { desc: '跪在牛头人胯下，仰着脸接住滚烫的精液', bpm: 0, seconds: 0 },
            { desc: '含住他的马屌卖力口交，把每一滴都吞下去', bpm: 0, seconds: 60 },
          ],
        },
      },
    },
    koopa: {
      name: '库帕',
      intro: '一个长满尖刺的怪物冲进酒馆，自称是所谓"库帕王国"的国王，他要求酒馆老板给他派一个婊子来帮他泄欲。酒馆老板把你带到他卧室，你将完全顺从于他。即使他尺寸太大，而且只为插穴付费，你也别无选择！',
      tasks: {
        1: {
          desc: '跪下为库帕口交 2 分钟，每 20 秒深喉一次并保持眼神接触，最后深喉 15 秒让他射在你喉咙里。他不会付钱。',
          gold: 0, level: 5,
          steps: [
            { desc: '你跪下来，含住库帕那根巨大的尖刺鸡巴卖力口交，每 20 秒深喉一次，眼睛一直盯着他', bpm: 0, seconds: 120 },
            { desc: '最后你深深吞到底，保持深喉 15 秒，让库帕把滚烫的精液射进你喉咙里', bpm: 0, seconds: 15 },
          ],
        },
        2: {
          desc: '与 Z=1 相同，跪着为库帕口交到射喉。',
          gold: 0, level: 5,
          steps: [
            { desc: '跪在库帕面前，含住他巨大的鸡巴吞吐口交，每 20 秒就深深吞到底深喉一次', bpm: 0, seconds: 120 },
            { desc: '最后深喉 15 秒，让库帕射在你喉咙里', bpm: 0, seconds: 15 },
          ],
        },
        3: {
          desc: '让库帕用大鸡巴拍打你的脸和嘴唇 1 分钟，然后让他操你的嘴 2 分钟直到射脸，每 30 秒挨一耳光。',
          gold: 0, level: 5,
          steps: [
            { desc: '跪下仰着脸，让库帕用粗大的鸡巴拍打你的脸颊和嘴唇，你顺从地迎接', bpm: 0, seconds: 60 },
            { desc: '他掐着你的头操你的嘴，每 30 秒"啪"地扇你一耳光，你保持眼神接触像妓女一样呻吟', bpm: 0, seconds: 120 },
            { desc: '最后库帕把浓精射在你脸上，你被扇得脸颊通红', bpm: 0, seconds: 0 },
          ],
        },
        4: {
          desc: '趴在床上肚子朝下，让库帕深深操你 3 分钟（逐渐加速到 120 BPM），射之前不许拔出来，直到他射精。',
          gold: 100, level: 7,
          steps: [
            { desc: '你趴在床上肚子朝下，库帕把巨大的鸡巴深深捅进你的菊穴', bpm: 0, seconds: 60 },
            { desc: '他逐渐加速到 120 BPM 猛操，你咬紧床单承受，射之前不许拔出来', bpm: 120, seconds: 60 },
            { desc: '他越操越狠，你被顶得说不出话，只能淫叫', bpm: 120, seconds: 60 },
            { desc: '库帕在你体内射精，把你灌满', bpm: 0, seconds: 0 },
          ],
        },
        5: {
          desc: '与 Z=4 相同，趴着被库帕深深操到射精。',
          gold: 100, level: 7,
          steps: [
            { desc: '你趴在床上，库帕从背后狠狠操进你的菊穴，越插越深', bpm: 0, seconds: 60 },
            { desc: '逐渐加速到 120 BPM 猛干，你不允许把鸡巴拔出来', bpm: 120, seconds: 60 },
            { desc: '库帕在你体内射精，把你灌满', bpm: 0, seconds: 60 },
          ],
        },
         6: {
          desc: '先做 Z=3（拍脸操嘴射脸），然后脸上带着精液做两遍 Z=4-5（趴床深操 3 分钟 + 内射），共射 3 次。',
          gold: 200, level: 10,
          steps: [
            { desc: '你跪下仰脸，让库帕用粗大的鸡巴拍打你的脸和嘴唇，你顺从地迎接', bpm: 0, seconds: 60 },
            { desc: '库帕掐着你的头操你的嘴，每 30 秒扇你一耳光，你保持眼神接触呻吟', bpm: 0, seconds: 120 },
            { desc: '他射在你脸上，精液顺着脸颊滴落', bpm: 0, seconds: 0 },
            { desc: '你带着满脸精液趴在床上肚子朝下，库帕把巨大的鸡巴深深捅进你的菊穴', bpm: 0, seconds: 60 },
            { desc: '他逐渐加速到 120 BPM 猛操，你咬紧床单承受，射之前不许拔出来', bpm: 120, seconds: 60 },
            { desc: '他越操越狠，你被顶得说不出话，只能淫叫', bpm: 120, seconds: 60 },
            { desc: '库帕在你体内射精，把你灌满', bpm: 0, seconds: 0 },
            { desc: '他意犹未尽，又一次深深捅进你还滴着精液的菊穴', bpm: 0, seconds: 60 },
            { desc: '再次加速到 120 BPM 猛操，你被顶得翻白眼', bpm: 120, seconds: 60 },
            { desc: '库帕第二次在你体内射精，把你灌得满满的', bpm: 0, seconds: 0 },
          ],
        },
      },
    },
    guard: {
      name: '卫兵',
      intro: '你在酒馆角落遇到一个下值的卫兵，军靴踩在凳沿上，裤裆已经撑起一团阴影。"城里的规矩你知道——公职人员操妓女是要犯禁的。"他慢悠悠掏出手铐，"所以你最好管住嘴。卖力点，不然按军规抽烂你的屁股。"',
      tasks: {
        1: {
          desc: '跪着给卫兵口交 30 秒，深喉吞到底，然后趴下撅起屁股，让他用中号假阳具操你的菊穴 30 秒。',
          gold: 0, level: 1,
          rewardItem: 'guard_pass',
          steps: [
            { desc: '你跪在卫兵腿间，含住他的粗鸡巴卖力口交，一次次深喉吞到底，口水顺着下巴流下', bpm: 0, seconds: 30 },
            { desc: '你趴下撅起屁股，卫兵握着中号假阳具狠狠操进你的菊穴，你咬着唇浪叫', bpm: 0, seconds: 30 },
          ],
        },
        2: {
          desc: '与 Z=1 相同，免费给卫兵口交后撅起屁股被假阳具操菊穴。',
          gold: 0, level: 1,
          rewardItem: 'guard_pass',
          steps: [
            { desc: '跪在卫兵腿间，把他硬邦邦的粗鸡巴含进嘴里吞吐深喉 30 秒', bpm: 0, seconds: 30 },
            { desc: '转过身趴下，撅起屁股，让卫兵用中号假阳具操进你的菊穴 30 秒，你夹紧迎合', bpm: 0, seconds: 30 },
          ],
        },
        3: {
          desc: '他掐着你的下巴，粗鸡巴操进你的嘴穴 30 秒，操得你口水直流；再把你按在桌沿，从背后猛操菊穴 1 分钟（90 BPM）；最后让你跪回去，用舌头把他那根舔舐得干干净净。',
          gold: 25, level: 2,
          steps: [
            { desc: '卫兵掐着你的下巴，粗鸡巴操进你的嘴穴 30 秒，操得你口水直流、眼睛翻白', bpm: 0, seconds: 30 },
            { desc: '他把鸡巴抽出来，把你按在桌沿，从背后猛操你的菊穴（90 BPM），你被顶得淫叫连连', bpm: 90, seconds: 60 },
            { desc: '你跪回去，用舌头把他那根肉棒从根部到顶端舔舐得干干净净，一滴不剩', bpm: 0, seconds: 30 },
          ],
        },
        4: {
          desc: '与 Z=3 相同：操嘴 30 秒、后入 1 分钟、舔干净。',
          gold: 25, level: 2,
          steps: [
            { desc: '你跪着张开嘴，卫兵的粗鸡巴狠狠操进你的嘴穴 30 秒，口水飞溅', bpm: 0, seconds: 30 },
            { desc: '他把你按在桌沿，从背后猛操菊穴 1 分钟（90 BPM），你的呻吟盖不住皮肉撞击声', bpm: 90, seconds: 60 },
            { desc: '你跪回去，卖力地用舌头把肉棒舔舐干净，含住龟头吸吮', bpm: 0, seconds: 30 },
          ],
        },
        5: {
          desc: '与 Z=3-4 相同：操嘴 30 秒、后入 1 分钟、舔干净，卫兵更粗暴。',
          gold: 25, level: 2,
          steps: [
            { desc: '卫兵掐住你的下巴，粗鸡巴操进你嘴里 30 秒，粗暴得让你干呕', bpm: 0, seconds: 30 },
            { desc: '他按住你的后颈，把你按在桌沿，从背后狠狠操进菊穴 1 分钟（90 BPM）', bpm: 90, seconds: 60 },
            { desc: '最后你跪在卫兵脚边，用舌头把他那根舔得干干净净，连卵蛋都含进嘴里吸吮', bpm: 0, seconds: 30 },
          ],
        },
        6: {
          desc: '卫兵叫来换班的同袍一起"盘查"。先跪着轮流给两根粗鸡巴口交 1 分钟，再被按住同时操嘴穴和菊穴 1 分钟，最后他们把滚烫的浓精射在你脸上和菊穴深处，让你含着精液跪好。',
          gold: 45, level: 3,
          steps: [
            { desc: '你跪在两个卫兵中间，轮流为两根粗鸡巴口交，深喉、舔卵蛋一样不少', bpm: 0, seconds: 60 },
            { desc: '他们把你按在墙上，两根鸡巴同时操进你的嘴穴和菊穴，前后夹击把你操得浪叫连连', bpm: 90, seconds: 60 },
            { desc: '两根粗鸡巴轮番把滚烫的浓精射在你脸上和菊穴深处，你含着精液跪好，一滴都不敢漏', bpm: 0, seconds: 0 },
          ],
        },
      },
    },
  }

  /** 寻找顾客：随机遇到哥布林 / 狼人 / 兽人 / 牛头人 / 库帕 */
  function findCustomer () {
    const state = State.get()
    const pool = ['goblin', 'werewolf', 'orc', 'minotaur', 'koopa', 'guard']
    const key = pool[Math.floor(Math.random() * pool.length)]
    const customer = CUSTOMER_TASKS[key]
    // 女性显示小穴/菊穴两个洞，男性只说菊穴
    const intro = state.gender === 'male'
      ? customer.intro.replace('小穴/菊穴', '菊穴').replace('插入小穴/菊穴', '插入菊穴')
      : customer.intro
    campShow({
      title: `🍻 你遇见了${customer.name}`,
      className: 'tavern-work-modal',
      body: `<div class="glory-section"><h3><span>${customer.name}看上了你</span><small>${customer.name === '哥布林' ? '小号假阳具（最多 3 个）' : customer.name === '狼人' ? '中号或大号假阳具' : customer.name === '兽人' ? '大号假阳具（最多 2 个）' : customer.name === '牛头人' ? '大号马/牛形假阳具' : customer.name === '卫兵' ? '中号假阳具' : '用你最大的假阳具'}</small></h3>
        <p class="camp-muted">${intro}</p></div>`,
      actions: [
        { label: '🍑 为他服务', cls: 'btn-primary', handler: () => { Dialog.close(); runCustomerTask(key) } },
        { label: `💸 换客人（${state._prostituteSwapCost || 20}G）`, handler: () => { Dialog.close(); swapCustomer() } },
      ],
    })
  }

  /** 换客人：花金币换掉当前客人，费用递增（20 起，每次 +10，最高 100）；没钱则变成欠款 */
  function swapCustomer () {
    const state = State.get()
    const cost = Math.min(100, state._prostituteSwapCost || 20)
    if (state.gold >= cost) {
      state.gold -= cost
      EventBus.emit('ui:log', { text: `💸 花 ${cost}G 打发了这个客人，换个新的。`, type: 'dim' })
    } else {
      state._prostituteDebt = (state._prostituteDebt || 0) + cost
      EventBus.emit('ui:log', { text: `💸 你付不起 ${cost}G，换客费用记成欠款（现欠 ${state._prostituteDebt}G）。`, type: 'danger' })
    }
    // 换客费用递增（上限 100）
    state._prostituteSwapCost = Math.min(100, cost + 10)
    EventBus.emit('state:changed', state)
    findCustomer()
  }

  /** 执行顾客任务：掷 Z → 任务弹窗（BPM + 完成/跳过）→ 结算 */
  async function runCustomerTask (customerKey, forcedZ, startStep = 0) {
    const state = State.get()
    const customer = CUSTOMER_TASKS[customerKey]
    if (!customer) { state._prostitutePendingTask = null; EventBus.emit('state:changed', state); prostitute(); return }
    const z = forcedZ || Dice.rollZ()
    let task = customer.tasks[z]
    if (!task) { state._prostitutePendingTask = null; EventBus.emit('state:changed', state); prostitute(); return }
    // 性别适配任务文本：
    //  - 贞操装置：小穴一律改回菊穴（肛交）
    //  - 女性：Z=1-3 操菊穴，Z=4-6 改操小穴（阴道）
    //  - 男性：一律操菊穴（任务里写死的小穴改回菊穴）
    const taskFullText = task.desc + (task.steps || []).map(s => s.desc).join('')
    if (ChastitySystem.isWorn()) {
      const fix = s => String(s || '').replace(/小穴/g, '菊穴')
      task = {
        ...task,
        desc: fix(task.desc),
        steps: (task.steps || []).map(st => ({ ...st, desc: fix(st.desc) })),
      }
    } else if (state.gender === 'male') {
      if (/小穴/.test(taskFullText)) {
        const fix = s => String(s || '').replace(/小穴/g, '菊穴')
        task = {
          ...task,
          desc: fix(task.desc),
          steps: (task.steps || []).map(st => ({ ...st, desc: fix(st.desc) })),
        }
      }
    } else if (z >= 4 && /菊穴/.test(taskFullText)) {
      const fix = s => String(s || '').replace(/菊穴/g, '小穴')
      task = {
        ...task,
        desc: fix(task.desc),
        steps: (task.steps || []).map(st => ({ ...st, desc: fix(st.desc) })),
      }
    }
    state._prostitutePendingTask = { customerKey, z, stepIndex: Math.max(0, startStep) }
    EventBus.emit('state:changed', state)
    await Dialog.showDice(z, 'Z')

    EventBus.emit('ui:log', { text: `🎲 Z=${z}：${customer.name}要${task.desc}`, type: 'danger' })

    // 用战斗任务弹窗逐段执行：BPM + 计时 + 完成任务/跳过
    let failed = false
    // 服务类妖缚装备：只有指定款式触发对应加成。
    const R = (typeof RestraintSystem !== 'undefined') ? RestraintSystem : null
    const gear = {
      lipstick: !!R && R.hasDevice('lipstick'),
      makeup: !!R && R.hasDevice('makeup'),
      heels: !!R && ['heels', 'heels_10', 'heels_12', 'heels_14'].some(id => R.hasDevice(id)),
      lingerie: !!R && R.hasDevice('lingerie'),
      latex: !!R && R.hasDevice('latex'),
      collar: !!R && R.hasDevice('slut_collar'),
      gag: !!R && R.hasDevice('slut_gag'),
      insertionBonus: R ? R.insertionProstituteBonus() : 0,
    }
    const isInsert = /操|插入|抽插|后入|骑乘|传教士/.test(task.desc)
    // 妖缚口塞（惩罚件）：口交/深喉任务做不了，直接判失败
    if (R && R.hasGag() && /口交|深喉|吞吐|口穴/.test(taskFullText)) {
      EventBus.emit('ui:log', { text: '🤐 口塞堵着嘴，你只能含混地干呕——口交服务做不了！', type: 'danger' })
      failed = true
    }
    // 服务项圈：插入任务强制 120 BPM；只有开口口塞触发 160（+项圈 180）BPM。
    let forceBpm = 0
    if (isInsert && !failed) {
      if (gear.gag) forceBpm = gear.collar ? 180 : 160
      else if (gear.collar) forceBpm = 120
    }
    const dildoName = customer.name === '哥布林' ? '小号假阴茎' : customer.name === '狼人' ? '大号假阴茎' : customer.name === '兽人' ? '大号假阴茎' : customer.name === '牛头人' ? '马/牛形假阴茎' : customer.name === '卫兵' ? '中号假阴茎' : '最大的假阴茎'
    const steps = task.steps || [{ desc: task.desc, bpm: task.bpm || 0, seconds: task.seconds || 0 }]
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog && !failed) {
      for (let i = Math.min(startStep, steps.length - 1); i < steps.length; i++) {
        state._prostitutePendingTask = { customerKey, z, stepIndex: i }
        EventBus.emit('state:changed', state)
        const step = steps[i]
        const f = await BattleUI.showTaskDialog({
          enemyName: `🍻 ${customer.name}${steps.length > 1 ? `（第 ${i + 1}/${steps.length} 段）` : ''}`,
          attackName: step.desc,
          desc: step.desc,
          bpm: forceBpm > 0 && /操|插入|抽插|后入|骑乘|传教士/.test(step.desc) ? forceBpm : (step.bpm || 0),
          seconds: step.seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName,
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm(`为${customer.name}服务：${task.desc}\n\n确定代表完成，取消代表未完成。`)
    }

    // 结算
    const isOral = /口交|吞吐|深喉/.test(task.desc)

    let gold = task.gold
    let effLevel = task.level
    let goldMult = 1
    let levelMult = 1
    let goldBonus = 0

    // 抢钱任务（金币为负）：不受任何用品金币加成影响，保持原样
    if (gold >= 0) {
      // 口红 / 妆容：口交任务金币加成
      if (isOral) {
        if (gear.lipstick) goldBonus += 20
        if (gear.makeup) goldBonus += 30
      }
      // 乳胶衣：金币翻倍
      if (gear.latex) goldMult *= 2
      // 媚奴口塞：插入任务金币翻倍
      if (gear.gag && isInsert) goldMult *= 2
      // 插入类妖缚装备：菊穴和小穴可同时穿戴，加成按当前装备累加。
      if (gear.insertionBonus && isInsert) goldBonus += gear.insertionBonus
    }
    // 等级翻倍（封顶 ×2）
    if (gear.lingerie) levelMult *= 2
    if (gear.latex) levelMult *= 2
    if (gear.gag && isInsert && gear.collar) levelMult *= 2
    if (gear.collar && isInsert && !gear.gag) levelMult *= 2

    // 最高只能 ×2（不叠加成 ×4/×8）
    if (goldMult > 2) goldMult = 2
    if (levelMult > 2) levelMult = 2

    gold = gold * goldMult + goldBonus
    if (!failed && window.TownReputationSystem) gold = TownReputationSystem.getServiceIncome(gold)
    effLevel = effLevel * levelMult

    // 营地税率：按难度从接客收入中扣除（抢钱任务不征税）
    const taxRate = (CONFIG.difficulty[state.difficulty] || {}).campTax || 0
    let campTaxPaid = 0
    if (gold > 0 && taxRate > 0) {
      campTaxPaid = Math.floor(gold * taxRate)
      gold -= campTaxPaid
    }
    if (failed) {
      gold = 0
      state._prostituteDebt = (state._prostituteDebt || 0) + 30   // 没完成：欠款 +30
    } else {
      state._prostituteLevel += effLevel   // 只有完成才升级
      state._prostituteSwapCost = 20   // 服务完成，换客费用重置
      if (window.MercenaryContractSystem) MercenaryContractSystem.recordService('tavern')
      if (window.TownReputationSystem) TownReputationSystem.recordLegalService('雾灯酒馆')
    }
    state._prostitutePendingTask = null
    // 卫兵任务奖励：出城免检查卷
    let rewardItemText = ''
    if (!failed && task.rewardItem) {
      state.inventory.consumables[task.rewardItem] = (state.inventory.consumables[task.rewardItem] || 0) + 1
      const rewardItem = typeof ItemLib !== 'undefined' ? ItemLib.get(task.rewardItem) : null
      rewardItemText = rewardItem ? `<p style="color:var(--gold);margin-top:6px">📜 获得「${rewardItem.name}」×1</p>` : ''
      EventBus.emit('ui:log', { text: `📜 卫兵塞给你一张「出城免检查卷」。`, type: 'good' })
    }
    state.gold += gold
    if (gold < 0 && state.gold < 0) state.gold = 0
    // 赚的钱先还欠款
    let repaid = 0
    if (gold > 0 && (state._prostituteDebt || 0) > 0) {
      repaid = Math.min(state._prostituteDebt, gold)
      state._prostituteDebt -= repaid
      state.gold -= repaid
    }

    const incomeText = gold < 0 ? `被抢走 ${-gold} 金币` : `赚了 ${gold} 金币${campTaxPaid > 0 ? `（营地收税 ${campTaxPaid}G）` : ''}`
    EventBus.emit('ui:log', { text: `💋 你服务完${customer.name}，${failed ? `没做好，欠老板娘 30G（现欠 ${state._prostituteDebt}G），等级未提升` : `${incomeText}${repaid > 0 ? `，其中 ${repaid}G 用来还债（还剩 ${state._prostituteDebt}G）` : ''}，妓女等级 +${effLevel}（现 ${state._prostituteLevel} 级）`}`, type: gold > 0 ? 'good' : 'dim' })
    EventBus.emit('state:changed', state)

    const title = prostituteTitle(state._prostituteLevel)
    // 新称号达成提示（仅完成时）
    let titleUp = ''
    if (!failed) {
      if (state._prostituteLevel >= 100 && state._prostituteLevel - effLevel < 100) titleUp = '<p style="color:var(--gold);font-weight:800;margin-top:6px">👑 晋升为「头牌妓畜」！</p>'
      else if (state._prostituteLevel >= 70 && state._prostituteLevel - effLevel < 70) titleUp = '<p style="color:var(--gold);font-weight:800;margin-top:6px">💼 晋升为「职业妓女」！</p>'
      else if (state._prostituteLevel >= 30 && state._prostituteLevel - effLevel < 30) titleUp = '<p style="color:var(--gold);font-weight:800;margin-top:6px">🫦 晋升为「顺从的妓女」！</p>'
      else if (state._prostituteLevel >= 10 && state._prostituteLevel - effLevel < 10) titleUp = '<p style="color:var(--gold);font-weight:800;margin-top:6px">🐣 晋升为「新手妓女」！</p>'
    }

    const inDebt = (state._prostituteDebt || 0) > 0
    campShow({
      title: '💋 服务结束', className: 'glory-result-modal',
      body: `<div class="glory-result"><strong>${failed ? `没完成，欠老板娘 30G` : gold >= 0 ? `赚了 ${gold}G${campTaxPaid > 0 ? `（税 ${campTaxPaid}G）` : ''}` : `被抢走 ${-gold}G`}</strong><p>${failed ? `等级未提升（仍是 ${state._prostituteLevel} 级 · ${title.icon} ${title.name}）` : `妓女等级提升到 <b>${state._prostituteLevel}</b> 级 · ${title.icon} ${title.name}`}</p>${inDebt ? `<p style="color:var(--danger);margin-top:6px">💸 你欠老板娘 ${state._prostituteDebt}G，还清前不能离开！</p>` : ''}${titleUp || ''}${rewardItemText || ''}${title.note ? `<p style="color:var(--text-dim);font-size:.75rem;margin-top:4px">${title.note}</p>` : ''}</div>`,
      actions: [
        { label: inDebt ? '继续接客还债' : '继续接客', cls: 'btn-primary', handler: () => { Dialog.close(); prostitute() } },
      ],
    })
  }


  /** 摇骰子赌博：下注 1/3/5，60% 亏钱 */
  function tavernGamble () {
    const state = State.get()
    if ((state._tavernGuest || 0) <= 0) {
      EventBus.emit('ui:log', { text: '🍺 赌客不在，你得先打赢一个敌人他才会回来。', type: 'dim' })
      TownTavernSystem.render(); return
    }
    // 连 5G 都掏不出来 → 嘲讽
    if (state.gold < 5) {
      EventBus.emit('ui:log', { text: '🧔 "穷逼！连 5G 都拿不出来还想赌？滚远点！"', type: 'danger' })
      campShow({
        title: '🎲 老顾客的嘲笑',
        body: '<p>他上下打量你一眼，嗤笑出声：<b>"穷逼，连 5G 都没有，别在这儿碍眼，滚！"</b></p>',
        actions: [{ kind: 'navigation', label: '灰溜溜离开', handler: () => { Dialog.close(); TownTavernSystem.guest() } }],
      })
      return
    }
    campShow({
      title: '🎲 摇骰子', className: 'glory-modal',
      body: `<div class="glory-section"><h3><span>下注多少？</span><small>60% 会输光，40% 赚</small></h3>
        <div class="glory-hole-choice">
          <button class="glory-hole-btn" data-bet="5"><span><b>下注 5G</b><small>小赌怡情</small></span></button>
          <button class="glory-hole-btn" data-bet="10"><span><b>下注 10G</b><small>有点刺激</small></span></button>
          ${state.gold > (state._tavernGuest || 0) ? `<button class="glory-hole-btn" data-bet="allin"><span><b>梭哈 ${state.gold}G</b><small>你钱比他多，赢一把大的</small></span></button>` : ''}
        </div></div>`,
      actions: [{ kind: 'navigation', label: '返回老顾客', handler: () => { Dialog.close(); TownTavernSystem.guest() } }],
    })
    document.querySelectorAll('[data-bet]').forEach(btn => {
      btn.onclick = () => {
        const v = btn.dataset.bet
        const bet = v === 'allin' ? state.gold : parseInt(v)
        Dialog.close(); doTavernRoll(bet)
      }
    })
  }

  async function doTavernRoll (bet) {
    const state = State.get()
    if (state.gold < bet) { EventBus.emit('ui:log', { text: '💰 你没那么多钱下注。', type: 'dim' }); tavernGamble(); return }

    const z = Dice.rollZ()
    await Dialog.showDice(z, 'Z')
    const win = Math.random() >= 0.6   // 60% 亏钱

    if (!win) {
      state.gold -= bet
      EventBus.emit('ui:log', { text: `🎲 Z=${z} → 你输了，赔掉 ${bet}G。`, type: 'danger' })
    } else {
      const payout = Math.min(bet, Math.max(0, state._tavernGuest || 0))
      state.gold += payout
      state._tavernGuest = Math.max(0, (state._tavernGuest || 0) - payout)
      EventBus.emit('ui:log', { text: `🎲 Z=${z} → 你赢了 ${payout}G！赌客脸色有点难看。`, type: 'good' })
      // 赌客的钱被赢光了 → 离开
      if (state._tavernGuest <= 0) {
        EventBus.emit('ui:log', { text: '🏃 赌客被你赢光了，气呼呼地离开了！打赢一个敌人后他才会回来。', type: 'good' })
      }
    }
    EventBus.emit('state:changed', state)
    if ((state._tavernGuest || 0) > 0) TownTavernSystem.guest()
    else TownTavernSystem.render()
  }

  /** 买酒：酒有 debuff 和效果 */
  const DRINKS = [
    { id: 'beer', name: '麦酒', price: 5, heal: 10, drunk: 1, desc: '回 10 HP，但会醉酒 1 回合（攻击减半、走路摇晃）' },
    { id: 'liquor', name: '烈酒', price: 10, heal: 15, drunk: 2, desc: '回 15 HP，但醉酒 2 回合，醉得更厉害' },
    { id: 'grog', name: '药酒', price: 15, heal: 20, drunk: 3, regen: true, desc: '回 20 HP + 再生 1 回合，但醉酒 3 回合，几乎走不了路' },
  ]

  function tavernDrink () {
    const state = State.get()
    campShow({
      title: '🍷 吧台酒单', className: 'glory-modal',
      body: `<div class="drink-wallet"><span>🍷 雾灯酒馆 · 吧台酒单</span><strong>💎 ${state.gold}G</strong></div><div class="glory-section"><h3><span>想喝点什么？</span><small>喝完有劲，但也有代价</small></h3>
        <div class="drink-list">${DRINKS.map(d => {
          const price = townPrice(d.price, 'tavern')
          const canBuy = state.gold >= price
          return `
          <button class="drink-option${canBuy ? '' : ' is-unaffordable'}" data-drink="${d.id}" ${canBuy ? '' : 'disabled'}>
            <span class="drink-emoji">${d.id === 'beer' ? '🍺' : d.id === 'liquor' ? '🥃' : '🍷'}</span>
            <span class="drink-info"><b>${d.name}</b><small>${d.desc}</small></span>
            <span class="drink-price">${canBuy ? `${price}G${price !== d.price ? ` · 原价 ${d.price}G` : ''}` : '金币不足'}</span>
          </button>`
        }).join('')}</div></div>`,
      actions: [{ kind: 'navigation', label: '返回老板娘', handler: () => { Dialog.close(); TownTavernPatronsSystem.openBarkeep() } }],
    })
    document.querySelectorAll('[data-drink]').forEach(btn => {
      btn.onclick = () => {
        const drink = DRINKS.find(d => d.id === btn.dataset.drink)
        const price = drink ? townPrice(drink.price, 'tavern') : 0
        Dialog.close()
        if (!drink || state.gold < price) { EventBus.emit('ui:log', { text: '💰 钱不够买这杯。', type: 'dim' }); tavernDrink(); return }
        state.gold -= price
        state.hp = Math.min(state.maxHp, state.hp + drink.heal)
        StatusSystem.apply('drunk', drink.drunk, { source: 'player' })
        if (drink.regen) StatusSystem.apply('regeneration', 1, { level: 1, source: 'player' })
        EventBus.emit('ui:log', { text: `🍷 灌下${drink.name}，身体热乎乎的，回 ${drink.heal} HP，但醉意上头了。`, type: 'good' })
        EventBus.emit('state:changed', state)
        TownTavernPatronsSystem.openBarkeep()
      }
    })
  }



  return {
    open: tavernWork,
    title: prostituteTitle,
    openGamble: tavernGamble,
    openDrink: tavernDrink,
    resumeCustomerTask: runCustomerTask,
  }
})()
