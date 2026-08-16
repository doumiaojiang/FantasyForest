/**
 * ui/map.js — 网格地图渲染组件
 *
 * 职责：纯渲染，无交互。显示网格 + 玩家位置 + 已访问状态。
 * 事件：ui:mapUpdate / state:changed
 */

window.MapUI = (function () {
  const canvas = document.getElementById('map-canvas')
  const legend = document.getElementById('map-legend')
  const currentLabel = document.getElementById('map-current-label')

  const TYPE_NAMES = {
    [TILE.EMPTY]: '道路',
    [TILE.START]: '村庄',
    [TILE.CHECKPOINT]: '检查点',
    [TILE.MONSTER]: '战斗',
    [TILE.BOSS]: '最终首领',
    [TILE.TRAP]: '陷阱',
    [TILE.AMBUSH]: '伏击',
    [TILE.EVENT]: '随机事件',
    [TILE.TREASURE]: '宝箱',
    [TILE.SHOP]: '商店',
    [TILE.CAMP]: '林缘营地',
  }

  const LEGEND_TYPES = [
    TILE.START, TILE.CAMP, TILE.EMPTY, TILE.MONSTER, TILE.TRAP, TILE.AMBUSH,
    TILE.TREASURE, TILE.SHOP, TILE.CHECKPOINT, TILE.BOSS,
  ]

  function init () {
    EventBus.on('ui:mapUpdate', render)
    EventBus.on('state:changed', render)
    renderLegend()
  }

  function renderLegend () {
    if (!legend) return
    legend.innerHTML = LEGEND_TYPES.map(type => `
      <span class="map-legend-item map-legend-${type}">
        <i>${TILE_ICONS[type] || '·'}</i><b>${TYPE_NAMES[type]}</b>
      </span>
    `).join('') + `
      <span class="map-legend-item map-legend-player"><i>✦</i><b>当前位置</b></span>
    `
  }

  function render () {
    const state = State.get()
    if (!state) { console.warn('[MapUI] no state'); return }
    if (!MapLib.grid || !MapLib.grid.length) { console.warn('[MapUI] no grid'); return }
    const grid = MapLib.grid
    const pos = state.position

    if (currentLabel && pos) {
      const here = MapLib.get(pos.x, pos.y)
      currentLabel.textContent = `${TYPE_NAMES[here?.type] || '未知区域'} · ${pos.x},${pos.y}`
    }

    canvas.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${MapLib.cols}, 1fr);
      gap: 2px;
      width: 100%;
      max-width: 580px;
      margin: 0 auto;
    `

    canvas.innerHTML = ''
    for (let y = 0; y < MapLib.rows; y++) {
      for (let x = 0; x < MapLib.cols; x++) {
        const tile = grid[y][x]
        const cell = document.createElement('div')
        cell.className = 'tile'

        if (pos && pos.x === x && pos.y === y) cell.classList.add('tile-player')
        if (state.visited.some(v => v.x === x && v.y === y)) cell.classList.add('tile-visited')
        cell.classList.add('tile-' + tile.type)
        cell.textContent = TILE_ICONS[tile.type] || ''
        const tileName = TYPE_NAMES[tile.type] || tile.raw || '未知区域'
        const isPlayer = pos && pos.x === x && pos.y === y
        cell.title = `${isPlayer ? '当前位置 · ' : ''}${tileName} (${x},${y})`
        cell.setAttribute('role', 'img')
        cell.setAttribute('aria-label', cell.title)
        canvas.appendChild(cell)
      }
    }
  }

  return { init, render }
})()
