import { useEffect, useRef, useState } from 'react'

type Props = {
  label: string
  value: number | null // null = Mixed
  defaultValue: number
  min: number
  max: number
  step: number
  onPreview: (val: number) => void
  onCommit: (val: number) => void
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const PropertySlider = ({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  onPreview,
  onCommit,
}: Props) => {
  const isMixed = value === null
  const fallback = clamp(defaultValue, min, max)

  const isInteractingRef = useRef(false)
  const didChangeRef = useRef(false)
  const lastCommittedRef = useRef<number | null>(null)

  const [draft, setDraft] = useState<number>(clamp(isMixed ? fallback : value, min, max))
  const [text, setText] = useState<string>(isMixed ? '' : String(value))
  const [isActivated, setIsActivated] = useState<boolean>(!isMixed)

  const decimals = (() => {
    const s = String(step)
    const idx = s.indexOf('.')
    return idx === -1 ? 0 : s.length - idx - 1
  })()

  useEffect(() => {
    if (isInteractingRef.current) return
    const next = clamp(isMixed ? fallback : value, min, max)
    setDraft(next)
    setText(isMixed ? '' : String(next))
    setIsActivated(!isMixed)
    didChangeRef.current = false
  }, [fallback, isMixed, max, min, value])

  const commit = (val: number) => {
    const v = clamp(val, min, max)
    if (lastCommittedRef.current === v) return
    lastCommittedRef.current = v
    onCommit(v)
  }

  const preview = (val: number) => {
    const v = clamp(val, min, max)
    onPreview(v)
  }

  const displayValue = isMixed && !isActivated ? 'Mixed' : draft.toFixed(decimals)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="text-[11px] text-white">{displayValue}</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={draft}
          onPointerDown={() => {
            isInteractingRef.current = true
            // Mixed状態でも「ここから操作中」を明示（ツマミ表示を通常に戻す）
            setIsActivated(true)
            didChangeRef.current = false
          }}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v)) return
            const next = clamp(v, min, max)
            setDraft(next)
            setText(String(next))
            didChangeRef.current = true
            preview(next)
          }}
          onPointerUp={() => {
            isInteractingRef.current = false
            if (!didChangeRef.current) return
            didChangeRef.current = false
            commit(draft)
          }}
          onMouseUp={() => {
            isInteractingRef.current = false
            if (!didChangeRef.current) return
            didChangeRef.current = false
            commit(draft)
          }}
          onTouchEnd={() => {
            isInteractingRef.current = false
            if (!didChangeRef.current) return
            didChangeRef.current = false
            commit(draft)
          }}
          className={[
            'w-full',
            isMixed && !isActivated ? 'opacity-60 accent-slate-500' : 'accent-white',
          ].join(' ')}
        />

        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          placeholder={isMixed ? 'Mixed' : ''}
          onFocus={() => {
            isInteractingRef.current = true
            setIsActivated(true)
            didChangeRef.current = false
          }}
          onChange={(e) => {
            const nextText = e.target.value
            setText(nextText)
            const n = Number(nextText)
            if (!Number.isFinite(n)) return
            const next = clamp(n, min, max)
            setDraft(next)
            didChangeRef.current = true
            preview(next)
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            const n = Number(text)
            if (!Number.isFinite(n)) return
            isInteractingRef.current = false
            const next = clamp(n, min, max)
            setDraft(next)
            setText(String(next))
            didChangeRef.current = false
            commit(next)
          }}
          onBlur={() => {
            const n = Number(text)
            if (!Number.isFinite(n)) {
              // revert
              const next = clamp(draft, min, max)
              setText(isMixed ? '' : String(next))
              isInteractingRef.current = false
              return
            }
            isInteractingRef.current = false
            const next = clamp(n, min, max)
            setDraft(next)
            setText(String(next))
            didChangeRef.current = false
            commit(next)
          }}
          className="h-9 w-[96px] rounded border border-border bg-background px-2 text-sm text-white"
        />
      </div>
    </div>
  )
}



