import { Line } from 'react-konva'
import { useNeonStore } from '@/store/useNeonStore'
import { useShallow } from 'zustand/react/shallow'

type Props = {
    previewPoint: { x: number; y: number } | null
}

export const HelperLine = ({ previewPoint }: Props) => {
    // Use shallow selector to prevent unnecessary re-renders, though here we want reactivity
    const { activePathId, neonPaths } = useNeonStore(
        useShallow((state) => ({
            activePathId: state.activePathId,
            neonPaths: state.neonPaths,
        }))
    )

    if (!activePathId || !previewPoint) return null

    const activePath = neonPaths.find((p) => p.id === activePathId)
    if (!activePath || activePath.points.length < 2) return null

    const len = activePath.points.length
    const lastX = activePath.points[len - 2]
    const lastY = activePath.points[len - 1]

    return (
        <Line
            points={[lastX, lastY, previewPoint.x, previewPoint.y]}
            stroke="#FFFFFF"
            strokeWidth={2}
            dash={[5, 5]}
            opacity={0.8}
            listening={false}
        />
    )
}
