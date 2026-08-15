import { describe, it, expect } from 'vitest'
import { dxfToScene, leggiDxf, LettoreDxf, scenaDaLettura, DXF_LAYER_PESANTE } from '../../src/shared/dxf-import'

/**
 * Il lettore DXF condiviso: passaggio singolo, layer preservati, Y ribaltata.
 *
 * Le fixture sono minuscole e scritte a mano (il DXF è un formato a coppie
 * codice/valore, riga per riga) così ogni assertion è verificabile a occhio. I casi
 * riprodotti sono quelli VERI trovati nelle tavole dello studio, non casi di scuola:
 * l'abaco incollato sul layer `0`, i simboli come INSERT sui layer `ELE-*`, le entità
 * su layer `0` dentro un blocco che ereditano il layer dell'INSERT.
 */

/** Costruisce un DXF da coppie [codice, valore]. */
function dxf(...coppie: Array<[number | string, string]>): string {
  return coppie.map(([c, v]) => `${c}\n${v}`).join('\n') + '\n'
}

const HEADER = (insunits = '6'): Array<[number | string, string]> => [
  [0, 'SECTION'], [2, 'HEADER'],
  [9, '$INSUNITS'], [70, insunits],
  [0, 'ENDSEC'],
]

const linea = (layer: string, x1: number, y1: number, x2: number, y2: number): Array<[number | string, string]> => [
  [0, 'LINE'], [8, layer], [10, String(x1)], [20, String(y1)], [11, String(x2)], [21, String(y2)],
]

describe('lettore DXF condiviso · geometria divisa per layer', () => {
  it('tiene la geometria separata per layer, invece di collassarla in un path unico', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      ...linea('MURI', 0, 0, 10, 0),
      ...linea('MURI', 10, 0, 10, 10),
      ...linea('ELE-FM_NORMALE', 2, 2, 3, 3),
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    const nomi = s.layers.map((l) => l.layer).sort()
    expect(nomi).toEqual(['ELE-FM_NORMALE', 'MURI'])

    const muri = s.layers.find((l) => l.layer === 'MURI')!
    expect(muri.segmenti).toBe(2)
    expect(muri.d).toContain('M0.00,0.00')

    const ele = s.layers.find((l) => l.layer === 'ELE-FM_NORMALE')!
    expect(ele.segmenti).toBe(1)
    // la geometria di un layer NON deve finire nel path di un altro
    expect(ele.d).not.toContain('10.00')
  })

  it('ribalta la Y (mondo con la Y in giù, come lo sfondo e i marker)', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      ...linea('M', 0, 5, 0, 20),
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(s.layers[0].d).toBe('M0.00,-5.00 L0.00,-20.00')
    expect(s.bbox.minY).toBe(-20)
    expect(s.bbox.maxY).toBe(-5)
  })

  it('legge $INSUNITS per la scala (6 = metri, 4 = millimetri)', () => {
    const corpo: Array<[number | string, string]> = [
      [0, 'SECTION'], [2, 'ENTITIES'], ...linea('M', 0, 0, 1, 1), [0, 'ENDSEC'], [0, 'EOF'],
    ]
    expect(dxfToScene(dxf(...HEADER('6'), ...corpo)).unitsPerMeter).toBe(1)
    expect(dxfToScene(dxf(...HEADER('4'), ...corpo)).unitsPerMeter).toBe(1000)
  })
})

describe('lettore DXF condiviso · INSERT (i blocchi posati sul disegno)', () => {
  const conInsert = dxf(
    ...HEADER(),
    [0, 'SECTION'], [2, 'BLOCKS'],
    [0, 'BLOCK'], [2, 'PR_PRESA'], [10, '0'], [20, '0'],
    ...linea('0', -1, -1, 1, 1), // geometria del simbolo, su layer 0 DENTRO il blocco
    [0, 'ENDBLK'],
    [0, 'ENDSEC'],
    [0, 'SECTION'], [2, 'ENTITIES'],
    [0, 'INSERT'], [2, 'PR_PRESA'], [8, 'ELE-FM_NORMALE'], [10, '100'], [20, '50'], [66, '1'],
    [0, 'ATTRIB'], [2, 'DESCRIZIONE'], [1, 'Presa 2P+T 16A'],
    [0, 'ATTRIB'], [2, 'PORTATA'], [1, '16A'],
    [0, 'SEQEND'],
    [0, 'INSERT'], [2, 'PR_PRESA'], [8, '0'], [10, '900'], [20, '900'], // l'ABACO, sul layer 0
    [0, 'ENDSEC'], [0, 'EOF'],
  )

  it('raccoglie gli INSERT col loro layer e i loro attributi', () => {
    const s = dxfToScene(conInsert)
    expect(s.inserts).toHaveLength(2)
    const posato = s.inserts[0]
    expect(posato.name).toBe('PR_PRESA')
    expect(posato.layer).toBe('ELE-FM_NORMALE')
    expect(posato.attrs).toEqual({ DESCRIZIONE: 'Presa 2P+T 16A', PORTATA: '16A' })
  })

  it('gli INSERT escono nello STESSO spazio della geometria (Y ribaltata)', () => {
    // È il bug che rendeva invisibili i blocchi riconosciuti: coordinate DXF grezze (Y su)
    // contro uno sfondo con la Y in giù → marker specchiati fuori dal viewBox.
    const s = dxfToScene(conInsert)
    expect(s.inserts[0].x).toBe(100)
    expect(s.inserts[0].y).toBe(-50)
  })

  it('distingue le utenze vere dall\'abaco, che nelle tavole vere sta sul layer 0', () => {
    const s = dxfToScene(conInsert)
    const perLayer = new Map(s.layers.map((l) => [l.layer, l.inserts]))
    expect(perLayer.get('ELE-FM_NORMALE')).toBe(1)
    expect(perLayer.get('0')).toBe(1)
    // conteggio del computo = solo i layer d'impianto, MAI il layer 0
    const daComputare = s.inserts.filter((i) => i.layer !== '0')
    expect(daComputare).toHaveLength(1)
  })

  it('la geometria del simbolo eredita il layer dell\'INSERT (convenzione DXF: layer 0 nel blocco)', () => {
    const s = dxfToScene(conInsert)
    const ele = s.layers.find((l) => l.layer === 'ELE-FM_NORMALE')
    expect(ele).toBeTruthy()
    expect(ele!.segmenti).toBe(1) // la linea del blocco, disegnata alla posizione dell'INSERT
    expect(ele!.d).toContain('99.00,-49.00') // (-1,-1) traslato di (100,50), Y ribaltata
  })

  it('applica scala e rotazione dell\'INSERT alla geometria del blocco', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'BLOCKS'],
      [0, 'BLOCK'], [2, 'B'], [10, '0'], [20, '0'],
      ...linea('0', 0, 0, 2, 0),
      [0, 'ENDBLK'], [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'INSERT'], [2, 'B'], [8, 'L'], [10, '0'], [20, '0'], [41, '3'], [42, '3'], [50, '90'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    // (2,0) scalato ×3 = (6,0), ruotato di 90° = (0,6), Y ribaltata = (0,-6)
    expect(s.layers[0].d).toContain('0.00,-6.00')
  })
})

describe('lettore DXF condiviso · testi', () => {
  it('i testi portano il loro layer e la loro altezza VERA (niente minimo forzato)', () => {
    // Nelle tavole dello studio l'altezza mediana dei testi è 0.2 unità: il vecchio
    // `Math.max(1.5, h)` li disegnava 7,5 volte più grandi del vero.
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'TEXT'], [8, 'ELE-FM_NORMALE_TESTO'], [10, '10'], [20, '20'], [40, '0.2'], [1, 'P1'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(s.texts).toHaveLength(1)
    expect(s.texts[0]).toMatchObject({ x: 10, y: -20, s: 'P1', h: 0.2, layer: 'ELE-FM_NORMALE_TESTO' })
  })

  it('ripulisce i codici di formattazione MTEXT', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'MTEXT'], [8, 'T'], [10, '0'], [20, '0'], [40, '1'], [1, '\\fArial|b0;{QE\\P1}'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(s.texts[0].s).toBe('QE 1')
  })
})

describe('lettore DXF condiviso · robustezza sui file grandi', () => {
  it('legge a pezzi: un chunk può spezzare una riga a metà senza corrompere nulla', () => {
    const testo = dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      ...linea('MURI', 0, 0, 123.456, 789.01),
      [0, 'ENDSEC'], [0, 'EOF'],
    )
    // un byte alla volta: il caso peggiore possibile per il ricucire delle righe
    const lettore = new LettoreDxf()
    for (const ch of testo) lettore.push(ch)
    const a = scenaDaLettura(lettore.chiudi())
    const b = dxfToScene(testo)
    expect(a.layers).toEqual(b.layers)
    expect(a.bbox).toEqual(b.bbox)
  })

  it('il tetto ai segmenti si DICHIARA (stats.troncato), non tronca in silenzio', () => {
    const linee: Array<[number | string, string]> = []
    for (let i = 0; i < 50; i++) linee.push(...linea('M', i, 0, i, 1))
    const s = dxfToScene(
      dxf(...HEADER(), [0, 'SECTION'], [2, 'ENTITIES'], ...linee, [0, 'ENDSEC'], [0, 'EOF']),
      { maxSegmenti: 10 },
    )
    expect(s.stats.troncato).toBe(true)
    expect(s.stats.segmenti).toBeLessThanOrEqual(10)

    const intero = dxfToScene(
      dxf(...HEADER(), [0, 'SECTION'], [2, 'ENTITIES'], ...linee, [0, 'ENDSEC'], [0, 'EOF']),
    )
    expect(intero.stats.troncato).toBe(false)
    expect(intero.stats.segmenti).toBe(50)
  })

  it('non si perde negli INSERT ricorsivi (blocco che contiene se stesso)', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'BLOCKS'],
      [0, 'BLOCK'], [2, 'LOOP'], [10, '0'], [20, '0'],
      ...linea('0', 0, 0, 1, 1),
      [0, 'INSERT'], [2, 'LOOP'], [10, '1'], [20, '1'],
      [0, 'ENDBLK'], [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'INSERT'], [2, 'LOOP'], [8, 'X'], [10, '0'], [20, '0'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ), { maxDepth: 3 })
    expect(s.stats.segmenti).toBeLessThanOrEqual(5) // fermato dalla profondità massima
  })

  it('salta le entità che non sappiamo disegnare senza inciampare', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'HATCH'], [8, 'RETINO'], [10, '0'], [20, '0'],
      [0, 'ACAD_PROXY_ENTITY'], [8, 'X'],
      ...linea('MURI', 0, 0, 1, 1),
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(s.layers.map((l) => l.layer)).toEqual(['MURI'])
    expect(s.stats.entita).toBe(1)
  })

  it('la soglia di layer pesante è tarata sul vero (i layer elettrici stanno abbondantemente sotto)', () => {
    // Su una tavola reale: strutturale 909.464 segmenti, tabelle quadri 848.454 — mentre OGNI
    // layer elettrico sta sotto i 45.000. La soglia deve stare in mezzo, non a caso.
    expect(DXF_LAYER_PESANTE).toBeGreaterThan(45_000)
    expect(DXF_LAYER_PESANTE).toBeLessThan(800_000)
  })
})

describe('lettore DXF condiviso · un solo passaggio', () => {
  it('leggiDxf restituisce blocchi + entità + unità in una volta sola', () => {
    const l = leggiDxf(dxf(
      ...HEADER('4'),
      [0, 'SECTION'], [2, 'BLOCKS'],
      [0, 'BLOCK'], [2, 'B1'], [10, '0'], [20, '0'], ...linea('0', 0, 0, 1, 0), [0, 'ENDBLK'],
      [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'],
      ...linea('MURI', 0, 0, 1, 1),
      [0, 'INSERT'], [2, 'B1'], [8, 'L'], [10, '5'], [20, '5'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(l.blocchi.size).toBe(1)
    expect(l.blocchi.get('B1')!.ents).toHaveLength(1)
    expect(l.entita).toHaveLength(2)
    expect(l.unitsPerMeter).toBe(1000)
  })
})

describe('scena DXF · inquadrare non è misurare', () => {
  const conLinee = (...coppie: Array<[number, number, number, number]>): string =>
    dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      ...coppie.flatMap(([x1, y1, x2, y2]) => linea('M', x1, y1, x2, y2)),
      [0, 'ENDSEC'], [0, 'EOF'],
    )

  it('su un disegno sano l’ingombro robusto è quello vero', () => {
    // Tagliare sempre sarebbe un danno: le coordinate di un disegno si addensano sui muri e
    // qualunque criterio statistico applicato d'ufficio mangia disegno vero.
    const fitte: Array<[number, number, number, number]> = []
    for (let i = 0; i < 60; i++) fitte.push([i * 10, 0, i * 10, 500])
    const s = dxfToScene(conLinee(...fitte))
    expect(s.bboxCore).toBeTruthy()
    expect(s.bboxCore!.maxX - s.bboxCore!.minX).toBeCloseTo(s.bbox.maxX - s.bbox.minX, 5)
  })

  it('ma ignora l’entità persa a chilometri di distanza', () => {
    // Misurato su una tavola vera: gli estremi dicevano 168 milioni × 511 milioni di unità per
    // un edificio di 150 × 81 metri, e il disegno si riduceva a un puntino.
    const fitte: Array<[number, number, number, number]> = []
    for (let i = 0; i < 60; i++) fitte.push([i * 10, 0, i * 10, 500])
    fitte.push([9000000, 0, 9000001, 1]) // la spazzatura
    const s = dxfToScene(conLinee(...fitte))
    expect(s.bbox.maxX).toBeGreaterThan(8000000)
    expect(s.bboxCore!.maxX).toBeLessThan(10000)
  })
})

describe('lettore DXF condiviso · bulge delle polilinee (fix: il 42 non è la scala Y)', () => {
  it('un segmento con bulge diventa un ARCO, non una corda dritta', () => {
    // LWPOLYLINE da (0,0) a (10,0) con bulge 1 = semicerchio: i punti intermedi
    // esistono e il punto a metà arco dista ~raggio dal centro della corda.
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'LWPOLYLINE'], [8, 'M'], [90, '2'],
      [10, '0'], [20, '0'], [42, '1'],
      [10, '10'], [20, '0'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    const d = s.layers[0].d
    // molto più di 1 segmento: l'arco è tessellato
    expect(s.layers[0].segmenti).toBeGreaterThan(6)
    // il bbox include la freccia dell'arco (~5 unità sopra o sotto la corda)
    const altezza = s.bbox.maxY - s.bbox.minY
    expect(altezza).toBeGreaterThan(4.5)
    expect(altezza).toBeLessThan(5.5)
    expect(d.startsWith('M0.00,0.00')).toBe(true)
  })

  it('senza bulge il comportamento resta identico (corda unica)', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'LWPOLYLINE'], [8, 'M'], [90, '2'],
      [10, '0'], [20, '0'],
      [10, '10'], [20, '0'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(s.layers[0].segmenti).toBe(1)
  })

  it('il 42 su un INSERT resta la scala Y (slot condiviso, non regressione)', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'BLOCKS'],
      [0, 'BLOCK'], [2, 'B'], [10, '0'], [20, '0'],
      ...linea('0', 0, 0, 1, 1),
      [0, 'ENDBLK'], [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'INSERT'], [2, 'B'], [8, 'L'], [10, '0'], [20, '0'], [41, '2'], [42, '3'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(s.inserts[0].sx).toBe(2)
    expect(s.inserts[0].sy).toBe(3)
    // la geometria del blocco è scalata ×3 in Y
    expect(Math.abs(s.bbox.minY)).toBeCloseTo(3, 5)
  })
})

describe('lettore DXF condiviso · diagnostica entità saltate', () => {
  it('conta per tipo cosa NON viene disegnato (HATCH, SPLINE…), mai in silenzio', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'HATCH'], [8, 'RIEMPIMENTI'],
      [0, 'HATCH'], [8, 'RIEMPIMENTI'],
      [0, 'SPLINE'], [8, 'M'],
      ...linea('M', 0, 0, 1, 1),
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(s.stats.saltatePerTipo).toEqual({ HATCH: 2, SPLINE: 1 })
  })
})

describe('lettore DXF condiviso · tabella LAYER (colori ACI, frozen, off)', () => {
  it('legge colore, congelato e spento dalla sezione TABLES', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'TABLES'],
      [0, 'TABLE'], [2, 'LAYER'],
      [0, 'LAYER'], [2, 'MURI'], [62, '8'], [70, '0'],
      [0, 'LAYER'], [2, 'CONGELATO'], [62, '3'], [70, '1'],
      [0, 'LAYER'], [2, 'SPENTO'], [62, '-5'], [70, '0'],
      [0, 'ENDTAB'], [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'],
      ...linea('MURI', 0, 0, 1, 1),
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(s.layerTable).toEqual({
      MURI: { aci: 8, frozen: false, spento: false },
      CONGELATO: { aci: 3, frozen: true, spento: false },
      SPENTO: { aci: 5, frozen: false, spento: true },
    })
  })
})

describe('lettore DXF condiviso · paperspace (group 67)', () => {
  const conPs = dxf(
    ...HEADER(),
    [0, 'SECTION'], [2, 'ENTITIES'],
    ...linea('M', 0, 0, 10, 0),
    [0, 'LINE'], [8, 'CARTIGLIO'], [67, '1'], [10, '500'], [20, '500'], [11, '600'], [21, '600'],
    [0, 'ENDSEC'], [0, 'EOF'],
  )

  it('di default il comportamento resta quello storico (tutto dentro)', () => {
    const s = dxfToScene(conPs)
    expect(s.layers.map((l) => l.layer).sort()).toEqual(['CARTIGLIO', 'M'])
  })

  it('con escludiPaperspace le entità di layout restano fuori', () => {
    const s = dxfToScene(conPs, { escludiPaperspace: true })
    expect(s.layers.map((l) => l.layer)).toEqual(['M'])
    expect(s.bbox.maxX).toBe(10)
  })
})

describe('lettore DXF condiviso · INSERT annidati (profonditaInserts)', () => {
  const annidato = dxf(
    ...HEADER(),
    [0, 'SECTION'], [2, 'BLOCKS'],
    [0, 'BLOCK'], [2, 'RIVELATORE'], [10, '0'], [20, '0'],
    ...linea('0', -1, -1, 1, 1),
    [0, 'ENDBLK'],
    [0, 'BLOCK'], [2, 'KIT_CAMERA'], [10, '0'], [20, '0'],
    [0, 'INSERT'], [2, 'RIVELATORE'], [8, '0'], [10, '5'], [20, '5'],
    [0, 'ENDBLK'],
    [0, 'ENDSEC'],
    [0, 'SECTION'], [2, 'ENTITIES'],
    [0, 'INSERT'], [2, 'KIT_CAMERA'], [8, 'TES_FD_BLK'], [10, '100'], [20, '100'],
    [0, 'ENDSEC'], [0, 'EOF'],
  )

  it('di default raccoglie solo il primo livello (comportamento storico)', () => {
    const s = dxfToScene(annidato)
    expect(s.inserts).toHaveLength(1)
    expect(s.inserts[0].name).toBe('KIT_CAMERA')
  })

  it('con profonditaInserts>0 i blocchi dentro ai blocchi arrivano in coordinate mondo', () => {
    const s = dxfToScene(annidato, { profonditaInserts: 2 })
    expect(s.inserts).toHaveLength(2)
    const figlio = s.inserts.find((i) => i.annidato)!
    expect(figlio.name).toBe('RIVELATORE')
    expect(figlio.layer).toBe('TES_FD_BLK') // eredita il layer dell'INSERT padre
    expect(figlio.x).toBeCloseTo(105, 5)
    expect(figlio.y).toBeCloseTo(-105, 5) // stessa Y-giù del resto della scena
  })
})

describe('lettore DXF condiviso · OCS/estrusione -Z (blocchi specchiati)', () => {
  it('un INSERT con 230=-1 esce specchiato sull\'asse X', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'BLOCKS'],
      [0, 'BLOCK'], [2, 'B'], [10, '0'], [20, '0'],
      ...linea('0', 0, 0, 2, 0),
      [0, 'ENDBLK'], [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'INSERT'], [2, 'B'], [8, 'L'], [10, '10'], [20, '0'], [230, '-1'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    // il punto di inserimento (10,0) in OCS specchiata → mondo (-10,0); la
    // linea del blocco va da -10 a -12
    expect(s.inserts[0].x).toBe(-10)
    expect(s.bbox.minX).toBeCloseTo(-12, 5)
    expect(s.bbox.maxX).toBeCloseTo(-10, 5)
  })
})

describe('lettore DXF condiviso · polilinee raccolte per i layer-ostacolo', () => {
  it('con raccogliPolilinee la scena espone i punti GIÀ trasformati dei layer che matchano', () => {
    const s = dxfToScene(dxf(
      ...HEADER(),
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'LWPOLYLINE'], [8, 'MURATURE-V'], [90, '3'],
      [10, '0'], [20, '0'], [10, '10'], [20, '0'], [10, '10'], [20, '5'],
      ...linea('ELE-FM', 2, 2, 3, 3),
      [0, 'ENDSEC'], [0, 'EOF'],
    ), { raccogliPolilinee: ['muratur', 'muro'] })
    expect(Object.keys(s.polilinee || {})).toEqual(['MURATURE-V'])
    const poly = s.polilinee!['MURATURE-V'][0]
    expect(poly).toHaveLength(3)
    expect(poly[2]).toEqual({ x: 10, y: -5 }) // Y-giù, come tutto il resto
  })
})

describe('lettore DXF condiviso · escludiLayer (scelta layer PRIMA dell\'import)', () => {
  const due = dxf(
    ...HEADER(),
    [0, 'SECTION'], [2, 'BLOCKS'],
    [0, 'BLOCK'], [2, 'B'], [10, '0'], [20, '0'],
    ...linea('0', 0, 0, 1, 1),
    [0, 'ENDBLK'], [0, 'ENDSEC'],
    [0, 'SECTION'], [2, 'ENTITIES'],
    ...linea('FINESTRE', 0, 0, 10, 0),
    ...linea('ELE-FM', 2, 2, 3, 3),
    [0, 'INSERT'], [2, 'B'], [8, 'FINESTRE'], [10, '5'], [20, '5'],
    [0, 'INSERT'], [2, 'B'], [8, 'ELE-FM'], [10, '7'], [20, '7'],
    [0, 'ENDSEC'], [0, 'EOF'],
  )

  it('il layer escluso non viene COSTRUITO: niente geometria, niente insert', () => {
    const s = dxfToScene(due, { escludiLayer: ['FINESTRE'] })
    expect(s.layers.map((l) => l.layer)).toEqual(['ELE-FM'])
    expect(s.inserts).toHaveLength(1)
    expect(s.inserts[0].layer).toBe('ELE-FM')
    // il bbox non contiene più la geometria esclusa
    expect(s.bbox.maxX).toBeLessThan(9)
  })

  it('senza opzione il comportamento resta quello storico', () => {
    const s = dxfToScene(due)
    expect(s.layers.map((l) => l.layer).sort()).toEqual(['ELE-FM', 'FINESTRE'])
    expect(s.inserts).toHaveLength(2)
  })
})
