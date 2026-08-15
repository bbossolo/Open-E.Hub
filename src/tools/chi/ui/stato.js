/* χ Refs — lo stato di lavoro. Vive in RAM e nel .ehub, MAI in localStorage:
   «Nuovo progetto» deve azzerare davvero (regola rule-stato-sessione-piu-ehub).
   L'unica cosa che persiste sono i profili collaboratore, che sono capitale
   dello studio e stanno in memoria-studio. */
import { OPZIONI_DEFAULT } from '../engine/piano'

export const S = {
  /** Il File in ingresso: serve per rileggerlo in export senza tenerlo in RAM. */
  file: null,
  nomeFile: '',
  byte: 0,
  /** Esito di analizzaDxf. */
  analisi: null,
  /** Codifica rilevata all'analisi ('utf-8' | 'windows-1252'), per l'export. Di sessione, mai nel .ehub. */
  codifica: 'utf-8',
  /** Esito di deduciScala. */
  scala: null,
  /** RigaMappatura[] — la tabella su cui lavora l'utente. */
  righe: [],
  /** Filtro testuale del pannello. */
  filtro: '',
  /** Mostra solo le righe ancora da decidere. */
  soloDaDecidere: false,
  opzioni: { ...OPZIONI_DEFAULT },
  /** Avvisi da mostrare in testa (file malformato, scala non deducibile…). */
  avvisi: [],
  /** Profilo collaboratore riconosciuto e non ancora applicato, o null. */
  riconosciuto: null,
  /** Profilo in uso su questo file. */
  profiloApplicato: null,
  /** Layer di destinazione inventati dall'utente per questo file. */
  layerCustom: [],
  /** Cosa proporre in automatico: 'essenziale' (murature e arredi) o 'completo'. */
  preset: 'essenziale',
  /** Layer di studio rinominati PER QUESTO FILE: standard → nome scelto. */
  rinominati: {},
  /** Selezione corrente (nomi di layer), condivisa fra righe e pastiglie. */
  sel: new Set(),
  /** true dopo che l'utente ha premuto «Smista automaticamente». */
  smistato: false,
  /** true mentre l'animazione di smistamento è in corso. */
  inCorso: false,
  /** Menù contestuale aperto, o null. */
  menu: null,
  /** Acceso/spento deciso a video sui layer dello studio, valido per questo file. */
  spentiPerFile: {},
  vista: 'apri',
}

export function setS(k, v) { S[k] = v }

export function azzera() {
  S.file = null; S.nomeFile = ''; S.byte = 0
  S.analisi = null; S.codifica = 'utf-8'; S.scala = null; S.righe = []
  S.filtro = ''; S.soloDaDecidere = false
  S.opzioni = { ...OPZIONI_DEFAULT }
  S.avvisi = []
  S.riconosciuto = null
  S.profiloApplicato = null
  S.layerCustom = []
  S.preset = 'essenziale'
  S.rinominati = {}
  S.sel = new Set()
  S.smistato = false
  S.inCorso = false
  S.menu = null
  S.spentiPerFile = {}
  S.vista = 'apri'
}

/** Lo stato serializzabile per il Progetto Open E.Hub: le DECISIONI, mai il DXF.
    Un .ehub non deve pesare 240 MB — il file resta dove sta, come fa SharedDxf. */
export function statoSerializzabile() {
  return {
    nomeFile: S.nomeFile,
    byte: S.byte,
    opzioni: S.opzioni,
    layerCustom: S.layerCustom,
    preset: S.preset,
    rinominati: S.rinominati,
    spentiPerFile: S.spentiPerFile,
    decisioni: S.righe
      .filter(r => r.manuale)
      .map(r => ({ layer: r.layer.nome, dest: r.destinazione, acceso: r.acceso, manuale: true })),
  }
}

export function ripristina(stato) {
  if (!stato || typeof stato !== 'object') return
  if (stato.opzioni) S.opzioni = { ...OPZIONI_DEFAULT, ...stato.opzioni }
  S.nomeFile = stato.nomeFile || ''
  S.byte = stato.byte || 0
  // Le decisioni si riapplicano solo quando l'utente riapre lo stesso DXF: da sole
  // non significano niente, perché senza il file non c'è nessun layer da spostare.
  S.layerCustom = Array.isArray(stato.layerCustom) ? stato.layerCustom : []
  S.preset = stato.preset === 'completo' ? 'completo' : 'essenziale'
  S.rinominati = stato.rinominati && typeof stato.rinominati === 'object' ? stato.rinominati : {}
  S.spentiPerFile = stato.spentiPerFile && typeof stato.spentiPerFile === 'object' ? stato.spentiPerFile : {}
  S.decisioniInAttesa = Array.isArray(stato.decisioni) ? stato.decisioni : []
}
