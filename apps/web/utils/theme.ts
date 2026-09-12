export type ThemeName = 'dark' | 'light'

export function applyDocumentTheme(
  root: {
    classList: { remove: (...tokens: string[]) => void; add: (...tokens: string[]) => void }
    setAttribute: (name: string, value: string) => void
  },
  next: ThemeName,
): void {
  root.classList.remove('light', 'dark')
  root.classList.add(next)
  root.setAttribute('data-theme', next)
}
