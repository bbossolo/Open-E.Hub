/* χ Refs — la vista di lavoro: si smista da sinistra a destra.

   A sinistra i layer del file, a destra quelli dello studio. Tre principi, tutti
   e tre imparati usando il tool sui file veri:

   1 · LO SMISTAMENTO È UNA DECISIONE, NON UN FATTO. Il file si apre e si vede
       com'è: tutto a sinistra, cassetti vuoti a destra. Poi si preme «Smista
       automaticamente» e lo si guarda accadere. Un tool che riordina da solo
       prima che tu abbia visto niente ti chiede di fidarti; un tool che riordina
       quando glielo chiedi ti chiede solo di guardare.

   2 · CORREGGERE COSTA QUANTO ASSEGNARE. Il riconoscimento sbaglia — è nella sua
       natura sbagliare qualche volta — e una pastiglia già in un cassetto è viva
       quanto una riga: si seleziona, si clicca e si trascina allo stesso modo,
       da cassetto a cassetto, senza dover tornare a sinistra.

   3 · IL TRASCINAMENTO NON È L'UNICA VIA. Sulle colonne che scorrono trascinare
       vuol dire tenere premuto mentre si scorre, ed è faticoso. Qui convivono
       tre gesti: clic → menù sotto il puntatore (uno solo, veloce), selezione →
       clic sul cassetto o il suo numero (tanti insieme), e il trascinamento per
       chi lo preferisce.

   La colonna di sinistra resta un ELENCO DA SVUOTARE: ogni layer deve finire o
   in un layer dello studio o fra gli spenti. */
import { flashElement, formModal, promptModal, volaVerso } from '../../../shared/ui/components'
import { LAYER_STANDARD, SPEGNI } from '../../../shared/xref/standard'
import { coloreDi, conPreset } from '../engine/piano'
import { S, setS } from './stato.js'
import { esc, toast } from './util.js'

const q = (s) => document.querySelector(s)
const attesa = (ms) => new Promise(r => setTimeout(r, ms))

/* Gli elementi si cercano per CONFRONTO, non con un selettore.
   I nomi dei layer contengono spazi, pipe, parentesi e accenti — `TAV-B-XREF|RETINI accesi` è
   un nome vero — e infilarli in un selettore CSS significa dipendere da `CSS.escape`, che non
   c'è ovunque, per poi scoprire in silenzio che un cassetto non risponde. Un confronto di
   stringhe non ha questo problema. */
const cassEl = (d) => [...document.querySelectorAll('.c-cassetto')].find(z => z.dataset.d === d) || null
const elDi = (nome) => [...document.querySelectorAll('[data-l]')].find(x => x.dataset.l === nome) || null

export function renderTrasferimento() {
  cablaUnaVolta()
  renderSorgente()
  renderDestinazioni()
  aggiornaBarra()
}

/* ══ le destinazioni: standard, rinominati, inventati ═════════════════════ */

/**
 * L'elenco dei cassetti. Un layer di studio rinominato diventa a tutti gli effetti
 * un layer «su misura»: così il rinominare non tocca lo standard condiviso, che
 * resta quello per tutti gli altri file e per gli altri utenti.
 */
let _dest = null
let _destDaRin = null // riferimento di S.rinominati con cui _dest è stato costruito
let _destDaCustom = null // riferimento di S.layerCustom con cui _dest è stato costruito
export function invalidaDestinazioni() { _dest = null }
export function destinazioni() {
  // Oltre all'invalidazione esplicita (rinomina/crea/elimina), la cache si
  // ricostruisce da sola se S.rinominati o S.layerCustom sono stati
  // RIASSEGNATI (azzera, ripristina progetto, reset di test): confrontare i
  // riferimenti evita di dover propagare invalidaDestinazioni() ovunque quei
  // due campi possano essere toccati da fuori questo modulo.
  if (_dest && _destDaRin === S.rinominati && _destDaCustom === S.layerCustom) return _dest
  const primi = ['MURATURA', 'ARREDI', 'TESTI']
  const std = LAYER_STANDARD.map(v => {
    const nuovo = S.rinominati[v.nome]
    return nuovo ? { ...v, nome: nuovo, daStandard: v.nome, custom: true } : v
  })
  std.sort((a, b) => primi.indexOf(b.nome) - primi.indexOf(a.nome))
  _dest = [...std, ...S.layerCustom]
  _destDaRin = S.rinominati
  _destDaCustom = S.layerCustom
  return _dest
}

/** Quelle da passare al piano come «fuori standard»: rinominate + inventate. */
export function destinazioniFuoriStandard() {
  return destinazioni().filter(d => d.custom)
}

/* ══ colonna sinistra ═════════════════════════════════════════════════════ */

function daSmistare() {
  return S.righe.filter(r => !r.layer.vuoto && !r.destinazione && passaFiltro(r))
}

const passaFiltro = (r) => !S.filtro || r.layer.nome.toLowerCase().includes(S.filtro.toLowerCase())

function renderSorgente() {
  const el = document.getElementById('cSorgente')
  if (!el) return
  const righe = daSmistare().sort((a, b) => b.layer.nEntita - a.layer.nEntita)
  const nEnt = righe.reduce((s, r) => s + r.layer.nEntita, 0)

  el.innerHTML = `
    <div class="c-col__cap">
      <h3>Layer del file</h3>
      <span class="c-col__conta">${righe.length
        ? `<b class="${S.smistato ? 'c-attenzione' : ''}">${righe.length}</b> · ${nEnt.toLocaleString('it-IT')} entità`
        : 'elenco vuoto'}</span>
      <input id="cFiltro" class="ehb-input c-filtro" type="search" placeholder="Cerca…" value="${esc(S.filtro)}">
      ${S.sel.size ? `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft c-col__azioni" onclick="deseleziona()">${S.sel.size} selezionati ✕</button>` : ''}
    </div>
    <div class="c-lista c-lista--sorgente" data-d="">
      ${righe.map(riga).join('') || '<p class="c-vuoto"><b>✓</b>Tutti i layer sono stati smistati.</p>'}
    </div>`
}

function riga(r) {
  const l = r.layer
  const peso = Math.max(3, Math.round(100 * l.nEntita / massimo()))
  const perche = r.suggerimento ? r.suggerimento.motivo : ''
  const prop = r.suggerimento && r.suggerimento.destinazione
  return `
  <div class="c-riga${S.sel.has(l.nome) ? ' is-sel' : ''}" draggable="true" data-l="${esc(l.nome)}" title="${esc(perche)}">
    <span class="c-riga__peso" style="--p:${peso}%"></span>
    <span class="c-presa" aria-hidden="true">⋮⋮</span>
    ${l.prefissoXref ? `<span class="c-xref">${esc(l.prefissoXref)}</span>` : ''}
    <span class="c-riga__nome">${esc(l.base)}</span>
    <span class="c-riga__num">${l.nEntita.toLocaleString('it-IT')}</span>
    ${l.nTesti ? `<span class="c-riga__txt" title="${l.nTesti} di testo">${l.nTesti.toLocaleString('it-IT')} txt</span>` : ''}
    ${prop && prop !== SPEGNI ? `<button class="c-riga__proposta" data-accetta="${esc(l.nome)}" title="${esc(perche)}">→ ${esc(prop)}</button>` : ''}
  </div>`
}

/* ══ colonna destra ═══════════════════════════════════════════════════════ */

/** Raggruppa S.righe per destinazione UNA VOLTA per passata di render, invece di
    rifare uno scan lineare per ogni cassetto (era O(layer × cassetti)). */
function perDestinazione() {
  const m = new Map()
  for (const r of S.righe) {
    if (!r.destinazione) continue
    if (!m.has(r.destinazione)) m.set(r.destinazione, [])
    m.get(r.destinazione).push(r)
  }
  return m
}

function renderDestinazioni() {
  const el = document.getElementById('cDestinazioni')
  if (!el) return
  const voci = destinazioni()
  const per = perDestinazione()
  const usate = voci.filter(v => (per.get(v.nome) || []).length)
  const vuote = voci.filter(v => !usate.includes(v))

  el.innerHTML = `
    <div class="c-col__cap">
      <h3>Layer dello studio</h3>
      <span class="c-col__conta">${usate.length} in uso</span>

    </div>
    <div class="c-lista">
      ${cassetto({ nome: SPEGNI, etichetta: 'Spenti', cosa: 'restano nel file, invisibili', off: true }, -1, per.get(SPEGNI) || [])}
      ${[...usate, ...vuote].map((v, i) => cassetto(v, i, per.get(v.nome) || [])).join('')}
    </div>`
}

/** Stato acceso/spento di un cassetto: funzione pura condivisa dal template e
    dall'aggiornamento diretto del DOM (commutaDestinazione), per non far
    divergere la logica fra le due strade. */
function statoAcceso(v) {
  if (v.off) return { spento: true }
  const spento = v.nome in S.spentiPerFile ? S.spentiPerFile[v.nome] : !!v.spento
  return { spento }
}

function cassetto(v, i, dentro) {
  const nEnt = dentro.reduce((s, r) => s + r.layer.nEntita, 0)
  const { spento } = statoAcceso(v)
  return `
  <div class="c-cassetto${v.off ? ' c-cassetto--spenti' : ''}${dentro.length ? ' is-pieno' : ''}${spento && !v.off ? ' c-cassetto--spento' : ''}" data-d="${esc(v.nome)}">
    <div class="c-cassetto__cap">
      <i class="c-pastello${v.off ? ' c-pastello--off' : ''}" style="--c:${v.off ? 'transparent' : coloreDi(v.daStandard || v.nome)}"></i>
      ${v.off ? '' : `<button class="c-occhio" data-occhio="${esc(v.nome)}" title="${spento ? 'Il layer nascerà spento' : 'Il layer nascerà acceso'}" aria-pressed="${!spento}">${spento ? '⃠' : '👁'}</button>`}
      <span class="c-cassetto__nome">${esc(v.etichetta || v.nome)}</span>
      ${v.off ? '' : `<button class="ehb-icon-btn c-mini-btn" data-rin="${esc(v.nome)}" title="Rinomina questo layer">✎</button>`}
      ${v.custom && !v.daStandard ? `<button class="ehb-icon-btn c-mini-btn" data-elimina="${esc(v.nome)}" title="Elimina questo layer">×</button>` : ''}
      ${dentro.length
        ? `<span class="c-cassetto__conta">${dentro.length} · ${nEnt.toLocaleString('it-IT')}</span>`
        : `<span class="c-cassetto__cosa">${esc(v.cosa || '')}</span>`}
      <span class="c-tasto">${i < 0 ? '0' : i < 9 ? i + 1 : ''}</span>
    </div>
    ${dentro.length ? `<div class="c-pastiglie">${dentro.map(pastiglia).join('')}</div>` : ''}
  </div>`
}

/* La pastiglia è cliccabile, selezionabile e trascinabile come una riga:
   correggere uno smistamento sbagliato non deve costare più che farlo. */
const pastiglia = (r) => `
  <span class="c-pastiglia${r.appena ? ' nuova' : ''}${S.sel.has(r.layer.nome) ? ' is-sel' : ''}"
        draggable="true" data-l="${esc(r.layer.nome)}"
        title="${esc(r.layer.nome)} · ${r.layer.nEntita.toLocaleString('it-IT')} entità — spostalo altrove">
    ${esc(r.layer.base)}<button class="c-pastiglia__x" data-torna="${esc(r.layer.nome)}" title="Rimandalo a sinistra">×</button>
  </span>`

/* ══ smistamento automatico — a comando, e lo si guarda ═══════════════════ */

export async function smistaAuto() {
  if (S.inCorso) return
  const daFare = S.righe.filter(r => !r.layer.vuoto && !r.destinazione && r.suggerimento
    && conPreset(r.suggerimento.destinazione, S.preset))
  if (!daFare.length) { setS('smistato', true); renderTrasferimento(); toast('Non c’è altro che il tool sappia smistare da solo.'); return }

  setS('inCorso', true)
  aggiornaBarra()
  // Prima i pesanti: il primo volo è quello che conta di più.
  const scena = [...daFare].sort((a, b) => b.layer.nEntita - a.layer.nEntita)

  for (let i = 0; i < scena.length; i++) {
    const r = scena[i]
    const dest = conPreset(r.suggerimento.destinazione, S.preset)
    const rigaEl = [...document.querySelectorAll('.c-riga')].find(x => x.dataset.l === r.layer.nome) || null
    const cass = cassEl(dest)
    if (rigaEl && cass) {
      volaVerso(rigaEl, cass, r.layer.base, 380)
      rigaEl.classList.add('is-partita')
      setTimeout(() => {
        r.destinazione = dest; r.appena = true
        renderDestinazioni(); flashElement(cassEl(dest))
      }, 300)
    } else {
      r.destinazione = dest
    }
    // Ritmo: abbastanza lento da seguirlo, abbastanza svelto da non annoiare.
    await attesa(i < 3 ? 140 : 55)
  }

  await attesa(400)
  setS('inCorso', false)
  setS('smistato', true)
  S.righe.forEach(r => { r.appena = false })
  renderTrasferimento()
}

/* ══ assegnazione e correzione ════════════════════════════════════════════ */

export async function sposta(nomi, destinazione) {
  const lista = (Array.isArray(nomi) ? nomi : [nomi]).filter(n => dove(n) !== destinazione)
  if (!lista.length) return
  const cass = destinazione ? cassEl(destinazione) : q('.c-lista--sorgente')
  // Il volo parte PRIMA del ri-render: l'elemento di partenza deve esistere ancora.
  await Promise.all(lista.slice(0, 8).map((n, i) => attesa(i * 45).then(() => {
    const el = elDi(n)
    const r = S.righe.find(x => x.layer.nome === n)
    return volaVerso(el, cass, r ? r.layer.base : n)
  })))
  for (const n of lista) {
    const r = S.righe.find(x => x.layer.nome === n)
    if (!r) continue
    r.destinazione = destinazione
    r.manuale = true
    r.appena = !!destinazione
  }
  S.sel.clear()
  renderTrasferimento()
  if (destinazione) flashElement(cassEl(destinazione))
  setTimeout(() => { S.righe.forEach(r => { r.appena = false }) }, 400)
}

const dove = (nome) => {
  const r = S.righe.find(x => x.layer.nome === nome)
  return r ? r.destinazione : ''
}

export const rimanda = (n) => sposta(n, '')
export const spegni = (n) => sposta(n, SPEGNI)
export const accetta = (n) => {
  const r = S.righe.find(x => x.layer.nome === n)
  if (r && r.suggerimento) sposta(n, r.suggerimento.destinazione)
}

export function deseleziona() { S.sel.clear(); renderTrasferimento() }

export function spegniRestanti() {
  const resto = S.righe.filter(r => !r.layer.vuoto && !r.destinazione).map(r => r.layer.nome)
  if (!resto.length) { toast('Non era rimasto niente.'); return Promise.resolve() }
  // Si RESTITUISCE la promessa: chi chiama (e chi testa) deve poter aspettare la fine.
  return sposta(resto, SPEGNI)
}

export function cambiaPreset(preset) {
  setS('preset', preset)
  let n = 0
  for (const r of S.righe) {
    if (r.manuale || r.layer.vuoto || !r.suggerimento || !r.destinazione) continue
    const nuova = conPreset(r.suggerimento.destinazione, preset)
    if (nuova !== r.destinazione) { r.destinazione = nuova; n++ }
  }
  renderTrasferimento()
  toast(n ? `${n} layer riproposti.` : 'Cambiata la proposta: premi «Smista automaticamente».')
}

/* ══ interruttore, rinomina, layer nuovi ══════════════════════════════════ */

/** Il toggle "occhio" è l'azione più frequente del pannello: aggiorna solo il
    nodo del cassetto invece di rifare il render completo delle due colonne. */
export function commutaDestinazione(nome) {
  const v = destinazioni().find(x => x.nome === nome)
  if (!v) return
  const { spento: ora } = statoAcceso(v)
  S.spentiPerFile[nome] = !ora
  const spento = !ora
  const cass = cassEl(nome)
  if (!cass) { renderTrasferimento(); return }
  cass.classList.toggle('c-cassetto--spento', spento)
  const b = cass.querySelector('[data-occhio]')
  if (b) {
    b.textContent = spento ? '⃠' : '👁'
    b.setAttribute('aria-pressed', String(!spento))
    b.title = spento ? 'Il layer nascerà spento' : 'Il layer nascerà acceso'
  }
}

/**
 * Rinomina un layer di destinazione. Vale per QUESTO file: lo standard dello studio
 * è un dato condiviso, e un tool che lo riscrive da sotto agli altri utenti è un
 * tool che nessuno lascerà usare a due persone insieme.
 */
export async function rinominaDestinazione(nome) {
  const v = destinazioni().find(x => x.nome === nome)
  if (!v) return
  const n = await promptModal({
    title: 'Rinomina il layer di destinazione',
    message: 'Vale per questo file: lo standard dello studio resta quello per tutti gli altri.',
    etichetta: 'Nuovo nome', valore: nome, conferma: 'Rinomina',
  })
  if (!n || n === nome) return
  if (destinazioni().some(x => x.nome === n)) { toast('Esiste già un layer con questo nome.'); return }

  if (v.custom && !v.daStandard) v.nome = n
  else S.rinominati[v.daStandard || nome] = n
  if (nome in S.spentiPerFile) { S.spentiPerFile[n] = S.spentiPerFile[nome]; delete S.spentiPerFile[nome] }
  for (const r of S.righe) if (r.destinazione === nome) r.destinazione = n

  invalidaDestinazioni()
  renderTrasferimento()
  toast(`«${nome}» → «${n}» per questo file.`)
}

export async function nuovoLayer() {
  const r = await formModal({
    title: 'Nuovo layer di destinazione',
    message: 'Serve quando ciò che vuoi tenere non ha un posto nello standard — l’impianto altrui, per esempio, da raggruppare invece che spegnere.',
    conferma: 'Crea',
    campi: [
      { nome: 'nome', etichetta: 'Nome del layer', valore: 'X-IMPIANTI ALTRUI' },
      { nome: 'aci', etichetta: 'Colore', valore: '9', tipo: 'number', nota: 'Numero colore AutoCAD (1-255). 9 = grigio chiaro.' },
    ],
  })
  if (!r || !r.nome) return
  const n = r.nome
  if (destinazioni().some(v => v.nome === n)) { toast('Esiste già un layer con questo nome.'); return }
  const aci = parseInt(r.aci, 10)
  S.layerCustom.push({
    nome: n, aci: Number.isFinite(aci) && aci > 0 ? Math.min(255, aci) : 9,
    linetype: 'Continuous', spento: false, custom: true, cosa: 'Layer creato da te',
  })
  invalidaDestinazioni()
  renderTrasferimento()
  toast(`«${n}» creato: ora puoi trascinarci dentro i layer.`)
}

export function eliminaLayerCustom(nome) {
  const dentro = S.righe.filter(r => r.destinazione === nome)
  if (dentro.length && !confirm(`«${nome}» contiene ${dentro.length} layer: torneranno a sinistra. Procedo?`)) return
  for (const r of dentro) r.destinazione = ''
  setS('layerCustom', S.layerCustom.filter(v => v.nome !== nome))
  invalidaDestinazioni()
  renderTrasferimento()
}

/* ══ cablaggio ════════════════════════════════════════════════════════════
   Delega su #cSorgente/#cDestinazioni (mai sostituiti, solo il loro innerHTML):
   un solo binding per container invece di riattaccare listener a ogni riga e
   cassetto a ogni render — su tavole con centinaia di layer il costo del
   re-bind era il vero collo di bottiglia del pannello. */

let _cablato = false
function cablaUnaVolta() {
  if (_cablato) return
  _cablato = true
  ;[q('#cSorgente'), q('#cDestinazioni')].forEach(root => { if (root) cablaContainer(root) })
}

function cablaContainer(root) {
  // Righe E pastiglie: stessa presa, stesso gesto, stesso trascinamento.
  root.addEventListener('dragstart', (e) => {
    const n = e.target.closest('[data-l]')
    if (!n) return
    e.stopPropagation()
    const scelti = S.sel.size && S.sel.has(n.dataset.l) ? [...S.sel] : [n.dataset.l]
    e.dataTransfer.setData('text/plain', JSON.stringify(scelti))
    e.dataTransfer.effectAllowed = 'move'
    document.body.classList.add('c-trascinando')
  })
  root.addEventListener('dragend', (e) => {
    if (e.target.closest('[data-l]')) document.body.classList.remove('c-trascinando')
  })

  root.addEventListener('dragover', (e) => {
    const z = e.target.closest('.c-cassetto, .c-lista--sorgente')
    if (!z) return
    e.preventDefault()
    z.classList.add('is-sopra')
  })
  root.addEventListener('dragleave', (e) => {
    const z = e.target.closest('.c-cassetto, .c-lista--sorgente')
    if (z) z.classList.remove('is-sopra')
  })
  root.addEventListener('drop', (e) => {
    const z = e.target.closest('.c-cassetto, .c-lista--sorgente')
    if (!z) return
    e.preventDefault(); e.stopPropagation()
    z.classList.remove('is-sopra')
    let nomi = []
    try { nomi = JSON.parse(e.dataTransfer.getData('text/plain')) } catch { nomi = [] }
    if (nomi.length) sposta(nomi, z.dataset.d)
  })

  // Un solo handler di click per container: bottoni interni prima, poi la
  // riga/pastiglia, poi lo sfondo del cassetto — l'ordine sostituisce lo
  // stopPropagation() fra listener separati che aveva il binding per-nodo.
  root.addEventListener('click', (e) => {
    const torna = e.target.closest('[data-torna]')
    if (torna) { e.stopPropagation(); rimanda(torna.dataset.torna); return }
    const acc = e.target.closest('[data-accetta]')
    if (acc) { e.stopPropagation(); accetta(acc.dataset.accetta); return }
    const rin = e.target.closest('[data-rin]')
    if (rin) { e.stopPropagation(); rinominaDestinazione(rin.dataset.rin); return }
    const elim = e.target.closest('[data-elimina]')
    if (elim) { e.stopPropagation(); eliminaLayerCustom(elim.dataset.elimina); return }
    const occhio = e.target.closest('[data-occhio]')
    if (occhio) { e.stopPropagation(); commutaDestinazione(occhio.dataset.occhio); return }
    const riga_ = e.target.closest('[data-l]')
    if (riga_) { e.stopPropagation(); onClick(e, riga_.dataset.l); return }
    // Con qualcosa di selezionato, lo sfondo del cassetto si clicca e basta.
    const zona = e.target.closest('.c-cassetto, .c-lista--sorgente')
    if (zona && S.sel.size) sposta([...S.sel], zona.dataset.d)
  })

  root.addEventListener('input', (e) => {
    if (!e.target || e.target.id !== 'cFiltro') return
    setS('filtro', e.target.value)
    renderSorgente()
    rimettiFuoco()
  })
}

function rimettiFuoco() {
  const f = document.getElementById('cFiltro')
  if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length) }
}

/* ══ i tre gesti ══════════════════════════════════════════════════════════ */

function onClick(e, nome) {
  // Con la maiuscola si costruisce una selezione; senza, il menù sotto il puntatore.
  if (e.shiftKey || e.metaKey || e.ctrlKey || S.sel.size) {
    if (e.shiftKey && S.ultimo) {
      const vis = [...document.querySelectorAll('[data-l]')].map(n => n.dataset.l)
      const a = vis.indexOf(S.ultimo), b = vis.indexOf(nome)
      if (a >= 0 && b >= 0) vis.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(n => S.sel.add(n))
    } else if (S.sel.has(nome)) S.sel.delete(nome)
    else S.sel.add(nome)
    S.ultimo = nome
    renderTrasferimento()
    return
  }
  apriMenu(e, nome)
}

/** Il menù nasce sotto il puntatore: vale anche sulle pastiglie già assegnate,
    ed è lì che serve davvero — quando la proposta è sbagliata. */
function apriMenu(e, nome) {
  chiudiMenu()
  const cur = dove(nome)
  const voci = [
    ...destinazioni().map((d, i) => ({ id: d.nome, colore: coloreDi(d.daStandard || d.nome), k: i < 9 ? String(i + 1) : '' })),
    { id: SPEGNI, et: 'Spenti', colore: '', k: '0' },
  ]
  if (cur) voci.push({ id: '', et: '← rimanda a sinistra', colore: '', k: '←' })

  const pop = document.createElement('div')
  pop.className = 'c-menu'
  pop.innerHTML = `
    <div class="c-menu__t">«${esc(nome)}»${cur ? ` è in <b>${esc(cur === SPEGNI ? 'Spenti' : cur)}</b> · spostalo in…` : ' va in…'}</div>
    <div class="c-menu__lista">${voci.map(v => `
      <button class="c-menu__v${v.id === cur ? ' is-cur' : ''}" data-v="${esc(v.id)}">
        <i class="c-pastello${v.colore ? '' : ' c-pastello--off'}" style="--c:${v.colore || 'transparent'}"></i>
        ${esc(v.et || v.id)}<kbd>${v.k}</kbd>
      </button>`).join('')}</div>`
  document.body.appendChild(pop)
  pop.style.left = `${Math.min(e.clientX + 6, innerWidth - 262)}px`
  pop.style.top = `${Math.max(8, Math.min(e.clientY - 8, innerHeight - pop.offsetHeight - 12))}px`
  pop.querySelectorAll('[data-v]').forEach(b => {
    b.onclick = (ev) => { ev.stopPropagation(); const v = b.dataset.v; chiudiMenu(); sposta(nome, v) }
  })
  S.menu = { el: pop, nome }
  setTimeout(() => document.addEventListener('click', chiudiMenu, { once: true }), 0)
}

function chiudiMenu() { if (S.menu) { S.menu.el.remove(); S.menu = null } }

/** Tastiera: senza, «senza trascinamento» resta una promessa a metà. */
export function tasti(e) {
  const scegli = (k, nomi) => {
    const i = '0123456789'.indexOf(k)
    if (i < 0) return false
    const dest = i === 0 ? SPEGNI : (destinazioni()[i - 1] || {}).nome
    if (dest) sposta(nomi, dest)
    return true
  }
  if (S.menu) {
    if (e.key === 'Escape') return chiudiMenu()
    const n = S.menu.nome
    if (e.key === 'ArrowLeft') { chiudiMenu(); return rimanda(n) }
    if (scegli(e.key, n)) chiudiMenu()
    return
  }
  if (S.sel.size) {
    if (e.key === 'Escape') return deseleziona()
    if (e.key === 'ArrowLeft') { const l = [...S.sel]; S.sel.clear(); return sposta(l, '') }
    scegli(e.key, [...S.sel])
  }
}

/* ══ barra ════════════════════════════════════════════════════════════════ */

let _max = 0
function massimo() {
  if (!_max) _max = Math.max(1, ...S.righe.map(r => r.layer.nEntita))
  return _max
}
export function azzeraMassimo() { _max = 0 }

export function aggiornaBarra() {
  const sel = document.querySelector('.c-preset')
  if (sel && sel.value !== S.preset) sel.value = S.preset
  const b = document.getElementById('btnSmista')
  if (b) {
    b.disabled = S.inCorso
    b.textContent = S.inCorso ? 'Sto smistando…' : S.smistato ? '↻ Rismista quello che resta' : '⚡ Smista automaticamente'
    b.classList.toggle('c-pulsa', !S.smistato && !S.inCorso)
  }
  const el = document.getElementById('cRiepilogo')
  if (!el) return
  const attive = S.righe.filter(r => !r.layer.vuoto)
  const studio = attive.filter(r => r.destinazione && r.destinazione !== SPEGNI)
  const spenti = attive.filter(r => r.destinazione === SPEGNI)
  const resta = attive.filter(r => !r.destinazione)
  const ent = studio.reduce((s, r) => s + r.layer.nEntita, 0)
  el.innerHTML = (!S.smistato && !S.inCorso)
    ? `<b>${attive.length}</b> layer nel file · nessuna decisione presa`
    : resta.length
      ? `<span class="c-attenzione"><b>${resta.length}</b> ancora da smistare</span> · ${ent.toLocaleString('it-IT')} entità nei tuoi layer`
      : `<b>${ent.toLocaleString('it-IT')}</b> entità nei tuoi layer · ${spenti.length} layer spenti`
}
