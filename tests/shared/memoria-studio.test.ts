import { describe, it, expect } from 'vitest'
import { PARTI, chiaveDi, parteDi, inventario, esporta, valida, anteprima, importa, catalogoCsv } from '../../src/shared/memoria-studio'
import type { Store, MemoriaStudio } from '../../src/shared/memoria-studio'

function storeFinto(dati: Record<string, string> = {}): Store & { dati: Record<string, string> } {
  return { dati, getItem: k => (k in dati ? dati[k] : null), setItem: (k, v) => { dati[k] = v } }
}
const leggi = (s: { dati: Record<string, string> }, k: string) => JSON.parse(s.dati[k])

describe('memoria dello studio — cosa è conoscenza e cosa no', () => {
  it('le PREFERENZE non sono memoria: non si esportano', () => {
    const chiavi = PARTI.map(p => p.chiave)
    // tema, vista, sidebar: sono abitudini di una persona su una macchina, non sapere dello
    // studio. Portarsele dietro imporrebbe al collega la propria interfaccia col proprio sapere.
    for (const k of ['miu:rail-slim', 'miu:tipopanel-collapsed', 'miu:sidebar-collapsed', 'hub:auth']) {
      expect(chiavi).not.toContain(k)
    }
  })

  it('il catalogo è compartimentato per studio: ognuno esporta il SUO', () => {
    const cat = parteDi('catalogo-voci')!
    expect(chiaveDi(cat, 'studio-a')).toBe('ehub:catalogo-voci:studio-a')
    expect(chiaveDi(cat, null)).toBe('ehub:catalogo-voci:anon')
    // le parti non compartimentate restano com'erano
    expect(chiaveDi(parteDi('libreria-voci')!, 'studio-a')).toBe('miu:libreria')
  })
})

describe('memoria — esporta ciò che c\'è, non ciò che potrebbe esserci', () => {
  const store = storeFinto({
    'ehub:catalogo-voci:studio-a': JSON.stringify({ v: 1, voci: { 'PR_PRESA@ELE-FM': { tipo: 'prezzario', codice: '15.3.2' } } }),
    'chi:profili:studio-a': JSON.stringify({ 'Studio Rossi': { layer: 'A-MURI' } }),
    'miu:libreria': JSON.stringify([{ id: 'v1', nome: 'Plafoniera speciale', analisiPrezzi: { totale: 42 } }]),
    'miu:catdb': JSON.stringify({ sp: ['Edificio A'], cat: ['Impianti elettrici'], sb: [] }),
  })

  it('l\'inventario dice quanto sa questa macchina', () => {
    const inv = inventario(store, 'studio-a')
    const m = Object.fromEntries(inv.map(x => [x.parte.id, x.n]))
    expect(m['catalogo-voci']).toBe(1)
    expect(m['profili-collaboratori']).toBe(1)
    expect(m['libreria-voci']).toBe(1)
    expect(m['categorie']).toBe(2)      // gli elementi dei rami, non i rami
  })

  it('una parte mai usata su questa macchina conta zero, e si vede', () => {
    const store2 = storeFinto({})
    const inv = inventario(store2, 'studio-a')
    const m = Object.fromEntries(inv.map(x => [x.parte.id, x.n]))
    expect(m['catalogo-voci']).toBe(0)
  })

  it('le parti VUOTE non finiscono nel file (sarebbero rumore)', () => {
    const store2 = storeFinto({
      'ehub:catalogo-voci:studio-a': JSON.stringify({ v: 1, voci: { 'PR_PRESA@ELE-FM': { tipo: 'prezzario', codice: '15.3.2' } } }),
    })
    const dump = esporta(store2, { companyId: 'studio-a', studio: 'Studio Demo' })
    expect(Object.keys(dump.parti)).not.toContain('libreria-voci')
    expect(dump.schema).toBe('ehub/memoria-studio@1')
    expect(dump.studio).toBe('Studio Demo')
  })

  it('si può esportare una parte sola (le Analisi Prezzi, il catalogo…)', () => {
    const dump = esporta(store, { companyId: 'studio-a', parti: ['libreria-voci'] })
    expect(Object.keys(dump.parti)).toEqual(['libreria-voci'])
    // e l'Analisi Prezzi ci viaggia dentro, che è il punto
    expect((dump.parti['libreria-voci'] as any[])[0].analisiPrezzi.totale).toBe(42)
  })
})

describe('memoria — importare UNISCE, non cancella', () => {
  const file: MemoriaStudio = {
    schema: 'ehub/memoria-studio@1',
    studio: 'Studio Demo',
    esportata: '2026-07-11T00:00:00.000Z',
    parti: {
      'profili-collaboratori': { 'ARCH': { layer: 'A-MURI' }, 'STRUT': { layer: 'S-PIL' } },
      'libreria-voci': [{ id: 'v1', nome: 'dal collega' }],
    },
  }

  it('il collega AGGIUNGE, non sovrascrive: il mio lavoro resta', () => {
    const store = storeFinto({
      'chi:profili:studio-a': JSON.stringify({ 'ARCH': { layer: 'A-DIVERSO' } }), // io avevo deciso DIVERSAMENTE
      'miu:libreria': JSON.stringify([{ id: 'v0', nome: 'mia' }]),
    })
    importa(store, file, { companyId: 'studio-a' })

    // la MIA decisione su ARCH vince: una decisione presa non si scavalca in silenzio
    expect(leggi(store, 'chi:profili:studio-a')['ARCH'].layer).toBe('A-DIVERSO')
    // ...ma quello che non avevo, arriva
    expect(leggi(store, 'chi:profili:studio-a')['STRUT'].layer).toBe('S-PIL')
    // la libreria tiene entrambe le voci
    expect(leggi(store, 'miu:libreria').map((v: any) => v.id).sort()).toEqual(['v0', 'v1'])
  })

  it('«sostituisci» esiste, ma va chiesto: è l\'eccezione', () => {
    const store = storeFinto({ 'chi:profili:studio-a': JSON.stringify({ 'ARCH': { layer: 'A-DIVERSO' } }) })
    importa(store, file, { companyId: 'studio-a', modo: 'sostituisci' })
    expect(leggi(store, 'chi:profili:studio-a')['ARCH'].layer).toBe('A-MURI')
  })

  it('si guarda PRIMA di importare: quante voci, e di che tipo', () => {
    const a = anteprima(file)
    const m = Object.fromEntries(a.map(x => [x.parte.id, x.n]))
    expect(m['profili-collaboratori']).toBe(2)
    expect(m['libreria-voci']).toBe(1)
  })

  it('un file che non è una memoria non può toccare nulla', () => {
    expect(valida({ pippo: 1 })).toBe(false)
    expect(valida(null)).toBe(false)
    expect(valida(file)).toBe(true)
  })

  it('una parte SCONOSCIUTA (file di una versione futura) si salta, non rompe', () => {
    const store = storeFinto()
    const futuro = { ...file, parti: { ...file.parti, 'roba-del-2030': { x: 1 } } } as MemoriaStudio
    const esiti = importa(store, futuro, { companyId: 'studio-a' })
    expect(esiti.map(e => e.parte.id)).not.toContain('roba-del-2030')
    expect(esiti.length).toBe(2) // le due parti note sono entrate lo stesso
  })
})

describe('memoria — il catalogo in CSV, per VERIFICARLO', () => {
  it('una riga per blocco: nome, layer, tipo, codice, descrizione', () => {
    const csv = catalogoCsv({
      v: 1,
      voci: {
        'PR_PRESA@ELE-FM': { tipo: 'prezzario', codice: '15.3.2', desc: 'Presa 2P+T 16A' },
        'PL_SPECIALE@ELE-ILL': { tipo: 'composta', famigliaId: 'plafoniera-interno', desc: 'Plafoniera su misura' },
      },
    })
    const righe = csv.split('\n')
    expect(righe[0]).toBe('blocco;layer;tipo;codice_o_famiglia;descrizione')
    expect(righe).toContain('PR_PRESA;ELE-FM;prezzario;15.3.2;Presa 2P+T 16A')
    expect(righe).toContain('PL_SPECIALE;ELE-ILL;composta;plafoniera-interno;Plafoniera su misura')
  })

  it('il punto e virgola dentro una descrizione non spacca il CSV', () => {
    const csv = catalogoCsv({ v: 1, voci: { 'X@Y': { tipo: 'prezzario', codice: '1', desc: 'presa; con nota' } } })
    expect(csv).toContain('"presa; con nota"')
  })
})
