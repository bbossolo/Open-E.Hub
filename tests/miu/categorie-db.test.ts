import { describe, it, expect } from 'vitest'
import { CATEGORIE_GOLDEN, estraiCategorieDaVcRows, mergeCategorieDb, normalizzaAmbito } from '../../src/tools/miu/engine/categorie-db'
import { miuSource } from './miu-src'

describe('contratto sul sorgente inline di μ — vista Categorie a due pannelli', () => {
  const html = miuSource()

  it('il DB runtime è cablato: localStorage + merge col golden + feed da setCategoria/import', () => {
    for (const frag of ["localStorage.getItem('miu:catdb')", 'window.CATEGORIE_GOLDEN', 'function catDbAll(', 'function catDbFeedPath(', 'function setCategoriaLivello(']) {
      expect(html).toContain(frag)
    }
    const setCat = html.match(/function setCategoria\(key,val\)[\s\S]*?\n}/)?.[0] ?? ''
    expect(setCat).toContain('catDbFeedPath')
  })

  it('la vista Categorie ha pannello sinistro (gruppi per livello, drag) + voci con 3 chip', () => {
    for (const frag of ['catdb-panel', 'function catDbGroupsHtml(', 'function catChips3Html(', 'function catChipDrop(', 'function catChipEdit(', "catDbDragStart(event)", 'catdb-dl-']) {
      expect(html).toContain(frag)
    }
    // il vecchio albero è stato sostituito, non deve restarne codice morto
    expect(html).not.toContain('walkCategoriaTree')
    expect(html).not.toContain('CART_TREE_OPEN')
  })

  it('clic semplice su una voce in Tabella apre le misure pronte (selezione su modificatori)', () => {
    const wire = html.match(/function wireCartSelection\(ov\)[\s\S]*?\n}\n/)?.[0] ?? ''
    expect(wire).toContain('misToggle(row.dataset.key)')
    expect(wire).toContain('cartSelToggle(row.dataset.key, additive)')
  })

  it('il lazo non seleziona il testo sotto (preventDefault + user-select:none)', () => {
    const wire = html.match(/function wireCartSelection\(ov\)[\s\S]*?\n}\n/)?.[0] ?? ''
    expect(wire).toContain('e.preventDefault()')
    expect(wire).toContain("userSelect='none'")
  })

  it('il menu contestuale ha i 3 pulsanti rapidi Supercategoria/Categoria/Sottocategoria', () => {
    for (const frag of ['cartCtxAssignLivello(0)', 'cartCtxAssignLivello(1)', 'cartCtxAssignLivello(2)', 'function openLivelloPopover(', 'function applyLivelloToKeys(']) {
      expect(html).toContain(frag)
    }
  })

  it('il DB distingue le categorie di origine esterna da quelle già nel database (badge origine)', () => {
    for (const frag of ["localStorage.getItem('miu:catdb-origin')", 'function catDbOrigine(', 'from-primus', "catDbFeedPath(v,'manuale')"]) {
      expect(html).toContain(frag)
    }
  })

  it('il Computo Metrico è una VISTA a tutta larghezza (sotto il binario) e non tronca le descrizioni', () => {
    const openCart = html.match(/function openCart\(\)[\s\S]*?\n}\n/)?.[0] ?? ''
    // non più un modale centrato: è una vista-passo montata sotto il chrome (--chrome-h),
    // quindi usa tutta la larghezza/altezza disponibile → descrizioni ancora meno troncate.
    expect(openCart).toContain('top:var(--chrome-h')
    expect(openCart).toContain('width:100%;height:100%')
    expect(openCart).not.toMatch(/desc_short\|\|r\.declaratoria\|\|''\)\.slice/)
  })

  it('le categorie di origine esterna restano LETTERALI nel feed del vocabolario (mai normalizzate)', () => {
    const feed = html.match(/function catDbFeedPath\(cat,origine\)[\s\S]*?\n}/)?.[0] ?? ''
    expect(feed).toContain("origine!=='primus'")
    expect(feed).toContain('normalizzaAmbito')
  })

  it('il drag&drop sulle 3 chip accetta solo il livello corrispondente (niente Sottocategoria nello slot Supercategoria)', () => {
    for (const frag of ['function catChipDragOver(', "types.includes('text/catlv:'+lv)", "ev.dataTransfer.setData('text/catlv:'+el.dataset.lv, payload)"]) {
      expect(html).toContain(frag)
    }
    const drop = html.match(/function catChipDrop\(ev,key,slot\)[\s\S]*?\n}/)?.[0] ?? ''
    expect(drop).toContain("'text/catlv:'+CAT_LIVELLI[liv]")
  })

  it('un drop rifiutato su una chip non ricade MAI sulla riga sotto (ogni famiglia vive solo nella sua chip)', () => {
    const dragOver = html.match(/function catChipDragOver\(ev,slot\)[\s\S]*?\n}/)?.[0] ?? ''
    const drop = html.match(/function catChipDrop\(ev,key,slot\)[\s\S]*?\n}/)?.[0] ?? ''
    expect(dragOver).toContain('ev.stopPropagation()')
    expect(drop).toContain('ev.stopPropagation()')
  })

  it('il pannello suggerimenti normalizza la Supercategoria SOLO per le voci non di origine esterna (golden+manuale), non per il computo corrente', () => {
    const fn = html.match(/function catDbAll\(\)[\s\S]*?\n}/)?.[0] ?? ''
    expect(fn).toContain("catDbOrigine(lv,n)==='primus'")
    expect(fn).toContain('normSp')
  })

  it("esiste una migrazione una tantum per le Supercategorie numerate già salvate prima del fix", () => {
    expect(html).toContain('function migrateCatDbSp(')
    expect(html).toContain('migrateCatDbSp();')
  })
})

describe('normalizzaAmbito — Supercategoria senza il numero di edificio/istanza', () => {
  it('toglie un numero finale (semplice o intervallo)', () => {
    expect(normalizzaAmbito('Comparto 10')).toBe('Comparto')
    expect(normalizzaAmbito('Comparto 11')).toBe('Comparto')
    expect(normalizzaAmbito('Avancorpo 8-9')).toBe('Avancorpo')
    expect(normalizzaAmbito('Cabina elettrica 4')).toBe('Cabina elettrica')
  })

  it('lascia invariati i nomi senza numero finale', () => {
    expect(normalizzaAmbito('Esterni')).toBe('Esterni')
    expect(normalizzaAmbito('Centrale termica/frigorifera')).toBe('Centrale termica/frigorifera')
  })

  it('CATEGORIE_GOLDEN.sp non contiene duplicati numerati (Cabina elettrica una sola volta)', () => {
    expect(CATEGORIE_GOLDEN.sp.filter(n => n.startsWith('Cabina elettrica'))).toEqual(['Cabina elettrica'])
    expect(CATEGORIE_GOLDEN.sp).not.toContain('Cabina elettrica 4')
  })
})

describe('estraiCategorieDaVcRows / mergeCategorieDb', () => {
  it('estrae i livelli posizionali, deduplicati e ordinati (it), normalizzando la Supercategoria', () => {
    const db = estraiCategorieDaVcRows([
      { categoria: 'Esterni · Impianti BT · Fotovoltaico' },
      { categoria: 'Esterni · Impianti BT · Fotovoltaico' },
      { categoria: 'Cabina elettrica 4 · Impianti Speciali' },
      { categoria: 'Cabina elettrica 5 · Impianti Speciali' },
      { categoria: '' },
      {},
    ])
    expect(db.sp).toEqual(['Cabina elettrica', 'Esterni']) // 4 e 5 collassano nello stesso ambito
    expect(db.cat).toEqual(['Impianti BT', 'Impianti Speciali'])
    expect(db.sb).toEqual(['Fotovoltaico'])
  })

  it('merge: dedup per livello e ordine alfabetico', () => {
    const m = mergeCategorieDb(
      { sp: ['Zeta', 'Alfa'], cat: [], sb: [] },
      { sp: ['Alfa', 'Beta'], cat: ['Cat1'], sb: [] },
    )
    expect(m.sp).toEqual(['Alfa', 'Beta', 'Zeta'])
    expect(m.cat).toEqual(['Cat1'])
    expect(m.sb).toEqual([])
  })
})
