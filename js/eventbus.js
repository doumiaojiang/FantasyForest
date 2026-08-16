/**
 * eventbus.js — 事件总线
 *
 * 职责：模块间通过事件通信，不直接相互调用。
 * 游戏逻辑 emit 事件 → UI 监听并更新。
 *
 * 使用方式：
 *   EventBus.on('battle:start', (data) => { ... })
 *   EventBus.emit('battle:start', { enemy })
 */

window.EventBus = (function () {
  const _listeners = {}

  function on (event, handler) {
    if (!_listeners[event]) _listeners[event] = []
    _listeners[event].push(handler)
    return () => off(event, handler)
  }

  function off (event, handler) {
    if (!_listeners[event]) return
    _listeners[event] = _listeners[event].filter(h => h !== handler)
  }

  function emit (event, data) {
    if (!_listeners[event]) return
    _listeners[event].forEach(h => {
      try { h(data) } catch (e) { console.error('[EventBus] handler error:', e) }
    })
  }

  function clear (event) {
    if (event) delete _listeners[event]
    else Object.keys(_listeners).forEach(k => delete _listeners[k])
  }

  return { on, off, emit, clear }
})()

/* ========================
   游戏事件清单（文档用）
   新增事件请在此注册
   ========================

   --- 生命周期 ---
   game:init         — 游戏初始化完成   { difficulty }
   game:save         — 存档触发         { state }
   game:load         — 读档完成         { state }
   game:gameover     — 死亡             { }

   --- 移动 ---
   movement:roll     — 掷出移动点数     { value }
   movement:arrive   — 到达某格         { node }
   movement:pass     — 经过某格         { node }

   --- 战斗 ---
   battle:start      — 战斗开始         { enemy }
   battle:attack     — 玩家攻击         { result }
   battle:enemyTurn  — 敌人攻击         { result }
   battle:end        — 战斗结束         { loot }
   battle:flee       — 敌人逃跑         { }

   --- 状态 ---
   status:apply      — 添加状态         { effect }
   status:tick       — 状态 tick        { effects }
   status:remove     — 状态结束         { effect }

   --- 商店 ---
   shop:open         — 打开商店         { }
   shop:buy          — 购买物品         { item, price }
   shop:close        — 关闭商店         { }

   --- 地图事件 ---
   trap:trigger      — 触发陷阱         { trap }
   treasure:find     — 发现宝藏         { treasure }

   --- UI ---
   ui:log            — 添加日志         { text, type }
   ui:dice           — 骰子动画         { value }
   ui:modal          — 打开弹窗         { }
   ui:modalclose     — 关闭弹窗         { }
   ui:hudUpdate      — 更新 HUD        { state }
   ui:mapUpdate      — 更新地图        { state }
 */