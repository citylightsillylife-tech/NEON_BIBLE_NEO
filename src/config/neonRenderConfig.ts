/**
 * Neon Rendering Configuration
 * 
 * Defines the visual properties of the neon effect to ensure a "premium" and realistic look.
 * Centralizing these values allows for easy tuning of the "white balance" and glow spread
 * without hunting through component code.
 */

export const NEON_RENDER_CONFIG = {
    // === Core (The white hot center) ===
    core: {
        // Ratio of path width. 
        // Previous was 0.5. Reduced to 0.35 for a sharper, "hotter" look inside the glow.
        widthRatio: 0.35,
        stroke: '#FFFFFF',
        opacity: 1, // Keep core opaque
        // Soften the edge of the white core slightly so it doesn't look like vector art pasted on top
        shadowBlur: 5,
        shadowColor: '#FFFFFF',
    },

    // === Outer Glow (The colored atmosphere) ===
    glow: {
        // Layer 1: Inner intense glow (Mid-tone transition)
        inner: {
            widthRatio: 1.5, // 1.5x path width
            glowRatio: 0.2,  // + 20% of user-defined glow
            opacity: 0.7,    // High opacity for intensity
        },

        // Layer 2: Mid soft glow (Bridge)
        mid: {
            widthRatio: 3.0,
            glowRatio: 0.4,
            opacity: 0.4,
        },

        // Layer 3: Outer atmospheric haze
        outer: {
            widthRatio: 5.0, // Wide spread
            glowRatio: 0.8,  // Heavily influenced by user 'glow' setting
            opacity: 0.2,    // Subtle fade out
        },

        // Composition mode for glow blending
        compositeOperation: 'lighter' as const,
    }
}
