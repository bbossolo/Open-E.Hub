import { describe, it, expect } from 'vitest'
import { CodificatoreCp1252 } from '../../src/shared/dxf-import/codifica'
import { riscriviDxf, type LayerStudio, type PianoRiscrittura } from '../../src/shared/dxf-import/riscrivi'

/**
 * Il riscrittore DXF → DXF di χ Refs.
 *
 * La proprietà che questo modulo deve avere sopra ogni altra è l'IDENTITÀ: un file che
 * attraversa il riscrittore senza istruzioni deve uscire uguale ai byte che sono entrati. È
 * l'unica garanzia che consegnare indietro il disegno di un collaboratore non lo rovini — i
 * lettori della suite (`read.ts`) sono lossy per progetto e buttano via HATCH, SPLINE, quote e
 * immagini, e qui invece devono sopravvivere tutti senza che il codice sappia cosa sono.
 *
 * Le fixture sono minuscole e scritte a mano, come per `dxf-scene.test.ts`, ma riproducono i
 * casi VERI delle tavole dello studio: il pipe dei riferimenti esterni (`TAV-B-XREF|muri`), il
 * layer `0` dentro le definizioni di blocco, le entità che nessuno sa disegnare.
 */

/** Costruisce un DXF da coppie [codice, valore], con terminatore scelto. */
function dxf(coppie: Array<[number | string, string]>, term = '\n'): string {
  return coppie.map(([c, v]) => `${c}${term}${v}`).join(term) + term
}

const VUOTO: PianoRiscrittura = {}

const SEZ = (nome: string): Array<[number | string, string]> => [[0, 'SECTION'], [2, nome]]
const FINE: Array<[number | string, string]> = [[0, 'ENDSEC']]

const recordLayer = (nome: string, colore = 7): Array<[number | string, string]> => [
  [0, 'LAYER'], [5, '10'], [330, '2'],
  [100, 'AcDbSymbolTableRecord'], [100, 'AcDbLayerTableRecord'],
  [2, nome], [70, '0'], [62, String(colore)], [6, 'Continuous'], [370, '-3'],
]

const tabellaLayer = (...nomi: string[]): Array<[number | string, string]> => [
  ...SEZ('TABLES'),
  [0, 'TABLE'], [2, 'LAYER'], [5, '2'], [100, 'AcDbSymbolTable'], [70, String(nomi.length)],
  ...nomi.flatMap(n => recordLayer(n)),
  [0, 'ENDTAB'],
  ...FINE,
]

const linea = (layer: string): Array<[number | string, string]> => [
  [0, 'LINE'], [5, 'A1'], [8, layer], [10, '0'], [20, '0'], [11, '10'], [21, '0'],
]

const testo = (layer: string, s: string): Array<[number | string, string]> => [
  [0, 'TEXT'], [5, 'A2'], [8, layer], [10, '1'], [20, '1'], [40, '2.5'], [1, s],
]

const V_MURATURA: LayerStudio = { nome: 'MURATURA', aci: 252, linetype: 'Continuous', lineweight: 9 }
const V_TESTI: LayerStudio = { nome: 'TESTI', aci: 8, linetype: 'Continuous' }

/* ────────────────────────────────────────────────────────────────────────── */

describe('riscrittore DXF · identità byte per byte', () => {
  const casi: Array<[string, string]> = [
    ['LF', '\n'],
    ['CRLF', '\r\n'],
  ]

  for (const [nome, term] of casi) {
    it(`con un piano vuoto restituisce il file identico (${nome})`, () => {
      const dentro = dxf([
        ...SEZ('HEADER'), [9, '$INSUNITS'], [70, '4'], [9, '$CLAYER'], [8, 'MURI'], ...FINE,
        ...tabellaLayer('0', 'MURI'),
        ...SEZ('ENTITIES'), ...linea('MURI'), ...FINE,
        [0, 'EOF'],
      ], term)
      const { dxf: fuori } = riscriviDxf(dentro, VUOTO)
      expect(fuori).toBe(dentro)
    })
  }

  it('non perde il file quando manca il newline finale', () => {
    const dentro = dxf([...SEZ('ENTITIES'), ...linea('MURI'), ...FINE, [0, 'EOF']]).replace(/\n$/, '')
    expect(riscriviDxf(dentro, VUOTO).dxf).toBe(dentro)
  })

  it('ricopia intatte le entità che nessun lettore della suite sa disegnare', () => {
    // HATCH, SPLINE, DIMENSION, IMAGE: `read.ts` le scarta con la whitelist TIPI_UTILI, e un
    // giro parse→scrittura le cancellerebbe. Qui devono uscire uguali senza essere capite.
    const esotiche = dxf([
      ...SEZ('ENTITIES'),
      [0, 'HATCH'], [5, 'B1'], [8, 'RETINI'], [2, 'ANSI31'], [70, '0'], [91, '1'], [47, '0.02'],
      [0, 'SPLINE'], [5, 'B2'], [8, 'PROIEZIONI'], [70, '8'], [71, '3'], [40, '0.0'], [10, '1.5'],
      [0, 'DIMENSION'], [5, 'B3'], [8, 'QUOTE'], [2, '*D1'], [70, '32'], [42, '1200.0'],
      [0, 'OLE2FRAME'], [5, 'B4'], [8, 'TABELL'], [70, '2'],
      ...FINE, [0, 'EOF'],
    ])
    expect(riscriviDxf(esotiche, VUOTO).dxf).toBe(esotiche)
  })

  it('non si fa ingannare da un testo che somiglia a una struttura DXF', () => {
    // L'accoppiamento è posizionale: riga pari = codice, riga dispari = valore. Un MTEXT che
    // contiene «SECTION» o «0» è un valore, non può mai essere letto come codice.
    const insidioso = dxf([
      ...SEZ('ENTITIES'),
      [0, 'MTEXT'], [5, 'C1'], [8, 'SCRITTE'], [1, 'SECTION'], [3, '0'], [3, 'ENDSEC'],
      ...FINE, [0, 'EOF'],
    ])
    const { dxf: fuori, esito } = riscriviDxf(insidioso, { rinomina: { SCRITTE: 'TESTI' } })
    expect(esito.entitaRiscritte).toBe(1)
    expect(fuori).toContain('\n1\nSECTION\n') // il testo dell'utente è ancora lì, come valore
    expect(fuori).toContain('\n3\nENDSEC\n')
    // ...e non è diventato struttura: di ENDSEC veri (preceduti dal gruppo 0) ce n'è ancora uno
    expect(fuori.match(/\n0\nENDSEC\n/g)?.length).toBe(1)
  })
})

describe('riscrittore DXF · spostamento delle entità', () => {
  const base = dxf([
    ...tabellaLayer('0', 'muri', 'ARREDO'),
    ...SEZ('ENTITIES'), ...linea('muri'), ...linea('ARREDO'), ...FINE, [0, 'EOF'],
  ])

  it('sposta le entità sul layer di studio', () => {
    const { dxf: fuori, esito } = riscriviDxf(base, {
      rinomina: { muri: 'MURATURA', ARREDO: 'ARREDI' },
    })
    expect(esito.entitaRiscritte).toBe(2)
    expect(fuori).toContain('\n8\nMURATURA\n')
    expect(fuori).toContain('\n8\nARREDI\n')
  })

  it('non rinomina né elimina i record LAYER esistenti — li spegne', () => {
    // Sono puntati per handle da VIEWPORT/OBJECTS: cancellarli lascia riferimenti pendenti.
    const { dxf: fuori } = riscriviDxf(base, { rinomina: { muri: 'MURATURA' } })
    expect(fuori).toContain('\n2\nmuri\n') // il record c'è ancora, col suo nome
    const rec = fuori.slice(fuori.indexOf('\n2\nmuri\n'))
    expect(rec).toMatch(/\n62\n-7\n/) // ma è spento (62 negativo)
  })

  it('appiattisce il prefisso dei riferimenti esterni', () => {
    const conXref = dxf([
      ...SEZ('ENTITIES'), ...linea('TAV-B-XREF|muri'), ...FINE, [0, 'EOF'],
    ])
    const { dxf: fuori } = riscriviDxf(conXref, { rinomina: { muri: 'MURATURA' } })
    expect(fuori).toContain('\n8\nMURATURA\n')
  })

  it('lascia stare il layer 0 dentro le definizioni di blocco', () => {
    // Le entità su layer 0 in un blocco ereditano il layer dell'INSERT: spostarle romperebbe
    // l'ereditarietà di tutti i simboli.
    const conBlocco = dxf([
      ...SEZ('BLOCKS'),
      [0, 'BLOCK'], [5, 'D1'], [8, '0'], [2, 'PORTA'], [10, '0'], [20, '0'],
      ...linea('0'),
      [0, 'ENDBLK'], [5, 'D2'], [8, '0'],
      ...FINE, [0, 'EOF'],
    ])
    const { dxf: fuori } = riscriviDxf(conBlocco, { rinomina: { '0': 'MURATURA' } })
    expect(fuori).toBe(conBlocco)
  })

  it('fuori da un blocco il layer 0 non ha eredità da proteggere: segue la rinomina come chiunque altro', () => {
    // Un INSERT o una linea lasciati per disattenzione direttamente sul layer 0, in ENTITIES
    // (non dentro una definizione BLOCK), non ereditano niente da nessuno: possono benissimo
    // diventare muratura, con le sue regole di colore e spegnimento.
    const fuoriBlocco = dxf([
      ...SEZ('ENTITIES'), ...linea('0'), [0, 'INSERT'], [8, '0'], [2, 'PORTA'], [10, '0'], [20, '0'],
      ...FINE, [0, 'EOF'],
    ])
    const { dxf: fuori, esito } = riscriviDxf(fuoriBlocco, { rinomina: { '0': 'MURATURA' } })
    expect(fuori).toContain('\n8\nMURATURA\n')
    expect(fuori).not.toContain('\n8\n0\n')
    expect(esito.entitaRiscritte).toBe(2)
  })

  it('forza le entità spostate a BYLAYER, così il colore lo detta il layer di destinazione', () => {
    // Se il collaboratore ha messo il colore sulla singola entità, questa continuerebbe a
    // disegnarsi col colore suo anche dopo la fusione, e la tavola resterebbe sporca.
    const colorate = dxf([
      ...SEZ('ENTITIES'),
      [0, 'LINE'], [5, 'E1'], [8, 'muri'], [62, '1'], [420, '16711680'], [370, '50'],
      [10, '0'], [20, '0'], [11, '1'], [21, '0'],
      ...FINE, [0, 'EOF'],
    ])
    const { dxf: fuori } = riscriviDxf(colorate, {
      rinomina: { muri: 'MURATURA' }, forzaByLayer: true,
    })
    expect(fuori).toContain('\n8\nMURATURA\n')
    expect(fuori).not.toContain('\n62\n1\n')
    expect(fuori).not.toContain('\n420\n')
    expect(fuori).not.toContain('\n370\n50\n')
  })
})

describe('riscrittore DXF · tabella dei layer di studio', () => {
  const base = dxf([
    ...tabellaLayer('0', 'muri'),
    ...SEZ('ENTITIES'), ...linea('muri'), ...FINE, [0, 'EOF'],
  ])

  it('crea i layer di studio che il file non aveva, col colore giusto', () => {
    const { dxf: fuori, esito } = riscriviDxf(base, {
      rinomina: { muri: 'MURATURA' }, tabella: [V_MURATURA],
    })
    expect(esito.layerCreati).toEqual(['MURATURA'])
    expect(fuori).toContain('\n2\nMURATURA\n')
    const rec = fuori.slice(fuori.indexOf('\n2\nMURATURA\n'))
    expect(rec).toMatch(/\n62\n252\n/)
    expect(rec).toMatch(/\n370\n9\n/)
    // e va inserito PRIMA della chiusura della tabella
    expect(fuori.indexOf('MURATURA')).toBeLessThan(fuori.indexOf('ENDTAB'))
  })

  it('non duplica un layer di studio già presente nel file, lo allinea', () => {
    const conStandard = dxf([
      ...tabellaLayer('0', 'MURATURA'),
      ...SEZ('ENTITIES'), ...linea('MURATURA'), ...FINE, [0, 'EOF'],
    ])
    const { dxf: fuori, esito } = riscriviDxf(conStandard, { tabella: [V_MURATURA] })
    expect(esito.layerCreati).toEqual([])
    expect(fuori.match(/\n2\nMURATURA\n/g)?.length).toBe(1)
    expect(fuori).toMatch(/\n62\n252\n/) // colore d'ufficio riportato allo standard
  })

  it('spegne il layer di studio marcato come spento', () => {
    const { dxf: fuori } = riscriviDxf(base, {
      tabella: [{ nome: 'QUOTE', aci: 8, spento: true }],
    })
    const rec = fuori.slice(fuori.indexOf('\n2\nQUOTE\n'))
    expect(rec).toMatch(/\n62\n-8\n/)
  })
})

describe('riscrittore DXF · i testi si preservano', () => {
  const conTesti = dxf([
    ...tabellaLayer('0', 'MURI P1', 'QUOTE'),
    ...SEZ('ENTITIES'),
    ...linea('MURI P1'),
    ...testo('MURI P1', 'Soggiorno'),
    ...testo('QUOTE', '3.20'),
    ...FINE, [0, 'EOF'],
  ])

  it('porta i testi sul layer dei testi anche se il loro layer d’origine si spegne', () => {
    const { dxf: fuori } = riscriviDxf(conTesti, {
      rinomina: { 'MURI P1': 'MURATURA' }, tabella: [V_MURATURA, V_TESTI], testiSu: 'TESTI',
    })
    // la geometria va sulla muratura, la scritta sopravvive sui testi
    expect(fuori).toContain('\n8\nMURATURA\n')
    expect(fuori).toContain('\n8\nTESTI\n')
    expect(fuori).toContain('Soggiorno')
  })

  it('butta via i testi dei layer che l’utente ha scelto di scartare', () => {
    // Le quote del collaboratore non servono nelle nostre tavole.
    const { dxf: fuori, esito } = riscriviDxf(conTesti, {
      testiSu: 'TESTI', scartaTesti: ['QUOTE'],
    })
    expect(esito.entitaScartate).toBe(1)
    expect(fuori).not.toContain('3.20')
    expect(fuori).toContain('Soggiorno') // gli altri restano
  })
})

describe('riscrittore DXF · file malformati', () => {
  it('segnala il disallineamento delle coppie invece di tacere', () => {
    // Caso reale: il DXF della villa Ascari, uscito da un convertitore online, ha un MTEXT con
    // un a capo dentro il valore. Nemmeno AutoCAD lo apre. Noi lo ricopiamo fedelmente, ma
    // dobbiamo dirlo — un tool che tace qui restituisce un file che il collaboratore non apre.
    const rotto = dxf([
      ...SEZ('ENTITIES'),
      [0, 'MTEXT'], [5, 'F1'], [8, 'TESTI'], [1, 'prima riga'],
    ]) + 'seconda riga senza codice\n' + dxf([...FINE, [0, 'EOF']])
    const { esito } = riscriviDxf(rotto, VUOTO)
    expect(esito.avvisi.length).toBe(1)
    expect(esito.avvisi[0]).toContain('malformato')
  })

  it('resta comunque fedele byte per byte anche su un file rotto', () => {
    const rotto = dxf([...SEZ('ENTITIES'), [0, 'MTEXT'], [8, 'TESTI'], [1, 'x']])
      + 'riga orfana\n' + dxf([...FINE, [0, 'EOF']])
    expect(riscriviDxf(rotto, VUOTO).dxf).toBe(rotto)
  })
})

describe('riscrittore DXF · header', () => {
  const header = dxf([
    ...SEZ('HEADER'),
    [9, '$INSUNITS'], [70, '0'],
    [9, '$MEASUREMENT'], [70, '0'],
    [9, '$CLAYER'], [8, 'muri'],
    [9, '$HANDSEED'], [5, '200'],
    ...FINE, [0, 'EOF'],
  ])

  it('dichiara le unità richieste', () => {
    const { dxf: fuori } = riscriviDxf(header, { insunits: 4, measurement: 1 })
    expect(fuori).toContain('$INSUNITS\n70\n4\n')
    expect(fuori).toContain('$MEASUREMENT\n70\n1\n')
  })

  it('segue la rimappatura anche sul layer corrente', () => {
    const { dxf: fuori } = riscriviDxf(header, { rinomina: { muri: 'MURATURA' } })
    expect(fuori).toContain('$CLAYER\n8\nMURATURA\n')
  })

  it('alza $HANDSEED sopra gli handle dei layer che crea', () => {
    const { dxf: fuori } = riscriviDxf(header, { tabella: [V_MURATURA], handseed: 0x300 })
    const m = fuori.match(/\$HANDSEED\n5\n([0-9A-F]+)\n/)
    expect(m).toBeTruthy()
    expect(parseInt(m![1], 16)).toBeGreaterThan(0x300)
  })
})

describe('riscrittore DXF · riscalatura geometrica', () => {
  const X1000 = { scala: { fattore: 1000 } }

  const conEntita = (...coppie: Array<[number | string, string]>): string =>
    dxf([...SEZ('ENTITIES'), ...coppie, ...FINE, [0, 'EOF']])

  const valoreDi = (s: string, codice: number): string | null => {
    const m = s.match(new RegExp(`\\n${codice}\\n([^\\n]*)\\n`))
    return m ? m[1] : null
  }

  it('moltiplica le coordinate', () => {
    const { dxf: f } = riscriviDxf(conEntita(
      [0, 'LINE'], [8, 'MURI'], [10, '1.5'], [20, '2'], [11, '3'], [21, '4'],
    ), X1000)
    expect(valoreDi(f, 10)).toBe('1500.0')
    expect(valoreDi(f, 20)).toBe('2000.0')
  })

  it('scala il raggio di un cerchio ma non gli angoli di un arco', () => {
    const { dxf: f } = riscriviDxf(conEntita(
      [0, 'ARC'], [8, 'M'], [10, '1'], [20, '1'], [40, '0.5'], [50, '30'], [51, '120'],
    ), X1000)
    expect(valoreDi(f, 40)).toBe('500.0')
    expect(valoreDi(f, 50)).toBe('30') // angolo: intatto
    expect(valoreDi(f, 51)).toBe('120')
  })

  it('NON scala il bulge di una polilinea', () => {
    // Il 42 di LWPOLYLINE è la tangente di un quarto dell'angolo: è un rapporto. Scalarlo
    // trasformerebbe ogni raccordo in una curva sbagliata, e non se ne accorgerebbe nessuno
    // finché il file non è già in mano al collaboratore.
    const { dxf: f } = riscriviDxf(conEntita(
      [0, 'LWPOLYLINE'], [8, 'M'], [90, '2'], [10, '0'], [20, '0'], [42, '0.414'], [43, '0.1'],
    ), X1000)
    expect(valoreDi(f, 42)).toBe('0.414') // bulge intatto
    expect(valoreDi(f, 43)).toBe('100.0') // larghezza costante: scalata
  })

  it('NON scala i fattori di scala di un INSERT', () => {
    // Il contenuto del blocco è già stato riscalato nella sezione BLOCKS: moltiplicare anche
    // il fattore raddoppierebbe la scala.
    const { dxf: f } = riscriviDxf(conEntita(
      [0, 'INSERT'], [8, 'M'], [2, 'PORTA'], [10, '2'], [20, '3'], [41, '1'], [42, '1'], [43, '1'], [44, '0.5'],
    ), X1000)
    expect(valoreDi(f, 41)).toBe('1')
    expect(valoreDi(f, 42)).toBe('1')
    expect(valoreDi(f, 10)).toBe('2000.0') // il punto d'inserimento sì
    expect(valoreDi(f, 44)).toBe('500.0') // il passo della matrice è una distanza
  })

  it('NON scala il rapporto fra gli assi di un’ellisse', () => {
    const { dxf: f } = riscriviDxf(conEntita(
      [0, 'ELLIPSE'], [8, 'M'], [10, '1'], [20, '1'], [11, '2'], [21, '0'], [40, '0.5'],
    ), X1000)
    expect(valoreDi(f, 40)).toBe('0.5') // rapporto
    expect(valoreDi(f, 11)).toBe('2000.0') // semiasse maggiore: è un vettore lunghezza
  })

  it('scala l’altezza di un testo ma non il suo rapporto di larghezza', () => {
    const { dxf: f } = riscriviDxf(conEntita(
      [0, 'TEXT'], [8, 'M'], [10, '0'], [20, '0'], [40, '0.25'], [41, '0.8'], [50, '45'], [1, 'ciao'],
    ), X1000)
    expect(valoreDi(f, 40)).toBe('250.0')
    expect(valoreDi(f, 41)).toBe('0.8')
    expect(valoreDi(f, 50)).toBe('45')
  })

  it('lascia in pace lo spazio carta', () => {
    // Il foglio è un A1 e resta un A1: riscalarlo col modello spedirebbe il cartiglio a
    // chilometri di distanza.
    const carta = conEntita([0, 'LINE'], [8, 'M'], [67, '1'], [10, '10'], [20, '10'])
    expect(riscriviDxf(carta, X1000).dxf).toBe(carta)
  })

  it('non tocca le entità che non sa riscalare, e lo dice', () => {
    const { dxf: f, esito } = riscriviDxf(conEntita(
      [0, 'ACAD_TABLE'], [8, 'M'], [10, '5'], [20, '5'],
    ), X1000)
    expect(valoreDi(f, 10)).toBe('5')
    expect(esito.avvisi.some(a => a.includes('ACAD_TABLE'))).toBe(true)
  })

  it('aggiorna l’ingombro nell’header, altrimenti «zoom estensione» inquadra il vuoto', () => {
    const h = dxf([
      ...SEZ('HEADER'), [9, '$EXTMIN'], [10, '0'], [20, '0'], [9, '$EXTMAX'], [10, '20'], [20, '10'],
      [9, '$DIMSCALE'], [40, '1'], ...FINE, [0, 'EOF'],
    ])
    const { dxf: f } = riscriviDxf(h, X1000)
    expect(f).toContain('$EXTMAX\n10\n20000.0\n20\n10000.0\n')
    expect(f).toContain('$DIMSCALE\n40\n1000.0\n')
  })

  it('a fattore 1 non tocca un solo byte', () => {
    const f = conEntita([0, 'LINE'], [8, 'M'], [10, '1.5'], [20, '2'])
    expect(riscriviDxf(f, { scala: { fattore: 1 } }).dxf).toBe(f)
  })
})

/** Un blocco minimo: BLOCK, il corpo passato, ENDBLK — tutti sul layer 0 come nella realtà. */
const blocco = (...corpo: Array<[number | string, string]>): Array<[number | string, string]> => [
  ...SEZ('BLOCKS'),
  [0, 'BLOCK'], [5, 'D1'], [8, '0'], [2, 'PORTA'], [10, '0'], [20, '0'],
  ...corpo,
  [0, 'ENDBLK'], [5, 'D2'], [8, '0'],
  ...FINE,
]

describe('riscrittore DXF · il layer 0 è intoccabile DENTRO un blocco', () => {
  it('non lo rinomina nemmeno se glielo si chiede', () => {
    // È il layer su cui vivono i blocchi: le entità che ci stanno sopra dentro una definizione
    // ereditano il layer dell'INSERT che le richiama (ByBlock), e su una tavola vera i
    // riferimenti a blocchi sul layer 0 sono centinaia. Spostarle romperebbe quell'eredità.
    const f = dxf([...tabellaLayer('0', 'muri'), ...blocco(...linea('0')), [0, 'EOF']])
    const { dxf: fuori, esito } = riscriviDxf(f, {
      rinomina: { '0': 'MURATURA' }, spenti: ['0'], tabella: [V_MURATURA], forzaByLayer: true,
    })
    expect(fuori).toContain('\n8\n0\n')       // le entità sono rimaste sul layer 0
    expect(fuori).not.toContain('\n8\nMURATURA\n')
    expect(esito.entitaRiscritte).toBe(0)
    // ...e il record di tabella del layer 0 non è stato spento — ma il colore sì, a grigio (ACI 8)
    const rec = fuori.slice(fuori.indexOf('\n2\n0\n'))
    expect(rec).toMatch(/\n62\n8\n/)
  })

  it('riporta a ByLayer le entità sul layer 0 quando si forza ByLayer, senza spostarle', () => {
    const f = dxf([...tabellaLayer('0'), ...blocco([0, 'LINE'], [5, 'A1'], [8, '0'], [62, '1'], [10, '0'], [20, '0']), [0, 'EOF']])
    const { dxf: senzaForzatura } = riscriviDxf(f, {})
    expect(senzaForzatura).toContain('\n62\n1\n') // di default il colore esplicito resta

    const { dxf: conForzatura } = riscriviDxf(f, { forzaByLayer: true })
    const blocchi = conForzatura.slice(conForzatura.indexOf('\nBLOCKS\n'))
    expect(blocchi).not.toContain('\n62\n1\n')     // il colore esplicito sparisce sull'entità...
    expect(blocchi).toContain('\n8\n0\n')          // ...ma il layer 0 resta quello
  })

  it('vale anche per Defpoints', () => {
    const f = dxf([...SEZ('ENTITIES'), ...linea('Defpoints'), ...FINE, [0, 'EOF']])
    expect(riscriviDxf(f, { rinomina: { Defpoints: 'MURATURA' } }).dxf).toBe(f)
  })

  it('la guardia sta nel motore: la si chieda pure, non succede', () => {
    // Una regola di sicurezza che vive solo nell'interfaccia è una regola che prima o poi
    // qualcuno aggira — un profilo importato, un .ehub vecchio, una riga di codice nuova.
    const f = dxf([...blocco(...linea('0')), [0, 'EOF']])
    expect(riscriviDxf(f, { rinomina: { '0': 'QUALSIASI' }, spenti: ['0', '_0', 'DEFPOINTS'] }).dxf).toBe(f)
  })
})

describe('riscrittore DXF · il colore del layer 0', () => {
  it('a piano vuoto NON lo tocca: resta valido il cardine del modulo', () => {
    const f = dxf([...tabellaLayer('0'), ...SEZ('ENTITIES'), ...linea('0'), ...FINE, [0, 'EOF']])
    expect(riscriviDxf(f, VUOTO).dxf).toBe(f)
  })

  it('lo riporta a 8 anche quando il collaboratore lo aveva colorato', () => {
    const f = dxf([
      ...tabellaLayer('0'), // colore di partenza: 7 (bianco/nero), per default di `recordLayer`
      ...SEZ('ENTITIES'), ...linea('0'), ...FINE, [0, 'EOF'],
    ])
    const { dxf: fuori } = riscriviDxf(f, { forzaByLayer: true })
    const rec = fuori.slice(fuori.indexOf('\n2\n0\n'))
    expect(rec).toMatch(/\n62\n8\n/)
  })
})

describe('riscrittore DXF · le sentinelle non entrano nel file', () => {
  it('rifiuta un nome di destinazione impossibile per AutoCAD', () => {
    // Le costanti dell'interfaccia usano l'asterisco perché AutoCAD lo vieta nei nomi di layer.
    // Questo le rende innocue solo finché non entrano nel file: qui c'è l'ultimo cancello, ed
    // è l'unico punto che nessuna strada può aggirare.
    const f = dxf([
      ...SEZ('HEADER'), [9, '$CLAYER'], [8, 'MURI'], ...FINE,
      ...SEZ('ENTITIES'), ...linea('MURI'), ...FINE, [0, 'EOF'],
    ])
    const { dxf: fuori } = riscriviDxf(f, { rinomina: { MURI: '*MANTIENI*' } })
    expect(fuori).toBe(f)
    expect(fuori).not.toContain('MANTIENI')
  })
})

describe('riscrittore DXF · file ANSI/cp1252', () => {
  // Il giro completo di χ su un DXF ANSI: byte cp1252 → decodifica → riscrittura →
  // ri-codifica cp1252. La simmetria decode/encode estende l'identità byte-per-byte
  // anche ai file con accentate (il caso italiano tipico).
  const conAccenti = dxf([
    ...SEZ('HEADER'), [9, '$DWGCODEPAGE'], [3, 'ANSI_1252'], ...FINE,
    ...tabellaLayer('0', 'PARETE È'),
    ...SEZ('ENTITIES'), ...linea('PARETE È'), ...testo('PARETE È', 'quota à 90° §'), ...FINE,
    [0, 'EOF'],
  ])

  it('piano vuoto ⇒ byte identici anche passando dai byte ANSI', () => {
    const dentro = new CodificatoreCp1252().codifica(conAccenti)
    const testo1252 = new TextDecoder('windows-1252').decode(dentro)
    const { dxf: fuori } = riscriviDxf(testo1252, VUOTO)
    expect(Array.from(new CodificatoreCp1252().codifica(fuori))).toEqual(Array.from(dentro))
  })

  it('la rinomina non tocca le accentate dei testi', () => {
    const dentro = new CodificatoreCp1252().codifica(conAccenti)
    const testo1252 = new TextDecoder('windows-1252').decode(dentro)
    const { dxf: fuori } = riscriviDxf(testo1252, { rinomina: { 'PARETE È': 'MURATURA' }, tabella: [V_MURATURA] })
    expect(fuori).toContain('quota à 90° §')
    expect(fuori).not.toContain('�')
    expect(fuori).toMatch(/\n8\nMURATURA\n/)
  })
})
