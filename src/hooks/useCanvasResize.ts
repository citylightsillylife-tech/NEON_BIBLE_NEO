import { useRef, useState, useLayoutEffect } from 'react'

export const useCanvasResize = () => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    let rafId: number | null = null
    const lastSizeRef = { width: 0, height: 0 }

    const updateSize = () => {
      rafId = null
      if (!el) return
      const containerW = Math.floor(el.clientWidth)
      const containerH = Math.floor(el.clientHeight)
      
      if (containerW <= 0 || containerH <= 0) return

      const w = containerW
      const h = containerH

      if (Math.abs(lastSizeRef.width - w) < 2 && Math.abs(lastSizeRef.height - h) < 2) return

      lastSizeRef.width = w
      lastSizeRef.height = h
      setSize({ width: w, height: h })
    }

    const observer = new ResizeObserver(() => {
      if (rafId) return
      rafId = requestAnimationFrame(updateSize)
    })

    observer.observe(el)
    updateSize()

    return () => {
      observer.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return { containerRef, size }
}
