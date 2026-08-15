import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { DOCS, TEST_AREAS } from '../../scripts/docs-manifest'
import { ROOT, allDocs } from './_links'

/**
 * L'indice della documentazione e la cartella `Docs/` devono coincidere: nessun
 * documento fuori indice, nessuna voce d'indice senza documento.
 *
 * È la guardia che impedisce il modo più banale in cui la documentazione va alla
 * deriva: si aggiunge un file e ci si dimentica di annunciarlo, così resta
 * invisibile a chi arriva dopo. Fonte dell'indice: scripts/docs-manifest.ts.
 */
describe('indice documentazione ↔ filesystem', () => {
  const manifest = DOCS.map((d) => `Docs/${d.file}`).sort()
  const onDisk = allDocs().filter((f) => f.startsWith('Docs/') && !f.startsWith('Docs/mockups/')).sort()

  it('ogni documento è registrato in scripts/docs-manifest.ts', () => {
    const orfani = onDisk.filter((f) => !manifest.includes(f))
    expect(orfani, `doc non indicizzati (aggiungili a scripts/docs-manifest.ts): ${orfani.join(', ')}`).toEqual([])
  })

  it('ogni voce dell\'indice esiste su disco', () => {
    const fantasmi = manifest.filter((f) => !existsSync(resolve(ROOT, f)))
    expect(fantasmi, `voci d'indice senza file: ${fantasmi.join(', ')}`).toEqual([])
  })

  it('ogni area di test è descritta (alimenta il blocco AUTO:tests:areas)', () => {
    const aree = readdirSync(resolve(ROOT, 'tests'))
      .filter((e) => e !== 'fixtures' && statSync(resolve(ROOT, 'tests', e)).isDirectory())
    const senzaRuolo = aree.filter((a) => !TEST_AREAS[a])
    expect(senzaRuolo, `aggiungi il ruolo di queste aree a TEST_AREAS: ${senzaRuolo.join(', ')}`).toEqual([])
  })
})
