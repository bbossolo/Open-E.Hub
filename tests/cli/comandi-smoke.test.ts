import { describe, it, expect } from 'vitest'
import { runCli } from '../../scripts/cli/ehub'
import { cercaInRighe } from '../../scripts/cli/commands/miu-cerca'
import { elencaSlugs } from '../../scripts/cli/commands/miu-common'
import type { PriceRow } from '../../src/tools/miu/engine/types'

describe('CLI ehub — smoke dei comandi su fixture reali', () => {
  it('miu: cercaInRighe rankizza su righe sintetiche e rispetta il limite', () => {
    const riga = (codice: string, desc: string): PriceRow => ({
      codice, desc_short: desc, declaratoria: desc, prezzo: 1, importo_netto: 0, ru: 0,
      um: 'm', liv1: '', liv2: '', liv3: '', liv4: '', materia: '', disciplina: '', sistema: '',
      attivita: '', settore: '', tipologia: '', keywords: '', regione: '', anno: '',
    } as unknown as PriceRow)
    const rows = [
      riga('A1', 'Tubo corrugato pvc diametro 32 mm'),
      riga('A2', 'Cavo FG16OR16 3G2.5'),
      riga('A3', 'Tubo corrugato pvc diametro 25 mm'),
    ]
    const trovate = cercaInRighe(rows, 'tubo corrugato', 10)
    expect(trovate.length).toBe(2)
    expect(trovate.every((r) => r.desc_short.includes('corrugato'))).toBe(true)
    expect(cercaInRighe(rows, 'tubo corrugato', 1).length).toBe(1)
  })

  // I prezzari reali (prezzari/*.json.gz) sono nel repo ma il test resta
  // difensivo: skip pulito se la cartella fosse vuota (checkout parziale).
  it('miu:elenco legge i metadati dei prezzari reali', async (ctx) => {
    if (!elencaSlugs().length) return ctx.skip()
    const esito = await runCli(['miu:elenco', '--json'])
    const righe = JSON.parse(esito.stdout.join('\n')) as Array<{ slug: string; voci: number }>
    expect(righe.length).toBeGreaterThan(0)
    for (const r of righe) expect(r.voci).toBeGreaterThan(0)
  })
})
