import { describe, it, expect } from 'vitest'
import { detectFieldsFromLabels } from '../../src/tools/delta/engine/detect'
import { matchCartiglioLabel, CARTIGLIO_LABELS } from '../../src/tools/delta/engine/columns'
import { resolveExpr } from '../../src/tools/delta/engine/expr'
import type { LabelItem } from '../../src/tools/delta/engine/detect'

// Etichette reali estratte dal cartiglio vuoto (1 vuoto.pdf), in frazioni ~0–1.
const labels: LabelItem[] = [
  { text: 'COMMITTENTE', x: 0.03, y: 0.48, w: 0.10, h: 0.02 },
  { text: 'Commessa n :', x: 0.40, y: 0.55, w: 0.12, h: 0.02 },
  { text: 'Protocollo Tavola:', x: 0.40, y: 0.62, w: 0.14, h: 0.02 },
  { text: 'Data di Emissione:', x: 0.40, y: 0.69, w: 0.14, h: 0.02 },
  { text: 'scala:', x: 0.42, y: 0.76, w: 0.06, h: 0.02 },
  { text: 'TITOLO TAVOLA:', x: 0.03, y: 0.82, w: 0.12, h: 0.02 },
  { text: 'TAVOLA N ::', x: 0.42, y: 0.84, w: 0.10, h: 0.02 },
  { text: 'STATO DEL PROGETTO:', x: 0.03, y: 0.95, w: 0.18, h: 0.02 },
  { text: 'Disegnato:', x: 0.40, y: 0.51, w: 0.10, h: 0.02 },
  { text: 'Controllato', x: 0.60, y: 0.51, w: 0.10, h: 0.02 },
  // rumore che NON deve diventare campo (intestazioni tabella revisioni / testo fisso):
  { text: 'Disegno', x: 0.50, y: 0.46, w: 0.06, h: 0.02 },
  { text: 'Control.', x: 0.58, y: 0.46, w: 0.06, h: 0.02 },
  { text: 'DESIGNERS:', x: 0.05, y: 0.78, w: 0.10, h: 0.02 },
]

describe('δ detect — matchCartiglioLabel', () => {
  it('riconosce le etichette reali (con punteggiatura/accenti)', () => {
    expect(matchCartiglioLabel('Commessa n :')?.label).toBe('Commessa n°')
    expect(matchCartiglioLabel('TAVOLA N ::')?.label).toBe('Tavola N°')
    expect(matchCartiglioLabel('STATO DEL PROGETTO:')?.label).toBe('Stato del Progetto')
  })
  it('NON confonde le intestazioni della tabella revisioni', () => {
    expect(matchCartiglioLabel('Disegno')).toBeNull()   // ≠ "Disegnato"
    expect(matchCartiglioLabel('Control.')).toBeNull()   // ≠ "Controllato"
    expect(matchCartiglioLabel('DESIGNERS:')).toBeNull()
    expect(matchCartiglioLabel('Data')).toBeNull()       // ≠ "Data di Emissione" (col revisioni)
    expect(matchCartiglioLabel('Rev.')).toBeNull()
  })
  it('copre le VARIANTI di altri studi (vocabolario allargato)', () => {
    expect(matchCartiglioLabel('Cliente')?.label).toBe('Committente')
    expect(matchCartiglioLabel('Stazione Appaltante')?.label).toBe('Committente')
    expect(matchCartiglioLabel('Elaborato n.')?.label).toBe('Tavola N°')
    expect(matchCartiglioLabel('Foglio n.')?.label).toBe('Tavola N°')
    expect(matchCartiglioLabel('Titolo elaborato')?.label).toBe('Titolo Tavola')
    expect(matchCartiglioLabel('Redatto')?.label).toBe('Disegnato')
    expect(matchCartiglioLabel('Verificato')?.label).toBe('Controllato')
    expect(matchCartiglioLabel('Codice commessa')?.label).toBe('Commessa n°')
  })
  it('cartiglio tipo B: Proponente, Tavola nr., Agg./Revisione', () => {
    expect(matchCartiglioLabel('Proponente')?.label).toBe('Committente')
    expect(matchCartiglioLabel('Tavola nr.')?.label).toBe('Tavola N°')
    expect(matchCartiglioLabel('Agg.')?.label).toBe('Revisione')
    expect(matchCartiglioLabel('Revisione')?.label).toBe('Revisione')
    // "Data" e "Rev." restano rumore (tabella revisioni): nessuna estensione qui.
    expect(matchCartiglioLabel('Data')).toBeNull()
    expect(matchCartiglioLabel('Rev.')).toBeNull()
  })
})

// Etichette reali estratte da un cartiglio di studio (layer testo pulito) (layer testo, nbsp→spazio).
describe('δ detect — cartiglio tipo A', () => {
  const etichette = [
    'COMMITTENTE :', 'STATO DEL PROGETTO :', 'OGGETTO:', 'Commessa n°:',
    'Protocollo Tavola n°:', 'Scala:', 'Data Emissione:', 'Controllato',
    'Disegnato', 'TAVOLA N°:',
  ]
  const rumore = ['Contr.', 'Data', 'Rev.', 'Modifica', 'Disegn.', 'Approv. del comm.', 'TIMBRO']

  it('riconosce tutte le 10 celle del cartiglio', () => {
    for (const t of etichette) expect(matchCartiglioLabel(t), t).not.toBeNull()
    expect(matchCartiglioLabel('COMMITTENTE :')?.label).toBe('Committente')
    expect(matchCartiglioLabel('Protocollo Tavola n°:')?.label).toBe('Protocollo Tavola')
    expect(matchCartiglioLabel('Data Emissione:')?.label).toBe('Data di Emissione')
    expect(matchCartiglioLabel('TAVOLA N°:')?.label).toBe('Tavola N°')
  })
  it('NON crea campi dalla tabella revisioni né dal TIMBRO', () => {
    for (const t of rumore) expect(matchCartiglioLabel(t), t).toBeNull()
  })

  it('«Stato del Progetto» in fondo alla pagina va IN LINEA, non sotto (niente footer)', () => {
    // Geometria reale osservata: l'etichetta è a y 0.945 — sotto non c'è più pagina.
    const [f] = detectFieldsFromLabels([{ text: 'STATO DEL PROGETTO :', x: 0.044, y: 0.945, w: 0.199, h: 0.013 }])
    expect(f.anchor).toBe('ml')
    expect(f.x).toBeGreaterThan(0.243)   // a destra della fine dell'etichetta
    expect(f.y).toBeLessThan(0.96)       // resta sopra il footer legale
  })

  it('la stessa cella, se c\'è spazio sotto, resta a blocco', () => {
    const [f] = detectFieldsFromLabels([{ text: 'STATO DEL PROGETTO :', x: 0.03, y: 0.50, w: 0.18, h: 0.02 }])
    expect(f.anchor).toBe('tl')
    expect(f.maxWidthFrac).toBeGreaterThan(0)
  })
})

describe('δ detect — detectFieldsFromLabels', () => {
  const fields = detectFieldsFromLabels(labels)

  it('crea un campo per ogni cella riconosciuta, nessun rumore', () => {
    const names = fields.map(f => f.label).sort()
    expect(names).toEqual([
      'Commessa n°', 'Committente', 'Controllato', 'Data di Emissione', 'Disegnato',
      'Protocollo Tavola', 'Scala', 'Stato del Progetto', 'Tavola N°', 'Titolo Tavola',
    ].sort())
  })

  it('anti-ripetizione: Protocollo e Tavola N° hanno sorgenti DISTINTE', () => {
    // (Protocollo Tavola non è tra le etichette di questo campione, ma il dizionario
    //  garantisce espressioni diverse: verifichiamo sul dizionario.)
    const proto = CARTIGLIO_LABELS.find(c => c.label === 'Protocollo Tavola')!.expr!
    const tav = CARTIGLIO_LABELS.find(c => c.label === 'Tavola N°')!.expr!
    expect(proto).not.toBe(tav)
    const row = { 'FASE PROGETTO': 'E', 'Disciplina': 'EL', 'TIPO DI ELABORATO': 'QE', 'CODICE ELABORATO': 'A123_E_EL_QE_CAB4-EL01a' }
    expect(resolveExpr(proto, row)).toBe('E-EL-QE')
    expect(resolveExpr(tav, row)).toBe('CAB4-EL01a')
    expect(resolveExpr(proto, row)).not.toBe(resolveExpr(tav, row))
  })

  it('celle senza colonna nascono FISSE (Disegnato/Controllato), le altre variabili con expr', () => {
    const dis = fields.find(f => f.label === 'Disegnato')!
    expect(dis.kind).toBe('fixed')
    expect(dis.value).toBe('')
    const commessa = fields.find(f => f.label === 'Commessa n°')!
    expect(commessa.kind).toBe('variable')
    expect(commessa.expr).toBe('{CODICE COMMESSA}')
  })

  it('«Agg.» (cartiglio GB) genera una cella Revisione fissa, come Disegnato/Controllato', () => {
    const [rev] = detectFieldsFromLabels([{ text: 'Agg.', x: 0.6, y: 0.9, w: 0.04, h: 0.015 }])
    expect(rev.label).toBe('Revisione')
    expect(rev.kind).toBe('fixed')
    expect(rev.value).toBe('')
  })

  it('cella «below» → ancora tl, con maxWidthFrac (blocco/wrap)', () => {
    const titolo = fields.find(f => f.label === 'Titolo Tavola')!
    expect(titolo.anchor).toBe('tl')
    expect(titolo.maxWidthFrac).toBeGreaterThan(0)
  })
  it('cartiglio SENZA etichetta «Titolo»: il campo nasce comunque, sotto l\'Oggetto', () => {
    // Caso cartiglio tipo A: la cella del titolo elaborato è un riquadro senza etichetta.
    const senzaTitolo: LabelItem[] = [
      { text: 'COMMITTENTE :', x: 0.04, y: 0.40, w: 0.12, h: 0.02 },
      { text: 'OGGETTO :', x: 0.04, y: 0.50, w: 0.10, h: 0.02 },
      { text: 'scala:', x: 0.42, y: 0.76, w: 0.06, h: 0.02 },
    ]
    const out = detectFieldsFromLabels(senzaTitolo)
    const titolo = out.find(f => f.label === 'Titolo Tavola')!
    const oggetto = out.find(f => f.label === 'Oggetto')!
    expect(titolo).toBeTruthy()
    expect(titolo.kind).toBe('variable')
    expect(titolo.expr).toBe('{TITOLO CARTIGLIO}')
    expect(titolo.x).toBeCloseTo(oggetto.x, 5)
    expect(titolo.y).toBeGreaterThan(oggetto.y) // sotto l'Oggetto
    expect(titolo.y).toBeLessThanOrEqual(0.95)
    expect(titolo.maxWidthFrac).toBeGreaterThan(0)
  })

  it('nessun doppione quando l\'etichetta «Titolo tavola» c\'è davvero', () => {
    expect(fields.filter(f => f.label === 'Titolo Tavola')).toHaveLength(1)
  })

  it('senza NESSUNA etichetta riconosciuta non si inventa nulla', () => {
    expect(detectFieldsFromLabels([{ text: 'Disegno', x: 0.5, y: 0.4, w: 0.06, h: 0.02 }])).toEqual([])
  })

  it('cella inline → ancora ml a destra dell\'etichetta', () => {
    const scala = fields.find(f => f.label === 'Scala')!
    expect(scala.anchor).toBe('ml')
    expect(scala.x).toBeGreaterThan(0.42) // a destra della x dell'etichetta
  })
})
