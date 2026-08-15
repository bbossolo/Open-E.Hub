// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * PROGETTO E.HUB (.ehub) — β: ciò che si salva è ciò che si riapre.
 *
 * β partecipa al salvataggio del progetto: risponde a `hub:collect-state` con
 * `app:full-state` (appId `beta-contabilita`) e ripristina da `hub:restore-state`.
 * Qui esercitiamo il ROUND-TRIP reale via bus: restore(X) → collect() = X,
 * senza perdite. Se `serialize`/`hydrate` divergono, il test cade.
 */

const IDS = ['bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast']

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'beta')
  document.body.innerHTML = `
    ${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file">`
  Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, configurable: true })
  await import('../../src/tools/beta/main')
})

/** Stato ricco con l'appalto già completo dei default (così il round-trip è esatto). */
const STATO = {
  v: 1,
  appalto: {
    oggetto: 'Lavori di prova', ente: { denominazione: 'Comune di Prova', indirizzo: 'Via A 1', codiceFiscale: 'CF00' },
    impresa: { denominazione: 'Impresa Y', indirizzo: 'Via B 2', partitaIva: 'IVA01', codiceFiscale: 'CF01' },
    modalita: 'misura', ivaPct: 10, cig: 'CIG-123', cup: 'CUP-9', rup: 'Ing. Rossi', direttoreLavori: 'Ing. Bianchi',
    baseAsta: 100000, importoOfferta: 90000, oneriSicurezza: 2000, dataInizio: '01/06/2026', dataStipula: '15/05/2026',
  },
  partite: [
    { id: 'p1', modalita: 'misura', codice: 'M1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, introdottaSal: 1 },
    { id: 'p2', modalita: 'misura', codice: 'M2', descrizione: 'Getto', um: 'mc', prezzoUnitario: 20, qtyProgetto: 50, introdottaSal: 1 },
  ],
  sals: [
    { numero: 1, data: '01/06/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 40 }, { partitaId: 'p2', quantitaProgressiva: 10 }] },
    { numero: 2, data: '01/07/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 60 }] },
  ],
  giornale: [{ data: '02/06/2026', meteo: 'sereno', maestranze: '4', note: 'inizio scavi' }],
  riserve: [{ id: 'r1', salNumero: 1, testo: 'riserva x', importo: 500 }],
  relazione: 'Relazione sul conto finale.',
  verbali: [{ id: 'v1', tipo: 'consegna', data: '01/06/2026', campi: {} }],
  economia: [{ id: 'l1', salNumero: 1, data: '05/06/2026', operai: [{ ore: 8, tariffaOraria: 25 }], mezzi: [], provviste: [] }],
  consegne: [{ id: 'c1', tipo: 'libretto', label: 'Libretto delle misure', data: '01/06/2026', salNumero: 1, ts: 1 }],
}

function restore(state: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state } }))
}
function collect(): Promise<{ appId: string; state: any }> {
  return new Promise((resolve) => {
    const h = (e: MessageEvent) => {
      if (e.data && e.data.type === 'app:full-state') { window.removeEventListener('message', h); resolve(e.data) }
    }
    window.addEventListener('message', h)
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:collect-state' } }))
  })
}

describe('β — round-trip del Progetto Open E.Hub (.ehub)', () => {
  it('risponde a collect-state con app:full-state e appId corretto', async () => {
    restore(STATO)
    const got = await collect()
    expect(got.appId).toBe('beta-contabilita')
    expect(got.state).toBeTruthy()
  })

  it('restore(X) → collect() = X: nessun dato perso (appalto, partite, SAL, verbali, economia, consegne)', async () => {
    restore(STATO)
    const got = await collect()
    expect(got.state).toEqual(STATO)
  })

  it('il round-trip è idempotente: collect(restore(collect(restore(X)))) è stabile', async () => {
    restore(STATO)
    const y = (await collect()).state
    restore(y)
    const z = (await collect()).state
    expect(z).toEqual(y)
  })
})
