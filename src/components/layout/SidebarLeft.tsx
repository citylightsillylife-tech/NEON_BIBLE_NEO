import { useEffect, type ComponentType } from 'react'

import { Button } from '@/components/ui/button'
import { useNeonStore } from '@/store/useNeonStore'
import type { Tool } from '@/types/neon'
import { isTyping } from '@/utils/keyboard'
import { Hand, MousePointer2, PenTool, Eraser, Square, Circle as CircleIcon, Scissors, Link } from 'lucide-react'

const tools: Array<{ key: Tool; label: string; icon: ComponentType<{ className?: string }>; shortcut: string }> = [
  { key: 'select', label: 'Select', icon: MousePointer2, shortcut: 'V' },
  { key: 'pen', label: 'Pen', icon: PenTool, shortcut: 'P' },
  { key: 'eraser', label: 'Eraser', icon: Eraser, shortcut: 'E' },
  { key: 'rectangle', label: 'Rectangle', icon: Square, shortcut: 'R' },
  { key: 'circle', label: 'Circle', icon: CircleIcon, shortcut: 'C' },
  { key: 'hand', label: 'Hand', icon: Hand, shortcut: 'H' },
]

const SidebarLeft = () => {
  // selector無し購読は全state更新で再レンダーするため分解
  const currentTool = useNeonStore((s) => s.currentTool)
  const setCurrentTool = useNeonStore((s) => s.setCurrentTool)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.toUpperCase()

      // Tools
      const tool = tools.find(t => t.shortcut === key)
      if (tool) {
        setCurrentTool(tool.key)
        return
      }

      // Cut (Scissors)
      if (key === 'S') {
        setCurrentTool('cut')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCurrentTool])

  return (
    <aside className="fixed left-0 top-16 z-10 flex h-[calc(100vh-4rem)] w-[72px] flex-col items-center space-y-4 border-r border-border bg-[#0a0a12]/80 py-4">
      <div className="flex flex-col items-center gap-2">
        {tools.map((tool) => (
          <div key={tool.key} className="relative group">
            <Button
              size="icon"
              variant="ghost"
              className={`h-10 w-10 rounded-lg border ${currentTool === tool.key
                ? 'border-primary/70 bg-primary text-primary-foreground shadow-[0_0_12px_rgba(224,31,255,0.45)]'
                : 'border-transparent bg-white/5 text-foreground hover:bg-white/10'
                }`}
              onClick={() => {
                setCurrentTool(tool.key)
              }}
              aria-label={tool.label}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <tool.icon className="h-4 w-4" />
            </Button>
            <span className="absolute bottom-0.5 right-1 text-[8px] font-mono opacity-50 pointer-events-none select-none">
              {tool.shortcut}
            </span>
          </div>
        ))}
        <div className="relative group">
          <Button
            variant={currentTool === 'cut' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setCurrentTool('cut')}
            title="Cut Path (S)"
          >
            <Scissors className="h-5 w-5" />
          </Button>
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono opacity-50 pointer-events-none select-none">
            S
          </span>
        </div>

        {/* Glue Button (Contextual) */}
        {useNeonStore(s => s.selectedCount === 2) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => useNeonStore.getState().joinSelectedPaths()}
            title="Glue Paths (Join)"
            className="animate-in fade-in zoom-in duration-200"
          >
            <Link className="h-5 w-5 text-green-400" />
          </Button>
        )}
      </div>
    </aside>
  )
}

export default SidebarLeft

