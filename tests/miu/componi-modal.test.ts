// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { FRASARIO, componiDescrizione, suggerisciFamiglia } from '../../src/shared/compositore/componi'
import { miuSource } from './miu-src'

/**
 * Modal «Componi descrizione» in μ.
 *
 * Rilievo utente: il punto 4 «aggancio a voce di prezzario» (sola lettura, con
 * badge di coerenza) è stato tolto — troppo limitante non poter editare la voce.
 * Al suo posto un EDITOR modificabile (punto 4): l'anteprima (punto 3) resta
 * generata e di sola lettura come riferimento; «usa anteprima» la trasferisce
 * nell'editor, che poi l'utente rifinisce liberamente. Aggiunta anche la
 * famiglia PERSONALIZZATA (poche categorie nel thesaurus: a volte serve una
 * voce ad hoc non presente nel motore).
 *
 * Convenzione dei test DOM di μ: contratto sul markup/sorgente inline di
 * index.html + flusso utente che replica la logica inline (renderComponi/
 * cmpEditorPull/cmpCopy) sopra il motore REALE (componiDescrizione), in
 * jsdom — niente e2e/browser.
 */

const html = miuSource()
const indexDom = (): Document => new JSDOM(html).window.document

// stato + render replicati fedelmente dalla logica inline (renderComponi)
interface Cmp {
  fam: string | null; custom: string | null
  misura: string | null; materiale: string | null; posa: string | null; opzioni: string[]
  edBreve: string | null; edEstesa: string | null; genBreve: string; genEstesa: string
}
function apri(doc: Document, row: { desc_short?: string; declaratoria?: string } | null): Cmp {
  const cmp: Cmp = { fam: null, custom: null, misura: null, materiale: null, posa: null, opzioni: [], edBreve: null, edEstesa: null, genBreve: '', genEstesa: '' }
  if (row) cmp.fam = suggerisciFamiglia((row.desc_short || '') + ' ' + (row.declaratoria || ''))
  doc.getElementById('componi-overlay')!.classList.add('open')
  render(doc, cmp)
  return cmp
}
const CMP_MACRO_ORDER = ['IMPIANTI ELETTRICI', 'ILLUMINAZIONE', 'IMPIANTI SPECIALI', 'IMPIANTI MECCANICI', 'IMPIANTI ANTINCENDIO'] as const
function render(doc: Document, cmp: Cmp): void {
  // replica di renderComponi: famiglie raggruppate per macrotema (una famiglia con più
  // macrotemi compare in ognuno), ogni gruppo nel proprio .cmp-fam-grid annidato
  const famChip = (f: typeof FRASARIO[number]): string =>
    `<span class="cmp-fam-chip${f.famigliaId === cmp.fam ? ' active' : ''}" data-fam="${f.famigliaId}">${f.nome}</span>`
  let famHtml = ''
  for (const m of CMP_MACRO_ORDER) {
    // il picker nasconde le famiglie «facili a prezzario» (cavi/condotti)
    const group = FRASARIO.filter(f => !f.facilePrezzario && f.macro.includes(m))
    if (!group.length) continue
    famHtml += `<div class="cmp-acc"><div class="cmp-acc-hd">${m}</div><div class="cmp-acc-body"><div class="cmp-fam-grid">${group.map(famChip).join('')}</div></div></div>`
  }
  doc.getElementById('cmp-fam-grid-wrap')!.innerHTML = famHtml
  const fr = FRASARIO.find(f => f.famigliaId === cmp.fam)
  // Didascalia famiglia fuori prezzario, in cima a #cmp-chars (replica fedele di renderComponi)
  doc.getElementById('cmp-chars')!.innerHTML =
    fr && fr.fuoriPrezzario && fr.nota ? `<div class="cmp-rule-note cmp-fuori-prezzario">⚠ ${fr.nota}</div>` : ''
  let breve = '', estesa = ''
  if (fr) {
    const d = componiDescrizione({ famigliaId: fr.famigliaId, misura: cmp.misura ?? undefined, materiale: cmp.materiale ?? undefined, posa: cmp.posa ?? undefined, opzioni: cmp.opzioni })
    breve = d.breve; estesa = d.estesa
  } else if (cmp.custom) {
    breve = cmp.custom.charAt(0).toUpperCase() + cmp.custom.slice(1)
    estesa = `Fornitura e posa in opera di ${cmp.custom.toLowerCase()}, inclusi accessori di fissaggio e quota parte di sfridi, in opera a regola d'arte.`
  }
  cmp.genBreve = breve; cmp.genEstesa = estesa
  doc.getElementById('cmp-step-tag')!.textContent = cmp.custom ? 'famiglia personalizzata' : 'voce di computo'
  // l'editor È la voce: finché non toccato (ed null) mostra live il composto
  ;(doc.getElementById('cmp-ed-breve') as HTMLInputElement).value = cmp.edBreve ?? cmp.genBreve ?? ''
  ;(doc.getElementById('cmp-ed-estesa') as HTMLTextAreaElement).value = cmp.edEstesa ?? cmp.genEstesa ?? ''
}
// cmpSet inline: singola con deseleziona, multipla per opzioni
function set(cmp: Cmp, group: 'misura' | 'materiale' | 'posa' | 'opzioni', value: string): void {
  if (group === 'opzioni') {
    const i = cmp.opzioni.indexOf(value)
    if (i >= 0) cmp.opzioni.splice(i, 1); else cmp.opzioni.push(value)
  } else {
    cmp[group] = cmp[group] === value ? null : value
  }
}
// cmpPickFam inline: cambio famiglia azzera caratteristiche ED editor
function pickFam(cmp: Cmp, id: string): void {
  cmp.fam = id; cmp.custom = null; cmp.misura = null; cmp.materiale = null; cmp.posa = null; cmp.opzioni = []
  cmp.edBreve = null; cmp.edEstesa = null
}
// cmpEditorPull inline («↺ rigenera»: scarta le modifiche, torna alla sync live)
function pull(cmp: Cmp, kind: 'breve' | 'estesa'): void {
  if (kind === 'breve') cmp.edBreve = null; else cmp.edEstesa = null
}
// cmpCopy inline: preferisce l'editor, altrimenti l'anteprima generata
function cmpCopy(cmp: Cmp, kind: 'breve' | 'estesa', write: (s: string) => void): void {
  const ed = kind === 'breve' ? cmp.edBreve : cmp.edEstesa
  const gen = kind === 'breve' ? cmp.genBreve : cmp.genEstesa
  const txt = (ed != null && ed.trim() !== '' ? ed : gen).trim()
  if (!txt) return
  write(txt)
}

describe('contratto DOM del modal', () => {
  it('markup: overlay, mini-ricerca famiglie, chips, editor (unica superficie voce), famiglia personalizzata, footer copia', () => {
    const doc = indexDom()
    expect(doc.getElementById('componi-overlay')).toBeTruthy()
    expect(doc.getElementById('cmp-fam-search')).toBeTruthy()
    expect(doc.getElementById('cmp-fam-grid-wrap')).toBeTruthy()
    expect(doc.getElementById('cmp-chars')).toBeTruthy()
    // niente più anteprima separata: l'editor è l'unica superficie della voce
    expect(doc.getElementById('cmp-prev-breve')).toBeFalsy()
    expect(doc.getElementById('cmp-prev-estesa')).toBeFalsy()
    // bandierina accentata nel footer per passare all'Analisi Prezzi (e tornare)
    expect(doc.querySelector('#cmp-ft-desc .cmp-mode-flag')).toBeTruthy()
    expect(doc.querySelector('#cmp-ft-ap .cmp-mode-flag.back')).toBeTruthy()
    // editor modificabile al posto dell'aggancio a voce di prezzario
    expect(doc.getElementById('cmp-anchor')).toBeFalsy()
    expect(doc.getElementById('cmp-ed-breve')).toBeTruthy()
    expect(doc.getElementById('cmp-ed-estesa')).toBeTruthy()
    // famiglia personalizzata
    expect(doc.getElementById('cmp-custom-input')).toBeTruthy()
    // regola «se non c'è non si menziona», dichiarata all'utente
    expect(doc.querySelector('.cmp-rule-note')!.textContent).toContain('se non c\'è non si menziona')
  })

  it('aperture: bottone in toolbar (senza voce) e dal pannello dettaglio (suggerimento famiglia)', () => {
    const doc = indexDom()
    const toolbar = doc.getElementById('componi-btn')!
    expect(toolbar.getAttribute('onclick')).toBe('openComponi()')
    const dett = doc.getElementById('detail-compose')!
    expect(dett.closest('#detail-actions')).toBeTruthy()
    expect(dett.getAttribute('onclick')).toBe('openComponiFromDetail()')
    expect(html).toContain('function openComponiFromDetail(){ if(_detailRow) openComponi(_detailRow); }')
    expect(html).toContain('window.suggerisciFamiglia')
  })

  it('la sorgente inline usa il motore puro esposto su window (cutover)', () => {
    for (const fn of ['window.FRASARIO', 'window.componiDescrizione']) {
      expect(html).toContain(fn)
    }
    // esc chiude, ri-clic sul chip deseleziona
    expect(html).toContain("if(e.key==='Escape'){ e.stopPropagation(); closeComponi(); }")
    expect(html).toContain("CMP[group] = (CMP[group]===value) ? null : value;")
    // cambio famiglia azzera anche l'editor (non trascina testo di un componente diverso)
    expect(html).toContain('CMP.edBreve=null; CMP.edEstesa=null;')
  })
})

describe('caratteristiche a righe piatte (rilievo utente/Livia)', () => {
  it('la sorgente inline compone le caratteristiche a RIGHE (charRow), non più ad accordion', () => {
    expect(html).toContain('const charRow=')                       // helper riga «label | chip»
    expect(html).toContain("charRow('Materiale'")
    expect(html).toContain("charRow('Posa'")
    expect(html).toContain("charRow('Opzioni")
    expect(html).not.toContain("cmpAcc('inizio', 'Inizio voce'")   // niente più accordion sulle caratteristiche
    expect(html).toContain('function cmpPrezzarioMisure(fr){')
    // niente più anteprima separata: la battitura anima direttamente l'EDITOR (value)
    expect(html).not.toContain('function cmpSetPreview(id, text){')
    expect(html).toContain('function cmpTypeValue(el, text){')
    // riusa il motore di ricerca (searchRows), nessun secondo algoritmo di ricerca
    expect(html).toMatch(/cmpPrezzarioMisure[\s\S]{0,300}window\.searchRows\(S\.allRows/)
  })
})

describe('battitura carattere-per-carattere sulla VOCE (editor .value)', () => {
  // replica fedele di cmpTypeValue: prefisso comune fermo, solo la coda nuova si
  // batte a intervalli; .typing-live segna il campo finché non ha finito.
  const TIMERS: Record<string, ReturnType<typeof setInterval>> = {}
  function typeValue(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
    const prev = el.dataset.prev || ''
    if (text === prev) return
    let i = 0
    const max = Math.min(prev.length, text.length)
    while (i < max && prev[i] === text[i]) i++
    el.dataset.prev = text
    if (TIMERS[el.id]) { clearInterval(TIMERS[el.id]); delete TIMERS[el.id] }
    const tail = text.slice(i)
    if (!text || !tail) { el.value = text; el.classList.remove('typing-live'); return }
    el.classList.add('typing-live')
    const stepMs = Math.max(4, Math.min(12, 400 / tail.length))
    let pos = 0
    TIMERS[el.id] = setInterval(() => {
      pos += 1
      el.value = text.slice(0, i + pos)
      if (pos >= tail.length) { clearInterval(TIMERS[el.id]); delete TIMERS[el.id]; el.classList.remove('typing-live') }
    }, stepMs)
  }

  it('il prefisso invariato resta fermo, solo la coda nuova si batte; cursore attivo durante', () => {
    vi.useFakeTimers()
    const doc = indexDom()
    const el = doc.getElementById('cmp-ed-estesa') as HTMLTextAreaElement
    typeValue(el, 'Tubo rigido ⌀ 25 mm')
    expect(el.classList.contains('typing-live')).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(el.value).toBe('Tubo rigido ⌀ 25 mm')
    expect(el.classList.contains('typing-live')).toBe(false)
    typeValue(el, 'Tubo rigido ⌀ 25 mm in PVC serie media')
    expect(el.value).toBe('Tubo rigido ⌀ 25 mm') // il prefisso non si ritocca
    vi.advanceTimersByTime(1000)
    expect(el.value).toBe('Tubo rigido ⌀ 25 mm in PVC serie media')
    vi.useRealTimers()
  })

  it('un nuovo chip prima che la battitura finisca: interrompe e riparte pulito', () => {
    vi.useFakeTimers()
    const doc = indexDom()
    const el = doc.getElementById('cmp-ed-breve') as HTMLInputElement
    typeValue(el, 'Estintore a polvere 6 kg con cartello segnalatore')
    vi.advanceTimersByTime(20)
    expect(el.value.length).toBeGreaterThan(0)
    expect(el.value.length).toBeLessThan('Estintore a polvere 6 kg con cartello segnalatore'.length)
    typeValue(el, 'Estintore a CO₂ 6 kg')
    vi.advanceTimersByTime(1000)
    expect(el.value).toBe('Estintore a CO₂ 6 kg')
    vi.useRealTimers()
  })

  it('la sorgente inline ferma la battitura al primo input utente (non gli scrive sopra)', () => {
    expect(html).toMatch(/cmpEditorInput[\s\S]{0,400}clearInterval\(CMP_TYPE_TIMERS\[el\.id\]\)/)
  })
})

describe('flusso utente (logica inline replicata sul motore reale)', () => {
  // Open E.Hub non distribuisce il catalogo reale (FRASARIO arriva vuoto dallo
  // stub compositore-catalog:*, vedi vite.config.ts): qui il flusso si esercita
  // con una famiglia SINTETICA registrata in FRASARIO (nessun dato proprietario).
  const FAM_TEST: (typeof FRASARIO)[number] = {
    famigliaId: '__test-estintore__',
    nome: 'componente di prova',
    soggettoBreve: 'Componente di prova',
    soggettoEsteso: 'componente di prova',
    umTipiche: ['cad'],
    misura: { etichetta: 'misura', valori: ['6 kg', '9 kg'] },
    opzioni: ['a polvere'],
    macro: ['IMPIANTI ANTINCENDIO'],
  }
  const FAM_TEST_2: (typeof FRASARIO)[number] = {
    ...FAM_TEST, famigliaId: '__test-idrante__', nome: 'altro componente di prova', soggettoEsteso: 'altro componente di prova',
  }

  beforeEach(() => { FRASARIO.push(FAM_TEST, FAM_TEST_2) })
  afterEach(() => {
    for (const id of ['__test-estintore__', '__test-idrante__']) {
      const i = FRASARIO.findIndex(f => f.famigliaId === id)
      if (i !== -1) FRASARIO.splice(i, 1)
    }
  })

  it('apertura da toolbar: nessuna famiglia, editor vuoto', () => {
    const doc = indexDom()
    apri(doc, null)
    expect(doc.getElementById('cmp-step-tag')!.textContent).toBe('voce di computo')
    expect((doc.getElementById('cmp-ed-breve') as HTMLInputElement).value).toBe('')
    expect((doc.getElementById('cmp-ed-estesa') as HTMLTextAreaElement).value).toBe('')
    // ogni famiglia non «facile a prezzario» diventa un chip, una volta per
    // ciascun macrotema d'appartenenza (invariante, indipendente dal catalogo)
    const expected = FRASARIO.filter(f => !f.facilePrezzario)
      .reduce((n, f) => n + f.macro.filter(m => (CMP_MACRO_ORDER as readonly string[]).includes(m)).length, 0)
    expect(doc.querySelectorAll('#cmp-fam-grid-wrap .cmp-fam-chip').length).toBe(expected)
  })

  it('toggle chip aggiorna la voce nell\'editor: selezione, cambio e deselezione («se non c\'è non si menziona»)', () => {
    const doc = indexDom()
    const cmp = apri(doc, null)
    const edB = () => (doc.getElementById('cmp-ed-breve') as HTMLInputElement).value
    cmp.fam = '__test-estintore__'
    set(cmp, 'misura', '6 kg'); render(doc, cmp)
    expect(edB()).toBe('Componente di prova 6 kg')
    set(cmp, 'opzioni', 'a polvere'); render(doc, cmp)
    expect(edB()).toContain('a polvere')
    set(cmp, 'opzioni', 'a polvere'); render(doc, cmp)
    expect(edB()).not.toContain('a polvere')
  })

  it('la voce si compone live nell\'editor; la modifica manuale resta, «↺ rigenera» riaggancia', () => {
    const doc = indexDom()
    const cmp = apri(doc, null)
    const edE = () => (doc.getElementById('cmp-ed-estesa') as HTMLTextAreaElement).value
    cmp.fam = '__test-estintore__'; set(cmp, 'misura', '6 kg'); render(doc, cmp)
    expect(edE()).toContain('componente di prova') // auto-sincronizzato: la voce È già nell'editor
    // l'utente modifica a mano: il testo diventa suo e i chip non lo toccano più
    cmp.edEstesa = 'Fornitura e posa di un componente speciale su misura del cliente.'
    render(doc, cmp)
    expect(edE()).toContain('speciale su misura')
    set(cmp, 'opzioni', 'a polvere'); render(doc, cmp)
    expect(edE()).toContain('speciale su misura') // il chip non sovrascrive il testo utente
    // «↺ rigenera»: scarta la modifica e torna alla sincronizzazione live
    pull(cmp, 'estesa'); render(doc, cmp)
    expect(edE()).toContain('componente di prova')
    expect(edE()).not.toContain('speciale su misura')
  })

  it('cambio famiglia azzera l\'editor: il testo modificato apparteneva a un componente diverso', () => {
    const doc = indexDom()
    const cmp = apri(doc, null)
    cmp.fam = '__test-estintore__'; render(doc, cmp)
    pull(cmp, 'breve'); pull(cmp, 'estesa')
    cmp.edEstesa = 'testo modificato a mano'
    pickFam(cmp, '__test-idrante__'); render(doc, cmp)
    expect(cmp.edBreve).toBeNull()
    expect(cmp.edEstesa).toBeNull()
    // l'editor torna in sync live: mostra la voce della NUOVA famiglia, niente testo trascinato
    const v = (doc.getElementById('cmp-ed-estesa') as HTMLTextAreaElement).value
    expect(v).toContain('altro componente di prova')
    expect(v).not.toContain('testo modificato a mano')
  })

  it('famiglia personalizzata: nessuna famiglia nota, genera un punto di partenza generico', () => {
    const doc = indexDom()
    const cmp = apri(doc, null)
    cmp.custom = 'Griglia di areazione su misura'; render(doc, cmp)
    expect(doc.getElementById('cmp-step-tag')!.textContent).toBe('famiglia personalizzata')
    expect((doc.getElementById('cmp-ed-breve') as HTMLInputElement).value).toBe('Griglia di areazione su misura')
    expect((doc.getElementById('cmp-ed-estesa') as HTMLTextAreaElement).value).toMatch(/^Fornitura e posa in opera di griglia di areazione su misura/)
  })

  it('copia negli appunti (clipboard mockata): editor se popolato, altrimenti il composto; niente copia a vuoto', () => {
    const doc = indexDom()
    const cmp = apri(doc, null)
    const write = vi.fn()
    cmpCopy(cmp, 'breve', write)
    expect(write).not.toHaveBeenCalled() // nessuna famiglia ⇒ niente da copiare
    cmp.fam = '__test-estintore__'; set(cmp, 'misura', '6 kg'); set(cmp, 'opzioni', 'a polvere'); render(doc, cmp)
    cmpCopy(cmp, 'estesa', write)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0]![0]).toMatch(/^Fornitura e posa in opera di componente di prova/)
    // ora l'utente modifica l'editor: la copia preferisce il testo editato
    write.mockClear()
    pull(cmp, 'estesa')
    cmp.edEstesa = 'Versione rifinita a mano dall\'utente.'
    cmpCopy(cmp, 'estesa', write)
    expect(write).toHaveBeenCalledWith('Versione rifinita a mano dall\'utente.')
  })
})

describe('didascalia famiglia fuori prezzario nel compositore', () => {
  const FAM_FUORI: (typeof FRASARIO)[number] = {
    famigliaId: '__test-fuori-prezzario__', nome: 'componente fuori listino',
    soggettoBreve: 'Componente fuori listino', soggettoEsteso: 'componente fuori listino',
    umTipiche: ['cad'], macro: ['IMPIANTI SPECIALI'],
    fuoriPrezzario: true, nota: 'da analisi prezzi, non a listino',
  }
  const FAM_NORMALE: (typeof FRASARIO)[number] = {
    famigliaId: '__test-normale__', nome: 'componente a listino',
    soggettoBreve: 'Componente a listino', soggettoEsteso: 'componente a listino',
    umTipiche: ['cad'], macro: ['IMPIANTI SPECIALI'],
  }

  beforeEach(() => { FRASARIO.push(FAM_FUORI, FAM_NORMALE) })
  afterEach(() => {
    for (const id of ['__test-fuori-prezzario__', '__test-normale__']) {
      const i = FRASARIO.findIndex(f => f.famigliaId === id)
      if (i !== -1) FRASARIO.splice(i, 1)
    }
  })

  it('selezionando una famiglia fuoriPrezzario, la didascalia compare in #cmp-chars', () => {
    const doc = indexDom()
    const cmp = apri(doc, null)
    pickFam(cmp, '__test-fuori-prezzario__')
    render(doc, cmp)
    const chars = doc.getElementById('cmp-chars')!
    expect(chars.querySelector('.cmp-fuori-prezzario')).not.toBeNull()
    expect(chars.textContent).toContain('analisi prezzi')
  })

  it('selezionando una famiglia normale (a listino), la didascalia NON compare', () => {
    const doc = indexDom()
    const cmp = apri(doc, null)
    pickFam(cmp, '__test-normale__')
    render(doc, cmp)
    const chars = doc.getElementById('cmp-chars')!
    expect(chars.querySelector('.cmp-fuori-prezzario')).toBeNull()
  })

  it('senza famiglia selezionata, nessuna didascalia residua', () => {
    const doc = indexDom()
    const cmp = apri(doc, null)
    render(doc, cmp)
    expect(doc.getElementById('cmp-chars')!.innerHTML).toBe('')
  })
})
