/** main-settings.js — 顶栏、存档设置与调试工具。 */
window.AppSettings = (function () {
  let hooks = {}
  const DEBUG_ENABLED = !!(CONFIG.debug && CONFIG.debug.enabled) || ['localhost', '127.0.0.1'].includes(location.hostname)
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[ch])
  const diffName = d => ({ normal: '普通', hard: '困难', brutal: '残酷' }[d] || d)
  function bindTopbar () {
    const saveBtn = document.getElementById('btn-topbar-save')
    const settingsBtn = document.getElementById('btn-topbar-settings')
    if (saveBtn) saveBtn.onclick = () => {
      if (!State.get()) return
      const hint = document.getElementById('topbar-save-hint')
      if (State.save()) {
        EventBus.emit('ui:log', { text: '💾 已存档', type: 'good' })
        if (hint) { hint.textContent = '已保存 ✓'; setTimeout(() => { hint.textContent = '' }, 1500) }
      } else if (hint) {
        hint.textContent = '保存失败'
      }
    }
    if (settingsBtn) settingsBtn.onclick = () => {
      const activeDialog = Dialog.getCurrent ? Dialog.getCurrent() : null
      const classes = String(activeDialog && activeDialog.className || '')
      const villageDialog = /(^|\s)boss-(gate|intro|ending)-modal(\s|$)/.test(classes) ? activeDialog : null
      showSettingsMenu(villageDialog)
    }
  }

  /** 设置菜单 */
  function showSettingsMenu (resumeDialog = null) {
    if (!State.get()) {
      Dialog.showRules()
      return
    }
    const state = State.get()
    const villageMode = !!resumeDialog
    const closeSettings = () => {
      Dialog.close()
      if (resumeDialog) Dialog.show(resumeDialog)
    }
    const cheatButton = DEBUG_ENABLED
      ? '<button class="btn btn-cheat" id="set-cheat" style="grid-column:1/-1">🎮 作弊 / 调试</button>'
      : ''
    Dialog.show({
      title: '⚙️ 设置',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="background:var(--panel-2);border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="font-size:.8rem;color:var(--text-dim)">玩家</div>
            <b>${escapeHtml(state.playerName || '妖林勇者')}</b> <span style="color:var(--accent-bright);font-size:.8rem">(${escapeHtml(state.genderLabel || (state.gender === 'male' ? '男性' : '女性'))} · ${escapeHtml(diffName(state.difficulty))})</span>
          </div>
          ${villageMode ? '<p class="settings-village-note">🏘️ 村庄中可安全保存或删除存档；关闭设置后会返回刚才的页面。</p>' : ''}
          <div class="settings-grid">
            <button class="btn" id="set-save">💾 立即存档</button>
            <button class="btn" id="set-export">⬇️ 导出存档</button>
            ${villageMode ? '' : `
            <button class="btn" id="set-load">📂 读取存档</button>
            <button class="btn" id="set-import">⬆️ 导入存档</button>
            <button class="btn" id="set-rules">📖 游戏规则</button>
            <button class="btn" id="set-changelog">✨ 更新日志</button>
            <button class="btn" id="set-privacy">🛡️ 隐私说明</button>`}
            <button class="btn" id="set-records">🏆 成就与记录${window.StatsSystem && StatsSystem.pendingCount() ? ` (${StatsSystem.pendingCount()})` : ''}</button>
            <button class="btn" id="set-menu">🏠 主菜单</button>
            ${villageMode ? '' : cheatButton}
            <button class="btn btn-danger" id="set-delete" style="grid-column:1/-1">🗑️ 删除存档</button>
          </div>
          <p class="settings-save-note">进度会在操作后自动保存；换设备或清理浏览器前，请先导出存档文件。</p>
        </div>
      `,
      actions: [{ label: villageMode ? '返回村庄' : '关闭', handler: closeSettings }],
    })
    Dialog.onMount(root => {
      const bind = (id, fn) => { const el = root.querySelector(`#${id}`); if (el) el.onclick = fn }
      bind('set-save', () => {
        if (State.save()) {
          EventBus.emit('ui:log', { text: '💾 已存档', type: 'good' })
          closeSettings()
        } else {
          alert('保存失败，请尝试导出存档并检查浏览器存储权限。')
        }
      })
      bind('set-load', () => {
        if (!State.hasSave()) { alert('没有存档'); return }
        Dialog.close()
        hooks.loadGame()
      })
      bind('set-export', () => {
        State.flushAutoSave()
        State.save()
        const data = State.exportSave()
        if (!data) { alert('当前没有可导出的存档'); return }
        const blobUrl = URL.createObjectURL(new Blob([data], { type: 'application/json;charset=utf-8' }))
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = `妖林绮梦-存档-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      })
      bind('set-import', () => {
        const picker = document.createElement('input')
        picker.type = 'file'
        picker.accept = '.json,application/json'
        picker.onchange = async () => {
          const file = picker.files && picker.files[0]
          if (!file) return
          try {
            State.importSave(await file.text())
            Dialog.close()
            hooks.loadGame()
            EventBus.emit('ui:log', { text: '⬆️ 存档导入成功。', type: 'good' })
          } catch (e) {
            alert(`导入失败：${e.message || '存档格式无效'}`)
          }
        }
        picker.click()
      })
      bind('set-rules', () => { Dialog.close(); Dialog.showRules() })
      bind('set-records', () => { Dialog.close(); AchievementsUI.open() })
      bind('set-changelog', () => { Dialog.close(); hooks.showChangelog() })
      bind('set-privacy', () => { Dialog.close(); hooks.showPrivacyNotice() })
      if (DEBUG_ENABLED) bind('set-cheat', () => { Dialog.close(); showCheatMenu() })
      bind('set-menu', () => { Dialog.close(); hooks.backToTitle() })
      bind('set-delete', () => {
        // 确认删除
        Dialog.show({
          title: '🗑️ 删除存档',
          body: '<p style="color:var(--danger)">确定要删除当前存档吗？此操作无法撤销。</p><p style="color:var(--text-dim);font-size:.85rem;margin-top:6px">删除后需重新开始游戏。</p>',
          actions: [
            { label: '❌ 取消', handler: () => showSettingsMenu(resumeDialog) },
            { label: '🗑️ 确认删除', cls: 'btn-danger', handler: () => {
              Dialog.close()
              State.clearSave()
              State.reset()   // 同时清空内存状态，防止残留旧内容
              EventBus.emit('ui:log', { text: '🗑️ 存档已删除。', type: 'danger' })
              hooks.backToTitle(true)   // skipSave：避免 backToTitle 重新保存
            }},
          ],
        })
      })
    })
  }

  /* ============ 新游戏 / 读档 ============ */

  /** 作弊菜单（分类面板） */
  function showCheatMenu () {
    const state = State.get()
    if (!state) return

    const sect = (icon, title, note, count, btns) => `
      <details class="cheat-section">
        <summary><i>${icon}</i><span><b>${title}</b><small>${note}</small></span><em>${count} 项</em></summary>
        <div class="cheat-grid">${btns}</div>
      </details>`

    const cheatBtn = (id, icon, label, note, cls = '') =>
      `<button class="cheat-action ${cls}" data-cheat="${id}"><i>${icon}</i><span><b>${label}</b><small>${note}</small></span></button>`

    Dialog.show({
      title: '🎮 作弊与剧情调试',
      className: 'cheat-modal',
      body: `<div class="cheat-menu">
        <aside class="cheat-warning"><b>⚠️ 会修改当前存档</b><span>操作会立即生效并自动保存，测试剧情前建议先导出存档。</span></aside>
        ${sect('🧭', '资源与状态', '角色资源、装备与债务', 11,
          cheatBtn('cheat-hp', '❤️', '回满生命', '恢复至最大生命') +
          cheatBtn('cheat-gold', '💰', '金币 +500', '直接加入钱袋') +
          cheatBtn('cheat-supply', '🎒', '全补给 ×5', '加入常用消耗品') +
          cheatBtn('cheat-clear-status', '✨', '清除状态', '移除临时状态') +
          cheatBtn('cheat-weapons', '⚔️', '全部武器', '解锁武器收藏') +
          cheatBtn('cheat-accessories', '📿', '全部饰品', '解锁饰品收藏') +
          cheatBtn('cheat-items', '🧪', '全部消耗品', '补齐背包物品') +
          cheatBtn('cheat-material', '🔧', '升级材料 ×3', '加入锻造材料') +
          cheatBtn('cheat-orb', '🔮', '力量宝珠', '强化下一次攻击') +
          cheatBtn('cheat-merc-debt', '💸', '佣兵债务 +100', '测试债务系统') +
          cheatBtn('cheat-merc-clear', '✓', '清除佣兵债务', '归零现有债务'))}
        ${sect('⚔️', '地图与战斗', '移动、遭遇与战斗控制', 8,
          cheatBtn('cheat-goto', '📍', '移动到坐标', '指定地图位置') +
          cheatBtn('cheat-position', '📌', '查看坐标', '查看相邻地图格') +
          cheatBtn('cheat-mob', '👺', '遭遇怪物', '选择普通或精英敌人') +
          cheatBtn('cheat-boss', '👑', '遭遇 BOSS', '直接挑战森林之灵') +
          cheatBtn('cheat-kill', '💀', '击杀当前敌人', '仅在战斗中生效') +
          cheatBtn('cheat-win', '🏆', '直接通关', '完成森林主流程') +
          cheatBtn('cheat-no-enemy', '🚶', state._noEnemyEncounters ? '关闭避敌模式' : '开启避敌模式', state._noEnemyEncounters ? '当前：不遇普通敌人' : '跳过普通怪物与伏击', state._noEnemyEncounters ? 'btn-cheat is-active' : 'btn-cheat') +
          cheatBtn('cheat-god', '🛡️', '无敌模式', '切换伤害免疫', 'btn-cheat'))}
        ${sect('📜', '欲缚镇·序章', '序章战斗与结算预览', 4,
          cheatBtn('cheat-prologue-stages', '📜', '序章阶段预览', '从收信到城门接管', 'btn-cheat') +
          cheatBtn('cheat-caravan-battle', '🌉', '车队看守战', '选择落单或挑衅版本', 'btn-cheat') +
          cheatBtn('cheat-bandit-defeat', '🍑', '桥洞战败预览', '从被强盗头目扣留开始', 'btn-cheat') +
          cheatBtn('cheat-bandit-victory', '☠️', '桥洞胜利预览', '从击败强盗头目后开始', 'btn-cheat'))}
        ${sect('⛓️', '欲缚镇·奴隶线·第一章', '第一章剧情与押送测试', 2,
          cheatBtn('cheat-m-stages', '⛓️', '章节阶段预览', '选择 Stage 0—3000', 'btn-cheat') +
          cheatBtn('cheat-m-escort', '🏙️', '九格押送预览', '选择性别与押送方式', 'btn-cheat'))}
      </div>`,
      actions: [{ label: '关闭', handler: () => Dialog.close() }],
    })

    Dialog.onMount(root => {
      root.querySelectorAll('[data-cheat]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.cheat
          // 调试指令：单独处理，需要交互弹窗
          if (id === 'cheat-goto') { cheatGoto(); return }
          if (id === 'cheat-mob') { cheatEncounter(); return }
          if (id === 'cheat-boss') { cheatBoss(); return }
          if (id === 'cheat-prologue-stages') { cheatPrologueStages(); return }
          if (id === 'cheat-caravan-battle') { cheatCaravanBattle(); return }
          if (id === 'cheat-bandit-defeat') { cheatBanditDefeat(); return }
          if (id === 'cheat-bandit-victory') { cheatBanditVictory(); return }
          if (id === 'cheat-m-intake') { cheatMIntake(); return }
          if (id === 'cheat-m-stages') { cheatMStages(); return }
          if (id === 'cheat-m-escort') { cheatMEscort(); return }
          if (id === 'cheat-position') { cheatPosition(); return }
          const msg = runCheat(id)
          if (msg) EventBus.emit('ui:log', { text: msg, type: 'good' })
          EventBus.emit('state:changed', State.get())
          Dialog.close()
        }
      })
    })
  }

  function cheatPrologueStages () {
    const stages = [
      [0, '序章开始', '雾灯镇巷口收到派克的错信'],
      [2, '拆开货单', '查看货单后去旧桥核对车辙'],
      [3, '镇内查证', '调查酒馆与铁匠铺'],
      [4, '车队看守', '返回旧桥抢回遗失许可'],
      [5, '桥下残骸', '拿到许可后调查失事车队'],
      [6, '强盗据点', '进入桥洞营地救记账员'],
      [7, '护送蕾娜', '带证人和残页前往镇务厅'],
      [8, '三方口供', '城门、商会与街口调查'],
      [9, '向镇长复命', '带齐证据质问镇长'],
      [10, '城门接管', '贝拉米与墨菲执行新制度'],
    ]
    Dialog.show({
      title: '📜 欲缚镇·序章 · 阶段预览',
      className: 'cheat-modal prologue-stage-cheat-modal',
      body: `<aside class="cheat-warning"><b>⚠️ 会覆盖当前序章进度</b><span>角色、背包和其他系统保留，序章分支状态会重置到所选阶段。</span></aside><div class="scene-choice-list">${stages.map(([stage, name, note]) => `<button data-prologue-stage="${stage}"><i>${stage === 0 ? '✉️' : stage < 4 ? '🔎' : stage < 7 ? '⚔️' : '🏛️'}</i><span><b>${name}</b><small>${note}</small></span><em>Stage ${stage}</em></button>`).join('')}</div>`,
      actions: [{ kind: 'navigation', label: '返回作弊菜单', handler: showCheatMenu }],
    })
    Dialog.onMount(root => {
      root.querySelectorAll('[data-prologue-stage]').forEach(btn => {
        btn.onclick = () => startPrologueStage(Number(btn.dataset.prologueStage))
      })
    })
  }

  function startPrologueStage (stage) {
    const state = State.get()
    if (!state || typeof PrologueSystem === 'undefined') return
    Dialog.close()
    state._battle = null
    state._ambush = null
    state.phase = 'idle'
    state._moveState = null
    state._wrongCommissionStage = stage
    state._wrongCommissionOutcome = null
    state._wrongCommissionBattle = null
    state._wrongCommissionCaptured = false
    state._wrongCommissionLeads = { barkeep: stage >= 4, blacksmith: stage >= 4 }
    state._pBridgePermitAcquired = stage >= 5
    state._pBridgeAftermath = null
    state._pCaravanTrailSeen = stage >= 6
    state._pCaravanClothesAwaitingRecovery = false
    state._pCaravanEscortStage = 0
    state._pCaravanEscortResult = null
    state._pDefeatDispatchPending = false
    state._pBanditAftermath = null
    state._pBanditDefeatCount = 0
    state._pBanditClothesLocked = false
    state._pBanditWitnessBegged = false
    state._pTownInquiry = { guard: stage >= 9, merchant: stage >= 9, citizen: stage >= 9 }
    state._pMainlineStage = 0
    state._pRole = null
    state._pChapterOneLocked = false
    if (stage >= 5) state.inventory.consumables.raven_latch = Math.max(1, state.inventory.consumables.raven_latch || 0)
    state.position = stage >= 2 && stage <= 6 ? { x: 10, y: 9 } : { x: 13, y: 9 }
    EventBus.emit('ui:log', { text: `📜 调试：已跳到欲缚镇·序章 Stage ${stage}。`, type: 'good' })
    EventBus.emit('ui:mapUpdate', {})
    EventBus.emit('state:changed', state)
    State.save()
    if ([2, 4, 5, 6].includes(stage)) PrologueSystem.visitBridge()
    else CampSystem.open()
  }

  function cheatCaravanBattle () {
    const state = State.get()
    if (!state || typeof PrologueSystem === 'undefined') return
    Dialog.close()
    state._battle = null
    state._ambush = null
    state.phase = 'idle'
    state.position = { x: 10, y: 9 }
    state._moveState = null
    state._wrongCommissionStage = 4
    state._wrongCommissionBattle = null
    state._wrongCommissionOutcome = null
    state._pBridgePermitAcquired = false
    state._pCaravanEscortStage = 0
    state._pCaravanEscortResult = null
    state._pDefeatDispatchPending = false
    state._pDefeatPunished = false
    state._pDefeatSentenced = false
    state._pDefeatPunishmentStep = 0
    EventBus.emit('ui:log', { text: '🌉 调试：已进入车队看守战的战前选择。', type: 'good' })
    EventBus.emit('ui:mapUpdate', {})
    EventBus.emit('state:changed', state)
    State.save()
    PrologueSystem.visitBridge()
  }

  function cheatBanditVictory () {
    const state = State.get()
    if (!state || typeof PrologueSystem === 'undefined') return
    Dialog.close()
    state._battle = null
    state._ambush = null
    state.phase = 'idle'
    state.position = { x: 10, y: 9 }
    state._wrongCommissionStage = 6
    state._wrongCommissionOutcome = null
    state._pMainlineStage = 0
    state._pRole = null
    state._pChapterOneLocked = false
    state._pGateChoices = []
    state._pTownInquiry = { guard: false, merchant: false, citizen: false }
    state._pBanditDefeatCount = 1
    state._pBanditClothesLocked = false
    state._pBanditLeaderFate = null
    state._pBanditMarkChoice = null
    state._pBanditVictoryResult = { fleeingCrew: 2, clothesTaken: true, gold: 22 }
    state._pBanditAftermath = 'victory-fall'
    if (!StatusSystem.has('naked')) StatusSystem.apply('naked', 99999, { source: 'p_bandit_chest' })
    EventBus.emit('ui:log', { text: '☠️ 调试：已进入战胜强盗头目后的清算。', type: 'good' })
    EventBus.emit('state:changed', state)
    State.save()
    PrologueSystem.resumePending()
  }

  function cheatBanditDefeat () {
    const state = State.get()
    if (!state || typeof PrologueSystem === 'undefined') return
    Dialog.close()
    state._battle = null
    state._ambush = null
    state.phase = 'idle'
    state.position = { x: 10, y: 9 }
    state._wrongCommissionStage = 6
    state._pBanditAftermath = null
    state._pBanditDefeatCount = 0
    state._pBanditDefeatScene = 0
    state._pBanditDefeatResult = null
    state._pBanditToySession = null
    state._pBanditClothesLocked = false
    EventBus.emit('ui:log', { text: '🍑 调试：已进入强盗头目战败后的扣留剧情。', type: 'danger' })
    EventBus.emit('state:changed', state)
    State.save()
    PrologueSystem.afterDefeat({
      storyDefeat: true,
      enemyId: 'p_bandit_leader',
      story: 'commission-bandits',
      banditLivingCrew: 2,
      banditLivingCrewIds: ['bandit-lookout', 'bandit-cutpurse'],
    })
  }

  function cheatMIntake () {
    const state = State.get()
    if (!state || !window.PMEnslavementSystem) return
    Dialog.close()
    state._battle = null
    state._ambush = null
    state.phase = 'camp'
    state.position = { x: 13, y: 9 }
    state._wrongCommissionStage = Math.max(10, state._wrongCommissionStage || 0)
    state._pRole = 'slave'
    state._pMainlineStage = 2
    state._pChapterOneLocked = true
    state._pMChapterStage = 0
    state._pMChapterStep = 0
    state._pMChapterBranch = null
    state._pMChapterAttitude = null
    state._pMWakeResist = 0
    state._pMSpankStack = 1
    state._pMStage2000SlapCount = 0
    state._pMStage2000SlapPending = false
    state._pMStage2000SlapReturn = null
    state._pMStage2500GearConfirmStep = 0
    state._pMStage2500GearConfirming = false
    state._pMChapterFailures = 0
    state._pMChapterEscrow = null
    state._pMConfiscated = false
    state._pMConfiscationEscrow = null
    state._pMChapterRestraintEscrow = null
    state._pMGroomed = false
    state._pMBranded = false
    state._pMSisterBond = false
    state._pMMarketResponse = null
    state._pMDayaChoice = null
    state._pMChapterCompleted = false
    state._pMEscortMode = 'bellamy'
    state._pMEscort = null
    EventBus.emit('ui:log', { text: '⛓️ 调试：已进入 M 路线被打晕后的入库开场。', type: 'danger' })
    EventBus.emit('state:changed', state)
    State.save()
    PMEnslavementSystem.open()
  }

  function cheatMStages () {
    const stages = [
      { stage: 0, icon: '🌑', title: '失去意识', note: '打晕、没收与收容笼' },
      { stage: 500, icon: '👁️', title: '醒来验号', note: '眼罩取下与第一次登记' },
      { stage: 1000, icon: '📋', title: '指定监管者', note: '登记经历与贝拉米接管' },
      { stage: 1500, icon: '✋', title: '服从测试', note: '第一轮互动训练' },
      { stage: 2000, icon: '⛓️', title: '登记桌验收', note: '请求、拒绝与累计惩罚' },
      { stage: 2500, icon: '🔔', title: '锁具与挂饰', note: '插入装备及街道出发准备' },
      { stage: 3000, icon: '🏛️', title: '初见派克', note: '会馆验收与当前开放终点' },
    ]
    Dialog.show({
      title: '⛓️ 欲缚镇·奴隶线·第一章',
      className: 'cheat-modal cheat-stage-modal',
      body: `<section class="cheat-stage-intro"><b>章节时间线</b><span>选择后会补齐该阶段需要的身份、进度和剧情锁具。</span></section>
        <div class="cheat-stage-list">${stages.map((entry, index) => `<button data-m-stage="${entry.stage}"><i>${entry.icon}</i><span><small>阶段 ${index + 1} · STAGE ${entry.stage}</small><b>${entry.title}</b><em>${entry.note}</em></span><strong>开始 ›</strong></button>`).join('')}</div>`,
      actions: [{ kind: 'navigation', label: '返回作弊菜单', handler: showCheatMenu }],
    })
    Dialog.onMount(root => {
      root.querySelectorAll('[data-m-stage]').forEach(btn => {
        btn.onclick = () => startMStagePreview(Number(btn.dataset.mStage))
      })
    })
  }

  function prepareMPreviewBase (stage) {
    const state = State.get()
    if (!state) return null
    state._battle = null
    state._ambush = null
    state.phase = 'camp'
    state.position = { x: 13, y: 9 }
    state._wrongCommissionStage = Math.max(10, state._wrongCommissionStage || 0)
    state._pRole = 'slave'
    state._pMainlineStage = 2
    state._pChapterOneLocked = true
    state._pMChapterStage = stage
    state._pMChapterStep = 0
    state._pMChapterBranch = 'novice'
    state._pMChapterAttitude = 'spank'
    state._pMWakeResist = 0
    state._pMSpankStack = 1
    state._pMStage2000SlapCount = 0
    state._pMStage2000SlapPending = false
    state._pMStage2000SlapReturn = null
    state._pMStage2500GearConfirmStep = 0
    state._pMStage2500GearConfirming = false
    state._pMChapterFailures = 0
    state._pMChapterEscrow = null
    state._pMConfiscated = stage !== 0
    state._pMConfiscationEscrow = null
    state._pMChapterRestraintEscrow = stage >= 1000 ? {} : null
    state._pMGroomed = stage >= 1000
    state._pMBranded = false
    state._pMSisterBond = false
    state._pMMarketResponse = null
    state._pMDayaChoice = null
    state._pMChapterCompleted = false
    state._pMEscortMode = 'bellamy'
    state._pMEscort = stage === 3000
      ? { started: true, gateDone: true, mode: 'bellamy', position: 8, currentType: null, currentId: null, currentStep: 0, forcedTiles: [], publicNotice: false, completed: true, entryStep: 1, entryEvent: 'bellamy_pass', hallArrive: true, gagRemovedAtHall: false }
      : null
    return state
  }

  function equipMPreviewRestraints (stage) {
    const state = State.get()
    if (!state || !window.RestraintSystem || stage < 1000) return
    if (state.gender === 'male') {
      const vaginal = RestraintSystem.get('vagina')
      if (vaginal && vaginal.source === 'p_m_intake') RestraintSystem.remove('vagina', true)
    }
    ;[
      ['neck', 'slave_collar'],
      ['arms', 'handcuffs'],
      ['legs', 'leg_cuffs'],
      ['waist', state.gender === 'male' ? 'vibrating_chastity' : 'chastity_device'],
    ].forEach(([slot, id]) => RestraintSystem.equip(slot, id, { locked: true, lockType: 'story', source: 'p_m_intake', difficulty: 5 }, true))
    if (stage >= 3000) RestraintSystem.equip('mouth', 'leather_gag', { locked: true, lockType: 'story', source: 'p_m_intake', difficulty: 5 }, true)
  }

  function startMStagePreview (stage) {
    if (!window.PMEnslavementSystem) return
    const state = prepareMPreviewBase(stage)
    if (!state) return
    Dialog.close()
    equipMPreviewRestraints(stage)
    if (window.StatusSystem && !StatusSystem.has('naked')) StatusSystem.apply('naked', 99999, { source: 'p_m_intake' })
    EventBus.emit('ui:log', { text: `⛓️ 调试：已从欲缚镇·奴隶线·第一章 Stage ${stage} 开始。`, type: 'danger' })
    EventBus.emit('state:changed', state)
    State.save()
    PMEnslavementSystem.open()
  }

  function cheatMEscort () {
    if (!window.PMEscortSystem) return
    Dialog.show({
      title: '🏙️ 九格押送预览',
      className: 'cheat-modal',
      body: '<p style="color:var(--text-dim);font-size:.84rem">选择试玩角色与押送方式。这会将当前存档调到 Stage 2500 结束后。</p>',
      actions: [
        { label: '女性 · 贝拉米同行', cls: 'btn-primary', handler: () => startEscortPreview('female', 'bellamy') },
        { label: '女性 · 独自行走', handler: () => startEscortPreview('female', 'solo') },
        { label: '男性 · 独自行走', handler: () => startEscortPreview('male', 'solo') },
        { label: '取消', handler: showCheatMenu },
      ],
    })
  }

  function startEscortPreview (gender, mode) {
    const state = State.get()
    if (!state || !window.PMEscortSystem || !window.RestraintSystem) return
    Dialog.close()
    state.gender = gender
    state.genderLabel = gender === 'male' ? '男性' : '女性'
    state._battle = null
    state._ambush = null
    state.phase = 'camp'
    state.position = { x: 13, y: 9 }
    state._wrongCommissionStage = Math.max(10, state._wrongCommissionStage || 0)
    state._pRole = 'slave'
    state._pMainlineStage = 2
    state._pChapterOneLocked = true
    state._pMChapterStage = 2500
    state._pMChapterStep = 1
    state._pMConfiscated = true
    state._pMChapterCompleted = false
    state._pMEscortMode = mode
    state._pMEscort = null
    ;[
      ['neck', 'slave_collar'],
      ['arms', 'handcuffs'],
      ['legs', 'leg_cuffs'],
      ['waist', gender === 'male' ? 'vibrating_chastity' : 'chastity_device'],
      ['anal', 'medium_butt_plug'],
    ].forEach(([slot, id]) => RestraintSystem.equip(slot, id, {
      locked: true, lockType: 'story', source: 'p_m_intake', difficulty: 5,
      ...(slot === 'anal' ? { attachment: 'prostitute_tag' } : {}),
    }, true))
    if (gender === 'male') {
      const vaginal = RestraintSystem.get('vagina')
      if (vaginal && vaginal.source === 'p_m_intake') RestraintSystem.remove('vagina', true)
    } else RestraintSystem.equip('vagina', 'vibrating_dildo', {
      locked: true, lockType: 'story', source: 'p_m_intake', difficulty: 5,
      attachment: 'bell', vibrationMode: 'low',
    }, true)
    if (window.StatusSystem && !StatusSystem.has('naked')) StatusSystem.apply('naked', 99999, { source: 'p_m_intake' })
    EventBus.emit('ui:log', { text: `🏙️ 调试：已进入${gender === 'male' ? '男性' : '女性'}·${mode === 'solo' ? '独行' : '贝拉米同行'}九格押送。`, type: 'danger' })
    EventBus.emit('state:changed', state)
    State.save()
    PMEscortSystem.start({ mode })
  }

  /** 执行作弊指令，返回日志消息 */
  function runCheat (id) {
    const state = State.get()
    if (!state) return ''

    switch (id) {
      case 'cheat-hp':
        state.hp = state.maxHp
        return '❤️ HP 已回满。'
      case 'cheat-gold':
        state.gold += 500
        return '💰 金币 +500；若存在佣兵债务，新增收入会按规则自动还款。'
      case 'cheat-supply':
        ITEMS.consumables.forEach(it => {
          if (it.id !== 'weapon_upgrade_material' && it.id !== 'twig') {
            state.inventory.consumables[it.id] = (state.inventory.consumables[it.id] || 0) + 5
          }
        })
        return '🎒 每种消耗品补充 5 个。'
      case 'cheat-clear-status':
        state.statuses = []
        state._plugActive = false
        return '✨ 已清除所有状态效果。'
      case 'cheat-kill':
        return cheatKillEnemy()
      case 'cheat-win':
        return cheatWinGame()
      case 'cheat-god':
        state._godMode = !state._godMode
        return state._godMode ? '🛡️ 无敌模式已开启（HP 不再减少）。' : '🛡️ 无敌模式已关闭。'
      case 'cheat-no-enemy':
        state._noEnemyEncounters = !state._noEnemyEncounters
        return state._noEnemyEncounters
          ? '🚶 避敌模式已开启：普通怪物格、随机怪物和伏击会被跳过；剧情战与 BOSS 保留。'
          : '🚶 避敌模式已关闭：恢复普通敌人遭遇。'
      case 'cheat-orb':
        if (state._battle) state._battle.orbBoost = true
        else if (state._ambush) state._ambush.orbBoost = true
        return '🔮 已激活力量宝珠效果。'
      case 'cheat-weapons':
        ITEMS.weapons.forEach(w => {
          if (!state.ownedEquipment.includes(w.id)) state.ownedEquipment.push(w.id)
        })
        if (!state.inventory.weapon) state.inventory.weapon = 'basic_sword'
        return '⚔️ 已获得全部武器（装备基础剑）。'
      case 'cheat-accessories':
        ITEMS.accessories.forEach(a => {
          if (!state.ownedEquipment.includes(a.id)) state.ownedEquipment.push(a.id)
          const alreadyWorn = state.inventory.accessories.includes(a.id)
          if (!alreadyWorn) state.inventory.accessories.push(a.id)
          if (!alreadyWorn && a.effect && a.effect.stat === 'maxHp') {
            state.maxHp += a.effect.value
            state.hp += a.effect.value
          }
        })
        if (!state.inventory.accessory) state.inventory.accessory = ITEMS.accessories[0] ? ITEMS.accessories[0].id : null
        return '📿 已获得全部饰品并穿戴（HP 上限增加）。'
      case 'cheat-items':
        ITEMS.consumables.forEach(it => {
          if (it.id !== 'weapon_upgrade_material' && it.id !== 'twig') {
            state.inventory.consumables[it.id] = (state.inventory.consumables[it.id] || 0) + 1
          }
        })
        return '🧪 每种消耗品 +1。'
      case 'cheat-material':
        state.inventory.consumables['weapon_upgrade_material'] = (state.inventory.consumables['weapon_upgrade_material'] || 0) + 3
        return '🔧 升级材料 +3。'
      case 'cheat-merc-debt':
        if (!state._mercenary || !window.MercenaryContractSystem) return '⚔️ 尚未招募芙蕾雅。'
        MercenaryContractSystem.addDebt(100, '调试', { allowOverLimit: true })
        return `💸 佣兵债务已增加到 ${MercenaryContractSystem.debt()}G。`
      case 'cheat-merc-clear':
        if (!state._mercenaryContract) return '⚔️ 没有佣兵债务数据。'
        state._mercenaryContract.debt = 0
        return '✓ 已清除佣兵债务。'
    }
    return ''
  }

  /** 作弊：击杀当前敌人（战斗/伏击中） */
  function cheatKillEnemy () {
    const state = State.get()
    if (state._battle) {
      // 战斗中：直接结束并给战利品
      state._battle.targets = []
      BattleSystem.end(true)
      State.save()
      return '💀 已击杀当前敌人。'
    }
    if (state._ambush) {
      // 伏击中：跳过伏击
      AmbushSystem.cleanup()
      state._ambush = null
      state.phase = 'idle'
      State.save()
      GameFlow.afterEvent()
      return '💀 已跳过当前伏击。'
    }
    return '💀 当前没有战斗或伏击。'
  }

  /** 作弊：直接通关 */
  function cheatWinGame () {
    const state = State.get()
    state._battle = null
    state._ambush = null
    state.phase = 'idle'
    state.bossDefeated = true
    State.save()
    hooks.showBossVictory()
    return '🏆 已直接通关！'
  }

  /** 调试：查看当前位置和相邻格 */
  function cheatPosition () {
    const state = State.get()
    const pos = state.position
    const tile = MapLib.get(pos.x, pos.y)
    const tileName = tile ? (tile.raw || tile.type) : '未知'
    const neighbors = MapLib.neighbors(pos.x, pos.y).map(n => `(${n.x},${n.y})`).join(' ')
    Dialog.show({
      title: '📍 当前位置',
      body: `
        <div style="background:var(--panel-2);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--text-dim)">坐标</span><b>(${pos.x}, ${pos.y})</b></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--text-dim)">格子</span><b>${tileName}</b></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--text-dim)">可走相邻</span><b>${neighbors || '无'}</b></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-dim)">难度</span><b>${diffName(state.difficulty)}</b></div>
        </div>
      `,
      actions: [{ label: '关闭', handler: () => Dialog.close() }],
    })
  }

  /** 调试：移动到指定坐标（可选自动触发格子事件） */
  function cheatGoto () {
    const state = State.get()
    Dialog.show({
      title: '📍 移动到坐标',
      body: `
        <div style="background:var(--panel-2);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <input type="number" id="cheat-goto-x" placeholder="X" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--panel);color:var(--text)" />
            <input type="number" id="cheat-goto-y" placeholder="Y" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--panel);color:var(--text)" />
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--text-dim)">
            <input type="checkbox" id="cheat-goto-trigger" checked /> 到达后触发格子事件（战斗/陷阱/宝箱等）
          </label>
        </div>
      `,
      actions: [
        { label: '取消', handler: () => Dialog.close() },
        { label: '传送', cls: 'btn-primary', handler: () => {
          const x = parseInt(document.getElementById('cheat-goto-x').value)
          const y = parseInt(document.getElementById('cheat-goto-y').value)
          if (isNaN(x) || isNaN(y) || !MapLib.isWalkable(x, y)) {
            alert('无效坐标（该格不可通行或超出地图）')
            return
          }
          // 弹窗关闭后表单节点会被移除，必须先保存勾选状态。
          const triggerEvent = document.getElementById('cheat-goto-trigger').checked
          state.position = { x, y }
          state.visited.push({ x, y })
          state.phase = 'idle'
          Dialog.close()
          EventBus.emit('state:changed', state)
          EventBus.emit('ui:mapUpdate', {})
          EventBus.emit('ui:log', { text: `📍 已传送到 (${x},${y})。`, type: 'good' })
          if (triggerEvent) {
            // 传送后触发格子事件（如该格是战斗/BOSS）
            const tile = MapLib.get(x, y)
            if (tile) NodeEvents.trigger(tile, x, y)
          } else {
            hooks.readyToRoll()
          }
        } },
      ],
    })
    Dialog.onMount(root => {
      const xi = root.querySelector('#cheat-goto-x')
      if (xi) { xi.value = state.position.x; xi.focus() }
      const yi = root.querySelector('#cheat-goto-y')
      if (yi) yi.value = state.position.y
    })
  }

  /** 调试：遭遇指定怪物（可选 BOSS） */
  function cheatEncounter () {
    const state = State.get()
    const pool = CONFIG.monsters.randomPool || ['tentacle', 'orc', 'sorceress', 'succubus', 'goblins', 'werewolf']
    const cards = pool.map(id => {
      const m = DATA.monster(id)
      return `<button class="cheat-mob-card" data-mob="${id}">
        <b>${m.name}</b><span>HP ${m.maxHp}</span>
      </button>`
    }).join('')
    Dialog.show({
      title: '👺 遭遇怪物',
      className: 'cheat-mob-modal',
      body: `
        <label for="cheat-elite-mode" style="display:block;color:var(--text-dim);font-size:.72rem;margin-bottom:5px">精英词缀</label>
        <select id="cheat-elite-mode" style="width:100%;min-height:40px;margin-bottom:10px;padding:7px;border:1px solid var(--border);border-radius:8px;background:var(--panel-2);color:var(--text)">
          <option value="">普通怪（不随机精英）</option>
          <option value="toxic">☠️ 剧毒精英</option>
          <option value="armored">🛡️ 装甲精英</option>
          <option value="berserk">⚡ 狂暴精英</option>
          <option value="cunning">🏃 狡猾精英</option>
        </select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">${cards}</div>
        <button class="btn btn-danger" id="cheat-mob-boss" style="width:100%">👑 森林之灵（BOSS）</button>
      `,
      actions: [{ label: '取消', handler: () => Dialog.close() }],
    })
    Dialog.onMount(root => {
      root.querySelectorAll('.cheat-mob-card').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.mob
          const elite = root.querySelector('#cheat-elite-mode')?.value || false
          Dialog.close()
          state._battle = null
          state._ambush = null
          BattleSystem.start(id, { elite })
          EventBus.emit('ui:log', { text: `👺 调试：遭遇 ${DATA.monster(id).name}。`, type: 'good' })
        }
      })
      const bossBtn = root.querySelector('#cheat-mob-boss')
      if (bossBtn) bossBtn.onclick = () => {
        Dialog.close()
        state._battle = null
        state._ambush = null
        BattleSystem.start('spirit_of_forest')
        EventBus.emit('ui:log', { text: '👑 调试：遭遇森林之灵（BOSS）。', type: 'good' })
      }
    })
  }

  /** 调试：直接遭遇 BOSS */
  function cheatBoss () {
    const state = State.get()
    state._battle = null
    state._ambush = null
    BattleSystem.start('spirit_of_forest')
    EventBus.emit('ui:log', { text: '👑 调试：遭遇森林之灵（BOSS）。', type: 'good' })
  }

  /** 弹出难度选择弹窗 */

  function init (callbacks) { hooks = callbacks || {}; bindTopbar() }
  return { init, open: showSettingsMenu }
})()
