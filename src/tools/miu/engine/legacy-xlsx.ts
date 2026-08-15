/**
 * Parser euristico XLSX — BASELINE legacy estratta da PriceList_v2_3.html
 * (`parseXLSX`), disaccoppiata da FileReader/XLSX: opera sul 2D array già
 * estratto (`XLSX.utils.sheet_to_json(ws,{header:1,defval:''})`).
 *
 * È volutamente una porta FEDELE del comportamento attuale, da congelare con i
 * test di caratterizzazione prima di introdurre i parser per-famiglia. La logica
 * di dominio NON va modificata qui.
 */
import { REGIONS } from '../data/regions'
import { normH, codeLevels } from './codes'
import type { CellRow, ParseResult, PriceRow } from './types'

/** Alias per ogni campo logico (in ordine di priorità). */
const ALIAS: Record<string, string[]> = {
  cod: ['codice', 'cod', 'codicevoce', 'codicearticolo'],
  // descrizione lunga/estesa
  decl: ['declaratoria', 'descrizioneestesa', 'descrizionelunga', 'descrizionecompleta', 'descestesa'],
  // descrizione breve (fallback se manca la lunga)
  descbreve: ['descrizionebreve', 'descrizionesintetica', 'descbreve', 'descrizione', 'denominazione', 'oggetto'],
  um: ['um', 'desum', 'descum', 'unitadimisura', 'unitamisura', 'umisura', 'udm'],
  prez: ['prezzo', 'prezzounitario', 'prezzo1', 'importo', 'prezzoeuro'],
  netto: ['importosenzasgeui', 'importonetto', 'prezzonetto', 'importosenzasg'],
  ru: ['rapportoru', 'man', 'manodopera', 'costomanodopera', 'incidenzamanodopera', 'perman'],
  l1: ['descrliv1', 'descrizioneliv1', 'livello1', 'categoria'],
  l2: ['descrliv2', 'descrizioneliv2', 'livello2', 'sottocategoria'],
  l3: ['descrliv3', 'descrizioneliv3', 'livello3'],
  l4: ['descrliv4', 'descrizioneliv4', 'livello4'],
  materia: ['materia', 'materiale'],
  disc: ['disciplina'],
  sis: ['sistema'],
  att: ['attivita', 'attività'],
  set: ['settoremerceologico', 'settore', 'capitolo'],
  kw: ['keywords', 'parolechiave', 'keyword'],
  tip: ['tipologia'],
}

/**
 * Esegue il parsing euristico su un foglio già letto come matrice di celle.
 * @param raw righe del foglio (header:1)
 * @param regF regione di fallback (dal filename), '' se ignota
 * @param annoF anno di fallback (dal filename), '' se ignoto
 */
export function parseXlsxRows(raw: CellRow[], regF = '', annoF = ''): ParseResult {
  if (raw.length < 2) return { rows: [], regione: null, anno: null }

  // trova la riga di intestazione: quella che contiene più alias riconosciuti
  let hi = 0, bestScore = 0
  const scanRows = Math.min(10, raw.length)
  for (let i = 0; i < scanRows; i++) {
    const cellsN = raw[i].map(normH)
    let score = 0
    for (const key in ALIAS) {
      if (cellsN.some(c => ALIAS[key].includes(c))) score++
    }
    if (score > bestScore) { bestScore = score; hi = i }
  }

  const hdrN = raw[hi].map(normH)
  // trova indice colonna dal primo alias che combacia
  const find = (key: string): number => {
    for (const a of ALIAS[key]) {
      const idx = hdrN.indexOf(a)
      if (idx !== -1) return idx
    }
    return -1
  }
  const C: Record<string, number> = {}
  for (const key in ALIAS) C[key] = find(key)

  const get = (r: CellRow, key: string): string => C[key] >= 0 ? String(r[C[key]] ?? '').trim() : ''

  // PRIMO PASSO: costruisci l'albero dei capitoli.
  // - parentDesc: codice → descrizione (per ereditarietà descrizione, formato FVG e Veneto)
  // - chapterTree: codice-capitolo (riga SENZA prezzo) → descrizione categoria (formato Veneto)
  // - floatingDesc: righe senza codice ma con testo (es. Veneto: la riga estesa
  //   sotto al titolo capitolo, con col[0] vuota e testo in qualunque colonna)
  const parentDesc: Record<string, string> = {}
  const chapterTree: Record<string, string> = {}
  // pre-scan: associa righe-testo libere (senza codice) al codice che le precede
  {
    let lastCod = ''
    for (let i = hi + 1; i < raw.length; i++) {
      const r = raw[i]
      const cod = get(r, 'cod')
      if (cod) { lastCod = cod; continue }
      // riga senza codice: cerca testo in qualsiasi cella
      const rowText = r.map(v => String(v ?? '').trim()).filter(Boolean).join(' ').trim()
      if (rowText && lastCod && !parentDesc[lastCod]) {
        parentDesc[lastCod] = rowText
      }
    }
  }
  for (let i = hi + 1; i < raw.length; i++) {
    const r = raw[i]
    const cod = get(r, 'cod'); if (!cod) continue
    const ext = get(r, 'decl')
    const breve = get(r, 'descbreve')
    const prz = parseFloat(get(r, 'prez').replace(',', '.')) || 0
    // descrizione estesa ricca per ereditarietà (FVG): sovrascrive il floating solo se più lunga
    if (ext && ext.length > 60) {
      if (!parentDesc[cod] || ext.length > parentDesc[cod].length) parentDesc[cod] = ext
    }
    // riga-capitolo: senza prezzo, con una descrizione → nodo categoria (Veneto)
    if (prz === 0) {
      const catDesc = (ext || breve).trim()
      if (catDesc) chapterTree[cod] = catDesc
    }
  }

  // verifica se il prezzario ha già colonne categoria esplicite (Lombardia)
  const hasExplicitCats = C.disc >= 0 || C.sis >= 0 || C.set >= 0

  // funzione: trova la descrizione del padre risalendo il codice
  const findParentDesc = (cod: string): string => {
    let c = cod
    for (let k = 0; k < 6; k++) {
      const cut = c.replace(/[._\-\s][^._\-\s]*$/, '')
      if (cut === c || !cut) break
      c = cut
      if (parentDesc[c]) return parentDesc[c]
    }
    return ''
  }

  // funzione: deriva disciplina/sistema/settore dall'albero capitoli (per prezzari piatti)
  const deriveCats = (cod: string): { disc: string; sis: string; set: string } => {
    const levels = codeLevels(cod)
    // raccogli le descrizioni-capitolo disponibili lungo la gerarchia (esclusa la voce stessa)
    const descs: string[] = []
    for (let k = 0; k < levels.length - 1; k++) {   // -1: l'ultimo è la voce con prezzo
      const d = chapterTree[levels[k]]
      if (d) descs.push(d)
    }
    if (!descs.length) return { disc: '', sis: '', set: '' }
    const disc = descs[0]                            // radice = Disciplina
    const set = descs.length > 1 ? descs[descs.length - 1] : '' // ultimo padre = Settore
    // se ci sono esattamente 2 livelli (disc+set), sistema resta vuoto; se 3+, sistema = penultimo
    let sistema = ''
    if (descs.length >= 3) sistema = descs[descs.length - 2]
    return { disc, sis: sistema, set }
  }

  const rows: PriceRow[] = []
  let detReg: string | null = null, detAnno: string | null = null
  for (let i = hi + 1; i < raw.length; i++) {
    const r = raw[i]
    const cod = get(r, 'cod'); if (!cod) continue
    const p = parseFloat(get(r, 'prez').replace(',', '.')) || 0
    if (p === 0) continue   // salta voci senza prezzo (sezioni/titoli/padri)

    if (!detReg && cod.length >= 3) {
      const pfx = cod.substring(0, 3).toUpperCase()
      if (REGIONS[pfx]) detReg = REGIONS[pfx]
    }
    if (!detAnno) { const m = cod.match(/20(\d{2})/); if (m) detAnno = '20' + m[1] }

    const um = get(r, 'um').replace(/^[0-9\s]+/, '').trim()
    const declLong = get(r, 'decl')
    const descBreve = get(r, 'descbreve')
    // se la voce non ha estesa propria, eredita quella del padre (formato gerarchico)
    const inherited = (!declLong || declLong.length < 60) ? findParentDesc(cod) : ''
    // anteprima breve: preferisci la breve specifica della variante
    let ds: string
    const baseForOpera = declLong || descBreve
    const om = baseForOpera.match(/OPERA:\s*([^\n\r]+)/)
    if (om) {
      ds = om[1].trim().replace(/\s+/g, ' ')
    } else if (descBreve) {
      ds = descBreve.replace(/\s+/g, ' ')
    } else {
      const firstLine = (declLong || '').split(/[\n\r]/)[0].trim()
      ds = firstLine.length > 220 ? firstLine.substring(0, 220) + '…' : firstLine
    }
    // declaratoria completa = estesa propria, o ereditata dal padre, combinata con la breve
    let decl = declLong || inherited || descBreve
    // se abbiamo sia variante breve che descrizione padre ereditata, mostra entrambe
    if (inherited && descBreve && !declLong) {
      decl = descBreve + '\n\n' + inherited
    }

    // categorie: usa le colonne esplicite se presenti (Lombardia),
    // altrimenti derivale dall'albero capitoli (Veneto e simili)
    let disc = get(r, 'disc'), sis = get(r, 'sis'), set = get(r, 'set')
    if (!hasExplicitCats) {
      const d = deriveCats(cod)
      disc = disc || d.disc; sis = sis || d.sis; set = set || d.set
    }

    rows.push({
      codice: cod, declaratoria: decl, desc_short: ds || cod, um,
      prezzo: p,
      importo_netto: parseFloat(get(r, 'netto').replace(',', '.')) || 0,
      ru: parseFloat(get(r, 'ru').replace(',', '.')) || 0,
      liv1: get(r, 'l1'), liv2: get(r, 'l2'),
      materia: get(r, 'materia'),
      liv3: get(r, 'l3'), liv4: get(r, 'l4'),
      disciplina: disc,
      sistema: sis,
      attivita: get(r, 'att'),
      settore: set,
      keywords: get(r, 'kw'),
      tipologia: get(r, 'tip'),
      regione: detReg || regF, anno: detAnno || annoF,
    })
  }

  return { rows, regione: detReg, anno: detAnno }
}
