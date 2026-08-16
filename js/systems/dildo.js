/**
 * systems/dildo.js — 假阳具体积系统
 *
 * 处理 size_down / size_up 状态对敌人阴茎大小的直接修改。
 *
 * 尺寸等级（从小到大）：
 *   fingering (手指) → small (小号) → normal (普通) → big (大号) → huge (巨型)
 *
 * 规则：
 *   - 缩小：等级 -1；小号再缩变手指
 *   - 增大：等级 +1；大号再增变巨型
 *   - 多个状态叠加（如两个增大 = +2 级）
 *   - big_knotted (带结大号) 视为 big 等级
 */

window.DildoSystem = (function () {
  const SCALE = ['fingering', 'small', 'normal', 'big', 'huge']

  const NAMES = {
    fingering: '手指',
    small: '小号假阴茎',
    normal: '普通假阴茎',
    big: '大号假阴茎',
    huge: '巨型假阴茎',
    big_knotted: '带结大号假阴茎',
    // 带结系列（保留带结特征，随体积变化）
    'knotted_fingering': '带结手指',
    'knotted_small': '带结小号假阴茎',
    'knotted_normal': '带结普通假阴茎',
    'knotted_big': '带结大号假阴茎',
    'knotted_huge': '带结巨型假阴茎',
  }

  const KNOTTED_PREFIX = 'knotted_'

  /** 是否带结 */
  function isKnotted (dildo) {
    return dildo === 'big_knotted' || (dildo && dildo.indexOf(KNOTTED_PREFIX) === 0)
  }

  /** 基础尺寸 → 等级索引（未知映射到 normal） */
  function baseIndex (dildo) {
    if (!dildo) return 2
    // 带结版本按对应基础尺寸的等级
    if (isKnotted(dildo)) {
      const base = dildo === 'big_knotted' ? 'big' : dildo.slice(KNOTTED_PREFIX.length)
      const idx = SCALE.indexOf(base)
      return idx >= 0 ? idx : 2
    }
    const idx = SCALE.indexOf(dildo)
    return idx >= 0 ? idx : 2
  }

  /** 计算敌人当前生效的假阳具体积 */
  function effective (enemyId) {
    const state = State.get()
    const enemy = DATA.monster(enemyId)
    if (!enemy) return { name: '普通假阴茎', id: 'normal', level: 2 }

    let level = baseIndex(enemy.dildo)
    const knotted = isKnotted(enemy.dildo)

    // 统计状态效果（允许多次叠加）
    let up = state.statuses.filter(s => s.id === 'size_up').length
    let down = state.statuses.filter(s => s.id === 'size_down').length

    level = level + up - down
    level = Math.max(0, Math.min(SCALE.length - 1, level))

    const baseId = SCALE[level]
    // 带结缩到最低级(手指)时，带结特征消失
    const id = (knotted && level > 0) ? KNOTTED_PREFIX + baseId : baseId
    return { id, name: NAMES[id] || NAMES[baseId], level }
  }

  /** 简化后的体积描述（用于战斗任务文本） */
  function describe (enemyId) {
    const e = effective(enemyId)
    return e.name
  }

  return { effective, describe, SCALE, NAMES }
})()