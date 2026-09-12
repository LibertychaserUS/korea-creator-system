import { describe, expect, it } from 'vitest'
import { applyDocumentTheme } from '../utils/theme'

/**
 * Break: 深色/浅色 chrome writes a class that color-mode can immediately overwrite.
 */
describe('document theme class', () => {
  it('replaces light with dark on the root element', () => {
    const classes = new Set(['light'])
    const root = {
      classList: {
        remove: (...tokens: string[]) => tokens.forEach((token) => classes.delete(token)),
        add: (...tokens: string[]) => tokens.forEach((token) => classes.add(token)),
      },
      attrs: {} as Record<string, string>,
      setAttribute(name: string, value: string) {
        this.attrs[name] = value
      },
    }
    applyDocumentTheme(root, 'dark')
    expect([...classes]).toEqual(['dark'])
    expect(root.attrs['data-theme']).toBe('dark')
  })
})
