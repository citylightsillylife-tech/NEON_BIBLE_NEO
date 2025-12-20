import type { FC } from 'react'

const Footer: FC = () => {
    return (
        <footer className="border-t border-border bg-[#0a0a12]/70 py-3 text-center">
            <p className="text-xs text-muted-foreground">
                © 2025 NEON_BIBLE Project. All rights reserved. Licensed under the{' '}
                <a
                    href="https://opensource.org/licenses/MIT"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 underline"
                >
                    MIT License
                </a>
            </p>
        </footer>
    )
}

export default Footer
