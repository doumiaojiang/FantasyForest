/**
 * state.js — 游戏状态管理（单一状态源）
 *
 * 职责：
 *  - 持有唯一的 GameState 对象
 *  - 提供 set/get 修改接口（修改后自动 emit 'state:changed'）
 *  - 序列化/反序列化，用于 localStorage 存档
 *
 * 状态对象结构（所有数据字段在此定义，保证可序列化）：
 *
 *  GameState = {
 *    difficulty: 'normal' | 'hard' | 'brutal',
 *    hp: number,
 *    maxHp: number,
 *    gold: number,
 *    position: number,        // 当前所在节点 id
 *    visited: number[],       // 已访问节点 id
 *    phase: 'idle'|'battle'|'shop'|'gameover'|'boss',
 *
 *    inventory: {
 *      consumables: { [itemId]: number },   // 消耗品数量
 *      weapon: string | null,               // 装备武器 id
 *      accessory: string | null,            // 饰品 id
 *    },
 *
 *    statuses: [                             // 当前状态效果
 *      { id: string, turnsLeft: number }
 *    ],
 *
 *    treasures: string[],                   // 已获得宝藏 id
 *    defeated: string[],                    // 已击败敌人 id（按遭遇计数）
 *    bossDefeated: boolean,
 *    rounds: number,                        // 总回合数（供统计）
 *  }
 */

window.State = (function () {
  let _state = null
  let _autoSaveTimer = null

  const SAVE_KEY = 'yaolin-qimeng-save'
  const BACKUP_SAVE_KEY = 'yaolin-qimeng-save-backup'
  const BOSS_SAVE_KEY = 'yaolin-qimeng-boss-checkpoint'
  const SAVE_VERSION = 3

  function createDefault (difficulty = 'normal') {
    const cfg = CONFIG.difficulty[difficulty] || CONFIG.difficulty.normal
    const start = CONFIG.map.start
    const state = {
      saveVersion: SAVE_VERSION,
      difficulty,
      playerName: '妖林勇者',
      gender: 'female',              // 玩家性别阵营：female 女 / male 男（逻辑用）
      genderLabel: '女性',           // 性别标签（如 公狗/母狗/男娘），HUD 显示
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
      gold: 0,
      position: { x: start.x, y: start.y },
      visited: [{ x: start.x, y: start.y }],
      phase: 'idle',

      inventory: {
        consumables: {},
        weapon: null,
        accessory: null,
        accessories: [],   // 已装备的饰品（可穿多件）
      },
      ownedEquipment: [],   // 所有购买过的装备 id（防重复购买）

      statuses: [],
      treasures: [],
      treasureComplete: false,   // 已领取第 7 个自选宝藏
      treasureBonusId: null,     // 第 7 个重复选择的宝藏 id
      _pendingGuardianTreasure: null,   // 守卫宝箱待领取 { id, gold, isFinal? }
      _pendingGuardianGold: null,       // 旧版守卫宝箱金币兼容
      _godMode: false,                  // 无敌模式（作弊）
      _noEnemyEncounters: false,        // 避敌模式：跳过普通怪物与伏击
      _pendingLootEvent: null,          // 特殊掉落事件（断触手/狼人/魔女）持久化
      _pendingBossAttack: null,         // Boss 召唤攻击持久化（任务中刷新不丢失）
      _profile: null,                    // 任务记录、战斗统计与成就领奖状态（由 StatsSystem 初始化）
      _shopReturnToCamp: false,         // 营地商店关闭后返回营地
      _activeShopRaw: null,             // 当前商店名称（读档后恢复正确的商店种类）
      defeated: [],
      bossDefeated: false,
      rounds: 0,
      logs: [],   // 冒险日志（持久化，读档恢复）
      clothesDeposited: false,   // 托管衣服给小鹿（尖石交换的代价）
      _moveState: null,     // 移动回合状态 { steps, turning }（岔路存档恢复用）
    }
    return StateSchema.prepare(state)
  }

  function get () {
    return _state
  }

  /** 取得某个领域拥有的可序列化状态。 */
  function domain (name) {
    if (!_state) return null
    return StateSchema.domain(_state, name)
  }

  function init (difficulty) {
    _state = createDefault(difficulty)
    EventBus.emit('game:init', { difficulty, state: _state })
    EventBus.emit('state:changed', _state)
    return _state
  }

  /** 合并式修改，自动触发通知 */
  function set (patch, silent = false) {
    if (!_state) return
    if (typeof patch === 'function') patch(_state)
    else Object.assign(_state, patch)
    if (!silent) EventBus.emit('state:changed', _state)
  }

  /** 深层局部修改，例如 State.update(s => s.inventory.weapon = 'master_sword') */
  function update (fn, silent = false) {
    if (!_state) return
    fn(_state)
    if (!silent) EventBus.emit('state:changed', _state)
  }

  /* ---------- 存档 ---------- */

  function save (options = {}) {
    if (!_state) return false
    try {
      _state.saveVersion = SAVE_VERSION
      const next = JSON.stringify(_state)
      const previous = localStorage.getItem(SAVE_KEY)
      if (!options.skipBackup && previous && previous !== next) {
        try {
          JSON.parse(previous)
          localStorage.setItem(BACKUP_SAVE_KEY, previous)
        } catch (_) {}
      }
      localStorage.setItem(SAVE_KEY, next)
      EventBus.emit('game:save', _state)
      return true
    } catch (e) {
      console.error('保存失败:', e)
      EventBus.emit('game:saveError', { error: e })
      return false
    }
  }

  function scheduleAutoSave () {
    if (!_state || !CONFIG.save || !CONFIG.save.autoSave) return
    clearTimeout(_autoSaveTimer)
    _autoSaveTimer = setTimeout(() => {
      _autoSaveTimer = null
      save()
    }, 450)
  }

  function flushAutoSave () {
    if (!_autoSaveTimer) return
    clearTimeout(_autoSaveTimer)
    _autoSaveTimer = null
    save()
  }

  function hasSave () {
    try {
      return !!localStorage.getItem(SAVE_KEY) || !!localStorage.getItem(BACKUP_SAVE_KEY)
    } catch (_) {
      return false
    }
  }

  function load () {
    let raw = null
    try { raw = localStorage.getItem(SAVE_KEY) } catch (e) { console.error('读取存档失败:', e) }
    if (!raw) return loadBackup()
    try {
      _state = JSON.parse(raw)
      migrate(_state)   // 先迁移补全字段，再发事件
      EventBus.emit('game:load', _state)
      EventBus.emit('state:changed', _state)
      return _state
    } catch (e) {
      console.error('存档损坏:', e)
      return loadBackup()
    }
  }

  function loadBackup () {
    let raw = null
    try { raw = localStorage.getItem(BACKUP_SAVE_KEY) } catch (e) { console.error('读取备用存档失败:', e) }
    if (!raw) return null
    try {
      _state = JSON.parse(raw)
      migrate(_state)
      save({ skipBackup: true })
      EventBus.emit('game:load', _state)
      EventBus.emit('state:changed', _state)
      return _state
    } catch (e) {
      console.error('备用存档损坏:', e)
      return null
    }
  }

  function exportSave () {
    if (!_state) return null
    _state.saveVersion = SAVE_VERSION
    return JSON.stringify({
      game: 'yaolin-qimeng',
      saveVersion: SAVE_VERSION,
      exportedAt: new Date().toISOString(),
      state: _state,
    }, null, 2)
  }

  function importSave (raw) {
    if (typeof raw !== 'string' || !raw.trim() || raw.length > 2 * 1024 * 1024) {
      throw new Error('存档文件为空或过大')
    }
    const parsed = JSON.parse(raw)
    const candidate = parsed && parsed.game === 'yaolin-qimeng' ? parsed.state : parsed
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('不是有效的游戏存档')
    if (!['normal', 'hard', 'brutal'].includes(candidate.difficulty)) throw new Error('存档难度无效')
    if (!candidate.position || !Number.isInteger(candidate.position.x) || !Number.isInteger(candidate.position.y)) throw new Error('存档位置无效')
    if (!window.MAP_GRID || !MAP_GRID[candidate.position.y] || MAP_GRID[candidate.position.y][candidate.position.x] === undefined) throw new Error('存档位置超出地图')
    if (!candidate.inventory || typeof candidate.inventory !== 'object') throw new Error('存档背包无效')
    if (candidate.phase === 'battle' && (!candidate._battle || !Array.isArray(candidate._battle.targets))) throw new Error('战斗存档不完整')
    _state = candidate
    migrate(_state)
    if (!save()) throw new Error('浏览器无法写入存档')
    EventBus.emit('game:load', _state)
    EventBus.emit('state:changed', _state)
    return _state
  }

  function clearSave () {
    clearTimeout(_autoSaveTimer)
    _autoSaveTimer = null
    try {
      localStorage.removeItem(SAVE_KEY)
      localStorage.removeItem(BACKUP_SAVE_KEY)
      localStorage.removeItem(BOSS_SAVE_KEY)
    } catch (e) {
      console.error('删除存档失败:', e)
    }
  }

  /** 独立的 BOSS 战前快照，不会被战斗中的普通存档覆盖。 */
  function saveBossCheckpoint () {
    if (!_state) return
    try {
      _state.saveVersion = SAVE_VERSION
      localStorage.setItem(BOSS_SAVE_KEY, JSON.stringify(_state))
    } catch (e) {
      console.error('BOSS 战前存档失败:', e)
      EventBus.emit('game:saveError', { error: e })
    }
  }

  function loadBossCheckpoint () {
    const raw = localStorage.getItem(BOSS_SAVE_KEY)
    if (!raw) return null
    try {
      _state = JSON.parse(raw)
      migrate(_state)
      EventBus.emit('game:load', _state)
      EventBus.emit('state:changed', _state)
      return _state
    } catch (e) {
      console.error('BOSS 战前存档损坏:', e)
      localStorage.removeItem(BOSS_SAVE_KEY)
      return null
    }
  }

  function clearBossCheckpoint () {
    localStorage.removeItem(BOSS_SAVE_KEY)
  }

  /** 校验旧存档字段完整性，缺字段补默认 */
  function migrate (state) {
    if (!['normal', 'hard', 'brutal'].includes(state.difficulty)) state.difficulty = 'normal'
    const hadInsertionCharges = !!(
      (state._insertionCharges && typeof state._insertionCharges === 'object' && !Array.isArray(state._insertionCharges)) ||
      (state.systems && state.systems.restraints && state.systems.restraints.insertionCharges &&
        typeof state.systems.restraints.insertionCharges === 'object' && !Array.isArray(state.systems.restraints.insertionCharges))
    )
    const hadTownReputation = !!(
      (state._townReputation && typeof state._townReputation === 'object' && !Array.isArray(state._townReputation)) ||
      (state.systems && state.systems.townReputation && state.systems.townReputation.value &&
        typeof state.systems.townReputation.value === 'object' && !Array.isArray(state.systems.townReputation.value))
    )
    StateSchema.prepare(state)
    const defaults = createDefault(state.difficulty)
    const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
    return StateMigrations.run(state, {
      saveVersion: SAVE_VERSION,
      defaults,
      finite,
      hadInsertionCharges,
      hadTownReputation,
    })
  }
  return {
    get, domain, init, set, update,
    save, scheduleAutoSave, flushAutoSave, load, loadBackup, hasSave, clearSave, migrate,
    exportSave, importSave,
    saveBossCheckpoint, loadBossCheckpoint, clearBossCheckpoint,
    reset () { _state = null },
    SAVE_KEY, BACKUP_SAVE_KEY, BOSS_SAVE_KEY, SAVE_VERSION,
  }
})()

// 所有状态变化在短暂合并后自动落盘，避免连续动画产生大量同步写入。
EventBus.on('state:changed', () => State.scheduleAutoSave())
window.addEventListener('pagehide', () => State.flushAutoSave())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') State.flushAutoSave()
})
