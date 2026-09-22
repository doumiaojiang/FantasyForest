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
      if (DEBUG_ENABLED) bind('set-cheat', () => { Dialog.close(); showCheatGate() })
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
        ${sect('🔧 调试', cheatBtn('cheat-goto', '📍 移动到坐标') + cheatBtn('cheat-mob', '👺 遭遇怪物') + cheatBtn('cheat-boss', '👑 遭遇 BOSS') + cheatBtn('cheat-bandit-victory', '☠️ 桥洞胜利预览', 'btn-cheat') + cheatBtn('cheat-position', '📌 查看坐标') + cheatBtn('cheat-merc-debt', '💸 佣兵债务 +100') + cheatBtn('cheat-merc-clear', '✓ 清除佣兵债务'))}
      `,
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
          if (id === 'cheat-bandit-victory') { cheatBanditVictory(); return }
          if (id === 'cheat-position') { cheatPosition(); return }
          const msg = runCheat(id)
          if (msg) EventBus.emit('ui:log', { text: msg, type: 'good' })
          EventBus.emit('state:changed', State.get())
          Dialog.close()
        }
      })
    })
  }

  function cheatBanditVictory () {
    const state = State.get()
    if (!state || typeof CommissionSystem === 'undefined') return
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
    state._pRouteLocked = false
    state._pGateChoices = []
    state._pDayaOutcome = null
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
    CommissionSystem.resumePending()
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
