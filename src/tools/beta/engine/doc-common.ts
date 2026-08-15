/**
 * β Contabilità — helper comuni ai documenti contabili. Tutti gli atti sono HTML
 * stampabili resi dal sistema documentale condiviso (`renderDocPage`) in
 * MODALITÀ ISTITUZIONALE: testata dell'ente (stazione appaltante) e NIENTE
 * brand Open E.Hub (`brand:'none'`). Numeri/valuta dal modulo condiviso `shared/format`.
 */
import { escHtml, type DocEnte, type DocField } from '../../../shared/doc/doc'
import type { Appalto } from './types'

/** Testata istituzionale dell'ente dal contratto (logo + denominazione + C.F./indirizzo). */
export function enteDi(appalto: Appalto): DocEnte {
  const e = appalto.ente || { denominazione: '' }
  const sub: string[] = []
  if (e.indirizzo) sub.push(e.indirizzo)
  const cf = [e.codiceFiscale ? `C.F. ${e.codiceFiscale}` : '', e.partitaIva ? `P.IVA ${e.partitaIva}` : ''].filter(Boolean).join(' · ')
  if (cf) sub.push(cf)
  return {
    name: e.denominazione || 'Stazione appaltante',
    ...(e.logo ? { logoHtml: `<img src="${escHtml(e.logo)}" alt="">` } : {}),
    sub,
  }
}

/** Campi di cartiglio comuni (oggetto, CUP, CIG, impresa) — piè di pagina di ogni atto. */
export function footerFieldsDi(appalto: Appalto): DocField[] {
  const f: DocField[] = []
  if (appalto.cup) f.push({ k: 'CUP', v: escHtml(appalto.cup) })
  if (appalto.cig) f.push({ k: 'CIG', v: escHtml(appalto.cig) })
  if (appalto.impresa?.denominazione) f.push({ k: 'Impresa', v: escHtml(appalto.impresa.denominazione) })
  return f
}

/** Meta della testata (in alto a destra): impresa, RUP, DL. */
export function headMetaDi(appalto: Appalto): DocField[] {
  const m: DocField[] = []
  if (appalto.rup) m.push({ k: 'RUP', v: escHtml(appalto.rup) })
  if (appalto.direttoreLavori) m.push({ k: 'Dir. Lavori', v: escHtml(appalto.direttoreLavori) })
  return m
}

/** Kicker comune: «Contabilità · <oggetto abbreviato>». */
export function kickerDi(appalto: Appalto, coda: string): string {
  const ogg = (appalto.oggetto || 'Lavori').slice(0, 60)
  return `Contabilità lavori pubblici · ${coda}${ogg ? ' · ' + ogg : ''}`
}

/** Riquadro firme in calce a un atto (DL / esecutore / RUP secondo l'atto). */
export function firmeHTML(ruoli: Array<{ ruolo: string; nome?: string }>): string {
  const cols = ruoli.map((r) => `
    <div class="bt-firma">
      <div class="bt-firma__line"></div>
      <div class="bt-firma__ruolo">${escHtml(r.ruolo)}</div>
      ${r.nome ? `<div class="bt-firma__nome">${escHtml(r.nome)}</div>` : ''}
    </div>`).join('')
  return `<div class="bt-firme">${cols}</div>`
}

/** Placeholder esplicito «da confermare» per i dati non disponibili (regola di fedeltà del dato). */
export const DA_CONFERMARE = '<span class="bt-todo">da confermare</span>'

/** Valore o placeholder «da confermare» se vuoto. */
export function orTodo(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v).trim()
  return s ? escHtml(s) : DA_CONFERMARE
}
