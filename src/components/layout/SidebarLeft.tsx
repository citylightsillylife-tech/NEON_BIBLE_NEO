import type { ComponentType } from 'react'

import { Button } from '@/components/ui/button'
import { useNeonStore } from '@/store/useNeonStore'
import type { Tool } from '@/types/neon'
import { Hand, MousePointer2, PenTool, Eraser, Square, Circle as CircleIcon, Scissors, Link } from 'lucide-react'

const tools: Array<{ key: Tool; label: string; icon: ComponentType<{ className?: string }> }> = [
  { key: 'select', label: 'Select', icon: MousePointer2 },
  { key: 'pen', label: 'Pen', icon: PenTool },
  { key: 'eraser', label: 'Eraser', icon: Eraser },
  { key: 'rectangle', label: 'Rectangle', icon: Square },
  { key: 'circle', label: 'Circle', icon: CircleIcon },
  { key: 'hand', label: 'Hand', icon: Hand },
]

const SidebarLeft = () => {
  // selector無し購読は全state更新で再レンダーするため分解
  const currentTool = useNeonStore((s) => s.currentTool)
  const setCurrentTool = useNeonStore((s) => s.setCurrentTool)

  return (
    <aside className="fixed left-0 top-16 z-10 flex h-[calc(100vh-4rem)] w-[72px] flex-col items-center space-y-4 border-r border-border bg-[#0a0a12]/80 py-4">
      <div className="flex flex-col items-center gap-2">
        {tools.map((tool) => (
          <Button
            key={tool.key}
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
          >
            <tool.icon className="h-4 w-4" />
          </Button>
        ))}
        <Button
          variant={currentTool === 'cut' ? 'default' : 'ghost'}
          size="icon"
          onClick={() => setCurrentTool('cut')}
          title="Cut Path (Scissors)"
        >
          <Scissors className="h-5 w-5" />
        </Button>

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

