/**
 * ui/index.js — UI 层聚合入口
 *
 * 初始化所有 UI 组件。
 */

window.UI = {
  init () {
    HUD.init()
    MapUI.init()
    BattleUI.init()
    Log.init()
  },
}