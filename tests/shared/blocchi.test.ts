import { describe, it, expect } from 'vitest'
import { capitoloDiLayer } from '../../src/shared/blocchi'

/**
 * Tassonomia layer dello studio: dal nome del layer si deriva il CAPITOLO, con una
 * convenzione dominio-capitolo valida per qualunque tipo di impianto (non solo elettrico).
 */

describe('capitoloDiLayer · genericità multi-impianto', () => {
  it('deriva il capitolo dal segmento dopo il dominio, per i layer studio elettrici', () => {
    expect(capitoloDiLayer('ELE-ILLUMINAZIONE_NORMALE')).toBe('Illuminazione Normale')
    expect(capitoloDiLayer('ELE-IMPIANTO_TERRA')).toBe('Impianto Terra')
    expect(capitoloDiLayer('ELE-FM_NORMALE')).toBe('Forza Motrice Normale')
  })
  it('i layer _TESTO condividono il capitolo del layer principale', () => {
    expect(capitoloDiLayer('ELE-ALLARMI_TESTO')).toBe(capitoloDiLayer('ELE-ALLARMI'))
  })
  it('stessa convenzione, dominio DIVERSO da ELE (impianti futuri: idraulico/meccanico/dati)', () => {
    expect(capitoloDiLayer('IDR-ACS')).toBe('Acs')
    expect(capitoloDiLayer('MEC-VENTILAZIONE_MECCANICA')).toBe('Ventilazione Meccanica')
  })
  it('layer senza convenzione dominio-capitolo: humanizer sul nome intero, mai vuoto', () => {
    expect(capitoloDiLayer('ARREDO')).toBe('Arredo')
    expect(capitoloDiLayer('')).toBe('')
  })
})
