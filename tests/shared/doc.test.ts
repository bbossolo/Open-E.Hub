import { describe, it, expect } from 'vitest'
import { renderDocPage, ehubBrand, escHtml, DOC_CSS, EHUB_BRAND_CSS } from '../../src/shared/doc'

/**
 * Sistema documentale unificato: il layer condiviso garantisce
 * — per OGNI documento della suite — accento per tool (data-tool), brand Open E.Hub
 * UNICO/condiviso e il cartiglio a piè di pagina, sul modello della tavola tecnica.
 */
describe('shared/doc — sistema documentale unificato', () => {
  const page = renderDocPage({
    tool: 'miu',
    kicker: 'Cables · Distinta',
    title: 'Documento di prova',
    sub: 'sottotitolo',
    headMeta: [{ k: 'Progetto', v: 'Acme' }],
    bodyHTML: '<p>corpo</p>',
    footer: { fields: [{ k: 'Data', v: '01/07/2026' }], disc: 'bozza', page: 'Pag. 1' },
  })

  it('imposta accento per tool via data-tool', () => {
    expect(page).toContain('data-tool="miu"')
    // gli accenti di tutti i tool sono definiti UNA volta in DOC_CSS
    for (const t of ['miu', 'beta']) expect(DOC_CSS).toContain(`html[data-tool="${t}"]`)
  })

  it('include il brand Open E.Hub condiviso (markup + CSS) nel cartiglio', () => {
    expect(page).toContain('ehub-brand')
    expect(ehubBrand()).toContain('ehub-brand')
    expect(DOC_CSS).toContain(EHUB_BRAND_CSS.trim().split('\n')[0].trim())
  })

  it('mostra brand + identità tool con accento + cartiglio (testata, corpo, footer)', () => {
    expect(page).toContain('dochead')           // testata col blocco tool
    expect(page).toContain('df-tooltag')         // tag tool tinto d’accento
    expect(page).toContain('docfoot')            // cartiglio a fascia
    expect(page).toContain('<p>corpo</p>')       // corpo passato così com’è
    expect(page).toContain('Documento di prova') // titolo in testata
  })

  it('con `company` mostra il LETTERHEAD dello studio in alto; senza → niente', () => {
    const conAzienda = renderDocPage({
      tool: 'miu', kicker: 'k', title: 'T', bodyHTML: '<p>x</p>',
      footer: { fields: [], disc: '' },
      company: { name: 'Studio Demo', address: 'Via E. Torricelli 37, Verona', logoHtml: '<span class="co-logo co-logo--ph">SD</span>' },
    })
    expect(conAzienda).toContain('<div class="doc-letterhead">')
    expect(conAzienda).toContain('Studio Demo')
    expect(conAzienda).toContain('Via E. Torricelli 37')
    expect(conAzienda).toContain('co-logo--ph')          // template logo
    expect(DOC_CSS).toContain('.doc-letterhead')          // stile letterhead
    // senza company nessun letterhead (l'ELEMENTO; la regola CSS resta nello style)
    expect(page).not.toContain('<div class="doc-letterhead">')
  })

  it('escapa le ETICHETTE ma lascia il body/valori al chiamante', () => {
    const p = renderDocPage({
      tool: 'beta', kicker: 'k', title: 'T', bodyHTML: '<table></table>',
      headMeta: [{ k: '<x>', v: 'v' }], footer: { fields: [], disc: '' },
    })
    expect(p).toContain('&lt;x&gt;')             // etichetta escapata
    expect(p).toContain('<table></table>')        // body intatto
    expect(escHtml('<a&"')).toBe('&lt;a&amp;&quot;')
  })
})

/**
 * UN MARCHIO SOLO, E STA IN FONDO.
 * In testa alla pagina c'è già la carta intestata dello studio — il logo che conta per chi
 * legge il documento — e l'ε tornava comunque nel piè di pagina: erano due volte lo stesso
 * marchio, in un foglio dove ogni segno deve guadagnarsi il posto.
 */
describe('documenti: il marchio ε sta nel piè di pagina, non in testa', () => {
  const pagina = renderDocPage({
    tool: 'miu',
    kicker: 'Prezzi · Analisi Prezzi',
    title: 'Voce di prova',
    docTitle: 'Analisi Prezzi',
    bodyHTML: '<p>corpo</p>',
    footer: { fields: [], disc: 'Elaborato non vincolante.', page: 'Pag. 1' },
  })

  it('il marchio compare UNA volta sola in tutta la pagina', () => {
    expect(pagina.split('class="ehub-brand"').length - 1).toBe(1)
  })

  it('e quella volta è nel piè di pagina', () => {
    const foot = pagina.slice(pagina.indexOf('<footer'))
    expect(foot).toContain('class="ehub-brand"')
  })

  it('in testa non resta nemmeno il nome del tool: a dirlo è il kicker', () => {
    const head = pagina.slice(pagina.indexOf('<header'), pagina.indexOf('</header>'))
    expect(head).not.toContain('class="ehub-brand"')
    expect(head).not.toContain('dochead__tool')
    // «Price» da solo non dice nulla — viveva come coda del lockup ε. Il kicker sì.
    expect(head).toContain('Prezzi · Analisi Prezzi')
  })

  it('il piè di pagina firma il documento: marchio + tool', () => {
    const foot = pagina.slice(pagina.indexOf('<footer'))
    expect(foot).toContain('df-lockup')
    expect(foot).toContain('Prezzi')
  })
})
