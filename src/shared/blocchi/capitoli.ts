/**
 * CAPITOLO D'IMPIANTO da un layer studio — GENERICO, non legato all'elettrico: la
 * convenzione dello studio è `<DOMINIO>-<CAPITOLO>[_TESTO]` (es. `ELE-ILLUMINAZIONE_NORMALE`).
 * Qualunque futura libreria blocchi (idraulico, meccanico/HVAC, dati…) userà lo stesso schema
 * col proprio prefisso dominio — questa funzione non ha bisogno di conoscerli in anticipo:
 * regge «tutti i tipi di impianto» senza una tabella per-impianto da mantenere.
 *
 * Il capitolo è pensato per finire nel COMPUTO come intestazione di capitolo (Categoria/
 * Supercategoria in μ — la mappatura esatta è un passo successivo): un layer = un
 * capitolo, coerente col fatto che lo studio disegna già per disciplina/capitolo sul layer.
 */

/** Poche abbreviazioni note dello studio che altrimenti l'humanizer lascerebbe illeggibili. */
const ABBREVIAZIONI: Record<string, string> = {
  FM: 'Forza Motrice', MT: 'MT', BT: 'BT', FTV: 'Fotovoltaico', AUX: 'Ausiliari',
}

function humanize(s: string): string {
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(w => ABBREVIAZIONI[w.toUpperCase()] || (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
}

/**
 * Capitolo d'impianto da un nome di layer studio. `ELE-ILLUMINAZIONE_NORMALE` →
 * "Illuminazione Normale"; `ELE.0-testi_computo` e i gemelli `_TESTO` → capitolo del layer
 * "padre" (i testi non sono un capitolo a sé); layer senza il separatore dominio-capitolo
 * (nessun prefisso noto) → l'humanizer del nome intero, mai `null`.
 */
export function capitoloDiLayer(layer: string): string {
  const clean = layer.replace(/_TESTO$/i, '').trim()
  const m = clean.match(/^[A-Z]+[.\d]*-(.+)$/i)
  const nome = m ? m[1] : clean
  return humanize(nome) || layer
}

/**
 * DISCIPLINA da un nome di layer studio: il prefisso di dominio della convenzione
 * `<DOMINIO>-<CAPITOLO>`. È il livello intermedio del computo — «la prima è l'ambito, la
 * seconda la disciplina, la terza la sottocategoria».
 *
 * Non è una tabella da mantenere per ogni impianto futuro: i domini noti hanno un nome
 * leggibile, gli altri restano il prefisso così com'è (meglio «HVAC» che niente). Chi non
 * ha prefisso non ha disciplina — e va bene: significa che non è un layer d'impianto.
 */
const DISCIPLINE: Record<string, string> = {
  // I domini sono SINONIMI, non un prefisso solo: ogni studio (e ogni epoca) abbrevia a
  // modo suo. `ELE-` e `IE-` sono la stessa cosa, e col riconoscimento guidato dal layer
  // sbagliare un dominio significa perdere tutto il disegno.
  ELE: 'Impianti elettrici',
  IE: 'Impianti elettrici',
  EL: 'Impianti elettrici',
  MC: 'Impianti meccanici',
  MECC: 'Impianti meccanici',
  MEC: 'Impianti meccanici',
  IM: 'Impianti meccanici',
  IS: 'Impianti idrico-sanitari',
  IDR: 'Impianti idrico-sanitari',
  VE: 'Impianti di ventilazione',
  ANT: 'Impianti antincendio',
  TLC: 'Impianti di telecomunicazione',
  EDI: 'Opere edili',
}
export function disciplinaDiLayer(layer: string): string {
  const m = layer.replace(/_TESTO$/i, '').trim().match(/^([A-Z]+)[.\d]*-/i)
  if (!m) return ''
  const dom = m[1].toUpperCase()
  return DISCIPLINE[dom] || dom
}
