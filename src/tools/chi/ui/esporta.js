/* χ Refs — l'export: la seconda passata sul file.

   Il DXF si riscrive mentre lo si rilegge dal disco, a pezzi, e i pezzi si accumulano come Blob.
   La regola inderogabile è NON concatenare le parti in una stringa: su una tavola grande
   sarebbero 240 MB di heap per niente, e il browser cede. I Blob li tiene il browser fuori
   dall'heap JS. */
import { CodificatoreCp1252, leggiStreamConFallback } from '../../../shared/dxf-import/codifica'
import { RiscrittoreDxf } from '../../../shared/dxf-import/riscrivi'
import { costruisciPiano, nomeUscita, riepiloga } from '../engine/piano'
import { S } from './stato.js'
import { destinazioniFuoriStandard } from './trasferimento.js'
import { avanzamento, toast } from './util.js'

/** Si svuota il buffer ogni tot, così non cresce mai una stringa grande. */
const SOGLIA_BUFFER = 4 << 20

export async function esportaXref() {
  if (!S.file || !S.analisi) { toast('Apri prima un DXF.'); return }
  const r = riepiloga(S.righe)
  if (!r.spostati && !r.spenti) { toast('Non hai deciso niente: non c’è nulla da normalizzare.'); return }
  if (r.daDecidere) {
    const ok = confirm(
      `${r.daDecidere} layer restano com’erano (${r.entitaDaDecidere.toLocaleString('it-IT')} entità): ` +
      'non li hai spostati né spenti.\nEsporto lo stesso?')
    if (!ok) return
  }

  const piano = costruisciPiano(S.righe, S.analisi, S.opzioni, destinazioniFuoriStandard(), S.spentiPerFile)

  /* La sorgente può essere ANSI/cp1252 (rilevato all'analisi): si decodifica col
     fallback condiviso e, simmetricamente, si RI-codifica l'output in cp1252 —
     Blob serializza le stringhe in UTF-8, e un file con $DWGCODEPAGE ANSI_1252
     pieno di byte UTF-8 mostrerebbe «Ã¨» al posto di «è» nel CAD. Con decode ed
     encode simmetrici le righe non toccate restano byte-per-byte identiche. */
  let parti = []
  let buffer = ''
  let enc = null
  const svuota = () => {
    if (!buffer) return
    parti.push(new Blob([enc ? enc.codifica(buffer) : buffer]))
    buffer = ''
  }
  const scrivi = (c) => {
    buffer += c
    if (buffer.length >= SOGLIA_BUFFER) svuota()
  }

  try {
    avanzamento(0, 'Scrivo l’xref…')
    const { consumatore: ris } = await leggiStreamConFallback(
      S.file,
      // factory: su un eventuale secondo tentativo si riparte da zero, con l'encoder giusto
      (codifica) => {
        parti = []; buffer = ''
        enc = codifica === 'windows-1252' ? new CodificatoreCp1252() : null
        return new RiscrittoreDxf(piano, scrivi)
      },
      (f) => avanzamento(f, 'Scrivo l’xref…'),
      S.codifica,
    )
    const esito = ris.chiudi()
    svuota()
    avanzamento(null)

    scarica(new Blob(parti, { type: 'application/dxf' }), nomeUscita(S.nomeFile))

    const creati = esito.layerCreati.length ? ` · creati ${esito.layerCreati.join(', ')}` : ''
    toast(`Fatto: ${esito.entitaRiscritte.toLocaleString('it-IT')} entità spostate${creati}.`)
    for (const a of esito.avvisi) toast(a)
    if (enc && enc.nonMappabili) toast(`${enc.nonMappabili} caratteri non rappresentabili in ANSI sono diventati «?».`)
  } catch (e) {
    avanzamento(null)
    toast(`Export non riuscito: ${(e && e.message) || e}`)
  }
}

function scarica(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Si revoca dopo un attimo: revocare subito annulla il download su alcuni browser.
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
