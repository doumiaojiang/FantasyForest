/**
 * systems/chastity.js — 贞操装置系统
 *
 * DD 腰部贞操装置与监狱剧情贞操锁同属「贞操装置」类别：锁死小穴。
 * 穿戴时会取出小穴槽装备，穿戴期间禁止再次插入。
 * 穿戴后，所有涉及小穴 / 撸管 / 寸止的任务一律改为肛交。
 */

window.ChastitySystem = (function () {
  const CATEGORY = 'chastity'
  const NAME = '贞操装备'

  /** 是否佩戴了任一贞操装置（腰部妖缚槽 / 监狱贞操锁 / 酒馆贞操笼） */
  function isWorn () {
    const state = State.get()
    if (!state) return false
    // 妖缚腰部槽（贞操装置 / 监狱贞操锁）
    if (typeof RestraintSystem !== 'undefined' && RestraintSystem.hasWaistChastity()) return true
    if (state._prisonChastity) return true
    return !!(state._prostituteGear && state._prostituteGear.chastity)
  }

  /** 部位标签：贞操装置强制菊穴；否则按性别 + Z 规则（女性 Z≥4 用小穴） */
  function orifice (roll) {
    if (isWorn()) return '菊穴'
    const gender = State.get().gender
    return gender !== 'male' && roll >= 4 ? '小穴' : '菊穴'
  }

  /** 转换任务文本中的部位：贞操装置 小穴→菊穴；否则女性 Z≥4 菊穴→小穴 */
  function convertDesc (desc, roll) {
    if (isWorn()) return String(desc || '').replace(/小穴/g, '菊穴')
    const gender = State.get().gender
    return gender !== 'male' && roll >= 4
      ? String(desc || '').replace(/菊穴/g, '小穴')
      : desc
  }

  /**
   * 解析怪物攻击任务，应用贞操装置。
   * @returns {{ attack: object, part: string|null, chastity: boolean }}
   */
  function resolveAttack (attack) {
    const worn = isWorn()
    let part = /菊穴/.test(attack.desc) ? 'anal' : /小穴/.test(attack.desc) ? 'vagina' : null
    let eff = attack
    if (worn) {
      let desc = attack.desc || ''
      if (attack.special === 'drain_self' || attack.name === '吸取') {
        desc = '她把你按趴在地，从背后狠狠操进你的菊穴，直到你双腿发软才停下，从中吸收 1 HP。你 -1 HP，她 +1 HP'
        part = 'anal'
      } else if (attack.special === 'heal_self' || attack.name === '让你干她') {
        desc = '她把你按趴在床沿，用假阴茎狠狠操进你的菊穴，以 150 BPM 持续 1 分钟。她 +2 HP'
        part = 'anal'
      } else if (/小穴/.test(desc)) {
        desc = desc.replace(/小穴/g, '菊穴')
        part = 'anal'
      }
      if (desc !== (attack.desc || '')) {
        eff = { ...attack, desc, name: attack.name }
      }
    }
    return { attack: eff, part, chastity: worn }
  }

  return { CATEGORY, NAME, isWorn, orifice, convertDesc, resolveAttack }
})()
