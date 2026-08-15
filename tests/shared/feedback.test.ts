// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { motionEnabled, flashElement, viewEnter, undoToast } from '../../src/shared/ui/components/feedback'

/**
 * Layer condiviso di micro-interazioni.
 * motionEnabled() rispetta sia il toggle utente (data-motion) sia
 * prefers-reduced-motion di sistema; flashElement/viewEnter sono no-op
 * quando le animazioni sono disattivate.
 */

afterEach(() => {
  document.documentElement.removeAttribute('data-motion')
})

function mount(): HTMLElement {
  document.body.innerHTML = '<div id="el"></div>'
  return document.getElementById('el') as HTMLElement
}

describe('motionEnabled', () => {
  it('è true di default (nessun data-motion, matchMedia assente in jsdom)', () => {
    expect(motionEnabled()).toBe(true)
  })

  it('è false quando data-motion="reduced"', () => {
    document.documentElement.dataset.motion = 'reduced'
    expect(motionEnabled()).toBe(false)
  })
})

describe('flashElement', () => {
  it('aggiunge la classe ehb-flash', () => {
    const el = mount()
    flashElement(el)
    expect(el.classList.contains('ehb-flash')).toBe(true)
  })

  it('la rimuove al termine dell\'animazione', () => {
    const el = mount()
    flashElement(el)
    const ev = Object.assign(new Event('animationend'), { animationName: 'ehb-flash' })
    el.dispatchEvent(ev)
    expect(el.classList.contains('ehb-flash')).toBe(false)
  })

  it('non fa nulla se le animazioni sono disattivate', () => {
    document.documentElement.dataset.motion = 'reduced'
    const el = mount()
    flashElement(el)
    expect(el.classList.contains('ehb-flash')).toBe(false)
  })

  it('non lancia se el è null', () => {
    expect(() => flashElement(null)).not.toThrow()
  })
})

describe('viewEnter', () => {
  it('aggiunge la classe ehb-view-enter', () => {
    const el = mount()
    viewEnter(el)
    expect(el.classList.contains('ehb-view-enter')).toBe(true)
  })

  it('non fa nulla se le animazioni sono disattivate', () => {
    document.documentElement.dataset.motion = 'reduced'
    const el = mount()
    viewEnter(el)
    expect(el.classList.contains('ehb-view-enter')).toBe(false)
  })

  it('non lancia se el è null', () => {
    expect(() => viewEnter(null)).not.toThrow()
  })
})

describe('undoToast', () => {
  afterEach(() => {
    document.querySelectorAll('.ehb-toast--undo').forEach(el => el.remove())
  })

  it('mostra il messaggio e un bottone Annulla', () => {
    undoToast('Voce rimossa', () => {})
    const t = document.querySelector('.ehb-toast--undo')
    expect(t?.textContent).toContain('Voce rimossa')
    expect(t?.querySelector('.ehb-toast__undo')?.textContent).toBe('Annulla')
  })

  it('chiama onUndo SOLO al click su Annulla', () => {
    const onUndo = vi.fn()
    undoToast('Voce rimossa', onUndo)
    document.querySelector<HTMLButtonElement>('.ehb-toast__undo')?.click()
    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('rimuove il toast dal DOM dopo il click su Annulla', () => {
    undoToast('Voce rimossa', () => {})
    document.querySelector<HTMLButtonElement>('.ehb-toast__undo')?.click()
    expect(document.querySelector('.ehb-toast--undo')).toBeNull()
  })

  it('non chiama onUndo se scade senza click (fake timers)', () => {
    vi.useFakeTimers()
    const onUndo = vi.fn()
    undoToast('Voce rimossa', onUndo, { duration: 1000 })
    vi.advanceTimersByTime(1001)
    expect(onUndo).not.toHaveBeenCalled()
    expect(document.querySelector('.ehb-toast--undo')).toBeNull()
    vi.useRealTimers()
  })
})
