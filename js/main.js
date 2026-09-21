/**
 * main.js — 应用入口（自动走路版）
 *
 * 流程：掷骰 → 自动往前走 →
 *   - 岔路暂停让玩家选方向
 *   - 特殊格子触发事件
 *   - 步数耗尽或死路时停止
 */

;(function () {
  const titleScreen = document.getElementById('screen-title')
  const gameScreen = document.getElementById('screen-game')
  const continueBtn = document.getElementById('btn-continue')
  const DEBUG_ENABLED = !!(CONFIG.debug && CONFIG.debug.enabled) || ['localhost', '127.0.0.1'].includes(location.hostname)
  const AGE_CONFIRM_KEY = 'yaolin-qimeng-age-confirmed-v1'

  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[ch])

  const cleanPlayerName = value => String(value || '')
    .replace(/[<>\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 10) || '妖林勇者'

  /** 根据性别返回被救者称谓（男救女友 / 女救男友） */
  const loverTerm = gender => {
    const g = gender === 'male' ? 'male' : 'female'
    if (g === 'male') return { term: '女友', pronoun: '她', target: '她的踪迹' }
    return { term: '男友', pronoun: '他', target: '他的踪迹' }
  }

  /* ============ 初始化 ============ */
  UI.init()
  Log.add('妖林绮梦 v' + CONFIG.version, 'dim')

  // 窗口尺寸变化：若处于"选择方向"状态，重新渲染方向键布局（浮动/固定切换）
  window.addEventListener('resize', () => MovementController.handleResize())

  // 顶栏按钮（始终绑定，无论是否有存档）
  bindReleaseNotices()

  EventBus.on('game:saveError', () => {
    const saveHint = document.getElementById('topbar-save-hint')
    if (saveHint) saveHint.textContent = '保存失败，请导出备份'
  })

  // 有存档：标题页显示"加载存档"按钮，但不自动进入游戏
  if (State.hasSave()) {
    continueBtn.classList.remove('btn-hidden')
    continueBtn.onclick = () => loadGame()
  } else {
    continueBtn.classList.add('btn-hidden')
  }

  document.getElementById('btn-new-game').onclick = showDifficultyDialog

  document.getElementById('btn-rules').onclick = () => Dialog.showRules()
  document.getElementById('btn-changelog').onclick = showChangelog

  function bindReleaseNotices () {
    const gate = document.getElementById('age-gate')
    const app = document.getElementById('app')
    const enter = document.getElementById('btn-age-enter')
    const leave = document.getElementById('btn-age-leave')
    const privacyButtons = document.querySelectorAll('[data-open-privacy]')
    let accepted = false
    try { accepted = localStorage.getItem(AGE_CONFIRM_KEY) === 'yes' } catch (_) {}
    const setGateOpen = open => {
      if (gate) {
        gate.classList.toggle('age-gate-hidden', !open)
        gate.setAttribute('aria-hidden', open ? 'false' : 'true')
      }
      if (app) app.inert = open
      if (open && enter) requestAnimationFrame(() => enter.focus())
    }
    setGateOpen(!accepted)
    const checkChangelog = () => {
      if (typeof Changelog !== 'undefined' && Changelog.check) setTimeout(() => Changelog.check(), 250)
    }
    if (accepted) checkChangelog()

    if (enter) enter.onclick = () => {
      try { localStorage.setItem(AGE_CONFIRM_KEY, 'yes') } catch (_) {}
      setGateOpen(false)
      checkChangelog()
    }
    if (leave) leave.onclick = () => {
      if (history.length > 1) history.back()
      else location.href = 'about:blank'
    }
    privacyButtons.forEach(btn => { btn.onclick = showPrivacyNotice })
    if (gate) gate.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return
      const focusable = [...gate.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    })
  }

  function showPrivacyNotice () {
    Dialog.show({
      title: '隐私与存档说明',
      className: 'privacy-modal',
      body: `
        <div class="privacy-copy">
          <p><b>本地存档：</b>游戏进度保存在当前浏览器的本地存储中，不会自动同步到其他设备。清理浏览器数据可能导致存档丢失，请定期使用“导出存档”。</p>
          <p><b>访问统计：</b>站点托管服务可能通过 Cloudflare Web Analytics 收集匿名化的基础访问与性能信息，用于发现页面故障；游戏本身不要求注册账号。</p>
          <p><b>成人内容：</b>本游戏仅面向达到所在地法定成年年龄、并自愿查看成人幻想内容的用户。</p>
          <p><b>反馈：</b>如果你发现存档或页面异常，请在反馈时注明设备、浏览器和复现步骤，不要发送私人敏感信息。</p>
        </div>`,
      actions: [{ label: '我知道了', cls: 'btn-primary', handler: () => Dialog.close() }],
    })
  }

  function showChangelog () {
    if (typeof Changelog !== 'undefined' && Changelog.show) Changelog.show()
  }

  /** 返回主菜单（标题页）。 */
  function backToTitle (skipSave) {
    if (!skipSave) State.save()
    gameScreen.classList.add('screen-hidden')
    titleScreen.classList.remove('screen-hidden')
    const topbar = document.getElementById('topbar')
    if (topbar) topbar.classList.add('hidden')
    window.scrollTo(0, 0)
    document.getElementById('btn-new-game').onclick = showDifficultyDialog
    document.getElementById('btn-rules').onclick = () => Dialog.showRules()
    document.getElementById('btn-changelog').onclick = showChangelog
    if (State.hasSave()) {
      continueBtn.classList.remove('btn-hidden')
      continueBtn.onclick = () => loadGame()
    } else {
      continueBtn.classList.add('btn-hidden')
    }
  }

  /** 绑定顶栏按钮 */
  AppSettings.init({ loadGame, showChangelog, showPrivacyNotice, backToTitle, readyToRoll: (...args) => MovementController.readyToRoll(...args), showBossVictory: () => RecoverySystem.showBossVictory() })
  function showDifficultyDialog () {
    // 百分比 → 星星（3 星制：17%→1星，33%→2星，50%→3星）
    const toStars = (pct) => {
      const n = Math.round(parseInt(pct) / 16.7)
      return '⭐'.repeat(Math.min(3, Math.max(0, n))) + '☆'.repeat(Math.max(0, 3 - Math.min(3, Math.max(0, n))))
    }
    const fmt = (label, val) => {
      const star = /^\d+%$/.test(val) ? toStars(val) : val
      return `<span class="diff-stat"><i>${label}</i><em>${star}</em></span>`
    }
    const diffs = [
      { key: 'normal', icon: '🌿', name: '普通', tag: '初次踏入妖林', note: '探索更快，暴击机会更多', badge: '推荐', rows: [['移动', '掷 Y 格'], ['初始 HP', '25'], ['暴击', '33%'], ['未命中', '17%']] },
      { key: 'hard', icon: '⚔️', name: '困难', tag: '献给森林老手', note: '步伐放缓，每次选择更关键', rows: [['移动', 'Y÷2 格'], ['初始 HP', '25'], ['暴击', '17%'], ['未命中', '17%']] },
      { key: 'brutal', icon: '🔥', name: '残酷', tag: '真正的地狱试炼', note: '寸步难行，没有暴击眷顾', rows: [['移动', '固定 1 格'], ['初始 HP', '20'], ['暴击', '0%'], ['未命中', '33%']] },
    ]
    const cards = diffs.map(d => `
      <button class="diff-card diff-card--${d.key}" data-diff="${d.key}">
        ${d.badge ? `<span class="diff-badge">${d.badge}</span>` : ''}
        <span class="diff-card-head">
          <span class="diff-icon" aria-hidden="true">${d.icon}</span>
          <span class="diff-title-wrap">
            <b>${d.name}</b>
            <span class="diff-tag">${d.tag}</span>
          </span>
        </span>
        <span class="diff-note">${d.note}</span>
        <span class="diff-stats">
          ${d.rows.map(r => fmt(r[0], r[1])).join('')}
        </span>
        <span class="diff-select-label">选择此难度 <span aria-hidden="true">→</span></span>
      </button>`).join('')

    Dialog.show({
      title: '选择你的试炼',
      body: `
        <div class="difficulty-intro">
          <span>妖林不会对每位旅人一视同仁。</span>
          <small>难度只影响数值与移动规则，故事内容保持一致。</small>
        </div>
        <div class="difficulty-grid">${cards}</div>`,
      actions: [{ label: '← 返回主菜单', handler: () => Dialog.close() }],
      className: 'difficulty-modal',
    })

    Dialog.onMount(root => {
      root.querySelectorAll('[data-diff]').forEach(btn => {
        btn.onclick = () => {
          const diff = btn.dataset.diff
          Dialog.close()
          askPlayerName(diff)
        }
      })
    })
  }

  /** 性别标签配置：阵营 → 可选标签 */
  const GENDER_FACTIONS = [
    {
      id: 'male_faction', icon: '👨', name: '男', gender: 'male', defaultLabel: '男性',
      labels: [
        { id: 'boy', label: '男生' }, { id: 'male', label: '男性' },
        { id: 'male1', label: '男奴' }, { id: 'male2', label: '公狗' },
        { id: 'male3', label: '带锁公狗' }, { id: 'male4', label: '男妓' },
        { id: 'male5', label: '帅哥' }, { id: 'male6', label: '校草' },
      ],
    },
    {
      id: 'female_faction', icon: '👩', name: '女', gender: 'female', defaultLabel: '女性',
      labels: [
        { id: 'girl', label: '女生' }, { id: 'female', label: '女性' },
        { id: 'female1', label: '女奴' }, { id: 'female2', label: '母狗' },
        { id: 'female3', label: '御姐' }, { id: 'female4', label: '萝莉' },
        { id: 'female5', label: '妓女' }, { id: 'female6', label: '校花' },
        { id: 'female7', label: '美女' },
      ],
    },
    {
      id: 'femboy_faction', icon: '⚧️', name: '男娘', gender: 'male', defaultLabel: '男娘',
      labels: [
        { id: 'femboy', label: '男娘' }, { id: 'transgirl', label: '药娘' },
        { id: 'femboy1', label: '扶她' }, { id: 'femboy2', label: 'CD(变装)' },
        { id: 'femboy3', label: 'TS' }, { id: 'femboy4', label: '锁娘' },
        { id: 'femboy5', label: '男娼' }, { id: 'femboy6', label: '男雌婊' },
        { id: 'femboy7', label: '雌奴' }, { id: 'femboy8', label: '娼年' },
        { id: 'femboy9', label: '顶级男娘' },
      ],
    },
  ]

  /** 询问玩家名字 + 性别阵营 + 标签后开始游戏 */
  function askPlayerName (difficulty) {
    let factionId = 'male_faction'
    let labelId = 'male'
    const factionOf = fid => GENDER_FACTIONS.find(f => f.id === fid)
    const labelOf = (fid, lid) => (factionOf(fid).labels.find(l => l.id === lid) || factionOf(fid).labels[1])

    const buildBody = () => {
      const factionsHtml = GENDER_FACTIONS.map(f => `
        <button type="button" class="gender-opt faction-opt ${f.id === factionId ? 'is-selected' : ''}" data-faction="${f.id}" aria-pressed="${f.id === factionId}" style="grid-template-columns:1fr">
          <span style="font-size:1.5rem">${f.icon}</span>
          <b>${f.name}</b>
        </button>`).join('')
      const labelsHtml = factionOf(factionId).labels.map(l => `
        <button type="button" class="gender-label ${l.id === labelId ? 'is-selected' : ''}" data-label="${l.id}" aria-pressed="${l.id === labelId}">${l.label}</button>`).join('')
      return `
        <p style="color:var(--text-dim);font-size:.9rem;margin-bottom:10px">即将进入妖林冒险，勇者如何称呼？</p>
        <input id="input-player-name" type="text" maxlength="10" placeholder="输入勇者名（默认：妖林勇者）"
          style="width:100%;padding:10px 14px;font-size:1rem;background:var(--panel-2);border:1px solid var(--border);border-radius:8px;color:var(--text);outline:none;"
        />
        <div style="margin-top:14px;color:var(--text-dim);font-size:.82rem;margin-bottom:6px">选择性别阵营</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">${factionsHtml}</div>
        <div style="margin-top:12px;color:var(--text-dim);font-size:.82rem;margin-bottom:6px">选择标签</div>
        <div class="gender-label-grid">${labelsHtml}</div>
      `
    }

    const render = () => {
      Dialog.show({
        title: '给自己起个名字',
        body: buildBody(),
        actions: [
          { label: '⚔️ 开始冒险', cls: 'btn-primary', handler: () => {
            const input = document.getElementById('input-player-name')
            const name = cleanPlayerName(input && input.value)
            const f = factionOf(factionId)
            Dialog.close()
            startNewGame(difficulty, name, f.gender, labelOf(factionId, labelId).label)
          }},
        ],
      })
      Dialog.onMount(root => {
        root.querySelectorAll('.faction-opt').forEach(btn => {
          btn.onclick = () => {
            factionId = btn.dataset.faction
            labelId = factionOf(factionId).labels[1].id   // 切换阵营默认选第 2 个标签
            render()
          }
        })
        root.querySelectorAll('.gender-label').forEach(btn => {
          btn.onclick = () => {
            labelId = btn.dataset.label
            root.querySelectorAll('.gender-label').forEach(b => {
              b.classList.remove('is-selected')
              b.setAttribute('aria-pressed', 'false')
            })
            btn.classList.add('is-selected')
            btn.setAttribute('aria-pressed', 'true')
          }
        })
      })
    }
    render()
  }

  function startNewGame (difficulty, playerName, gender, genderLabel) {
    State.clearSave()
    State.init(difficulty)
    State.update(s => { s.inventory.consumables['bandaid'] = 1; s.playerName = playerName || '妖林勇者'; s.gender = gender || 'female'; s.genderLabel = genderLabel || (gender === 'male' ? '男性' : '女性') })
    const state = State.get()
    showGameScreen()
    Log.clear()
    Log.add(`🆕 新的冒险 — ${diffName(difficulty)}`, 'good')
    const lover = loverTerm(state.gender)
    Log.add(`你的${lover.term}被森林拖走了。你必须穿越妖林救回${lover.pronoun}。`, '')
    MapLib.parse()
    MapUI.render()
    HUD.render()
    // 旧存档已招募芙蕾雅时，补一次债务契约说明；战斗和商店中不抢占当前流程。
    if (state._mercenary && state._mercenaryContract && !state._mercenaryContract.introSeen && !['battle', 'shop', 'boss', 'gameover'].includes(state.phase)) {
      setTimeout(() => {
        const current = State.get()
        if (current === state && current._mercenaryContract && !current._mercenaryContract.introSeen && window.MercenaryContractSystem) MercenaryContractSystem.showIntro()
      }, 350)
    }
    EventBus.emit('ui:log', { text: '🏘️ 村庄已成废墟。向东进入营地，向西进入森林。', type: 'dim' })
    // 新游戏初始化后立即存档，防止刷新丢失进度
    State.save()
    // 新手引导：进入营地找鹿（出生点右侧）
    MovementController.readyToRoll()
    showStartTownGuide()
  }

  /** 新角色首次进图提示：明确标出出生点右侧的林缘城镇。 */
  function showStartTownGuide () {
    const highlightEast = () => {
      setTimeout(() => {
        const eastButtons = document.querySelectorAll('[data-dir="e"]')
        eastButtons.forEach(btn => btn.classList.add('start-guide-target'))
        setTimeout(() => eastButtons.forEach(btn => btn.classList.remove('start-guide-target')), 5000)
      }, 80)
    }
    Dialog.show({
      title: '🧭 出发前先看看右边', className: 'start-guide-modal',
      body: `<section class="start-guide-hero"><div class="start-guide-compass">→</div><div><small>东边传来篝火与酒香</small><h3>雾里隐约能看见林缘城镇的灯。</h3><p>那里有人声，也许能找到补给和落脚的地方。</p></div></section>
        <div class="start-guide-route" aria-label="起点路线图"><span><i>🌲</i><b>妖林</b><small>向西冒险</small></span><em>←</em><span class="is-player"><i>🧭</i><b>出生点</b><small>你在这里</small></span><em>→</em><span class="is-town"><i>⛺</i><b>林缘城镇</b><small>灯火就在前方</small></span></div>
        <div class="start-guide-note"><i>!</i><span>方向栏里的<b>东 →</b>正朝着那片灯火。</span></div>`,
      actions: [
        { label: '→ 标出右侧城镇', cls: 'btn-primary', handler: () => { Dialog.close(); highlightEast() } },
        { label: '我想自己探索', handler: () => { Dialog.close() } },
      ],
    })
  }

  function loadGame () {
    const state = State.load()
    if (!state) {
      alert('主存档和备用存档都无法读取。请尝试从之前导出的 JSON 文件恢复。')
      return
    }
    State.migrate(state)
    showGameScreen()
    // 恢复冒险日志（不再清空）
    Log.loadFromState(state.logs || [])
    Log.add('📂 读档成功', 'good')
    MapLib.parse()
    MapUI.render()
    HUD.render()

    // 剧情战后的多幕断点优先恢复，避免刷新后重新触发已经获胜的战斗。
    if (GameFlow.resumeStory && GameFlow.resumeStory()) return

    if (state._guardSearchPending && typeof CampSystem !== 'undefined' && CampSystem.resumeGuardSearch) {
      // 城门搜身断点优先于一切 phase 判断：恢复剩余倒计时并继续检查（不重复结算）
      CampSystem.resumeGuardSearch()
    } else if (state.phase === 'battle') {
      // 存档已恢复 _battle 全部战况（HP/回合/反射/格挡），只重建 UI
      if (BattleUI.resume) BattleUI.resume()
    } else if (state.phase === 'shop') {
      ShopSystem.open(null)
    } else if (state.phase === 'camp') {
      CampSystem.open()
    } else {
      // 恢复移动存档：剩余步数 + 来源格 + 转向状态
      if (MovementController.restore(state._moveState)) return
      MovementController.readyToRoll()
      // 恢复特殊掉落事件（断触手/狼人/魔女召唤），刷新前未处理的继续执行
      if (state._pendingLootEvent && state._pendingLootEvent.type && BattleUI.processPendingLootEvent) {
        BattleUI.processPendingLootEvent()
      }
    }
  }

  function showGameScreen () {
    titleScreen.classList.add('screen-hidden')
    gameScreen.classList.remove('screen-hidden')
    // 进入游戏：显示顶栏
    const topbar = document.getElementById('topbar')
    if (topbar) topbar.classList.remove('hidden')
    // 回到页面顶部
    window.scrollTo(0, 0)
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
  }

  /* ============ 掷骰阶段 ============ */
  /** 显示底部操作栏（战斗 / gameover / 结局等用） */
  // 移动、方向键与自动行走由 MovementController 管理。
  /** BOSS 战死亡：读取战前存档，带全部物品回到 BOSS 前 */
  RecoverySystem.init({
    readyToRoll: (...args) => MovementController.readyToRoll(...args),
    showActionBar: () => MovementController.showActionBar(),
  })
})()
