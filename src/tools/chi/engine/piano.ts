/**
 * Dallo stato del pannello al piano di riscrittura.
 *
 * È il punto in cui le decisioni prese a colpi di trascinamento diventano istruzioni per
 * `RiscrittoreDxf`. Tutto ciò che è ambiguo si risolve qui, una volta sola, invece di essere
 * sparso nella UI.
 */
import type { AnalisiDxf, LayerTrovato } from '../../../shared/dxf-import/analizza'
import type { LayerStudio, PianoRiscrittura } from '../../../shared/dxf-import/riscrivi'
import { LAYER_STANDARD, MANTIENI, SPEGNI, voceStandard } from '../../../shared/xref/standard'
import type { RigaMappatura } from '../../../shared/xref/suggerisci'

export interface OpzioniPiano {
  /** Porta tutti i testi sul layer testi, così sopravvivono allo spegnimento del loro layer. */
  preservaTesti: boolean
  /** Layer d'origine i cui testi vanno buttati (le quote altrui, di solito). */
  scartaTesti: string[]
  /** Riporta le entità spostate a BYLAYER: il colore lo detta il layer di destinazione. */
  forzaByLayer: boolean
  /** Unità da dichiarare nell'header. null = non toccare. */
  insunits: number | null
  /**
   * Fattore di riscalatura GEOMETRICA. 1 (o null) = non si tocca un numero, si dichiarano solo
   * le unità: è il default, ed è la scelta giusta quasi sempre. Il fattore vero serve quando il
   * collaboratore disegna in metri e la tavola va davvero portata a millimetri.
   */
  fattoreScala: number | null
}

export const OPZIONI_DEFAULT: OpzioniPiano = {
  preservaTesti: true,
  scartaTesti: [],
  forzaByLayer: true,
  insunits: 4, // millimetri: è lo standard delle tavole dello studio
  fattoreScala: null, // solo header: nessuna coordinata toccata, tutto reversibile
}

export const LAYER_TESTI = 'TESTI'

/**
 * Una riga di lavoro, come la vede l'utente sullo schermo.
 *
 * Una sola informazione: **dove va**. `''` significa «non ancora deciso», e non è uno stato in
 * cui una riga può restare: la colonna di sinistra è un elenco da SVUOTARE, ogni layer del file
 * deve finire o in un layer dello studio o fra gli spenti. Un layer lasciato a metà è lavoro non
 * fatto, e deve vedersi che manca.
 *
 * Per questo `SPEGNI` è di nuovo una destinazione e non un interruttore: se tutto deve finire da
 * qualche parte, anche «si spegne e basta» è un posto.
 */
export interface Riga {
  layer: LayerTrovato
  /** Layer di destinazione, `SPEGNI`, oppure '' se ancora da smistare. */
  destinazione: string
  manuale: boolean
}

/**
 * Cosa vogliamo davvero da una base architettonica altrui.
 *
 * Nelle nostre tavole l'xref serve a vedere **dove sono i muri e cosa c'è dentro**: murature e
 * arredi, con le scritte che li accompagnano. Tutto il resto — l'impianto di chi ce l'ha
 * mandata, le sue quote, i suoi retini, i suoi cartigli — di norma si spegne. Chi vuole tenere
 * di più passa alla mappatura completa e trascina dove gli serve: il vocabolario dello standard resta
 * tutto disponibile, cambia solo ciò che viene PROPOSTO.
 */
export const PRESET_ESSENZIALE = new Set(['MURATURA', 'ARREDI', 'TESTI', 'TRAVI', 'SANITARI'])

export type Preset = 'essenziale' | 'completo'

/** Applica il preset a una proposta: fuori dall'essenziale, si spegne. */
export function conPreset(destinazione: string, preset: Preset): string {
  if (preset === 'completo' || !destinazione || destinazione === SPEGNI) return destinazione
  return PRESET_ESSENZIALE.has(destinazione) ? destinazione : SPEGNI
}

/** Un layer di destinazione inventato dall'utente: non è nello standard, ma serve. */
export interface LayerCustom extends LayerStudio {
  cosa?: string
}

/**
 * Costruisce il piano. Nella tabella finiscono SOLO i layer di destinazione effettivamente usati
 * (più il layer testi se si preservano i testi): crearli tutti su ogni file riempirebbe l'elenco layer
 * di voci che non contengono niente.
 */
export function costruisciPiano(
  righe: Riga[],
  analisi: AnalisiDxf,
  opz: OpzioniPiano = OPZIONI_DEFAULT,
  custom: LayerCustom[] = [],
  /** Acceso/spento deciso a video per QUESTO file: non cambia lo standard dello studio. */
  spentiPerFile: Record<string, boolean> = {},
): PianoRiscrittura {
  const rinomina: Record<string, string> = {}
  const spenti: string[] = []
  const usati = new Set<string>()

  for (const r of righe) {
    const dest = r.destinazione
    // Non ancora smistato: si lascia esattamente com'era. Non è una decisione, è una decisione
    // mancante, e il riepilogo la conta come tale.
    if (!dest) continue
    if (dest === SPEGNI) { spenti.push(r.layer.nome); continue }
    // `MANTIENI` non è un posto dove mettere le cose: è il modo di dire «questo
    // non si tocca» (il layer 0, i layer vuoti). Trattarlo come una destinazione
    // lo faceva finire nella mappa di rinomina, e da lì nell'header come nome del
    // layer corrente: il file usciva dichiarando attivo un layer inesistente.
    if (dest === MANTIENI) continue
    usati.add(dest)
    if (dest !== r.layer.nome) rinomina[r.layer.nome] = dest
  }

  // Il layer 0 FUORI dai blocchi (geometria o INSERT lasciati lì per disattenzione, non
  // definizioni) non ha nessuna eredità ByBlock da proteggere — quella il motore la protegge già,
  // dentro alle definizioni. Fuori, trattarlo da intoccabile lo lascerebbe per sempre acceso e
  // fuori controllo: lo mandiamo in muratura, così segue le sue regole di colore e spegnimento
  // come ogni altro elemento architettonico.
  rinomina['0'] = 'MURATURA'
  rinomina['_0'] = 'MURATURA'
  usati.add('MURATURA')

  if (opz.preservaTesti && righe.some(r => r.layer.nTesti > 0)) usati.add(LAYER_TESTI)

  const disponibili: LayerStudio[] = [...LAYER_STANDARD, ...custom]
  const tabella: LayerStudio[] = disponibili
    .filter(v => usati.has(v.nome))
    .map(({ nome, aci, linetype, lineweight, spento }) => ({
      nome, aci, linetype, lineweight,
      spento: nome in spentiPerFile ? spentiPerFile[nome] : spento,
    }))

  return {
    rinomina, tabella, spenti,
    testiSu: opz.preservaTesti ? LAYER_TESTI : null,
    scartaTesti: opz.scartaTesti,
    forzaByLayer: opz.forzaByLayer,
    insunits: opz.insunits ?? undefined,
    measurement: opz.insunits ? 1 : undefined,
    scala: opz.fattoreScala && opz.fattoreScala !== 1 ? { fattore: opz.fattoreScala } : null,
    handseed: analisi.handseed || undefined,
  }
}

/** Dalla proposta del riconoscimento alla riga di lavoro, filtrata dal preset. */
export function rigaDaSuggerimento(r: RigaMappatura, preset: Preset = 'essenziale'): Riga {
  const d = r.destinazione
  // `MANTIENI` vale solo per i layer vuoti, che non compaiono nell'elenco da svuotare.
  if (!d || d === MANTIENI) return { layer: r.layer, destinazione: d === MANTIENI ? MANTIENI : '', manuale: false }
  return { layer: r.layer, destinazione: conPreset(d, preset), manuale: false }
}

/** Cosa succederà, detto prima di farlo: serve alla riga di riepilogo sopra il pulsante. */
export interface Riepilogo {
  spostati: number
  entitaSpostate: number
  spenti: number
  entitaSpente: number
  daDecidere: number
  entitaDaDecidere: number
  destinazioni: Array<{ nome: string; nLayer: number; nEntita: number }>
}

export function riepiloga(righe: Riga[]): Riepilogo {
  const r: Riepilogo = { spostati: 0, entitaSpostate: 0, spenti: 0, entitaSpente: 0, daDecidere: 0, entitaDaDecidere: 0, destinazioni: [] }
  const per = new Map<string, { nLayer: number; nEntita: number }>()
  for (const riga of righe) {
    if (riga.layer.vuoto) continue
    const d = riga.destinazione
    if (!d) { r.daDecidere++; r.entitaDaDecidere += riga.layer.nEntita; continue }
    if (d === SPEGNI) { r.spenti++; r.entitaSpente += riga.layer.nEntita; continue }
    if (d === MANTIENI) continue
    r.spostati++
    r.entitaSpostate += riga.layer.nEntita
    const v = per.get(d) || { nLayer: 0, nEntita: 0 }
    v.nLayer++; v.nEntita += riga.layer.nEntita
    per.set(d, v)
  }
  r.destinazioni = [...per.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.nEntita - a.nEntita)
  return r
}

/** Nome del file in uscita: si dichiara nel nome cosa è stato fatto. */
export function nomeUscita(nomeOriginale: string): string {
  const senzaEst = nomeOriginale.replace(/\.dxf$/i, '')
  return `${senzaEst} — xref.dxf`
}

/** Colore CSS di un layer di studio, per l'anteprima e le pastiglie. */
export function coloreDi(nome: string): string {
  const v = voceStandard(nome)
  return v ? ACI[Math.abs(v.aci)] || '#888' : '#888'
}

/**
 * I pochi colori ACI che ci servono davvero, per mostrare in anteprima il layer col colore che
 * avrà in AutoCAD. Non è una tavola ACI completa: sono le tinte dello standard.
 */
const ACI: Record<number, string> = {
  1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff',
  7: '#d4d4d4', 8: '#808080', 9: '#c0c0c0',
  51: '#cccc00', 150: '#0080ff', 182: '#8080c0',
  251: '#4d4d4d', 252: '#666666', 253: '#999999', 254: '#cccccc',
}
