// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * Verifica che il WIRING dei pulsanti funzioni davvero (bug segnalato: «i
 * pulsanti non fanno nulla»). Monta lo scheletro DOM del tool, importa main.ts
 * ed esercita gli handler esposti su window: la guida flottante, la modale di
 * import e l'avanzamento nel tempo devono avere effetto visibile nel DOM.
 */

const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast']

type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'beta')
  document.body.innerHTML = `
    ${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file">`
  // clipboard/open stub per gli handler che li usano
  Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, configurable: true })
  await import('../../src/tools/beta/main')
})

describe('β UI — gli handler sono agganciati e i pulsanti agiscono', () => {
  it('espone gli handler principali su window (niente onclick "morti")', () => {
    const w = window as unknown as Win
    for (const fn of ['toggleTheme', 'toggleGuida', 'openDati', 'openImport', 'importMiu', 'openEditor', 'anteprima', 'stampa', 'avanzaGiorni', 'nuovoSalOggi', 'exportExcel', 'setApp', 'riapri', 'addGiornale', 'addRiserva', 'addVoce', 'setPrezzo', 'openNuovoVerbale', 'creaVerbale', 'setVerb', 'delVerbale', 'toggleMisure', 'dettagliaMisure', 'addMisura', 'setMisura', 'delMisura', 'annullaStorno', 'creaLista', 'addOperaio', 'setOperaio', 'delLista']) {
      expect(typeof w[fn], `window.${fn} deve essere una funzione`).toBe('function')
    }
  })

  it('la guida unica condivisa si apre e si chiude (visore F1)', () => {
    expect(document.querySelector('.ehb-guide')).toBeNull()
    ;(window as unknown as Win).toggleGuida()
    expect(document.querySelector('.ehb-guide')).not.toBeNull()
    ;(window as unknown as Win).toggleGuida()
    expect(document.querySelector('.ehb-guide')).toBeNull()
  })

  it('la guida è stata registrata nel manuale unico (capitoli + FAQ)', () => {
    ;(window as unknown as Win).toggleGuida()
    const guide = document.querySelector('.ehb-guide')!
    expect(guide.textContent).toContain('Oggetto e finalità')
    expect(guide.querySelectorAll('.ehb-guide__chapter details').length).toBeGreaterThan(3)
    ;(window as unknown as Win).toggleGuida()
  })

  it('«Importa computo» apre una modale con il pulsante di import da μ', () => {
    ;(window as unknown as Win).openImport()
    const host = document.getElementById('bModalHost')!
    expect(host.querySelector('.ehb-modal-backdrop')).not.toBeNull()
    expect(host.innerHTML).toContain('Usa il computo corrente di μ Prezzi')
    ;(window as unknown as Win).closeModal()
    expect(host.innerHTML).toBe('')
  })

  it('«Dati appalto» apre la modale anagrafica e i setter aggiornano lo stato', () => {
    ;(window as unknown as Win).openDati()
    expect(document.getElementById('bModalHost')!.innerHTML).toContain('Stazione appaltante')
    ;(window as unknown as Win).setEnte('denominazione', 'Comune di Verifica')
    ;(window as unknown as Win).closeModal()
    expect(document.getElementById('bAppSummary')!.innerHTML).toContain('Comune di Verifica')
  })

  it('avanzare nei giorni aggiorna la data corrente (campo editabile)', () => {
    const cur = document.getElementById('bDataCorrente') as HTMLInputElement
    ;(window as unknown as Win).avanzaGiorni(0) // forza il render
    const prima = cur.value
    ;(window as unknown as Win).avanzaGiorni(7)
    expect(cur.value).not.toBe(prima)
    expect(cur.value).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('la data corrente si può impostare a mano e dal calendario', () => {
    const w = window as unknown as Win
    const cur = document.getElementById('bDataCorrente') as HTMLInputElement
    const cal = document.getElementById('bDataCorrenteCal') as HTMLInputElement
    w.setDataCorrenteIt('15/03/2027')
    expect(cur.value).toBe('15/03/2027')
    expect(cal.value).toBe('2027-03-15')
    w.setDataCorrenteIso('2028-12-01')
    expect(cur.value).toBe('01/12/2028')
    // input incompleto/invalido non cambia la data
    w.setDataCorrenteIt('99/99')
    expect(cur.value).toBe('01/12/2028')
  })

  it('la timeline mostra le fasi e le schede documento', () => {
    expect(document.getElementById('bTimeline')!.querySelectorAll('.b-fase').length).toBeGreaterThan(0)
    expect(document.getElementById('bTimeline')!.querySelectorAll('.b-card').length).toBeGreaterThan(0)
  })

  it('cliccare una scheda APRE l\'editor (giornale) e vi si aggiunge una riga', () => {
    ;(window as unknown as Win).openEditor('avvio', 'giornale')
    const host = document.getElementById('bModalHost')!
    expect(host.innerHTML).toContain('Giornale dei lavori')
    expect(host.innerHTML).not.toContain('setGiornale(0')
    ;(window as unknown as Win).addGiornale()
    expect(document.getElementById('bModalHost')!.innerHTML).toContain('setGiornale(0')
    ;(window as unknown as Win).closeModal()
  })

  it('«+ Verbale/atto» apre il selettore, crea un atto in timeline e lo si modifica', () => {
    const w = window as unknown as Win
    w.openNuovoVerbale()
    const host = document.getElementById('bModalHost')!
    expect(host.innerHTML).toContain('Verbale di consegna dei lavori')
    // crea una sospensione → apre l'editor e compare una fase nella timeline
    w.creaVerbale('sospensione')
    expect(document.getElementById('bModalHost')!.innerHTML).toContain('Causa della sospensione')
    const nFasiVerbali = document.getElementById('bTimeline')!.querySelectorAll('[id^="fase-verb-"]').length
    expect(nFasiVerbali).toBeGreaterThan(0)
    w.closeModal()
  })
})

describe('β libretto — editor stile μ, misure di dettaglio e storno', () => {
  const w = window as unknown as Win
  // Semina lo stato via bus (hub:restore-state): 2 voci a misura + 2 SAL prodotti.
  function seed(): void {
    const state = {
      v: 1,
      appalto: { oggetto: 'Prova libretto', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura', ivaPct: 10, dataInizio: '01/06/2026' },
      partite: [
        { id: 'p1', modalita: 'misura', codice: 'M1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, introdottaSal: 1 },
        { id: 'p2', modalita: 'misura', codice: 'M2', descrizione: 'Getto', um: 'mc', prezzoUnitario: 20, qtyProgetto: 50, introdottaSal: 1 },
      ],
      sals: [
        { numero: 1, data: '01/06/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 40 }, { partitaId: 'p2', quantitaProgressiva: 10 }] },
        { numero: 2, data: '01/07/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 60 }, { partitaId: 'p2', quantitaProgressiva: 20 }] },
      ],
      // il libretto del SAL 1 è già stato prodotto → le voci sono "contabilizzate"
      consegne: [{ id: 'c1', tipo: 'libretto', label: 'Libretto delle misure', data: '01/06/2026', salNumero: 1, ts: 1 }],
    }
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state } }))
  }

  it('apre il libretto con l\'edit veloce (quantità) e il pulsante «▸ dettaglia»', () => {
    seed()
    w.openEditor('sal-2', 'libretto')
    const html = document.getElementById('bModalHost')!.innerHTML
    expect(html).toContain('Misure a tutto il SAL n. 2')
    expect(html).toContain('setSalQta(2,') // edit veloce a voce chiusa
    expect(html).toContain('dettagliaMisure(2,') // passa alle misure di dettaglio
  })

  it('dettaglia → aggiunge una misura L×L×H×n e la quantità calcolata si aggiorna', () => {
    w.dettagliaMisure(2, 'p1')
    let html = document.getElementById('bModalHost')!.innerHTML
    expect(html).toContain('Designazione della misura') // tabella misure aperta
    w.addMisura(2, 'p1', false)
    // due fattori: 3 × 4 = 12
    w.setMisura(2, 'p1', 1, 'l1', '3')
    w.setMisura(2, 'p1', 1, 'l2', '4')
    const cell = document.getElementById('bmq-p1-1')!
    expect(cell.textContent).toContain('12')
  })

  it('elimina una voce GIÀ contabilizzata → storno tracciato, non cancellazione', () => {
    w.delVoce('p2', 2)
    // p2 resta tra le partite ma marcata soppressa al SAL 2
    const html = document.getElementById('bModalHost')!.innerHTML
    expect(html).toContain('storno')
    expect(html.toLowerCase()).toContain('stornata')
  })

  it('una voce NUOVA di questo SAL si elimina davvero (mai contabilizzata)', () => {
    // riapre il libretto del SAL 2 e aggiunge un nuovo prezzo compilando i campi
    w.openEditor('sal-2', 'libretto')
    ;(document.getElementById('bnv-cod') as HTMLInputElement).value = 'NP.99'
    ;(document.getElementById('bnv-desc') as HTMLInputElement).value = 'Nuova lavorazione'
    w.addVoce(2)
    let html = document.getElementById('bModalHost')!.innerHTML
    expect(html).toContain('NP.99')
    expect(html).toContain('nuovo prezzo (SAL 2)')
    // ricava l'id della nuova voce dal delVoce del suo pulsante 🗑 e la elimina
    const m = document.getElementById('bModalHost')!.innerHTML.match(/delVoce\('([^']+)',2\)"[^>]*>🗑/g)!
    const ids = m.map((s) => s.match(/delVoce\('([^']+)'/)![1])
    const newId = ids[ids.length - 1] // l'ultima voce è il nuovo prezzo appena aggiunto
    w.delVoce(newId, 2)
    html = document.getElementById('bModalHost')!.innerHTML
    expect(html).not.toContain('NP.99') // eliminata davvero (non stornata)
    w.closeModal()
  })

  it('«＋ Lista in economia» crea la lista, si aggiungono operai e il totale si valorizza', () => {
    // lo stato ha già dei SAL (dal test precedente): crea una lista sull'ultimo SAL
    w.creaLista()
    let host = document.getElementById('bModalHost')!.innerHTML
    expect(host).toContain('Mano d\'opera')
    // l'id della lista è nel pulsante addOperaio
    const id = document.getElementById('bModalHost')!.innerHTML.match(/addOperaio\('([^']+)'\)/)![1]
    w.addOperaio(id)
    w.setOperaio(id, 0, 'ore', '8')
    w.setOperaio(id, 0, 'tariffaOraria', '25')
    // 8 × 25 = 200 → cella importo e totale aggiornati in-place
    expect(document.getElementById(`blo-${id}-0`)!.textContent).toContain('200')
    expect(document.getElementById(`bl-tot-${id}`)!.innerHTML).toContain('200')
    w.closeModal()
    // la lista compare come card in economia nella timeline
    expect(document.getElementById('bTimeline')!.innerHTML).toContain('Lista in economia')
  })
})
