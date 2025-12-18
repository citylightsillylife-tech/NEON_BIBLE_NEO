import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useNeonStore } from '@/store/useNeonStore'
import type { NeonPath } from '@/types/neon'

type CommonValue<T> = { kind: 'common'; value: T } | { kind: 'mixed' } | { kind: 'none' }

function getCommonValue<T>(items: NeonPath[], getter: (p: NeonPath) => T): CommonValue<T> {
  if (items.length === 0) return { kind: 'none' }
  const first = getter(items[0])
  for (let i = 1; i < items.length; i += 1) {
    if (getter(items[i]) !== first) return { kind: 'mixed' }
  }
  return { kind: 'common', value: first }
}

export const MultiEditView = () => {
  const selectedPathIds = useNeonStore((s) => s.selectedPathIds)
  const updateLines = useNeonStore((s) => s.updateLines)
  const neonPaths = useNeonStore((s) => s.neonPaths)

  const selectedLines = useMemo(() => {
    if (selectedPathIds.length === 0) return []
    const idSet = new Set(selectedPathIds)
    return neonPaths.filter((p) => idSet.has(p.id))
  }, [neonPaths, selectedPathIds])

  const commonColor = useMemo(() => getCommonValue(selectedLines, (p) => p.color), [selectedLines])
  const commonWidth = useMemo(() => getCommonValue(selectedLines, (p) => p.width), [selectedLines])
  const commonGlow = useMemo(() => getCommonValue(selectedLines, (p) => p.glow), [selectedLines])

  const [bulkColor, setBulkColor] = useState('#00ffff')

  // mixed 対応：draft は local state で持つ（null=Mixed状態の初期）
  const [draftCoreWidth, setDraftCoreWidth] = useState<number | null>(null)
  const [draftGlow, setDraftGlow] = useState<number | null>(null)
  const coreWidthRef = useRef<number>(4)
  const glowRef = useRef<number>(10)

  useEffect(() => {
    setDraftCoreWidth(commonWidth.kind === 'common' ? commonWidth.value : null)
  }, [commonWidth.kind, commonWidth.kind === 'common' ? commonWidth.value : undefined])

  useEffect(() => {
    setDraftGlow(commonGlow.kind === 'common' ? commonGlow.value : null)
  }, [commonGlow.kind, commonGlow.kind === 'common' ? commonGlow.value : undefined])

  const defaultCoreWidth = 4
  const defaultGlow = 10
  const widthValue =
    draftCoreWidth ?? (commonWidth.kind === 'common' ? commonWidth.value : defaultCoreWidth)
  const glowValue = draftGlow ?? (commonGlow.kind === 'common' ? commonGlow.value : defaultGlow)
  coreWidthRef.current = widthValue
  glowRef.current = glowValue

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">Glow is hidden in multi-select performance mode.</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Core Color</span>
          <span className="text-[11px] text-white">
            {commonColor.kind === 'common' ? commonColor.value : commonColor.kind === 'mixed' ? 'Mixed' : ''}
          </span>
        </div>

        {commonColor.kind === 'common' ? (
          <input
            type="color"
            value={commonColor.value}
            onChange={(e) => updateLines(selectedPathIds, { color: e.target.value })}
            className="h-10 w-full cursor-pointer rounded border border-border bg-background"
          />
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="color"
              disabled
              value="#000000"
              className="h-10 w-[56px] cursor-not-allowed rounded border border-border bg-background opacity-60"
            />
            <input
              type="color"
              value={bulkColor}
              onChange={(e) => setBulkColor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded border border-border bg-background"
              aria-label="Pick color for bulk apply"
            />
            <Button variant="secondary" onClick={() => updateLines(selectedPathIds, { color: bulkColor })}>
              Apply Color
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Core Width</span>
          <span className="text-[11px] text-white">
            {draftCoreWidth === null && commonWidth.kind === 'mixed' ? 'Mixed' : widthValue.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={widthValue}
          onChange={(e) => {
            const v = Number(e.target.value)
            setDraftCoreWidth(v)
            coreWidthRef.current = v
          }}
          onMouseUp={() => updateLines(selectedPathIds, { width: coreWidthRef.current })}
          onTouchEnd={() => updateLines(selectedPathIds, { width: coreWidthRef.current })}
          className="w-full accent-white"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Glow</span>
          <span className="text-[11px] text-white">
            {draftGlow === null && commonGlow.kind === 'mixed' ? 'Mixed' : glowValue.toFixed(0)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={glowValue}
          onChange={(e) => {
            const v = Number(e.target.value)
            setDraftGlow(v)
            glowRef.current = v
          }}
          onMouseUp={() => updateLines(selectedPathIds, { glow: glowRef.current })}
          onTouchEnd={() => updateLines(selectedPathIds, { glow: glowRef.current })}
          className="w-full accent-white"
        />
      </div>
    </div>
  )
}


