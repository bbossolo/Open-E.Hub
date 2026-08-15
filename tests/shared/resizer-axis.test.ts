// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { makeResizer } from '../../src/shared/ui/components/resizer'

// jsdom 29 non sempre espone localStorage: shim minimale (come collapse.test.ts).
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>()
  ;(globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
}

/**
 * Resizer condiviso — asse verticale (additivo).
 *
 * `axis: 'y'` è stato aggiunto per il dock della selezione di μ. Questi test
 * presidiano due cose: che l'asse orizzontale — usato dai tool per sidebar e
 * pannelli — resti il DEFAULT e si comporti come prima, e che il verticale
 * faccia i conti sull'asse giusto.
 */

const drag = (handle: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }): void => {
  handle.dispatchEvent(new MouseEvent('mousedown', { clientX: from.x, clientY: from.y, bubbles: true }))
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: to.x, clientY: to.y, bubbles: true }))
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
}

const varOf = (name: string): string => document.documentElement.style.getPropertyValue(name)

beforeEach(() => {
  document.documentElement.style.cssText = ''
  document.body.innerHTML = '<div id="panel"></div><div id="handle"></div>'
  localStorage.clear()
})

describe('asse x — il comportamento storico non cambia', () => {
  it("senza `axis` si ridimensiona in larghezza, e 'left' cresce trascinando a destra", () => {
    const handle = document.getElementById('handle')!
    makeResizer(handle, { cssVar: '--w', side: 'left', min: 100, max: 600 })
    document.documentElement.style.setProperty('--w', '200px')
    drag(handle, { x: 200, y: 0 }, { x: 260, y: 999 }) // il movimento verticale è ignorato
    expect(varOf('--w')).toBe('260px')
  })
})

describe("asse y — 'right' = maniglia sopra il pannello", () => {
  it('trascinare in su fa crescere il pannello, in giù lo fa calare', () => {
    const handle = document.getElementById('handle')!
    makeResizer(handle, { cssVar: '--h', side: 'right', axis: 'y', min: 50, max: 500 })
    document.documentElement.style.setProperty('--h', '120px')
    drag(handle, { x: 0, y: 300 }, { x: 999, y: 260 }) // 40px in su
    expect(varOf('--h')).toBe('160px')

    document.documentElement.style.setProperty('--h', '120px')
    drag(handle, { x: 0, y: 300 }, { x: 0, y: 330 }) // 30px in giù
    expect(varOf('--h')).toBe('90px')
  })

  it('resta dentro min/max e persiste la misura sotto la chiave data', () => {
    const handle = document.getElementById('handle')!
    makeResizer(handle, { cssVar: '--h', side: 'right', axis: 'y', min: 56, max: 300, storageKey: 'k:h' })
    document.documentElement.style.setProperty('--h', '120px')
    drag(handle, { x: 0, y: 300 }, { x: 0, y: 900 }) // ben oltre il minimo
    expect(varOf('--h')).toBe('56px')
    expect(localStorage.getItem('k:h')).toBe('56')

    drag(handle, { x: 0, y: 300 }, { x: 0, y: -900 }) // ben oltre il massimo
    expect(varOf('--h')).toBe('300px')
  })

  it('il doppio clic riporta al default del CSS e dimentica la misura salvata', () => {
    const handle = document.getElementById('handle')!
    makeResizer(handle, { cssVar: '--h', side: 'right', axis: 'y', storageKey: 'k:h' })
    document.documentElement.style.setProperty('--h', '200px')
    localStorage.setItem('k:h', '200')
    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(varOf('--h')).toBe('')
    expect(localStorage.getItem('k:h')).toBeNull()
  })
})
