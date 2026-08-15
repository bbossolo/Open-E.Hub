/**
 * PROFILI DI ESTRAZIONE per SETTORE — le regex «gergo scheda tecnica» divise per
 * comparto impiantistico, così una scheda chiller non riporta un «flusso
 * luminoso» pescato da un «lm» spurio e una scheda UPS legge kVA/autonomia
 * invece di CCT/CRI. Motore PURO (nessun DOM/rete), regola «se non c'è non si
 * menziona»: ogni profilo prende ciò che riconosce e salta il resto.
 *
 * Il profilo `illuminazione` replica ESATTAMENTE (valori e ordine) lo storico
 * `estraiCaratteristiche` senza settore: è il comportamento di default e la
 * guardia di retrocompatibilità dei test esistenti.
 */

import type { Caratteristica } from './datasheet'

/** Comparto impiantistico di una scheda tecnica (per il dispatch delle regex). */
export type SettoreScheda =
  | 'illuminazione' | 'idronica' | 'frigo' | 'elettrogeno' | 'ups' | 'acs' | 'elettrico'
  | 'dati' | 'sicurezza'

/** Etichette UI (italiano) dei settori, per la chip nel pannello candidati. */
export const SETTORE_LABEL: Record<SettoreScheda, string> = {
  illuminazione: 'Illuminazione',
  idronica: 'Meccanica',
  frigo: 'Frigo',
  elettrogeno: 'Elettrogeno',
  ups: 'UPS',
  acs: 'ACS',
  elettrico: 'Elettrico',
  dati: 'Rete dati',
  sicurezza: 'Sicurezza',
}

type AddFn = (etichetta: string | undefined, valore: string | undefined | null) => void
type MatchFn = (re: RegExp) => RegExpMatchArray | null

const num = '\\d+(?:[.,]\\d+)?'

/** famigliaId → settore: liste esplicite (prevedibili), il fallback su `macro`
 *  del FRASARIO lo fa il chiamante in datasheet.ts. */
const FAMIGLIE_SETTORE: Record<SettoreScheda, string[]> = {
  illuminazione: [], // tutte le famiglie con macro ILLUMINAZIONE (fallback)
  idronica: [
    'pompa-di-calore', 'unita-trattamento-aria', 'ventilconvettore', 'radiatore',
    'gruppo-pressurizzazione', 'circolatore', 'vaso-espansione', 'defangatore', 'disconnettore',
    'collettore-sanitario', 'serranda', 'diffusore-bocchetta-aria', 'canale-aria',
  ],
  frigo: ['gruppo-frigo'],
  elettrogeno: ['gruppo-elettrogeno'],
  ups: ['gruppo-continuita-ups'],
  acs: ['bollitore-scaldacqua', 'addolcitore'],
  elettrico: [], // fallback macro IMPIANTI ELETTRICI
  dati: ['presa-dati-rj45', 'patch-panel', 'switch-rete', 'access-point'],
  sicurezza: ['rivelatore-intrusione', 'centrale-antintrusione', 'videocitofono'],
}

/** Settore esplicito di una famiglia, se mappata nelle liste (senza fallback macro). */
export function settoreEsplicito(famigliaId: string): SettoreScheda | undefined {
  for (const [settore, ids] of Object.entries(FAMIGLIE_SETTORE) as [SettoreScheda, string[]][]) {
    if (ids.includes(famigliaId)) return settore
  }
  return undefined
}

// ————————————————————————————————————————————————————————————————————
// GENERICI condivisi (valgono per ogni comparto): alimentazione, IP/IK,
// classe, dimensioni, peso, rumorosità, classe energetica.
// ————————————————————————————————————————————————————————————————————
function estraiGenerici(m: MatchFn, add: AddFn): void {
  const ten = m(/\b(\d{3})\s*[-–÷]\s*(\d{3})\s*V\b/) || m(/\b(\d{2,3})\s*V\b(?!A)/)
  if (ten) add('alimentazione', (ten[2] ? `${ten[1]}-${ten[2]}` : ten[1]) + ' V')
  const ip = m(/\bIP\s?(\d{2})\b/i)
  if (ip) add('grado di protezione', 'IP' + ip[1])
  const ik = m(/\bIK\s?(\d{2})\b/i)
  if (ik) add('resistenza agli urti', 'IK' + ik[1])
  const cl = m(/\bclasse\s+(I{1,3}|IV|1|2|3)\b/i)
  if (cl) add(undefined, 'classe ' + cl[1].toUpperCase())
  // dimensioni: L×P×H se c'è la terza quota, altrimenti L×P (storico)
  const dim3 = m(/\b(\d{2,4})\s*[x×]\s*(\d{2,4})\s*[x×]\s*(\d{2,4})\b/)
  const dim2 = dim3 ? null : m(/\b(\d{2,4})\s*[x×]\s*(\d{2,4})\b/)
  if (dim3) add('dimensioni', `${dim3[1]}×${dim3[2]}×${dim3[3]} mm`)
  else if (dim2) add('dimensioni', `${dim2[1]}×${dim2[2]} mm`)
  const peso = m(new RegExp(`(${num})\\s*kg\\b`, 'i'))
  if (peso) add('peso', peso[1].replace('.', ',') + ' kg')
  const rum = m(new RegExp(`(${num})\\s*dB\\s*\\(?A\\)?`, 'i'))
  if (rum) add('rumorosità', rum[1].replace('.', ',') + ' dB(A)')
  const erp = m(/\bclasse\s+energetica\s+(A\+{0,3}|[B-G])\b/i)
  if (erp) add('classe energetica', erp[1].toUpperCase())
}

// helper condivisi tra i profili idronica/frigo
function estraiTermofrigo(m: MatchFn, add: AddFn): void {
  const pf = m(new RegExp(`potenza\\s+(?:frigorifera|di\\s+raffreddamento|in\\s+raffrescamento)[^\\d]{0,25}(${num})\\s*kW`, 'i'))
    || m(new RegExp(`(?:resa|capacita|capacità)\\s+frigorifera[^\\d]{0,25}(${num})\\s*kW`, 'i'))
  if (pf) add('potenza frigorifera', pf[1].replace('.', ',') + ' kW')
  const pt = m(new RegExp(`(?:potenza|resa|capacita|capacità)\\s+(?:termica|di\\s+riscaldamento|in\\s+riscaldamento)[^\\d]{0,25}(${num})\\s*kW`, 'i'))
  if (pt) add('potenza termica', pt[1].replace('.', ',') + ' kW')
  const pa = m(new RegExp(`potenza\\s+(?:assorbita|elettrica)[^\\d]{0,25}(${num})\\s*kW`, 'i'))
  if (pa) add('potenza assorbita', pa[1].replace('.', ',') + ' kW')
  for (const ix of ['ESEER', 'SEER', 'EER', 'SCOP', 'COP'] as const) {
    const v = m(new RegExp(`\\b${ix}\\b[^\\d]{0,12}(${num})`, 'i'))
    // etichetta undefined: la sigla sta già nel valore («EER 3,19»), altrimenti
    // la descrizione estesa la duplicherebbe («EER EER 3,19» — visto su Aermec reale)
    if (v) add(undefined, `${ix} ${v[1].replace('.', ',')}`)
  }
  const ref = m(/\bR[- ]?(\d{2,4}[A-Za-z]?)\b/)
  if (ref) add('refrigerante', 'R' + ref[1].toUpperCase())
  const gwp = m(new RegExp(`\\bGWP[^\\d]{0,10}(\\d{1,4})\\b`, 'i'))
  if (gwp) add('GWP', gwp[1])
}

function estraiIdraulica(m: MatchFn, add: AddFn): void {
  const por = m(new RegExp(`portata[^\\d]{0,25}(${num})\\s*(m³/h|m3/h|l/h|l/min|l/s)`, 'i'))
  if (por) add('portata', por[1].replace('.', ',') + ' ' + por[2].replace('m3/h', 'm³/h'))
  const prev = m(new RegExp(`prevalenza[^\\d]{0,25}(${num})\\s*(kPa|bar|m\\s*c\\.?a\\.?|Pa)`, 'i'))
  if (prev) add('prevalenza', prev[1].replace('.', ',') + ' ' + prev[2].replace(/\s+/g, ' '))
  const att = m(/\battacchi[^\dA-Z]{0,15}(DN\s?\d{2,3}|\d(?:\s?[/]\s?\d)?["”])/i)
  if (att) add('attacchi', att[1].replace(/\s+/g, ' '))
}

// ————————————————————————————————————————————————————————————————————
// PROFILI per settore
// ————————————————————————————————————————————————————————————————————
export const PROFILI: Record<SettoreScheda, (m: MatchFn, add: AddFn) => void> = {
  // Replica ESATTA dello storico estraiCaratteristiche (ordine incluso).
  illuminazione(m, add) {
    const pot = m(new RegExp(`(${num})\\s*W\\s*\\(?\\s*sistema`, 'i')) || m(new RegExp(`potenza[^\\d]{0,20}(${num})\\s*W`, 'i')) || m(new RegExp(`(${num})\\s*W\\b(?!\\s*/)`, 'i'))
    if (pot) add('potenza', pot[1].replace('.', ',') + ' W')
    const flu = m(new RegExp(`(\\d{2,6})\\s*lm\\b(?!\\s*/)`, 'i'))
    if (flu) add('flusso luminoso', flu[1] + ' lm')
    const eff = m(new RegExp(`(${num})\\s*lm\\s*/\\s*W`, 'i'))
    if (eff) add('efficacia luminosa', eff[1].replace('.', ',') + ' lm/W')
    const cct = m(/\b(\d{4})\s*K\b/)
    if (cct) add('temperatura di colore', cct[1] + ' K')
    const cri = m(/\b(?:CRI|Ra)\s*[≥>]?\s*(\d{2})\b/i)
    if (cri) add('resa cromatica', 'CRI ' + cri[1])
    const aggett = m(/\b(ellittic\w+|asimmetric\w+|simmetric\w+|radente|wall\s?washer|stradale)\b/i)
    const ang2 = m(/\b(\d{1,3})\s*°\s*\/\s*(\d{1,3})\s*°/)
    const ang1 = ang2 ? null : m(/\b(?:apertura|fascio|angolo)[^\d]{0,18}(\d{1,3})\s*°/i) || m(/\b(\d{1,3})\s*°/)
    const angTxt = ang2 ? `${ang2[1]}°/${ang2[2]}°` : ang1 ? `${ang1[1]}°` : ''
    const otticaTxt = [aggett?.[1]?.toLowerCase(), angTxt].filter(Boolean).join(' ')
    if (otticaTxt) add('ottica', otticaTxt)
    const ten = m(/\b(\d{3})\s*[-–÷]\s*(\d{3})\s*V\b/) || m(/\b(\d{2,3})\s*V\b(?!A)/)
    if (ten) add('alimentazione', (ten[2] ? `${ten[1]}-${ten[2]}` : ten[1]) + ' V')
    const ip = m(/\bIP\s?(\d{2})\b/i)
    if (ip) add('grado di protezione', 'IP' + ip[1])
    const ik = m(/\bIK\s?(\d{2})\b/i)
    if (ik) add('resistenza agli urti', 'IK' + ik[1])
    const cl = m(/\bclasse\s+(I{1,3}|IV|1|2|3)\b/i)
    if (cl) add(undefined, 'classe ' + cl[1].toUpperCase())
    const dali = m(/\b(DALI(?:-?2)?|1\s*-?\s*10\s*V|push[- ]?dim|dimmerabile)\b/i)
    if (dali) add(undefined, /dimmerabile/i.test(dali[1]) ? 'dimmerabile' : 'dimmerabile ' + dali[1].toUpperCase().replace(/\s+/g, ''))
    const dim = m(/\b(\d{2,4})\s*[x×]\s*(\d{2,4})\b/)
    if (dim) add('dimensioni', `${dim[1]}×${dim[2]} mm`)
    const peso = m(new RegExp(`(${num})\\s*kg\\b`, 'i'))
    if (peso) add('peso', peso[1].replace('.', ',') + ' kg')
  },

  idronica(m, add) {
    estraiTermofrigo(m, add)
    estraiIdraulica(m, add)
    estraiGenerici(m, add)
  },

  frigo(m, add) {
    estraiTermofrigo(m, add)
    const comp = m(/\b(\d{1,2})\s+compressori\b/i)
    if (comp) add('compressori', comp[1] + ' compressori')
    const tipoComp = m(/\bcompressor[ei][^.]{0,20}\b(scroll|a\s+vite|rotativ\w+|inverter)\b/i)
    if (tipoComp) add(undefined, 'compressori ' + tipoComp[1].toLowerCase().replace(/\s+/g, ' '))
    const circ = m(/\b(\d{1,2})\s+circuiti\s+frigoriferi\b/i)
    if (circ) add('circuiti frigoriferi', circ[1])
    estraiIdraulica(m, add)
    estraiGenerici(m, add)
  },

  elettrogeno(m, add) {
    for (const q of ['PRP', 'LTP', 'ESP'] as const) {
      const v = m(new RegExp(`(?:potenza\\s+)?${q}[^\\d]{0,15}(${num})\\s*(kVA|kW)`, 'i'))
        || m(new RegExp(`(${num})\\s*(kVA|kW)\\s*\\(?\\s*${q}`, 'i'))
      if (v) add(`potenza ${q}`, `${v[1].replace('.', ',')} ${v[2]} ${q}`)
    }
    const kva = m(new RegExp(`potenza[^\\d]{0,20}(${num})\\s*kVA`, 'i'))
    if (kva) add('potenza', kva[1].replace('.', ',') + ' kVA')
    const cosfi = m(new RegExp(`cos\\s*(?:φ|ϕ|phi|fi)[^\\d]{0,8}(0[.,]\\d{1,2})`, 'i'))
    if (cosfi) add('cos φ', cosfi[1].replace('.', ','))
    const serb = m(new RegExp(`serbatoio[^\\d]{0,25}(${num})\\s*l(?:itri)?\\b`, 'i'))
    if (serb) add('serbatoio', serb[1].replace('.', ',') + ' l')
    const aut = m(new RegExp(`autonomia[^\\d]{0,25}(${num})\\s*(h|ore)\\b`, 'i'))
    if (aut) add('autonomia', aut[1].replace('.', ',') + ' h')
    const giri = m(/\b(\d{3,4})\s*(?:giri\/min|rpm)\b/i)
    if (giri) add('regime', giri[1] + ' giri/min')
    estraiGenerici(m, add)
  },

  ups(m, add) {
    const kva = m(new RegExp(`(${num})\\s*kVA\\b`, 'i'))
    if (kva) add('potenza', kva[1].replace('.', ',') + ' kVA')
    const kw = m(new RegExp(`(${num})\\s*kW\\b`, 'i'))
    if (kw) add('potenza attiva', kw[1].replace('.', ',') + ' kW')
    const pf = m(new RegExp(`fattore\\s+di\\s+potenza[^\\d]{0,10}(0[.,]\\d{1,2}|1)`, 'i'))
    if (pf) add('fattore di potenza', pf[1].replace('.', ','))
    const aut = m(new RegExp(`autonomia[^\\d]{0,25}(${num})\\s*min`, 'i'))
    if (aut) add('autonomia', aut[1].replace('.', ',') + ' min')
    const topo = m(/\b(VFI(?:-SS-111)?|VI|VFD|doppia\s+conversione|line[- ]?interactive|off[- ]?line)\b/i)
    if (topo) add('topologia', topo[1].replace(/\s+/g, ' '))
    const batt = m(/\b(VRLA|litio|Li-?ion|AGM)\b/i)
    if (batt) add('batterie', batt[1].toUpperCase() === 'LITIO' ? 'litio' : batt[1])
    const rack = m(/\b(\d{1,2})\s*U\b/)
    if (rack) add('formato', rack[1] + ' U rack')
    const fasi = m(/\b(monofase|trifase)\b/i)
    if (fasi) add(undefined, fasi[1].toLowerCase())
    estraiGenerici(m, add)
  },

  acs(m, add) {
    const cap = m(new RegExp(`(?:capacita|capacità|accumulo|volume)[^\\d]{0,20}(${num})\\s*l(?:itri)?\\b`, 'i'))
      || m(new RegExp(`(${num})\\s*litri\\b`, 'i'))
    if (cap) add('capacità', cap[1].replace('.', ',') + ' l')
    const sc = m(new RegExp(`(?:potenza\\s+)?scambiator[ei][^\\d]{0,25}(${num})\\s*kW`, 'i'))
    if (sc) add('potenza scambiatore', sc[1].replace('.', ',') + ' kW')
    const pres = m(new RegExp(`pressione[^\\d]{0,25}(${num})\\s*bar`, 'i'))
    if (pres) add('pressione max', pres[1].replace('.', ',') + ' bar')
    const temp = m(new RegExp(`temperatura[^\\d]{0,25}(${num})\\s*°\\s*C`, 'i'))
    if (temp) add('temperatura max', temp[1].replace('.', ',') + ' °C')
    const coib = m(new RegExp(`coibentazione[^\\d]{0,25}(${num})\\s*mm`, 'i'))
    if (coib) add('coibentazione', coib[1] + ' mm')
    const fin = m(/\b(vetrificat\w+|vetroporcellanat\w+|acciaio\s+inox)\b/i)
    if (fin) add(undefined, fin[1].toLowerCase().replace(/\s+/g, ' '))
    if (m(/\banodo\s+(?:di\s+)?magnesio\b/i)) add(undefined, 'anodo di magnesio')
    estraiGenerici(m, add)
  },

  elettrico(m, add) {
    const inA = m(new RegExp(`\\bIn[^\\dA-Za-z]{0,8}(${num})\\s*A\\b`, 'i'))
      || m(new RegExp(`corrente\\s+nominale[^\\d]{0,20}(${num})\\s*A\\b`, 'i'))
    if (inA) add('corrente nominale', inA[1].replace('.', ',') + ' A')
    const icu = m(new RegExp(`\\bIcu[^\\d]{0,10}(${num})\\s*kA`, 'i'))
    if (icu) add('potere di interruzione', 'Icu ' + icu[1].replace('.', ',') + ' kA')
    const poli = m(/\b([1-4])\s*P(?:\+N)?\b/)
    if (poli) add('poli', poli[0].replace(/\s+/g, ''))
    const curva = m(/\bcurva\s+([BCDK])\b/i)
    if (curva) add('curva', curva[1].toUpperCase())
    const ric = m(new RegExp(`(${num})\\s*kW\\b`, 'i'))
    if (ric) add('potenza', ric[1].replace('.', ',') + ' kW')
    if (m(/\bmode\s*3\b/i)) add(undefined, 'ricarica Mode 3')
    if (m(/\btype\s*2\b/i)) add(undefined, 'connettore Type 2')
    estraiGenerici(m, add)
  },

  dati(m, add) {
    const porte = m(/\b(\d{1,3})\s*port[ei]\b/i)
    if (porte) add('porte', porte[1] + ' porte')
    const throughput = m(new RegExp(`(${num})\\s*(gbps|gbe|mbps)\\b`, 'i'))
    if (throughput) {
      const unita = { gbps: 'Gbps', gbe: 'GbE', mbps: 'Mbps' }[throughput[2].toLowerCase() as 'gbps' | 'gbe' | 'mbps']
      add('throughput', throughput[1].replace('.', ',') + ' ' + unita)
    }
    const poe = m(new RegExp(`poe(?:\\+{1,2})?\\s+budget[^\\d]{0,15}(${num})\\s*W`, 'i'))
      || m(new RegExp(`(${num})\\s*W[^.]{0,10}poe(?:\\+{1,2})?\\s+budget`, 'i'))
    if (poe) add('PoE budget', poe[1].replace('.', ',') + ' W')
    const wifi = m(/\b(802\.11\s*(?:a\/b\/g\/n\/ac\/ax|ax|ac|n))\b/i)
    if (wifi) add('standard wireless', wifi[1].toLowerCase())
    if (m(/\bmu-mimo\b/i)) add(undefined, 'MU-MIMO')
    const cat = m(/\bcat(?:egoria)?\.?\s*(6a|6|7a|7|5e)\b/i)
    if (cat) add('categoria', 'cat. ' + cat[1].toLowerCase())
    estraiGenerici(m, add)
  },

  sicurezza(m, add) {
    const portata = m(new RegExp(`portata(?:\\s+di\\s+rilevazione)?[^\\d]{0,20}(${num})\\s*m\\b`, 'i'))
    if (portata) add('portata di rilevazione', portata[1].replace('.', ',') + ' m')
    const grado = m(/\bgrado\s*(2|3|4)\b/i)
    if (grado) add('grado EN 50131', grado[1])
    const freq = m(new RegExp(`(${num})\\s*mhz\\b`, 'i'))
    if (freq) add('frequenza radio', freq[1].replace('.', ',') + ' MHz')
    const ris = m(/\b(\d{3,4}\s*[x×]\s*\d{3,4}|\d(?:\.\d)?\s*mp)\b/i)
    if (ris) add('risoluzione', ris[1].toLowerCase().replace(/\s+/g, ''))
    const fov = m(new RegExp(`(?:fov|campo\\s+visivo)[^\\d]{0,10}(${num})\\s*°`, 'i'))
    if (fov) add('campo visivo', fov[1].replace('.', ',') + '°')
    if (m(/\bbus\s+a\s+2\s+fili\b/i)) add(undefined, 'bus a 2 fili')
    estraiGenerici(m, add)
  },
}

/** Caratteristiche-chiave che finiscono nella descrizione BREVE, per settore. */
export const CHIAVI_BREVE: Record<SettoreScheda, string[]> = {
  illuminazione: ['potenza', 'flusso luminoso', 'temperatura di colore', 'grado di protezione', 'dimensioni'],
  idronica: ['potenza termica', 'potenza frigorifera', 'portata', 'prevalenza', 'refrigerante'],
  frigo: ['potenza frigorifera', 'EER', 'ESEER', 'refrigerante'],
  elettrogeno: ['potenza PRP', 'potenza LTP', 'potenza', 'serbatoio'],
  ups: ['potenza', 'autonomia', 'topologia'],
  acs: ['capacità', 'potenza scambiatore', 'pressione max'],
  elettrico: ['corrente nominale', 'potere di interruzione', 'potenza', 'poli'],
  dati: ['porte', 'throughput', 'PoE budget', 'standard wireless'],
  sicurezza: ['portata di rilevazione', 'grado EN 50131', 'risoluzione', 'campo visivo'],
}

/**
 * Estrazione con dispatch per settore: profilo del comparto (default storico:
 * illuminazione). Usata da `estraiCaratteristiche` in datasheet.ts.
 */
export function estraiCaratteristicheSettore(raw: unknown, settore?: SettoreScheda): Caratteristica[] {
  const t = String(raw ?? '').replace(/\s+/g, ' ')
  const out: Caratteristica[] = []
  const add: AddFn = (etichetta, valore) => {
    const v = (valore ?? '').trim()
    if (v && !out.some(c => c.valore.toLowerCase() === v.toLowerCase())) out.push({ etichetta, valore: v })
  }
  const m: MatchFn = (re) => t.match(re)
  PROFILI[settore ?? 'illuminazione'](m, add)
  return out
}
