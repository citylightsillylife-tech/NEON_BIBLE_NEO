export type Point = { x: number; y: number }

export type Rect = { x: number; y: number; width: number; height: number }

export const normalizeRect = (a: Point, b: Point): Rect => {
  const x1 = Math.min(a.x, b.x)
  const y1 = Math.min(a.y, b.y)
  const x2 = Math.max(a.x, b.x)
  const y2 = Math.max(a.y, b.y)
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

export const pointInRectInclusive = (p: Point, r: Rect): boolean => {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
}

export const rectsIntersectInclusive = (a: Rect, b: Rect): boolean => {
  const ax2 = a.x + a.width
  const ay2 = a.y + a.height
  const bx2 = b.x + b.width
  const by2 = b.y + b.height
  return a.x <= bx2 && ax2 >= b.x && a.y <= by2 && ay2 >= b.y
}

const cross = (a: Point, b: Point, c: Point) => {
  // cross product of AB x AC
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

const onSegmentInclusive = (a: Point, b: Point, p: Point) => {
  return (
    Math.min(a.x, b.x) <= p.x &&
    p.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= p.y &&
    p.y <= Math.max(a.y, b.y)
  )
}

export const segmentsIntersectInclusive = (p1: Point, p2: Point, q1: Point, q2: Point): boolean => {
  const d1 = cross(p1, p2, q1)
  const d2 = cross(p1, p2, q2)
  const d3 = cross(q1, q2, p1)
  const d4 = cross(q1, q2, p2)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }

  // collinear / touching cases (inclusive)
  if (d1 === 0 && onSegmentInclusive(p1, p2, q1)) return true
  if (d2 === 0 && onSegmentInclusive(p1, p2, q2)) return true
  if (d3 === 0 && onSegmentInclusive(q1, q2, p1)) return true
  if (d4 === 0 && onSegmentInclusive(q1, q2, p2)) return true
  return false
}

export const segmentIntersectsRectInclusive = (a: Point, b: Point, r: Rect): boolean => {
  if (pointInRectInclusive(a, r) || pointInRectInclusive(b, r)) return true

  const tl = { x: r.x, y: r.y }
  const tr = { x: r.x + r.width, y: r.y }
  const br = { x: r.x + r.width, y: r.y + r.height }
  const bl = { x: r.x, y: r.y + r.height }

  return (
    segmentsIntersectInclusive(a, b, tl, tr) ||
    segmentsIntersectInclusive(a, b, tr, br) ||
    segmentsIntersectInclusive(a, b, br, bl) ||
    segmentsIntersectInclusive(a, b, bl, tl)
  )
}

export const polylineIntersectsRectInclusive = (points: number[], r: Rect): boolean => {
  if (points.length < 2) return false
  if (points.length === 2) return pointInRectInclusive({ x: points[0], y: points[1] }, r)
  for (let i = 0; i + 3 < points.length; i += 2) {
    const a = { x: points[i], y: points[i + 1] }
    const b = { x: points[i + 2], y: points[i + 3] }
    if (segmentIntersectsRectInclusive(a, b, r)) return true
  }
  return false
}

export const bboxFromPoints = (points: number[]): Rect | null => {
  if (points.length < 2) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i]
    const y = points[i + 1]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export const pointsToRoundedPath = (points: number[], radius: number): string => {
  if (!Array.isArray(points) || points.length < 2) return ''
  if (points.length < 4) {
    const x = points[0]
    const y = points[1]
    if (!Number.isFinite(x) || !Number.isFinite(y)) return ''
    return `M ${x} ${y}`
  }

  const r0 = Math.max(0, radius)
  const x0 = points[0]
  const y0 = points[1]
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return ''

  // radius=0: straight polyline
  if (r0 === 0) {
    let d = `M ${x0} ${y0}`
    for (let i = 2; i + 1 < points.length; i += 2) {
      const x = points[i]
      const y = points[i + 1]
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      d += ` L ${x} ${y}`
    }
    return d
  }

  const pts: Point[] = []
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i]
    const y = points[i + 1]
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    pts.push({ x, y })
  }
  if (pts.length < 2) return `M ${x0} ${y0}`

  let d = `M ${pts[0].x} ${pts[0].y}`
  if (pts.length === 2) {
    d += ` L ${pts[1].x} ${pts[1].y}`
    return d
  }

  for (let i = 1; i < pts.length - 1; i += 1) {
    const A = pts[i - 1]
    const B = pts[i]
    const C = pts[i + 1]

    const bax = A.x - B.x
    const bay = A.y - B.y
    const bcx = C.x - B.x
    const bcy = C.y - B.y

    const lenBA = Math.hypot(bax, bay)
    const lenBC = Math.hypot(bcx, bcy)
    if (lenBA === 0 || lenBC === 0) {
      d += ` L ${B.x} ${B.y}`
      continue
    }

    const uxBA = bax / lenBA
    const uyBA = bay / lenBA
    const uxBC = bcx / lenBC
    const uyBC = bcy / lenBC

    // dot of normalized BA and BC
    const dot = uxBA * uxBC + uyBA * uyBC
    // almost straight (180deg): skip rounding
    if (dot <= -0.999) {
      d += ` L ${B.x} ${B.y}`
      continue
    }

    const r = Math.min(r0, lenBA * 0.49, lenBC * 0.49)
    if (!(r > 0)) {
      d += ` L ${B.x} ${B.y}`
      continue
    }

    const Px = B.x + uxBA * r
    const Py = B.y + uyBA * r
    const Qx = B.x + uxBC * r
    const Qy = B.y + uyBC * r

    d += ` L ${Px} ${Py} Q ${B.x} ${B.y} ${Qx} ${Qy}`
  }

  const last = pts[pts.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

export const pointsToCatmullRomPath = (points: number[], tension: number, closed: boolean): string => {
  if (!Array.isArray(points) || points.length < 2) return ''

  const x0 = points[0]
  const y0 = points[1]
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return pointsToRoundedPath(points, 0)

  // 1 point
  if (points.length < 4) return `M ${x0} ${y0}`
  // 2 points: straight
  if (points.length === 4) {
    const x1 = points[2]
    const y1 = points[3]
    if (!Number.isFinite(x1) || !Number.isFinite(y1)) return pointsToRoundedPath(points, 0)
    return `M ${x0} ${y0} L ${x1} ${y1}`
  }

  const t = Math.min(1, Math.max(0, tension))
  const k = t / 6 // coefficient only (no division by tension)
  if (k === 0) return pointsToRoundedPath(points, 0)

  const n = Math.floor(points.length / 2)
  if (n < 2) return `M ${x0} ${y0}`

  const getIndex = (idx: number) => {
    if (closed) {
      const m = ((idx % n) + n) % n
      return m
    }
    if (idx < 0) return 0
    if (idx >= n) return n - 1
    return idx
  }

  const getX = (idx: number) => points[getIndex(idx) * 2]
  const getY = (idx: number) => points[getIndex(idx) * 2 + 1]

  const out: string[] = []
  out.push(`M ${x0} ${y0}`)

  const segCount = closed ? n : n - 1
  for (let i = 0; i < segCount; i += 1) {
    const p0x = getX(i - 1)
    const p0y = getY(i - 1)
    const p1x = getX(i)
    const p1y = getY(i)
    const p2x = getX(i + 1)
    const p2y = getY(i + 1)
    const p3x = getX(i + 2)
    const p3y = getY(i + 2)

    if (
      !Number.isFinite(p0x) ||
      !Number.isFinite(p0y) ||
      !Number.isFinite(p1x) ||
      !Number.isFinite(p1y) ||
      !Number.isFinite(p2x) ||
      !Number.isFinite(p2y) ||
      !Number.isFinite(p3x) ||
      !Number.isFinite(p3y)
    ) {
      return pointsToRoundedPath(points, 0)
    }

    const cp1x = p1x + (p2x - p0x) * k
    const cp1y = p1y + (p2y - p0y) * k
    const cp2x = p2x - (p3x - p1x) * k
    const cp2y = p2y - (p3y - p1y) * k

    out.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2x} ${p2y}`)
  }

  if (closed) out.push('Z')
  return out.join(' ')
}



// Returns the closest point on the segment AB to point P
export const getClosestPointOnSegment = (p: Point, a: Point, b: Point): Point => {
  const atob = { x: b.x - a.x, y: b.y - a.y }
  const atop = { x: p.x - a.x, y: p.y - a.y }
  const len2 = atob.x * atob.x + atob.y * atob.y
  if (len2 === 0) return a
  let t = (atop.x * atob.x + atop.y * atob.y) / len2
  t = Math.min(1, Math.max(0, t))
  return {
    x: a.x + t * atob.x,
    y: a.y + t * atob.y
  }
}

// Returns the index of the segment (starting point index) and the point on that segment
export const getClosestPointOnPolyline = (p: Point, points: number[]): { index: number, point: Point, distance: number } | null => {
  if (points.length < 4) return null
  let minDist = Infinity
  let result = null

  for (let i = 0; i < points.length - 2; i += 2) {
    const a = { x: points[i], y: points[i + 1] }
    const b = { x: points[i + 2], y: points[i + 3] }
    const closest = getClosestPointOnSegment(p, a, b)
    const dist = Math.hypot(p.x - closest.x, p.y - closest.y)
    if (dist < minDist) {
      minDist = dist
      result = { index: i, point: closest, distance: dist }
    }
  }
  return result
}
