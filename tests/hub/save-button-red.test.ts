import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * «Salva progetto» = pulsante hub-only con accento ROSSO (puntino del
 * logo). Contenuto NERO su rosso (mai icona grigia illeggibile); a riposo themed.
 */

const css = readFileSync(resolve(__dirname, '../../src/hub/styles/hub.css'), 'utf8')

describe('Salva rosso, contrasto sicuro', () => {
  it('definisce il token rosso hub + inchiostro scuro', () => {
    expect(css).toMatch(/--hub-red:\s*#e5484d/)
    expect(css).toMatch(/--hub-red-ink:\s*#15171c/)
  })

  it('lo stato dirty è rosso pieno con inchiostro (niente più ambra)', () => {
    expect(css).toMatch(/\.js-save-project\.dirty\{[^}]*background:var\(--hub-red\)/)
    expect(css).toMatch(/\.js-save-project\.dirty\{[^}]*color:var\(--hub-red-ink\)/)
    // niente più i vecchi colori ambra
    expect(css).not.toContain('#f5a623')
    expect(css).not.toContain('#e0951c')
  })

  it('l\'icona su rosso è inchiostro (non grigia): sidebar e app-bar', () => {
    expect(css).toMatch(/\.side-proj-btn\.js-save-project\.dirty svg\{color:var\(--hub-red-ink\)/)
    expect(css).toMatch(/\.js-save-project\.dirty svg\{color:var\(--hub-red-ink\)/)
  })

  it('a riposo l\'icona è rossa (accento) in entrambi i contesti', () => {
    expect(css).toMatch(/\.side-proj-btn\.js-save-project svg\{color:var\(--hub-red\)/)
    expect(css).toMatch(/\.proj-act\.js-save-project svg\{color:var\(--hub-red\)/)
  })
})
