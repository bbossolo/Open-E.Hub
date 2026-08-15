import { describe, it, expect } from 'vitest'
import { appiattisci, type AnalisiDxf, type LayerTrovato } from '../../src/shared/dxf-import/analizza'
import { MANTIENI, SPEGNI } from '../../src/shared/xref/standard'
import type { RigaMappatura } from '../../src/shared/xref/suggerisci'
import {
  conPreset, costruisciPiano, OPZIONI_DEFAULT, rigaDaSuggerimento, riepiloga, type Riga,
} from '../../src/tools/chi/engine/piano'

/**
 * Il piano di χ Refs: da quello che l'utente ha fatto sullo schermo alle istruzioni per il
 * riscrittore.
 *
 * La regola che tiene in piedi la vista è qui: la colonna di sinistra è un **elenco da
 * svuotare**. Ogni layer del file deve finire da qualche parte — in un layer dello studio o
 * fra gli spenti — e uno lasciato a metà è lavoro non fatto, non una scelta.
 *
 * E su una base architettonica i protagonisti sono muri e arredi: la proposta automatica di
 * norma tiene solo quelli, il resto si spegne.
 */

const layer = (nome: string, nEntita = 100, nTesti = 0): LayerTrovato => ({
  nome, ...appiattisci(nome),
  colore: 7, spento: false, congelato: false, bloccato: false,
  linetype: 'Continuous', lineweight: -3,
  nEntita, nTesti, nInsert: 0, vuoto: nEntita === 0,
})

const riga = (nome: string, destinazione = '', nEntita = 100): Riga =>
  ({ layer: layer(nome, nEntita), destinazione, manuale: true })

const ANALISI = { handseed: 0x1000 } as AnalisiDxf

const sugg = (nome: string, destinazione: string): RigaMappatura => ({
  layer: layer(nome),
  suggerimento: { destinazione, confidenza: 0.9, motivo: '', regola: 'x' },
  destinazione, manuale: false,
})

/** Il layer 0 fuori dai blocchi va sempre in muratura di default: vedi la sua describe dedicata. */
const RINOMINA_LAYER_ZERO = { '0': 'MURATURA', '_0': 'MURATURA' }

describe('χ Refs · ogni layer deve finire da qualche parte', () => {
  it('un layer trasferito viene rinominato', () => {
    const p = costruisciPiano([riga('muri', 'MURATURA')], ANALISI)
    expect(p.rinomina).toEqual({ muri: 'MURATURA', ...RINOMINA_LAYER_ZERO })
    expect(p.spenti).toEqual([])
  })

  it('un layer messo fra gli spenti si spegne e non si rinomina', () => {
    const p = costruisciPiano([riga('ELE-FM_NORMALE', SPEGNI)], ANALISI)
    expect(p.rinomina).toEqual(RINOMINA_LAYER_ZERO)
    expect(p.spenti).toEqual(['ELE-FM_NORMALE'])
  })

  it('«mantieni» non è una destinazione: non entra mai nella rimappatura', () => {
    // Bug vero, trovato aprendo l'export in un CAD: `MANTIENI` finiva nella mappa di rinomina
    // come se fosse un posto dove mettere le cose, e da lì nell'header come nome del layer
    // corrente — il file usciva dichiarando attivo «*MANTIENI*», che non esiste. Sulla
    // logistica del fornitore trascinava con sé 1.067 entità dentro le definizioni dei blocchi.
    const p = costruisciPiano([riga('vecchio', MANTIENI), riga('altro', MANTIENI)], ANALISI)
    expect(p.rinomina).toEqual(RINOMINA_LAYER_ZERO)
    expect(p.spenti).toEqual([])
    expect(JSON.stringify(p)).not.toContain('MANTIENI')
  })

  it('un layer non ancora smistato non viene toccato: è lavoro che manca, non una scelta', () => {
    const p = costruisciPiano([riga('QUALCOSA', '')], ANALISI)
    expect(p.rinomina).toEqual(RINOMINA_LAYER_ZERO)
    expect(p.spenti).toEqual([])
    expect(riepiloga([riga('QUALCOSA', '')]).daDecidere).toBe(1)
  })
})

describe('χ Refs · di norma servono solo murature, strutture e arredi', () => {
  it('il preset essenziale spegne tutto ciò che non è architettonico o strutturale di base', () => {
    // Su una base architettonica l'xref serve a vedere dove sono i muri e cosa c'è dentro: le
    // quote di chi l'ha mandata, i suoi retini e i suoi cartigli non ci servono. Muratura e
    // strutture (travi) devono invece vedersi sempre, e con loro sanitari/arredi/testi.
    expect(conPreset('MURATURA', 'essenziale')).toBe('MURATURA')
    expect(conPreset('ARREDI', 'essenziale')).toBe('ARREDI')
    expect(conPreset('TESTI', 'essenziale')).toBe('TESTI')
    expect(conPreset('TRAVI', 'essenziale')).toBe('TRAVI')
    expect(conPreset('SANITARI', 'essenziale')).toBe('SANITARI')
    expect(conPreset('QUOTE', 'essenziale')).toBe(SPEGNI)
    expect(conPreset('RETINI accesi', 'essenziale')).toBe(SPEGNI)
  })

  it('la mappatura completa lascia passare tutto il vocabolario', () => {
    expect(conPreset('QUOTE', 'completo')).toBe('QUOTE')
    expect(conPreset('SANITARI', 'completo')).toBe('SANITARI')
  })

  it('«spegni» resta «spegni» in tutti e due i preset', () => {
    expect(rigaDaSuggerimento(sugg('cartiglio', SPEGNI), 'essenziale').destinazione).toBe(SPEGNI)
    expect(rigaDaSuggerimento(sugg('cartiglio', SPEGNI), 'completo').destinazione).toBe(SPEGNI)
  })
})

describe('χ Refs · il layer 0 fuori dai blocchi va in muratura', () => {
  it('rinomina sempre 0 e _0 su MURATURA, anche a righe vuote', () => {
    // Fuori da una definizione di blocco il layer 0 non protegge nessuna eredità ByBlock (quella
    // la protegge il motore di riscrittura, dentro BLOCKS): la geometria o gli INSERT lasciati
    // lì per disattenzione seguono le regole della muratura invece di restare sempre accesi.
    const p = costruisciPiano([], ANALISI)
    expect(p.rinomina).toEqual(RINOMINA_LAYER_ZERO)
    expect(p.tabella!.map(v => v.nome)).toEqual(['MURATURA'])
  })
})

describe('χ Refs · la tabella dei layer in uscita', () => {
  it('contiene solo i layer davvero usati', () => {
    // Crearli tutti e tredici su ogni file riempirebbe l'elenco di voci vuote.
    const p = costruisciPiano([riga('muri', 'MURATURA')], ANALISI)
    expect(p.tabella!.map(v => v.nome)).toEqual(['MURATURA'])
  })

  it('aggiunge TESTI quando i testi vanno preservati', () => {
    const r: Riga = { layer: layer('MURI P1', 100, 40), destinazione: 'MURATURA', manuale: true }
    const p = costruisciPiano([r], ANALISI, { ...OPZIONI_DEFAULT, preservaTesti: true })
    expect(p.tabella!.map(v => v.nome).sort()).toEqual(['MURATURA', 'TESTI'])
    expect(p.testiSu).toBe('TESTI')
  })

  it('accoglie un layer inventato dall’utente', () => {
    // Per un xref gli impianti altrui o si spengono o si raggruppano da qualche parte, e
    // «da qualche parte» spesso non è nello standard dello studio.
    const custom = [{ nome: 'X-IMPIANTI ALTRUI', aci: 9, linetype: 'Continuous' }]
    const p = costruisciPiano([riga('IE-FM', 'X-IMPIANTI ALTRUI')], ANALISI, OPZIONI_DEFAULT, custom)
    expect(p.rinomina).toEqual({ 'IE-FM': 'X-IMPIANTI ALTRUI', ...RINOMINA_LAYER_ZERO })
    expect(p.tabella!.find(v => v.nome === 'X-IMPIANTI ALTRUI')?.aci).toBe(9)
  })

  it('l’interruttore su un layer dello studio vale per questo file, non cambia lo standard', () => {
    const p = costruisciPiano([riga('QUOTE', 'QUOTE')], ANALISI, OPZIONI_DEFAULT, [], { 'QUOTE': false })
    expect(p.tabella!.find(v => v.nome === 'QUOTE')?.spento).toBe(false)
    // ...e senza istruzioni resta quello che dice lo standard (QUOTE nasce spento).
    const q = costruisciPiano([riga('QUOTE', 'QUOTE')], ANALISI)
    expect(q.tabella!.find(v => v.nome === 'QUOTE')?.spento).toBe(true)
  })
})

describe('χ Refs · il riepilogo dice cosa succederà', () => {
  it('distingue trasferiti, spenti e ancora da smistare', () => {
    const r = riepiloga([
      riga('muri', 'MURATURA', 500),
      riga('ARREDO', 'ARREDI', 300),
      riga('cartiglio', SPEGNI, 90),
      riga('boh', '', 10),
      { layer: layer('vuoto', 0), destinazione: '', manuale: false },
    ])
    expect(r.spostati).toBe(2)
    expect(r.entitaSpostate).toBe(800)
    expect(r.spenti).toBe(1)
    expect(r.daDecidere).toBe(1) // «boh»: ancora nell'elenco da svuotare
    expect(r.destinazioni[0]).toEqual({ nome: 'MURATURA', nLayer: 1, nEntita: 500 })
  })

  it('non conta i layer che nessuna entità usa', () => {
    const r = riepiloga([{ layer: layer('vuoto', 0), destinazione: '', manuale: false }])
    expect(r.spostati + r.spenti + r.daDecidere).toBe(0)
  })
})
