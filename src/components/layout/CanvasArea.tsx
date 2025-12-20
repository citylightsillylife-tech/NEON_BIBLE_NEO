import { useEffect, useMemo, useRef } from 'react'
import { Group, Image, Layer, Rect, Stage, Line } from 'react-konva'
import Konva from 'konva'

import { getCoreLineNode, NeonLineCore, NeonLineFx, NeonLineUI } from '@/components/canvas/NeonLine'
import { useNeonStore } from '@/store/useNeonStore'
import { downloadStageAsPng } from '@/utils/exportUtils'

import { useCanvasResize } from '@/hooks/useCanvasResize'
import { useBackgroundLayer } from '@/hooks/useBackgroundLayer'
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction'

// Header access
let exportedStage: Konva.Stage | null = null
export const getCanvasStage = () => exportedStage

const CanvasArea = () => {
  const stageRef = useRef<Konva.Stage | null>(null)
  const fxLayerRef = useRef<Konva.Layer | null>(null)
  const uiLayerRef = useRef<Konva.Layer | null>(null)
  const bboxLayerRef = useRef<Konva.Layer | null>(null)
  const bboxRectRef = useRef<Konva.Rect | null>(null)
  const boxLayerRef = useRef<Konva.Layer | null>(null)
  const boxRectRef = useRef<Konva.Rect | null>(null)

  // Hooks
  const { containerRef, size } = useCanvasResize()
  const {
    bgImage,
    backgroundOpacity,
    backgroundTransform,
    isBackgroundLocked,
    isBackgroundEditMode,
    handleImageLoad
  } = useBackgroundLayer(size, stageRef)

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    isPanning,
    boxState,
    previewPoint
  } = useCanvasInteraction(stageRef)

  // Store Selectors
  const currentTool = useNeonStore((s) => s.currentTool)
  const neonPaths = useNeonStore((s) => s.neonPaths)
  const layerVisibility = useNeonStore((s) => s.layerVisibility)
  const activePathId = useNeonStore((s) => s.activePathId)
  const exportTrigger = useNeonStore((s) => s.exportTrigger)
  const canvasPreset = useNeonStore((s) => s.canvasPreset)

  const deselectAll = useNeonStore((s) => s.deselectAll)
  const deleteSelectedPaths = useNeonStore((s) => s.deleteSelectedPaths)
  const endActivePath = useNeonStore((s) => s.endActivePath)

  // --- Effects & Logic ---

  // Export stage ref
  useEffect(() => {
    if (stageRef.current) exportedStage = stageRef.current
  }, [])

  // Sync Canvas Transform
  useEffect(() => {
    const apply = (t: { x: number; y: number; scale: number }) => {
      const stage = stageRef.current
      if (!stage) return
      stage.position({ x: t.x, y: t.y })
      stage.scale({ x: t.scale, y: t.scale })
      stage.batchDraw()
    }
    apply(useNeonStore.getState().canvasTransform)
    const unsubscribe = useNeonStore.subscribe((state, prev) => {
      if (state.canvasTransform === prev.canvasTransform) return
      apply(state.canvasTransform)
    })
    return unsubscribe
  }, [])

  // Zoom Sync & Wheel
  const zoomSyncTimerRef = useRef<number | null>(null)
  const syncStageTransformToStoreDebounced = () => {
    if (zoomSyncTimerRef.current) window.clearTimeout(zoomSyncTimerRef.current)
    zoomSyncTimerRef.current = window.setTimeout(() => {
      const stage = stageRef.current
      if (!stage) return
      const scale = stage.scaleX()
      const pos = stage.position()
      useNeonStore.getState().setCanvasTransform({ x: pos.x, y: pos.y, scale })
    }, 150)
  }

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const oldScale = stage.scaleX() || 1
    const scaleBy = 1.05
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const nextScaleRaw = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
    const nextScale = Math.min(5, Math.max(0.1, nextScaleRaw))

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const newPos = {
      x: pointer.x - mousePointTo.x * nextScale,
      y: pointer.y - mousePointTo.y * nextScale,
    }

    stage.scale({ x: nextScale, y: nextScale })
    stage.position(newPos)
    stage.batchDraw()
    syncStageTransformToStoreDebounced()
  }

  // --- Selection UI Logic ---
  useEffect(() => {
    const highlighted = new Set<string>()
    const setHighlight = (id: string, on: boolean) => {
      const node = getCoreLineNode(id)
      if (!node) return
      node.stroke(on ? '#00FFFF' : '#FFFFFF')
    }

    const computeMultiBBox = (state: ReturnType<typeof useNeonStore.getState>) => {
      if (state.selectedCount < 2) return null
      const selectedIds = state.selectedPathIds
      if (selectedIds.length < 2) return null

      const pathMap = new Map(state.neonPaths.map((p) => [p.id, p] as const))
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      let any = false

      for (const id of selectedIds) {
        const p = pathMap.get(id)
        if (!p || p.points.length < 2) continue
        const pts = p.points
        for (let i = 0; i < pts.length; i += 2) {
          const x = pts[i]
          const y = pts[i + 1]
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
          any = true
        }
      }

      if (!any) return null
      const padding = 12
      return { x: minX - padding, y: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 }
    }

    const apply = (state: ReturnType<typeof useNeonStore.getState>, prev?: ReturnType<typeof useNeonStore.getState>) => {
      const richVisible = !state.isDraggingSelection
      fxLayerRef.current?.visible(richVisible)
      fxLayerRef.current?.listening(richVisible)

      const multi = state.selectedCount >= 2
      bboxLayerRef.current?.visible(multi)

      if (!multi) {
        if (highlighted.size > 0) {
          for (const id of highlighted) setHighlight(id, false)
          highlighted.clear()
        }
      } else {
        const next = new Set(state.selectedPathIds)
        for (const id of highlighted) {
          if (!next.has(id)) {
            setHighlight(id, false)
            highlighted.delete(id)
          }
        }
        for (const id of next) {
          if (!highlighted.has(id)) {
            setHighlight(id, true)
            highlighted.add(id)
          }
        }
      }

      const shouldRecalcBbox =
        multi &&
        !state.isDraggingSelection &&
        (!prev || prev.selectedCount !== state.selectedCount || prev.selectedPathIds !== state.selectedPathIds || prev.neonPaths !== state.neonPaths)

      if (shouldRecalcBbox) {
        const bbox = computeMultiBBox(state)
        const rect = bboxRectRef.current
        if (rect && bbox) {
          rect.position({ x: bbox.x, y: bbox.y })
          rect.size({ width: bbox.width, height: bbox.height })
          rect.visible(true)
        } else if (rect) {
          rect.visible(false)
        }
      } else if (!multi) {
        bboxRectRef.current?.visible(false)
      }

      fxLayerRef.current?.batchDraw()
      uiLayerRef.current?.batchDraw()
      bboxLayerRef.current?.batchDraw()
      stageRef.current?.batchDraw()
    }

    apply(useNeonStore.getState())

    const unsubscribe = useNeonStore.subscribe((state, prev) => {
      if (state.isDraggingSelection === prev.isDraggingSelection && state.selectedCount === prev.selectedCount && state.selectedPathIds === prev.selectedPathIds && state.neonPaths === prev.neonPaths) {
        return
      }
      requestAnimationFrame(() => apply(state, prev))
    })

    return unsubscribe
  }, [])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Finish Line: Enter or F
      if (event.key === 'Enter' || event.key.toUpperCase() === 'F') {
        endActivePath()
        return
      }

      if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) return
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        deleteSelectedPaths()
      }
      if (event.key === 'Escape') {
        deselectAll()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedPaths, endActivePath, deselectAll])

  const onPointerMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    handlePointerMove(e)

    // Visual update for box selection
    if (currentTool === 'select' && boxState.selecting && boxState.startWorld) {
      const stage = stageRef.current
      const endWorld = stage?.getRelativePointerPosition()
      if (stage && endWorld) {
        const x = Math.min(boxState.startWorld.x, endWorld.x)
        const y = Math.min(boxState.startWorld.y, endWorld.y)
        const w = Math.abs(endWorld.x - boxState.startWorld.x)
        const h = Math.abs(endWorld.y - boxState.startWorld.y)
        boxRectRef.current?.position({ x, y })
        boxRectRef.current?.size({ width: w, height: h })
        boxRectRef.current?.visible(true)
        boxLayerRef.current?.batchDraw()
      }
    }
  }


  // Export Logic
  useEffect(() => {
    if (!exportTrigger || !stageRef.current) return
    const store = useNeonStore.getState()
    const prevLayerVisibility = store.layerVisibility
    const prevSelectedPathIds = store.selectedPathIds
    const exportBgMode = store.exportBgMode

    // 1. Hide Selection & Interface
    store.deselectAll()
    // Always HIDE border for export
    if (bboxRectRef.current) bboxRectRef.current.visible(false)
    const borderNode = stageRef.current.findOne('#artboard-border')
    if (borderNode) {
      borderNode.visible(false)
    }

    // 2. Handle Background Image Visibility
    // User wants Background Line/Image hidden for "Black" mode too, to prevent ghosting.
    // So we HIDE the background layer for BOTH 'transparent' and 'black' modes.
    // (If we ever want an 'Export with Reference' option, we'd need a 3rd mode)
    store.setLayerVisibility((prev) => ({ ...prev, background: false }))

    requestAnimationFrame(() => {
      const stage = stageRef.current
      if (!stage) return
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const exportSize = store.exportSize
      const exportMode = store.exportMode
      const canvasPreset = store.canvasPreset
      const canvasTransform = store.canvasTransform

      const options = {
        // Use pure black if requested, or dark theme color? User said "Black" (Kuro).
        // Let's use pure black #000000 to be safe/professional for print/export.
        backgroundColor: exportBgMode === 'black' ? '#000000' : undefined,
        artboard: canvasPreset ? { w: canvasPreset.w, h: canvasPreset.h } : undefined,
        canvasTransform,
        targetWidth: exportSize?.width,
        targetHeight: exportSize?.height,
        mode: exportMode
      }

      downloadStageAsPng(stage, `neon-design-${timestamp}.png`, options)

      // Restore State
      store.setLayerVisibility((prev) => ({ ...prev, background: prevLayerVisibility.background }))
      store.setSelection(prevSelectedPathIds)

      // Restore border visibility
      const borderNode = stageRef.current?.findOne('#artboard-border')
      if (borderNode) {
        borderNode.visible(true)
      }
    })
  }, [exportTrigger])

  const artboard = useMemo(() => {
    const pad = 48
    const fallbackW = Math.max(size.width - pad, 120)
    const fallbackH = Math.max(size.height - pad, 120)
    const w = canvasPreset?.w ?? fallbackW
    const h = canvasPreset?.h ?? fallbackH
    return { x: 0, y: 0, w, h }
  }, [size.width, size.height, canvasPreset])

  const isBackgroundInteractive = isBackgroundEditMode && !isBackgroundLocked && !isPanning

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none select-none bg-[#1c1c28] overflow-hidden"
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        draggable={isPanning}
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (isBackgroundInteractive) return
          handlePointerDown(e)
        }}
        onMouseMove={(e) => {
          if (isBackgroundInteractive) return
          onPointerMove(e)
        }}
        onMouseUp={(e) => {
          // Always clean up selection box logic
          handlePointerUp(e)
          if (boxRectRef.current && boxRectRef.current.visible()) {
            boxRectRef.current.visible(false)
            boxLayerRef.current?.batchDraw()
          }
        }}
        onDblClick={() => {
          if (isBackgroundInteractive) return
          handleDoubleClick()
        }}
        onTouchStart={(e) => {
          if (isBackgroundInteractive) return
          handlePointerDown(e)
        }}
        onTouchMove={(e) => {
          if (isBackgroundInteractive) return
          onPointerMove(e)
        }}
        onTouchEnd={(e) => {
          handlePointerUp(e)
          if (boxRectRef.current && boxRectRef.current.visible()) {
            boxRectRef.current.visible(false)
            boxLayerRef.current?.batchDraw()
          }
        }}
      >
        <Layer>
          {/* Background Layer */}
          {bgImage && layerVisibility.background && (
            <Group
              x={backgroundTransform.x}
              y={backgroundTransform.y}
              scaleX={backgroundTransform.scale}
              scaleY={backgroundTransform.scale}
              listening={isBackgroundEditMode}
              draggable={isBackgroundInteractive}
              onMouseDown={(e) => {
                if (isBackgroundInteractive) {
                  e.cancelBubble = true
                }
              }}
              onDragStart={(e) => {
                if (isBackgroundInteractive) {
                  const stage = e.target.getStage()
                  if (stage) stage.container().style.cursor = 'move'
                }
              }}
              onDragEnd={(e) => {
                if (isBackgroundInteractive) {
                  const stage = e.target.getStage()
                  if (stage) stage.container().style.cursor = 'default'
                  const { x, y } = e.target.position()
                  useNeonStore.getState().updateBackgroundTransform({ x, y })
                }
              }}
            >
              <Image
                image={bgImage}
                opacity={backgroundOpacity}
                onLoad={(e: any) => handleImageLoad(e.target)}
              />
            </Group>
          )}

          {/* Artboard Border */}
          <Rect
            id="artboard-border"
            x={artboard.x}
            y={artboard.y}
            width={artboard.w}
            height={artboard.h}
            stroke="#666"
            strokeWidth={2}
            listening={false}
            dash={[10, 10]}
          />
        </Layer>

        {/* Neon Content */}
        <Layer ref={fxLayerRef}>
          {neonPaths.map((path) => <NeonLineFx key={`fx-${path.id}`} path={path} />)}
        </Layer>

        <Layer>
          {neonPaths.map((path) => <NeonLineCore key={`core-${path.id}`} path={path} />)}
        </Layer>

        <Layer ref={uiLayerRef}>
          {neonPaths.map((path) => <NeonLineUI key={`ui-${path.id}`} path={path} />)}
          {/* Helper Line (Imperative for performance) */}
          <Line
            points={(() => {
              if (!previewPoint || !activePathId) return []
              const active = neonPaths.find(p => p.id === activePathId)
              if (!active || active.points.length < 2) return []
              const len = active.points.length
              return [active.points[len - 2], active.points[len - 1], previewPoint.x, previewPoint.y]
            })()}
            stroke="white"
            strokeWidth={1}
            dash={[4, 4]}
            opacity={0.8}
            listening={false}
            visible={!!previewPoint}
          />
        </Layer>

        {/* Selection Box */}
        <Layer ref={boxLayerRef}>
          <Rect
            ref={boxRectRef}
            stroke="#00A3FF"
            strokeWidth={1}
            fill="rgba(0, 163, 255, 0.1)"
            visible={false}
            listening={false}
          />
        </Layer>

        {/* Helper BBox for multi-selection */}
        <Layer ref={bboxLayerRef}>
          <Rect
            ref={bboxRectRef}
            stroke="#00FFFF"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
            visible={false}
          />
        </Layer>

      </Stage>
    </div>
  )
}

export default CanvasArea