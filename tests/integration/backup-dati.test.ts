import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hubSource } from '../hub/hub-src'

/**
 * BACKUP DATI — quello che Open E.Hub ha imparato lavorando, in un file.
 * Vive nel browser di UNA macchina: il collega non ce l'ha, il PC nuovo riparte da zero, e
 * se il disco muore è perso. Finché non c'è il server aziendale, questo file È il backup.
 */
const ROOT = resolve(__dirname, '../..')
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')

describe('backup dati: c\'è, ed è raggiungibile', () => {
  const html = read('src/hub/index.html')
  const main = hubSource()

  it('sta in Impostazioni, e si chiama «Backup dati»', () => {
    expect(html).toContain('Backup dati')
    expect(html).toContain('onclick="openBackup()"')
    expect(html).toContain('id="backup-overlay"')
  })

  it('esporta, esporta il catalogo in CSV (per verificarlo), e importa', () => {
    expect(html).toContain('onclick="backupEsporta()"')
    expect(html).toContain('onclick="backupEsportaCsv()"')
    expect(html).toContain('onchange="backupImporta(this)"')
    // usa il motore condiviso: l'hub non reimplementa nulla
    // il livello di `../` dipende da quale modulo di src/hub/ ospita il backup
    expect(main).toMatch(/from '(?:\.\.\/)+shared\/memoria-studio'/)
  })

  it('IMPORTARE UNISCE: il lavoro di chi importa non si cancella', () => {
    const i = main.indexOf('async function backupImporta')
    const body = main.slice(i, i + 1500)
    expect(body).toMatch(/modo: 'unisci'/)
    // e non si scrive NIENTE prima di aver detto cosa c'è nel file e aver avuto un sì
    const iAnteprima = body.indexOf('anteprima(j)')
    const iConfirm = body.indexOf('confirm(')
    const iScrive = body.indexOf('importaMemoria(')
    expect(iAnteprima).toBeGreaterThan(-1)
    expect(iConfirm).toBeGreaterThan(iAnteprima)
    expect(iScrive).toBeGreaterThan(iConfirm)
  })

  it('un file che non è un backup non può toccare nulla', () => {
    const i = main.indexOf('async function backupImporta')
    const body = main.slice(i, i + 1500)
    expect(body).toMatch(/if \(!valida\(j\)\)/)
  })

  it('il backup è dello STUDIO: il catalogo esce dallo scomparto giusto', () => {
    expect(main).toMatch(/companyId: bkCompanyId\(\)/)
  })
})
