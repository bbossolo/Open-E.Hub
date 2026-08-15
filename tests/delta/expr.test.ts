import { describe, it, expect } from 'vitest'
import { resolveExpr, exprTokens, simpleExprParts } from '../../src/tools/delta/engine/expr'

// La riga di elenco che alimenta il cartiglio (colonne reali A123).
const row: Record<string, string> = {
  'CODICE COMMESSA': 'A123',
  'FASE PROGETTO': 'E',
  'Disciplina': 'EL',
  'TIPO DI ELABORATO': 'QE',
  'CODICE ELABORATO': 'A123_E_EL_QE_CAB4-EL01a',
  'TITOLO CARTIGLIO': 'QUADRO DI BASSA TENSIONE',
  'SCALA': '-',
  'DATA': '4/17/26',
}
const meta = { Committente: 'IMMOBILIARE CINQUERRE S.P.A.', Oggetto: 'INTERVENTI DI MODIFICA' }

describe('δ expr — resolveExpr', () => {
  it('token colonna semplice', () => {
    expect(resolveExpr('{CODICE COMMESSA}', row)).toBe('A123')
  })
  it('composizione con testo letterale → Protocollo Tavola', () => {
    expect(resolveExpr('{FASE PROGETTO}-{Disciplina}-{TIPO DI ELABORATO}', row)).toBe('E-EL-QE')
  })
  it('|tail → coda del codice dopo l\'ultimo «_» (Tavola N°)', () => {
    expect(resolveExpr('{CODICE ELABORATO|tail}', row)).toBe('CAB4-EL01a')
  })
  it('|head → prima parte prima del primo «_»', () => {
    expect(resolveExpr('{CODICE ELABORATO|head}', row)).toBe('A123')
  })
  it('|meseanno → «MESE ANNO» da data US M/D/YY', () => {
    expect(resolveExpr('{DATA|meseanno}', row)).toBe('APRILE 2026')
  })
  it('|stato → lettera FASE → parola', () => {
    expect(resolveExpr('{FASE PROGETTO|stato}', row)).toBe('ESECUTIVO')
    expect(resolveExpr('{FASE PROGETTO|stato}', { 'FASE PROGETTO': 'D' })).toBe('DEFINITIVO')
    expect(resolveExpr('{FASE PROGETTO|stato}', { 'FASE PROGETTO': 'A' })).toBe('AUTORIZZATIVO')
    // Alcuni studi stampano i 4 stati BOZZA/PRELIMINARE/DEFINITIVO/ESECUTIVO → B mappato.
    expect(resolveExpr('{FASE PROGETTO|stato}', { 'FASE PROGETTO': 'B' })).toBe('BOZZA')
    expect(resolveExpr('{FASE PROGETTO|stato}', { 'FASE PROGETTO': 'P' })).toBe('PRELIMINARE')
  })
  it('|data → «gg-mm-aaaa» (formato di cartiglio più comune)', () => {
    expect(resolveExpr('{DATA|data}', row)).toBe('17-04-2026')         // da US 4/17/26
    expect(resolveExpr('{DATA|data}', { DATA: '2026-04-17' })).toBe('17-04-2026')
    expect(resolveExpr('{DATA|data}', { DATA: '17/4/2026' })).toBe('17-04-2026') // D/M esplicito
  })
  it('|data non parsabile → testo invariato', () => {
    expect(resolveExpr('{DATA|data}', { DATA: 'aprile' })).toBe('aprile')
  })
  it('|pad → zero-padding a sinistra (numeri sequenziali di convenzioni tipo ISO 19650)', () => {
    expect(resolveExpr('{Progressivo|pad:5}', { Progressivo: '1' })).toBe('00001')
    expect(resolveExpr('{Progressivo|pad}', { Progressivo: '12' })).toBe('0012') // default 4 cifre
    expect(resolveExpr('{Progressivo|pad:3}', { Progressivo: '1234' })).toBe('1234') // già più lungo → invariato
  })
  it('token metadato {@Chiave}', () => {
    expect(resolveExpr('{@Committente}', row, meta)).toBe('IMMOBILIARE CINQUERRE S.P.A.')
  })
  it('header mancante → vuoto (il testo letterale resta)', () => {
    expect(resolveExpr('Rev. {REVISIONE}', row)).toBe('Rev. ')
    expect(resolveExpr('{@Sconosciuto}', row, meta)).toBe('')
  })
  it('|meseanno non parsabile → testo invariato', () => {
    expect(resolveExpr('{DATA|meseanno}', { DATA: 'aprile' })).toBe('aprile')
  })
  it('espressione vuota → vuoto', () => {
    expect(resolveExpr('', row)).toBe('')
  })
  it('lookup tollerante: spaziatura/maiuscole irregolari nell\'header', () => {
    // header reale con doppio spazio; token scritto pulito → deve comunque trovarlo.
    expect(resolveExpr('{TITOLO CARTIGLIO}', { 'TITOLO  CARTIGLIO': 'QUADRO BT' })).toBe('QUADRO BT')
    expect(resolveExpr('{codice commessa}', { 'CODICE COMMESSA': 'A123' })).toBe('A123')
  })
})

describe('δ expr — exprTokens', () => {
  it('elenca i nomi di token (colonne e @meta)', () => {
    expect(exprTokens('{FASE PROGETTO}-{Disciplina}')).toEqual(['FASE PROGETTO', 'Disciplina'])
    expect(exprTokens('{CODICE ELABORATO|tail}')).toEqual(['CODICE ELABORATO'])
    expect(exprTokens('{@Committente}')).toEqual(['@Committente'])
  })
})

// Riconoscimento «espressione semplice»: decide se l'editor a
// menu (Sorgente+Formato, ui/campi.js) può gestire il campo, o se deve finire
// nel pannello Avanzate a testo libero.
describe('δ expr — simpleExprParts', () => {
  it('{Colonna} da sola → semplice, fn assente', () => {
    expect(simpleExprParts('{CODICE COMMESSA}')).toEqual({ col: 'CODICE COMMESSA', fn: undefined })
  })
  it('{Colonna|fn} senza argomento → semplice, fn riconosciuta', () => {
    expect(simpleExprParts('{CODICE ELABORATO|upper}')).toEqual({ col: 'CODICE ELABORATO', fn: 'upper' })
    expect(simpleExprParts('{CODICE ELABORATO|tail}')).toEqual({ col: 'CODICE ELABORATO', fn: 'tail' })
  })
  it('spazi intorno a colonna/fn vengono ripuliti', () => {
    expect(simpleExprParts('{ CODICE COMMESSA }')).toEqual({ col: 'CODICE COMMESSA', fn: undefined })
    expect(simpleExprParts(' {CODICE COMMESSA|upper} ')).toEqual({ col: 'CODICE COMMESSA', fn: 'upper' })
  })
  it('composizione multi-token → non semplice (null)', () => {
    expect(simpleExprParts('{A}-{B}')).toBeNull()
    expect(simpleExprParts('{FASE PROGETTO}-{Disciplina}-{TIPO DI ELABORATO}')).toBeNull()
  })
  it('testo letterale misto intorno al token → non semplice (null)', () => {
    expect(simpleExprParts('Rev. {A}')).toBeNull()
    expect(simpleExprParts('{A} rev.')).toBeNull()
  })
  it('argomento custom (|fn:arg) → non semplice (null), resta in Avanzate', () => {
    expect(simpleExprParts('{CODICE ELABORATO|tail:-}')).toBeNull()
    expect(simpleExprParts('{DATA|data:x}')).toBeNull()
  })
  it('metadato di progetto {@Chiave} → non semplice (null), non è una colonna elenco', () => {
    expect(simpleExprParts('{@Committente}')).toBeNull()
  })
  it('espressione vuota o assente → null', () => {
    expect(simpleExprParts('')).toBeNull()
    // @ts-expect-error — undefined è comunque un input plausibile a runtime (f.expr non impostata)
    expect(simpleExprParts(undefined)).toBeNull()
  })
  it('parentesi vuote {} → null (nessun nome colonna)', () => {
    expect(simpleExprParts('{}')).toBeNull()
  })
})
