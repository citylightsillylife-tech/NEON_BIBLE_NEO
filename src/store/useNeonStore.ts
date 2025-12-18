import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { temporal } from 'zundo'

import { type LayerKey, type NeonPath, type Tool } from '@/types/neon'

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

type LayerVisibility = Record<LayerKey, boolean>

const toSelectedIdsMap = (ids: string[]): Record<string, true> => {
  const map: Record<string, true> = {}
  for (const id of ids) map[id] = true
  return map
}

const isBlobUrl = (url: string) => url.startsWith('blob:')

const blobUrlToDataUrl = async (blobUrl: string): Promise<string | null> => {
  try {
    const res = await fetch(blobUrl)
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('FileReader failed'))
      reader.onload = () => resolve(String(reader.result))
      reader.readAsDataURL(blob)
    })
    return dataUrl
  } catch {
    return null
  }
}

type NeonState = {
  currentTool: Tool
  layerVisibility: LayerVisibility
  neonPaths: NeonPath[]
  activePathId: string | null
  selectedPathIds: string[]
  selectedIdsMap: Record<string, true>
  selectedCount: number
  canvasTransform: { x: number; y: number; scale: number }

  backgroundImageFile: File | null
  backgroundImageUrl: string | null
  backgroundOpacity: number
  backgroundTransform: { x: number; y: number; scale: number }
  isBackgroundLocked: boolean
  isBackgroundEditMode: boolean
  requestBackgroundAction: null | 'resetToView' | 'fitToView'

  exportTrigger: number
  exportSize: { width: number; height: number } | null
  exportMode: 'fit' | 'fill'
  exportBgMode: 'black' | 'transparent'
  canvasPreset: { w: number; h: number } | null
  isDraggingSelection: boolean
  showAngleWarnings: boolean

  setCurrentTool: (tool: Tool) => void
  setExportSize: (size: { width: number; height: number } | null) => void
  setExportMode: (mode: 'fit' | 'fill') => void
  setExportBgMode: (mode: 'black' | 'transparent') => void
  setCanvasPreset: (preset: { w: number; h: number } | null) => void
  setCanvasTransform: (t: { x: number; y: number; scale: number }) => void

  toggleLayerVisibility: (layer: LayerKey) => void
  setLayerVisibility: (next: LayerVisibility | ((prev: LayerVisibility) => LayerVisibility)) => void

  startNewPath: (point: { x: number; y: number }) => void
  appendPointToActive: (point: { x: number; y: number }) => void
  endActivePath: () => void

  setSelection: (ids: string[]) => void
  selectPath: (id: string, exclusive?: boolean) => void
  toggleSelection: (id: string) => void
  deselectAll: () => void

  deleteSelectedPaths: () => void
  moveSelectedPaths: (dx: number, dy: number) => void
  deletePath: (id: string) => void

  setBackgroundImageFile: (file: File | null) => void
  setBackgroundImageUrl: (url: string | null) => void
  setBackgroundOpacity: (opacity: number) => void
  updateBackgroundTransform: (partial: Partial<{ x: number; y: number; scale: number }>) => void
  setBackgroundLocked: (locked: boolean) => void
  setBackgroundEditMode: (enabled: boolean) => void
  setRequestBackgroundAction: (action: null | 'resetToView' | 'fitToView') => void

  triggerExport: () => void
  setShowAngleWarnings: (value: boolean) => void
  setIsDraggingSelection: (isDragging: boolean) => void

  updateLines: (ids: string[], params: Partial<Pick<NeonPath, 'color' | 'width' | 'glow' | 'cornerRadius'>>) => void
  setPathSmooth: (ids: string[], isSmooth: boolean) => void
  setPathSmoothTension: (ids: string[], tension: number) => void
  loadDocument: (payload: {
    neonPaths?: NeonPath[]
    layerVisibility?: LayerVisibility
    canvasTransform?: { x: number; y: number; scale: number }
    backgroundImageUrl?: string | null
    backgroundOpacity?: number
    backgroundTransform?: { x: number; y: number; scale: number }
    isBackgroundLocked?: boolean
    isBackgroundEditMode?: boolean
    showAngleWarnings?: boolean
  }) => void
  updateNeonPath: (
    id: string,
    partial: Partial<Pick<NeonPath, 'color' | 'width' | 'glow' | 'cornerRadius' | 'points' | 'isClosed' | 'isSmooth' | 'smoothTension'>>,
  ) => void
  splitPath: (id: string, splitIndex: number, splitPoint: { x: number; y: number }) => void
  joinSelectedPaths: () => void
}

export const useNeonStore = create<NeonState>()(
  temporal(
    persist(
      (set, get) => ({
        currentTool: 'select',
        layerVisibility: { background: true, neon: true },
        neonPaths: [],
        activePathId: null,
        selectedPathIds: [],
        selectedIdsMap: {},
        selectedCount: 0,
        canvasTransform: { x: 0, y: 0, scale: 1 },

        backgroundImageFile: null,
        backgroundImageUrl: null,
        backgroundOpacity: 0.5,
        backgroundTransform: { x: 0, y: 0, scale: 1 },
        isBackgroundLocked: false,
        isBackgroundEditMode: false,
        requestBackgroundAction: null,

        exportTrigger: 0,
        exportSize: null,
        exportMode: 'fit',
        exportBgMode: 'black',
        canvasPreset: { w: 1080, h: 1080 },
        isDraggingSelection: false,
        showAngleWarnings: true,

        setSelection: (ids) =>
          set(() => ({
            selectedPathIds: ids,
            selectedIdsMap: toSelectedIdsMap(ids),
            selectedCount: ids.length,
          })),

        setCurrentTool: (tool) =>
          set(() => ({ currentTool: tool })),
        setCanvasTransform: (t) => set(() => ({ canvasTransform: t })),

        toggleLayerVisibility: (layer) =>
          set((state) => ({
            layerVisibility: { ...state.layerVisibility, [layer]: !state.layerVisibility[layer] },
          })),
        setLayerVisibility: (next) =>
          set((state) => ({
            layerVisibility: typeof next === 'function' ? next(state.layerVisibility) : next,
          })),

        startNewPath: (point) =>
          set((state) => {
            const id = createId()
            const path: NeonPath = {
              id,
              points: [point.x, point.y],
              color: '#E01FFF',
              width: 4,
              glow: 10,
              cornerRadius: 0,
              isSmooth: false,
              smoothTension: 0.5,
            }
            return { neonPaths: [...state.neonPaths, path], activePathId: id }
          }),
        appendPointToActive: (point) =>
          set((state) => {
            if (!state.activePathId) return state
            const neonPaths = state.neonPaths.map((p) =>
              p.id === state.activePathId ? { ...p, points: [...p.points, point.x, point.y] } : p,
            )
            return { neonPaths }
          }),
        endActivePath: () => set((state) => (state.activePathId ? { activePathId: null } : state)),

        selectPath: (id, exclusive = false) => {
          const s = get()
          if (exclusive) {
            if (s.selectedCount === 1 && s.selectedIdsMap[id] === true) return
            s.setSelection([id])
            return
          }
          if (s.selectedIdsMap[id] === true) return
          s.setSelection([...s.selectedPathIds, id])
        },
        toggleSelection: (id) => {
          const s = get()
          const exists = s.selectedIdsMap[id] === true
          const next = exists ? s.selectedPathIds.filter((x) => x !== id) : [...s.selectedPathIds, id]
          s.setSelection(next)
        },
        deselectAll: () => {
          const s = get()
          if (s.selectedCount === 0) return
          s.setSelection([])
        },

        deleteSelectedPaths: () => {
          const s = get()
          if (s.selectedCount === 0) return
          const selected = new Set(s.selectedPathIds)
          const nextPaths = s.neonPaths.filter((p) => !selected.has(p.id))
          const shouldClearActive = s.activePathId ? selected.has(s.activePathId) : false
          set(() => ({ neonPaths: nextPaths, activePathId: shouldClearActive ? null : s.activePathId }))
          s.setSelection([])
        },
        moveSelectedPaths: (dx, dy) =>
          set((state) => {
            if (state.selectedCount === 0) return state
            const selected = new Set(state.selectedPathIds)
            const neonPaths = state.neonPaths.map((p) => {
              if (!selected.has(p.id)) return p
              const nextPoints = p.points.map((v, idx) => (idx % 2 === 0 ? v + dx : v + dy))
              return { ...p, points: nextPoints }
            })
            return { neonPaths }
          }),
        deletePath: (id) => {
          const s = get()
          const nextPaths = s.neonPaths.filter((p) => p.id !== id)
          if (nextPaths.length === s.neonPaths.length) return
          const shouldClearSelection = s.selectedIdsMap[id] === true
          const shouldClearActive = s.activePathId === id
          const nextSelectedIds = shouldClearSelection ? s.selectedPathIds.filter((x) => x !== id) : s.selectedPathIds
          set(() => ({ neonPaths: nextPaths, activePathId: shouldClearActive ? null : s.activePathId }))
          if (shouldClearSelection) s.setSelection(nextSelectedIds)
        },

        setBackgroundImageFile: (file) => set(() => ({ backgroundImageFile: file })),
        setBackgroundImageUrl: (url) =>
          set((state) => {
            const prev = state.backgroundImageUrl
            if (prev && prev !== url && isBlobUrl(prev)) URL.revokeObjectURL(prev)
            const nextState = { backgroundImageUrl: url }
            if (url && isBlobUrl(url)) {
              const requested = url
              blobUrlToDataUrl(requested).then((dataUrl) => {
                if (!dataUrl) return
                const current = get().backgroundImageUrl
                if (current !== requested) return
                set(() => ({ backgroundImageUrl: dataUrl }))
              })
            }
            return nextState
          }),
        setBackgroundOpacity: (opacity) =>
          set(() => ({ backgroundOpacity: Math.min(1, Math.max(0.1, opacity)) })),
        updateBackgroundTransform: (partial) =>
          set((state) => {
            // ロック中は一切更新しない（保険）
            if (state.isBackgroundLocked) return state
            const prev = state.backgroundTransform
            const next = {
              x: partial.x ?? prev.x,
              y: partial.y ?? prev.y,
              scale: partial.scale ?? prev.scale,
            }
            next.scale = Math.min(3, Math.max(0.1, next.scale))
            if (next.x === prev.x && next.y === prev.y && next.scale === prev.scale) return state
            return { backgroundTransform: next }
          }),
        setBackgroundLocked: (locked) =>
          set((state) => ({
            isBackgroundLocked: locked,
            isBackgroundEditMode: locked ? false : state.isBackgroundEditMode,
          })),
        setBackgroundEditMode: (enabled) =>
          set((state) => {
            // ロック中は ON にできない（false は許可）
            if (state.isBackgroundLocked && enabled) return state
            return { isBackgroundEditMode: enabled }
          }),
        setRequestBackgroundAction: (action) =>
          set((state) => {
            // ロック中は実行トリガーを立てない（nullクリアは許可）
            if (action !== null && state.isBackgroundLocked) return state
            if (state.requestBackgroundAction === action) return state
            return { requestBackgroundAction: action }
          }),

        triggerExport: () => set((state) => ({ exportTrigger: state.exportTrigger + 1 })),
        setExportSize: (size) => set(() => ({ exportSize: size })),
        setExportMode: (mode) => set(() => ({ exportMode: mode })),
        setExportBgMode: (mode) => set(() => ({ exportBgMode: mode })),
        setCanvasPreset: (preset) => set(() => ({ canvasPreset: preset })),
        setShowAngleWarnings: (value) => set(() => ({ showAngleWarnings: value })),
        setIsDraggingSelection: (isDragging) => set(() => ({ isDraggingSelection: isDragging })),

        updateLines: (ids, params) =>
          set((state) => {
            if (ids.length === 0) return state
            const idSet = new Set(ids)
            let changed = false
            const neonPaths = state.neonPaths.map((path) => {
              if (!idSet.has(path.id)) return path
              let next = path
              if (params.color !== undefined && params.color !== path.color) next = { ...next, color: params.color }
              if (params.width !== undefined && params.width !== path.width) next = { ...next, width: params.width }
              if (params.glow !== undefined && params.glow !== path.glow) next = { ...next, glow: params.glow }
              if (params.cornerRadius !== undefined && params.cornerRadius !== path.cornerRadius) {
                next = { ...next, cornerRadius: params.cornerRadius }
              }
              if (next !== path) changed = true
              return next
            })
            if (!changed) return state
            return { neonPaths }
          }),
        setPathSmooth: (ids, isSmooth) =>
          set((state) => {
            if (ids.length === 0) return state
            const idSet = new Set(ids)
            let changed = false
            const neonPaths = state.neonPaths.map((p) => {
              if (!idSet.has(p.id)) return p
              if (p.isSmooth === isSmooth) return p
              changed = true
              return { ...p, isSmooth }
            })
            if (!changed) return state
            return { neonPaths }
          }),
        setPathSmoothTension: (ids, tension) =>
          set((state) => {
            if (ids.length === 0) return state
            const t = Math.min(1, Math.max(0, tension))
            const idSet = new Set(ids)
            let changed = false
            const neonPaths = state.neonPaths.map((p) => {
              if (!idSet.has(p.id)) return p
              if (p.smoothTension === t) return p
              changed = true
              return { ...p, smoothTension: t }
            })
            if (!changed) return state
            return { neonPaths }
          }),
        loadDocument: (payload) =>
          set((state) => {
            // MVP: 最低限の整形/クランプのみ。Undo/Redoは呼び出し側でクリアする想定。
            const nextLayerVisibility = payload.layerVisibility ?? state.layerVisibility
            const nextCanvasTransform = payload.canvasTransform ?? state.canvasTransform
            const nextBackgroundOpacity =
              payload.backgroundOpacity !== undefined
                ? Math.min(1, Math.max(0.1, payload.backgroundOpacity))
                : state.backgroundOpacity
            const prevBgUrl = state.backgroundImageUrl
            const nextBgUrl = payload.backgroundImageUrl ?? state.backgroundImageUrl
            if (prevBgUrl && prevBgUrl !== nextBgUrl && isBlobUrl(prevBgUrl)) URL.revokeObjectURL(prevBgUrl)

            const nextBackgroundTransform = payload.backgroundTransform ?? state.backgroundTransform
            const nextBgScale = Math.min(3, Math.max(0.1, nextBackgroundTransform.scale))
            const bgTransform = { ...nextBackgroundTransform, scale: nextBgScale }

            return {
              // data
              neonPaths: payload.neonPaths ?? state.neonPaths,
              layerVisibility: nextLayerVisibility,
              canvasTransform: nextCanvasTransform,
              backgroundImageUrl: nextBgUrl,
              backgroundOpacity: nextBackgroundOpacity,
              backgroundTransform: bgTransform,
              isBackgroundLocked: payload.isBackgroundLocked ?? state.isBackgroundLocked,
              isBackgroundEditMode: payload.isBackgroundEditMode ?? state.isBackgroundEditMode,
              showAngleWarnings: payload.showAngleWarnings ?? state.showAngleWarnings,

              // session state reset (MVP)
              activePathId: null,
              selectedPathIds: [],
              selectedIdsMap: {},
              selectedCount: 0,
              isDraggingSelection: false,
              exportTrigger: 0,
              backgroundImageFile: null,
            }
          }),
        updateNeonPath: (id, partial) =>
          set((state) => {
            const exists = state.neonPaths.some((p) => p.id === id)
            if (!exists) return state
            const neonPaths = state.neonPaths.map((p) => (p.id === id ? { ...p, ...partial } : p))
            return { neonPaths }
          }),
        splitPath: (id, splitIndex, splitPoint) =>
          set((state) => {
            const target = state.neonPaths.find((p) => p.id === id)
            if (!target || target.points.length < 4) return state
            const pts = target.points

            // Path 1: 0 to splitIndex (inclusive of sx,sy) -> splitPoint
            const p1Points = [...pts.slice(0, splitIndex + 2), splitPoint.x, splitPoint.y]

            // Path 2: splitPoint -> splitIndex+2 to end
            const p2Points = [splitPoint.x, splitPoint.y, ...pts.slice(splitIndex + 2)]

            const p1: NeonPath = { ...target, id: crypto.randomUUID(), points: p1Points }
            // Ensure unique ID for second path too
            const id2 = crypto.randomUUID()
            const p2: NeonPath = { ...target, id: id2, points: p2Points }

            const nextPaths = state.neonPaths.flatMap((p) => (p.id === id ? [p1, p2] : [p]))

            return {
              neonPaths: nextPaths,
              // Critical Stability Fix:
              // Explicitly clear selection/active state to prevent the UI from trying to render/drag
              // non-existent (old) paths or getting confused by new ones.
              // The user will need to re-select the new segments, which is safer.
              selectedPathIds: [],
              selectedIdsMap: {},
              activePathId: null,
              selectedCount: 0,
            }
          }),
        joinSelectedPaths: () =>
          set((state) => {
            // MVP: Strictly support joining exactly 2 paths to ensure predictable behavior
            if (state.selectedCount !== 2) return state
            const [id1, id2] = state.selectedPathIds
            const p1 = state.neonPaths.find((p) => p.id === id1)
            const p2 = state.neonPaths.find((p) => p.id === id2)
            if (!p1 || !p2) return state

            // Calculate distances between all 4 endpoint combinations
            // P1: Start(S1), End(E1)
            // P2: Start(S2), End(E2)
            const getDist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1)

            const p1Start = { x: p1.points[0], y: p1.points[1] }
            const p1End = { x: p1.points[p1.points.length - 2], y: p1.points[p1.points.length - 1] }
            const p2Start = { x: p2.points[0], y: p2.points[1] }
            const p2End = { x: p2.points[p2.points.length - 2], y: p2.points[p2.points.length - 1] }

            const combos = [
              { type: 'E1-S2', d: getDist(p1End.x, p1End.y, p2Start.x, p2Start.y) },
              { type: 'E1-E2', d: getDist(p1End.x, p1End.y, p2End.x, p2End.y) },
              { type: 'S1-S2', d: getDist(p1Start.x, p1Start.y, p2Start.x, p2Start.y) },
              { type: 'S1-E2', d: getDist(p1Start.x, p1Start.y, p2End.x, p2End.y) },
            ]

            // Find closest connection
            const winner = combos.sort((a, b) => a.d - b.d)[0]

            let newPoints: number[] = []

            // Logic to merge points based on winner
            if (winner.type === 'E1-S2') {
              // P1 -> P2
              newPoints = [...p1.points, ...p2.points]
            } else if (winner.type === 'E1-E2') {
              // P1 -> Reverse(P2)
              const p2Rev = []
              for (let i = 0; i < p2.points.length; i += 2) {
                p2Rev.unshift(p2.points[i + 1])
                p2Rev.unshift(p2.points[i])
              }
              newPoints = [...p1.points, ...p2Rev]
            } else if (winner.type === 'S1-S2') {
              // Reverse(P1) -> P2
              const p1Rev = []
              for (let i = 0; i < p1.points.length; i += 2) {
                p1Rev.unshift(p1.points[i + 1])
                p1Rev.unshift(p1.points[i])
              }
              newPoints = [...p1Rev, ...p2.points]
            } else if (winner.type === 'S1-E2') {
              // P2 -> P1 (Since S1 is close to E2, it's naturally P2 then P1)
              newPoints = [...p2.points, ...p1.points]
            }

            // Create new merged path (using P1 properties)
            const newId = createId()
            const newPath: NeonPath = {
              ...p1,
              id: newId,
              points: newPoints,
              // If either was closed, the new one is likely open unless logic dictates otherwise.
              // For a simple glue, open is safer.
              isClosed: false
            }

            // Remove old paths, add new one
            const nextPaths = state.neonPaths.filter((p) => p.id !== id1 && p.id !== id2)
            nextPaths.push(newPath)

            return {
              neonPaths: nextPaths,
              // Select the new path
              selectedPathIds: [newId],
              selectedIdsMap: { [newId]: true },
              selectedCount: 1,
              activePathId: null
            }
          }),
      }),
      {
        name: 'neon-sim-store',
        version: 2,
        partialize: (state) => ({
          neonPaths: state.neonPaths,
          layerVisibility: state.layerVisibility,
          canvasTransform: state.canvasTransform,

          backgroundImageUrl: state.backgroundImageUrl,
          backgroundOpacity: state.backgroundOpacity,
          backgroundTransform: state.backgroundTransform,
          isBackgroundLocked: state.isBackgroundLocked,
          isBackgroundEditMode: state.isBackgroundEditMode,

          showAngleWarnings: state.showAngleWarnings,
        }),
      },
    ),
    {
      limit: 100,
      partialize: (state) => ({
        neonPaths: state.neonPaths,
        selectedPathIds: state.selectedPathIds,
        selectedIdsMap: state.selectedIdsMap,
        selectedCount: state.selectedCount,
        backgroundTransform: state.backgroundTransform,
      }),
    },
  ),
)

