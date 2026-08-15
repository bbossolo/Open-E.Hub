import { describe, it, expect } from 'vitest'
import { analizzaDxf, appiattisci, deduciScala } from '../../src/shared/dxf-import/analizza'
import { chiaveLayer, fascia, suggerisci, suggerisciTutti } from '../../src/shared/xref/suggerisci'
import { LAYER_STANDARD, MANTIENI, NOMI_STANDARD, SPEGNI } from '../../src/shared/xref/standard'
import type { LayerTrovato } from '../../src/shared/dxf-import/analizza'

/**
 * Il riconoscimento dei layer di χ Refs.
 *
 * I nomi provati qui NON sono inventati: sono estratti da tavole vere di studi diversi, con
 * convenzioni di nomenclatura diverse (es. lo standard nudo vs il prefisso `IE-*`). È l'unico
 * modo di sapere se il riconoscimento funziona: un campionario di casi di scuola direbbe solo
 * che le regex compilano.
 */

const layer = (nome: string, nEntita = 100, nTesti = 0): LayerTrovato => ({
  nome, ...appiattisci(nome),
  colore: 7, spento: false, congelato: false, bloccato: false,
  linetype: 'Continuous', lineweight: -3,
  nEntita, nTesti, nInsert: 0, vuoto: nEntita === 0,
})

describe('χ Refs · riconoscimento dei layer architettonici', () => {
  const casi: Array<[string, string]> = [
    // convenzione dello standard già a posto e le sue grafie storiche
    ['MURATURA', 'MURATURA'],
    ['TAV-A-XREF|MURATURA', 'MURATURA'],
    ['MURATURE', 'MURATURA'],
    ['V_TRAVI', 'TRAVI'],
    ['MURATURE-V', 'MURATURA'],
    // il collaboratore che usa i nomi nudi (TAV-B, tavole fornitore)
    ['TAV-B-XREF|muri', 'MURATURA'],
    ['MURI', 'MURATURA'],
    ['muretto', 'MURATURA'],
    ['pilastro', 'MURATURA'],
    ['porte', 'MURATURA'],
    ['finestre', 'MURATURA'],
    ['Serramenti', 'MURATURA'],
    ['ARREDO', 'ARREDI'],
    ['Arredi', 'ARREDI'],
    ['SANITARI', 'SANITARI'],
    ['QUOTE', 'QUOTE'],
    ['SCRITTE', 'TESTI'],
    ['TESTI LOCALI', 'TESTI'],
    // il collaboratore numerato (TAV-A)
    ['TAV-A-XREF|01_MURI', 'MURATURA'],
    ['TAV-A-XREF|04_ARREDI', 'ARREDI'],
    ['TAV-A-XREF|03_RETINI', 'RETINI accesi'],
    // un altro studio, convenzione IE-*
    ['IE-MURATURA', 'MURATURA'],
    ['IE-ARREDI', 'ARREDI'],
    ['MURI CANTINA', 'MURATURA'],
    ['CAPPOTTO', 'MURATURA'],
    ['RIVESTIMENTO LEGNO', 'MURATURA'],
    ['DIM_APERTURE', 'QUOTE'],
    ['VERDE_siepe', 'ESTERNI'],
    ['TOMBINI', 'ESTERNI'],
    // ArchiCAD/IFC (TAV-C)
    ['Strutturale - Portante', 'MURATURA'],
    ['Quotatura - Generale', 'QUOTE'],
    ['Sito e Paesaggio - Terreno', 'ESTERNI'],
    // in inglese, che prima o poi arriva
    ['A-WALL', 'MURATURA'],
    ['A-FURN', 'ARREDI'],
    // il collaboratore industriale/prefabbricato: vocabolario che prima cadeva tutto nel
    // mucchio dei non riconosciuti
    ['PANNELLO', 'MURATURA'],
    ['Pannelli prefabbricati', 'MURATURA'],
    ['CONTROVENTI', 'MURATURA'],
    ['S-COLS', 'MURATURA'],
    ['GSE_Maglia strutturale', 'MURATURA'],
    ['PIATTI CV A TERRA', 'MURATURA'],
    ['ANGOLARI CV A TERRA', 'MURATURA'],
    ['Baie di Carico', 'MURATURA'],
    ['APERTURE', 'MURATURA'],
    ['Scaffalature', 'ARREDI'],
  ]

  for (const [nome, atteso] of casi) {
    it(`«${nome}» → ${atteso}`, () => {
      expect(suggerisci(layer(nome)).destinazione).toBe(atteso)
    })
  }
})

describe('χ Refs · cosa si spegne', () => {
  const daSpegnere = [
    'cartiglio', 'CARTIGLIO', 'TABELL', 'Squadrature',
    'PDF3_Geometria', 'PDF1_Riempimenti solidi', 'MPD_01', '00_COMPONENTS',
    'Schema Apparecchiature', 'Not Exported', 'Layer1',
  ]
  for (const nome of daSpegnere) {
    it(`«${nome}» si spegne: non è disegno`, () => {
      const s = suggerisci(layer(nome))
      expect(s.destinazione).toBe(SPEGNI)
      expect(fascia(s.confidenza)).not.toBe('bassa')
    })
  }

  it('spegne l’impianto del collaboratore: a noi serve la base', () => {
    for (const nome of ['IE-ILLUMINAZIONE', 'ELE-FM_NORMALE', 'TES_FD_REF_UNI9795', 'DLX_BLD0_LUM']) {
      expect(suggerisci(layer(nome)).destinazione).toBe(SPEGNI)
    }
  })
})

describe('χ Refs · il layer 0 non si tocca', () => {
  it('si importa esattamente com’è', () => {
    // Non è prudenza, è come funziona il CAD: il layer 0 è quello su cui vivono i blocchi. Le
    // entità disegnate lì dentro una definizione ereditano il layer dell'INSERT che le richiama,
    // e i riferimenti a blocchi ci stanno sopra a migliaia — su una tavola reale sono 232. Rinominarlo o
    // spegnerlo fa sparire i simboli del disegno.
    const s = suggerisci(layer('0', 3896, 2415))
    expect(s.destinazione).toBe(MANTIENI)
    expect(s.regola).toBe('layer-zero')
  })

  it('non finisce nell’elenco da smistare', () => {
    const righe = suggerisciTutti([layer('0', 3896), layer('MURI')])
    expect(righe.find(r => r.layer.nome === '0')!.destinazione).toBe(MANTIENI)
  })
})

describe('χ Refs · quello che il tool NON deve decidere da solo', () => {

  it('non pre-applica le proposte deboli', () => {
    const righe = suggerisciTutti([layer('L SOTTILI'), layer('MURI')])
    expect(righe[0].destinazione).toBe('') // da decidere
    expect(righe[1].destinazione).toBe('MURATURA')
  })

  it('non chiede una decisione sui layer che nessuna entità usa', () => {
    // Su una tavola reale sono 97 su 150: affollerebbero l'elenco senza che ci sia niente da spostare.
    const righe = suggerisciTutti([layer('roba-vecchia', 0)])
    expect(righe[0].suggerimento.regola).toBe('vuoto')
  })
})

describe('χ Refs · una decisione vale per tutte le varianti dello stesso layer', () => {
  it('la chiave ignora prefisso xref, numerazione, separatori e maiuscole', () => {
    const k = chiaveLayer('MURI')
    expect(chiaveLayer('TAV-A-XREF|01_MURI')).toBe(k)
    expect(chiaveLayer('TAV-B-XREF|muri')).toBe(k)
    expect(chiaveLayer('Muri')).toBe(k)
  })

  it('il profilo del collaboratore batte ogni regola', () => {
    const s = suggerisci(layer('TAV-B-XREF|muri'), { profilo: { MURI: 'ESTERNI' } })
    expect(s.destinazione).toBe('ESTERNI')
    expect(s.confidenza).toBe(1)
  })

  it('spezza il prefisso sull’ultimo pipe, per reggere gli xref annidati', () => {
    expect(appiattisci('A|B|MURI')).toEqual({ prefissoXref: 'A|B', base: 'MURI' })
    expect(appiattisci('MURI')).toEqual({ prefissoXref: null, base: 'MURI' })
  })
})

describe('χ Refs · lo standard dei layer', () => {
  it('ogni voce ha un colore, e i nomi non si ripetono', () => {
    expect(new Set(NOMI_STANDARD).size).toBe(LAYER_STANDARD.length)
    for (const v of LAYER_STANDARD) expect(v.aci).toBeGreaterThan(0) // lo spegnimento sta in `spento`
  })

  it('ogni destinazione suggerita esiste davvero nello standard', () => {
    // Una regola che punta a un layer inesistente creerebbe un layer fantasma nel DXF.
    const nomi = ['MURI', 'ARREDO', 'SANITARI', 'QUOTE', 'TESTI', 'RETINI', 'TRAVI',
      'SEZIONE', 'CONDIZIONAMENTO', 'SIMBOLI', 'ESTERNI', 'porte', 'scale', 'copertura']
    for (const n of nomi) {
      const d = suggerisci(layer(n)).destinazione
      if (d !== SPEGNI) expect(NOMI_STANDARD).toContain(d)
    }
  })
})

describe('χ Refs · la scala non si crede sulla parola', () => {
  const conEstensione = (insunits: string, min: string, max: string): string =>
    [[0, 'SECTION'], [2, 'HEADER'],
      [9, '$INSUNITS'], [70, insunits],
      [9, '$EXTMIN'], [10, min], [20, min],
      [9, '$EXTMAX'], [10, max], [20, max],
      [0, 'ENDSEC'], [0, 'EOF']].map(([c, v]) => `${c}\n${v}`).join('\n') + '\n'

  it('si fida delle unità dichiarate quando i conti tornano', () => {
    const s = deduciScala(analizzaDxf(conEstensione('4', '0', '20000'))) // 20 m in mm
    expect(s.dichiaratoAttendibile).toBe(true)
    expect(s.unitaPerMetro).toBe(1000)
  })

  it('smentisce le unità dichiarate quando renderebbero l’edificio assurdo', () => {
    // Il caso vero: un file che dichiara millimetri ma è disegnato in metri. Fidarsi
    // sbaglierebbe tutte le lunghezze di 1000×.
    const s = deduciScala(analizzaDxf(conEstensione('4', '0', '20'))) // 20 unità: 2 cm in mm?
    expect(s.dichiaratoAttendibile).toBe(false)
    expect(s.unitaPerMetro).toBe(1) // sono metri
    expect(s.nota).toContain('metri')
  })

  it('non deduce niente da un ingombro sporco', () => {
    // Caso vero: l'ingombro dichiarato va da -270 a 180 in X ma arriva a -26288 in Y —
    // una manciata di entità perse a chilometri dal disegno. La diagonale che ne esce è
    // inventata, e credendoci si concludeva «millimetri, torna» su un file disegnato in metri.
    const sporco = [[0, 'SECTION'], [2, 'HEADER'],
      [9, '$INSUNITS'], [70, '4'],
      [9, '$EXTMIN'], [10, '-270.58'], [20, '-26288.43'],
      [9, '$EXTMAX'], [10, '179.94'], [20, '115.65'],
      [0, 'ENDSEC'], [0, 'EOF']].map(([c, v]) => `${c}\n${v}`).join('\n') + '\n'
    const s = deduciScala(analizzaDxf(sporco))
    expect(s.unitaPerMetro).toBeNull()
    expect(s.nota).toContain('sporco')
    expect(s.nota).toContain('Calibra')
  })

  it('ammette di non sapere invece di tirare a indovinare', () => {
    const s = deduciScala(analizzaDxf(conEstensione('4', '0', '0.0001')))
    expect(s.unitaPerMetro).toBeNull()
    expect(s.nota).toContain('calibra')
  })
})
