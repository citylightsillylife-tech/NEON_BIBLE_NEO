export const isTyping = () => {
    const el = document.activeElement as HTMLElement | null
    if (!el) return false
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (el.closest?.('[contenteditable="true"]')) return true
    return false
}
