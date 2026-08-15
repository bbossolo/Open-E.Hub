import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { miuSource } from './miu-src'

/**
 * Tre fix UI del Computo Metrico:
 *  1. Elenco Prezzi FLOTTANTE, persistente fuori da #cart-overlay (non più un
 *     dock #cart-ov-ep-dock dentro l'overlay, sostituito da mountEpFloat/wireEpFloat):
 *     sopravvive al cambio vista/modo perché openCart() lo AGGIORNA (non lo ricrea),
 *     si trascina/ridimensiona/nasconde, e non è più condizionato a CART_MODE==='misura'.
 *  2. Il riquadro del lazo (selezione a trascinamento) usava --accent-soft
 *     (color-mix fra due colori OPACHI ⇒ risultato opaco): copriva le righe
 *     sotto durante il trascinamento invece di lasciarle intravedere.
 *  3. Vista "Capitoli": raggruppa le voci per disciplina/sistema/settore del
 *     prezzario sorgente (automatico), accanto a Tabella/Elenco/Categorie.
 */
const html = miuSource()
const css = readFileSync(resolve(__dirname, '../../src/tools/miu/styles/pricelist.css'), 'utf8')

describe('Computo Metrico — Elenco Prezzi FLOTTANTE, persistente fuori dall\'overlay', () => {
  it('#cart-ov-body è flex:1 (riempie tutto lo spazio residuo, niente più dock impilato sotto)', () => {
    expect(html).toMatch(/<div style="flex:1;overflow:auto;padding:4px 20px" id="cart-ov-body"/)
  })
  it('il vecchio dock #cart-ov-ep-dock è sparito: nessun codice morto residuo', () => {
    expect(html).not.toContain('cart-ov-ep-dock')
  })
  it('mountEpFloat viene chiamato in coda a openCart(), dopo aver montato #cart-overlay nel body', () => {
    const i = html.indexOf('function openCart(')
    const body = html.slice(i, i + 20000)
    const iAppend = body.indexOf('document.body.appendChild(ov)')
    const iMount = body.indexOf('mountEpFloat(map)')
    expect(iAppend).toBeGreaterThan(-1)
    expect(iMount).toBeGreaterThan(iAppend)
  })
  it('mountEpFloat AGGIORNA il pannello se già montato, non lo ricrea (sopravvive al refresh/cambio vista)', () => {
    const fn = html.match(/function mountEpFloat\(map\)\{[\s\S]*?\n}/)?.[0] ?? ''
    expect(fn).toContain("document.getElementById('ep-float-wrap')")
    expect(fn).toContain('existing.innerHTML=epFloatHtml(map, epFloatState())')
  })
  it('il pannello si nasconde in una pillola (epFloatClose) e riappare dov\'era (epFloatOpen)', () => {
    expect(html).toContain('function epFloatClose(){ epFloatSave({ closed:true }); refreshCartOverlayIfOpen(); }')
    expect(html).toContain('function epFloatOpen(){ epFloatSave({ closed:false }); refreshCartOverlayIfOpen(); }')
    expect(html).toContain('class="ep-pill"')
  })
  it('setStep() e closeCart() rimuovono #ep-float-wrap insieme a #cart-overlay (non resta orfano fuori dal Computo)', () => {
    const step = html.match(/function setStep\(step\)\{[\s\S]*?\n}/)?.[0] ?? ''
    expect(step).toContain("document.querySelectorAll('#ep-float-wrap').forEach(el=>el.remove())")
    const close = html.match(/function closeCart\(\)\{[\s\S]*?\n}/)?.[0] ?? ''
    expect(close).toContain("document.querySelectorAll('#ep-float-wrap').forEach(el=>el.remove())")
  })
})

describe('Computo Metrico — vista "Capitoli" (raggruppa per disciplina/sistema/settore del prezzario)', () => {
  it('è una terza voce di cartViewSwitchHtml, accanto a Tabella/Elenco', () => {
    expect(html).toContain("const views=[['tabella','Tabella'],['elenco','Elenco'],['capitoli','Capitoli']]")
  })
  it('openCart() la sceglie quando CART_VIEW==="capitoli"', () => {
    expect(html).toMatch(/CART_VIEW==='capitoli' \? cartBodyCapitoliHtml\(map\)/)
  })
  it('le voci-foglia sono .cm-sel-row: ereditano gratis click/lazo/context-menu/assegna-categoria da wireCartSelection', () => {
    const fn = html.match(/function cartCapitoliVoceHtml\(item,depth\)\{[\s\S]*?\n}/)?.[0] ?? ''
    expect(fn).toContain('class="cm-lrow cm-sel-row" data-key=')
  })
  it('le voci composte (S.custom, senza disciplina/sistema/settore) cadono sotto "(Senza capitolo)"', () => {
    const fn = html.match(/function cartCapitoliGroups\(map\)\{[\s\S]*?\n}/)?.[0] ?? ''
    expect(fn).toContain("push(['(Senza capitolo)']")
  })
})

describe('Computo Metrico — lazo trasparente durante il trascinamento', () => {
  it('.cart-lasso-box non usa più --accent-soft (opaco), ma un color-mix esplicitamente trasparente', () => {
    const rule = css.match(/\.cart-lasso-box\s*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).not.toContain('var(--accent-soft)')
    expect(rule).toMatch(/color-mix\(in srgb, var\(--accent\) \d+%, transparent\)/)
  })
})

/**
 * IL COMPUTO METRICO SI RIORDINA — quattro cose dette dall'utente.
 * · «Tabella è Misura, corretto; Categorie è Categorizza… ma Elenco torna indietro a Misura»:
 *   erano tre viste di cui una era in realtà un altro PASSO. Ora Misura e Categorizza sono
 *   due PANNELLI, e Tabella/Elenco due viste dentro Misura.
 * · «Tutte le liste devono avere il lazo»: il lazo partiva solo dallo spazio vuoto fra le
 *   righe — e in Tabella/Elenco, fitte, spazio vuoto non ce n'è.
 * · L'Elenco Prezzi (oggi flottante) resta indipendente dalla fase.
 * · Dall'Elenco Prezzi si trascina una voce dentro le misurazioni.
 */
describe('Computo Metrico — Misura e Categorizza sono due pannelli, non tre viste', () => {
  it('le viste sono Tabella/Elenco/Capitoli (Categorie non è una vista: è un passo)', () => {
    expect(html).toContain("const views=[['tabella','Tabella'],['elenco','Elenco'],['capitoli','Capitoli']]")
    expect(html).not.toMatch(/const views=\[\[.*'categorie'/)
  })

  it('Categorizza è un MODO del pannello, e sceglierlo non passa da una vista', () => {
    expect(html).toMatch(/CART_MODE = 'misura'/)  // default in stato.js
    expect(html).toMatch(/if\(step==='categorizza'\)\{ setCartMode\('categorizza'\); openCart\(\); \}/)
    expect(html).toMatch(/CART_MODE==='categorizza' \? cartBodyCategorieHtml\(map\)/)
  })

  it('scegliere una vista ti porta su Misura: il binario non dice una cosa e la schermata un\'altra', () => {
    const i = html.indexOf('function cartSetView')
    const body = html.slice(i, i + 420)
    expect(body).toMatch(/setCartMode\('misura'\)/)
    expect(body).toMatch(/_syncRail\('misura'\)/)
  })

  it('il selettore vista (Tabella/Elenco/Capitoli) resta solo di Misura — in Categorizza non c\'è nulla da commutare', () => {
    expect(html).toMatch(/if\(CART_MODE!=='misura'\) return ''; \/\/ in Categorizza/)
  })
  it('l\'Elenco Prezzi FLOTTANTE non è più condizionato a CART_MODE: resta visibile anche in Categorizza', () => {
    // mountEpFloat() è chiamato incondizionatamente in coda a openCart(), non dietro
    // un CART_MODE==='misura' come il vecchio dock
    const i = html.indexOf('function openCart(')
    const body = html.slice(i, i + 20000)
    expect(body).not.toMatch(/CART_MODE==='misura' \? elencoPrezziPanelHtml/)
    expect(body).toContain('mountEpFloat(map)')
  })
})

describe('Computo Metrico — il lazo funziona su TUTTE le liste', () => {
  it('il lazo parte anche da SOPRA una voce, non solo dai buchi fra le righe', () => {
    const i = html.indexOf("bodyEl.addEventListener('mousedown'")
    const body = html.slice(i, i + 620)
    // la vecchia guardia che lo rendeva inutilizzabile in Tabella/Elenco non c'è più
    expect(body).not.toContain("e.target.closest('.cm-sel-row')")
    // ...ma i comandi veri restano cliccabili
    expect(body).toContain("e.target.closest('button')")
    expect(body).toContain("e.target.closest('input')")
    // e il tasto destro apre il menu, non traccia un lazo
    expect(body).toContain('if(e.button!==0) return')
  })

  it('clic e trascinamento si distinguono per il MOVIMENTO (5 px), non per dove premi', () => {
    const i = html.indexOf('function onMove')
    const body = html.slice(i, i + 520)
    expect(body).toMatch(/<5 && Math\.abs\(e\.pageY-lassoStart\.y\)<5\) return/)
    expect(body).toContain('_cartLassoTrascinato=true')
    // il clic che segue un lazo non deve aprire le misure della riga sotto il puntatore
    expect(html).toContain('if(_cartLassoTrascinato){ _cartLassoTrascinato=false; return; }')
  })
})

describe('Computo Metrico — si trascina una voce dall\'Elenco Prezzi nelle misurazioni', () => {
  it('la riga dell\'Elenco Prezzi è trascinabile', () => {
    expect(html).toMatch(/class="ep-row" data-key="\$\{esc\(e\.key\)\}" draggable="true"/)
    expect(html).toContain("ondragstart=\"epDragStart(event,'${ek}')\"")
  })

  it('il computo è il bersaglio, e si accende solo mentre trascini', () => {
    expect(html).toMatch(/ondrop="epDropSuComputo\(event\)"/)
    expect(html).toMatch(/types\.includes\('text\/ep-key'\)/)
  })

  it('nasce una VOCE NUOVA di computo, non un\'altra misurazione della stessa', () => {
    // la stessa voce di listino compare nel computo quante volte serve: le prese in cucina e
    // quelle in garage sono UNA voce di prezzario ma DUE voci di computo, in sottocategorie
    // diverse e misurate a parte
    const i = html.indexOf('function epDropSuComputo')
    const body = html.slice(i, i + 900)
    expect(body).toMatch(/cartDuplicateKeys\(\[key\], \{ senzaMisure:true, senzaCategoria:true, muto:true \}\)\[0\]/)
    // niente misure ereditate (sono della voce di prima) e niente categoria ereditata
    // (la nuova va dove serve a lei)
    expect(html).toMatch(/if\(S\.categoria\[k\] && !\(opts && opts\.senzaCategoria\)\)/)
    // e ti porta dove l'hai lasciata: misure aperte e pronte da scrivere
    expect(body).toContain('misToggle(target)')
  })

  it('se la lasci DENTRO un gruppo, prende la categoria di quel gruppo', () => {
    const i = html.indexOf('function epDropSuComputo')
    const body = html.slice(i, i + 900)
    expect(body).toMatch(/ev\.target\.closest\('\.cm-sel-row'\)/)
    expect(body).toMatch(/const catDelGruppo=\(sotto && S\.categoria\[sotto\.dataset\.key\]\) \|\| ''/)
    expect(body).toMatch(/if\(catDelGruppo\) S\.categoria\[target\]=catDelGruppo/)
  })
})
