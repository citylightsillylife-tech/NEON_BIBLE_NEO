import { useEffect, useRef, useState } from 'react'
import useImage from 'use-image'
import { useNeonStore } from '@/store/useNeonStore'

export const useBackgroundLayer = (stageSize: { width: number; height: number }, stageRef: any) => {
    const backgroundImageUrl = useNeonStore((s) => s.backgroundImageUrl)
    const backgroundOpacity = useNeonStore((s) => s.backgroundOpacity)
    const backgroundTransform = useNeonStore((s) => s.backgroundTransform)
    const isBackgroundLocked = useNeonStore((s) => s.isBackgroundLocked)
    const isBackgroundEditMode = useNeonStore((s) => s.isBackgroundEditMode)
    const requestBackgroundAction = useNeonStore((s) => s.requestBackgroundAction)
    const setRequestBackgroundAction = useNeonStore((s) => s.setRequestBackgroundAction)
    const updateBackgroundTransform = useNeonStore((s) => s.updateBackgroundTransform)

    const [bgImage] = useImage(backgroundImageUrl || '')

    type ImagePlacement = { x: number; y: number; width: number; height: number }
    const backgroundPlacementRef = useRef<ImagePlacement | null>(null)
    const placementBgUrlRef = useRef<string | null>(null)
    const [placementVersion, setPlacementVersion] = useState(0)

    useEffect(() => {
        if (backgroundImageUrl === null) {
            backgroundPlacementRef.current = null
            placementBgUrlRef.current = null
            setPlacementVersion((v) => v + 1)
            return
        }
        if (!backgroundImageUrl) return
        if (placementBgUrlRef.current === backgroundImageUrl) return

        if (placementBgUrlRef.current?.startsWith('blob:') && backgroundImageUrl.startsWith('data:') && backgroundPlacementRef.current) {
            placementBgUrlRef.current = backgroundImageUrl
            return
        }

        placementBgUrlRef.current = backgroundImageUrl
        backgroundPlacementRef.current = null
        setPlacementVersion((v) => v + 1)
    }, [backgroundImageUrl])

    // Center bg on load if needed
    const migratedBgTransformRef = useRef(false)

    // Need to expose a way to set placement from the Image onLoad
    const handleImageLoad = (img: HTMLImageElement) => {
        // logical placement logic can go here if we want strictly hook controlled, 
        // but usually Konva Image onLoad handles sizing. 
        // For now we trust the component triggers updates or we calculate here.
        // Current implementation in CanvasArea was implicit. 
        // We'll let the component set ref via a returned setter or just calc here.
        const aspect = img.width / img.height
        let w = img.width
        let h = img.height
        // max initial size constraint could go here
        const maxInit = 800
        if (w > maxInit || h > maxInit) {
            if (aspect > 1) { w = maxInit; h = w / aspect }
            else { h = maxInit; w = h * aspect }
        }
        const x = (stageSize.width - w) / 2
        const y = (stageSize.height - h) / 2
        backgroundPlacementRef.current = { x, y, width: w, height: h }
        setPlacementVersion(v => v + 1)
    }

    useEffect(() => {
        if (migratedBgTransformRef.current) return
        const backgroundPlacement = backgroundPlacementRef.current
        if (!backgroundPlacement) return

        const schemaKey = 'neonBgTransformSchema'
        const currentSchema = localStorage.getItem(schemaKey)
        if (currentSchema === 'centerV1') {
            migratedBgTransformRef.current = true
            return
        }

        const s = backgroundTransform?.scale ?? 1
        const halfW = backgroundPlacement.width / 2
        const halfH = backgroundPlacement.height / 2
        const oldX = backgroundTransform?.x ?? 0
        const oldY = backgroundTransform?.y ?? 0
        const nextX = oldX + halfW * (s - 1)
        const nextY = oldY + halfH * (s - 1)
        if (Number.isFinite(nextX) && Number.isFinite(nextY) && (nextX !== oldX || nextY !== oldY)) {
            updateBackgroundTransform({ x: nextX, y: nextY })
        }
        localStorage.setItem(schemaKey, 'centerV1')
        migratedBgTransformRef.current = true
    }, [placementVersion, backgroundTransform, updateBackgroundTransform])

    useEffect(() => {
        if (!requestBackgroundAction) return
        if (isBackgroundLocked) return
        const placement = backgroundPlacementRef.current
        const stage = stageRef.current
        if (!placement || !stage) return
        if (stageSize.width <= 0 || stageSize.height <= 0) return

        const stageScale = stage.scaleX() || 1
        const stagePos = stage.position()
        const viewCenterWorld = { x: (stageSize.width / 2 - stagePos.x) / stageScale, y: (stageSize.height / 2 - stagePos.y) / stageScale }

        const fitScaleRaw = Math.min((stageSize.width / stageScale) / placement.width, (stageSize.height / stageScale) / placement.height)
        const nextScale = requestBackgroundAction === 'fitToView' ? fitScaleRaw : 1

        const baseCenterX = placement.x + placement.width / 2
        const baseCenterY = placement.y + placement.height / 2

        updateBackgroundTransform({ x: viewCenterWorld.x - baseCenterX, y: viewCenterWorld.y - baseCenterY, scale: nextScale })
        setRequestBackgroundAction(null)
    }, [requestBackgroundAction, isBackgroundLocked, stageSize, updateBackgroundTransform, setRequestBackgroundAction])

    return {
        bgImage,
        backgroundOpacity,
        backgroundTransform,
        isBackgroundLocked,
        isBackgroundEditMode,
        backgroundPlacementRef,
        handleImageLoad
    }
}
