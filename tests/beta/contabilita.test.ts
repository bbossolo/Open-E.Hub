import { describe, it, expect } from 'vitest'
import {
  ribassoPct, importoContrattualePartita, totaleContrattualeLavori, totaleContrattuale,
  aliquotaCorpoPct, quadraturaCorpo, eseguitoPartita, calcolaSals,
  voceVisibileInSal, voceSoppressaInSal,
} from '../../src/tools/beta/engine/contabilita'
import { importaAMisura, importaACorpo } from '../../src/tools/beta/engine/import'
import type { Appalto, Partita, Sal } from '../../src/tools/beta/engine/types'
import { importoInLettere } from '../../src/tools/beta/engine/certificato'

const appalto = (over: Partial<Appalto> = {}): Appalto => ({
  oggetto: 'Lavori di prova', ente: { denominazione: 'Comune di Prova' }, impresa: { denominazione: 'Impresa srl' },
  modalita: 'misura', ivaPct: 10, oneriSicurezza: 0, ...over,
})

describe('β contabilità — ribasso e riconciliazioni (numeri della KB)', () => {
  it('ribasso = (base − offerta)/base — esempio KB 30,5605%', () => {
    expect(ribassoPct(46517.74, 32301.70)).toBeCloseTo(30.5605, 3)
  })
  it('ribasso null se dati mancanti', () => {
    expect(ribassoPct(null, 100)).toBeNull()
    expect(ribassoPct(0, 0)).toBeNull()
  })
  it('riconciliazione lordo/netto: 2.690 × 1,10 = 2.959,00', () => {
    expect(Math.round(2690 * 1.10 * 100) / 100).toBe(2959)
  })
  it('importo in lettere (Diconsi)', () => {
    expect(importoInLettere(2959)).toBe('duemilanovecentocinquantanove/00')
    expect(importoInLettere(1000.5)).toBe('mille/50')
  })
})

describe('β contabilità — a misura', () => {
  const voci = [
    { codice: 'A1', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 100, categoria: 'Opere edili' },
    { codice: 'A2', desc_short: 'Getto', um: 'mc', prezzo: 20, qty: 50, categoria: 'Opere edili' },
  ]
  const partite = importaAMisura(voci)
  it('importo contrattuale = prezzo × qtyProgetto', () => {
    expect(importoContrattualePartita(partite[0])).toBe(1000)
    expect(totaleContrattualeLavori(partite).totale).toBe(2000)
  })
  it('eseguito a misura = prezzo × quantità progressiva (con detrazioni)', () => {
    const sal: Sal = { numero: 1, righe: [{ partitaId: partite[0].id, misurazioni: [{ quantita: 60 }, { quantita: -10 }] }] }
    // 50 mc × 10 €
    expect(eseguitoPartita(partite[0], sal.righe[0])).toBe(500)
  })
})

describe('β contabilità — a corpo', () => {
  const voci = [
    { codice: 'E1', desc_short: 'Muratura', prezzo: 100, qty: 30, categoria: 'Opere edili · Strutture' },
    { codice: 'I1', desc_short: 'Impianto', prezzo: 100, qty: 10, categoria: 'Impianti · Elettrico' },
  ]
  const corpi = importaACorpo(voci) // 2 corpi: Opere edili (3000), Impianti (1000)
  it('aggrega per categoria liv.1 in corpi con importo', () => {
    const tot = totaleContrattualeLavori(corpi)
    expect(tot.corpo).toBe(4000)
    expect(corpi.length).toBe(2)
  })
  it('aliquota corpo = importo / totale corpi', () => {
    const edili = corpi.find((c) => c.descrizione === 'Opere edili')!
    expect(aliquotaCorpoPct(edili, corpi)).toBe(75) // 3000/4000
  })
  it('importo maturato = importo corpo × quota%', () => {
    const edili = corpi.find((c) => c.descrizione === 'Opere edili')!
    const sal: Sal = { numero: 1, righe: [{ partitaId: edili.id, quotaPct: 40 }] }
    expect(eseguitoPartita(edili, sal.righe[0])).toBe(1200) // 3000 × 40%
  })
  it('quadratura corpo: Σ voci = importo corpo (tolleranza 0,01)', () => {
    expect(quadraturaCorpo(3000, [{ importo: 1000 }, { importo: 2000 }]).quadra).toBe(true)
    expect(quadraturaCorpo(3000, [{ importo: 1000 }, { importo: 2000.02 }]).quadra).toBe(false)
  })
})

describe('β contabilità — misto e cascata SAL', () => {
  const partite: Partita[] = [
    ...importaAMisura([{ codice: 'M1', prezzo: 10, qty: 100, categoria: 'A' }]),   // 1000 a misura
    ...importaACorpo([{ codice: 'C1', prezzo: 100, qty: 20, categoria: 'B' }]),      // 2000 a corpo
  ]
  it('totale = Σ misura + Σ corpo', () => {
    const t = totaleContrattualeLavori(partite)
    expect(t.misura).toBe(1000); expect(t.corpo).toBe(2000); expect(t.totale).toBe(3000)
  })
  it('cascata SAL: ritenuta 0,5% e SAL precedenti', () => {
    const pm = partite[0], pc = partite[1]
    const sals: Sal[] = [
      { numero: 1, righe: [{ partitaId: pm.id, quantitaProgressiva: 50 }, { partitaId: pc.id, quotaPct: 25 }] }, // 500 + 500 = 1000
      { numero: 2, righe: [{ partitaId: pm.id, quantitaProgressiva: 100 }, { partitaId: pc.id, quotaPct: 50 }] }, // 1000 + 1000 = 2000
    ]
    const res = calcolaSals(appalto({ oneriSicurezza: 0, ivaPct: 10 }), partite, sals)
    // SAL 1: eseguito 1000, ritenuta 5, netto progressivo 995, importo SAL 995
    expect(res[0].totaleEseguito).toBe(1000)
    expect(res[0].ritenuta).toBe(5)
    expect(res[0].importoSal).toBe(995)
    expect(res[0].salPrecedenti).toBe(0)
    // SAL 2: eseguito 2000, ritenuta 10, netto progressivo 1990, precedenti 995, importo SAL 995
    expect(res[1].totaleEseguito).toBe(2000)
    expect(res[1].ritenuta).toBe(10)
    expect(res[1].salPrecedenti).toBe(995)
    expect(res[1].importoSal).toBe(995)
    // IVA informativa 10%
    expect(res[1].iva).toBe(99.5)
  })
  it('oneri sicurezza liquidati per quota di avanzamento', () => {
    const pm = partite[0], pc = partite[1]
    const sals: Sal[] = [{ numero: 1, righe: [{ partitaId: pm.id, quantitaProgressiva: 50 }, { partitaId: pc.id, quotaPct: 25 }] }]
    // avanzamento = 1000/3000 = 33,33%; oneri 300 → ~100
    const res = calcolaSals(appalto({ oneriSicurezza: 300 }), partite, sals)
    expect(res[0].oneriSicurezzaEseguiti).toBeCloseTo(100, 1)
  })
})

describe('β contabilità — storno, soppressione e tracciabilità (atti pubblici)', () => {
  const partite: Partita[] = [
    ...importaAMisura([{ codice: 'M1', prezzo: 10, qty: 100, categoria: 'A' }]),
    ...importaAMisura([{ codice: 'M2', prezzo: 20, qty: 50, categoria: 'A' }]),
  ]
  it('voceVisibileInSal rispetta introdottaSal (il nuovo prezzo non retroagisce)', () => {
    const np: Partita = { ...partite[1], id: 'np', introdottaSal: 3 }
    expect(voceVisibileInSal(np, 2)).toBe(false)
    expect(voceVisibileInSal(np, 3)).toBe(true)
    expect(voceVisibileInSal(partite[0], 1)).toBe(true) // voce da computo, senza introdottaSal
  })
  it('voceSoppressaInSal true dal SAL dello storno in poi', () => {
    const p: Partita = { ...partite[0], soppressaSal: 2 }
    expect(voceSoppressaInSal(p, 1)).toBe(false)
    expect(voceSoppressaInSal(p, 2)).toBe(true)
    expect(voceSoppressaInSal(p, 3)).toBe(true)
  })
  it('eseguitoPartita azzera il valore dal SAL di soppressione (detrazione dello storno)', () => {
    const p: Partita = { ...partite[0], soppressaSal: 2 }
    const riga = { partitaId: p.id, quantitaProgressiva: 100 }
    expect(eseguitoPartita(p, riga, 1)).toBe(1000) // prima dello storno resta contabilizzata
    expect(eseguitoPartita(p, riga, 2)).toBe(0)    // dallo storno in poi → 0
    expect(eseguitoPartita(p, riga)).toBe(1000)    // senza salNumero: retrocompat, nessuno storno
  })
  it('cascata: soppressione al SAL 2 produce un importo negativo (conguaglio in detrazione)', () => {
    const p: Partita = { ...partite[0], soppressaSal: 2 }
    const sals: Sal[] = [
      { numero: 1, righe: [{ partitaId: p.id, quantitaProgressiva: 100 }] }, // 1000
      { numero: 2, righe: [{ partitaId: p.id, quantitaProgressiva: 100 }] }, // stornata → 0
    ]
    const res = calcolaSals(appalto({ oneriSicurezza: 0, ivaPct: 10 }), [p], sals)
    expect(res[0].totaleEseguito).toBe(1000)
    expect(res[1].totaleEseguito).toBe(0)           // il progressivo crolla per lo storno
    expect(res[1].importoSal).toBeLessThan(0)       // il SAL 2 è una detrazione (credito negativo)
    expect(res[1].righe[0].progressivo).toBe(0)     // la voce risulta a 0 nel SAL dello storno
  })
})

describe('β contabilità — totale contrattuale', () => {
  it('usa l\'offerta ribassata + oneri se nota', () => {
    const partite = importaAMisura([{ codice: 'X', prezzo: 10, qty: 10 }]) // 100
    expect(totaleContrattuale(appalto({ importoOfferta: 90, oneriSicurezza: 5 }), partite)).toBe(95)
  })
  it('ripiega su Σ partite se l\'offerta non è nota', () => {
    const partite = importaAMisura([{ codice: 'X', prezzo: 10, qty: 10 }]) // 100
    expect(totaleContrattuale(appalto({ importoOfferta: null, oneriSicurezza: 5 }), partite)).toBe(105)
  })
})
