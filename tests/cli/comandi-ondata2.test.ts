import { describe, it, expect } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import { runCli } from '../../scripts/cli/ehub'
import { importaACorpo, importaAMisura } from '../../src/tools/beta/engine'

const tmp = () => mkdtempSync(join(tmpdir(), 'ehub-cli2-'))

/** Computo Primus sintetico (formato A) → file .xls su disco. */
function scriviComputoXls(dir: string, nome: string, prezzo1: string, prezzo2: string): string {
  const grid: unknown[][] = [
    ['', 'Nr', 'Tariffa', 'DESIGNAZIONE dei LAVORI', 'DIMENSIONI', 'Quantità', 'IMPORTI', '', '', ''],
    ['', '', '', 'LAVORI A MISURA', '', '', '', '', '', ''],
    ['', '1', 'VEN25-04.10.016.c', 'POZZETTI IN CALCESTRUZZO ARMATO 100x100', '', '', '', '', '', ''],
    ['', '', '', '001 - Opere esterne', '', '', '', '', '', ''],
    [' ', '', ' ', ' SOMMANO cad', '', '13', prezzo1, '', '', ''],
    ['', '2', 'AP.IE.107', 'CAVO BUS RS485', '', '', '', '', '', ''],
    ['', '', '', '002 - Impianti elettrici', '', '', '', '', '', ''],
    [' ', '', ' ', ' SOMMANO 1 m', '', '250', prezzo2, '', '', ''],
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(grid), 'Computo')
  const path = join(dir, nome)
  writeFileSync(path, XLSX.write(wb, { bookType: 'biff8', type: 'buffer' }) as Buffer)
  return path
}

/** Progetto .ehub sintetico con stati β e δ (stessa forma dei test dei tool). */
function scriviEhub(dir: string): string {
  const appalto = {
    oggetto: 'Manutenzione scuola', cup: 'C11', cig: 'Z0A',
    ente: { denominazione: 'Comune di Prova', indirizzo: 'Piazza Roma 1', codiceFiscale: '0', logo: '' },
    impresa: { denominazione: 'Impresa srl', partitaIva: '01234567890' },
    rup: 'Ing. Rossi', direttoreLavori: 'Arch. Bianchi', articoloCapitolato: '12',
    baseAsta: 100000, importoOfferta: 80000, oneriSicurezza: 2000, ivaPct: 10, modalita: 'misto',
  }
  const partite = [
    ...importaAMisura([{ codice: 'M1', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 100, categoria: 'Opere edili' }]),
    ...importaACorpo([{ codice: 'C1', desc_short: 'Impianto', prezzo: 100, qty: 20, categoria: 'Impianti' }]),
  ]
  const sals = [{ numero: 1, data: '01/06/2026', righe: [
    { partitaId: partite[0]!.id, quantitaProgressiva: 50 },
    { partitaId: partite[1]!.id, quotaPct: 30 },
  ] }]
  const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  const ehub = {
    kind: 'ehub-project', v: 1, ts: 1754300000000,
    tools: {
      'beta-contabilita': { v: 1, appalto, partite, sals, verbali: [], giornale: [], economia: [] },
      delta: {
        v: 1,
        template: { dataUrl: PNG_1PX, w: 850, h: 1200, kind: 'pdf', name: 'cartiglio.pdf', ptW: 595, ptH: 842 },
        fields: [{ id: 'f1', kind: 'column', label: 'Titolo', column: 'Titolo', x: 0.5, y: 0.4, anchor: 'mc', align: 'center', fontFrac: 0.03 }],
        elenco: { headers: ['Codice', 'Titolo'], rows: [
          { Codice: 'A123-EL01', Titolo: 'Planimetria PT' },
          { Codice: 'A123-EL02', Titolo: 'Planimetria P1' },
        ], fileName: 'elenco.xlsx' },
        filenameColumn: 'Codice',
      },
    },
  }
  const path = join(dir, 'progetto.ehub')
  writeFileSync(path, JSON.stringify(ehub))
  return path
}

/** DXF minimo con TABLES/LAYER + entità, per chi:smista (stile fixture riscrivi). */
function scriviDxf(dir: string): string {
  const righe = [
    '0', 'SECTION', '2', 'HEADER', '9', '$HANDSEED', '5', '1000', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER',
    '0', 'LAYER', '2', 'MURI', '70', '0', '62', '7', '6', 'Continuous',
    '0', 'LAYER', '2', 'TESTI', '70', '0', '62', '7', '6', 'Continuous',
    '0', 'ENDTAB', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LINE', '8', 'MURI', '10', '0', '20', '0', '11', '1', '21', '1',
    '0', 'TEXT', '8', 'TESTI', '10', '0', '20', '0', '40', '2', '1', 'Ciao',
    '0', 'ENDSEC', '0', 'EOF',
  ]
  const path = join(dir, 'tavola.dxf')
  writeFileSync(path, righe.join('\n') + '\n', 'utf-8')
  return path
}

describe('CLI ehub — smoke ondata 2 (χ/β/δ)', () => {
  it('chi:smista --dry-run propone lo smistamento; senza dry-run riscrive il DXF', async () => {
    const dir = tmp()
    const dxf = scriviDxf(dir)
    const dry = await runCli(['chi:smista', dxf, '--dry-run'])
    const anteprima = JSON.parse(dry.stdout.join('\n')) as { righe: Array<{ layer: string; destinazione: string }> }
    expect(anteprima.righe.find((r) => r.layer === 'MURI')?.destinazione).toBe('MURATURA')
    expect(anteprima.righe.find((r) => r.layer === 'TESTI')?.destinazione).toBe('TESTI')

    const esito = await runCli(['chi:smista', dxf, '--out', dir])
    const out = esito.stdout[0]!
    expect(existsSync(out)).toBe(true)
    const testo = readFileSync(out, 'utf-8')
    expect(testo).toContain('MURATURA')
    expect(testo).not.toMatch(/\n8\nMURI\n/) // entità spostate dal layer d'origine
  })

  it('beta:atti genera la cartella d\'appalto da un .ehub (html + xlsx)', async () => {
    const dir = tmp()
    const ehub = scriviEhub(dir)
    const esito = await runCli(['beta:atti', ehub, '--out', dir])
    expect(esito.stdout.length).toBeGreaterThanOrEqual(8)
    for (const p of esito.stdout) expect(existsSync(p), p).toBe(true)
    expect(readFileSync(esito.stdout.find((p) => p.includes('sal1'))!, 'utf-8')).toContain('Comune di Prova')

    const xlsx = await runCli(['beta:atti', ehub, '--tipo', 'sal', '--formato', 'xlsx', '--out', dir])
    const wb = XLSX.read(readFileSync(xlsx.stdout[0]!), { type: 'buffer' })
    expect(wb.SheetNames.length).toBe(1)
  })

  it('beta:atti su SAL inesistente → errore parlante', async () => {
    const dir = tmp()
    const ehub = scriviEhub(dir)
    await expect(runCli(['beta:atti', ehub, '--tipo', 'sal', '--numero', '9'])).rejects.toThrowError(/SAL n\. 9 non presente/)
  })

  it('delta:copertine genera un PDF per riga dal .ehub; delta:elenco ispeziona un xls', async () => {
    const dir = tmp()
    const ehub = scriviEhub(dir)
    const esito = await runCli(['delta:copertine', ehub, '--out', dir])
    expect(esito.stdout.length).toBe(2)
    for (const p of esito.stdout) {
      expect(p.endsWith('.pdf')).toBe(true)
      expect(readFileSync(p).subarray(0, 4).toString('latin1')).toBe('%PDF')
    }

    const xls = scriviComputoXls(dir, 'elenco.xls', '1', '2')
    const elenco = await runCli(['delta:elenco', xls, '--json'])
    const fogli = JSON.parse(elenco.stdout.join('\n')) as Array<{ righe: number }>
    expect(fogli.length).toBe(1)
  })
})
