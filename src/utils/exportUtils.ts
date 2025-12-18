import Konva from 'konva'

export type ExportOptions = {
  targetWidth?: number
  targetHeight?: number
  mode?: 'fit' | 'fill'
  backgroundColor?: string
  artboard?: { w: number; h: number }
  canvasTransform?: { x: number; y: number; scale: number }
}

export const downloadStageAsPng = (
  stage: Konva.Stage,
  fileName: string = 'neon-design.png',
  options?: ExportOptions,
) => {
  const { targetWidth, targetHeight, mode = 'fit', backgroundColor, artboard } = options || {}

  // "Professional" Export: Temporary Reset Pattern
  // We save the current user view (zoom/pan), reset to 1:1 centered on (0,0),
  // capture the perfect high-res output, then restore the view.
  const originalScale = stage.scaleX()
  const originalPos = stage.position()

  try {
    // 1. Reset Stage to clear "viewport" influence
    stage.scale({ x: 1, y: 1 })
    stage.position({ x: 0, y: 0 })

    // 2. Determine Export Region & Size
    let config: any = {
      pixelRatio: 2, // Default high quality
      mimeType: 'image/png',
      quality: 1,
    }

    if (artboard) {
      // CASE A: Artboard Mode (Explicit dimensions)
      // Since we reset stage to 0,0 and scale 1, the world coordinates map 1:1 to content.
      // We just capture the artboard rect at (0,0).
      config = {
        ...config,
        x: 0, // Artboard assumed to start at 0,0 world
        y: 0,
        width: artboard.w,
        height: artboard.h,
        pixelRatio: 2, // 2x density for retina-like quality
      }
    } else if (targetWidth && targetHeight) {
      // CASE B: Target Size (Fit/Fill legacy logic)
      // For this, we might need a temporary canvas to scale, OR we leverage Konva's ability.
      // But simply resetting the stage helps get a clean source.
      // (Keeping original logic for this fallback branch but using the clean stage)
      const stageCanvas = stage.toCanvas({ pixelRatio: 2 })
      const srcWidth = stageCanvas.width
      const srcHeight = stageCanvas.height

      // Fit/Fill calculation
      const scale = mode === 'fit'
        ? Math.min(targetWidth / srcWidth, targetHeight / srcHeight)
        : Math.max(targetWidth / srcWidth, targetHeight / srcHeight)

      const scaledWidth = srcWidth * scale
      const scaledHeight = srcHeight * scale
      const dx = (targetWidth - scaledWidth) / 2
      const dy = (targetHeight - scaledHeight) / 2

      const targetCanvas = document.createElement('canvas')
      targetCanvas.width = targetWidth
      targetCanvas.height = targetHeight
      const ctx = targetCanvas.getContext('2d')
      if (ctx) {
        const bg = backgroundColor ?? '#000000'
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, targetWidth, targetHeight)
        ctx.drawImage(stageCanvas, dx, dy, scaledWidth, scaledHeight)

        targetCanvas.toBlob((blob) => {
          if (!blob) return
          triggerDownload(blob, fileName)
        }, 'image/png')
      }
      return // Async handled above
    } else {
      // CASE C: Default (Full current view? No, full content)
      // Without args, acts like a screenshot of content bounds
    }

    // 3. Execute Export
    if (artboard && backgroundColor) {
      // Special Case: Artboard + Background Color (e.g. Black Export)
      // Since stage.toDataURL() supports transparency by default, we need to manually composite 
      // the stage onto a background color.
      const stageCanvas = stage.toCanvas(config)

      const composite = document.createElement('canvas')
      composite.width = stageCanvas.width
      composite.height = stageCanvas.height

      const ctx = composite.getContext('2d')
      if (ctx) {
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, composite.width, composite.height)
        ctx.drawImage(stageCanvas, 0, 0)

        composite.toBlob((blob) => {
          if (!blob) return
          triggerDownload(blob, fileName)
        }, 'image/png')
      }
    } else if (artboard || (!targetWidth && !targetHeight)) {
      // Standard Case (Transparent or Default)
      const dataURL = stage.toDataURL(config)
      triggerDownloadUrl(dataURL, fileName)
    }

  } finally {
    // 4. Restore User View
    stage.scale({ x: originalScale, y: originalScale })
    stage.position(originalPos)
    stage.batchDraw()
  }
}

// Helpers
const triggerDownloadUrl = (url: string, fileName: string) => {
  const link = document.createElement('a')
  link.download = fileName
  link.href = url
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  triggerDownloadUrl(url, fileName)
  URL.revokeObjectURL(url)
}

