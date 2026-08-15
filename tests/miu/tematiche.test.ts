import { describe, it, expect } from 'vitest'
import { classifyTematica, TEMATICHE, TEMA_ALTRO } from '../../src/shared/compositore/tematiche'

/**
 * NOTA (Open E.Hub): questo file un tempo asseriva mapping disciplina→tematica
 * specifici (Basilicata/Lombardia). Quel vocabolario è contenuto proprietario
 * del catalogo, risolto da `compositore-catalog:tematiche` — in questa
 * distribuzione lo stub è vuoto per design (vedi
 * src/shared/compositore/catalog-data-empty.ts: RULES_DATA=[], TEMATICHE_DATA=[]).
 * Con RULES vuoto nessuna regola combacia mai: resta solo il comportamento di
 * fallback, che è logica pura di `classifyTematica` e non dipende dai dati del
 * catalogo (TEMA_ALTRO è una costante, non sourced da RULES_DATA/TEMATICHE_DATA).
 */
describe('classifyTematica — fallback (logica pura, indipendente dal catalogo)', () => {
  it('nessuna regola disponibile → cade sempre su TEMA_ALTRO', () => {
    expect(classifyTematica({ disciplina: 'XYZ SCONOSCIUTO' })).toBe(TEMA_ALTRO)
    expect(classifyTematica({})).toBe(TEMA_ALTRO)
    expect(classifyTematica({ disciplina: 'NOLEGGI', desc_short: 'qualsiasi cosa' })).toBe(TEMA_ALTRO)
  })
  it('il fallback è sempre coerente con l’elenco ufficiale (anche vuoto)', () => {
    const t = classifyTematica({ disciplina: 'NOLEGGI' })
    expect(TEMATICHE.includes(t) || t === TEMA_ALTRO).toBe(true)
  })
})
