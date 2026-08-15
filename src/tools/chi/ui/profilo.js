/* χ Refs — il profilo del collaboratore nella UI.

   Compare solo quando serve dire qualcosa: «questo file assomiglia a Studio Rossi, applico?»
   oppure «hai deciso dodici cose a mano, le salvo per la prossima volta?». Un pannello sempre
   visibile che chiede di scegliere un profilo prima di cominciare sarebbe un ostacolo: il tool
   deve funzionare anche per chi non ha mai salvato niente. */
import { readAuth } from '../../../shared/session-profile'
import { promptModal } from '../../../shared/ui/components'
import {
  aggiorna, leggiArchivio, nuovoProfilo, riconosci, salvaProfilo,
} from '../../../shared/xref/profilo'
import { chiaveLayer } from '../../../shared/xref/suggerisci'
import { renderTrasferimento } from './trasferimento.js'
import { S, setS } from './stato.js'
import { esc, toast } from './util.js'

const oggi = () => new Date().toISOString().slice(0, 10)

function azienda() {
  try { return (readAuth() || {}).companyId || null } catch { return null }
}

/** Cerca il mittente e, se lo trova, applica le sue regole. Chiamata dopo l'analisi. */
export function proponiProfilo() {
  if (!S.righe.length) return
  const r = riconosci(S.righe.map(x => x.layer), leggiArchivio(localStorage, azienda()))
  setS('riconosciuto', r)
  renderProfilo()
}

export function renderProfilo() {
  const el = document.getElementById('cProfilo')
  if (!el) return
  const r = S.riconosciuto
  const applicato = S.profiloApplicato

  if (applicato) {
    el.innerHTML = `<span class="c-profilo__et">Profilo</span>
      <b>${esc(applicato.nome)}</b>
      <button class="ehb-btn ehb-btn--ghost" onclick="salvaProfiloCorrente()">Aggiorna il profilo</button>`
    return
  }
  if (r) {
    el.innerHTML = `<span class="c-profilo__et">Profilo</span>
      <span>Questo file assomiglia a <b>${esc(r.profilo.nome)}</b> (${Math.round(r.copertura * 100)}% dei layer già noti).</span>
      <button class="ehb-btn" onclick="applicaProfilo()">Applica le sue regole</button>
      <button class="ehb-btn ehb-btn--ghost" onclick="ignoraProfilo()">Ignora</button>`
    return
  }
  el.innerHTML = `<span class="c-profilo__et">Profilo</span>
    <span class="c-fioco">Collaboratore nuovo.</span>
    <button class="ehb-btn ehb-btn--ghost" onclick="salvaProfiloCorrente()">Salva le tue scelte per la prossima volta</button>`
}

export function applicaProfilo() {
  const r = S.riconosciuto
  if (!r) return
  let n = 0
  for (const riga of S.righe) {
    const dest = r.profilo.regole[chiaveLayer(riga.layer.nome)]
    if (!dest) continue
    riga.destinazione = dest
    riga.manuale = true
    n++
  }
  setS('profiloApplicato', r.profilo)
  setS('riconosciuto', null)
  renderProfilo()
  renderTrasferimento()
  toast(n ? `Applicate ${n} regole di ${r.profilo.nome}.` : `${r.profilo.nome} non aveva regole per questi layer.`)
}

export function ignoraProfilo() {
  setS('riconosciuto', null)
  renderProfilo()
}

export async function salvaProfiloCorrente() {
  const manuali = S.righe.filter(r => r.manuale && r.destinazione).length
  if (!manuali) { toast('Non hai ancora corretto niente a mano: non c’è nulla da ricordare.'); return }

  const suggerito = S.profiloApplicato ? S.profiloApplicato.nome : ''
  const nome = await promptModal({
    title: 'Salva le tue scelte',
    message: 'La prossima volta che arriva un file con questi layer, la mappatura è già fatta.',
    etichetta: 'Di chi è questo DXF?', valore: suggerito,
    segnaposto: 'es. Studio Rossi — architettonico', conferma: 'Salva',
  })
  if (!nome) return

  const arc = leggiArchivio(localStorage, azienda())
  const base = S.profiloApplicato && S.profiloApplicato.nome === nome
    ? S.profiloApplicato
    : (Object.values(arc).find(p => p.nome === nome) || nuovoProfilo(nome, oggi()))

  const p = aggiorna(base, S.righe, oggi())
  salvaProfilo(localStorage, p, azienda())
  setS('profiloApplicato', p)
  renderProfilo()
  toast(`Salvate ${Object.keys(p.regole).length} regole per ${p.nome}: la prossima volta è già fatto.`)
}
