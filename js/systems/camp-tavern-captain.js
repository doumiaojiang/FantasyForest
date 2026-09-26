/**
 * systems/camp-tavern-captain.js — 酒馆守卫队长、许可证与赦免剧情。
 */
window.TownTavernCaptainSystem = (function () {
  const campShow = options => CampSystem.showScene(options)
  const openCamp = opts => CampSystem.open(opts)
  const townPrice = (price, category) => CampSystem.townPrice(price, category)
  const routeTownService = part => CampSystem.routeTownService(part)
  const townServiceDesc = (part, actor) => CampSystem.townServiceDesc(part, actor)
  const wrongCommissionLead = kind => PrologueSystem.recordLead(kind)

  function tavernCaptain () {
    const state = State.get()
    // 通缉犯（越狱在逃）：队长一眼认出你腿间的监狱贞操锁
    if (state._wanted) {
      captainWanted()
      return
    }
    const hasLicense = state._prostituteLicensed
    campShow({
      title: '🛡️ 守卫队队长', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🛡️</i><div><b>“哼，又是个想在这林子里讨生活的。”</b><p>军官抿了口酒，打量你几眼：“这城里不管做什么生意，都得在我这儿挂个号。懂？”</p></div></div>
        <div class="camp-grid">
          <button class="camp-opt" data-captain="chat"><i>💬</i><span><b>聊天</b><small>听他讲讲守卫队的门道</small></span><em>搭话</em></button>
          ${hasLicense ? '' : `<button class="camp-opt" data-captain="buy"><i>📜</i><span><b>购买妓女许可证</b><small>在队长这也能办证，200G</small></span><em>${state.gold >= 200 ? '可办' : '钱不够'}</em></button>`}
          ${hasLicense ? `<button class="camp-opt" data-captain="cancel"><i>🗑️</i><span><b>取消妓女许可证</b><small>退出这行，退出前先想清楚</small></span><em>${TownTavernWorkSystem.title(state._prostituteLevel).name}</em></button>` : ''}
          <button class="camp-opt" data-captain="pardon"><i>🕊️</i><span><b>求情免进监狱</b><small>${state._prisonPardon ? '已豁免' : '求队长别把你送进深喉监狱'}</small></span><em>${state._prisonPardon ? '已生效' : '求情'}</em></button>
        </div>`,
      actions: [{ kind: 'navigation', label: '返回酒馆', handler: () => { TownTavernSystem.render() } }],
    })
    document.querySelectorAll('[data-captain]').forEach(btn => {
      btn.onclick = () => {
        const opt = btn.dataset.captain
        if (opt === 'chat') captainChat()
        else if (opt === 'buy') captainBuyLicense()
        else if (opt === 'cancel') captainCancelLicense()
        else if (opt === 'pardon') captainPardon()
      }
    })
  }

  /** 通缉犯见队长：越狱在逃，被队长当场认出来要惩罚 */
  function captainWanted () {
    const state = State.get()
    const lockLine = state._prisonChastity
      ? '“站住。你腿间那把锁——监狱的货。”<br>队长眯起眼睛，猛地拍桌而起："越狱？敢在我的地盘上逃？"'
      : '“站住。通缉令上那个越狱的，是你吧？”<br>队长眯起眼睛，猛地拍桌而起："我亲手画押的越狱犯，敢大摇大摆来见我？"'
    const settleLine = state._prisonChastity
      ? '他盯着你："两个选择：交 <b>300G</b> 我替你压下去，或者跪下来把老子伺候舒坦了。否则——我现在就把你押回深喉监狱。"'
      : '他盯着你："两个选择：交 <b>300G</b> 我替你销案底，或者跪下来把老子伺候舒坦了。否则——我现在就重新把你收监。"'
    campShow({
      title: '🛡️ 守卫队队长 · 通缉', className: 'camp-tavern-modal captain-wanted-modal',
      body: `<div class="camp-character"><i>🛡️</i><div><b>${lockLine}</b><p>${settleLine}</p></div></div>`,
      actions: [
        ...(state.gold >= 300 ? [{ label: '💸 交 300G 销案底', cls: 'btn-primary', handler: () => {
          state.gold -= 300
          state._wanted = false
          EventBus.emit('ui:log', { text: '💸 交了 300G，队长把你从通缉名单上划掉了（锁还在身上）。', type: 'danger' })
          EventBus.emit('state:changed', state)
          tavernCaptain()
        } }] : []),
        { label: '🧎 跪下求情', cls: 'btn-danger', handler: () => { captainWantedService() } },
        { label: '宁死不从', cls: 'btn-danger', handler: () => {
          EventBus.emit('ui:log', { text: '⛓️ 队长一声令下，卫兵扑上来把你押回了深喉监狱！', type: 'danger' })
          state._prisonEscapePenalty = (state._prisonEscapePenalty || 0) + 150
          TownPrisonSystem.enter()
        } },
      ],
    })
  }

  /** 通缉求情：口交 1 分钟 + 深喉 10 次 + 肛交/性交 1 分钟，完成销案底，失败押回监狱 */
  async function captainWantedService () {
    const state = State.get()
    const oralRoute = routeTownService('oral')
    const penetrationRoute = routeTownService(state.gender !== 'male' ? 'vagina' : 'anal')
    if (oralRoute.mode === 'unavailable' || penetrationRoute.mode === 'unavailable') {
      EventBus.emit('ui:log', { text: '⛓️ 妖缚装备让交易无法进行，队长失去耐心，把你押回了监狱。', type: 'danger' })
      state._prisonEscapePenalty = (state._prisonEscapePenalty || 0) + 150
      TownPrisonSystem.enter()
      return
    }
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const steps = [
        { desc: townServiceDesc(oralRoute.part, '队长'), bpm: oralRoute.part === 'oral' ? 0 : 90, seconds: 60 },
        { desc: townServiceDesc(oralRoute.part, '队长'), bpm: oralRoute.part === 'oral' ? 0 : 90, seconds: 30 },
        { desc: townServiceDesc(penetrationRoute.part, '队长'), bpm: penetrationRoute.part === 'oral' ? 0 : 90, seconds: 60 },
      ]
      for (let i = 0; i < steps.length; i++) {
        const f = await BattleUI.showTaskDialog({
          enemyName: `🛡️ 守卫队队长（第 ${i + 1}/3 段）`,
          attackName: '跪着求情销案',
          desc: steps[i].desc,
          bpm: steps[i].bpm || 0,
          seconds: steps[i].seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName: '队长那根粗壮的鸡巴',
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm('给队长服务：口交 1 分钟 + 深喉 10 次 + 肛交/性交 1 分钟销案底。')
    }
    if (failed) {
      EventBus.emit('ui:log', { text: '⛓️ 你伺候到一半，队长嫌你敷衍——直接把你押回了深喉监狱！', type: 'danger' })
      state._prisonEscapePenalty = (state._prisonEscapePenalty || 0) + 150
      TownPrisonSystem.enter()
      return
    }
    state._wanted = false
    EventBus.emit('ui:log', { text: '🛡️ 队长被你伺候舒服了，挥挥手："行，名字划了。别让我再看见你这张脸。"', type: 'good' })
    EventBus.emit('state:changed', state)
    tavernCaptain()
  }

  /** 队长求情免监狱：单一路线，避免把剧情做成开关设置 */
  function captainPardon () {
    const state = State.get()
    const pardoned = !!state._prisonPardon
    campShow({
      title: '🕊️ 请求队长庇护', className: 'camp-tavern-modal captain-pardon-modal',
      body: `<section class="captain-pardon ${pardoned ? 'is-active' : ''}">
          <div class="captain-pardon-hero">
            <i>${pardoned ? '🕊️' : '🛡️'}</i>
            <div><small>私下交涉</small><b>${pardoned ? '“我的人不会动你——别让我后悔。”' : '“想让我从名单上划掉你的名字？”'}</b><p>${pardoned ? '队长的担保仍然有效。守卫认得你的名字，不会再把你送进监狱。' : '队长放下酒杯，示意你走近些：“可以谈。但我的庇护，从来不是白给的。”'}</p></div>
          </div>
          <div class="captain-pardon-terms">
            <div><i>🕊️</i><span><b>豁免效果</b><small>危险值达到 100 时也不会被送进监狱</small></span></div>
            <div><i>${pardoned ? '✓' : '⚠️'}</i><span><b>${pardoned ? '当前状态' : '队长的条件'}</b><small>${pardoned ? '守卫队长的担保已经生效' : '跪下请求庇护，并完成 30 秒服务'}</small></span></div>
          </div>
          ${pardoned ? '<div class="captain-pardon-seal">✓ 豁免令已生效</div>' : '<p class="captain-pardon-warning">接受后将立即开始计时；中途失败仍会被送进监狱。</p>'}
        </section>`,
      actions: pardoned
        ? [{ kind: 'navigation', label: '返回队长', cls: 'btn-primary', handler: () => { tavernCaptain() } }]
        : [
            { label: '🧎 跪下请求庇护', cls: 'btn-danger', handler: () => {
              EventBus.emit('ui:log', { text: '🧎 你跪到队长面前，低声请求他把你的名字从监狱名单上划掉。', type: 'danger' })
              pardonBlowjob()
            } },
            { kind: 'navigation', label: '暂时算了', handler: () => { tavernCaptain() } },
          ],
    })
  }

  /** 口交求情任务 */
  async function pardonBlowjob () {
    const state = State.get()
    const route = routeTownService('oral')
    if (route.mode === 'unavailable') {
      EventBus.emit('ui:log', { text: '⛓️ 所有可用部位都被锁死，队长拒绝接受求情，把你送进了监狱。', type: 'danger' })
      Dialog.close()
      TownPrisonSystem.enter()
      return
    }
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const f = await BattleUI.showTaskDialog({
        enemyName: '🛡️ 守卫队队长',
        attackName: '跪着口交求情',
        desc: townServiceDesc(route.part, '队长'),
        bpm: route.part === 'oral' ? 0 : 90,
        seconds: 30,
        dmg: 0,
        noDamage: true,
        dildoName: '队长那根粗壮的鸡巴',
      })
      failed = f
    } else {
      failed = !confirm('给队长口交 30 秒求情。')
    }
    if (failed) {
      EventBus.emit('ui:log', { text: '🛡️ 你口交到一半，队长嫌你不够卖力，还是把你扔进了监狱！', type: 'danger' })
      Dialog.close()
      TownPrisonSystem.enter()
      return
    }
    EventBus.emit('ui:log', { text: '🛡️ 队长被你伺候舒服了，挥挥手："行，放你一马。"', type: 'good' })
    grantPardon()
  }

  /** 授予豁免 */
  function grantPardon () {
    const state = State.get()
    state._prisonPardon = true
    state._gloryWanted = 0
    EventBus.emit('state:changed', state)
    Dialog.show({
      title: '🕊️ 队长 · 豁免生效', className: 'camp-tavern-modal',
      body: `<div class="camp-character"><i>🛡️</i><div><b>“记住，这是老子给你的恩典。”</b><p>队长拍拍你的脸："往后就算你把危险值作到 100，我也不会让手下把你扔进深喉监狱。滚吧。"</p></div></div>`,
      actions: [
        { label: '谢过队长', cls: 'btn-primary', handler: () => { Dialog.close(); tavernCaptain() } },
      ],
    })
  }

  /** 队长聊天：随机循环闲话 */
  const CAPTAIN_CHATS = [
    { title: '💬 守卫队队长 · 规矩', body: `<div class="camp-character"><i>🛡️</i><div><b>“营地里三教九流，出了事都得往我们这儿报。”</b><p>他指节敲着桌子：“你要是在城里犯了禁，出城那道关卡就是我的人在看着。”</p></div></div>` },
    { title: '💬 守卫队队长 · 许可证', body: `<div class="camp-character"><i>🛡️</i><div><b>“妓女这行，得挂我的号。”</b><p>他压低声音：“老板娘那娘们办的证，我们认。但你要是来我这儿办，以后出城，我手底下的人多少会看你顺眼些。”</p></div></div>` },
    { title: '💬 守卫队队长 · 怪物', body: `<div class="camp-character"><i>🛡️</i><div><b>“这林子里的怪物，可比人还难缠。”</b><p>他朝窗外吐了口烟：“别以为有了证就能横着走，规矩就是规矩。”</p></div></div>` },
    { title: '💬 守卫队队长 · 值夜', body: `<div class="camp-character"><i>🛡️</i><div><b>“值夜最烦的就是那些醉鬼。”</b><p>他灌了口酒：“喝完酒闹事的一律先铐起来，醒了再算账。”</p></div></div>` },
    { title: '💬 守卫队队长 · 新兵', body: `<div class="camp-character"><i>🛡️</i><div><b>“手底下新来了几个愣头青。”</b><p>他哼了一声：“见了怪物腿就打颤，还得老子亲自带。”</p></div></div>` },
    { title: '💬 守卫队队长 · 风声', body: `<div class="camp-character"><i>🛡️</i><div><b>“最近营地里风声紧。”</b><p>他压低嗓子：“你最好规矩点，别让我的人抓到你。”</p></div></div>` },
  ]
  function captainChat () {
    const state = State.get()
    state._captainChatCount = (state._captainChatCount || 0) + 1
    const n = state._captainChatCount
    let title, body
    if (n === 1) {
      title = '💬 守卫队队长 · 初识'
      body = `<div class="camp-character"><i>🛡️</i><div><b>“你就是那个总在营地里晃悠的旅人？”</b><p>他上下打量你几眼：“别给我惹麻烦，记住了。”</p></div></div>`
    } else {
      let pool = CAPTAIN_CHATS
      if (state._captainLastChat !== undefined && CAPTAIN_CHATS[state._captainLastChat]) {
        pool = CAPTAIN_CHATS.filter((_, i) => i !== state._captainLastChat)
      }
      const idx = Math.floor(Math.random() * pool.length)
      const pick = pool[idx]
      state._captainLastChat = CAPTAIN_CHATS.indexOf(pick)
      title = pick.title
      body = pick.body
    }
    EventBus.emit('state:changed', state)
    campShow({
      title, className: 'camp-tavern-modal', body,
      actions: [
        { label: '再聊两句', handler: () => { captainChat() } },
        { kind: 'navigation', label: '返回队长', handler: () => { tavernCaptain() } },
      ],
    })
  }

  /** 队长处购买妓女许可证 */
  function captainBuyLicense () {
    const state = State.get()
    if (state._prostituteLicensed) { EventBus.emit('ui:log', { text: '🛡️ 你已经办过证了。', type: 'dim' }); tavernCaptain(); return }
    campShow({
      title: '📜 守卫队队长 · 办证', className: 'tavern-work-modal',
      body: `<section class="scene-dialogue"><i>📜</i><div><h3>队长从抽屉里取出一张盖好印章的许可证。</h3><p>“二百金币。名字写上去，这张证以后就是你的。”</p></div></section>
        <p class="scene-wallet">钱袋 · <b>${state.gold}G</b>　办证 · <b>200G</b></p>`,
      actions: [
        { label: state.gold >= 200 ? `💸 花 200G 买许可证` : '💰 钱不够（200G）', cls: state.gold >= 200 ? 'btn-primary' : 'btn-danger', handler: () => {
          if (state.gold < 200) { EventBus.emit('ui:log', { text: '💰 钱不够买许可证。', type: 'dim' }); captainBuyLicense(); return }
          state.gold -= 200
          state._prostituteLicensed = true
          state._prostituteBoughtFromCaptain = true
          EventBus.emit('ui:log', { text: '🛡️ 队长把妓女许可证拍在桌上，你收好了。', type: 'good' })
          EventBus.emit('state:changed', state)
          Dialog.close(); tavernCaptain()
        } },
        { kind: 'navigation', label: '返回队长', handler: () => { Dialog.close(); tavernCaptain() } },
      ],
    })
  }

  /** 队长处取消妓女许可证：按妓女等级分不同结局 */
  function captainCancelLicense () {
    const state = State.get()
    if (!state._prostituteLicensed) { EventBus.emit('ui:log', { text: '🛡️ 你还没办证呢。', type: 'dim' }); tavernCaptain(); return }
    const lv = state._prostituteLevel

    if (lv >= 100) {
      // 头牌妓畜：操一顿 + 扔荣耀洞罚金 200 + 30 入场费（欠债）
      campShow({
        title: '🛡️ 守卫队队长 · 撤销许可', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“头牌妓畜？呵，你这种货色想退行，问过我的老二没有。”</b><p>队长冷笑一声，把你按倒在桌上：“想退？先把这顿操给我挨完！”</p></div></div>`,
        actions: [
          { label: '🚫 被队长操一顿', cls: 'btn-danger', handler: () => { Dialog.close(); captainPunishFuck(lv) } },
          { kind: 'navigation', label: '溜走（不取消）', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
    } else if (lv >= 70) {
      // 职业妓女：拒绝申请 + 操一顿
      campShow({
        title: '🛡️ 守卫队队长 · 撤销许可', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“职业妓女？你这种等级，还想金盆洗手？”</b><p>队长嗤笑一声：“证不能退，屁股得先给我用一用。”</p></div></div>`,
        actions: [
          { label: '🚫 被队长操一顿', cls: 'btn-danger', handler: () => { Dialog.close(); captainPunishFuck(lv) } },
          { kind: 'navigation', label: '算了，不取消了', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
    } else if (lv >= 30) {
      // 顺从的妓女：1000G 可退
      campShow({
        title: '🛡️ 守卫队队长 · 撤销许可', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“顺从的妓女，想把证退了？”</b><p>队长翘着二郎腿：“行，拿 <b>1000G</b> 来，我把你的名字从册子上划掉。”</p></div></div>`,
        actions: [
          { label: state.gold >= 1000 ? '💸 花 1000G 退证' : '💰 钱不够（1000G）', cls: state.gold >= 1000 ? 'btn-primary' : 'btn-danger', handler: () => {
            if (state.gold < 1000) { EventBus.emit('ui:log', { text: '💰 钱不够退证。', type: 'dim' }); captainCancelLicense(); return }
            state.gold -= 1000
            doRevokeLicense()
            EventBus.emit('ui:log', { text: '📜 你花 1000G 退掉了妓女许可证，名字从册子上划掉了。', type: 'good' })
            EventBus.emit('state:changed', state)
            Dialog.close(); tavernCaptain()
          } },
          { kind: 'navigation', label: '返回队长', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
    } else if (lv >= 10) {
      // 新手妓女：500G 可退
      campShow({
        title: '🛡️ 守卫队队长 · 撤销许可', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“新手妓女，想退行？”</b><p>队长挑眉：“入行容易退行难，拿 <b>500G</b> 来，我把你的号销了。”</p></div></div>`,
        actions: [
          { label: state.gold >= 500 ? '💸 花 500G 退证' : '💰 钱不够（500G）', cls: state.gold >= 500 ? 'btn-primary' : 'btn-danger', handler: () => {
            if (state.gold < 500) { EventBus.emit('ui:log', { text: '💰 钱不够退证。', type: 'dim' }); captainCancelLicense(); return }
            state.gold -= 500
            doRevokeLicense()
            EventBus.emit('ui:log', { text: '📜 你花 500G 退掉了妓女许可证，名字从册子上划掉了。', type: 'good' })
            EventBus.emit('state:changed', state)
            Dialog.close(); tavernCaptain()
          } },
          { kind: 'navigation', label: '返回队长', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
    } else {
      // 雏妓（<10）：免费可退
      campShow({
        title: '🛡️ 守卫队队长 · 撤销许可', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“刚入行就想退？也行。”</b><p>队长摇摇头：“雏妓一个，还没干出啥名堂，我就当没发过这张证。”</p></div></div>`,
        actions: [
          { label: '📜 退掉许可证', cls: 'btn-primary', handler: () => {
            doRevokeLicense()
            EventBus.emit('ui:log', { text: '📜 队长收回你的妓女许可证，你退行了。', type: 'good' })
            EventBus.emit('state:changed', state)
            Dialog.close(); tavernCaptain()
          } },
          { kind: 'navigation', label: '返回队长', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
    }
  }

  /** 职业妓女及以上：被队长操一顿（计时任务） */
  async function captainPunishFuck (lv) {
    const state = State.get()
    const isPerfect = lv >= 100
    EventBus.emit('ui:log', { text: '🚫 队长把你按在桌上，掏出了他那根又粗又长的家伙。', type: 'danger' })
    const oralRoute = routeTownService('oral')
    const analRoute = routeTownService('anal')
    if (oralRoute.mode === 'unavailable' || analRoute.mode === 'unavailable') {
      EventBus.emit('ui:log', { text: '🔒 妖缚装备封死了所有可用部位，惩罚无法进行，但队长仍拒绝撤销许可证。', type: 'danger' })
      tavernCaptain()
      return
    }
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const steps = isPerfect
        ? [
            { desc: townServiceDesc(oralRoute.part, '队长'), bpm: oralRoute.part === 'oral' ? 0 : 90, seconds: 30 },
            { desc: townServiceDesc(analRoute.part, '队长'), bpm: analRoute.part === 'oral' ? 0 : 90, seconds: 60 },
            { desc: '队长把滚烫的浓精射在你后背上，拍拍你的屁股', bpm: 0, seconds: 0 },
          ]
        : [
            { desc: townServiceDesc(oralRoute.part, '队长'), bpm: oralRoute.part === 'oral' ? 0 : 90, seconds: 30 },
            { desc: townServiceDesc(analRoute.part, '队长'), bpm: analRoute.part === 'oral' ? 0 : 90, seconds: 60 },
          ]
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const f = await BattleUI.showTaskDialog({
          enemyName: `🛡️ 守卫队队长（第 ${i + 1}/${steps.length} 段）`,
          attackName: step.desc,
          desc: step.desc,
          bpm: step.bpm || 0,
          seconds: step.seconds || 0,
          dmg: 0,
          noDamage: true,
          dildoName: '队长的粗鸡巴',
        })
        if (f) { failed = true; break }
      }
    } else {
      failed = !confirm(`被队长操一顿：完成表示挨完了。`)
    }
    if (failed) {
      EventBus.emit('ui:log', { text: '🏃 你中途溜了，队长骂骂咧咧地放你走了。', type: 'dim' })
      EventBus.emit('state:changed', state); tavernCaptain(); return
    }
    EventBus.emit('ui:log', { text: '🚫 你被队长操得腿软，趴在地上喘气。', type: 'danger' })
    if (isPerfect) {
      // 头牌妓畜：罚金 200 + 30 入场费，丢荣耀洞（队长标记，出城时队长羞辱）
      TownGlorySystem.addDebt({ amount: 200, source: 'captain', reason: '守卫队长处罚', includeEntryFee: true, openWork: true })
    } else {
      // 职业妓女：被操完后羞辱辱骂，明确不给注销
      EventBus.emit('ui:log', { text: '🛡️ 队长提上裤子："证不能退，下次再敢提，还操你。"', type: 'dim' })
      campShow({
        title: '🛡️ 守卫队队长 · 羞辱', className: 'camp-tavern-modal',
        body: `<div class="camp-character"><i>🛡️</i><div><b>“还想退行？哼，你这种货色，除了被操还能干什么。”</b><p>队长居高临下地看着你：“你当职业妓女当出了名，你以为这证是你想退就能退的？”<br><br>他凑近你的脸，声音里全是轻蔑：“册子上你的名字，老子给你写得死死的。想注销？做梦。下次再来提，我还操你一顿，操到你服为止。”</p></div></div>
          <p class="scene-status-line is-risk"><span>登记册没有更改</span><b>许可证仍有效</b></p>`,
        actions: [
          { label: '被羞辱得无地自容', cls: 'btn-danger', handler: () => { Dialog.close(); tavernCaptain() } },
        ],
      })
      EventBus.emit('state:changed', state)
    }
  }

  /** 头牌妓畜从荣耀洞出来：队长羞辱——下跪磕头、选羞辱话、口交一次，仍不退证 */
  function captainGloryHumiliation () {
    const state = State.get()
    const humiliate = () => {
      campShow({
        title: '🛡️ 守卫队队长 · 羞辱', className: 'glory-modal',
        body: `<div class="glory-section"><h3><span>“哟，头牌妓畜从洞里爬出来了？”</span><small>队长翘着二郎腿，居高临下地看着你</small></h3>
          <p class="camp-muted">“想退证？行啊——先跪下给老子磕三个头，再说两句能让我高兴的话。不然，你今天就别想出这个门。”</p></div>`,
        actions: [
          { label: '🧎 跪下磕头', cls: 'btn-danger', handler: () => {
            Dialog.close()
            EventBus.emit('ui:log', { text: '🧎 你双膝一软跪在队长面前，磕了三个响头。', type: 'danger' })
            pickInsult()
          } },
        ],
      })
    }
    const pickInsult = () => {
      const insults = [
        '「队长大人，我是您养的母畜，一辈子都是您的肉便器。」',
        '「我就是条贱母狗，活该被您操，还请队长大人饶了我。」',
        '「我是您最听话的畜牲，随时供您泄欲，求您高抬贵手。」',
      ]
      campShow({
        title: '🛡️ 守卫队队长 · 羞辱', className: 'glory-modal',
        body: `<div class="glory-section"><h3><span>“磕完了？说吧，怎么求我。”</span><small>队长把靴子踩在你面前，等你开口</small></h3>
          <p class="camp-muted">选一句羞辱自己的话，说给他听。</p></div>`,
        actions: insults.map(txt => ({
          label: txt, cls: 'btn-danger',
          handler: () => {
            Dialog.close()
            EventBus.emit('ui:log', { text: `🗣️ 你跪着说：${txt}`, type: 'danger' })
            suckTask()
          },
        })),
      })
    }
    const suckTask = async () => {
      const route = routeTownService('oral')
      if (route.mode === 'unavailable') {
        EventBus.emit('ui:log', { text: '🔒 所有可用部位都被锁死，队长无法继续这段羞辱，只能作罢。', type: 'dim' })
        finalRefuse()
        return
      }
      let failed = false
      if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
        const f = await BattleUI.showTaskDialog({
          enemyName: '🛡️ 守卫队队长',
          attackName: route.part === 'oral' ? '跪着口交' : '强制服务',
          desc: townServiceDesc(route.part, '队长'),
          bpm: route.part === 'oral' ? 0 : 90,
          seconds: 30,
          dmg: 0,
          noDamage: true,
          dildoName: '队长那根粗壮的鸡巴',
        })
        failed = f
      } else {
        failed = !confirm('给队长口交 30 秒（完成代表含到底）。')
      }
      EventBus.emit('ui:log', { text: failed ? '🛡️ 你服务到一半，队长嫌你不够卖力，但还是放过了你。' : '🛡️ 你伺候完队长，他满意地收回了脚。', type: 'dim' })
      finalRefuse()
    }
    const finalRefuse = () => {
      campShow({
        title: '🛡️ 守卫队队长 · 结果', className: 'glory-modal',
        body: `<div class="glory-section"><h3><span>“行了，磕也磕了，骚话也说了。”</span><small>队长提起裤子，慢条斯理地系腰带</small></h3>
          <p class="camp-muted">“但是——证还是不能退。”<br><br>他拍拍你的脸：“你这头牌妓畜的名号，可是老子一手捧起来的。退证？你死了这条心吧。老老实实当你的头牌，爷高兴了少操你两顿。”</p></div>`,
        actions: [
          { label: '接受现实，回营地', cls: 'btn-danger', handler: () => { Dialog.close(); openCamp() } },
        ],
      })
    }
    humiliate()
  }

  /** 真正撤销许可证 */
  function doRevokeLicense () {
    const state = State.get()
    state._prostituteLicensed = false
    state._prostituteDressed = false
    state._prostituteBoughtFromCaptain = false
  }

  /** 酒馆老板娘：卖酒 + 聊天（含打工话题）+ 打工 */

  return {
    open: tavernCaptain,
    showGloryHumiliation: captainGloryHumiliation,
  }
})()
