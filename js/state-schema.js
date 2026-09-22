/**
 * state-schema.js — 可序列化领域状态与旧字段兼容层。
 *
 * systems.* 是 v3 起的真实存档结构；旧的下划线字段只作为运行时别名，
 * 不参与 JSON 序列化，供尚未完成迁移的系统继续工作。
 */
window.StateSchema = (function () {
  const DEFAULTS = {
    glory: {
      debt: 0,
      freeService: false,
      byGuard: false,
      byCaptain: false,
      wanted: 0,
      settings: { footService: true },
      discovered: false,
      justCleared: false,
    },
    prison: {
      active: false,
      points: 0,
      pardon: false,
      pardonSetting: true,
      escapeFails: 0,
      escapePenalty: 0,
      life: false,
      chastity: false,
      waistPrev: null,
      mouthPrev: null,
    },
    tavern: {
      guestGold: 50,
      debt: 0,
      workUnlocked: false,
      barkeepChatCount: 0,
      barkeepLastChat: -1,
      captainChatCount: 0,
      captainLastChat: -1,
    },
    prostitute: {
      licensed: false,
      boughtFromCaptain: false,
      dressed: false,
      level: 1,
      debt: 0,
      gear: {},
      ownedGear: [],
      equippedGear: {},
      ordinaryGearMigrated: false,
      serviceGearRestored: false,
      swapCost: 20,
      pendingTask: null,
    },
    mercenary: {
      member: null,
      contract: {
        introSeen: false,
        debt: 0,
        violationCount: 0,
        supportDisabledBattles: 0,
        completedCount: 0,
        active: null,
      },
      settings: {
        enabled: true,
        allowAdvance: true,
        gearContracts: true,
        tavernContracts: true,
        difficulty: 'standard',
        penalty: 'standard',
      },
      lastChat: -1,
    },
    restraints: {
      worn: {},
      owned: [],
      ownedCounts: {},
      insertionCharges: {},
      storedInsertionCharges: {},
      settings: {
        allowTrap: true,
        trapAutoLock: true,
        redirectAttacks: true,
        bossForcedUnlock: true,
        chargeNotice: 'detail',
        vibrationControl: true,
      },
      legacyPlugActive: false,
    },
    restraintContract: {
      active: null,
      offers: [],
      completed: 0,
    },
    town: {
      wanted: false,
      teleports: ['camp'],
      freeMeatBrand: false,
      blacksmithContract: false,
      toiletUsed: false,
      returnPosition: null,
      deerGiftTaken: false,
    },
    guard: {
      checkedThisVisit: false,
      searchPending: null,
      settings: {
        enabled: true,
        frequency: 'standard',
        duration: 'standard',
        confiscateLockpick: true,
        allowBribe: true,
        deviceComments: true,
      },
    },
    pillory: {
      settings: { enabled: true, adultEvents: true },
      lastEventId: '',
      active: null,
    },
    townReputation: {
      value: {
        score: 0,
        fame: 0,
        history: [],
        counters: {
          enemyKills: 0,
          enemyKillMilestones: 0,
          contractsCompleted: 0,
          legalServices: 0,
          prisonReleases: 0,
          pilloryUses: 0,
          guardChecks: 0,
          bossRewarded: 0,
        },
        seeded: true,
      },
      settings: {
        enabled: true,
        economy: true,
        guardEffects: true,
        serviceEffects: true,
        gainRate: 1,
        detailedNotice: true,
      },
    },
    pStory: {
      commissionStage: 0,
      commissionLeads: { barkeep: false, blacksmith: false },
      commissionOutcome: null,
      commissionBattle: null,
      commissionCaptured: false,
      caravanTrailSeen: false,
      clothesAwaitingRecovery: false,
      caravanDebt: 0,
      escortStage: 0,
      escortResult: null,
      fourfoldEscortCompleted: false,
      defeatDispatchPending: false,
      defeatPunished: false,
      defeatSentenced: false,
      defeatPunishmentStep: 0,
      banditAftermath: null,
      banditDefeatCount: 0,
      banditDefeatScene: 0,
      banditDefeatResult: null,
      banditClothesLocked: false,
      banditWitnessBegged: false,
      banditGateReactionPending: false,
      banditVictoryResult: null,
      banditLeaderFate: null,
      banditMarkChoice: null,
      banditToySession: null,
      banditTradeStep: 0,
      banditBridgeToll: false,
      banditRansomDebt: 0,
      townInquiry: { guard: false, merchant: false, citizen: false },
      revision: 3,
      bridgeResult: null,
      bridgePermitAcquired: false,
      bridgeAftermath: null,
      investigationChoices: { barkeep: null, blacksmith: null },
      mainlineStage: 0,
      role: null,
      chapterOneLocked: false,
      gateChoices: [],
      dayaOutcome: null,
      routeLocked: false,
    },
  }

  const LEGACY_FIELDS = {
    _gloryDebt: ['glory', 'debt'],
    _gloryFreeService: ['glory', 'freeService'],
    _gloryByGuard: ['glory', 'byGuard'],
    _gloryByCaptain: ['glory', 'byCaptain'],
    _gloryWanted: ['glory', 'wanted'],
    _glorySettings: ['glory', 'settings'],
    _gloryDiscovered: ['glory', 'discovered'],
    _gloryJustCleared: ['glory', 'justCleared'],
    _inPrison: ['prison', 'active'],
    _prisonPoints: ['prison', 'points'],
    _prisonPardon: ['prison', 'pardon'],
    _prisonPardonSetting: ['prison', 'pardonSetting'],
    _prisonEscapeFails: ['prison', 'escapeFails'],
    _prisonEscapePenalty: ['prison', 'escapePenalty'],
    _prisonLife: ['prison', 'life'],
    _prisonChastity: ['prison', 'chastity'],
    _prisonWaistPrev: ['prison', 'waistPrev'],
    _prisonMouthPrev: ['prison', 'mouthPrev'],
    _tavernGuest: ['tavern', 'guestGold'],
    _tavernDebt: ['tavern', 'debt'],
    _tavernWorkUnlocked: ['tavern', 'workUnlocked'],
    _barkeepChatCount: ['tavern', 'barkeepChatCount'],
    _barkeepLastChat: ['tavern', 'barkeepLastChat'],
    _captainChatCount: ['tavern', 'captainChatCount'],
    _captainLastChat: ['tavern', 'captainLastChat'],
    _prostituteLicensed: ['prostitute', 'licensed'],
    _prostituteBoughtFromCaptain: ['prostitute', 'boughtFromCaptain'],
    _prostituteDressed: ['prostitute', 'dressed'],
    _prostituteLevel: ['prostitute', 'level'],
    _prostituteDebt: ['prostitute', 'debt'],
    _prostituteGear: ['prostitute', 'gear'],
    _ownedProstituteGear: ['prostitute', 'ownedGear'],
    _equippedProstituteGear: ['prostitute', 'equippedGear'],
    _ordinaryProstituteGearMigrated: ['prostitute', 'ordinaryGearMigrated'],
    _serviceGearRestored: ['prostitute', 'serviceGearRestored'],
    _prostituteSwapCost: ['prostitute', 'swapCost'],
    _prostitutePendingTask: ['prostitute', 'pendingTask'],
    _mercenary: ['mercenary', 'member'],
    _mercenaryContract: ['mercenary', 'contract'],
    _mercenaryContractSettings: ['mercenary', 'settings'],
    _futaLastChat: ['mercenary', 'lastChat'],
    _restraints: ['restraints', 'worn'],
    _ownedRestraints: ['restraints', 'owned'],
    _ownedRestraintCounts: ['restraints', 'ownedCounts'],
    _insertionCharges: ['restraints', 'insertionCharges'],
    _storedInsertionCharges: ['restraints', 'storedInsertionCharges'],
    _restraintSettings: ['restraints', 'settings'],
    _plugActive: ['restraints', 'legacyPlugActive'],
    _restraintContract: ['restraintContract', 'active'],
    _restraintContractOffers: ['restraintContract', 'offers'],
    _restraintContractCompleted: ['restraintContract', 'completed'],
    _wanted: ['town', 'wanted'],
    _teleports: ['town', 'teleports'],
    _freeMeatBrand: ['town', 'freeMeatBrand'],
    _blacksmithContract: ['town', 'blacksmithContract'],
    _toiletUsed: ['town', 'toiletUsed'],
    _campReturnPos: ['town', 'returnPosition'],
    _campDeerTaken: ['town', 'deerGiftTaken'],
    _guardCheckedThisVisit: ['guard', 'checkedThisVisit'],
    _guardSearchPending: ['guard', 'searchPending'],
    _guardSearchSettings: ['guard', 'settings'],
    _pillorySettings: ['pillory', 'settings'],
    _pilloryLastEventId: ['pillory', 'lastEventId'],
    _pillory: ['pillory', 'active'],
    _townReputation: ['townReputation', 'value'],
    _townReputationSettings: ['townReputation', 'settings'],
    _wrongCommissionStage: ['pStory', 'commissionStage'],
    _wrongCommissionLeads: ['pStory', 'commissionLeads'],
    _wrongCommissionOutcome: ['pStory', 'commissionOutcome'],
    _wrongCommissionBattle: ['pStory', 'commissionBattle'],
    _wrongCommissionCaptured: ['pStory', 'commissionCaptured'],
    _pCaravanTrailSeen: ['pStory', 'caravanTrailSeen'],
    _pCaravanClothesAwaitingRecovery: ['pStory', 'clothesAwaitingRecovery'],
    _pCaravanDebt: ['pStory', 'caravanDebt'],
    _pCaravanEscortStage: ['pStory', 'escortStage'],
    _pCaravanEscortResult: ['pStory', 'escortResult'],
    _pFourfoldEscortCompleted: ['pStory', 'fourfoldEscortCompleted'],
    _pDefeatDispatchPending: ['pStory', 'defeatDispatchPending'],
    _pDefeatPunished: ['pStory', 'defeatPunished'],
    _pDefeatSentenced: ['pStory', 'defeatSentenced'],
    _pDefeatPunishmentStep: ['pStory', 'defeatPunishmentStep'],
    _pBanditAftermath: ['pStory', 'banditAftermath'],
    _pBanditDefeatCount: ['pStory', 'banditDefeatCount'],
    _pBanditDefeatScene: ['pStory', 'banditDefeatScene'],
    _pBanditDefeatResult: ['pStory', 'banditDefeatResult'],
    _pBanditClothesLocked: ['pStory', 'banditClothesLocked'],
    _pBanditWitnessBegged: ['pStory', 'banditWitnessBegged'],
    _pBanditGateReactionPending: ['pStory', 'banditGateReactionPending'],
    _pBanditVictoryResult: ['pStory', 'banditVictoryResult'],
    _pBanditLeaderFate: ['pStory', 'banditLeaderFate'],
    _pBanditMarkChoice: ['pStory', 'banditMarkChoice'],
    _pBanditToySession: ['pStory', 'banditToySession'],
    _pBanditTradeStep: ['pStory', 'banditTradeStep'],
    _pBanditBridgeToll: ['pStory', 'banditBridgeToll'],
    _pBanditRansomDebt: ['pStory', 'banditRansomDebt'],
    _pTownInquiry: ['pStory', 'townInquiry'],
    _pStoryRevision: ['pStory', 'revision'],
    _pBridgeResult: ['pStory', 'bridgeResult'],
    _pBridgePermitAcquired: ['pStory', 'bridgePermitAcquired'],
    _pBridgeAftermath: ['pStory', 'bridgeAftermath'],
    _pInvestigationChoices: ['pStory', 'investigationChoices'],
    _pMainlineStage: ['pStory', 'mainlineStage'],
    _pRole: ['pStory', 'role'],
    _pChapterOneLocked: ['pStory', 'chapterOneLocked'],
    _pGateChoices: ['pStory', 'gateChoices'],
    _pDayaOutcome: ['pStory', 'dayaOutcome'],
    _pRouteLocked: ['pStory', 'routeLocked'],
  }

  function clone (value) {
    if (Array.isArray(value)) return value.map(clone)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]))
  }

  function ensureDomain (state, name) {
    if (!state.systems || typeof state.systems !== 'object' || Array.isArray(state.systems)) state.systems = {}
    const current = state.systems[name]
    state.systems[name] = current && typeof current === 'object' && !Array.isArray(current) ? current : {}
    const defaults = DEFAULTS[name]
    Object.entries(defaults).forEach(([key, value]) => {
      if (state.systems[name][key] === undefined) state.systems[name][key] = clone(value)
    })
    return state.systems[name]
  }

  function installAlias (state, legacyKey, domainName, domainKey) {
    const descriptor = Object.getOwnPropertyDescriptor(state, legacyKey)
    const legacyValue = descriptor && !descriptor.get ? state[legacyKey] : undefined
    if (legacyValue !== undefined) state.systems[domainName][domainKey] = legacyValue
    if (descriptor && descriptor.configurable === false) return
    delete state[legacyKey]
    Object.defineProperty(state, legacyKey, {
      configurable: true,
      enumerable: false,
      get () { return state.systems[domainName][domainKey] },
      set (value) { state.systems[domainName][domainKey] = value },
    })
  }

  function prepare (state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return state
    Object.keys(DEFAULTS).forEach(name => ensureDomain(state, name))
    Object.entries(LEGACY_FIELDS).forEach(([legacyKey, [domainName, domainKey]]) => {
      installAlias(state, legacyKey, domainName, domainKey)
    })
    return state
  }

  function domain (state, name) {
    prepare(state)
    if (!DEFAULTS[name]) throw new Error(`未知状态领域：${name}`)
    return state.systems[name]
  }

  return { DEFAULTS, LEGACY_FIELDS, prepare, domain }
})()
