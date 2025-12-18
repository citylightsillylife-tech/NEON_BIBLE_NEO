import { useMemo, useRef, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'

import { MultiEditView } from '@/components/ui/MultiEditView'
import { PropertySlider } from '@/components/ui/PropertySlider'
import { previewCornerRadius } from '@/components/canvas/NeonLine'
import { useNeonStore } from '@/store/useNeonStore'
import type { LayerKey } from '@/types/neon'
import { Download, Redo2, Trash2, Undo2 } from 'lucide-react'

const layers: Array<{ key: LayerKey; label: string; description: string }> = [
  { key: 'background', label: 'Background', description: '下絵' },
  { key: 'neon', label: 'Neon', description: 'ネオンパス' },
]

const SidebarRight = () => {
  const temporalSubscribe = (listener: () => void) =>
    (useNeonStore as any).temporal?.subscribe?.(listener) ?? (() => { })

  // NOTE: getSnapshot は必ずプリミティブを返す（新しい object を返すと無限ループになる）
  const pastStatesLength = useSyncExternalStore(
    temporalSubscribe,
    () => (useNeonStore as any).temporal?.getState?.()?.pastStates?.length ?? 0,
    () => 0,
  )
  const futureStatesLength = useSyncExternalStore(
    temporalSubscribe,
    () => (useNeonStore as any).temporal?.getState?.()?.futureStates?.length ?? 0,
    () => 0,
  )

  const {
    layerVisibility,
    toggleLayerVisibility,
    selectedPathIds,
    selectedCount,
    neonPaths,
    updateNeonPath,
    setPathSmooth,
    setPathSmoothTension,
    setBackgroundImageUrl,
    backgroundImageUrl,
    backgroundOpacity,
    setBackgroundOpacity,
    backgroundTransform,
    isBackgroundLocked,
    isBackgroundEditMode,
    setRequestBackgroundAction,
    updateBackgroundTransform,
    setBackgroundLocked,
    setBackgroundEditMode,
    setBackgroundImageFile,
    deleteSelectedPaths,
    triggerExport,
    exportSize,
    exportMode,
    setExportSize,
    setExportMode,
    canvasPreset,
    setCanvasPreset,
    showAngleWarnings,
    setShowAngleWarnings,
  } = useNeonStore()

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedPathId = selectedCount === 1 ? (selectedPathIds[0] ?? null) : null
  const selectedPath = selectedPathId ? neonPaths.find((path) => path.id === selectedPathId) : undefined
  const selectedSmooth = selectedPath ? selectedPath.isSmooth : false
  const selectedTension = selectedPath ? selectedPath.smoothTension : 0.5

  const selectedLines = useMemo(() => {
    if (selectedPathIds.length === 0) return []
    const idSet = new Set(selectedPathIds)
    return neonPaths.filter((p) => idSet.has(p.id))
  }, [neonPaths, selectedPathIds])

  const commonSmooth = useMemo(() => {
    if (selectedLines.length === 0) return null
    const first = selectedLines[0].isSmooth
    for (let i = 1; i < selectedLines.length; i += 1) {
      if (selectedLines[i].isSmooth !== first) return null
    }
    return first
  }, [selectedLines])

  const commonTension = useMemo(() => {
    if (selectedLines.length === 0) return null
    const first = selectedLines[0].smoothTension
    for (let i = 1; i < selectedLines.length; i += 1) {
      if (selectedLines[i].smoothTension !== first) return null
    }
    return first
  }, [selectedLines])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setBackgroundImageFile(file)
    setBackgroundImageUrl(url)
    // アップロード直後に編集可能な状態にする
    setBackgroundLocked(false)
    setBackgroundEditMode(true)
    // アップロード直後は自動で Fit to View する
    setRequestBackgroundAction('fitToView')
  }

  const handleClearBackground = () => {
    setBackgroundImageFile(null)
    setBackgroundImageUrl(null)
  }

  const handleDeleteSelected = () => {
    if (selectedPathIds.length === 0) return
    deleteSelectedPaths()
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col gap-4 border-l border-border bg-[#0a0a12]/70 p-4">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="w-full"
          disabled={pastStatesLength === 0 || !(useNeonStore as any).temporal?.getState?.()?.undo}
          onClick={() => (useNeonStore as any).temporal?.getState?.()?.undo?.()}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Undo
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={futureStatesLength === 0 || !(useNeonStore as any).temporal?.getState?.()?.redo}
          onClick={() => (useNeonStore as any).temporal?.getState?.()?.redo?.()}
        >
          <Redo2 className="mr-2 h-4 w-4" />
          Redo
        </Button>
      </div>
      <Card className="bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle>Properties</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedCount > 0 && (
            <p className="mb-3 text-xs text-muted-foreground">{`Selected: ${selectedCount} items`}</p>
          )}

          <div className="mt-3 text-sm text-muted-foreground w-full">
            {selectedCount === 0 && 'No object selected.'}
            {selectedCount === 1 && selectedPath && (
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Smooth Curve</span>
                    <Switch checked={selectedSmooth} onCheckedChange={(v) => setPathSmooth([selectedPath.id], Boolean(v))} />
                  </div>
                  {selectedSmooth && (
                    <PropertySlider
                      label="Tension"
                      value={selectedTension}
                      defaultValue={0.5}
                      min={0}
                      max={1}
                      step={0.01}
                      onPreview={() => {
                        // preview は段階導入（store更新なし）
                      }}
                      onCommit={(val) => setPathSmoothTension([selectedPath.id], val)}
                    />
                  )}
                  {selectedSmooth && (
                    <p className="text-[11px] text-muted-foreground">
                      Corner Radius is disabled while Smooth Curve is enabled.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Color</p>
                  <input
                    type="color"
                    value={selectedPath.color}
                    onChange={(e) => updateNeonPath(selectedPath.id, { color: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded border border-border bg-background"
                  />
                </div>
                <PropertySlider
                  label="Core Width"
                  value={selectedPath.width}
                  defaultValue={4}
                  min={1}
                  max={20}
                  step={0.5}
                  onPreview={() => {
                    // preview は段階導入（store更新なし）
                  }}
                  onCommit={(val) => updateNeonPath(selectedPath.id, { width: val })}
                />
                <PropertySlider
                  label="Glow"
                  value={selectedPath.glow}
                  defaultValue={10}
                  min={0}
                  max={50}
                  step={1}
                  onPreview={() => {
                    // preview は段階導入（store更新なし）
                  }}
                  onCommit={(val) => updateNeonPath(selectedPath.id, { glow: val })}
                />
                <div className={selectedSmooth ? 'opacity-50 pointer-events-none' : ''}>
                  <PropertySlider
                    label="Corner Radius"
                    value={selectedPath.cornerRadius}
                    defaultValue={0}
                    min={0}
                    max={100}
                    step={1}
                    onPreview={(val) => previewCornerRadius([selectedPath.id], val)}
                    onCommit={(val) => updateNeonPath(selectedPath.id, { cornerRadius: val })}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Radius is automatically clamped for short segments.</p>
              </div>
            )}
            {selectedCount >= 2 && (
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Smooth Curve</span>
                    <span className="text-[11px] text-white/80">{commonSmooth === null ? 'Mixed' : commonSmooth ? 'On' : 'Off'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Enable</span>
                    <Switch checked={commonSmooth === true} onCheckedChange={(v) => setPathSmooth(selectedPathIds, Boolean(v))} />
                  </div>
                  {commonSmooth === true && (
                    <PropertySlider
                      label="Tension"
                      value={commonTension}
                      defaultValue={0.5}
                      min={0}
                      max={1}
                      step={0.01}
                      onPreview={() => {
                        // preview は段階導入（store更新なし）
                      }}
                      onCommit={(val) => setPathSmoothTension(selectedPathIds, val)}
                    />
                  )}
                  {commonSmooth === true && (
                    <p className="text-[11px] text-muted-foreground">
                      Corner Radius is ignored while Smooth Curve is enabled.
                    </p>
                  )}
                </div>
                <div className={commonSmooth === true ? 'opacity-50 pointer-events-none' : ''}>
                  <MultiEditView />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/70 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Edit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="destructive"
            className="w-full"
            disabled={selectedPathIds.length === 0}
            onClick={handleDeleteSelected}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card/70 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Canvas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Canvas Size</label>
            <select
              value={canvasPreset ? `${canvasPreset.w}x${canvasPreset.h}` : 'current'}
              onChange={(e) => {
                const value = e.target.value
                if (value === 'current') {
                  setCanvasPreset(null)
                } else {
                  const [w, h] = value.split('x').map(Number)
                  setCanvasPreset({ w, h })
                }
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="current">Current Size</option>
              <option value="1080x1080">1080 × 1080</option>
              <option value="1080x1920">1080 × 1920</option>
              <option value="1920x1080">1920 × 1080</option>
              <option value="1024x1024">1024 × 1024</option>
              <option value="2048x2048">2048 × 2048</option>
              <option value="2480x3508">A4 (2480 × 3508)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/70 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Layers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="w-full" onClick={handleUploadClick}>
              Upload Image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          {backgroundImageUrl && (
            <div className="space-y-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
              <div className="mb-2 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{`Background Edit Mode${isBackgroundLocked ? ' (Locked)' : ''}`}</span>
                  <Switch
                    checked={isBackgroundEditMode}
                    disabled={isBackgroundLocked}
                    onCheckedChange={(v) => setBackgroundEditMode(Boolean(v))}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Lock Background</span>
                  <Switch checked={isBackgroundLocked} onCheckedChange={(v) => setBackgroundLocked(Boolean(v))} />
                </div>
              </div>

              <div className={isBackgroundLocked ? 'opacity-50 pointer-events-none' : ''}>
                <PropertySlider
                  label="Background Scale"
                  value={backgroundTransform.scale}
                  defaultValue={1}
                  min={0.1}
                  max={3}
                  step={0.01}
                  onPreview={() => {
                    // preview は store更新しない方針だが、CanvasArea export に依存すると白画面（named export不整合）になりやすいので無効化
                  }}
                  onCommit={(val) => updateBackgroundTransform({ scale: val })}
                />
              </div>

              <Button
                variant="secondary"
                className="w-full"
                disabled={isBackgroundLocked}
                onClick={() => setRequestBackgroundAction('resetToView')}
              >
                Reset to View
              </Button>

              <Button
                variant="secondary"
                className="w-full"
                disabled={isBackgroundLocked}
                onClick={() => setRequestBackgroundAction('fitToView')}
              >
                Fit to View
              </Button>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Opacity</span>
                <span className="text-[11px] text-white">
                  {Math.round(backgroundOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                value={backgroundOpacity}
                onChange={(e) => setBackgroundOpacity(Number(e.target.value))}
                className="w-full accent-white"
              />
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={handleClearBackground}
              >
                Clear Image
              </Button>
            </div>
          )}
          {layers.map((layer) => (
            <div
              key={layer.key}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  id={layer.key}
                  checked={layerVisibility[layer.key]}
                  onCheckedChange={() => toggleLayerVisibility(layer.key)}
                />
                <label htmlFor={layer.key} className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">{layer.label}</p>
                  <p className="text-xs text-muted-foreground">{layer.description}</p>
                </label>
              </div>
              <Switch
                checked={layerVisibility[layer.key]}
                onCheckedChange={() => toggleLayerVisibility(layer.key)}
                aria-label={`Toggle ${layer.label}`}
              />
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
            <div className="flex flex-col">
              <p className="text-sm font-medium leading-none">Angle warnings</p>
              <p className="text-xs text-muted-foreground">急角度警告マーカー</p>
            </div>
            <Switch
              checked={showAngleWarnings}
              onCheckedChange={(checked) => {
                setShowAngleWarnings(Boolean(checked))
              }}
              aria-label="Toggle angle warnings"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/70 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Export Size</label>
            <div className="text-sm text-muted-foreground">
              {canvasPreset ? (
                <span>{canvasPreset.w} × {canvasPreset.h}</span>
              ) : exportSize ? (
                <span>{exportSize.width} × {exportSize.height}</span>
              ) : (
                <span>Current Size</span>
              )}
            </div>
            {!canvasPreset && (
              <select
                value={exportSize ? `${exportSize.width}x${exportSize.height}` : 'current'}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === 'current') {
                    setExportSize(null)
                  } else {
                    const [width, height] = value.split('x').map(Number)
                    setExportSize({ width, height })
                  }
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="current">Current Size</option>
                <option value="1024x1024">1024 × 1024</option>
                <option value="2048x2048">2048 × 2048</option>
                <option value="1920x1080">1920 × 1080</option>
                <option value="1080x1350">1080 × 1350</option>
                <option value="1080x1920">1080 × 1920</option>
                <option value="2480x3508">A4 (2480 × 3508)</option>
              </select>
            )}
          </div>
          {exportSize && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Mode</label>
              <div className="flex gap-2">
                <Button
                  variant={exportMode === 'fit' ? 'default' : 'secondary'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setExportMode('fit')}
                >
                  Fit
                </Button>
                <Button
                  variant={exportMode === 'fill' ? 'default' : 'secondary'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setExportMode('fill')}
                >
                  Fill
                </Button>
              </div>
            </div>
          )}
          <Button variant="secondary" className="w-full" onClick={triggerExport}>
            <Download className="mr-2 h-4 w-4" />
            Download PNG
          </Button>
        </CardContent>
      </Card>
    </aside>
  )
}

export default SidebarRight

