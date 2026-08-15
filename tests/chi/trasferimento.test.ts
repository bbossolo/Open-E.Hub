// @vitest-environment jsdom
/**
 * χ Refs — LA VISTA FUNZIONA DAVVERO.
 *
 * Gemello di `tests/pi/boot-smoke.test.ts` e nato dalla stessa lezione: leggere il sorgente come
 * testo non dice se un pulsante fa quello che promette. Qui i moduli vengono ESEGUITI su un DOM
 * vero e si percorre il giro completo — apri, smista, correggi, rinomina — controllando ogni
 * volta il PIANO in uscita, che è l'unica cosa che finisce nel file del collaboratore.
 *
 * È il test che ha trovato il NUL dentro le costanti sentinella: `SPEGNI` passava per un
 * attributo HTML, il NUL diventava U+FFFD e trascinare sul cassetto «Spenti» non faceva niente,
 * in silenzio. Nessuno degli altri test poteva accorgersene.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

/* eslint-disable @typescript-eslint/no-explicit-any */
let T: any
let S: any
let costruisciPiano: typeof import('../../src/tools/chi/engine/piano').costruisciPiano
let SPEGNI: string

const layer = (nome: string, nEntita = 100) => ({
  nome, prefissoXref: null, base: nome,
  colore: 7, spento: false, congelato: false, bloccato: false,
  linetype: 'Continuous', lineweight: -3,
  nEntita, nTesti: 0, nInsert: 0, vuoto: nEntita === 0,
})

const sugg = (dest: string) => ({ destinazione: dest, confidenza: 0.9, motivo: '', regola: 'x' })

beforeAll(async () => {
  const html = readFileSync(resolve(ROOT, 'src/tools/chi/index.html'), 'utf8')
  document.body.innerHTML = html.replace(/[\s\S]*<body[^>]*>/, '').replace(/<\/body>[\s\S]*/, '')
  T = await import('../../src/tools/chi/ui/trasferimento.js' as string)
  S = (await import('../../src/tools/chi/ui/stato.js' as string)).S
  costruisciPiano = (await import('../../src/tools/chi/engine/piano')).costruisciPiano
  SPEGNI = (await import('../../src/shared/xref/standard')).SPEGNI
})

beforeEach(() => {
  S.layerCustom = []
  S.rinominati = {}
  S.spentiPerFile = {}
  S.sel = new Set()
  S.filtro = ''
  S.preset = 'essenziale'
  S.smistato = false
  S.inCorso = false
  S.menu = null
  S.righe = [
    { layer: layer('muri', 2430), destinazione: '', manuale: false, suggerimento: sugg('MURATURA') },
    { layer: layer('ARREDO', 900), destinazione: '', manuale: false, suggerimento: sugg('ARREDI') },
    { layer: layer('IE-FM', 380), destinazione: '', manuale: false, suggerimento: sugg(SPEGNI) },
    { layer: layer('MECCANICO', 42), destinazione: '', manuale: false, suggerimento: sugg('') },
  ]
  T.azzeraMassimo()
  T.renderTrasferimento()
})

/**
 * Compila il modale condiviso e conferma.
 *
 * I test passano dal modale VERO e non da un finto: è il modale che ha sostituito
 * `window.prompt()`, che nell'app desktop non esiste — Electron lo ignora e
 * restituisce undefined senza dire niente, e il pulsante sembra rotto. Se un
 * domani si rompe il modale, questi test se ne accorgono.
 */
async function rispondiAlModale(valori: string[]) {
  await Promise.resolve()
  const inputs = [...document.querySelectorAll<HTMLInputElement>('.ehb-modal input')]
  expect(inputs.length, 'il modale non si è aperto').toBeGreaterThan(0)
  inputs.forEach((i, k) => { if (valori[k] !== undefined) i.value = valori[k] })
  document.querySelector<HTMLButtonElement>('.ehb-modal .ehb-btn--accent')!.click()
  await Promise.resolve()
}

const piano = () => costruisciPiano(S.righe, { handseed: 0x100 } as never, undefined, T.destinazioniFuoriStandard(), S.spentiPerFile)
const zone = () => [...document.querySelectorAll('.c-cassetto')].map(z => (z as HTMLElement).dataset.d)
const dove = (n: string) => S.righe.find((r: any) => r.layer.nome === n).destinazione

describe('χ Refs · all’apertura il file si vede com’è', () => {
  it('nessuna decisione è già presa: tutto sta a sinistra', () => {
    // Un tool che riordina da solo prima che tu abbia visto niente ti chiede di fidarti.
    expect(S.righe.every((r: any) => !r.destinazione)).toBe(true)
    expect(document.getElementById('cSorgente')!.textContent).toContain('muri')
    expect(document.getElementById('cRiepilogo')!.textContent).toContain('nessuna decisione presa')
  })

  it('lo smistamento è un pulsante, e lo dichiara', () => {
    expect(document.getElementById('btnSmista')!.textContent).toContain('Smista automaticamente')
  })

  it('i cassetti sono zone di rilascio con la loro destinazione', () => {
    expect(zone()).toContain('MURATURA')
    expect(zone()).toContain(SPEGNI)
  })
})

describe('χ Refs · smistamento a comando', () => {
  it('applica le proposte e lascia a sinistra ciò che non sa', async () => {
    vi.useFakeTimers()
    const fatto = T.smistaAuto()
    // `Async`: lo smistamento è una catena di await, e i timer finti vanno avanzati
    // lasciando girare anche i microtask, altrimenti si ferma al primo volo.
    await vi.advanceTimersByTimeAsync(6000)
    await fatto
    vi.useRealTimers()
    expect(dove('muri')).toBe('MURATURA')
    expect(dove('ARREDO')).toBe('ARREDI')
    expect(dove('IE-FM')).toBe(SPEGNI)
    expect(dove('MECCANICO')).toBe('') // non riconosciuto: resta da smistare
  })

  it('il piano in uscita rispecchia lo smistamento', () => {
    S.righe[0].destinazione = 'MURATURA'
    S.righe[2].destinazione = SPEGNI
    const p = piano()
    expect(p.rinomina).toMatchObject({ muri: 'MURATURA' })
    expect(p.spenti).toContain('IE-FM')
  })
})

describe('χ Refs · correggere costa quanto assegnare', () => {
  it('una pastiglia già in un cassetto si sposta in un altro, senza tornare a sinistra', async () => {
    // È il buco che rendeva la vista inutilizzabile quando il riconoscimento sbagliava.
    S.righe[0].destinazione = 'MURATURA'
    T.renderTrasferimento()
    expect(document.querySelector('.c-pastiglia[data-l="muri"]')).toBeTruthy()

    await T.sposta('muri', 'ARREDI')
    expect(dove('muri')).toBe('ARREDI')
    expect(piano().rinomina).toMatchObject({ muri: 'ARREDI' })
  })

  it('e si può rimandare a sinistra', async () => {
    S.righe[0].destinazione = 'MURATURA'
    T.renderTrasferimento()
    await T.rimanda('muri')
    expect(dove('muri')).toBe('')
    // Il layer 0 fuori dai blocchi finisce sempre in muratura di default: non c'entra con 'muri'.
    expect(piano().rinomina).toEqual({ '0': 'MURATURA', '_0': 'MURATURA' })
  })

  it('sposta in blocco quello che è selezionato', async () => {
    S.sel = new Set(['muri', 'ARREDO'])
    await T.sposta([...S.sel], SPEGNI)
    expect(dove('muri')).toBe(SPEGNI)
    expect(dove('ARREDO')).toBe(SPEGNI)
    expect(S.sel.size).toBe(0)
  })
})

describe('χ Refs · rinominare un layer di studio', () => {
  it('cambia il nome, porta con sé il contenuto e finisce nel file', async () => {
    S.righe[0].destinazione = 'MURATURA'
    T.renderTrasferimento()
    const fatto = T.rinominaDestinazione('MURATURA')
    await rispondiAlModale(['V-MURI'])
    await fatto

    expect(dove('muri')).toBe('V-MURI')
    expect(zone()).toContain('V-MURI')
    const p = piano()
    expect(p.rinomina).toMatchObject({ muri: 'V-MURI' })
    expect(p.tabella!.map(v => v.nome)).toContain('V-MURI')
    // Il colore resta quello dello standard da cui viene: si rinomina, non si reinventa.
    expect(p.tabella!.find(v => v.nome === 'V-MURI')!.aci).toBe(252)
  })

  it('vale per questo file soltanto: lo standard condiviso non si tocca', async () => {
    const fatto = T.rinominaDestinazione('MURATURA')
    await rispondiAlModale(['V-MURI'])
    await fatto
    const { LAYER_STANDARD } = await import('../../src/shared/xref/standard')
    expect(LAYER_STANDARD.map(v => v.nome)).toContain('MURATURA')
  })

  it('non accetta un nome già in uso', async () => {
    const fatto = T.rinominaDestinazione('MURATURA')
    await rispondiAlModale(['ARREDI'])
    await fatto
    expect(zone()).toContain('MURATURA')
  })
})

describe('χ Refs · creare un layer che non è nello standard', () => {
  it('lo crea e ci si può spostare dentro', async () => {
    // Per un xref l'impianto altrui o si spegne o si raggruppa altrove, e «altrove»
    // spesso non è nello standard dello studio.
    const fatto = T.nuovoLayer()
    await rispondiAlModale(['X-IMPIANTI ALTRUI', '9'])
    await fatto
    expect(zone()).toContain('X-IMPIANTI ALTRUI')

    await T.sposta('IE-FM', 'X-IMPIANTI ALTRUI')
    const p = piano()
    expect(p.rinomina).toMatchObject({ 'IE-FM': 'X-IMPIANTI ALTRUI' })
    expect(p.tabella!.find(v => v.nome === 'X-IMPIANTI ALTRUI')!.aci).toBe(9)
  })

  it('eliminandolo, quello che conteneva torna a sinistra', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const fatto = T.nuovoLayer()
    await rispondiAlModale(['X-SCARTO', '9'])
    await fatto
    await T.sposta('IE-FM', 'X-SCARTO')
    T.eliminaLayerCustom('X-SCARTO')
    vi.unstubAllGlobals()
    expect(dove('IE-FM')).toBe('')
  })
})

describe('χ Refs · svuotare l’elenco', () => {
  it('«spegni i restanti» manda fra gli spenti tutto quello che è rimasto', async () => {
    S.righe[0].destinazione = 'MURATURA'
    await T.spegniRestanti()
    expect(dove('MECCANICO')).toBe(SPEGNI)
    expect(dove('muri')).toBe('MURATURA') // chi era già a posto non si tocca
  })

  it('l’interruttore su un cassetto decide se il layer nascerà acceso', () => {
    S.righe[0].destinazione = 'MURATURA'
    T.renderTrasferimento()
    T.commutaDestinazione('MURATURA')
    expect(piano().tabella!.find(v => v.nome === 'MURATURA')!.spento).toBe(true)
  })
})
