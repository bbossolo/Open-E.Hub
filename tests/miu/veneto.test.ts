import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseVeneto } from '../../src/tools/miu/engine/parsers/veneto'

const xml = readFileSync(resolve(__dirname, 'fixtures/veneto-sample.xml'), 'utf-8')

describe('parseVeneto — famiglia Veneto (golden su dati reali)', () => {
  const res = parseVeneto(xml)

  it('rileva regione (prefisso VEN) e anno (cod radice)', () => {
    expect(res.regione).toBe('Veneto')
    expect(res.anno).toBe('2025')
  })

  it('una voce per <prezzo> con prezzo>0, scarta le varianti a prezzo 0', () => {
    expect(res.rows.map(r => r.codice)).toEqual([
      'VEN25-01.02.01.00',
      'VEN25-01.02.02.00',
    ])
  })

  it('estrae sintetica, estesa, manodopera, um, gerarchia', () => {
    const r = res.rows[0]
    expect(r.prezzo).toBeCloseTo(3.4, 6)
    expect(r.um).toBe('m²')
    expect(r.ru).toBeCloseTo(34.97, 4)              // manodopera %
    expect(r.declaratoria.startsWith('Scavo di pulizia generale')).toBe(true)  // estesa
    expect(r.desc_short).toContain('SCAVO DI PULIZIA GENERALE')                 // sintetica
    expect(r.disciplina).toBe('OPERE EDILI')         // settore
    expect(r.settore).toBe('SCAVI')                  // capitolo
  })

  it('la sintetica preferisce il testo specifico della variante', () => {
    const r = res.rows[1]
    expect(r.desc_short).toBe('SCAVO A SEZIONE APERTA - terreno naturale')
    expect(r.declaratoria.startsWith('Scavo a sezione aperta')).toBe(true)
    expect(r.ru).toBeCloseTo(37.21, 4)
  })
})
