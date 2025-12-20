import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useRef } from 'react'

import { useNeonStore } from '@/store/useNeonStore'
// downloadStageAsPng removed
import { getCanvasStage } from '@/components/layout/CanvasArea'
// exportUtils not directly used here anymore, logic moved to CanvasArea


type NeonDocumentV1 = {
  version: 1
  data: {
    neonPaths: unknown
    layerVisibility?: unknown
    canvasTransform?: unknown
    backgroundImageUrl?: unknown
    backgroundOpacity?: unknown
    backgroundTransform?: unknown
    isBackgroundLocked?: unknown
    isBackgroundEditMode?: unknown
    showAngleWarnings?: unknown
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const formatTimestamp = (d: Date) => {
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  const ss = pad2(d.getSeconds())
  return `${y}${m}${day}-${hh}${mm}${ss}`
}

const downloadJson = (obj: unknown, fileName: string) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const Header = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const loadDocument = useNeonStore((s) => s.loadDocument)

  const handleSave = () => {
    try {
      const s = useNeonStore.getState()
      const payload: NeonDocumentV1 = {
        version: 1,
        data: {
          neonPaths: s.neonPaths,
          layerVisibility: s.layerVisibility,
          canvasTransform: s.canvasTransform,
          backgroundImageUrl: s.backgroundImageUrl,
          backgroundOpacity: s.backgroundOpacity,
          backgroundTransform: s.backgroundTransform,
          isBackgroundLocked: s.isBackgroundLocked,
          isBackgroundEditMode: s.isBackgroundEditMode,
          showAngleWarnings: s.showAngleWarnings,
        },
      }
      const fileName = `neon-sim_${formatTimestamp(new Date())}.json`
      downloadJson(payload, fileName)
    } catch (e) {
      console.error('[save] failed', e)
      alert('Save failed. Check console for details.')
    }
  }

  const handleOpenClick = () => {
    fileInputRef.current?.click()
  }

  const handleOpenChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // 同一ファイルを連続で開けるようにリセット
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Partial<NeonDocumentV1>
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON root')
      if ((parsed as any).version !== 1) throw new Error('Unsupported version')
      const data = (parsed as any).data
      if (!data || typeof data !== 'object') throw new Error('Invalid data')

      // 最低限の型チェック（MVP）
      if (!Array.isArray((data as any).neonPaths)) throw new Error('Invalid neonPaths')

      loadDocument({
        neonPaths: (data as any).neonPaths,
        layerVisibility: (data as any).layerVisibility,
        canvasTransform: (data as any).canvasTransform,
        backgroundImageUrl: (data as any).backgroundImageUrl,
        backgroundOpacity: (data as any).backgroundOpacity,
        backgroundTransform: (data as any).backgroundTransform,
        isBackgroundLocked: (data as any).isBackgroundLocked,
        isBackgroundEditMode: (data as any).isBackgroundEditMode,
        showAngleWarnings: (data as any).showAngleWarnings,
      })

      // Undo/Redo は読み込み後にリセット（MVP）
      try {
        const temporalApi = (useNeonStore as any).temporal?.getState?.()
        temporalApi?.clear?.()
      } catch (err) {
        console.error('[open] temporal clear failed', err)
      }
    } catch (err) {
      console.error('[open] failed', err)
      alert('Open failed. Check console for details.')
    }
  }

  const handleExportPng = (mode: 'black' | 'transparent') => {
    try {
      const stage = getCanvasStage()
      if (!stage) {
        alert('Export failed: Canvas is not ready yet.')
        return
      }
      // Set mode first
      useNeonStore.getState().setExportBgMode(mode)
      // Trigger export (CanvasArea will handle the rest)
      useNeonStore.getState().triggerExport()
    } catch (e) {
      console.error('[export png] failed', e)
      alert('Export PNG failed. Check console for details.')
    }
  }

  const actions = [
    { label: 'New', onClick: () => { } },
    { label: 'Open', onClick: handleOpenClick },
    { label: 'Save', onClick: handleSave },
    // Export moved to custom dropdown
  ] as const

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-[#0b0b12]/80 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">
          NB
        </div>
        <span className="text-lg font-semibold tracking-wide">NEON_BIBLE</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleOpenChange}
        />
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant="secondary"
            className="rounded-lg bg-white/5 text-foreground hover:bg-white/10"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-lg bg-white/5 text-foreground hover:bg-white/10"
            >
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExportPng('black')}>
              Export PNG (Black)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportPng('transparent')}>
              Export PNG (Transparent)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-lg bg-white/5 text-foreground hover:bg-white/10"
          onClick={() => window.open('/NEON_BIBLE_MANUAL/index.html', '_blank')}
          title="ユーザーマニュアルを開く"
        >
          📖 マニュアル
        </Button>
      </div>
    </header>
  )
}

export default Header

