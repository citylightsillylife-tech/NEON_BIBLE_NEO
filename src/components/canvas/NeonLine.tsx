import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { Circle, Group, Path } from 'react-konva'
import type Konva from 'konva'

import { useNeonStore } from '@/store/useNeonStore'
import type { NeonPath } from '@/types/neon'
import { pointsToCatmullRomPath, pointsToRoundedPath } from '@/utils/geometry'

type Props = {
  path: NeonPath
}

const MIN_ANGLE_DEG = 60

// === Registries (module-scope) ===
const coreGroupRegistry = new Map<string, Konva.Group>()
const fxGroupRegistry = new Map<string, Konva.Group>()
const uiGroupRegistry = new Map<string, Konva.Group>()
const corePathRegistry = new Map<string, Konva.Path>()

export const getCoreLineNode = (id: string) => corePathRegistry.get(id)

type FxNodes = { outer: Konva.Path; inner: Konva.Path }
const fxPathRegistry = new Map<string, FxNodes>()
const uiOutlineRegistry = new Map<string, Konva.Path>()

// === Layer batchDraw throttling (module-scope) ===
let drawRafId: number | null = null
const pendingLayers = new Set<Konva.Layer>()

const requestLayerDraw = (layer: Konva.Layer | null | undefined) => {
  if (!layer) return
  pendingLayers.add(layer)
  if (drawRafId != null) return
  drawRafId = requestAnimationFrame(() => {
    pendingLayers.forEach((l) => l.batchDraw())
    pendingLayers.clear()
    drawRafId = null
  })
}

let lastPathsRef: NeonPath[] | null = null
let lastPathMap: Map<string, NeonPath> | null = null
const getPathById = (id: string) => {
  const store = useNeonStore.getState()
  const paths = store.neonPaths
  if (paths !== lastPathsRef) {
    lastPathsRef = paths
    lastPathMap = new Map(paths.map((p) => [p.id, p] as const))
  }
  return lastPathMap?.get(id)
}

export const previewCornerRadius = (ids: string[], radius: number) => {
  const r = Math.max(0, radius)
  for (const id of ids) {
    const p = getPathById(id)
    if (p?.isSmooth) continue // Smooth時はCornerRadiusを無視
    const pts = pointsRegistry.get(id)?.points ?? p?.points
    if (!pts) continue
    const d = pointsToRoundedPath(pts, r)
    if (!d) continue
    const core = corePathRegistry.get(id)
    if (core) {
      core.data(d)
      requestLayerDraw(core.getLayer())
    }
    const fx = fxPathRegistry.get(id)
    if (fx) {
      fx.outer.data(d)
      fx.inner.data(d)
      requestLayerDraw(fx.outer.getLayer())
    }
    const outline = uiOutlineRegistry.get(id)
    if (outline) {
      outline.data(d)
      requestLayerDraw(outline.getLayer())
    }
  }
}

const updateVisualPath = (path: NeonPath) => {
  const points = path.points
  let d = ''
  if (path.isSmooth) {
    d = pointsToCatmullRomPath(points, path.smoothTension, false)
  } else {
    d = pointsToRoundedPath(points, path.cornerRadius)
  }

  // Visual Update
  const core = corePathRegistry.get(path.id)
  if (core) {
    core.data(d)
    requestLayerDraw(core.getLayer())
  }

  const fxNodes = fxPathRegistry.get(path.id)
  if (fxNodes) {
    fxNodes.outer.data(d)
    fxNodes.inner.data(d)
    requestLayerDraw(fxNodes.outer.getLayer())
  }

  const ui = uiOutlineRegistry.get(path.id)
  if (ui) {
    ui.data(d)
    requestLayerDraw(ui.getLayer())
  }
}

// === Points store (module-scope, store更新なしでの同期表示用) ===
type PointsEntry = { points: number[]; listeners: Set<() => void>; refs: number }
const pointsRegistry = new Map<string, PointsEntry>()

const ensurePointsEntry = (id: string, fallback: number[]) => {
  const existing = pointsRegistry.get(id)
  if (existing) return existing
  const created: PointsEntry = { points: fallback, listeners: new Set(), refs: 0 }
  pointsRegistry.set(id, created)
  return created
}

const setPathPoints = (id: string, points: number[]) => {
  const entry = ensurePointsEntry(id, points)
  entry.points = points
  entry.listeners.forEach((fn) => fn())
}

const subscribePathPoints = (id: string, fallback: number[], listener: () => void) => {
  const entry = ensurePointsEntry(id, fallback)
  entry.refs += 1
  entry.listeners.add(listener)
  return () => {
    entry.listeners.delete(listener)
    entry.refs -= 1
    if (entry.refs <= 0) pointsRegistry.delete(id)
  }
}

const getPathPointsSnapshot = (id: string, fallback: number[]) => {
  return pointsRegistry.get(id)?.points ?? fallback
}

const usePathPoints = (id: string, fallback: number[]) => {
  return useSyncExternalStore(
    (listener) => subscribePathPoints(id, fallback, listener),
    () => getPathPointsSnapshot(id, fallback),
    () => fallback,
  )
}

// === Shared blink loop (module-scope, 1 RAF for all) ===
let blinkOpacity = 1
const blinkListeners = new Set<() => void>()
let blinkRafId: number | null = null

const ensureBlinkLoop = () => {
  if (blinkRafId != null) return
  let frame = 0
  const tick = () => {
    frame += 1
    const t = frame * 0.12
    blinkOpacity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t))
    blinkListeners.forEach((fn) => fn())
    blinkRafId = requestAnimationFrame(tick)
  }
  blinkRafId = requestAnimationFrame(tick)
}

const subscribeBlink = (listener: () => void) => {
  ensureBlinkLoop()
  blinkListeners.add(listener)
  return () => {
    blinkListeners.delete(listener)
    if (blinkListeners.size === 0 && blinkRafId != null) {
      cancelAnimationFrame(blinkRafId)
      blinkRafId = null
    }
  }
}

const useBlinkOpacity = () => {
  return useSyncExternalStore(
    (listener) => subscribeBlink(listener),
    () => blinkOpacity,
    () => 1,
  )
}

// === FX Layer ===
import { NEON_RENDER_CONFIG } from '@/config/neonRenderConfig'

export const NeonLineFx = ({ path }: Props) => {
  const points = usePathPoints(path.id, path.points)

  // Calculate layer widths based on config
  const { width: basePathWidth, glow: baseGlow, color } = path
  const { glow } = NEON_RENDER_CONFIG

  // Layer 1: Inner (High Intensity)
  const innerWidth = basePathWidth * glow.inner.widthRatio + baseGlow * glow.inner.glowRatio
  // Layer 2: Mid (Bridge)
  const midWidth = basePathWidth * glow.mid.widthRatio + baseGlow * glow.mid.glowRatio
  // Layer 3: Outer (Atmosphere)
  const outerWidth = basePathWidth * glow.outer.widthRatio + baseGlow * glow.outer.glowRatio

  const pathData = useMemo(() => {
    if (path.isSmooth) return pointsToCatmullRomPath(points, path.smoothTension, false)
    return pointsToRoundedPath(points, path.cornerRadius)
  }, [points, path.isSmooth, path.smoothTension, path.cornerRadius])

  const fxGroupRef = useRef<Konva.Group | null>(null)

  // Refs for direct access
  const innerRef = useRef<Konva.Path | null>(null)
  const midRef = useRef<Konva.Path | null>(null)
  const outerRef = useRef<Konva.Path | null>(null)

  useEffect(() => {
    const node = fxGroupRef.current
    if (!node) return
    fxGroupRegistry.set(path.id, node)
    return () => {
      fxGroupRegistry.delete(path.id)
    }
  }, [path.id])

  // Note: We only register outer/inner for the sake of mass-update logic (like corner radius preview).
  // Ideally, that logic should also be robust enough to handle the 3rd layer or just be generic.
  // For now, we map 'inner' to our inner layer and 'outer' to our outer layer. Mid is managed implicitly.
  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    fxPathRegistry.set(path.id, { outer, inner })
    return () => {
      fxPathRegistry.delete(path.id)
    }
  }, [path.id])

  useEffect(() => {
    setPathPoints(path.id, path.points)
  }, [path.id, path.points])

  return (
    <Group ref={fxGroupRef} listening={false}>
      {/* Outer Atmosphere */}
      <Path
        ref={outerRef}
        data={pathData}
        stroke={color}
        strokeWidth={outerWidth}
        opacity={glow.outer.opacity}
        globalCompositeOperation={glow.compositeOperation}
        lineCap="round"
        lineJoin="round"
        strokeScaleEnabled
        listening={false}
        perfectDrawEnabled={false}
      />
      {/* Mid Bridge */}
      <Path
        ref={midRef}
        data={pathData}
        stroke={color}
        strokeWidth={midWidth}
        opacity={glow.mid.opacity}
        globalCompositeOperation={glow.compositeOperation}
        lineCap="round"
        lineJoin="round"
        strokeScaleEnabled
        listening={false}
        perfectDrawEnabled={false}
      />
      {/* Inner Intensity */}
      <Path
        ref={innerRef}
        data={pathData}
        stroke={color}
        strokeWidth={innerWidth}
        opacity={glow.inner.opacity}
        globalCompositeOperation={glow.compositeOperation}
        lineCap="round"
        lineJoin="round"
        strokeScaleEnabled
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

// === CORE Layer (selection + drag leader) ===
export const NeonLineCore = ({ path }: Props) => {
  const points = usePathPoints(path.id, path.points)

  // Use config for core appearance
  const { core } = NEON_RENDER_CONFIG
  const coreWidth = path.width * core.widthRatio

  const pathData = useMemo(() => {
    if (path.isSmooth) return pointsToCatmullRomPath(points, path.smoothTension, false)
    return pointsToRoundedPath(points, path.cornerRadius)
  }, [points, path.isSmooth, path.smoothTension, path.cornerRadius])

  // O(1) selected判定
  const selected = useNeonStore((s) => s.selectedIdsMap[path.id] === true)
  const currentTool = useNeonStore((s) => s.currentTool)
  const selectPath = useNeonStore((s) => s.selectPath)
  const toggleSelection = useNeonStore((s) => s.toggleSelection)
  const moveSelectedPaths = useNeonStore((s) => s.moveSelectedPaths)
  const setIsDraggingSelection = useNeonStore((s) => s.setIsDraggingSelection)

  const coreGroupRef = useRef<Konva.Group | null>(null)
  const corePathRef = useRef<Konva.Path | null>(null)

  const dragStateRef = useRef<{
    lastX: number
    lastY: number
    totalDx: number
    totalDy: number
    selectedIds: string[]
    isMulti: boolean
    initialized: boolean
  }>({
    lastX: 0,
    lastY: 0,
    totalDx: 0,
    totalDy: 0,
    selectedIds: [],
    isMulti: false,
    initialized: false,
  })

  useEffect(() => {
    const node = coreGroupRef.current
    if (!node) return
    coreGroupRegistry.set(path.id, node)
    return () => {
      coreGroupRegistry.delete(path.id)
    }
  }, [path.id])

  useEffect(() => {
    const node = corePathRef.current
    if (!node) return
    corePathRegistry.set(path.id, node)
    return () => {
      corePathRegistry.delete(path.id)
    }
  }, [path.id])

  useEffect(() => {
    setPathPoints(path.id, path.points)
  }, [path.id, path.points])

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // ペン/ハンド等では一切選択イベントを拾わない（描画クリックを潰さない・カーソルを壊さない）
    if (currentTool !== 'select') return
    e.cancelBubble = true
    const shiftKey = Boolean((e.evt as MouseEvent | undefined)?.shiftKey)
    if (shiftKey) {
      toggleSelection(path.id)
    } else {
      selectPath(path.id, true)
    }
  }

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (currentTool !== 'select') return
    e.cancelBubble = true
    if (e.evt) {
      // Native propagation control
      e.evt.stopPropagation()
    }
    const shiftKey = Boolean((e.evt as MouseEvent | undefined)?.shiftKey)
    if (shiftKey) {
      toggleSelection(path.id)
    } else {
      const store = useNeonStore.getState()
      // If already selected, do nothing
      if (store.selectedIdsMap[path.id]) return

      // If not selected, select it immediately
      // Since draggable is now enabled by default for the tool, Konva will pick up the drag naturally
      selectPath(path.id, true)
    }
  }

  const handleCursor = (cursor: string) => (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (currentTool !== 'select') return
    const stage = e.target.getStage()
    const container = stage?.container()
    if (container) container.style.cursor = cursor
  }

  const handleGroupDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    const leader = coreGroupRef.current
    if (!leader) return

    const x = leader.x()
    const y = leader.y()

    // Safety: Ensure we are dragging a selected object
    // (In case mousedown selection didn't trigger re-render fast enough, or some other edge case)
    const store = useNeonStore.getState()
    if (!store.selectedIdsMap[path.id]) {
      // If we are dragging an unselected object (and it hasn't been selected yet), select it.
      // We assume Shift key logic was handled in MouseDown, but if we got here without selection, 
      // it means we are dragging a fresh target.
      store.selectPath(path.id, true)
    }

    // onDragStartは最小限（コピー/走査は避ける）
    const isMulti = useNeonStore.getState().selectedCount > 1
    if (isMulti) {
      requestAnimationFrame(() => setIsDraggingSelection(true))
    }

    dragStateRef.current = {
      lastX: x,
      lastY: y,
      totalDx: 0,
      totalDy: 0,
      selectedIds: [],
      isMulti,
      initialized: false,
    }
  }

  const handleGroupDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    const leader = coreGroupRef.current
    if (!leader) return

    const { lastX, lastY, totalDx, totalDy } = dragStateRef.current
    const currentX = leader.x()
    const currentY = leader.y()

    const dx = currentX - lastX
    const dy = currentY - lastY

    dragStateRef.current.lastX = currentX
    dragStateRef.current.lastY = currentY
    dragStateRef.current.totalDx = totalDx + dx
    dragStateRef.current.totalDy = totalDy + dy

    if (!dragStateRef.current.initialized && (dx !== 0 || dy !== 0)) {
      dragStateRef.current.selectedIds = useNeonStore.getState().selectedPathIds.slice()
      dragStateRef.current.initialized = true
    }

    const ids = dragStateRef.current.selectedIds
    if (ids.length === 0) return

    // leader(core)はKonvaのdraggableで動くが、fx/uiは自分も追従させる
    const fxLeader = fxGroupRegistry.get(path.id)
    if (fxLeader) fxLeader.position({ x: fxLeader.x() + dx, y: fxLeader.y() + dy })
    const uiLeader = uiGroupRegistry.get(path.id)
    if (uiLeader) uiLeader.position({ x: uiLeader.x() + dx, y: uiLeader.y() + dy })

    for (const id of ids) {
      if (id === path.id) continue
      const core = coreGroupRegistry.get(id)
      if (core) core.position({ x: core.x() + dx, y: core.y() + dy })
      const fx = fxGroupRegistry.get(id)
      if (fx) fx.position({ x: fx.x() + dx, y: fx.y() + dy })
      const ui = uiGroupRegistry.get(id)
      if (ui) ui.position({ x: ui.x() + dx, y: ui.y() + dy })
    }

    // 重要: draggableなcoreレイヤーはKonvaが自動再描画するが、fx/uiレイヤーは自動では動かないため、
    // 追従がカクつかないよう1RAFに1回だけbatchDrawを要求する
    if (fxLeader) requestLayerDraw(fxLeader.getLayer())
    if (uiLeader) requestLayerDraw(uiLeader.getLayer())
  }

  const handleGroupDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true
    const leader = coreGroupRef.current
    if (!leader) {
      setIsDraggingSelection(false)
      return
    }

    const { totalDx, totalDy, selectedIds, isMulti } = dragStateRef.current

    if (Math.abs(totalDx) < 0.001 && Math.abs(totalDy) < 0.001) {
      leader.position({ x: 0, y: 0 })
      fxGroupRegistry.get(path.id)?.position({ x: 0, y: 0 })
      uiGroupRegistry.get(path.id)?.position({ x: 0, y: 0 })
      // Reset all selection leaders if they moved slightly (sub-pixel noise)
      if (isMulti) {
        for (const sid of selectedIds) {
          coreGroupRegistry.get(sid)?.position({ x: 0, y: 0 })
          fxGroupRegistry.get(sid)?.position({ x: 0, y: 0 })
          uiGroupRegistry.get(sid)?.position({ x: 0, y: 0 })
        }
        setIsDraggingSelection(false)
      }
      return
    }

    moveSelectedPaths(totalDx, totalDy)

    // Sync visual state immediately (Anti-flicker)
    const freshPaths = useNeonStore.getState().neonPaths
    const freshMap = new Map(freshPaths.map((p) => [p.id, p]))

    // IDs to process (Leader + Followers)
    const idsToUpdate = selectedIds.length ? selectedIds : [path.id]

    // Use requestAnimationFrame for the visual reset to ensure it aligns with React's next paint frame if possible,
    // OR do it synchronously to prevent the "jump back". 
    // Experience suggests Synchronous is key for "Anti-Flicker", but we must ensure fresh data is ready.
    // We already have fresh data from `moveSelectedPaths` (which updates store synchronously).

    for (const id of idsToUpdate) {
      // 1. Reset Position (Konva) - Move BACK to 0,0
      coreGroupRegistry.get(id)?.position({ x: 0, y: 0 })
      fxGroupRegistry.get(id)?.position({ x: 0, y: 0 })
      uiGroupRegistry.get(id)?.position({ x: 0, y: 0 })

      // 2. Update Geometry Data (Konva) - Update SHAPE to new coordinates
      const p = freshMap.get(id)
      if (p) updateVisualPath(p)
    }

    // 3. Request Draws
    for (const id of idsToUpdate) {
      const fx = fxGroupRegistry.get(id)
      const ui = uiGroupRegistry.get(id)
      if (fx) requestLayerDraw(fx.getLayer())
      if (ui) requestLayerDraw(ui.getLayer())
    }

    // 4. React Sync (triggers re-render eventually)
    // We do this LAST so the heavy React reconciliation doesn't block the visual update above
    setTimeout(() => {
      for (const id of idsToUpdate) {
        const p = freshMap.get(id)
        if (p) setPathPoints(id, p.points)
      }
    }, 0)

    dragStateRef.current = {
      lastX: 0,
      lastY: 0,
      totalDx: 0,
      totalDy: 0,
      selectedIds: [],
      isMulti: false,
      initialized: false,
    }

    if (isMulti) setIsDraggingSelection(false)
  }

  return (
    <Group
      ref={coreGroupRef}
      // selectツール以外ではcoreがイベントを拾わない（描画/ズームの邪魔をしない）
      listening={currentTool === 'select'}
      onClick={currentTool === 'select' ? handleSelect : undefined}
      onTap={currentTool === 'select' ? handleSelect : undefined}
      onMouseDown={currentTool === 'select' ? handleMouseDown : undefined}
      draggable={currentTool === 'select'}
      onDragStart={handleGroupDragStart}
      onDragMove={handleGroupDragMove}
      onDragEnd={handleGroupDragEnd}
      onMouseEnter={selected && currentTool === 'select' ? handleCursor('move') : undefined}
      onMouseLeave={currentTool === 'select' ? handleCursor('default') : undefined}
      data-path-id={path.id}
    >
      <Path
        ref={corePathRef}
        data={pathData}
        stroke="#FFFFFF"
        strokeWidth={coreWidth}
        opacity={1}
        globalCompositeOperation="source-over"
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={Math.max(24, coreWidth * 2)}
        // Allow events to bubble to the Group (which handles drag/select)
        strokeScaleEnabled
        perfectDrawEnabled={false}
        shadowBlur={NEON_RENDER_CONFIG.core.shadowBlur}
        shadowColor={NEON_RENDER_CONFIG.core.shadowColor}
        data-path-id={path.id}
      />
    </Group>
  )
}

// === UI Layer (selection outline / anchors / warnings) ===
export const NeonLineUI = ({ path }: Props) => {
  const selected = useNeonStore((s) => s.selectedIdsMap[path.id] === true)
  const showAngleWarnings = useNeonStore((s) => s.showAngleWarnings)

  // 最重要: 未選択かつ警告OFFなら即return（単一選択でも全パス分のUI計算が走るのを止める）
  if (!selected && !showAngleWarnings) return null

  return <NeonLineUIInner path={path} selected={selected} showAngleWarnings={showAngleWarnings} />
}

const NeonLineUIInner = ({
  path,
  selected,
  showAngleWarnings,
}: Props & { selected: boolean; showAngleWarnings: boolean }) => {
  const points = usePathPoints(path.id, path.points)
  const updateNeonPath = useNeonStore((s) => s.updateNeonPath)
  const stageScale = useNeonStore((s) => s.canvasTransform.scale)
  const pathData = useMemo(() => {
    if (path.isSmooth) return pointsToCatmullRomPath(points, path.smoothTension, false)
    return pointsToRoundedPath(points, path.cornerRadius)
  }, [points, path.isSmooth, path.smoothTension, path.cornerRadius])

  const uiGroupRef = useRef<Konva.Group | null>(null)
  const outlineRef = useRef<Konva.Path | null>(null)
  useEffect(() => {
    const node = uiGroupRef.current
    if (!node) return
    uiGroupRegistry.set(path.id, node)
    return () => {
      uiGroupRegistry.delete(path.id)
    }
  }, [path.id])

  useEffect(() => {
    setPathPoints(path.id, path.points)
  }, [path.id, path.points])

  useEffect(() => {
    const node = outlineRef.current
    if (!node) return
    uiOutlineRegistry.set(path.id, node)
    return () => {
      uiOutlineRegistry.delete(path.id)
    }
  }, [path.id])

  const handleCursor = (cursor: string) => (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    const container = stage?.container()
    if (container) container.style.cursor = cursor
  }

  const anchorPoints = useMemo(() => {
    // warningもanchorも不要なときは生成しない（大量パス時のコスト削減）
    if (!selected && !showAngleWarnings) return []
    const anchors: Array<{ x: number; y: number; index: number }> = []
    for (let i = 0; i < points.length; i += 2) {
      anchors.push({ x: points[i], y: points[i + 1], index: i / 2 })
    }
    return anchors
  }, [points, selected, showAngleWarnings])

  const warningAnchors = useMemo(() => {
    if (!showAngleWarnings) return []
    if (anchorPoints.length < 3) return []
    const result: Array<{ x: number; y: number; index: number }> = []

    for (let i = 0; i <= anchorPoints.length - 3; i++) {
      const A = anchorPoints[i]
      const B = anchorPoints[i + 1]
      const C = anchorPoints[i + 2]

      const abx = B.x - A.x
      const aby = B.y - A.y
      const bcx = C.x - B.x
      const bcy = C.y - B.y

      const abLen = Math.hypot(abx, aby)
      const bcLen = Math.hypot(bcx, bcy)
      if (abLen === 0 || bcLen === 0) continue

      const dot = abx * bcx + aby * bcy
      const cosTheta = Math.min(1, Math.max(-1, dot / (abLen * bcLen)))
      const angleBetweenDeg = (Math.acos(cosTheta) * 180) / Math.PI
      const interiorDeg = 180 - angleBetweenDeg

      if (interiorDeg < MIN_ANGLE_DEG) {
        result.push(B)
      }
    }

    return result
  }, [anchorPoints, showAngleWarnings])

  // 大量アンカー対策（フォールバック: 点数による単純間引き + 取得できるscaleがある場合は引きで更に抑制）
  const visibleAnchors = useMemo(() => {
    if (!selected) return []
    const n = anchorPoints.length
    if (n === 0) return []

    if (n > 200 && stageScale < 0.7) return []

    let step = 1
    if (n > 500) step = 10
    else if (n > 200) step = 5

    if (step === 1) return anchorPoints

    const result: typeof anchorPoints = []
    // keep endpoints
    const last = n - 1
    result.push(anchorPoints[0])
    for (let i = step; i < last; i += step) {
      result.push(anchorPoints[i])
    }
    result.push(anchorPoints[last])
    return result
  }, [anchorPoints, selected, stageScale])

  // Anchor drag update throttling (1 per frame)
  const anchorRafRef = useRef<number | null>(null)
  const pendingPointsRef = useRef<number[] | null>(null)
  const flushPendingPoints = () => {
    if (!pendingPointsRef.current) return
    setPathPoints(path.id, pendingPointsRef.current)
    pendingPointsRef.current = null
  }

  const handleAnchorDragMove = (index: number, e: any) => {
    e.cancelBubble = true
    const { x, y } = e.target.position()
    const next = [...points]
    next[index * 2] = x
    next[index * 2 + 1] = y
    pendingPointsRef.current = next
    if (anchorRafRef.current != null) return
    anchorRafRef.current = requestAnimationFrame(() => {
      anchorRafRef.current = null
      flushPendingPoints()
    })
  }

  const handleAnchorDragEnd = (index: number, e: any) => {
    e.cancelBubble = true
    const { x, y } = e.target.position()
    const next = [...points]
    next[index * 2] = x
    next[index * 2 + 1] = y
    // ensure the latest pending points are applied immediately
    if (anchorRafRef.current != null) {
      cancelAnimationFrame(anchorRafRef.current)
      anchorRafRef.current = null
    }
    pendingPointsRef.current = next
    flushPendingPoints()
    updateNeonPath(path.id, { points: next })
  }

  useEffect(() => {
    return () => {
      if (anchorRafRef.current != null) cancelAnimationFrame(anchorRafRef.current)
    }
  }, [])

  const WarningMarkers = ({ warns }: { warns: Array<{ x: number; y: number; index: number }> }) => {
    const warnBlink = useBlinkOpacity()
    return (
      <>
        {warns.map((warn) => (
          <Circle
            key={`warn-${path.id}-${warn.index}`}
            x={warn.x}
            y={warn.y}
            radius={8}
            fill="rgba(255, 0, 0, 0.55)"
            stroke="#FF0000"
            strokeWidth={2}
            opacity={warnBlink}
            listening={false}
            perfectDrawEnabled={false}
          />
        ))}
      </>
    )
  }

  return (
    <Group ref={uiGroupRef}>
      {selected && (
        <Path
          ref={outlineRef}
          data={pathData}
          stroke="#FFFFFF"
          strokeWidth={2}
          opacity={0.9}
          dash={[5, 5]}
          lineCap="round"
          lineJoin="round"
          strokeScaleEnabled
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {showAngleWarnings && warningAnchors.length > 0 && <WarningMarkers warns={warningAnchors} />}
      {selected &&
        visibleAnchors.map((anchor) => (
          <Circle
            key={`${path.id}-${anchor.index}`}
            x={anchor.x}
            y={anchor.y}
            radius={6}
            fill="#FFFFFF"
            stroke="#00A3FF"
            strokeWidth={2}
            hitStrokeWidth={10}
            draggable
            onMouseEnter={handleCursor('grab')}
            onMouseLeave={handleCursor('default')}
            onMouseDown={handleCursor('grabbing')}
            onMouseUp={handleCursor('grab')}
            onDragMove={(e) => handleAnchorDragMove(anchor.index, e)}
            onDragEnd={(e) => handleAnchorDragEnd(anchor.index, e)}
            perfectDrawEnabled={false}
          />
        ))}
    </Group>
  )
}

// Backward-compat default export (unused by CanvasArea currently)
const NeonLine = NeonLineCore
export default NeonLine


