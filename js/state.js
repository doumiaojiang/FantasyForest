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
  const SAVE_VERSION = 2

  function createDefault (difficulty = 'normal') {
    const cfg = CONFIG.difficulty[difficulty] || CONFIG.difficulty.normal
    const start = CONFIG.map.start
    return {
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
      _pendingLootEvent: null,          // 特殊掉落事件（断触手/狼人/魔女）持久化
      _pendingBossAttack: null,         // Boss 召唤攻击持久化（任务中刷新不丢失）
      _gloryDebt: 0,                    // 厕所欠债金额
      _gloryFreeService: false,         // 厕所待完成的免费追加服务
      _gloryByGuard: false,             // 被卫兵丢进荣耀洞（出城卫兵放行嘲笑）
      _gloryByCaptain: false,           // 被队长丢进荣耀洞（出城队长羞辱）
      _gloryWanted: 0,                  // 无证卖淫危险值（0-100，越高越容易被抓）
      _inPrison: false,                 // 是否在监狱（无证卖淫被抓）
      _prisonPoints: 0,                 // 监狱点数（集满 300 出狱）
      _prisonPardon: false,             // 队长豁免：危险值到100也不会被送进监狱
      _prisonPardonSetting: true,       // 求情开关：开=需口交求情，关=磕头对话求情
      _prisonEscapeFails: 0,            // 越狱失败次数（0/1/2，第3次永久监禁）
      _prisonEscapePenalty: 0,          // 越狱失败额外积分惩罚（第1次+200，第2次+350）
      _prisonLife: false,               // 永久监禁（越狱失败3次）
      _prisonChastity: false,           // 是否佩戴监狱专用贞操带/贞操锁（false/true）
      _freeMeatBrand: false,            // 大腿上"免费肉便器"烙印（铁匠解锁后永久）
      _blacksmithContract: false,       // 与铁匠签的契约：每次进铺子要先服务
      _gloryDiscovered: false,          // 是否已发现荣耀洞（调查隔间后）
      _toiletUsed: false,               // 本次进入营地是否已上过厕所（CD）
      _campReturnPos: null,             // 进入营地前的位置（离开时返回）
      _tavernGuest: 50,                 // 酒馆赌客剩余金币（赢光后离开，打赢敌人后回来）
      _tavernDebt: 0,                   // 欠酒馆老板的金币
      _barkeepChatCount: 0,             // 与老板娘聊天的次数（解锁打工话题）
      _barkeepLastChat: -1,             // 老板娘上次随机对话索引（避免连续重复）
      _tavernWorkUnlocked: false,       // 是否已解锁打工话题（聊天聊到过打工）
      _prostituteLicensed: false,       // 是否购买妓女许可证
      _prostituteBoughtFromCaptain: false,  // 许可证是否从守卫队队长处购买
      _captainChatCount: 0,             // 与守卫队队长聊天的次数
      _captainLastChat: -1,             // 队长上次随机对话索引（避免连续重复）
      _mercenary: null,                 // 佣兵 { id, name, icon, dmg }（永久常驻，战败则消失）
      _futaLastChat: -1,                // 扶她战士上次闲聊索引（避免连续重复）
      _prostituteDressed: false,        // 是否穿上妓女服
      _prostituteLevel: 1,              // 妓女等级
      _prostituteDebt: 0,               // 妓女欠款（任务失败欠老板娘的钱）
      _prostituteGear: {},              // 妓女已购用品 { lipstick: true, ... }
      _prostituteSwapCost: 20,          // 换客人费用（每次 +10，最高 100，服务完成后重置 20）
      _merchantDiscount: 0,             // 商人当前折扣（0 / 0.25 / 0.5），购买第一件后重置
      _prostitutePendingTask: null,      // 接客任务断点 { customerKey, z, stepIndex }
      _shopReturnToCamp: false,         // 营地商店关闭后返回营地
      _campDeerTaken: false,            // 是否已领取鹿的礼物
      defeated: [],
      bossDefeated: false,
      rounds: 0,
      logs: [],   // 冒险日志（持久化，读档恢复）
      clothesDeposited: false,   // 托管衣服给小鹿（尖石交换的代价）
      _plugActive: false,   // 已塞入的可取下塞入物 id（'big_butt_plug'/'vibrating_dildo'），false=无
      _moveState: null,     // 移动回合状态 { steps, turning }（岔路存档恢复用）
    }
  }

  function get () {
    return _state
  }

  function init (difficulty) {
    _state = createDefault(difficulty)
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
    const def = createDefault(state.difficulty)
    const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback

    // 顶层基础字段
    state.saveVersion = SAVE_VERSION
    if (state.playerName === undefined) state.playerName = def.playerName
    state.playerName = String(state.playerName || def.playerName).replace(/[<>\u0000-\u001f]/g, '').slice(0, 10) || def.playerName
    state.gender = ['female', 'male'].includes(state.gender) ? state.gender : 'female'
    if (typeof state.genderLabel !== 'string' || !state.genderLabel) {
      state.genderLabel = state.gender === 'male' ? '男性' : '女性'
    } else {
      state.genderLabel = String(state.genderLabel).slice(0, 8)
    }
    state.maxHp = Math.max(1, finite(state.maxHp, def.maxHp))
    state.hp = Math.min(state.maxHp, Math.max(0, finite(state.hp, def.hp)))
    state.gold = Math.max(0, Math.floor(finite(state.gold, def.gold)))
    if (!['idle', 'battle', 'shop', 'camp', 'gameover', 'boss'].includes(state.phase)) state.phase = def.phase
    if (!state.position || !Number.isInteger(state.position.x) || !Number.isInteger(state.position.y) || !window.MAP_GRID || !MAP_GRID[state.position.y] || MAP_GRID[state.position.y][state.position.x] === undefined) state.position = def.position
    if (!Array.isArray(state.visited)) state.visited = [def.position]
    state.visited = state.visited.filter(pos => pos && Number.isInteger(pos.x) && Number.isInteger(pos.y) && MAP_GRID[pos.y] && MAP_GRID[pos.y][pos.x] !== undefined)
    if (!state.visited.length) state.visited = [{ ...state.position }]

    // 背包
    if (!state.inventory || typeof state.inventory !== 'object' || Array.isArray(state.inventory)) state.inventory = {}
    if (!state.inventory.consumables || typeof state.inventory.consumables !== 'object' || Array.isArray(state.inventory.consumables)) state.inventory.consumables = {}
    Object.keys(state.inventory.consumables).forEach(id => {
      const count = Math.max(0, Math.min(999, Math.floor(finite(state.inventory.consumables[id], 0))))
      if (count) state.inventory.consumables[id] = count
      else delete state.inventory.consumables[id]
    })
    if (state.inventory.weapon === undefined) state.inventory.weapon = null
    if (state.inventory.accessory === undefined) state.inventory.accessory = null
    if (!Array.isArray(state.inventory.accessories)) {
      state.inventory.accessories = []
      // 旧档：把单槽 accessory 迁移到多槽数组
      if (state.inventory.accessory) state.inventory.accessories.push(state.inventory.accessory)
    }

    // 状态 / 进度
    if (!Array.isArray(state.statuses)) state.statuses = []
    state.statuses = state.statuses.filter(effect => effect && typeof effect.id === 'string').map(effect => ({
      ...effect,
      turnsLeft: Math.max(0, Math.min(99999, Math.floor(finite(effect.turnsLeft, 0)))),
      level: Math.max(1, Math.min(99, Math.floor(finite(effect.level, 1)))),
    })).filter(effect => effect.turnsLeft > 0)
    if (!Array.isArray(state.treasures)) state.treasures = []
    if (state.treasureComplete === undefined) state.treasureComplete = false
    if (state.treasureBonusId === undefined) state.treasureBonusId = null
    if (!Array.isArray(state.defeated)) state.defeated = []
    if (state.bossDefeated === undefined) state.bossDefeated = false
    state.rounds = Math.max(0, Math.floor(finite(state.rounds, 0)))
    if (!Array.isArray(state.logs)) state.logs = []
    state.logs = state.logs.slice(0, 120).filter(entry => entry && typeof entry === 'object').map(entry => ({
      text: String(entry.text == null ? '' : entry.text).slice(0, 500),
      type: ['good', 'danger', 'dim', 'warning'].includes(entry.type) ? entry.type : '',
    }))
    if (state.clothesDeposited === undefined) state.clothesDeposited = false
    if (state._plugActive === undefined) state._plugActive = false
    // 兼容旧档：巨肛塞以 true 标记 → 归一为物品 id
    if (state._plugActive === true) state._plugActive = 'big_butt_plug'
    if (state._plugActive !== false && !['big_butt_plug', 'vibrating_dildo'].includes(state._plugActive)) state._plugActive = false
    if (state._moveState === undefined) state._moveState = null
    if (state._pendingGuardianTreasure === undefined) state._pendingGuardianTreasure = null
    if (state._pendingGuardianGold === undefined) state._pendingGuardianGold = null
    if (state._godMode === undefined) state._godMode = false
    if (state._pendingLootEvent === undefined) state._pendingLootEvent = null
    if (state._pendingBossAttack === undefined) state._pendingBossAttack = null
    state._gloryDebt = Math.max(0, Math.min(9999, Math.floor(finite(state._gloryDebt, 0))))
    state._gloryFreeService = !!state._gloryFreeService
    state._gloryByGuard = !!state._gloryByGuard
    state._gloryByCaptain = !!state._gloryByCaptain
    state._gloryWanted = Math.max(0, Math.min(100, Math.floor(finite(state._gloryWanted, 0))))
    state._inPrison = !!state._inPrison
    state._prisonPoints = Math.max(0, Math.min(5000, Math.floor(finite(state._prisonPoints, 0))))
    state._prisonPardon = !!state._prisonPardon
    state._prisonPardonSetting = state._prisonPardonSetting !== false
    state._prisonEscapeFails = Math.max(0, Math.min(3, Math.floor(finite(state._prisonEscapeFails, 0))))
    state._prisonEscapePenalty = Math.max(0, Math.floor(finite(state._prisonEscapePenalty, 0)))
    state._prisonLife = !!state._prisonLife
    state._prisonChastity = !!state._prisonChastity
    state._freeMeatBrand = !!state._freeMeatBrand
    state._blacksmithContract = !!state._blacksmithContract
    if (state._gloryDiscovered === undefined) state._gloryDiscovered = !!state._gloryDiscovered
    if (state._toiletUsed === undefined) state._toiletUsed = !!state._toiletUsed
   if (state._campReturnPos === undefined) state._campReturnPos = null
    state._tavernGuest = Math.max(0, Math.min(50, Math.floor(finite(state._tavernGuest, 50))))
    state._tavernDebt = Math.max(0, Math.floor(finite(state._tavernDebt, 0)))
    state._barkeepChatCount = Math.max(0, Math.floor(finite(state._barkeepChatCount, 0)))
    state._barkeepLastChat = Math.max(-1, Math.floor(finite(state._barkeepLastChat, -1)))
    state._tavernWorkUnlocked = !!state._tavernWorkUnlocked
    state._prostituteLicensed = !!state._prostituteLicensed
    state._prostituteBoughtFromCaptain = !!state._prostituteBoughtFromCaptain
    state._captainChatCount = Math.max(0, Math.floor(finite(state._captainChatCount, 0)))
    state._captainLastChat = Math.max(-1, Math.floor(finite(state._captainLastChat, -1)))
    state._mercenary = state._mercenary && typeof state._mercenary === 'object' && state._mercenary.dmg
      ? { id: String(state._mercenary.id || ''), name: String(state._mercenary.name || ''), icon: String(state._mercenary.icon || '⚔️'), dmg: Math.max(0, Math.floor(finite(state._mercenary.dmg, 2))), dead: !!state._mercenary.dead, lust: Math.max(0, Math.min(100, Math.floor(finite(state._mercenary.lust, 0)))) }
      : null
    state._futaLastChat = Math.max(-1, Math.floor(finite(state._futaLastChat, -1)))
    state._prostituteDressed = !!state._prostituteDressed
    state._prostituteLevel = Math.max(1, Math.min(999, Math.floor(finite(state._prostituteLevel, 1))))
    state._prostituteDebt = Math.max(0, Math.min(9999, Math.floor(finite(state._prostituteDebt, 0))))
    const merchantDiscount = finite(state._merchantDiscount, 0)
    state._merchantDiscount = [0.25, 0.5].includes(merchantDiscount) ? merchantDiscount : 0
    const validProstituteGear = ['lipstick', 'makeup', 'heels', 'lingerie', 'latex', 'collar', 'gag', 'buttplug', 'chastity']
    const savedProstituteGear = state._prostituteGear && typeof state._prostituteGear === 'object' && !Array.isArray(state._prostituteGear)
      ? state._prostituteGear
      : {}
    state._prostituteGear = Object.fromEntries(validProstituteGear.filter(id => savedProstituteGear[id]).map(id => [id, true]))
    state._prostituteSwapCost = Math.max(20, Math.min(100, Math.floor(finite(state._prostituteSwapCost, 20))))
    if (!state._prostitutePendingTask || typeof state._prostitutePendingTask !== 'object' ||
      !['goblin', 'werewolf', 'orc', 'minotaur', 'koopa'].includes(state._prostitutePendingTask.customerKey)) {
      state._prostitutePendingTask = null
    } else {
      const pendingZ = Math.floor(finite(state._prostitutePendingTask.z, 0))
      const pendingStep = Math.max(0, Math.min(99, Math.floor(finite(state._prostitutePendingTask.stepIndex, 0))))
      state._prostitutePendingTask = pendingZ >= 1 && pendingZ <= 6
        ? { customerKey: state._prostitutePendingTask.customerKey, z: pendingZ, stepIndex: pendingStep }
        : null
    }
    state._shopReturnToCamp = !!state._shopReturnToCamp
    state._campDeerTaken = !!state._campDeerTaken

    // 旧战斗存档迁移：补肛塞子计数（旧档只有 blocked）
    if (state._battle && state._battle.smallPlugBlocked === undefined && state._battle.plugBlocked === undefined) {
      state._battle.smallPlugBlocked = state._battle.blocked || 0
      state._battle.plugBlocked = 0
      state._battle.blocked = state._battle.smallPlugBlocked
    }

    // 装备记录：缺则补，并从当前装备重建已购记录（含多饰品数组）
    if (!Array.isArray(state.ownedEquipment)) {
      state.ownedEquipment = []
      if (state.inventory.weapon) state.ownedEquipment.push(state.inventory.weapon)
      if (state.inventory.accessory) state.ownedEquipment.push(state.inventory.accessory)
      ;(state.inventory.accessories || []).forEach(id => {
        if (!state.ownedEquipment.includes(id)) state.ownedEquipment.push(id)
      })
    }

    // 清理无效装备 ID（已被删除/改名的装备）：避免战斗结算读取 effect 时崩溃
    const validWeapon = id => !!(window.ItemLib && ItemLib.weapon(id))
    const validAccessory = id => !!(window.ItemLib && ItemLib.accessory(id))
    if (state.inventory.weapon && !validWeapon(state.inventory.weapon)) {
      state.inventory.weapon = null
    }
    if (Array.isArray(state.inventory.accessories)) {
      state.inventory.accessories = state.inventory.accessories.filter(id => validAccessory(id))
    }
    if (state.inventory.accessory && !validAccessory(state.inventory.accessory)) {
      state.inventory.accessory = null
    }
    if (Array.isArray(state.ownedEquipment)) {
      state.ownedEquipment = state.ownedEquipment.filter(id => validWeapon(id) || validAccessory(id))
    }

    return state
  }

  return {
    get, init, set, update,
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
