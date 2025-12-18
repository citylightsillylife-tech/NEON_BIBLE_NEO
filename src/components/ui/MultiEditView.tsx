import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { PropertySlider } from '@/components/ui/PropertySlider'
import { previewCornerRadius } from '@/components/canvas/NeonLine'
import { useNeonStore } from '@/store/useNeonStore'
import type { NeonPath } from '@/types/neon'

const getCommonNumber = (items: NeonPath[], getter: (p: NeonPath) => number): number | null => {
  if (items.length === 0) return null
  const first = getter(items[0])
  for (let i = 1; i < items.length; i += 1) {
    if (getter(items[i]) !== first) return null
  }
  return first
}

export const MultiEditView = () => {
  const selectedPathIds = useNeonStore((s) => s.selectedPathIds)
  const neonPaths = useNeonStore((s) => s.neonPaths)
  const updateLines = useNeonStore((s) => s.updateLines)

  const selectedLines = useMemo(() => {
    if (selectedPathIds.length === 0) return []
    const idSet = new Set(selectedPathIds)
    return neonPaths.filter((p) => idSet.has(p.id))
  }, [neonPaths, selectedPathIds])

  const commonWidth = useMemo(() => getCommonNumber(selectedLines, (p) => p.width), [selectedLines])
  const commonGlow = useMemo(() => getCommonNumber(selectedLines, (p) => p.glow), [selectedLines])
  const commonCorner = useMemo(() => getCommonNumber(selectedLines, (p) => p.cornerRadius), [selectedLines])
  const commonColor = useMemo(() => {
    if (selectedLines.length === 0) return null
    const first = selectedLines[0].color
    for (let i = 1; i < selectedLines.length; i += 1) {
      if (selectedLines[i].color !== first) return null
    }
    return first
  }, [selectedLines])

  const [bulkColor, setBulkColor] = useState('#00ffff')

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">Glow is hidden in multi-select performance mode.</p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Core Color</span>
          <span className="text-[11px] text-white">{commonColor ? commonColor : 'Mixed'}</span>
        </div>

        {commonColor ? (
          <input
            type="color"
            value={commonColor}
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

      <PropertySlider
        label="Core Width"
        value={commonWidth}
        defaultValue={4}
        min={1}
        max={20}
        step={0.5}
        onPreview={() => {
          // preview は段階導入（store更新なし）
        }}
        onCommit={(val) => updateLines(selectedPathIds, { width: val })}
      />

      <PropertySlider
        label="Glow"
        value={commonGlow}
        defaultValue={10}
        min={0}
        max={50}
        step={1}
        onPreview={() => {
          // preview は段階導入（store更新なし）
        }}
        onCommit={(val) => updateLines(selectedPathIds, { glow: val })}
      />

      <PropertySlider
        label="Corner Radius"
        value={commonCorner}
        defaultValue={0}
        min={0}
        max={100}
        step={1}
        onPreview={(val) => previewCornerRadius(selectedPathIds, val)}
        onCommit={(val) => updateLines(selectedPathIds, { cornerRadius: val })}
      />

      <p className="text-[11px] text-muted-foreground">Radius is automatically clamped for short segments.</p>
    </div>
  )
}



