/**
 * state-migrations.js — 存档校验与领域迁移流水线。
 * 每个阶段只负责一个领域，可独立测试并保持幂等。
 */
window.StateMigrations = (function () {
  function migrateCore (state, context) {
    const { defaults: def, finite, hadInsertionCharges, saveVersion: SAVE_VERSION } = context
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
    if (!hadInsertionCharges) state._insertionCharges = {}

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
    if (state._moveState === undefined) state._moveState = null
    if (state._pendingGuardianTreasure === undefined) state._pendingGuardianTreasure = null
    if (state._pendingGuardianGold === undefined) state._pendingGuardianGold = null
    if (state._godMode === undefined) state._godMode = false
    if (state._pendingLootEvent === undefined) state._pendingLootEvent = null
    if (state._pendingBossAttack === undefined) state._pendingBossAttack = null
    const previousPStoryRevision = Math.floor(finite(state._pStoryRevision, 1))
    state._wrongCommissionStage = Math.max(0, Math.min(10, Math.floor(finite(state._wrongCommissionStage, 0))))
    if (!state._wrongCommissionLeads || typeof state._wrongCommissionLeads !== 'object' || Array.isArray(state._wrongCommissionLeads)) {
      state._wrongCommissionLeads = { barkeep: false, blacksmith: false }
    }
    state._wrongCommissionLeads.barkeep = !!state._wrongCommissionLeads.barkeep
    state._wrongCommissionLeads.blacksmith = !!state._wrongCommissionLeads.blacksmith
    if (state._wrongCommissionLeads.barkeep && state._wrongCommissionLeads.blacksmith) state._wrongCommissionStage = Math.max(4, state._wrongCommissionStage)
    if (['rescue', 'deliver', 'destroy'].includes(state._wrongCommissionOutcome)) {
      // 旧版“黑蜡木匣”已结案的存档直接视为看完新版序章，避免重复发奖或卡任务。
      state._wrongCommissionOutcome = 'takeover'
      state._wrongCommissionStage = 10
    }
    if (!['permit', 'takeover'].includes(state._wrongCommissionOutcome)) state._wrongCommissionOutcome = null
    if (!['guard', 'provoked'].includes(state._wrongCommissionBattle)) state._wrongCommissionBattle = null
    state._wrongCommissionCaptured = !!state._wrongCommissionCaptured
    if (state._wrongCommissionOutcome === 'permit') state._wrongCommissionStage = Math.max(5, state._wrongCommissionStage)
    if (state._wrongCommissionOutcome === 'takeover') state._wrongCommissionStage = Math.max(10, state._wrongCommissionStage)
    state._pCaravanTrailSeen = !!state._pCaravanTrailSeen
    state._pCaravanClothesAwaitingRecovery = !!state._pCaravanClothesAwaitingRecovery
    state._pCaravanDebt = Math.max(0, Math.min(9999, Math.floor(finite(state._pCaravanDebt, 0))))
    state._pCaravanEscortStage = Math.max(0, Math.min(4, Math.floor(finite(state._pCaravanEscortStage, 0))))
    if (state._pCaravanEscortResult && typeof state._pCaravanEscortResult === 'object' && !Array.isArray(state._pCaravanEscortResult)) {
      state._pCaravanEscortResult = {
        goldLost: Math.max(0, Math.min(9999, Math.floor(finite(state._pCaravanEscortResult.goldLost, 0)))),
        provoked: !!state._pCaravanEscortResult.provoked,
        bindings: Math.max(0, Math.min(4, Math.floor(finite(state._pCaravanEscortResult.bindings, 4)))),
        naked: !!state._pCaravanEscortResult.naked,
        punished: !!state._pCaravanEscortResult.punished,
        punishmentStep: Math.max(0, Math.min(2, Math.floor(finite(state._pCaravanEscortResult.punishmentStep, 0)))),
        gateUsed: !!state._pCaravanEscortResult.gateUsed,
      }
    } else {
      state._pCaravanEscortResult = null
      if (state._pCaravanEscortStage > 0) state._pCaravanEscortStage = 0
    }
    state._pFourfoldEscortCompleted = !!state._pFourfoldEscortCompleted
    state._pDefeatDispatchPending = !!state._pDefeatDispatchPending
    state._pDefeatPunished = !!state._pDefeatPunished
    state._pDefeatSentenced = !!state._pDefeatSentenced
    state._pDefeatPunishmentStep = Math.max(0, Math.min(2, Math.floor(finite(state._pDefeatPunishmentStep, 0))))
    if (!['clothes', 'defeat-toy', 'defeat-verify', 'defeat-rotate', 'defeat-discard', 'witness-trade', 'victory-fall', 'victory-mark'].includes(state._pBanditAftermath)) state._pBanditAftermath = null
    state._pBanditDefeatCount = Math.max(0, Math.min(99, Math.floor(finite(state._pBanditDefeatCount, 0))))
    state._pBanditDefeatScene = Math.max(0, Math.min(18, Math.floor(finite(state._pBanditDefeatScene, 0))))
    if (state._pBanditDefeatResult && typeof state._pBanditDefeatResult === 'object' && !Array.isArray(state._pBanditDefeatResult)) {
      state._pBanditDefeatResult = {
        goldLost: Math.max(0, Math.min(9999, Math.floor(finite(state._pBanditDefeatResult.goldLost, 0)))),
        livingCrew: Math.max(0, Math.min(2, Math.floor(finite(state._pBanditDefeatResult.livingCrew, 0)))),
      }
    } else state._pBanditDefeatResult = null
    state._pBanditClothesLocked = !!state._pBanditClothesLocked
    state._pBanditWitnessBegged = !!state._pBanditWitnessBegged
    state._pBanditGateReactionPending = !!state._pBanditGateReactionPending
    if (state._pBanditVictoryResult && typeof state._pBanditVictoryResult === 'object' && !Array.isArray(state._pBanditVictoryResult)) {
      state._pBanditVictoryResult = {
        fleeingCrew: Math.max(0, Math.min(2, Math.floor(finite(state._pBanditVictoryResult.fleeingCrew, 0)))),
        clothesTaken: !!state._pBanditVictoryResult.clothesTaken,
        gold: Math.max(0, Math.min(9999, Math.floor(finite(state._pBanditVictoryResult.gold, 0)))),
      }
    } else state._pBanditVictoryResult = null
    if (!['questioned', 'bound', 'released'].includes(state._pBanditLeaderFate)) state._pBanditLeaderFate = null
    if (!['scrubbed', 'kept'].includes(state._pBanditMarkChoice)) state._pBanditMarkChoice = null
    if (state._pBanditToySession && typeof state._pBanditToySession === 'object' && Array.isArray(state._pBanditToySession.uses)) {
      state._pBanditToySession = {
        days: Math.max(2, Math.min(3, Math.floor(finite(state._pBanditToySession.days, 2)))),
        index: Math.max(0, Math.floor(finite(state._pBanditToySession.index, 0))),
        repeat: !!state._pBanditToySession.repeat,
        announcedDay: Math.max(0, Math.min(3, Math.floor(finite(state._pBanditToySession.announcedDay, 0)))),
        uses: state._pBanditToySession.uses.slice(0, 18).map(use => ({
          actor: String(use && use.actor || '☠️ 劫货强盗头目').slice(0, 40),
          name: String(use && use.name || '泄火').slice(0, 40),
          desc: String(use && use.desc || '').slice(0, 400),
          bpm: Math.max(0, Math.min(240, Math.floor(finite(use && use.bpm, 0)))),
          seconds: Math.max(0, Math.min(120, Math.floor(finite(use && use.seconds, 0)))),
          taskCount: Math.max(0, Math.min(40, Math.floor(finite(use && use.taskCount, 0)))),
          taskTool: String(use && use.taskTool || '').slice(0, 20),
        })),
      }
    } else state._pBanditToySession = null
    state._pBanditTradeStep = Math.max(0, Math.min(6, Math.floor(finite(state._pBanditTradeStep, 0))))
    state._pBanditBridgeToll = !!state._pBanditBridgeToll
    state._pBanditRansomDebt = Math.max(0, Math.min(9999, Math.floor(finite(state._pBanditRansomDebt, 0))))
    if (!state._pTownInquiry || typeof state._pTownInquiry !== 'object' || Array.isArray(state._pTownInquiry)) {
      state._pTownInquiry = { guard: false, merchant: false, citizen: false }
    }
    state._pTownInquiry.guard = !!state._pTownInquiry.guard
    state._pTownInquiry.merchant = !!state._pTownInquiry.merchant
    state._pTownInquiry.citizen = !!state._pTownInquiry.citizen
    if (state._pTownInquiry.guard && state._pTownInquiry.merchant && state._pTownInquiry.citizen) {
      state._wrongCommissionStage = Math.max(9, state._wrongCommissionStage)
    }
    if (!state._pInvestigationChoices || typeof state._pInvestigationChoices !== 'object' || Array.isArray(state._pInvestigationChoices)) {
      state._pInvestigationChoices = { barkeep: null, blacksmith: null }
    }
    state._pInvestigationChoices.barkeep = ['door', 'permit'].includes(state._pInvestigationChoices.barkeep) ? state._pInvestigationChoices.barkeep : null
    state._pInvestigationChoices.blacksmith = ['direct', 'permit'].includes(state._pInvestigationChoices.blacksmith) ? state._pInvestigationChoices.blacksmith : null
    if (!['normal_victory', 'provoked_victory', 'normal_captured', 'provoked_captured'].includes(state._pBridgeResult)) {
      state._pBridgeResult = null
      if (state._wrongCommissionStage >= 5) {
        const provokedHistory = state._wrongCommissionBattle === 'provoked' || (state.logs || []).some(entry => /故意高声挑衅|狂暴状态|挑衅引来/.test(String(entry && entry.text || '')))
        state._pBridgeResult = `${provokedHistory ? 'provoked' : 'normal'}_${state._wrongCommissionCaptured ? 'captured' : 'victory'}`
      }
    }
    const bridgeVictory = ['normal_victory', 'provoked_victory'].includes(state._pBridgeResult)
    state._pBridgePermitAcquired = !!state._pBridgePermitAcquired || (bridgeVictory && state._wrongCommissionStage >= 5)
    if (!['clothes', 'permit'].includes(state._pBridgeAftermath)) state._pBridgeAftermath = null
    // 兼容在“找回衣服”弹窗中刷新的旧存档：把已经打赢的事实固化，避免重新开战。
    if (state._pCaravanClothesAwaitingRecovery && bridgeVictory) {
      state._wrongCommissionStage = Math.max(5, state._wrongCommissionStage)
      state._wrongCommissionOutcome = 'permit'
      state._pBridgePermitAcquired = true
      state._pBridgeAftermath = 'clothes'
      state.inventory.consumables.raven_latch = Math.max(1, state.inventory.consumables.raven_latch || 0)
    }
    state._pMainlineStage = Math.max(0, Math.min(6, Math.floor(finite(state._pMainlineStage, 0))))
    if (!['slaver', 'free', 'slave'].includes(state._pRole)) state._pRole = null
    state._pChapterOneLocked = !!state._pChapterOneLocked
    state._pMChapterStage = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 9500, 10000].includes(Math.floor(finite(state._pMChapterStage, 0))) ? Math.floor(finite(state._pMChapterStage, 0)) : 0
    state._pMChapterStep = Math.max(0, Math.min(8, Math.floor(finite(state._pMChapterStep, 0))))
    if (!['novice', 'experienced', 'surrender'].includes(state._pMChapterBranch)) state._pMChapterBranch = null
    if (state._pMChapterAttitude === 'quiet') state._pMChapterAttitude = 'spank'
    else if (state._pMChapterAttitude === 'resist') state._pMChapterAttitude = 'spank'
    else if (state._pMChapterAttitude === 'observe') state._pMChapterAttitude = 'spread'
    if (!['spank', 'oral', 'spread'].includes(state._pMChapterAttitude)) state._pMChapterAttitude = null
    state._pMWakeResist = Math.max(0, Math.min(3, Math.floor(finite(state._pMWakeResist, 0))))
    state._pMSpankStack = Math.max(1, Math.floor(finite(state._pMSpankStack, 1)))
    if (!state._pMWakeGearEscrow || typeof state._pMWakeGearEscrow !== 'object' || Array.isArray(state._pMWakeGearEscrow)) state._pMWakeGearEscrow = null
    state._pMChapterFailures = Math.max(0, Math.min(99, Math.floor(finite(state._pMChapterFailures, 0))))
    if (state._pMChapterEscrow && typeof state._pMChapterEscrow === 'object' && !Array.isArray(state._pMChapterEscrow)) {
      state._pMChapterEscrow = {
        weapon: state._pMChapterEscrow.weapon ? String(state._pMChapterEscrow.weapon).slice(0, 60) : null,
        accessories: Array.isArray(state._pMChapterEscrow.accessories) ? state._pMChapterEscrow.accessories.map(String).slice(0, 8) : [],
      }
    } else state._pMChapterEscrow = null
    state._pMConfiscated = !!state._pMConfiscated
    if (!state._pMConfiscationEscrow || typeof state._pMConfiscationEscrow !== 'object' || Array.isArray(state._pMConfiscationEscrow)) state._pMConfiscationEscrow = null
    state._pMChapterRestraintEscrow = state._pMChapterRestraintEscrow && typeof state._pMChapterRestraintEscrow === 'object' && !Array.isArray(state._pMChapterRestraintEscrow)
      ? state._pMChapterRestraintEscrow
      : null
    state._pMGroomed = !!state._pMGroomed
    state._pMBranded = !!state._pMBranded
    state._pMSisterBond = !!state._pMSisterBond
    if (!['endure', 'shield', 'defy'].includes(state._pMMarketResponse)) state._pMMarketResponse = null
    if (!['protect', 'self', 'obey'].includes(state._pMDayaChoice)) state._pMDayaChoice = null
    state._pMChapterCompleted = !!state._pMChapterCompleted
    state._pGateChoices = Array.isArray(state._pGateChoices)
      ? [...new Set(state._pGateChoices.filter(choice => ['work', 'question', 'refuse', 'cautious', 'defiant', 'slave', 'free'].includes(choice)))].slice(0, 6)
      : []
    if (!['registered', 'helped', 'refused', 'assault_win', 'assault_loss', 'slaver_training', 'free_observer', 'slave_training', 'm_intake_complete'].includes(state._pDayaOutcome)) state._pDayaOutcome = null
    state._pRouteLocked = !!state._pRouteLocked || state._pMainlineStage >= 6
    // 旧版把“发现许可”后到初见派克的整段内容压缩掉了。未锁定路线的旧档回退到
    // 车队残骸阶段，避免刷新后继续进入已经废弃的登记页四选一。
    if (previousPStoryRevision < 2 && !state._pRouteLocked && state._wrongCommissionStage >= 6) {
      state._wrongCommissionStage = 5
      state._wrongCommissionOutcome = 'permit'
      state._pMainlineStage = 0
      state._pRole = null
      state._pGateChoices = []
      state._pDayaOutcome = null
    }
    // v3 暂停在城门身份选择：旧版已经进入第一章或 S 路线的存档，
    // 回到城门重新选择目前开放的 M / 自由身路线。已按新规则完成选择的存档保持不动。
    const enteredUnreleasedChapter = state._pMainlineStage > 2 || state._pRole === 'slaver' || (state._pMainlineStage === 2 && !state._pChapterOneLocked)
    if (previousPStoryRevision < 3 && enteredUnreleasedChapter && state._wrongCommissionStage >= 10) {
      state._pMainlineStage = 1
      state._pRole = null
      state._pChapterOneLocked = false
      state._pRouteLocked = false
      state._pGateChoices = []
      state._pDayaOutcome = null
    }
    state._pStoryRevision = 3
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
    if (state._prisonMouthPrev === undefined) state._prisonMouthPrev = null
    state._wanted = !!state._wanted
    if (typeof window.TELEPORTS !== 'undefined' && Array.isArray(state._teleports)) {
      state._teleports = state._teleports.filter(id => TELEPORTS.some(t => t.id === id))
      if (!state._teleports.includes('camp')) state._teleports.unshift('camp')
    } else {
      state._teleports = ['camp']
    }
  }

  function migrateRestraints (state, context) {
    const { finite, hadInsertionCharges } = context
    // 服务类妖缚装备迁移：兼容旧酒馆标志及短暂存在过的独立普通用品版本。
    const serviceGearIds = ['lipstick', 'makeup', 'slut_gag', 'slut_collar', 'heels', 'lingerie', 'latex']
    const serviceGearSlots = { lipstick: 'lip', makeup: 'face', slut_gag: 'mouth', slut_collar: 'neck', heels: 'feet', lingerie: 'outfit', latex: 'outfit' }
    state._ownedRestraints = Array.isArray(state._ownedRestraints) ? state._ownedRestraints : []
    state._restraints = state._restraints && typeof state._restraints === 'object' && !Array.isArray(state._restraints) ? state._restraints : {}
    if (!state._serviceGearRestored) {
      const oldFlags = state._prostituteGear && typeof state._prostituteGear === 'object' ? state._prostituteGear : {}
      const flagMap = { lipstick: 'lipstick', makeup: 'makeup', heels: 'heels', lingerie: 'lingerie', latex: 'latex', collar: 'slut_collar', gag: 'slut_gag' }
      Object.entries(flagMap).forEach(([flag, id]) => {
        if (!oldFlags[flag]) return
        if (!state._ownedRestraints.includes(id)) state._ownedRestraints.push(id)
        const slot = serviceGearSlots[id]
        if (!state._restraints[slot]) state._restraints[slot] = { id, slot, locked: false, lockType: 'common', difficulty: 1, material: 'leather', source: 'migration', escapeBonus: 0, jammed: false }
      })
      ;(state._ownedProstituteGear || []).forEach(id => {
        if (serviceGearIds.includes(id) && !state._ownedRestraints.includes(id)) state._ownedRestraints.push(id)
      })
      const separateWorn = state._equippedProstituteGear && typeof state._equippedProstituteGear === 'object' ? state._equippedProstituteGear : {}
      Object.entries(separateWorn).forEach(([slot, id]) => {
        if (!serviceGearIds.includes(id) || serviceGearSlots[id] !== slot) return
        if (!state._ownedRestraints.includes(id)) state._ownedRestraints.push(id)
        if (!state._restraints[slot]) state._restraints[slot] = { id, slot, locked: false, lockType: 'common', difficulty: 1, material: 'leather', source: 'migration', escapeBonus: 0, jammed: false }
      })
      state._serviceGearRestored = true
    }
    state._ownedProstituteGear = []
    state._equippedProstituteGear = {}

    // 妖缚装置迁移：监狱贞操锁 / 酒馆贞操装置并入腰部槽
    if (typeof window.RESTRAINTS !== 'undefined') {
      const r = state._restraints && typeof state._restraints === 'object' && !Array.isArray(state._restraints) ? state._restraints : {}
      const valid = {}
      Object.keys(r).forEach(slot => {
        const original = r[slot]
        const d = original && original.id === 'buttplug' ? { ...original, id: 'medium_butt_plug' } : original
        if (d && d.id && !(slot === 'vagina' && state.gender === 'male') && RESTRAINTS.some(x => x.id === d.id && (Array.isArray(x.allowedSlots) ? x.allowedSlots.includes(slot) : x.slot === slot))) {
          valid[slot] = { ...d, slot, locked: !!d.locked, escapeBonus: Math.max(0, Math.min(30, Math.floor(finite(d.escapeBonus, 0)))), jammed: !!d.jammed }
        }
      })
      if (state._prisonChastity) {
        // 在押（含旧档）：腰部一律换成监狱剧情锁，原装置存回 _prisonWaistPrev 出狱还原
        if (!valid.waist || valid.waist.id !== 'prison_chastity') {
          state._prisonWaistPrev = valid.waist || null
          valid.waist = { id: 'prison_chastity', slot: 'waist', locked: true, lockType: 'story', difficulty: 5, material: 'metal', source: 'prison', escapeBonus: 0, jammed: false }
        }
      }
      // 旧档中的两种普通贞操装备按当前角色性别归并：女性用贞操带，男性用贞操锁。
      const genderChastityId = state.gender === 'male' ? 'vibrating_chastity' : 'chastity_device'
      const incompatibleChastityId = state.gender === 'male' ? 'chastity_device' : 'vibrating_chastity'
      if (valid.waist && valid.waist.id === incompatibleChastityId) valid.waist.id = genderChastityId
      if (state._prisonWaistPrev && state._prisonWaistPrev.id === incompatibleChastityId) {
        state._prisonWaistPrev = { ...state._prisonWaistPrev, id: genderChastityId }
      }
      state._ownedRestraints = Array.isArray(state._ownedRestraints) ? state._ownedRestraints : []
      if (state._ownedRestraints.includes(incompatibleChastityId) && !state._ownedRestraints.includes(genderChastityId)) {
        state._ownedRestraints.push(genderChastityId)
      }
      state._ownedRestraints = state._ownedRestraints.filter(id => id !== incompatibleChastityId)
      const waistDef = valid.waist && RESTRAINTS.find(x => x.id === valid.waist.id)
      const storyInsertionUnderChastity = valid.vagina && valid.vagina.lockType === 'story' && valid.vagina.source === 'p_m_intake'
      if (waistDef && waistDef.effect === 'chastity' && valid.vagina && !storyInsertionUnderChastity) {
        state._ownedRestraints = Array.isArray(state._ownedRestraints) ? state._ownedRestraints : []
        if (!state._ownedRestraints.includes(valid.vagina.id)) state._ownedRestraints.push(valid.vagina.id)
        delete valid.vagina
      }
      // 酒馆贞操笼迁移成腰部普通装置；已购买（含旧档）记录进 ownedRestraints，可重复穿戴
      if ((state._prostituteGear && state._prostituteGear.chastity) && !valid.waist) {
        valid.waist = { id: genderChastityId, slot: 'waist', locked: false, lockType: 'common', difficulty: 3, material: 'metal', source: 'tavern', escapeBonus: 0, jammed: false }
        state._ownedRestraints = state._ownedRestraints || []
        if (!state._ownedRestraints.includes(genderChastityId)) state._ownedRestraints.push(genderChastityId)
      }
      state._restraints = valid
      ;['anal', 'vagina'].forEach(slot => {
        const worn = valid[slot]
        const insertDef = worn ? RESTRAINTS.find(x => x.id === worn.id && x.insert) : null
        const max = insertDef ? Math.max(0, Math.floor(finite(insertDef.block, 0))) * (insertDef.stackable ? Math.max(1, Math.floor(finite(worn.count, 1))) : 1) : 0
        // 旧存档首次升级时保留原有体验：当前穿戴的插入装备按满充迁移。
        const fallback = !hadInsertionCharges && insertDef ? max : 0
        const migratedCharge = Math.max(0, Math.min(max, Math.floor(finite(worn && worn.charge, finite(state._insertionCharges[slot], fallback)))))
        state._insertionCharges[slot] = migratedCharge
        if (worn) worn.charge = migratedCharge
      })
      // 旧酒馆肛塞标志仍迁入插入类妖缚装备；服务用品已在上方统一迁移。
      state._ownedRestraints = Array.isArray(state._ownedRestraints) ? state._ownedRestraints : []
      if (state._prostituteGear && typeof state._prostituteGear === 'object') {
        const GEAR_MAP = { buttplug: 'medium_butt_plug' }
        Object.entries(GEAR_MAP).forEach(([flag, did]) => {
          if (!state._prostituteGear[flag]) return
          if (!state._ownedRestraints.includes(did)) state._ownedRestraints.push(did)
          const def = RESTRAINTS.find(r => r.id === did)
          if (def && !valid[def.slot]) {
            valid[def.slot] = { id: did, slot: def.slot, locked: false, lockType: 'common', difficulty: def.difficulty || 2, material: def.material, source: 'tavern', escapeBonus: 0, jammed: false }
          }
        })
        state._restraints = valid
      }
      // 旧版背包塞入物全部迁为永久拥有的妖缚装备；旧版正在使用的装备尽量保持穿戴。
      const legacyInsertIds = ['butt_plug', 'big_butt_plug', 'vibrator_egg', 'vibrating_dildo']
      const legacyActive = state._plugActive === true ? 'big_butt_plug' : state._plugActive
      state._ownedRestraintCounts = state._ownedRestraintCounts && typeof state._ownedRestraintCounts === 'object' && !Array.isArray(state._ownedRestraintCounts)
        ? state._ownedRestraintCounts : {}
      legacyInsertIds.forEach(id => {
        const count = Math.max(0, Math.floor(finite(state.inventory?.consumables?.[id], 0)))
        if (count > 0 || legacyActive === id) {
          if (!state._ownedRestraints.includes(id)) state._ownedRestraints.push(id)
          const def = RESTRAINTS.find(x => x.id === id)
          if (def && def.stackable && count > 0) {
            const previous = Math.max(0, Math.floor(finite(state._ownedRestraintCounts[id], 0)))
            state._ownedRestraintCounts[id] = Math.min(def.maxStack || 99, previous + count)
          }
          if (state.inventory && state.inventory.consumables) state.inventory.consumables[id] = 0
        }
      })
      if (legacyActive && legacyInsertIds.includes(legacyActive)) {
        const def = RESTRAINTS.find(x => x.id === legacyActive)
        const preferred = def && Array.isArray(def.allowedSlots) ? def.allowedSlots.find(slot => !valid[slot] && !(slot === 'vagina' && state.gender === 'male')) : null
        if (def && preferred) valid[preferred] = { id: def.id, slot: preferred, locked: false, lockType: 'common', difficulty: def.difficulty || 1, material: def.material, source: 'migration', escapeBonus: 0, jammed: false }
      }
      state._plugActive = false
      state._ownedRestraints = [...new Set(state._ownedRestraints.map(id => id === 'buttplug' ? 'medium_butt_plug' : id))]
      // 已购装置过滤（仅保留有效装置 id）
      if (typeof window.RESTRAINTS !== 'undefined' && Array.isArray(state._ownedRestraints)) {
        state._ownedRestraints = state._ownedRestraints.filter(id => RESTRAINTS.some(x => x.id === id && !x.story))
        RESTRAINTS.filter(x => x.stackable && !x.story).forEach(def => {
          const worn = Object.values(valid).find(d => d && d.id === def.id)
          const owned = state._ownedRestraints.includes(def.id) || !!worn
          const saved = Math.max(0, Math.floor(finite(state._ownedRestraintCounts[def.id], 0)))
          const wornCount = worn ? Math.max(1, Math.floor(finite(worn.count, 1))) : 0
          const count = owned ? Math.max(1, Math.min(def.maxStack || 99, Math.max(saved, wornCount))) : 0
          if (count > 0) state._ownedRestraintCounts[def.id] = count
          else delete state._ownedRestraintCounts[def.id]
          if (worn) worn.count = Math.min(count, wornCount || 1)
          if (owned && !state._ownedRestraints.includes(def.id)) state._ownedRestraints.push(def.id)
        })
      } else {
        state._ownedRestraints = []
        state._ownedRestraintCounts = {}
      }
      if (state._prisonWaistPrev && state._prisonWaistPrev.id && !RESTRAINTS.some(x => x.id === state._prisonWaistPrev.id)) {
        state._prisonWaistPrev = null
      }
      if (state._prisonMouthPrev && state._prisonMouthPrev.id) {
        const mouthDef = RESTRAINTS.find(x => x.id === state._prisonMouthPrev.id)
        const mouthAllowed = mouthDef && (Array.isArray(mouthDef.allowedSlots) ? mouthDef.allowedSlots.includes('mouth') : mouthDef.slot === 'mouth')
        if (!mouthAllowed) state._prisonMouthPrev = null
        else state._prisonMouthPrev = { ...state._prisonMouthPrev, slot: 'mouth', locked: !!state._prisonMouthPrev.locked, jammed: !!state._prisonMouthPrev.jammed }
      }
      Object.values(valid).forEach(worn => {
        const defn = worn && RESTRAINTS.find(item => item.id === worn.id)
        if (defn && defn.vibrate) worn.vibrationMode = ['off', 'low', 'high'].includes(worn.vibrationMode) ? worn.vibrationMode : 'off'
        else if (worn) delete worn.vibrationMode
      })
    } else {
      state._restraints = {}
    }
    if (!state._storedInsertionCharges || typeof state._storedInsertionCharges !== 'object' || Array.isArray(state._storedInsertionCharges)) state._storedInsertionCharges = {}
    Object.keys(state._storedInsertionCharges).forEach(id => {
      const defn = typeof window.RESTRAINTS !== 'undefined' ? RESTRAINTS.find(r => r.id === id && r.insert && !r.story) : null
      if (!defn || !Array.isArray(state._storedInsertionCharges[id])) { delete state._storedInsertionCharges[id]; return }
      const listed = Array.isArray(state._ownedRestraints) && state._ownedRestraints.includes(id)
      const savedOwned = Math.max(0, Math.floor(finite(state._ownedRestraintCounts && state._ownedRestraintCounts[id], listed ? 1 : 0)))
      const ownCap = defn.stackable ? 1 : (state.gender === 'male' ? 1 : (defn.maxOwn || 1))
      const ownedUnits = defn.stackable ? (listed ? 1 : 0) : Math.min(ownCap, Math.max(listed ? 1 : 0, savedOwned))
      const maxItems = Math.max(0, ownedUnits - Object.values(state._restraints || {}).filter(d => d && d.id === id).length)
      state._storedInsertionCharges[id] = state._storedInsertionCharges[id].slice(0, maxItems).map(record => {
        const count = defn.stackable ? Math.max(1, Math.min(defn.maxStack || 99, Math.floor(finite(record && record.count, 1)))) : 1
        const max = Math.max(0, Math.floor(finite(defn.block, 0))) * count
        return {
          charge: Math.max(0, Math.min(max, Math.floor(finite(record && record.charge, 0)))),
          count,
          vibrationMode: defn.vibrate && ['off', 'low', 'high'].includes(record && record.vibrationMode) ? record.vibrationMode : 'off',
        }
      })
      if (!state._storedInsertionCharges[id].length) delete state._storedInsertionCharges[id]
    })
    if (!state._restraintSettings || typeof state._restraintSettings !== 'object') state._restraintSettings = {}
    state._restraintSettings.allowTrap = state._restraintSettings.allowTrap !== false
    state._restraintSettings.trapAutoLock = state._restraintSettings.trapAutoLock !== false
    state._restraintSettings.redirectAttacks = state._restraintSettings.redirectAttacks !== false
    state._restraintSettings.bossForcedUnlock = state._restraintSettings.bossForcedUnlock !== false
    state._restraintSettings.vibrationControl = state._restraintSettings.vibrationControl !== false
    state._restraintSettings.chargeNotice = ['detail', 'compact', 'off'].includes(state._restraintSettings.chargeNotice)
      ? state._restraintSettings.chargeNotice
      : 'detail'
    // 妖缚委托：旧档补字段，并限制可持久化的数据范围。
    state._restraintContractCompleted = Math.max(0, Math.floor(finite(state._restraintContractCompleted, 0)))
    state._restraintContractOffers = Array.isArray(state._restraintContractOffers)
      ? [...new Set(state._restraintContractOffers.filter(id => typeof id === 'string' && /^[a-z0-9_-]{1,40}$/i.test(id)))].slice(0, 3)
      : []
    if (!state._restraintContract || typeof state._restraintContract !== 'object' || Array.isArray(state._restraintContract)) {
      state._restraintContract = null
    } else {
      const contract = state._restraintContract
      const gear = Array.isArray(contract.gear)
        ? contract.gear.filter(entry => entry && typeof entry.slot === 'string' && typeof entry.id === 'string' && /^[a-z0-9_-]{1,40}$/i.test(entry.slot) && /^[a-z0-9_-]{1,60}$/i.test(entry.id)).map(entry => ({ slot: entry.slot, id: entry.id }))
        : []
      const required = Math.max(1, Math.min(20, Math.floor(finite(contract.required, 1))))
      state._restraintContract = {
        id: /^[a-z0-9_-]{1,80}$/i.test(String(contract.id || '')) ? String(contract.id) : '',
        templateId: /^[a-z0-9_-]{1,40}$/i.test(String(contract.templateId || '')) ? String(contract.templateId) : '',
        name: String(contract.name || '未命名委托').replace(/[<>&"'\u0000-\u001f]/g, '').slice(0, 30),
        rank: ['easy', 'normal', 'hard'].includes(contract.rank) ? contract.rank : 'easy',
        required,
        progress: Math.max(0, Math.min(required, Math.floor(finite(contract.progress, 0)))),
        rewardGold: Math.max(0, Math.min(9999, Math.floor(finite(contract.rewardGold, 0)))),
        rewardItem: typeof contract.rewardItem === 'string' && /^[a-z0-9_-]{1,60}$/i.test(contract.rewardItem) ? contract.rewardItem : null,
        gear,
        ready: !!contract.ready || Math.floor(finite(contract.progress, 0)) >= required,
        acceptedAt: Math.max(0, Math.floor(finite(contract.acceptedAt, Date.now()))),
      }
      if (!state._restraintContract.id || !gear.length) state._restraintContract = null
    }
    // 损坏/旧版存档若只残留契约装备而没有对应委托，直接回收，避免形成无法解开的孤儿锁。
    Object.keys(state._restraints || {}).forEach(slot => {
      const worn = state._restraints[slot]
      if (!worn || worn.lockType !== 'contract') return
      const contract = state._restraintContract
      const belongs = contract && worn.contractId === contract.id && contract.gear.some(entry => entry.slot === slot && entry.id === worn.id)
      if (!belongs) delete state._restraints[slot]
    })
  }

  function migrateTown (state, context) {
    const { defaults: def, finite, hadTownReputation } = context
    state._guardCheckedThisVisit = !!state._guardCheckedThisVisit
    if (state._guardSearchPending && typeof state._guardSearchPending === 'object' && (state._guardSearchPending.direction === 'enter' || state._guardSearchPending.direction === 'exit')) {
      state._guardSearchPending = {
        direction: state._guardSearchPending.direction,
        startedAt: Math.floor(finite(state._guardSearchPending.startedAt, Date.now())),
        duration: Math.max(1, Math.floor(finite(state._guardSearchPending.duration, 60))),
      }
    } else {
      state._guardSearchPending = null
    }
    if (!state._guardSearchSettings || typeof state._guardSearchSettings !== 'object') state._guardSearchSettings = {}
    const gs = state._guardSearchSettings
    gs.enabled = gs.enabled !== false
    gs.frequency = ['low', 'standard', 'high', 'always'].includes(gs.frequency) ? gs.frequency : 'standard'
    gs.duration = ['fast', 'standard', 'immersive', 'fixed'].includes(gs.duration) ? gs.duration : 'standard'
    gs.confiscateLockpick = gs.confiscateLockpick !== false
    gs.allowBribe = gs.allowBribe !== false
    gs.deviceComments = gs.deviceComments !== false
    // 荣耀洞服务设置（旧档自动补默认）
    if (!state._glorySettings || typeof state._glorySettings !== 'object') state._glorySettings = {}
    state._glorySettings.footService = state._glorySettings.footService !== false
    // 广场木枷设置与任务断点（旧档自动补默认；损坏断点直接清除）
    if (!state._pillorySettings || typeof state._pillorySettings !== 'object' || Array.isArray(state._pillorySettings)) state._pillorySettings = {}
    state._pillorySettings.enabled = state._pillorySettings.enabled !== false
    state._pillorySettings.adultEvents = state._pillorySettings.adultEvents !== false
    state._pilloryLastEventId = typeof state._pilloryLastEventId === 'string' && /^[a-z0-9_-]{0,40}$/i.test(state._pilloryLastEventId)
      ? state._pilloryLastEventId
      : ''
    if (!state._pillory || typeof state._pillory !== 'object' || Array.isArray(state._pillory)) {
      state._pillory = null
    } else {
      const p = state._pillory
      const duration = Math.max(15, Math.min(180, Math.floor(finite(p.duration, 30))))
      const event = p.event && typeof p.event === 'object' && ['oral', 'anal', 'vagina', 'spank', null, undefined].includes(p.event.part)
        ? {
            id: typeof p.event.id === 'string' && /^[a-z0-9_-]{1,40}$/i.test(p.event.id) ? p.event.id : 'legacy_adult',
            kind: p.event.kind === 'ambient' ? 'ambient' : 'adult',
            part: ['oral', 'anal', 'vagina', 'spank'].includes(p.event.part) ? p.event.part : null,
            bpm: Math.max(0, Math.min(240, Math.floor(finite(p.event.bpm, 0)))),
            seconds: Math.max(15, Math.min(120, Math.floor(finite(p.event.seconds, 30)))),
            gold: Math.max(-50, Math.min(50, Math.floor(finite(p.event.gold, 0)))),
            applied: !!p.event.applied,
          }
        : null
      const results = Array.isArray(p.results)
        ? p.results.slice(0, 6).filter(entry => entry && typeof entry === 'object').map(entry => ({
            icon: String(entry.icon || '•').replace(/[<>&"'\u0000-\u001f]/g, '').slice(0, 4),
            label: String(entry.label || '事件').replace(/[<>&"'\u0000-\u001f]/g, '').slice(0, 24),
            detail: String(entry.detail || '').replace(/[<>&"'\u0000-\u001f]/g, '').slice(0, 80),
            type: ['good', 'danger', 'dim'].includes(entry.type) ? entry.type : 'dim',
          }))
        : []
      state._pillory = {
        source: ['voluntary', 'mercenary', 'fine', 'punishment'].includes(p.source) ? p.source : 'voluntary',
        duration,
        reward: Math.max(0, Math.min(999, Math.floor(finite(p.reward, 0)))),
        stage: ['restraint', 'adult', 'settle'].includes(p.stage) ? p.stage : 'restraint',
        event,
        results,
        returnTo: p.returnTo === 'leave' ? 'leave' : 'camp',
      }
    }
    // 雾灯镇声望：旧档只根据可验证的永久进度补发一次，不从日志反向猜测。
    if (!hadTownReputation) state._townReputation = JSON.parse(JSON.stringify(def._townReputation))
    const tr = state._townReputation
    tr.score = Math.max(-100, Math.min(100, Math.floor(finite(tr.score, 0))))
    tr.fame = Math.max(0, Math.min(100, Math.floor(finite(tr.fame, 0))))
    tr.history = Array.isArray(tr.history)
      ? tr.history.slice(0, 12).filter(entry => entry && typeof entry === 'object').map(entry => ({
          kind: entry.kind === 'fame' ? 'fame' : 'score',
          amount: Math.max(-100, Math.min(100, Math.floor(finite(entry.amount, 0)))),
          reason: String(entry.reason || '城镇事件').replace(/[<>&"'\u0000-\u001f]/g, '').slice(0, 60),
          at: Math.max(0, Math.floor(finite(entry.at, 0))),
        })).filter(entry => entry.amount !== 0)
      : []
    if (!tr.counters || typeof tr.counters !== 'object' || Array.isArray(tr.counters)) tr.counters = {}
    const tc = tr.counters
    ;['enemyKills', 'enemyKillMilestones', 'contractsCompleted', 'legalServices', 'prisonReleases', 'pilloryUses', 'guardChecks', 'bossRewarded'].forEach(key => {
      tc[key] = Math.max(0, Math.min(99999, Math.floor(finite(tc[key], 0))))
    })
    if (!hadTownReputation) {
      const bossDone = !!state.bossDefeated || (state.defeated || []).includes('spirit_of_forest')
      const contractCount = Math.max(0, Math.floor(finite(state._restraintContractCompleted, 0)))
      tr.score = Math.max(-100, Math.min(100, (bossDone ? 30 : 0) + Math.min(15, contractCount * 3) - (state._wanted ? 20 : 0)))
      tr.fame = Math.max(0, Math.min(100, (bossDone ? 40 : 0) + Math.min(20, contractCount * 2) + (state._wanted ? 15 : 0)))
      tc.contractsCompleted = contractCount
      tc.bossRewarded = bossDone ? 1 : 0
      if (bossDone) tr.history.push({ kind: 'score', amount: 30, reason: '旧档：击败森林之灵', at: 0 })
      if (contractCount) tr.history.push({ kind: 'score', amount: Math.min(15, contractCount * 3), reason: `旧档：完成 ${contractCount} 项妖缚委托`, at: 0 })
      if (state._wanted) tr.history.push({ kind: 'score', amount: -20, reason: '旧档：监狱逃犯', at: 0 })
    }
    tr.seeded = true
    if (!state._townReputationSettings || typeof state._townReputationSettings !== 'object' || Array.isArray(state._townReputationSettings)) state._townReputationSettings = {}
    const trs = state._townReputationSettings
    trs.enabled = trs.enabled !== false
    trs.economy = trs.economy !== false
    trs.guardEffects = trs.guardEffects !== false
    trs.serviceEffects = trs.serviceEffects !== false
    trs.gainRate = [0.5, 1, 1.5].includes(Number(trs.gainRate)) ? Number(trs.gainRate) : 1
    trs.detailedNotice = trs.detailedNotice !== false
    state._freeMeatBrand = !!state._freeMeatBrand
    state._blacksmithContract = !!state._blacksmithContract
    if (state._gloryDiscovered === undefined) state._gloryDiscovered = !!state._gloryDiscovered
    if (state._toiletUsed === undefined) state._toiletUsed = !!state._toiletUsed
   if (state._campReturnPos === undefined) state._campReturnPos = null
  }

  function migrateTavern (state, context) {
    const { finite } = context
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
    if (!state._mercenaryContract || typeof state._mercenaryContract !== 'object' || Array.isArray(state._mercenaryContract)) state._mercenaryContract = {}
    const mc = state._mercenaryContract
    mc.introSeen = !!mc.introSeen
    mc.debt = Math.max(0, Math.min(9999, Math.floor(finite(mc.debt, 0))))
    mc.violationCount = Math.max(0, Math.min(99, Math.floor(finite(mc.violationCount, 0))))
    mc.supportDisabledBattles = Math.max(0, Math.min(99, Math.floor(finite(mc.supportDisabledBattles, 0))))
    mc.completedCount = Math.max(0, Math.floor(finite(mc.completedCount, 0)))
    if (!mc.active || typeof mc.active !== 'object' || Array.isArray(mc.active)) mc.active = null
    else {
      const a = mc.active
      const required = Math.max(1, Math.min(20, Math.floor(finite(a.required, 1))))
      mc.active = {
        id: /^[a-z0-9_-]{1,80}$/i.test(String(a.id || '')) ? String(a.id) : '',
        type: ['battle', 'income', 'tavern', 'mercenary'].includes(a.type) ? a.type : '',
        name: String(a.name || '未命名契约').replace(/[<>&"'\u0000-\u001f]/g, '').slice(0, 30),
        difficulty: ['easy', 'normal', 'hard'].includes(a.difficulty) ? a.difficulty : 'easy',
        progress: Math.max(0, Math.min(required, Math.floor(finite(a.progress, 0)))),
        required,
        relief: Math.max(0, Math.min(9999, Math.floor(finite(a.relief, 0)))),
        device: a.device && typeof a.device === 'object' && /^[a-z0-9_-]{1,40}$/i.test(String(a.device.slot || '')) && /^[a-z0-9_-]{1,60}$/i.test(String(a.device.id || ''))
          ? { slot: String(a.device.slot), id: String(a.device.id) }
          : null,
        service: ['any', 'tavern', 'glory', 'mercenary'].includes(a.service) ? a.service : null,
        violations: Math.max(0, Math.min(9, Math.floor(finite(a.violations, 0)))),
        ready: !!a.ready || Math.floor(finite(a.progress, 0)) >= required,
      }
      if (!mc.active.id || !mc.active.type || (mc.active.type === 'battle' && !mc.active.device)) mc.active = null
    }
    if (!state._mercenaryContractSettings || typeof state._mercenaryContractSettings !== 'object' || Array.isArray(state._mercenaryContractSettings)) state._mercenaryContractSettings = {}
    const mcs = state._mercenaryContractSettings
    mcs.enabled = mcs.enabled !== false
    mcs.allowAdvance = mcs.allowAdvance !== false
    mcs.gearContracts = mcs.gearContracts !== false
    mcs.tavernContracts = mcs.tavernContracts !== false
    mcs.difficulty = ['lenient', 'standard', 'strict'].includes(mcs.difficulty) ? mcs.difficulty : 'standard'
    mcs.penalty = ['warning', 'standard', 'strict'].includes(mcs.penalty) ? mcs.penalty : 'standard'
    // 损坏存档若只剩佣兵契约锁，自动清理，避免永久卡槽。
    Object.keys(state._restraints || {}).forEach(slot => {
      const worn = state._restraints[slot]
      if (!worn || worn.lockType !== 'mercenary_contract') return
      const active = mc.active
      if (!active || active.type !== 'battle' || !active.device || active.device.slot !== slot || active.device.id !== worn.id || worn.contractId !== active.id) delete state._restraints[slot]
    })
    state._futaLastChat = Math.max(-1, Math.floor(finite(state._futaLastChat, -1)))
    state._prostituteDressed = !!state._prostituteDressed
    state._prostituteLevel = Math.max(1, Math.min(999, Math.floor(finite(state._prostituteLevel, 1))))
    state._prostituteDebt = Math.max(0, Math.min(9999, Math.floor(finite(state._prostituteDebt, 0))))
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
    state._activeShopRaw = typeof state._activeShopRaw === 'string' ? state._activeShopRaw : null
    state._campDeerTaken = !!state._campDeerTaken

  }

  function migrateBattle (state, context) {
    const { finite } = context
    // 旧战斗存档迁移：补肛塞子计数（旧档只有 blocked）
    if (state._battle && !state._battle.insertionBlocks && state._battle.smallPlugBlocked === undefined && state._battle.plugBlocked === undefined) {
      state._battle.smallPlugBlocked = state._battle.blocked || 0
      state._battle.plugBlocked = 0
      state._battle.blocked = state._battle.smallPlugBlocked
    }
    if (state._battle) {
      const currentBlocks = state._battle.insertionBlocks && typeof state._battle.insertionBlocks === 'object'
        ? state._battle.insertionBlocks
        : null
      const maxFor = slot => {
        const worn = state._restraints && state._restraints[slot]
        const def = worn && typeof window.RESTRAINTS !== 'undefined' ? RESTRAINTS.find(r => r.id === worn.id && r.insert) : null
        const count = def && def.stackable ? Math.max(1, Math.floor(finite(worn.count, 1))) : 1
        return def ? Math.max(0, Math.floor(finite(def.block, 0))) * count : 0
      }
      state._battle.insertionBlocks = {
        anal: Math.max(0, Math.min(maxFor('anal'), Math.floor(finite(currentBlocks ? currentBlocks.anal : maxFor('anal'), 0)))),
        vagina: Math.max(0, Math.min(maxFor('vagina'), Math.floor(finite(currentBlocks ? currentBlocks.vagina : maxFor('vagina'), 0)))),
      }
      state._battle.blocked = state._battle.insertionBlocks.anal + state._battle.insertionBlocks.vagina
      state._battle.bossForcedUnlockUsed = !!state._battle.bossForcedUnlockUsed
      const caravanDefs = [
        { slot: 'neck', id: 'slave_collar', label: '奴隶项圈', icon: '🐕' },
        { slot: 'arms', id: 'handcuffs', label: '手铐', icon: '⛓️' },
        { slot: 'mouth', id: 'leather_gag', label: '球形口塞', icon: '🤐' },
        { slot: 'anal', id: 'butt_plug', label: '小肛塞', icon: '🍑' },
      ]
      state._battle.caravanBindings = Array.isArray(state._battle.caravanBindings)
        ? state._battle.caravanBindings.map(binding => {
            const stage = Math.max(0, Math.min(3, Math.floor(finite(binding && binding.stage, -1))))
            const def = caravanDefs[stage]
            if (!binding || !def || binding.slot !== def.slot) return null
            const original = binding.original && typeof binding.original === 'object' && !Array.isArray(binding.original)
              ? { ...binding.original, slot: def.slot, locked: !!binding.original.locked, jammed: !!binding.original.jammed }
              : null
            return {
              stage,
              slot: def.slot,
              id: typeof binding.id === 'string' && /^[a-z0-9_-]{1,60}$/i.test(binding.id) ? binding.id : def.id,
              label: def.label,
              icon: def.icon,
              remaining: Math.max(0, Math.min(2, Math.floor(finite(binding.remaining, 2)))),
              locked: !!binding.locked,
              borrowed: !!binding.borrowed,
              original,
            }
          }).filter(Boolean)
        : []
      state._battle.caravanFourfoldCapture = !!state._battle.caravanFourfoldCapture
      const enemyState = state._battle.enemyState && typeof state._battle.enemyState === 'object'
        ? state._battle.enemyState
        : {}
      const validElite = ['toxic', 'armored', 'berserk', 'cunning']
      state._battle.enemyState = {
        elite: validElite.includes(enemyState.elite) ? enemyState.elite : null,
        enemyTurns: Math.max(0, Math.floor(finite(enemyState.enemyTurns, 0))),
        guard: Math.max(0, Math.floor(finite(enemyState.guard, 0))),
        charging: !!enemyState.charging,
        chargeStrike: !!enemyState.chargeStrike,
        fleeing: !!enemyState.fleeing,
        fleeAnnounced: !!enemyState.fleeAnnounced,
        fleeAttempted: !!enemyState.fleeAttempted,
      }
    }

  }

  function migrateEquipment (state, context) {
    const { finite } = context
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

  }

  const stages = [migrateCore, migrateRestraints, migrateTown, migrateTavern, migrateBattle, migrateEquipment]

  function run (state, context) {
    stages.forEach(stage => stage(state, context))
    return state
  }

  return { run, stages: stages.map(stage => stage.name) }
})()
