export type Tool = 'select' | 'pen' | 'hand' | 'eraser' | 'rectangle' | 'circle' | 'cut'

export type LayerKey = 'background'

export type NeonPath = {
  id: string
  points: number[]
  color: string
  width: number
  glow: number
  cornerRadius: number
  isSmooth: boolean
  smoothTension: number
  isClosed?: boolean
}

