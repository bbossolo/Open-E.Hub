import { describe, it, expect } from 'vitest'
import { isConduit, conduitFamily, CONDUIT_RE, productText, isCableProduct, isHydraulicPipe, scoreConduit } from '../../src/tools/miu/engine/conduits'

describe('isConduit — terminologie regionali', () => {
  const yes = [
    'Tubo protettivo in PVC rigido serie pesante',
    'Tubazione corrugata pieghevole a doppia parete',
    'Tubo corrugato in polietilene PE',
    'Guaina spiralata',
    'Tubo flessibile ICTA',
    'Cavidotto in PVC',
    'Passerella a filo zincata',
    'Canale portacavi in lamiera',
    'Canalina in PVC autoestinguente',
    'Canaletta battiscopa',
    'Cavidotto interrato corrugato doppia parete',
    'Cunicolo in cls per cavi',
    'Scala portacavi',
  ]
  const no = [
    'Cavo FG16OR16 0,6/1kV 5G16',
    'Interruttore magnetotermico 16A',
    'Punto luce con frutto',
    'Quadro elettrico da incasso',
    'Scavo a sezione obbligata',
  ]
  for (const t of yes) it(`SÌ: ${t}`, () => expect(isConduit(t)).toBe(true))
  for (const t of no) it(`NO: ${t}`, () => expect(isConduit(t)).toBe(false))
})

describe('conduitFamily — classificazione', () => {
  it('interrato è il più specifico', () => {
    expect(conduitFamily('Tubo corrugato interrato a doppia parete')).toBe('interrato')
    expect(conduitFamily('Cunicolo per cavi')).toBe('interrato')
  })
  it('canalizzazioni a vista', () => {
    expect(conduitFamily('Passerella a filo')).toBe('canalizzazione')
    expect(conduitFamily('Canale portacavi')).toBe('canalizzazione')
  })
  it('tubo generico', () => {
    expect(conduitFamily('Tubo rigido in PVC')).toBe('tubo')
    expect(conduitFamily('Guaina spiralata')).toBe('tubo')
  })
  it('non-condotto → null', () => {
    expect(conduitFamily('Cavo unipolare N07V-K')).toBeNull()
  })
})

describe('robustezza', () => {
  it('case-insensitive e accenti', () => {
    expect(isConduit('TUBAZIONE CORRUGATA')).toBe(true)
    expect(isConduit('canalizzazióne')).toBe(true)
  })
  it('idempotente su testo già normalizzato', () => {
    expect(isConduit('tubo corrugato doppia parete')).toBe(true)
  })
  it('CONDUIT_RE esiste e matcha', () => {
    expect(CONDUIT_RE.test('passerella')).toBe(true)
  })
})

describe('productText — esclude il boilerplate di posa', () => {
  // Caso reale Basilicata D3.05.016.02: un cavo ottico che cita "passerella"
  // SOLO nella parte di posa → il testo-prodotto NON deve contenerla.
  const declCavo =
    'Cavo ottico per esterno/interno tipo LOOSE UNITUBE, armatura antiroditore. ' +
    'Fornita e posta in opera. Sono comprese l\'installazione in tubazioni, su canale, su passerella o graffettata.'
  it('taglia la declaratoria prima della posa', () => {
    const t = productText('8 Fibre;', declCavo)
    expect(t).toContain('cavo ottico')
    expect(t).not.toContain('passerella')
  })
  it('mantiene la parte descrittiva di una passerella reale', () => {
    const t = productText('mm 65x50', 'Passerella portacavi in acciaio galvanizzato. Fornitura e posa in opera di passerella...')
    expect(t).toContain('passerella')
  })
})

describe('isCableProduct', () => {
  it('riconosce cavi/conduttori/fibra', () => {
    expect(isCableProduct('Cavo ottico LOOSE UNITUBE')).toBe(true)
    expect(isCableProduct('Conduttore unipolare N07V-K')).toBe(true)
    expect(isCableProduct('Cavo FG16OR16')).toBe(true)
  })
  it('non scambia una passerella per un cavo', () => {
    expect(isCableProduct('Passerella portacavi in acciaio')).toBe(false)
  })
})

describe('isHydraulicPipe — esclude tubi non elettrici', () => {
  const yes = [
    'Tubazioni in ghisa per acquedotto',
    'Condotte per impianti irrigui',
    'Tubo PVC per scarico acque',
    'Tubazione di drenaggio',
    'Tubo per gas metano',
  ]
  const no = [
    'Tubo corrugato pieghevole per cavi elettrici',
    'Cavidotto in PVC rigido',
    'Passerella portacavi',
  ]
  for (const t of yes) it(`SÌ idraulico: ${t}`, () => expect(isHydraulicPipe(t)).toBe(true))
  for (const t of no) it(`NO (elettrico): ${t}`, () => expect(isHydraulicPipe(t)).toBe(false))
})

describe('scoreConduit — match distinta vs prezzario', () => {
  const item = { kind: 'tubo', tipo: 'Passerella a filo', size: '150x30', desc: 'Passerella a filo 150x30' }
  const fiberCable = {
    codice: 'D3.05.016.02', desc_short: '8 Fibre;', um: 'm', prezzo: 12,
    declaratoria: 'Cavo ottico LOOSE UNITUBE. Fornita e posta in opera, su canale, su passerella o graffettata.',
  }
  const realTray = {
    codice: 'D3.06.013.01', desc_short: 'mm 150x30', um: 'm', prezzo: 19,
    declaratoria: 'Passerella portacavi in acciaio galvanizzato. Fornitura e posa in opera.',
  }
  it('scarta il cavo ottico (falso positivo da posa)', () => {
    expect(scoreConduit(item, fiberCable)).toBe(0)
  })
  it('premia la passerella reale', () => {
    expect(scoreConduit(item, realTray)).toBeGreaterThan(8)
  })
  it('la passerella reale batte il cavo', () => {
    expect(scoreConduit(item, realTray)).toBeGreaterThan(scoreConduit(item, fiberCable))
  })
  it('match dimensione esatta vale di più', () => {
    const exact = { ...realTray, desc_short: 'mm 150x30' }
    const other = { ...realTray, desc_short: 'mm 65x50' }
    expect(scoreConduit(item, exact)).toBeGreaterThan(scoreConduit(item, other))
  })
})
