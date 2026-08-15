// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { makeCollapse, makeAccordion } from '../../src/shared/ui/components/collapse'

// jsdom 29 non sempre espone localStorage: shim minimale per i test di persistenza.
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
 * Componente sidebar comprimibile unico (makeCollapse).
 * Contratto condiviso adottato dai tool con sidebar: toggle/set, classe di stato,
 * persistenza su storageKey, restore al boot, onChange, wiring di toggleEl.
 */
function mount(): { panel: HTMLElement; btn: HTMLElement } {
  document.body.innerHTML = '<div id="panel"></div><button id="btn"></button>'
  return {
    panel: document.getElementById('panel') as HTMLElement,
    btn: document.getElementById('btn') as HTMLElement,
  }
}

describe('makeCollapse', () => {
  beforeEach(() => localStorage.clear())

  it('toggle aggiunge e rimuove la classe collapsed', () => {
    const { panel } = mount()
    const h = makeCollapse(panel, null)
    expect(panel.classList.contains('collapsed')).toBe(false)
    h.toggle()
    expect(panel.classList.contains('collapsed')).toBe(true)
    expect(h.isCollapsed()).toBe(true)
    h.toggle()
    expect(panel.classList.contains('collapsed')).toBe(false)
  })

  it('set è idempotente', () => {
    const { panel } = mount()
    const h = makeCollapse(panel, null)
    h.set(true)
    h.set(true)
    expect(panel.classList.contains('collapsed')).toBe(true)
    h.set(false)
    h.set(false)
    expect(panel.classList.contains('collapsed')).toBe(false)
  })

  it('persiste lo stato su storageKey (1/0)', () => {
    const { panel } = mount()
    const h = makeCollapse(panel, null, { storageKey: 'k:test' })
    h.set(true)
    expect(localStorage.getItem('k:test')).toBe('1')
    h.set(false)
    expect(localStorage.getItem('k:test')).toBe('0')
  })

  it('ripristina lo stato collassato al boot quando la chiave è 1', () => {
    const { panel } = mount()
    localStorage.setItem('k:test', '1')
    makeCollapse(panel, null, { storageKey: 'k:test' })
    expect(panel.classList.contains('collapsed')).toBe(true)
  })

  it('non collassa al boot quando la chiave è 0/assente', () => {
    const { panel } = mount()
    localStorage.setItem('k:test', '0')
    makeCollapse(panel, null, { storageKey: 'k:test' })
    expect(panel.classList.contains('collapsed')).toBe(false)
  })

  it('invoca onChange ad ogni cambio col nuovo stato', () => {
    const { panel } = mount()
    const seen: boolean[] = []
    const h = makeCollapse(panel, null, { onChange: (c) => seen.push(c) })
    h.toggle()
    h.toggle()
    expect(seen).toEqual([true, false])
  })

  it('cabla toggleEl: il click comprime/espande', () => {
    const { panel, btn } = mount()
    makeCollapse(panel, btn)
    btn.click()
    expect(panel.classList.contains('collapsed')).toBe(true)
    btn.click()
    expect(panel.classList.contains('collapsed')).toBe(false)
  })

  it('rispetta una collapsedClass personalizzata', () => {
    const { panel } = mount()
    const h = makeCollapse(panel, null, { collapsedClass: 'mine' })
    h.set(true)
    expect(panel.classList.contains('mine')).toBe(true)
    expect(panel.classList.contains('collapsed')).toBe(false)
  })

  it('ritorna un handle no-op se il pannello è null', () => {
    const h = makeCollapse(null, null)
    expect(() => h.toggle()).not.toThrow()
    expect(h.isCollapsed()).toBe(false)
  })
})

/**
 * makeAccordion.onChange (estensione retro-compatibile).
 * Il callback è invocato al restore di boot e a ogni toggle col valore corretto;
 * l'assenza del callback non altera il comportamento esistente.
 */
function mountAccordion(): { header: HTMLElement; body: HTMLElement } {
  document.body.innerHTML = '<div id="head"></div><div id="body"></div>'
  return {
    header: document.getElementById('head') as HTMLElement,
    body: document.getElementById('body') as HTMLElement,
  }
}

describe('makeAccordion.onChange', () => {
  beforeEach(() => localStorage.clear())

  it('invoca onChange ad ogni toggle col nuovo stato', () => {
    const { header, body } = mountAccordion()
    const seen: boolean[] = []
    makeAccordion(header, body, { onChange: (c) => seen.push(c) })
    header.click() // collassa
    header.click() // espande
    expect(seen).toEqual([true, false])
  })

  it('invoca onChange al restore di boot quando la chiave è 1', () => {
    const { header, body } = mountAccordion()
    localStorage.setItem('acc:test', '1')
    const seen: boolean[] = []
    makeAccordion(header, body, { storageKey: 'acc:test', onChange: (c) => seen.push(c) })
    expect(seen).toEqual([true])
    expect(body.style.display).toBe('none')
  })

  it('non invoca onChange al boot quando la chiave è 0/assente', () => {
    const { header, body } = mountAccordion()
    const seen: boolean[] = []
    makeAccordion(header, body, { storageKey: 'acc:test', onChange: (c) => seen.push(c) })
    expect(seen).toEqual([])
  })

  it('senza onChange il comportamento resta invariato (retro-compatibile)', () => {
    const { header, body } = mountAccordion()
    expect(() => makeAccordion(header, body)).not.toThrow()
    header.click()
    expect(header.classList.contains('acc-collapsed')).toBe(true)
    expect(body.style.display).toBe('none')
    header.click()
    expect(header.classList.contains('acc-collapsed')).toBe(false)
    expect(body.style.display).toBe('')
  })
})
