import { useRef, useState, useEffect } from 'react'
import Konva from 'konva'
import { useNeonStore } from '@/store/useNeonStore'
import { normalizeRect, polylineIntersectsRectInclusive, rectsIntersectInclusive, bboxFromPoints, getClosestPointOnPolyline } from '@/utils/geometry'

// Helper to get normalized pointer position
const getPointerPos = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    const scale = stage.scaleX() || 1
    const pos = stage.position()
    return {
        x: (pointer.x - pos.x) / scale,
        y: (pointer.y - pos.y) / scale,
    }
}

export const useCanvasInteraction = (stageRef: React.RefObject<Konva.Stage | null>) => {
    const currentTool = useNeonStore((s) => s.currentTool)
    const startNewPath = useNeonStore((s) => s.startNewPath)
    const appendPointToActive = useNeonStore((s) => s.appendPointToActive)
    const endActivePath = useNeonStore((s) => s.endActivePath)
    const updateNeonPath = useNeonStore((s) => s.updateNeonPath)
    const deletePath = useNeonStore((s) => s.deletePath)

    // Store accessors for selection logic
    const setSelection = useNeonStore.getState().setSelection

    const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number } | null>(null)

    // We'll use standard useState but might need refs for values inside closures if not careful.
    const interactionState = useRef<{
        startPos: { x: number; y: number } | null
        isDragging: boolean
        activeId: string | null
    }>({ startPos: null, isDragging: false, activeId: null })

    // Box Selection Refs
    const boxStateRef = useRef<{
        selecting: boolean
        startWorld: { x: number; y: number } | null
        startScreen: { x: number; y: number } | null
        shift: boolean
    }>({ selecting: false, startWorld: null, startScreen: null, shift: false })

    const middlePanRef = useRef(false)
    const [isSpaceDown, setIsSpaceDown] = useState(false)

    // Eraser temporary set (to avoid double deleting in one drag)
    const erasedIdsRef = useRef<Set<string>>(new Set())

    // Space key management
    useEffect(() => {
        const isTyping = () => {
            const el = document.activeElement as HTMLElement | null
            if (!el) return false
            const tag = el.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
            if (el.closest?.('[contenteditable="true"]')) return true
            return false
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (isTyping()) return
            if (e.code === 'Space') setIsSpaceDown(true)
            if (e.key === 'Enter') {
                const active = useNeonStore.getState().activePathId
                if (active) {
                    endActivePath()
                    setPreviewPoint(null)
                }
            }
        }
        const onKeyUp = (e: KeyboardEvent) => {
            if (isTyping()) return
            if (e.code === 'Space') setIsSpaceDown(false)
        }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
        }
    }, [])

    const isPanning = currentTool === 'hand' || isSpaceDown

    const applyBoxSelection = (rectWorld: { x: number; y: number; width: number; height: number }, shift: boolean) => {
        const store = useNeonStore.getState()
        const hits: string[] = []

        for (const p of store.neonPaths) {
            const bbox = bboxFromPoints(p.points)
            if (!bbox) continue
            if (!rectsIntersectInclusive(bbox, rectWorld)) continue
            if (polylineIntersectsRectInclusive(p.points, rectWorld)) hits.push(p.id)
        }

        if (!shift) {
            setSelection(hits)
            return
        }

        const baseIds = store.selectedPathIds
        const baseMap = store.selectedIdsMap
        const hitMap: Record<string, true> = {}
        for (const id of hits) hitMap[id] = true

        const next: string[] = []
        for (const id of baseIds) {
            if (hitMap[id] === true) continue
            next.push(id)
        }
        for (const id of hits) {
            if (baseMap[id] === true) continue
            next.push(id)
        }
        setSelection(next)
    }

    const checkEraserHit = (pos: { x: number; y: number }) => {
        // Simple bounding box check first, then distance check?
        // For now, distance check to any segment
        const threshold = 10 / (stageRef.current?.scaleX() || 1)

        // Access latest paths directly from store state to avoid staleness
        const paths = useNeonStore.getState().neonPaths

        for (const path of paths) {
            if (erasedIdsRef.current.has(path.id)) continue

            let hit = false
            for (let i = 0; i < path.points.length - 1; i += 2) {
                const px = path.points[i]
                const py = path.points[i + 1]
                if (Math.hypot(px - pos.x, py - pos.y) < threshold) {
                    hit = true
                    break
                }
                // Check lines between points (Midpoints check for MVP)
                if (i + 3 < path.points.length) {
                    const midX = (px + path.points[i + 2]) / 2
                    const midY = (py + path.points[i + 3]) / 2
                    if (Math.hypot(midX - pos.x, midY - pos.y) < threshold) {
                        hit = true
                        break
                    }
                }
            }

            if (hit) {
                deletePath(path.id)
                erasedIdsRef.current.add(path.id)
            }
        }
    }

    const handlePointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (isPanning) {
            return
        }

        const stage = stageRef.current
        if (!stage) return
        const pos = getPointerPos(stage)
        if (!pos) return

        if (currentTool === 'pen') {
            if ((e.evt as MouseEvent).button !== 0) return // Left click only
            interactionState.current.isDragging = true

            const activeId = useNeonStore.getState().activePathId
            if (activeId) {
                appendPointToActive({ x: pos.x, y: pos.y })
            } else {
                startNewPath({ x: pos.x, y: pos.y })
            }
            setPreviewPoint({ x: pos.x, y: pos.y })
            return
        }

        if (currentTool === 'rectangle' || currentTool === 'circle') {
            if ((e.evt as MouseEvent).button !== 0) return
            interactionState.current.isDragging = true
            interactionState.current.startPos = pos
            // Create a new path that will be updated
            startNewPath({ x: pos.x, y: pos.y })
            return
        }

        if (currentTool === 'eraser') {
            interactionState.current.isDragging = true
            erasedIdsRef.current.clear()
            checkEraserHit(pos)
            return
        }

        if (currentTool === 'cut') {
            const paths = useNeonStore.getState().neonPaths
            for (const path of paths) {
                // Find closest point on this path
                const result = getClosestPointOnPolyline(pos, path.points)
                if (result) {
                    // Threshold check (e.g. 15px)
                    // We need to account for visual width if possible, but 15 screen pixels is decent usability
                    const threshold = 15 / (stage.scaleX() || 1)
                    if (result.distance <= threshold) {
                        useNeonStore.getState().splitPath(path.id, result.index, result.point)
                        return
                    }
                }
            }
            return
        }

        // Select Tool Logic (Box Select Start)
        if (currentTool === 'select') {
            // Logic from original CanvasArea
            const btn = (e.evt as MouseEvent | undefined)?.button
            if (btn === 1) { // Middle click pan
                middlePanRef.current = true
                stage.draggable(true)
                stage.startDrag()
                return
            }

            const target = e.target
            const stageFromTarget = target.getStage()
            const clickedStage = target === stageFromTarget

            if (!clickedStage) return // Clicked on object, handled by object listeners

            const screenPos = stage.getPointerPosition()
            if (!screenPos) return

            boxStateRef.current.selecting = true
            boxStateRef.current.startWorld = pos
            boxStateRef.current.startScreen = screenPos
            boxStateRef.current.shift = Boolean((e.evt as MouseEvent | undefined)?.shiftKey)
        }
    }

    const handlePointerMove = (_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        const stage = stageRef.current
        if (!stage) return
        const pos = getPointerPos(stage)

        const activeId = useNeonStore.getState().activePathId
        const isPenActive = currentTool === 'pen' && activeId

        if (!interactionState.current.isDragging && !boxStateRef.current.selecting && !isPenActive) return
        if (!pos) return

        if (currentTool === 'pen') {
            // Polyline Mode: just update preview point, do not append to store on drag
            if (activeId) {
                setPreviewPoint(pos)
            }
        }

        if (currentTool === 'rectangle') {
            if (!activeId || !interactionState.current.startPos) return
            const start = interactionState.current.startPos
            const points = [
                start.x, start.y,
                pos.x, start.y,
                pos.x, pos.y,
                start.x, pos.y,
                start.x, start.y
            ]
            updateNeonPath(activeId, { points, isClosed: true })
        }

        if (currentTool === 'circle') {
            if (!activeId || !interactionState.current.startPos) return
            const start = interactionState.current.startPos
            const radius = Math.hypot(pos.x - start.x, pos.y - start.y)
            const points = []
            const segments = 64
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2
                points.push(start.x + Math.cos(angle) * radius)
                points.push(start.y + Math.sin(angle) * radius)
            }
            updateNeonPath(activeId, { points, isClosed: true, isSmooth: true, smoothTension: 0.5 })
        }

        if (currentTool === 'eraser') {
            checkEraserHit(pos)
        }
    }

    const handlePointerUp = (_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        interactionState.current.isDragging = false
        interactionState.current.startPos = null

        if (middlePanRef.current) {
            middlePanRef.current = false
            const stage = stageRef.current
            if (stage) {
                stage.draggable(false)
                const pos = stage.position()
                const scale = stage.scaleX()
                useNeonStore.getState().setCanvasTransform({ x: pos.x, y: pos.y, scale })
            }
            return
        }

        if (currentTool === 'rectangle' || currentTool === 'circle') {
            endActivePath()
        }

        if (currentTool === 'select' && boxStateRef.current.selecting) {
            boxStateRef.current.selecting = false
            const stage = stageRef.current
            if (stage && boxStateRef.current.startWorld) {
                const endWorld = getPointerPos(stage)
                if (endWorld) {
                    const rect = normalizeRect(boxStateRef.current.startWorld, endWorld)
                    applyBoxSelection(rect, boxStateRef.current.shift)
                }
            }
            boxStateRef.current.startWorld = null
            boxStateRef.current.startScreen = null
        }
    }

    const handleDoubleClick = () => {
        if (currentTool === 'pen') {
            endActivePath()
            setPreviewPoint(null)
        }
    }

    return {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleDoubleClick,
        isPanning,
        boxState: boxStateRef.current,
        isSpaceDown,
        previewPoint
    }
}
