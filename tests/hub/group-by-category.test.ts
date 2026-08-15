import { describe, it, expect } from 'vitest'
import { APP_REGISTRY, groupByCategory, CATEGORY_ORDER } from '../../src/hub/data/registry'

/**
 * Raggruppamento tematico dei tool nell'hub: Computo metrico (μ),
 * Documentazione (δ·β), Strumenti DXF (χ), Amministrazione (α). Ordine
 * coerente, ricerca/filtro trasversale. Helper PURO — opera sul registry
 * GREZZO (non filtrato per visibilità: quello è compito di isToolVisible/
 * enabledApps, non di groupByCategory).
 * Open E.Hub v1 comprende 5 tool: α·μ·β·δ·χ — γ/π/η/λ/κ/τ/σ non fanno parte
 * di questo prodotto (nessuna voce di registro).
 */
describe('groupByCategory', () => {
  it('ogni tool ha una categoria valida', () => {
    for (const a of APP_REGISTRY) expect(CATEGORY_ORDER).toContain(a.category)
  })
  it('raggruppa in Computo metrico (μ), Documentazione (δ·β), Strumenti DXF (χ) e Amministrazione (α), in ordine', () => {
    // L'ordine DENTRO ogni gruppo è quello di APP_REGISTRY: groupByCategory lo preserva, ed è
    // lì che si decide come appaiono le card. Questo test è la sentinella di quella scelta —
    // un riordino accidentale della lista cambierebbe l'hub senza che nessuno se ne accorga.
    const g = groupByCategory(APP_REGISTRY)
    expect(g.map(x => x.key)).toEqual(['calcolo-prezzi', 'documenti-commessa', 'strumenti-dxf', 'amministrazione'])
    expect(g[0].apps.map(a => a.id)).toEqual(['miu-price-list'])
    expect(g[1].apps.map(a => a.id)).toEqual(['delta-pages', 'beta-contabilita'])
    expect(g[2].apps.map(a => a.id)).toEqual(['chi-refs'])
    expect(g[3].apps.map(a => a.id)).toEqual(['alfa-control-center'])
    expect(g[0].label).toBe('Computo metrico')
    expect(g[1].label).toBe('Documentazione')
    expect(g[2].label).toBe('Strumenti DXF')
    expect(g[3].label).toBe('Amministrazione')
  })
  it('i gruppi vuoti (dopo un filtro) sono omessi — ricerca trasversale', () => {
    const onlyChi = groupByCategory(APP_REGISTRY.filter(a => a.id === 'chi-refs'))
    expect(onlyChi).toHaveLength(1)
    expect(onlyChi[0].key).toBe('strumenti-dxf')
  })
})
