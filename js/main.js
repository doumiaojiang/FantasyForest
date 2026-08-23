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
  const hint = document.getElementById('action-hint')
  const btns = document.getElementById('action-buttons')

  let _stepsRemaining = 0
  let _isWalking = false
  let _prevPos = { x: -1, y: -1 }   // 上一个位置（防回头）
  let _moveLocked = false   // 移动掷骰运行锁（防重复触发）
  let _turning = false      // 岔路暂停：选方向后不掷骰，继续走剩余步数
  let _readyToRollTimer = null  // 浮动方向键延迟重试计时器
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
  window.addEventListener('resize', () => {
    const st = State.get()
    if (!st) return
    const gameActive = !gameScreen.classList.contains('screen-hidden')
    if (!gameActive || st.phase !== 'idle' || _isWalking || _moveLocked) return
    clearTimeout(_readyToRollTimer)
    // 先清理浮动方向键避免残留
    const float = document.getElementById('dpad-float')
    if (float) float.classList.add('hidden')
    readyToRoll(_turning)
  })

  // 顶栏按钮（始终绑定，无论是否有存档）
  bindTopbar()
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

  /** 绑定顶栏按钮 */
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
            <button class="btn" id="set-menu">🏠 主菜单</button>
            ${villageMode ? '' : cheatButton}
            <button class="btn btn-danger" id="set-delete" style="grid-column:1/-1">🗑️ 删除存档</button>
          </div>
          <p class="settings-save-note">进度会在操作后自动保存；换设备或清理浏览器前，请先导出存档文件。</p>
        </div>
      `,
      actions: [{ label: villageMode ? '返回村庄' : '关闭', handler: closeSettings }],
    })
    setTimeout(() => {
      const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn }
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
        loadGame()
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
            loadGame()
            EventBus.emit('ui:log', { text: '⬆️ 存档导入成功。', type: 'good' })
          } catch (e) {
            alert(`导入失败：${e.message || '存档格式无效'}`)
          }
        }
        picker.click()
      })
      bind('set-rules', () => { Dialog.close(); Dialog.showRules() })
      bind('set-changelog', () => { Dialog.close(); showChangelog() })
      bind('set-privacy', () => { Dialog.close(); showPrivacyNotice() })
      if (DEBUG_ENABLED) bind('set-cheat', () => { Dialog.close(); showCheatGate() })
      bind('set-menu', () => { Dialog.close(); backToTitle() })
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
              backToTitle(true)   // skipSave：避免 backToTitle 重新保存
            }},
          ],
        })
      })
    }, 50)
  }

  /* ============ 新游戏 / 读档 ============ */

  /** 前端假密码只作为彩蛋门槛；真正的权限控制不能依赖浏览器端代码。 */
  const CHEAT_PASSWORD = 'DMJ666'
  function showCheatGate () {
    if (!DEBUG_ENABLED || !State.get()) return
    const verify = () => {
      const input = document.getElementById('cheat-password')
      const error = document.getElementById('cheat-password-error')
      if (String(input && input.value || '').trim().toUpperCase() === CHEAT_PASSWORD) {
        Dialog.close()
        showCheatMenu()
        return
      }
      if (error) error.textContent = '密码不正确，请重新输入。'
      if (input) { input.select(); input.focus() }
    }

    Dialog.show({
      title: '🔒 作弊入口',
      className: 'cheat-gate-modal',
      body: `
        <p style="color:var(--text-dim);font-size:.82rem;margin-bottom:10px">输入管理员密码以打开作弊 / 调试菜单。</p>
        <label for="cheat-password" style="display:block;color:var(--text-dim);font-size:.72rem;margin-bottom:5px">管理员密码</label>
        <input type="password" id="cheat-password" placeholder="请输入密码" autocomplete="off"
          style="width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--panel-2);color:var(--text);font-size:1rem" />
        <p id="cheat-password-error" role="alert" aria-live="polite" style="min-height:1.5em;margin-top:6px;color:var(--danger);font-size:.75rem"></p>`,
      actions: [
        { label: '取消', handler: () => Dialog.close() },
        { label: '进入', cls: 'btn-primary', handler: verify },
      ],
    })
    requestAnimationFrame(() => {
      const input = document.getElementById('cheat-password')
      if (!input) return
      input.focus()
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); verify() }
      })
    })
  }

  /** 作弊菜单（分类面板） */
  function showCheatMenu () {
    const state = State.get()
    if (!state) return

    const sect = (title, btns) => `
      <div style="margin-bottom:14px">
        <div style="font-size:.78rem;color:var(--text-dim);margin-bottom:6px">${title}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${btns}</div>
      </div>`

    const cheatBtn = (id, label, cls = '') =>
      `<button class="btn ${cls}" data-cheat="${id}" style="font-size:.8rem;padding:8px 6px">${label}</button>`

    Dialog.show({
      title: '🎮 作弊',
      className: 'cheat-modal',
      body: `
        <div style="background:var(--panel-2);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:12px">
          <div style="font-size:.78rem;color:var(--danger);margin-bottom:4px">⚠️ 作弊会影响游戏平衡</div>
          <div style="font-size:.8rem;color:var(--text-dim)">作弊会立即生效并自动存档，建议备份存档后再用。</div>
        </div>
        ${sect('🧭 基础资源', cheatBtn('cheat-hp', '❤️ 回满 HP') + cheatBtn('cheat-gold', '💰 金币 +500') + cheatBtn('cheat-supply', '🎒 全补给 ×5') + cheatBtn('cheat-clear-status', '✨ 清除状态'))}
        ${sect('⚔️ 战斗', cheatBtn('cheat-kill', '💀 击杀当前敌人') + cheatBtn('cheat-win', '🏆 直接通关') + cheatBtn('cheat-god', '🛡️ 无敌模式', 'btn-cheat') + cheatBtn('cheat-orb', '🔮 力量宝珠') )}
        ${sect('🧰 装备', cheatBtn('cheat-weapons', '⚔️ 全部武器') + cheatBtn('cheat-accessories', '📿 全部饰品') + cheatBtn('cheat-items', '🧪 全部消耗品') + cheatBtn('cheat-material', '🔧 升级材料 ×3'))}
        ${sect('🔧 调试', cheatBtn('cheat-goto', '📍 移动到坐标') + cheatBtn('cheat-mob', '👺 遭遇怪物') + cheatBtn('cheat-boss', '👑 遭遇 BOSS') + cheatBtn('cheat-position', '📌 查看坐标'))}
      `,
      actions: [{ label: '关闭', handler: () => Dialog.close() }],
    })

    setTimeout(() => {
      document.querySelectorAll('[data-cheat]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.cheat
          // 调试指令：单独处理，需要交互弹窗
          if (id === 'cheat-goto') { cheatGoto(); return }
          if (id === 'cheat-mob') { cheatEncounter(); return }
          if (id === 'cheat-boss') { cheatBoss(); return }
          if (id === 'cheat-position') { cheatPosition(); return }
          const msg = runCheat(id)
          if (msg) EventBus.emit('ui:log', { text: msg, type: 'good' })
          EventBus.emit('state:changed', State.get())
          Dialog.close()
        }
      })
    }, 50)
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
        return `💰 金币 +500（当前 ${state.gold}）。`
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
          if (!state.inventory.accessories.includes(a.id)) state.inventory.accessories.push(a.id)
          if (a.effect && a.effect.stat === 'maxHp') {
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
    }
    return ''
  }

  /** 作弊：击杀当前敌人（战斗/伏击中） */
  function cheatKillEnemy () {
    const state = State.get()
    if (state._battle) {
      // 战斗中：直接结束并给战利品
      state._battle.targets = []
      state.defeated.push(state._battle.enemyId)
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
    showBossVictory()
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
          state.position = { x, y }
          state.visited.push({ x, y })
          state.phase = 'idle'
          Dialog.close()
          EventBus.emit('state:changed', state)
          EventBus.emit('ui:mapUpdate', {})
          EventBus.emit('ui:log', { text: `📍 已传送到 (${x},${y})。`, type: 'good' })
          if (document.getElementById('cheat-goto-trigger').checked) {
            // 传送后触发格子事件（如该格是战斗/BOSS）
            const tile = MapLib.get(x, y)
            if (tile) NodeEvents.trigger(tile, x, y)
          } else {
            readyToRoll()
          }
        } },
      ],
    })
    setTimeout(() => {
      const xi = document.getElementById('cheat-goto-x')
      if (xi) { xi.value = state.position.x; xi.focus() }
      const yi = document.getElementById('cheat-goto-y')
      if (yi) yi.value = state.position.y
    }, 50)
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
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">${cards}</div>
        <button class="btn btn-danger" id="cheat-mob-boss" style="width:100%">👑 森林之灵（BOSS）</button>
      `,
      actions: [{ label: '取消', handler: () => Dialog.close() }],
    })
    setTimeout(() => {
      document.querySelectorAll('.cheat-mob-card').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.mob
          Dialog.close()
          state._battle = null
          state._ambush = null
          BattleSystem.start(id)
          EventBus.emit('ui:log', { text: `👺 调试：遭遇 ${DATA.monster(id).name}。`, type: 'good' })
        }
      })
      const bossBtn = document.getElementById('cheat-mob-boss')
      if (bossBtn) bossBtn.onclick = () => {
        Dialog.close()
        state._battle = null
        state._ambush = null
        BattleSystem.start('spirit_of_forest')
        EventBus.emit('ui:log', { text: '👑 调试：遭遇森林之灵（BOSS）。', type: 'good' })
      }
    }, 50)
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

    setTimeout(() => {
      document.querySelectorAll('[data-diff]').forEach(btn => {
        btn.onclick = () => {
          const diff = btn.dataset.diff
          Dialog.close()
          askPlayerName(diff)
        }
      })
    }, 50)
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
        <button type="button" class="gender-opt faction-opt ${f.id === factionId ? 'is-selected' : ''}" data-faction="${f.id}" style="grid-template-columns:1fr">
          <span style="font-size:1.5rem">${f.icon}</span>
          <b>${f.name}</b>
        </button>`).join('')
      const labelsHtml = factionOf(factionId).labels.map(l => `
        <button type="button" class="gender-label ${l.id === labelId ? 'is-selected' : ''}" data-label="${l.id}">${l.label}</button>`).join('')
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
      setTimeout(() => {
        document.querySelectorAll('.faction-opt').forEach(btn => {
          btn.onclick = () => {
            factionId = btn.dataset.faction
            labelId = factionOf(factionId).labels[1].id   // 切换阵营默认选第 2 个标签
            render()
          }
        })
        document.querySelectorAll('.gender-label').forEach(btn => {
          btn.onclick = () => {
            labelId = btn.dataset.label
            document.querySelectorAll('.gender-label').forEach(b => b.classList.remove('is-selected'))
            btn.classList.add('is-selected')
          }
        })
      }, 50)
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
    EventBus.emit('ui:log', { text: '🏘️ 村庄已成废墟。向东进入营地，向西进入森林。', type: 'dim' })
    // 新游戏初始化后立即存档，防止刷新丢失进度
    State.save()
    // 新手引导：进入营地找鹿（出生点右侧）
    readyToRoll()
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

    if (state.phase === 'battle') {
      // 存档已恢复 _battle 全部战况（HP/回合/反射/格挡），只重建 UI
      if (BattleUI.resume) BattleUI.resume()
    } else if (state.phase === 'shop') {
      ShopSystem.open(null)
    } else if (state.phase === 'camp') {
      CampSystem.open()
    } else if (state._guardSearchPending && typeof CampSystem !== 'undefined' && CampSystem.resumeGuardSearch) {
      // 城门搜身断点：恢复剩余倒计时并继续检查（不重复结算）
      CampSystem.resumeGuardSearch()
    } else {
      // 恢复移动存档：剩余步数 + 来源格 + 转向状态
      if (state._moveState && (state._moveState.steps || 0) > 0) {
        _stepsRemaining = state._moveState.steps
        _turning = !!state._moveState.turning
        if (state._moveState.prevPos && state._moveState.prevPos.x >= 0) {
          _prevPos = { x: state._moveState.prevPos.x, y: state._moveState.prevPos.y }
        }
        readyToRoll(true)   // 保留步数，进入继续移动/转向界面
        return
      }
      readyToRoll()
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
  function showActionBar () {
    const bar = document.getElementById('action-bar')
    if (bar) bar.classList.remove('hidden')
    const float = document.getElementById('dpad-float')
    if (float) float.classList.add('hidden')
  }

  function readyToRoll (keepSteps) {
    if (State.get().phase === 'gameover') return
    State.update(s => s.phase = 'idle')
    if (!keepSteps) {
      _stepsRemaining = 0
      _turning = false
    }
    _isWalking = false

    // 同步移动状态到存档（岔路暂停时保留剩余步数）
    State.update(s => {
      if (_turning && _stepsRemaining > 0) s._moveState = { steps: _stepsRemaining, turning: true }
      else s._moveState = null
    }, true)

    hint.textContent = _stepsRemaining > 0
      ? `🧭 选择方向继续移动（剩余 ${_stepsRemaining} 步）`
      : '🧭 选择方向（点击后掷 Y 移动）'

    // 统一浮动方向键（比操作栏更可靠，避免响应式断点问题）
    btns.innerHTML = ''
    const actionBar = document.getElementById('action-bar')
    if (actionBar) actionBar.classList.add('hidden')
    const float = document.getElementById('dpad-float')
    // 先确保显示（即使 buildDpad 出错也不影响）
    if (float) {
      float.style.left = ''
      float.style.top = ''
      float.style.right = ''
      float.style.bottom = ''
      float.classList.remove('hidden')
    }
    try {
      if (float) {
        float.innerHTML = buildDpad()
        bindDpad()
        makeDraggable(float)
        const itemBtn = document.getElementById('btn-move-item')
        if (itemBtn) itemBtn.onclick = showMoveItemMenu
      }
    } catch (e) {
      console.error('方向键渲染失败:', e)
    }
    // 延迟重试：确保浮动键在 DOM 就绪后显示（新建游戏时可能因布局未稳定而隐藏）
    clearTimeout(_readyToRollTimer)
    _readyToRollTimer = setTimeout(() => {
      const float2 = document.getElementById('dpad-float')
      if (float2 && float2.classList.contains('hidden')) {
        float2.classList.remove('hidden')
      }
    }, 200)
  }

  /** 移动阶段使用物品（非战斗，可随意使用治疗/解毒类） */
  function showMoveItemMenu () {
    const state = State.get()
    if (!state) return
    // 只显示可在移动阶段使用的物品（治疗/解毒/再生），满血时排除治疗类
    const items = Object.entries(state.inventory.consumables)
      .filter(([id, v]) => {
        if (v <= 0) return false
        const item = ItemLib.get(id)
        if (!item) return false
        const e = item.effect
        // 非战斗道具：治疗 / 治愈状态 / 再生
        if (!(e.heal || e.cure || e.regen)) return false
        // 满血时不用治疗类
        if (e.heal && state.hp >= state.maxHp) return false
        return true
      })
    // 没有任何可用道具且未塞入巨肛塞 → 无需打开菜单
    if (!items.length && !state._plugActive) {
      EventBus.emit('ui:log', { text: '没有可在移动时使用的物品。', type: 'dim' })
      return
    }

    let html = items.map(([id, count]) => {
      const item = ItemLib.get(id)
      return `<button class="btn move-item-use" data-item="${id}" style="display:block;width:100%;text-align:left;margin:6px 0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b>${item.name}</b>
          <span style="color:var(--gold)">×${count}</span>
        </div>
        <div style="font-size:.78rem;color:var(--text-dim);margin-top:3px">${item.desc}</div>
      </button>`
    }).join('')

    // 已塞入可取下塞入物时，提供取下入口
    if (state._plugActive) {
      const plugItem = ItemLib.get(state._plugActive)
      html = `<button class="btn btn-danger move-plug-remove" style="display:block;width:100%;text-align:left;margin:6px 0">🍑 取下${plugItem ? plugItem.name : '塞入物'}（放回背包，清除剩余格挡）</button>` + html
    }

    Dialog.show({
      title: '🎒 使用物品（移动时）',
      body: html,
      actions: [{ label: '关闭', handler: () => Dialog.close() }],
    })

    setTimeout(() => {
      const plugBtn = document.querySelector('.move-plug-remove')
      if (plugBtn) {
        plugBtn.onclick = () => {
          const result = ShopSystem.removePlug()
          Dialog.close()
          if (!result.ok) EventBus.emit('ui:log', { text: result.msg, type: 'danger' })
          else showMoveItemMenu()
        }
      }
      document.querySelectorAll('.move-item-use').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.item
          const result = ShopSystem.useConsumable(id)
          Dialog.close()
          if (!result.ok) {
            EventBus.emit('ui:log', { text: result.msg, type: 'danger' })
          } else {
            // 使用日志由 ShopSystem.useConsumable 统一输出
            // 可继续用，重新打开
            showMoveItemMenu()
          }
        }
      })
    }, 50)
  }

  /** 让元素可拖动（pointer events，兼容触摸/鼠标） */
  function makeDraggable (el) {
    if (el._draggable) return
    el._draggable = true
    let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false, moved = false

    el.addEventListener('pointerdown', (e) => {
      // 点击内部按钮不触发拖动
      if (e.target.closest && e.target.closest('button')) return
      dragging = true
      moved = false
      startX = e.clientX
      startY = e.clientY
      const rect = el.getBoundingClientRect()
      startLeft = rect.left
      startTop = rect.top
      el.setPointerCapture && el.setPointerCapture(e.pointerId)
    })
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      // 超过阈值才算拖动，避免误触按钮
      if (!moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return
      moved = true
      el.style.left = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx)) + 'px'
      el.style.top = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy)) + 'px'
      el.style.right = 'auto'
      el.style.bottom = 'auto'
    })
    el.addEventListener('pointerup', () => { dragging = false })
    el.addEventListener('pointercancel', () => { dragging = false })
  }

  /** 清理浮动方向键（战斗/移动结束时） */
  function clearFloatDpad () {
    const float = document.getElementById('dpad-float')
    if (float) float.classList.add('hidden')
  }

  /** 生成十字方向键 */
  function buildDpad () {
    const state = State.get()
    const pos = state.position
    const dirs = [
      { key: 'n', dx: 0, dy: -1, label: '北', icon: '↑' },
      { key: 's', dx: 0, dy: 1, label: '南', icon: '↓' },
      { key: 'w', dx: -1, dy: 0, label: '西', icon: '←' },
      { key: 'e', dx: 1, dy: 0, label: '东', icon: '→' },
    ]
    const dirBtn = (d) => {
      const nx = pos.x + d.dx
      const ny = pos.y + d.dy
      const walkable = MapLib.isWalkable(nx, ny)
      // 岔路转向：禁用来路（同一回合不能回头）
      const isBack = _turning && _prevPos && _prevPos.x === nx && _prevPos.y === ny
      const tile = MapLib.get(nx, ny)
      const tileName = tile ? (tile.raw || tile.type) : '墙壁'
      const cls = (walkable && !isBack) ? 'dpad-btn dpad-active' : 'dpad-btn dpad-disabled'
      return `<button class="${cls}" data-dir="${d.key}" ${(walkable && !isBack) ? '' : 'disabled'}>
        <span class="dpad-arrow">${d.icon}</span>
        <span class="dpad-label">${d.label}</span>
        <span class="dpad-tile">${tileName}</span>
      </button>`
    }
    // 3×3 网格布局：物品在左上角空位（北的左、西的上）
    const centerLabel = _stepsRemaining > 0
      ? `<div class="dpad-center">🎲<span>剩${_stepsRemaining}步</span></div>`
      : `<div class="dpad-center">🎲<span>掷Y</span></div>`
    return `
      <div class="dpad dpad-grid">
        <button class="dpad-btn dpad-item-btn" id="btn-move-item" title="使用物品">
          <span class="dpad-arrow">🧪</span>
          <span class="dpad-label">物品</span>
        </button>
        ${dirBtn(dirs[0])}
        <div class="dpad-void"></div>
        ${dirBtn(dirs[2])}
        ${centerLabel}
        ${dirBtn(dirs[3])}
        <div class="dpad-void"></div>
        ${dirBtn(dirs[1])}
        <div class="dpad-void"></div>
      </div>
    `
  }

  /** 绑定十字键 */
  function bindDpad () {
    document.querySelectorAll('[data-dir]').forEach(btn => {
      btn.onclick = () => {
        const dirKey = btn.dataset.dir
        onMoveDirection(dirKey)
      }
    })
  }

  /** 返回主菜单（标题页） */
  function backToTitle (skipSave) {
    if (!skipSave) State.save()  // 离开前保存（删除存档时跳过）
    gameScreen.classList.add('screen-hidden')
    titleScreen.classList.remove('screen-hidden')
    // 回到标题页：隐藏顶栏
    const topbar = document.getElementById('topbar')
    if (topbar) topbar.classList.add('hidden')
    window.scrollTo(0, 0)
    // 重新绑定标题页按钮
    document.getElementById('btn-new-game').onclick = showDifficultyDialog
    document.getElementById('btn-rules').onclick = () => Dialog.showRules()
    document.getElementById('btn-changelog').onclick = showChangelog
    // 有存档则显示"加载存档"按钮
    const contBtn = document.getElementById('btn-continue')
    if (State.hasSave()) {
      contBtn.classList.remove('btn-hidden')
      contBtn.onclick = () => loadGame()
    } else {
      contBtn.classList.add('btn-hidden')
    }
  }

  /** 选方向后掷 Y 直线移动 */
  async function onMoveDirection (dirKey) {
    if (_moveLocked) return   // 运行锁：防止重复触发
    _moveLocked = true

    const state = State.get()

    // 有剩余步数（岔路转向 / 直线移动中断恢复）：不重新掷骰，直接沿新方向继续走
    if (_stepsRemaining > 0) {
      _turning = false
      hint.textContent = '🎲 继续移动……'
      btns.innerHTML = ''
      clearFloatDpad()
      const dirs = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }
      const [dx, dy] = dirs[dirKey] || [0, 0]
      _isWalking = true
      try {
        await autoWalk(dx, dy)
      } finally {
        _moveLocked = false
      }
      if (State.get().phase !== 'battle') {
        StatusSystem.tickOutOfBattle()
      }
      return
    }

    hint.textContent = '🎲 掷骰中……'
    btns.innerHTML = ''
    clearFloatDpad()   // 移动时隐藏浮动方向键

    let steps = MovementSystem.rollStep()
    let injuredDmg = 0

    // 定时锁：每回合递减，到点自动解开
    if (typeof RestraintSystem !== 'undefined') RestraintSystem.tickTimers()

    // 脚镣/脚链：移动步数 -1（可叠加，最低 1 格）
    if (typeof RestraintSystem !== 'undefined') {
      let slow = 0
      if (RestraintSystem.hasLegCuffs()) slow++
      if (RestraintSystem.hasAnkleChains()) slow++
      if (slow > 0 && steps > 1) {
        steps = Math.max(1, steps - slow)
        EventBus.emit('ui:log', { text: '🦶 铁链拖着你的步子，挪动变慢了（步数 -' + slow + '）。', type: 'danger' })
      }
    }

    // 受伤状态：移动减速 + 扣血
    if (StatusSystem.has('injured')) {
      const injuredEffect = state.statuses.find(s => s.id === 'injured')
      const def = STATUS_EFFECTS['injured']
      const moveData = { steps, damage: 0 }
      const result = def.onMove(state, injuredEffect, moveData)
      steps = result.steps
      injuredDmg = result.damage
      if (steps !== moveData.steps || injuredDmg > 0) {
        EventBus.emit('ui:log', { text: `🩹 受伤状态：移动${steps}格，扣 ${injuredDmg} HP`, type: 'danger' })
      }
    }

    _stepsRemaining = steps
    // 移动中：写入存档状态，读档后恢复剩余步数
    state._moveState = { steps: _stepsRemaining, turning: false, prevPos: { x: _prevPos.x, y: _prevPos.y } }

    try {
      await Dialog.showDice(steps, 'Y')
    } catch (e) {
      console.error('骰子动画异常:', e)
    }

    if (injuredDmg > 0) {
      if (!State.get()._godMode) state.hp -= injuredDmg
      EventBus.emit('state:changed', state)
    }

    if (state.hp <= 0) {
      _isWalking = false
      state.phase = 'gameover'
      EventBus.emit('game:gameover', {})
      return
    }

    if (_stepsRemaining <= 0) {
      StatusSystem.tickOutOfBattle()
      readyToRoll()
      // 步数耗尽移动结束：佣兵可能发情袭击
      if (State.get().phase !== 'battle' && State.get().phase !== 'gameover') {
        await maybeMercenaryAssault()
      }
      return
    }

    const dirs = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }
    const [dx, dy] = dirs[dirKey] || [0, 0]
    _isWalking = true
    try {
      await autoWalk(dx, dy)
    } finally {
      _moveLocked = false
    }

    if (State.get().phase !== 'battle') {
      StatusSystem.tickOutOfBattle()
    }
    // 移动轮次结束：佣兵可能因发情强制袭击
    if (State.get().phase !== 'battle' && State.get().phase !== 'gameover') {
      await maybeMercenaryAssault()
    }
  }

  /* ============ 佣兵发情袭击（移动后） ============ */
  /** 移动结束后：佣兵发情 ≥50 时按 lust% 概率强制袭击 */
  async function maybeMercenaryAssault () {
    const state = State.get()
    const merc = state._mercenary
    if (!merc || merc.dead) return
    const lust = merc.lust || 0
    if (lust < 50) return
    // 掷骰：随机 0-99，小于 lust → 触发
    const roll = Math.floor(Math.random() * 100)
    if (roll >= lust) return
    EventBus.emit('ui:log', { text: `🔥 ${merc.icon} ${merc.name} 欲火中烧，从背后一把抱住了你（发情 ${lust}%，触发了 ${roll}%）！`, type: 'danger' })
    // 随机选服务类型：口交 / 肛交 / 性交（女性、且未佩戴贞操装置才能性交）
    const canSex = state.gender !== 'male' && !ChastitySystem.isWorn()
    const pool = canSex ? ['oral', 'anal', 'sex'] : ['oral', 'anal']
    const type = pool[Math.floor(Math.random() * pool.length)]
    await forcedMercenaryService(type, merc)
  }

  /** 强制佣兵服务任务（移动中被袭击） */
  async function forcedMercenaryService (type, merc) {
    const state = State.get()
    const cfg = {
      oral: { name: '强迫口交', dmg: 20, desc: '她揪着你的头发，把鸡巴狠狠塞进你嘴里，逼你深喉', seconds: 30 },
      anal: { name: '强迫肛交', dmg: 30, desc: '她把你按在树干上，从背后猛地操进你的菊穴', seconds: 30 },
      sex: { name: '强迫性交', dmg: 30, desc: '她把你压在身下，挺着鸡巴狠狠操进你的小穴', seconds: 30 },
    }[type]
    if (!cfg) return
    let failed = false
    if (typeof BattleUI !== 'undefined' && BattleUI.showTaskDialog) {
      const f = await BattleUI.showTaskDialog({
        enemyName: `${merc.icon} ${merc.name}`,
        attackName: cfg.name,
        desc: cfg.desc,
        bpm: 90,
        seconds: cfg.seconds,
        dmg: 0,
        noDamage: true,
        dildoName: '她那根粗壮的鸡巴',
      })
      failed = f
    } else {
      failed = !confirm(`${cfg.name}：完成代表挨完了。`)
    }
    // 强制：完成降全欲；中途承受不住降一半
    const lustDrop = failed ? Math.floor(cfg.dmg / 2) : cfg.dmg
    merc.lust = Math.max(0, (merc.lust || 0) - lustDrop)
    EventBus.emit('ui:log', { text: failed
      ? `🥵 你被${merc.icon} ${merc.name}操得腿软求饶，她才放过你（性欲 -${lustDrop}）。`
      : `💦 ${merc.icon} ${merc.name} 满足地泄了身，放过你继续上路（性欲 -${lustDrop}）。`, type: 'danger' })
    EventBus.emit('state:changed', state)
  }

  /* ============ 沿方向直线移动 ============ */
  async function autoWalk (dx, dy) {
    while (_isWalking && _stepsRemaining > 0) {
      const state = State.get()
      const { x, y } = state.position

      // 目标格 = 当前格 + 方向
      const nx = x + dx
      const ny = y + dy

      // 撞墙或无路 → 停止
      if (!MapLib.isWalkable(nx, ny)) {
        EventBus.emit('ui:log', { text: '🚧 前方是墙/边界，停止移动。', type: 'dim' })
        break
      }

      _prevPos = { x, y }
      const res = await stepTo({ x: nx, y: ny })
      if (res === 'stopped') { _isWalking = false; return }
      if (res === 'ambush') { _isWalking = false; readyToRoll(); return }

      // 走到新格后判断岔路：排除来路(回头)后的可走方向
      const cur = State.get().position
      const neighbors = MapLib.neighbors(cur.x, cur.y)
      const openDirs = neighbors.filter(n => !(n.x === x && n.y === y))
      if (openDirs.length >= 2 && _stepsRemaining > 0 && State.get().phase === 'idle') {
        // 三岔/十字路口：暂停让玩家选择新方向
        EventBus.emit('ui:log', { text: `🔀 三岔路口！停下重新选择方向（剩 ${_stepsRemaining} 步）。`, type: 'dim' })
        _isWalking = false
        _turning = true
        readyToRoll(true)   // 保留剩余步数，选方向后继续走
        return
      }
      if (openDirs.length === 1 && _stepsRemaining > 0 && State.get().phase === 'idle') {
        // 只有唯一继续方向：若非原方向则自动拐弯，否则直线继续
        const next = openDirs[0]
        const forward = { x: cur.x + dx, y: cur.y + dy }
        if (!(next.x === forward.x && next.y === forward.y)) {
          // 直接改变方向继续走（不暂停），剩余步数保留
          const ndx = next.x - cur.x
          const ndy = next.y - cur.y
          dx = ndx
          dy = ndy
          continue
        }
      }
      if (openDirs.length === 0 && neighbors.length === 1 && _stepsRemaining > 0 && State.get().phase === 'idle') {
        // 走进死路时自动掉头，避免宝箱等尽头格吞掉剩余步数。
        const back = neighbors[0]
        dx = back.x - cur.x
        dy = back.y - cur.y
        continue
      }
    }

    // 步数耗尽或撞墙 → 触发当前格子事件（传送阵/宝藏已在经过时触发）
    _isWalking = false
    const state = State.get()
    const finalTile = MapLib.get(state.position.x, state.position.y)
    // 站在传送阵上：询问是否传送
    if (finalTile && finalTile.type === TILE.CHECKPOINT && typeof TeleportSystem !== 'undefined') {
      TeleportSystem.ask()
      return
    }
    if (finalTile && finalTile.type !== TILE.CHECKPOINT && finalTile.type !== TILE.EMPTY && finalTile.type !== TILE.START && finalTile.type !== TILE.TREASURE && finalTile.type !== TILE.AMBUSH) {
      NodeEvents.trigger(finalTile, state.position.x, state.position.y)
      return  // 事件接管流程，结束后通过 game:readyToMove 恢复
    }

    readyToRoll()
  }

  /** 走一步到目标格子 */
  async function stepTo (target) {
    const state = State.get()
    const fromX = state.position.x
    const fromY = state.position.y
    state.position = { x: target.x, y: target.y }
    state.visited.push({ x: target.x, y: target.y })
    const tile = MapLib.get(target.x, target.y)

    // 空地不消耗步数
    if (tile.type !== TILE.EMPTY) _stepsRemaining--

    // 移动中同步剩余步数到存档状态（中断档时恢复）
    if (state._moveState) {
      state._moveState.steps = _stepsRemaining
      state._moveState.prevPos = { x: fromX, y: fromY }
    }

    EventBus.emit('movement:arrive', { x: target.x, y: target.y, tile })
    EventBus.emit('ui:mapUpdate', {})
    EventBus.emit('state:changed', state)

    // 传送阵经过即触发：激活 + 回满 HP + 存档
    if (tile.type === TILE.CHECKPOINT) {
      const tp = typeof TeleportSystem !== 'undefined' ? TeleportSystem.byPos(target.x, target.y) : null
      if (tp) TeleportSystem.activate(tp.id)
      state.hp = state.maxHp
      EventBus.emit('ui:log', { text: tp ? `🌀 路过${tp.name}，HP 回满。` : '🌀 经过传送阵，HP 回满。', type: 'good' })
      State.save()
      EventBus.emit('state:changed', state)
    }

    // 伏击经过即触发（反复掷骰直到双数）
    if (tile.type === TILE.AMBUSH) {
      await AmbushSystem.trigger()
      return 'ambush'
    }

    // 宝藏经过即触发
    if (tile.type === TILE.TREASURE) {
      const treasureResult = await TreasureSystem.roll({ continueMovement: _stepsRemaining > 0 })
      // 宝箱可能启动守卫战斗 / 贪婪恶魔弹窗，此时需停止移动
      if (treasureResult === 'battle' || State.get().phase === 'battle' || State.get()._battle) {
        _isWalking = false
        return 'stopped'
      }
      if (treasureResult === 'resume') {
        hint.textContent = `🚶 收好宝藏，继续前进（剩余 ${_stepsRemaining} 步）`
      }
    }

    // 营地经过即触发（打开营地菜单）
    if (tile.type === TILE.CAMP) {
      hint.textContent = '⛺ 进入营地……'
      _isWalking = false
      // 记录进入营地前的位置，离开时回到这里（避免困在营地格只能回头）
      if (typeof CampSystem !== 'undefined' && CampSystem.open) {
        const st = State.get()
        if (st) st._campReturnPos = { x: fromX, y: fromY }
        CampSystem.open({ gateEntry: true })
      }
      return 'stopped'
    }

    // 商店经过时可选停留
    if (tile.type === TILE.SHOP && _stepsRemaining > 0) {
      hint.textContent = '🏪 路过商店……'
      return new Promise(resolve => {
        Dialog.show({
          title: '🏪 发现商店！',
          body: '<p style="color:var(--text-dim)">你路过一间商店，是否停留？</p>',
          actions: [
            { label: '🛒 停留购物', cls: 'btn-primary', handler: () => {
              Dialog.close()
              _isWalking = false
              ShopSystem.open(tile)
              resolve('stopped')
            } },
            { label: '⏭ 继续前进', handler: () => {
              Dialog.close()
              hint.textContent = '🚶 继续前进……'
              setTimeout(() => resolve('continue'), 250)
            } },
          ],
        })
      })
    }

    // 小延迟
    await new Promise(r => setTimeout(r, 250))
    return 'continue'
  }

  /* ============ 事件监听 ============ */

  // 战斗/商店/陷阱等事件结束后，回到掷骰阶段
  EventBus.on('game:readyToMove', () => {
    const st = State.get()
    // 事件结束后无条件恢复移动（商店/陷阱/弹窗关闭等），不依赖 _isWalking
    if (!st || st.phase === 'battle' || st.phase === 'gameover' || st.phase === 'shop') return
    _isWalking = false
    _moveLocked = false
    readyToRoll()
  })

  EventBus.on('game:gameover', () => {
    _isWalking = false
    showActionBar()
    const wasBoss = State.get()._battle && State.get()._battle.enemyId === 'spirit_of_forest'

    if (wasBoss) {
      // BOSS 战死亡：可读取战前存档带全部物品重开
      hint.textContent = '💀 你被森林之灵击败了……'
      btns.innerHTML = `
        <button class="btn btn-primary" id="btn-retry-boss">🔄 读取战前存档重开 (带全部物品)</button>
        <button class="btn btn-danger" id="btn-respawn">🏘️ 返回检查点 (金币减半)</button>
      `
      document.getElementById('btn-retry-boss').onclick = retryBossFromSave
      document.getElementById('btn-respawn').onclick = respawn
      EventBus.emit('boss:defeat')  // 落败剧情
      return
    }

    hint.textContent = '💀 你死了……'
    btns.innerHTML = `<button class="btn btn-danger" id="btn-respawn">等待重生</button>`
    document.getElementById('btn-respawn').onclick = respawn
  })

  /** BOSS 战死亡：读取战前存档，带全部物品回到 BOSS 前 */
  function retryBossFromSave () {
    const saved = State.loadBossCheckpoint()
    if (!saved) {
      EventBus.emit('ui:log', { text: '⚠️ 没有找到战前存档！', type: 'danger' })
      respawn()
      return
    }
    State.migrate(saved)
    const state = State.get()
    state._battle = null
    state._moveState = null
    state.phase = 'idle'
    state.hp = state.maxHp
    EventBus.emit('ui:log', { text: '🔄 已读取战前存档，带全部物品重新挑战！', type: 'good' })
    EventBus.emit('state:changed', state)
    // 回到 BOSS 前检查点
    backToCheckpoint()
    readyToRoll()
  }

  function respawn () {
    const state = State.get()
    const hadGreed = StatusSystem.has('greed_demon')
    // 清理战斗/伏击残留（防伏击死亡后状态残留导致无法正常行动）
    state._battle = null
    state._ambush = null
    state._pendingLootEvent = null
    state.gold = Math.floor(state.gold * 0.5)
    backToCheckpoint()
    state.phase = 'idle'
    state.statuses = []
    EventBus.emit('ui:log', { text: `金币减半至 ${state.gold}G。`, type: 'dim' })
    EventBus.emit('state:changed', state)
    // 死亡后贪婪恶魔消失，提示摘下乳夹
    if (hadGreed) {
      Dialog.show({
        title: '😈 贪婪恶魔消失了',
        body: `
          <p>你死了，贪婪恶魔也随之消失了……</p>
          <p style="color:var(--text-dim);margin-top:6px">（请取下<b>乳夹</b>）</p>
          <p style="color:var(--text-dim);font-size:.85rem;margin-top:4px">金币不再翻倍了。</p>
        `,
        actions: [
          { label: '取下乳夹', cls: 'btn-primary', handler: () => { Dialog.close(); readyToRoll() } },
        ],
      })
      return
    }
    readyToRoll()
  }

  function backToCheckpoint () {
    const state = State.get()
    for (let i = state.visited.length - 1; i >= 0; i--) {
      const v = state.visited[i]
      const tile = MapLib.get(v.x, v.y)
      if (tile && tile.type === TILE.CHECKPOINT) {
        state.position = { x: v.x, y: v.y }
        state.hp = state.maxHp
        return
      }
    }
    state.position = { x: MapLib.start.x, y: MapLib.start.y }
    state.hp = state.maxHp
  }

  /* ============ BOSS 结局 ============ */
  // 战斗开始时记录来源格到 battle（读档后投降/逃跑仍可退回）
  EventBus.on('battle:start', (data) => {
    const b = data && data.battle
    if (b && _prevPos && _prevPos.x >= 0 && _prevPos.y >= 0) {
      b.prevPos = { x: _prevPos.x, y: _prevPos.y }
    }
  })

  EventBus.on('battle:end', (data) => {
    const state = State.get()
    TreasureSystem.settleGuardian(data)
    if (data.fled) {
      // 逃跑/投降成功：退回来源格，避免困在战斗格反复遭遇
      // 优先用战斗存档里的 prevPos（读档后 _prevPos 已丢失），否则用内存 _prevPos
      const back = (data.prevPos && data.prevPos.x >= 0) ? data.prevPos : _prevPos
      if (back && back.x >= 0 && back.y >= 0 && MapLib.isWalkable(back.x, back.y)) {
        state.position = { x: back.x, y: back.y }
        EventBus.emit('ui:log', { text: `🏳️ 你回到了之前的位置 (${back.x},${back.y})`, type: 'dim' })
      }
      return
    }
    // 打赢敌人：酒馆赌客会回来（之前被赢光后离开）
    if (data.victory && (state._tavernGuest || 0) <= 0) {
      state._tavernGuest = 50
      EventBus.emit('ui:log', { text: '🍺 你打赢了敌人，酒馆的赌客又回来了，兜里重新揣着 50G。', type: 'good' })
      EventBus.emit('state:changed', state)
    }
    if (data.victory && data.enemyId === 'spirit_of_forest') {
      // 标记 BOSS 已击败
      State.update(s => { s.bossDefeated = true })
      State.clearBossCheckpoint()
      State.save()
      showBossVictory()
    }
  })

  function showBossVictory () {
    const state = State.get()
    showActionBar()
    const lover = loverTerm(state.gender)
    hint.textContent = '🎉 你击败了森林之灵！'
    EventBus.emit('ui:log', { text: '🎉 你杀死了森林之灵，疯长的村庄开始恢复原样。', type: 'good' })
    EventBus.emit('ui:log', { text: `所有村民从森林中走出，你看到了你的${lover.term}！`, type: 'good' })
    const naughty = state.gender === 'male'
      ? `<p>你看到女友，立刻把她带回家狠狠干了一场。</p>
         <p class="boss-ending-note">如果你想要，她会用绑带假阳具干你，最后你射进她里面。</p>`
      : `<p>你看到男友，立刻把他带回家狠狠干了一场。</p>
         <p class="boss-ending-note">如果你想要，他会用他的粗大鸡巴干你，最后他射进你里面。</p>`
    Dialog.show({
      title: '森林重见晨光',
      className: 'boss-ending-modal boss-victory-modal',
      body: `
        <div class="boss-ending-mark">☀</div>
        <small class="boss-ending-kicker">VICTORY · 妖林终章</small>
        <p>你杀死了森林之灵，疯长的村庄开始恢复原样。所有村民从森林中走出，浑然不知刚才发生了什么。</p>
        <div class="boss-ending-divider"><i></i><span>✦</span><i></i></div>
        ${naughty}
      `,
      actions: [
        { label: `🏡 带${lover.pronoun}回家`, cls: 'btn-primary', handler: () => {
          Dialog.close()
          EventBus.emit('ui:log', { text: `🏡 大结局：你救回了${lover.term}，从此过上了幸福的生活。`, type: 'good' })
          btns.innerHTML = ''
          hint.textContent = '🏡 大结局！'
        }},
      ],
    })
  }

  /** BOSS 落败剧情（由 BattleUI 在 BOSS 死亡时触发） */
  EventBus.on('boss:defeat', () => {
    Dialog.show({
      title: '永恒囚笼',
      className: 'boss-ending-modal boss-defeat-modal',
      body: `
        <div class="boss-ending-mark">♛</div>
        <small class="boss-ending-kicker">DEFEAT · 森林吞噬了你</small>
        <p>她用藤蔓缠住你，滑入你的每一个洞，把你拖进森林深处。</p>
        <p>你慢慢变成一棵树，但意识仍然清醒。</p>
        <div class="boss-ending-divider"><i></i><span>◆</span><i></i></div>
        <p class="boss-ending-final">你从此成了她永恒的私人泄欲工具。</p>
      `,
      actions: [
        { label: '……', cls: 'btn-danger', handler: () => Dialog.close() },
      ],
    })
  })

  function diffName (d) { return { normal: '普通', hard: '困难', brutal: '残酷' }[d] || d }

})()
