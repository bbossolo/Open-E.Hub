import { describe, it, expect } from 'vitest'
import {
  frontespizioHTML, giornaleHTML, librettoHTML, registroHTML, sommarioHTML, salHTML, certificatoHTML, contoFinaleHTML, relazioneFinaleHTML,
  verbaleHTML, nuovoVerbale, VERBALE_LABEL, VERBALE_TIPI, listaEconomiaHTML,
} from '../../src/tools/beta/engine'
import { importaAMisura, importaACorpo } from '../../src/tools/beta/engine/import'
import type { Appalto, Partita, Sal, Verbale, ListaEconomia } from '../../src/tools/beta/engine/types'

const appalto: Appalto = {
  oggetto: 'Manutenzione straordinaria scuola', cup: 'C11', cig: 'Z0A',
  ente: { denominazione: 'Comune di Prova', indirizzo: 'Piazza Roma 1', codiceFiscale: '00000000000', logo: 'data:image/png;base64,AAAA' },
  impresa: { denominazione: 'Impresa Edile srl', partitaIva: '01234567890' },
  rup: 'Ing. Rossi', direttoreLavori: 'Arch. Bianchi', articoloCapitolato: '12',
  baseAsta: 100000, importoOfferta: 80000, oneriSicurezza: 2000, ivaPct: 10, modalita: 'misto',
}
const partite: Partita[] = [
  ...importaAMisura([{ codice: 'M1', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 100, categoria: 'Opere edili' }]),
  ...importaACorpo([{ codice: 'C1', desc_short: 'Impianto', prezzo: 100, qty: 20, categoria: 'Impianti' }]),
]
const sals: Sal[] = [{ numero: 1, data: '01/06/2026', righe: [
  { partitaId: partite[0].id, quantitaProgressiva: 50 },
  { partitaId: partite[1].id, quotaPct: 30 },
] }]

// Un verbale per ogni tipo (id/numero deterministici), per verificare tutti gli atti.
const verbali: Verbale[] = VERBALE_TIPI.map((t, i) => {
  const v = nuovoVerbale(t, `0${i + 1}/06/2026`, [], `v${i}`)
  return { ...v, oggetto: `Oggetto ${t}`, testo: 'Primo paragrafo.\nSecondo paragrafo.' }
})

const tutti: Record<string, string> = {
  frontespizio: frontespizioHTML(appalto, partite),
  giornale: giornaleHTML(appalto, []),
  libretto: librettoHTML(appalto, partite, sals[0]),
  registro: registroHTML(appalto, partite, sals),
  sommario: sommarioHTML(appalto, partite, sals, 1),
  sal: salHTML(appalto, partite, sals, 1),
  certificato: certificatoHTML(appalto, partite, sals, 1),
  contoFinale: contoFinaleHTML(appalto, partite, sals, verbali),
  relazione: relazioneFinaleHTML(appalto, partite, sals, [], '', verbali),
  ...Object.fromEntries(verbali.map((v) => [`verbale:${v.tipo}`, verbaleHTML(appalto, v)])),
}

describe('β documenti — modalità istituzionale (testata ente, NO brand Open E.Hub)', () => {
  for (const [nome, html] of Object.entries(tutti)) {
    it(`${nome}: HTML valido, testata dell'ente, senza brand Open E.Hub`, () => {
      expect(html.startsWith('<!doctype html>')).toBe(true)
      expect(html).toContain('data-tool="beta"')
      // testata istituzionale con la denominazione dell'ente
      expect(html).toContain('doc-ente')
      expect(html).toContain('Comune di Prova')
      // il brand Open E.Hub NON deve comparire VISIBILMENTE in questi atti standard della PA:
      // né il wordmark reso (<small>Open E.Hub</small>), né il lockup del cartiglio.
      // (Le regole CSS .ehub-brand restano nel foglio embeddato, invisibili al lettore.)
      expect(html).not.toContain('>Open E.Hub<')
      expect(html).not.toContain('class="df-lockup"')
      expect(html).not.toContain('class="ehub-brand"')
    })
  }
})

describe('β documenti — contenuti chiave', () => {
  it('SAL espone la cascata e la ritenuta 0,50%', () => {
    expect(tutti.sal).toContain('ritenuta di garanzia 0,50%')
    expect(tutti.sal).toContain('IMPORTO DEL PRESENTE SAL')
  })
  it('certificato riporta il credito in lettere (Diconsi)', () => {
    expect(tutti.certificato).toContain('Diconsi euro')
    expect(tutti.certificato).toContain('CERTIFICA')
  })
  it('libretto distingue lavorazioni a misura e a corpo', () => {
    expect(tutti.libretto).toContain('Lavorazioni a misura')
    expect(tutti.libretto).toContain('Lavorazioni a corpo')
  })
})

describe('β libretto — storno e tracciabilità (niente cancellazioni)', () => {
  const pm = importaAMisura([{ codice: 'M1', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 100, categoria: 'Opere' }])[0]
  it('una voce soppressa resta a verbale con lo storno e importo azzerato', () => {
    const soppressa: Partita = { ...pm, soppressaSal: 1 }
    const sal: Sal = { numero: 1, data: '01/06/2026', righe: [{ partitaId: soppressa.id, quantitaProgressiva: 100 }] }
    const html = librettoHTML(appalto, [soppressa], sal)
    expect(html).toContain('portata in detrazione al SAL n. 1')
    expect(html).toContain('stornata')
  })
  it('un nuovo prezzo introdotto al SAL 2 NON compare nel libretto del SAL 1', () => {
    const np: Partita = { ...pm, id: 'np', codice: 'NP.01', descrizione: 'Nuovo prezzo', introdottaSal: 2 }
    const sal1: Sal = { numero: 1, data: '01/06/2026', righe: [{ partitaId: np.id, quantitaProgressiva: 5 }] }
    const html1 = librettoHTML(appalto, [np], sal1)
    expect(html1).not.toContain('NP.01')
    const sal2: Sal = { numero: 2, data: '01/07/2026', righe: [{ partitaId: np.id, quantitaProgressiva: 5 }] }
    expect(librettoHTML(appalto, [np], sal2)).toContain('NP.01')
  })
})

describe('β lavori in economia — documenti', () => {
  const l: ListaEconomia = {
    id: 'l1', numero: 1, data: '05/06/2026', salNumero: 1,
    operai: [{ qualifica: 'operaio comune', ore: 8, tariffaOraria: 25 }],
    mezzi: [{ descrizione: 'escavatore', ore: 4, tariffaOraria: 50 }],
    provviste: [{ descrizione: 'calcestruzzo', um: 'mc', quantita: 2, prezzoUnitario: 100 }],
  }
  it('la lista settimanale è un atto istituzionale (testata ente, no brand Open E.Hub, firme)', () => {
    const html = listaEconomiaHTML(appalto, l)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('data-tool="beta"')
    expect(html).toContain('doc-ente')
    expect(html).toContain('Comune di Prova')
    expect(html).not.toContain('>Open E.Hub<')
    expect(html).toContain('Mano d\'opera')
    expect(html).toContain('bt-firme')
    expect(html.toLowerCase()).toContain('art. 181')
  })
  it('il libretto del SAL mostra la sezione «Lavorazioni in economia» col totale', () => {
    const pm = importaAMisura([{ codice: 'M1', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 100, categoria: 'Opere' }])
    const sal: Sal = { numero: 1, data: '01/06/2026', righe: [{ partitaId: pm[0].id, quantitaProgressiva: 50 }] }
    const html = librettoHTML(appalto, pm, sal, [l])
    expect(html).toContain('Lavorazioni in economia')
    // 200 (operai) + 200 (noli) + 200 (provviste) = 600
    expect(html).toContain('600,00')
    // senza liste, nessuna sezione economia
    expect(librettoHTML(appalto, pm, sal)).not.toContain('Lavorazioni in economia')
  })
})

describe('β verbali e comunicazioni del DL', () => {
  it('ogni tipo produce un atto col proprio titolo e le firme', () => {
    for (const v of verbali) {
      const html = verbaleHTML(appalto, v)
      expect(html, v.tipo).toContain(VERBALE_LABEL[v.tipo])
      expect(html, v.tipo).toContain('bt-firme') // riquadro firme sempre presente
      expect(html, v.tipo).toContain('Oggetto ' + v.tipo)
    }
  })
  it('il verbale di consegna espone gli accertamenti in contraddittorio', () => {
    const c = verbali.find((v) => v.tipo === 'consegna')!
    expect(verbaleHTML(appalto, c)).toContain('libera da persone e cose')
  })
  it('nuovoVerbale numera progressivamente per tipo', () => {
    const list: Verbale[] = []
    const a = nuovoVerbale('ordine', '01/06/2026', list, 'a'); list.push(a)
    const b = nuovoVerbale('ordine', '05/06/2026', list, 'b'); list.push(b)
    const s = nuovoVerbale('sospensione', '06/06/2026', list, 's')
    expect(a.numero).toBe(1)
    expect(b.numero).toBe(2)
    expect(s.numero).toBe(1) // numerazione indipendente per tipo
  })
  it('la relazione finale elenca i verbali come allegati', () => {
    expect(tutti.relazione).toContain('Allegati al conto finale')
    expect(tutti.relazione).toContain('Verbale di consegna dei lavori')
    // senza verbali → nessun allegato
    expect(relazioneFinaleHTML(appalto, partite, sals)).toContain('Nessun verbale o comunicazione')
  })
  it('il conto finale avvisa (gate soft) se manca il certificato di ultimazione', () => {
    const senzaUltim = verbali.filter((v) => v.tipo !== 'ultimazione')
    expect(contoFinaleHTML(appalto, partite, sals, senzaUltim)).toContain('non risulta redatto')
    // con l'ultimazione presente → nessun avviso
    expect(contoFinaleHTML(appalto, partite, sals, verbali)).not.toContain('non risulta redatto')
    // retro-compat: senza il parametro verbali, il documento resta valido (avvisa)
    expect(contoFinaleHTML(appalto, partite, sals)).toContain('CREDITO RESIDUO')
  })
})
