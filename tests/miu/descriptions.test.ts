import { describe, it, expect } from 'vitest'
import { isSelfContained, composeDesc } from '../../src/tools/miu/engine/descriptions'

describe('isSelfContained', () => {
  it('vera per descrizioni che iniziano con maiuscola e abbastanza lunghe', () => {
    expect(isSelfContained('Cavo FG16OR16 sezione 3x10 mmq')).toBe(true)
    expect(isSelfContained('Passerella portacavi in acciaio')).toBe(true)
  })
  it('falsa per frammenti', () => {
    expect(isSelfContained('fino a kg. 1.200 (portata kg. 600) a caldo')).toBe(false)
    expect(isSelfContained('di kg. 2.500, con gruetta a freddo')).toBe(false)
    expect(isSelfContained('in opera')).toBe(false) // troppo corta
  })
})

describe('composeDesc', () => {
  it('foglia già completa → invariata (Lombardia/Veneto)', () => {
    const d = 'Cavo FG16OR16 di lega rame ricotto, sezione 3x10'
    expect(composeDesc(['IMPIANTI', 'Cavi'], d)).toBe(d)
  })
  it('Basilicata: antepone il padre pulito al frammento', () => {
    expect(composeDesc(['NOLEGGI', 'Noleggi', 'Veicolo peso totale:'], 'fino a kg. 1.200 (portata kg. 600) a caldo'))
      .toBe('Veicolo peso totale: fino a kg. 1.200 (portata kg. 600) a caldo')
  })
  it('sceglie il livello più profondo pulito', () => {
    expect(composeDesc(['Disciplina', 'Scavo di sbancamento', ''], 'in terreni sciolti'))
      .toBe('Scavo di sbancamento — in terreni sciolti')
  })
  it('scarta i padri rumorosi (multi-campo) e troppo lunghi', () => {
    // settore multi-campo → ignorato, si ripiega sul livello pulito
    expect(composeDesc(['Opere', 'Uso: PER MOVIMENTO TERRA Compreso: accessori'], 'oneri vari'))
      .toBe('Opere — oneri vari')
  })
  it('evita duplicazioni (foglia contiene il padre)', () => {
    expect(composeDesc(['Scavo'], 'Scavo di sbancamento a mano'))
      .toBe('Scavo di sbancamento a mano') // già self-contained
  })
  it('nessun padre pulito → restituisce la foglia', () => {
    expect(composeDesc(['', 'X'], 'in opera generica')).toBe('in opera generica')
  })
  it('il risultato composto è self-contained', () => {
    const r = composeDesc(['Veicolo peso totale:'], 'fino a kg. 1.200 a caldo')
    expect(isSelfContained(r)).toBe(true)
  })
})
