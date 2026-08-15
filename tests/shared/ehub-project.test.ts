import { describe, it, expect } from 'vitest'
import { bundleEhubProject, parseEhubProject, ehubProjectToolCount, EHUB_PROJECT_KIND } from '../../src/shared/ehub-project'

/** Progetto Open E.Hub: contenitore dello stato di tutti i tool (.ehub). */

const NOW = 1_700_000_000_000

describe('bundleEhubProject', () => {
  it('costruisce il contenitore con kind/versione/ts e stati dei tool', () => {
    const b = bundleEhubProject({ 'gamma': { v: 5 }, 'miu-price-list': { sel: ['a'] } }, { now: NOW, name: 'Cantiere X' })
    expect(b.kind).toBe(EHUB_PROJECT_KIND)
    expect(b.v).toBe(1)
    expect(b.ts).toBe(NOW)
    expect(b.name).toBe('Cantiere X')
    expect(ehubProjectToolCount(b)).toBe(2)
  })

  it('scarta gli stati null/undefined', () => {
    const b = bundleEhubProject({ 'gamma': { v: 5 }, 'tau-documenti': null as unknown as object }, { now: NOW })
    expect(ehubProjectToolCount(b)).toBe(1)
    expect('tau-documenti' in b.tools).toBe(false)
  })
})

describe('parseEhubProject', () => {
  it('roundtrip bundle → JSON → parse', () => {
    const b = bundleEhubProject({ 'gamma': { v: 5, circuits: [] } }, { now: NOW })
    const parsed = parseEhubProject(JSON.stringify(b))
    expect(parsed).toEqual(b)
  })

  it('accetta un oggetto già parsato', () => {
    const parsed = parseEhubProject({ tools: { 'miu-price-list': { sel: [] } } })
    expect(ehubProjectToolCount(parsed)).toBe(1)
    expect(parsed.kind).toBe(EHUB_PROJECT_KIND)
  })

  it('rifiuta JSON malformato', () => {
    expect(() => parseEhubProject('{not json')).toThrow(/JSON malformato/)
  })

  it('rifiuta un kind sbagliato', () => {
    expect(() => parseEhubProject({ kind: 'qualcosaltro', tools: {} })).toThrow(/Non è un progetto Open E\.Hub/)
  })

  it('rifiuta l\'assenza di tools', () => {
    expect(() => parseEhubProject({ kind: EHUB_PROJECT_KIND })).toThrow(/privo di stati/)
  })
})

describe('planimetria UNICA di Progetto nel .ehub (additiva)', () => {
  const sharedPlan = {
    dxf: { ref: '/Users/x/pianta.dxf', name: 'pianta.dxf', ts: NOW },
    cavidotti: [{ id: 'gamma:CC01', origin: 'gamma', pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    circuiti: [{ id: 'pi:C01', origin: 'gamma', pts: [{ x: 0, y: 0 }, { x: 2, y: 2 }], kind: 'circuit' }],
  }

  it('bundle include sharedPlan solo se non vuota; roundtrip JSON preservato', () => {
    const b = bundleEhubProject({ 'gamma': { v: 5 } }, { now: NOW, sharedPlan })
    expect(b.sharedPlan).toEqual(sharedPlan)
    expect(parseEhubProject(JSON.stringify(b))).toEqual(b)
  })

  it('una planimetria condivisa VUOTA non aggiunge il campo (niente rumore)', () => {
    const b = bundleEhubProject({ 'gamma': { v: 5 } }, { now: NOW, sharedPlan: { dxf: null, cavidotti: [], circuiti: [] } })
    expect('sharedPlan' in b).toBe(false)
  })

  it('un .ehub LEGACY senza sharedPlan resta valido (campo assente)', () => {
    const parsed = parseEhubProject({ kind: EHUB_PROJECT_KIND, v: 1, tools: { 'gamma': { v: 5 } } })
    expect('sharedPlan' in parsed).toBe(false)
    expect(ehubProjectToolCount(parsed)).toBe(1)
  })

  it('parse normalizza una sharedPlan sporca (liste mancanti → vuote)', () => {
    const parsed = parseEhubProject({ kind: EHUB_PROJECT_KIND, tools: {}, sharedPlan: { dxf: { text: 'X', name: 'a', ts: 1 } } })
    // il DXF grezzo dei file vecchi si scarta: della planimetria resta l'identità
    expect(parsed.sharedPlan).toEqual({ dxf: { name: 'a', ts: 1 }, cavidotti: [], circuiti: [] })
  })

  it('XREF: i byte del DXF NON finiscono nel file (solo il riferimento)', () => {
    const b = bundleEhubProject({ 'gamma': { v: 5 } }, { now: NOW, sharedPlan: {
      dxf: { ref: '/Users/x/pianta.dxf', name: 'pianta.dxf', ts: NOW, size: 53_000_000 },
      cavidotti: [], circuiti: [],
    } })
    expect(b.sharedPlan!.dxf).toEqual({ ref: '/Users/x/pianta.dxf', name: 'pianta.dxf', ts: NOW, size: 53_000_000 })
    expect('text' in (b.sharedPlan!.dxf as object)).toBe(false)
    // roundtrip JSON preserva il riferimento (senza byte)
    expect(parseEhubProject(JSON.stringify(b)).sharedPlan!.dxf).toEqual({ ref: '/Users/x/pianta.dxf', name: 'pianta.dxf', ts: NOW, size: 53_000_000 })
  })

  it('un .ehub vecchio col DXF grezzo dentro: il testo si scarta, il riferimento resta', () => {
    const vecchio = JSON.stringify({ ...bundleEhubProject({ 'gamma': { v: 5 } }, { now: NOW, sharedPlan: {
      dxf: { ref: '/Users/x/p.dxf', name: 'p.dxf', ts: NOW }, cavidotti: [], circuiti: [],
    } }), sharedPlan: { dxf: { ref: '/Users/x/p.dxf', name: 'p.dxf', ts: NOW, text: 'X'.repeat(100000) }, cavidotti: [], circuiti: [] } })
    const dxf = parseEhubProject(vecchio).sharedPlan!.dxf as unknown as Record<string, unknown>
    expect(dxf).toEqual({ ref: '/Users/x/p.dxf', name: 'p.dxf', ts: NOW })
    expect('text' in dxf).toBe(false)
  })
})
