import { useEffect } from 'react'
import { useNeonStore } from '@/store/useNeonStore'
import CanvasArea from '@/components/layout/CanvasArea'
import Header from '@/components/layout/Header'
import SidebarLeft from '@/components/layout/SidebarLeft'
import SidebarRight from '@/components/layout/SidebarRight'
import { isTyping } from '@/utils/keyboard'


const App = () => {
  useEffect(() => {
    // isTyping logic moved to utils/keyboard.ts


    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return
      if (e.repeat) return

      const ctrlOrCmd = e.ctrlKey || e.metaKey
      if (!ctrlOrCmd) return

      const temporalApi = (useNeonStore as any).temporal?.getState?.()
      if (!temporalApi) return

      const key = e.key.toLowerCase()
      const code = e.code // keyboard layout independent (KeyZ/KeyY)

      // Undo: Ctrl/Cmd+Z
      if ((code === 'KeyZ' || key === 'z') && !e.shiftKey) {
        e.preventDefault()
        e.stopImmediatePropagation()
        temporalApi.undo?.()
        return
      }

      // Redo: Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
      if (((code === 'KeyZ' || key === 'z') && e.shiftKey) || code === 'KeyY' || key === 'y') {
        e.preventDefault()
        e.stopImmediatePropagation()
        temporalApi.redo?.()
      }
    }

    // captureで先に拾う（Konva/他UIでstopPropagationされても確実に動く）
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--background))] text-foreground">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <SidebarLeft />
        <div className="ml-[72px] flex flex-1 overflow-hidden p-4">
          <CanvasArea />
        </div>
        <SidebarRight />
      </main>
    </div>
  )
}

export default App
