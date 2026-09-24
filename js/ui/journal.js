/**
 * ui/journal.js — 任务札记与背包
 *
 * 两个面板只整理已有状态，不另存一份任务或物品数据。
 */
window.AdventureMenu = (function () {
  const ITEM_ICONS = {
    ale: '🍺', antidote: '🧪', bandaid: '🩹', barrier_spell: '🔮', green_herb: '🌿',
    orb_of_power: '🔵', awakening: '☀️', special_cream: '🧴', weapon_upgrade_material: '⚒️',
    mutant_crystal: '💠', raven_latch: '🏷️', twig: '🌿', guard_pass: '📜', restraint_lock: '🔒',
    restraint_key: '🔑', master_key: '🗝️', lockpick: '🪛', curse_remover: '✦',
    petty_soul_gem: '💠', lesser_soul_gem: '🔹', common_soul_gem: '💎',
    sharp_rock: '🪨', rusty_knife: '🗡️', basic_sword: '⚔️', master_sword: '✨',
    sacrificial_necklace: '📿', health_bracelet: '💚', ring_of_love: '💍', seal_of_resilience: '🛡️',
  }

  function escapeHtml (value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch])
  }

  function taskEntries (state) {
    const tasks = []
    tasks.push(state.bossDefeated
      ? { icon: '🌲', group: '主线', name: '穿越妖林', detail: '森林之灵已经倒下。你终于找到了旅途的尽头。', status: '已完成', tone: 'complete', progress: 1, required: 1 }
      : { icon: '🌲', group: '主线', name: '穿越妖林', detail: '深入迷雾，找到被森林掳走的爱人，并击败森林尽头的主人。', status: '追踪中', tone: 'main' })

    const stage = state._wrongCommissionStage || 0
    const leads = state._wrongCommissionLeads || {}
    const pStage = state._pMainlineStage || 0
    const prologueGroup = '欲缚镇 · 序章'
    if (stage === 1) {
      tasks.push({ icon: '✉️', group: prologueGroup, name: '错投的货单', detail: '陌生信使把一封署名派克的货单错交给了你。', status: '拆开信封', tone: 'clue', action: 'letter' })
    } else if (stage === 2) {
      tasks.push({ icon: '🌉', group: prologueGroup, name: '派克的货单', detail: '货单要求两批约束器具经旧桥送进雾灯镇。先去桥上核对车队留下的痕迹。', status: '前往旧桥', tone: 'clue', progress: 0, required: 4, action: 'letter' })
    } else if (stage === 3) {
      const found = Number(!!leads.barkeep) + Number(!!leads.blacksmith)
      const remaining = [!leads.barkeep && '雾灯酒馆', !leads.blacksmith && '铁匠铺'].filter(Boolean).join('、')
      tasks.push({ icon: '✉️', group: prologueGroup, name: '追查收货人', detail: `旧桥证实货物已经进镇。去${remaining || '镇里'}查清是谁签收了约束器具。`, status: `${found}/2 名收货人`, tone: 'clue', progress: 1 + found, required: 4, action: 'letter' })
    } else if (stage === 4) {
      tasks.push({ icon: '🌉', group: prologueGroup, name: '遗失的运输许可', detail: '酒馆与铁匠都提到车夫在旧桥遗失了一只许可皮卷。车队的人也可能回来寻找它。', status: '返回旧桥', tone: 'clue', progress: 3, required: 4, action: 'letter' })
    } else if (stage === 5) {
      tasks.push({ icon: '🛞', group: prologueGroup, name: '桥下的车辙', detail: state._pBridgePermitAcquired
        ? '许可背面留下了启用新规的命令；桥栏外还有血迹和蓝布，继续调查旧桥下方。'
        : '你没有抢到许可，但押送过程证明车队受雾灯镇庇护。按贝拉米的命令返回旧桥寻找失踪车辆。', status: state._pBridgePermitAcquired ? '沿桥墩下去' : '返回旧桥', tone: 'danger', progress: 4, required: 9, action: 'letter' })
    } else if (stage === 6) {
      const defeats = Math.max(0, Number(state._pBanditDefeatCount) || 0)
      tasks.push({ icon: '🌉', group: prologueGroup, name: '桥洞据点的活口', detail: defeats
        ? `车队记账员仍被关在桥洞。你已经在这里失败 ${defeats} 次；可以再打、付钱，或尝试空手换人。`
        : '车队在桥下遭到洗劫，一名记账员被强盗带进封死的桥洞。击倒头目并救出她。', status: defeats ? `战败 ${defeats} 次` : '进入旧桥下方', tone: 'danger', progress: 5, required: 9, action: 'letter' })
    } else if (stage === 7) {
      tasks.push({ icon: '🕯️', group: prologueGroup, name: '活着的证人', detail: state._pBanditWitnessBegged
        ? `蕾娜是用钱从强盗手里换回来的。${state._pBanditBridgeToll ? '你还欠桥洞 1200G，路过旧桥仍要交路费。' : ''}`
        : '获救的记账员蕾娜带着半张合作名单。护送她去镇务厅作证。', status: '前往镇务厅', tone: 'main', progress: 6, required: 9, action: 'letter' })
    } else if (stage === 8) {
      const inquiry = state._pTownInquiry || {}
      const found = Number(!!inquiry.guard) + Number(!!inquiry.merchant) + Number(!!inquiry.citizen)
      tasks.push({ icon: '🔎', group: prologueGroup, name: '镇内的三份口供', detail: '镇长要求你分别核对城门记录、商会账本和居民传闻。', status: `${found}/3 份口供`, tone: 'clue', progress: 6 + found, required: 9, action: 'letter' })
    } else if (stage === 9) {
      tasks.push({ icon: '⚖️', group: prologueGroup, name: '向镇长复命', detail: '证人、许可与三方口供全部指向镇务厅。要求镇长正面回答。', status: '返回镇务厅', tone: 'danger', progress: 9, required: 10, action: 'letter' })
    } else if (stage >= 10) {
      tasks.push(pStage <= 1
        ? { icon: '⚖️', group: prologueGroup, name: '城门换岗', detail: state._wrongCommissionCaptured ? '车队把你带到了两名新监督官面前。旧桥上的选择会影响他们如何看待你。' : '贝拉米和墨菲已在城门执行新制度。前往城门，决定自己以什么身份进入欲缚镇。', status: '选择身份', tone: 'danger', progress: 9, required: 10, action: 'letter' }
        : { icon: '⚖️', group: prologueGroup, name: '身份已定', detail: '你完成了旧桥调查与城门登记，并选择了自己在欲缚镇中的身份。', status: '序章完成', tone: 'complete', progress: 10, required: 10, action: 'letter' })
    }

    const pRole = state._pRole
    if (pRole === 'slave' && state._pChapterOneLocked && !state._pMChapterCompleted) {
      const mStage = state._pMChapterStage || 0
      const escorting = state._pMEscort && state._pMEscort.started && !state._pMEscort.completed
      const labels = { 0: '前往收容笼', 500: '醒来验号', 1000: '指定监管者', 1500: '初次服从测试', 2000: '口部验收', 2500: escorting ? `穿过街道 · ${Math.min(9, (state._pMEscort.position || 0) + 1)}/9` : '完成最后一轮验收', 3000: '初见派克', 3500: '返回城门岗哨', 4000: '押送戴蒙德', 9500: '第二次见派克' }
      tasks.push({ icon: escorting ? '🏙️' : '⛓️', group: '欲缚镇', name: escorting ? '奴隶线·第一章：街道押送' : '奴隶线·第一章', detail: escorting ? '沿九格街道前往会馆；完成当前遭遇后才能继续。' : '完成第一章的登记、接管、押送与派克验收。基础奴隶训练尚未开始。', status: labels[mStage] || '继续第一章', tone: 'danger' })
    } else if (pRole === 'slave' && state._pMChapterCompleted) {
      tasks.push({ icon: '⛓️', group: '欲缚镇', name: '奴隶线·第一章', detail: '你已取得第一册记录。下一任务是寻找伊凡娜；基础奴隶训练尚未开始。', status: '第一章完成', tone: 'complete', progress: 1, required: 1 })
    } else if (pRole === 'free' && pStage >= 2) {
      tasks.push({ icon: '◇', group: prologueGroup, name: '自由身路线已登记', detail: '《欲缚镇 · 序章》已经完成。自由身第一章尚在制作中。', status: '等待后续版本', tone: 'complete', progress: 10, required: 10 })
    }

    const restraint = state._restraintContract
    if (restraint) {
      tasks.push({ icon: restraint.ready ? '🏅' : '⛓️', group: '妖缚委托', name: restraint.name || '未命名委托', detail: restraint.ready ? '目标已经达成，回雾灯酒馆领取报酬。' : `保持契约装备完整，赢得 ${restraint.required} 场普通战斗。`, status: restraint.ready ? '可领奖' : `${restraint.progress}/${restraint.required}`, tone: restraint.ready ? 'complete' : 'contract', progress: restraint.progress, required: restraint.required })
    }

    const mercData = state._mercenaryContract || {}
    const mercTask = mercData.active
    if (mercTask) {
      const unit = mercTask.type === 'income' ? 'G' : ''
      tasks.push({ icon: '⚔️', group: '佣兵契约', name: mercTask.name || '芙蕾雅的契约', detail: mercTask.type === 'battle' ? '按约定完成普通战斗，契约装备必须保持完整。' : mercTask.type === 'income' ? '新获得收入的一部分会自动用于偿债。' : '履行与芙蕾雅约定的服务。', status: `${mercTask.progress}/${mercTask.required}${unit}`, tone: 'contract', progress: mercTask.progress, required: mercTask.required })
    } else if ((mercData.debt || 0) > 0) {
      tasks.push({ icon: '💸', group: '佣兵契约', name: '偿还芙蕾雅', detail: '回酒馆找芙蕾雅处理欠款，也可以通过抵债契约降低债务。', status: `欠 ${mercData.debt}G`, tone: 'danger' })
    }

    if (state._inPrison) tasks.push({ icon: '⛓️', group: '强制任务', name: '服刑', detail: state._prisonLife ? '越狱机会已经耗尽。继续完成牢房安排的工作。' : '完成牢房工作积攒释放点数，或寻找逃离监狱的机会。', status: `${state._prisonPoints || 0}/300`, tone: 'danger', progress: state._prisonPoints || 0, required: 300 })
    if (state._pillory) tasks.push({ icon: '🪵', group: '进行中', name: '广场木枷', detail: '木枷展示尚未结算，回到营地会继续当前阶段。', status: '未结束', tone: 'danger' })
    if ((state._gloryDebt || 0) > 0 || state._gloryFreeService) tasks.push({ icon: '🚻', group: '欠账', name: '荣耀洞债务', detail: '在离开雾灯镇前，必须回公共厕所结清这笔账。', status: state._gloryDebt ? `${state._gloryDebt}G` : '追加服务', tone: 'danger' })
    if ((state._prostituteDebt || 0) > 0) tasks.push({ icon: '🍷', group: '欠账', name: '酒馆打工欠款', detail: '回酒馆老板娘处继续接客，完成尚未结清的工作。', status: `${state._prostituteDebt}G`, tone: 'danger' })
    if ((state._pCaravanDebt || 0) > 0) tasks.push({ icon: '🛻', group: '欠账', name: '派克车队欠条', detail: '旧桥看守在强制搜身时记下的账。派克的商团已经知道你的名字，之后会向你追讨。', status: `${state._pCaravanDebt}G`, tone: 'danger' })
    if ((state._pBanditRansomDebt || 0) > 0) tasks.push({ icon: '🌉', group: '欠账', name: '桥洞赎金', detail: state._pBanditBridgeToll ? '你欠强盗头目 1200G。还清之前，每次路过旧桥都要口交、深喉、肛交和性交各一次。' : '桥洞赎金尚未结清。', status: `${state._pBanditRansomDebt}G`, tone: 'danger' })
    return tasks
  }

  function activeTaskCount () {
    const state = State.get()
    if (!state) return 0
    return taskEntries(state).filter(task => task.tone !== 'complete').length
  }

  function openTasks () {
    const state = State.get()
    if (!state) return
    const tasks = taskEntries(state)
    const cards = tasks.map((task, index) => {
      const pct = task.required ? Math.max(0, Math.min(100, Math.round((task.progress || 0) / task.required * 100))) : null
      const tag = task.action ? 'button' : 'article'
      const actionAttr = task.action ? ` data-quest-action="${task.action}" type="button"` : ''
      return `<${tag} class="quest-entry is-${task.tone || 'main'}${index === 0 ? ' is-tracked' : ''}${task.action ? ' is-action' : ''}"${actionAttr}>
        <i aria-hidden="true">${task.icon}</i><div><small>${escapeHtml(task.group)}</small><h3>${escapeHtml(task.name)}</h3><p>${escapeHtml(task.detail)}</p>
        ${pct == null ? '' : `<span class="quest-progress"><em style="width:${pct}%"></em></span>`}</div><strong>${escapeHtml(task.status)}</strong>
      </${tag}>`
    }).join('')
    Dialog.show({
      title: '📜 旅人札记', className: 'inventory-modal adventure-menu-modal quest-journal-modal',
      body: `<section class="journal-heading"><i>✦</i><div><small>当前旅程</small><h3>${state.bossDefeated ? '余烬之后' : '雾中的道路'}</h3><p>${activeTaskCount()} 项仍在影响你的旅途</p></div></section><div class="quest-list">${cards}</div>`,
      actions: [{ kind: 'navigation', label: '合上札记', handler: () => Dialog.close() }],
    })
    document.querySelectorAll('[data-quest-action="letter"]').forEach(btn => {
      btn.onclick = () => openWrongCommissionLetter(openTasks)
    })
  }

  function openWrongCommissionLetter (returnTo) {
    const state = State.get()
    if (!state || (state._wrongCommissionStage || 0) <= 0) return
    if ((state._wrongCommissionStage || 0) < 2) {
      Dialog.show({
        title: '✉️ 塞错的信', className: 'inventory-modal adventure-menu-modal wrong-letter-modal',
        body: `<section class="wrong-letter-pocket"><i aria-hidden="true">✉️</i><div><p>信封在行囊里压出一道硬折。正面的名字仍不是你，封口只压着一个很深的字母。</p><small>没有家徽，也没有商会印记：只有派克。</small></div></section>`,
        actions: [
          { kind: 'navigation', label: '暂时收好', handler: returnTo },
          { label: '拆开信封', cls: 'btn-primary', handler: () => {
            state._wrongCommissionStage = 2
            EventBus.emit('ui:log', { text: '📜 货单要求把两批约束器具经旧桥送往酒馆与铁匠铺。', type: 'warning' })
            EventBus.emit('state:changed', state)
            State.save()
            openWrongCommissionLetter(returnTo)
          } },
        ],
      })
      return
    }
    Dialog.show({
      title: '✉️派克的货单', className: 'inventory-modal adventure-menu-modal wrong-letter-modal',
      body: `<section class="wrong-letter-paper" aria-label="错投的委托信">
          <p>北路搬运人：</p>
          <p>货物已经装车。第一批约束器具留在雾灯酒馆后门，第二批锁具交给镇上的铁匠改装。空车从旧桥返回。</p>
          <p>款项已经收齐。不要拆封，不要耽误交付。失败不在约定之内。</p>
          <footer>——派克</footer>
        </section><p class="wrong-letter-after">${PrologueSystem.letterAfterText(state)}</p>`,
      actions: [{ kind: 'navigation', label: '收起信件', handler: returnTo }],
    })
  }

  function itemCanUse (item, state) {
    if (!item || !item.effect || state.phase === 'battle' || state.phase === 'boss' || state.phase === 'shop') return false
    if (item.effect.special === 'soul_charge') return true
    if (!(item.effect.heal || item.effect.cure || item.effect.regen)) return false
    if (item.effect.heal && state.hp >= state.maxHp && !item.effect.cure && !item.effect.regen) return false
    return true
  }

  function equipmentCards (state) {
    const owned = state.ownedEquipment || []
    if (!owned.length) return '<p class="inventory-empty">武器架和饰品袋都是空的。</p>'
    return owned.map(id => {
      const item = ItemLib.get(id)
      if (!item) return ''
      const worn = item.type === 'weapon' ? state.inventory.weapon === id : (state.inventory.accessories || []).includes(id)
      return `<div class="pack-item is-gear${worn ? ' is-equipped' : ''}"><i>${ITEM_ICONS[id] || '◆'}</i><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.desc || '')}</small></span><em>${worn ? '装备中' : '已收纳'}</em></div>`
    }).join('')
  }

  function openInventory () {
    const state = State.get()
    if (!state) return
    const entries = Object.entries(state.inventory.consumables || {}).filter(([, count]) => count > 0)
    const total = entries.reduce((sum, [, count]) => sum + count, 0)
    const items = entries.length ? entries.map(([id, count]) => {
      const item = ItemLib.get(id)
      const name = item ? item.name : id
      const desc = item ? item.desc : '来历不明的物品'
      const usable = itemCanUse(item, state)
      return `<div class="pack-item${usable ? ' is-usable' : ''}"><i>${ITEM_ICONS[id] || '◆'}</i><span><b>${escapeHtml(name)}</b><small>${escapeHtml(desc)}</small></span><em>×${count}</em>${usable ? `<button data-pack-use="${escapeHtml(id)}">使用</button>` : ''}</div>`
    }).join('') : '<p class="inventory-empty">袋底只剩下一点森林里的灰。</p>'
    const storyItems = [
      state._wrongCommissionStage > 0 ? `<div class="pack-item is-story"><i>✉️</i><span><b>派克的货单</b><small>${state._wrongCommissionStage < 2 ? '错投到你手里的信，封口只压着字母派克。' : state._wrongCommissionStage >= 10 ? '货单、名单和口供共同证明镇长早已批准派克的计划。' : state._wrongCommissionStage >= 5 ? (state._pBridgePermitAcquired ? '许可、失事车队和活口把线索指向镇务厅。' : '押送记录、失事车队和活口把线索指向镇务厅。') : '信中要求两批货物经旧桥送往酒馆和铁匠铺。'}</small></span><em>${state._wrongCommissionStage < 2 ? '未拆' : state._wrongCommissionStage >= 10 ? '已查明' : '任务物品'}</em><button data-story-letter>${state._wrongCommissionStage < 2 ? '拆开' : '阅读'}</button></div>` : '',
      state._prostituteLicensed ? '<div class="pack-item is-story"><i>📜</i><span><b>妓院许可证</b><small>雾灯镇认可的营业凭据。</small></span><em>凭证</em></div>' : '',
    ].filter(Boolean).join('') || '<p class="inventory-empty">目前没有值得单独收好的剧情物件。</p>'

    Dialog.show({
      title: '🎒 旅人背包', className: 'inventory-modal adventure-menu-modal backpack-modal',
      body: `<section class="pack-heading"><i>🎒</i><div><small>随身行囊</small><h3>${total} 件补给</h3><p>金币 ${state.gold}G · 生命 ${state.hp}/${state.maxHp}</p></div></section>
        <section class="pack-section"><h4><span>补给与材料</span><small>${entries.length} 种</small></h4><div class="pack-list">${items}</div></section>
        <details class="pack-section pack-fold"><summary><span>武器与饰品</span><small>${(state.ownedEquipment || []).length} 件</small></summary><div class="pack-list">${equipmentCards(state)}</div></details>
        <details class="pack-section pack-fold"><summary><span>信件与凭证</span><small>重要物品</small></summary><div class="pack-list">${storyItems}</div></details>`,
      actions: [{ kind: 'navigation', label: '收起背包', handler: () => Dialog.close() }],
    })
    document.querySelectorAll('[data-pack-use]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.packUse
        if (ShopSystem.isSoulGem(id)) {
          ShopSystem.openSoulGemCharge(id, openInventory, openInventory)
          return
        }
        const result = ShopSystem.useConsumable(id)
        if (!result.ok) EventBus.emit('ui:log', { text: result.msg, type: 'danger' })
        openInventory()
      }
    })
    document.querySelectorAll('[data-story-letter]').forEach(btn => {
      btn.onclick = () => openWrongCommissionLetter(openInventory)
    })
  }

  function bind () {
    const taskBtn = document.getElementById('btn-topbar-quests')
    const packBtn = document.getElementById('btn-topbar-inventory')
    if (taskBtn) taskBtn.onclick = openTasks
    if (packBtn) packBtn.onclick = openInventory
  }

  return { bind, openTasks, openInventory, activeTaskCount }
})()
