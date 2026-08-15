import { describe, it, expect } from 'vitest'
import { valorizzaLista, economiaATuttoSal, listeATuttoSal, listaSoppressaInSal, nuovaLista } from '../../src/tools/beta/engine/economia'
import { calcolaSals } from '../../src/tools/beta/engine/contabilita'
import { importaAMisura } from '../../src/tools/beta/engine/import'
import type { Appalto, Sal, ListaEconomia } from '../../src/tools/beta/engine/types'

const appalto = (over: Partial<Appalto> = {}): Appalto => ({
  oggetto: 'Lavori di prova', ente: { denominazione: 'Comune di Prova' }, impresa: { denominazione: 'Impresa srl' },
  modalita: 'misura', ivaPct: 10, oneriSicurezza: 0, ...over,
})

const lista = (over: Partial<ListaEconomia> = {}): ListaEconomia => ({
  id: over.id || 'l1', numero: 1, salNumero: 1,
  operai: [{ qualifica: 'operaio comune', ore: 8, tariffaOraria: 25 }, { qualifica: 'specializzato', ore: 8, tariffaOraria: 30 }], // 200 + 240 = 440
  mezzi: [{ descrizione: 'escavatore', ore: 4, tariffaOraria: 50 }], // 200
  provviste: [{ descrizione: 'calcestruzzo', um: 'mc', quantita: 2, prezzoUnitario: 100 }], // 200
  ...over,
})

describe('β lavori in economia — valorizzazione', () => {
  it('valorizzaLista somma manodopera + noli + provviste', () => {
    const v = valorizzaLista(lista())
    expect(v.manodopera).toBe(440)
    expect(v.noli).toBe(200)
    expect(v.provviste).toBe(200)
    expect(v.totale).toBe(840)
  })
  it('campi mancanti non stimati (null → 0)', () => {
    const v = valorizzaLista(lista({ operai: [{ qualifica: 'x', ore: 8 }], mezzi: [], provviste: [] }))
    expect(v.totale).toBe(0) // tariffa assente → 0, non stimata
  })
  it('nuovaLista numera progressivamente', () => {
    const a = nuovaLista(1, '01/06/2026', [], 'a')
    const b = nuovaLista(1, '08/06/2026', [a], 'b')
    expect(a.numero).toBe(1); expect(b.numero).toBe(2)
    expect(a.operai).toEqual([]); expect(a.salNumero).toBe(1)
  })
})

describe('β lavori in economia — progressivo e storno', () => {
  it('economiaATuttoSal è progressiva per SAL di competenza', () => {
    const liste = [lista({ id: 'l1', salNumero: 1 }), lista({ id: 'l2', salNumero: 2 })] // 840 ciascuna
    expect(economiaATuttoSal(liste, 1)).toBe(840)
    expect(economiaATuttoSal(liste, 2)).toBe(1680)
  })
  it('una lista soppressa esce dalla contabilizzazione (storno)', () => {
    const l = lista({ id: 'l1', salNumero: 1, soppressaSal: 2 })
    expect(listaSoppressaInSal(l, 1)).toBe(false)
    expect(listaSoppressaInSal(l, 2)).toBe(true)
    expect(economiaATuttoSal([l], 1)).toBe(840) // prima dello storno resta
    expect(economiaATuttoSal([l], 2)).toBe(0)   // dallo storno in poi → 0
    expect(listeATuttoSal([l], 2)).toHaveLength(0)
  })
})

describe('β lavori in economia — confluenza nella cascata del SAL', () => {
  const partite = importaAMisura([{ codice: 'M1', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 100, categoria: 'Opere' }])
  it('lavoriEconomia entra nel totale eseguito e nell\'importo del SAL', () => {
    const sals: Sal[] = [{ numero: 1, righe: [{ partitaId: partite[0].id, quantitaProgressiva: 50 }] }] // 500 a misura
    const liste = [lista({ id: 'l1', salNumero: 1 })] // 840 in economia
    const res = calcolaSals(appalto(), partite, sals, liste)
    expect(res[0].lavoriMisura).toBe(500)
    expect(res[0].lavoriEconomia).toBe(840)
    expect(res[0].totaleEseguito).toBe(1340)
    // senza liste, torna il solo a misura (retrocompat firma)
    expect(calcolaSals(appalto(), partite, sals)[0].totaleEseguito).toBe(500)
  })
})
