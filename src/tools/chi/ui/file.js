/* χ Refs — ingresso del file: analisi, proposta di mappatura.

   Due passate sul FILE, non sulla memoria: la prima conta i layer (veloce, e non
   alloca niente per entità), la seconda riscrive in export mentre l'utente ha già
   deciso. Il testo del DXF non viene mai tenuto in RAM fra le due: su una tavola
   da 240 MB sarebbero mezzo giga di stringa per niente. */
import { AnalizzatoreDxf, deduciScala } from '../../../shared/dxf-import/analizza'
import { leggiStreamConFallback } from '../../../shared/dxf-import/codifica'
import { suggerisciTutti } from '../../../shared/xref/suggerisci'
import { rigaDaSuggerimento } from '../engine/piano'
import { MANTIENI } from '../../../shared/xref/standard'
import { azzeraMassimo, invalidaDestinazioni, renderTrasferimento } from './trasferimento.js'
import { proponiProfilo } from './profilo.js'
import { azzera, S, setS } from './stato.js'
import { mostraVista } from './shell.js'
import { avanzamento, toast } from './util.js'

export function apriFileClick() {
  const i = document.getElementById('cFile')
  if (i) i.click()
}

export function onFileScelto(ev) {
  const f = ev.target && ev.target.files && ev.target.files[0]
  if (f) caricaFile(f)
  if (ev.target) ev.target.value = '' // così riaprire lo stesso file rifà l'analisi
}

export function onDrop(ev) {
  ev.preventDefault()
  document.getElementById('cDrop')?.classList.remove('ehb-dropzone--over')
  const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]
  if (f) caricaFile(f)
}
export function onDragOver(ev) { ev.preventDefault(); document.getElementById('cDrop')?.classList.add('ehb-dropzone--over') }
export function onDragLeave() { document.getElementById('cDrop')?.classList.remove('ehb-dropzone--over') }

export async function caricaFile(file) {
  if (!/\.dxf$/i.test(file.name)) {
    toast('χ lavora sui DXF. Se hai un DWG, salvalo come DXF dal CAD.')
    return
  }
  azzera()
  invalidaDestinazioni()
  setS('file', file)
  setS('nomeFile', file.name)
  setS('byte', file.size)

  try {
    avanzamento(0, `Leggo «${file.name}»…`)
    const analisi = await analizzaStream(file, (f) => avanzamento(f, `Leggo «${file.name}»…`))
    avanzamento(null)

    setS('analisi', analisi)
    setS('scala', deduciScala(analisi))
    /* Le righe nascono TUTTE da smistare: il suggerimento resta a bordo, ma non
       viene applicato finché l'utente non preme «Smista automaticamente». Vedere
       il file com'è, prima di vederlo riordinato, è metà del lavoro. */
    setS('righe', suggerisciTutti(analisi.layer).map(r => ({
      ...rigaDaSuggerimento(r, S.preset),
      destinazione: r.destinazione === MANTIENI ? MANTIENI : '',
      suggerimento: r.suggerimento,
    })))
    azzeraMassimo()
    riapplicaDecisioni()

    const avvisi = []
    if (analisi.disallineamenti) {
      avvisi.push(`Il file è malformato (${analisi.disallineamenti} righe fuori posto): di solito è passato da un convertitore online. Lo copiamo fedelmente, ma la rimappatura può essere incompleta — meglio chiedere il DXF salvato dal CAD.`)
    }
    if (!analisi.layer.length) avvisi.push('Nessun layer trovato: il file non sembra un DXF valido.')
    setS('avvisi', avvisi)

    mostraVista('fondi')
    proponiProfilo()
    renderTrasferimento()
  } catch (e) {
    avanzamento(null)
    toast(`Non riesco a leggere il DXF: ${(e && e.message) || e}`)
  }
}

/** Analisi a stream: il file non viene mai materializzato tutto insieme.
    La codifica rilevata (UTF-8 o cp1252) resta nello stato: l'export la riusa
    per rileggere e ri-codificare il file senza un tentativo a vuoto. */
async function analizzaStream(file, onProg) {
  const { consumatore, codifica } = await leggiStreamConFallback(file, () => new AnalizzatoreDxf(), onProg)
  setS('codifica', codifica)
  return consumatore.chiudi()
}

/** Le decisioni salvate nel .ehub tornano utili solo se si riapre lo stesso file. */
function riapplicaDecisioni() {
  const attese = S.decisioniInAttesa
  if (!Array.isArray(attese) || !attese.length) return
  const per = new Map(attese.map(d => [d.layer, d]))
  let n = 0
  for (const r of S.righe) {
    const d = per.get(r.layer.nome)
    if (!d) continue
    r.destinazione = d.dest
    if (typeof d.acceso === 'boolean') r.acceso = d.acceso
    r.manuale = !!d.manuale
    n++
  }
  S.decisioniInAttesa = []
  if (n) toast(`Riprese ${n} decisioni dal progetto.`)
}
