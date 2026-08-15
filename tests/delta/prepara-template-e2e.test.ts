// @vitest-environment jsdom
/**
 * e2e jsdom (pattern boot-smoke/cards-editing-e2e/schema-e2e): la
 * schermata unica Template+Campi, senza sintassi. main.js viene ESEGUITO
 * davvero sul markup reale di index.html, poi lo stato (S di ui/stato.js) si
 * popola direttamente — stessa cache dei moduli di vitest, quindi S qui e
 * dentro la UI è LA STESSA istanza (convenzione degli e2e della suite).
 *
 * «preparazione senza sintassi»: cambiare Sorgente/Formato dai
 * controlli (mai testo libero) aggiorna f.expr, e il pannello Avanzate resta
 * collassato. Il canvas dell'EDITOR (dEditorCanvas) è sempre un'anteprima
 * "a vuoto" (resolveCover(S,-1): design pre-esistente, non toccato) — il
 * testo REALMENTE risolto per una riga si verifica quindi con
 * l'engine (fieldText/resolveCover) e sul canvas del passo Genera
 * (dPreviewCanvas), che i controlli del passo Template alimentano.
 *
 * «Applica e continua» porta a viewElenco; un campo con
 * un'espressione preesistente NON semplice (composizione multi-token) mostra
 * il pannello <details class="d-advanced"> invece del select/chip, e si
 * risolve comunque correttamente (retrocompatibilità, nessuna perdita).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fieldText, resolveCover } from '../../src/tools/delta/engine'
import type { DeltaState, Template } from '../../src/tools/delta/engine/types'

const ROOT = resolve(__dirname, '../..')
const errors: unknown[] = []

const TPL: Template = { dataUrl: 'data:image/png;base64,AA', w: 850, h: 1200, kind: 'pdf', name: 't.pdf', ptW: 595, ptH: 842 }

type W = Window & typeof globalThis & {
  showView: (v: string) => void
  addField: (k: string) => void
  setTemplateMode: (m: 'home' | 'editor') => void
}
const w = window as W

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let statoMod: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let setS: (v: any) => void
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let selectField: (id: string) => void
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renderAll: () => void

beforeAll(async () => {
  const html = readFileSync(resolve(ROOT, 'src/tools/delta/index.html'), 'utf8')
  document.body.innerHTML = html.replace(/[\s\S]*<body[^>]*>/, '').replace(/<\/body>[\s\S]*/, '')
  document.documentElement.setAttribute('data-theme', 'light')
  sessionStorage.setItem('ehub:session', JSON.stringify({ user: 'test', exp: Date.now() + 9e6 }))
  window.addEventListener('error', (e) => errors.push(e))
  try {
    // @ts-expect-error — modulo JS senza dichiarazioni di tipo
    await import('../../src/tools/delta/main.js')
  } catch (e) { errors.push(e) }
  // @ts-expect-error — modulo JS senza dichiarazioni di tipo
  const stato = await import('../../src/tools/delta/ui/stato.js')
  statoMod = stato
  setS = stato.setS
  // @ts-expect-error — modulo JS senza dichiarazioni di tipo
  const campi = await import('../../src/tools/delta/ui/campi.js')
  selectField = campi.selectField
  // @ts-expect-error — modulo JS senza dichiarazioni di tipo
  const shellMod = await import('../../src/tools/delta/ui/shell.js')
  renderAll = shellMod.renderAll
})

/** Applica uno stato come farebbe l'apertura di un Progetto Open E.Hub reale
 *  (main.js: `setS(parseState(m.state)); renderAll()`), poi mette a fuoco
 *  la vista Template. */
function apply(state: DeltaState) {
  setS(state)
  renderAll()
  w.showView('template')
}

it('main.js si avvia senza errori (precondizione dei due scenari)', () => {
  expect(errors, errors.map(String).join('\n')).toEqual([])
})

/* Stato di partenza condiviso: template applicato, elenco con 2 righe/colonne,
   un campo variabile «Titolo» inizialmente sulla colonna TITOLO CARTIGLIO. */
function seed(): DeltaState {
  return {
    v: 1,
    template: TPL,
    fields: [
      { id: 'v1', kind: 'variable', label: 'Titolo', x: 0.5, y: 0.5, anchor: 'ml', align: 'left', fontFrac: 0.03, expr: '{TITOLO CARTIGLIO}' },
    ],
    elenco: {
      headers: ['TITOLO CARTIGLIO', 'CODICE ELABORATO'],
      fileName: 'elenco.xlsx',
      rows: [
        { 'TITOLO CARTIGLIO': 'quadro di bassa tensione', 'CODICE ELABORATO': 'A123_E_EL_QE01' },
        { 'TITOLO CARTIGLIO': 'cabina di trasformazione', 'CODICE ELABORATO': 'A123_E_EL_QE02' },
      ],
    },
  }
}

describe('preparazione senza sintassi (Sorgente + Formato)', () => {
  beforeEach(() => {
    apply(seed())
    selectField('v1')
  })

  it('il pannello proprietà mostra il select Sorgente e i chip Formato, non un textarea di espressione in primo piano', () => {
    const src = document.getElementById('dPropSource') as HTMLSelectElement
    expect(src, 'select Sorgente presente').toBeTruthy()
    expect(src.value).toBe('TITOLO CARTIGLIO')
    const chips = document.querySelectorAll('.d-chip[data-fmt]')
    expect(chips.length, 'chip di formato presenti').toBeGreaterThan(0)
    // Il textarea dell'espressione esiste (retrocompatibilità/Avanzate) ma sta
    // dentro un <details> COLLASSATO: non è nel flusso base che l'utente vede.
    const details = document.querySelector('.d-advanced') as HTMLDetailsElement
    expect(details, 'pannello Avanzate presente ma collassato').toBeTruthy()
    expect(details.open, 'Avanzate chiuso di default per un\'espressione semplice').toBe(false)
    expect(details.querySelector('#dPropExpr'), 'il textarea esiste solo dentro Avanzate').toBeTruthy()
  })

  it('cambiare la colonna dal select Sorgente aggiorna f.expr, mai testo libero', () => {
    const src = document.getElementById('dPropSource') as HTMLSelectElement
    src.value = 'CODICE ELABORATO'
    src.dispatchEvent(new Event('change', { bubbles: true }))
    const f = statoMod.S.fields.find((x: { id: string }) => x.id === 'v1')
    expect(f.expr).toBe('{CODICE ELABORATO}')
    expect(f.column).toBeUndefined()
    // il testo REALMENTE risolto (quello che finisce su PDF/anteprima Genera)
    // riflette subito la nuova colonna sulla riga 0 e sulla riga 1 dell'elenco.
    expect(fieldText(f, statoMod.S.elenco.rows[0])).toBe('A123_E_EL_QE01')
    expect(fieldText(f, statoMod.S.elenco.rows[1])).toBe('A123_E_EL_QE02')
  })

  it('cliccare un chip di formato compone f.expr = {Colonna|fn} e il valore risolto cambia di conseguenza', () => {
    const upperChip = Array.from(document.querySelectorAll<HTMLButtonElement>('.d-chip[data-fmt]'))
      .find(b => b.dataset.fmt === 'upper')!
    expect(upperChip, 'chip MAIUSCOLO presente').toBeTruthy()
    upperChip.click()
    const f = statoMod.S.fields.find((x: { id: string }) => x.id === 'v1')
    expect(f.expr).toBe('{TITOLO CARTIGLIO|upper}')
    expect(fieldText(f, statoMod.S.elenco.rows[0])).toBe('QUADRO DI BASSA TENSIONE')
    // effetto end-to-end: il canvas REALE del passo Genera (che i controlli del
    // passo Template alimentano) mostra il testo trasformato per la riga corrente.
    w.showView('genera')
    const texts = Array.from(document.querySelectorAll('#dPreviewCanvas .d-fld-text')).map(t => t.textContent)
    expect(texts).toContain('QUADRO DI BASSA TENSIONE')
    w.showView('template')
  })

  it('tornando a "Come nel file" rimuove il filtro (expr torna a {Colonna} semplice)', () => {
    const chips = document.querySelectorAll<HTMLButtonElement>('.d-chip[data-fmt]')
    const comeNelFile = Array.from(chips).find(b => b.dataset.fmt === '')!
    comeNelFile.click()
    const f = statoMod.S.fields.find((x: { id: string }) => x.id === 'v1')
    expect(f.expr).toBe('{TITOLO CARTIGLIO}')
  })
})

describe('code review: colonne con sintassi nel nome (bug bloccante)', () => {
  /* Un header CSV/Excel reale può contenere `|` (o `{`/`}`, o iniziare per `@`):
     comporre f.expr = `{Tavola N. | Rev.}` verrebbe letto da resolveExpr come
     colonna "Tavola N." con filtro " Rev." → testo vuoto (perdita silenziosa).
     La UI deve restare sulla modalità f.column "semplice" per queste colonne. */
  function seedPipeColumn(): DeltaState {
    return {
      v: 1,
      template: TPL,
      fields: [
        { id: 'v1', kind: 'variable', label: 'Titolo', x: 0.5, y: 0.5, anchor: 'ml', align: 'left', fontFrac: 0.03, expr: '{TITOLO CARTIGLIO}' },
      ],
      elenco: {
        headers: ['TITOLO CARTIGLIO', 'Tavola N. | Rev.'],
        fileName: 'elenco.xlsx',
        rows: [
          { 'TITOLO CARTIGLIO': 'quadro di bassa tensione', 'Tavola N. | Rev.': 'CAB4-EL01a' },
        ],
      },
    }
  }

  it('selezionare dal Sorgente una colonna con "|" nel nome usa f.column (non f.expr) e si risolve correttamente', () => {
    apply(seedPipeColumn())
    selectField('v1')
    const src = document.getElementById('dPropSource') as HTMLSelectElement
    src.value = 'Tavola N. | Rev.'
    src.dispatchEvent(new Event('change', { bubbles: true }))
    const f = statoMod.S.fields.find((x: { id: string }) => x.id === 'v1')
    expect(f.column).toBe('Tavola N. | Rev.')
    expect(f.expr).toBeUndefined()
    expect(fieldText(f, statoMod.S.elenco.rows[0])).toBe('CAB4-EL01a')
  })

  it('cliccare un chip Formato su una colonna con "|" nel nome non compone un token: resta f.column, valore invariato', () => {
    apply(seedPipeColumn())
    selectField('v1')
    const src = document.getElementById('dPropSource') as HTMLSelectElement
    src.value = 'Tavola N. | Rev.'
    src.dispatchEvent(new Event('change', { bubbles: true }))
    const upperChip = Array.from(document.querySelectorAll<HTMLButtonElement>('.d-chip[data-fmt]'))
      .find(b => b.dataset.fmt === 'upper')!
    upperChip.click()
    const f = statoMod.S.fields.find((x: { id: string }) => x.id === 'v1')
    expect(f.column).toBe('Tavola N. | Rev.')
    expect(f.expr).toBeUndefined()
    expect(fieldText(f, statoMod.S.elenco.rows[0])).toBe('CAB4-EL01a')
  })

  it('un campo con f.expr che referenzia una colonna assente mostra l\'avviso ⚠ colonna orfana nella lista campi', () => {
    const state = seedPipeColumn()
    state.fields = [
      { id: 'v1', kind: 'variable', label: 'Titolo', x: 0.5, y: 0.5, anchor: 'ml', align: 'left', fontFrac: 0.03, expr: '{COLONNA SPARITA|upper}' },
    ]
    apply(state)
    const row = document.querySelector('#dFieldList .d-field-row') as HTMLElement
    expect(row, 'riga campo presente nella lista').toBeTruthy()
    expect(row.querySelector('.d-field-warn'), 'avviso orfano presente anche per f.expr').toBeTruthy()
  })
})

describe('"Applica e continua" + compatibilità retroattiva', () => {
  beforeEach(() => {
    apply(seed())
  })

  it('"Applica e continua" è abilitato con template applicato ed è cablato a showView(\'elenco\'); attivarlo mostra viewElenco e nasconde viewTemplate', () => {
    const btn = document.getElementById('dBtnApplyContinue') as HTMLButtonElement
    expect(btn).toBeTruthy()
    expect(btn.disabled, 'abilitato: c\'è un template applicato').toBe(false)
    // jsdom in questa suite non esegue gli attributi onclick inline (convenzione
    // già usata altrove nel repo, es. tests/hub/welcome-prefs.test.ts): si
    // verifica il cablaggio sull'attributo, poi si esercita la stessa azione
    // via window.showView, come farebbe davvero il click.
    expect(btn.getAttribute('onclick')).toBe("showView('elenco')")
    w.showView('elenco')
    expect((document.getElementById('viewElenco') as HTMLElement).hidden, 'viewElenco visibile').toBe(false)
    expect((document.getElementById('viewTemplate') as HTMLElement).hidden, 'viewTemplate nascosta').toBe(true)
  })

  it('un campo con espressione NON semplice preesistente mostra il pannello Avanzate invece del select/chip, e si risolve comunque', () => {
    const state = seed()
    // Composizione multi-token, come i cartigli già in corso (Protocollo Tavola):
    // simpleExprParts la classifica come «non semplice».
    state.fields = [
      { id: 'adv', kind: 'variable', label: 'Protocollo Tavola', x: 0.2, y: 0.2, anchor: 'tl', align: 'left', fontFrac: 0.03, expr: '{TITOLO CARTIGLIO}-{CODICE ELABORATO}' },
    ]
    apply(state)
    selectField('adv')
    const details = document.querySelector('.d-advanced') as HTMLDetailsElement
    expect(details, 'pannello Avanzate presente per espressione complessa').toBeTruthy()
    expect(details.querySelector('summary')?.textContent, 'segnala espressione personalizzata').toContain('espressione personalizzata')
    const ta = details.querySelector('#dPropExpr') as HTMLTextAreaElement
    expect(ta.value).toBe('{TITOLO CARTIGLIO}-{CODICE ELABORATO}')
    // Il select Sorgente/i chip Formato restano nel pannello (permettono di
    // RIMPIAZZARE l'espressione con una semplice), ma nessuno rispecchia
    // l'espressione complessa esistente: nessuna colonna/formato risulta
    // selezionato, quindi cambiarli non la sostituisce a sua insaputa.
    const src = document.getElementById('dPropSource') as HTMLSelectElement
    expect(src.value, 'nessuna colonna preselezionata per un\'espressione non semplice').toBe('')
    const selectedChip = document.querySelector('.d-chip[data-fmt].is-sel')
    expect(selectedChip?.getAttribute('data-fmt'), 'solo "Come nel file" (fn assente) può risultare selezionato, mai un fn reale').toBe('')
    // Retrocompatibilità: si risolve comunque correttamente sull'engine condiviso.
    const f = statoMod.S.fields.find((x: { id: string }) => x.id === 'adv')
    expect(fieldText(f, state.elenco!.rows[0])).toBe('quadro di bassa tensione-A123_E_EL_QE01')
    const cover = resolveCover(statoMod.S, 0)!
    expect(cover.fields[0].text).toBe('quadro di bassa tensione-A123_E_EL_QE01')
  })
})

/* Editor dei campi su richiesta esplicita (setTemplateMode).
   A riposo la vista Template mostra solo Home (upload+libreria); canvas/lista
   campi/proprietà vivono in #dTemplateEditorWrap, aperto solo dal pulsante
   dedicato, e chiuderlo NON tocca S.fields. */
describe('vista Template: Home a riposo, editor campi su richiesta', () => {
  beforeEach(() => {
    apply(seed())
  })

  it('Home pulita: con template applicato ma editor mai aperto, canvas/lista campi/proprietà non sono nella porzione visibile', () => {
    // apply() lascia setTemplateMode al suo default ('home'): non lo richiamiamo.
    const home = document.getElementById('dTemplateHome') as HTMLElement
    const editor = document.getElementById('dTemplateEditorWrap') as HTMLElement
    expect(home.hidden, 'Home visibile a riposo').toBe(false)
    expect(editor.hidden, 'editor (canvas+lista campi+proprietà) nascosto a riposo').toBe(true)
    // Il contenitore che ospita canvas/lista/proprietà è quello nascosto: basta
    // verificare che i tre nodi vivano dentro #dTemplateEditorWrap (nascosto),
    // non serve verificare offsetParent in jsdom (non calcola il layout).
    expect(editor.contains(document.getElementById('dEditorCanvas')), 'canvas dentro il wrapper nascosto').toBe(true)
    expect(editor.contains(document.getElementById('dFieldList')), 'lista campi dentro il wrapper nascosto').toBe(true)
    expect(editor.contains(document.getElementById('dFieldProps')), 'pannello proprietà dentro il wrapper nascosto').toBe(true)
    expect(editor.contains(document.getElementById('dFieldPropsEmpty')), 'empty-state proprietà dentro il wrapper nascosto').toBe(true)
  })

  it('anteprima in blocco autonomo sopra la scelta del template, con avviso se non ci sono ancora campi', () => {
    const home = document.getElementById('dTemplateHome') as HTMLElement
    const previewBlock = document.getElementById('dTemplatePreviewBlock') as HTMLElement
    const warn = document.getElementById('dTemplateFieldsWarn') as HTMLElement
    expect(previewBlock.hidden, 'blocco anteprima visibile con template applicato').toBe(false)
    // seed() ha già un campo: nessun avviso.
    expect(warn.hidden, 'nessun avviso: seed() ha già un campo variabile').toBe(true)
    // L'anteprima precede nel DOM la scheda «Template della copertina»: è lei
    // la protagonista, la scelta del template scende sotto.
    const children = Array.from(home.children)
    const introCard = children.find(c => c.querySelector('#dTemplateFile'))
    expect(children.indexOf(previewBlock), 'anteprima prima della scheda di caricamento').toBeLessThan(children.indexOf(introCard as Element))

    // Senza campi: l'avviso compare.
    setS({ ...seed(), fields: [] })
    renderAll()
    w.showView('template')
    expect((document.getElementById('dTemplateFieldsWarn') as HTMLElement).hidden, 'avviso visibile: template applicato ma nessun campo creato').toBe(false)
  })

  it('l\'anteprima si aggiorna tornando alla Home dopo aver creato un campo nell\'Editor, senza un giro completo di renderTemplate()', () => {
    setS({ ...seed(), fields: [] })
    renderAll()
    w.showView('template')
    expect((document.getElementById('dTemplateFieldsWarn') as HTMLElement).hidden, 'precondizione: avviso visibile senza campi').toBe(false)

    w.setTemplateMode('editor')
    w.addField('fixed') // stesso percorso reale: crea il campo, NON richiama renderTemplate()
    expect(statoMod.S.fields.length, 'il campo è stato creato').toBeGreaterThan(0)

    w.setTemplateMode('home') // «Torna al template»
    expect((document.getElementById('dTemplateFieldsWarn') as HTMLElement).hidden, 'avviso sparito: l\'anteprima si è aggiornata al rientro in Home').toBe(true)
  })

  it('editor su richiesta: dBtnToggleEditor disabilitato senza template, abilitato con template; le azioni sui campi esistono SOLO nell\'Editor (nascoste in Home, non solo disabilitate)', () => {
    setS({ v: 1, template: null, fields: [] })
    renderAll()
    w.showView('template')
    const toggleBtn = document.getElementById('dBtnToggleEditor') as HTMLButtonElement
    const fieldActions = document.getElementById('dTemplateBarFields') as HTMLElement
    expect(toggleBtn.disabled, 'disabilitato senza template applicato').toBe(true)
    expect(fieldActions.hidden, 'azioni sui campi nascoste in Home: non c\'è nulla su cui agire finché l\'editor non è aperto').toBe(true)

    apply(seed())
    expect(toggleBtn.disabled, 'abilitato con template applicato').toBe(false)
    expect(fieldActions.hidden, 'ancora nascoste: template applicato ma editor non ancora aperto').toBe(true)

    w.setTemplateMode('editor')
    const home = document.getElementById('dTemplateHome') as HTMLElement
    const editor = document.getElementById('dTemplateEditorWrap') as HTMLElement
    expect(editor.hidden, 'editor visibile dopo setTemplateMode(\'editor\')').toBe(false)
    expect(home.hidden, 'Home nascosta a editor aperto').toBe(true)
    expect(fieldActions.hidden, 'azioni sui campi visibili solo a editor aperto').toBe(false)
    expect(toggleBtn.textContent, 'il pulsante di toggle cambia etichetta invece di spostarsi (resta fisso in barra)').toContain('Torna al template')

    w.setTemplateMode('home')
    expect(fieldActions.hidden, 'tornando in Home le azioni sui campi spariscono di nuovo').toBe(true)
  })

  it('torna al template senza perdere i campi: setTemplateMode(\'home\') dopo aver aperto l\'editor lascia S.fields invariato', () => {
    w.setTemplateMode('editor')
    const fieldsBefore = statoMod.S.fields
    expect(fieldsBefore.length, 'precondizione: almeno un campo presente').toBeGreaterThan(0)

    w.setTemplateMode('home')
    const home = document.getElementById('dTemplateHome') as HTMLElement
    const editor = document.getElementById('dTemplateEditorWrap') as HTMLElement
    expect(home.hidden, 'torna a Home').toBe(false)
    expect(editor.hidden, 'editor di nuovo nascosto').toBe(true)
    expect(statoMod.S.fields, 'i campi restano invariati: non svuotati né alterati dalla chiusura').toEqual(fieldsBefore)
    expect(statoMod.S.fields.length).toBe(fieldsBefore.length)
  })
})
