import { describe, it, expect } from 'vitest'
import { parseArgsSpec, usage } from '../../scripts/cli/args'
import { CliError, type ComandoCli } from '../../scripts/cli/types'

const CMD: Pick<ComandoCli, 'nome' | 'argomenti'> = {
  nome: 'test:demo',
  argomenti: [
    { nome: 'file', tipo: 'posizionale', obbligatorio: true, descrizione: 'file di ingresso' },
    { nome: 'out', tipo: 'valore', obbligatorio: false, default: '.', descrizione: 'cartella' },
    { nome: 'json', tipo: 'boolean', obbligatorio: false, descrizione: 'output JSON' },
  ],
}

describe('CLI ehub — parser argv condiviso', () => {
  it('parsa posizionali, flag valore e boolean', () => {
    const v = parseArgsSpec(CMD, ['in.xls', '--out', '/tmp', '--json'])
    expect(v).toEqual({ file: 'in.xls', out: '/tmp', json: true })
  })

  it('applica i default e i boolean assenti = false', () => {
    expect(parseArgsSpec(CMD, ['in.xls'])).toEqual({ file: 'in.xls', out: '.', json: false })
  })

  it('obbligatorio mancante → CliError con usage', () => {
    expect(() => parseArgsSpec(CMD, [])).toThrowError(CliError)
    expect(() => parseArgsSpec(CMD, [])).toThrowError(/Uso: ehub test:demo <file>/)
  })

  it('flag sconosciuto → CliError', () => {
    expect(() => parseArgsSpec(CMD, ['in.xls', '--boh'])).toThrowError(/Flag sconosciuto --boh/)
  })

  it('valore mancante dopo un flag → CliError', () => {
    expect(() => parseArgsSpec(CMD, ['in.xls', '--out'])).toThrowError(/Manca il valore dopo --out/)
  })

  it('posizionale in eccesso → CliError', () => {
    expect(() => parseArgsSpec(CMD, ['in.xls', 'extra'])).toThrowError(/Argomento inatteso/)
  })

  it('ultimo posizionale variadico raccoglie i token rimanenti', () => {
    const cmd: Pick<ComandoCli, 'nome' | 'argomenti'> = {
      nome: 'test:cerca',
      argomenti: [
        { nome: 'slug', tipo: 'posizionale', obbligatorio: true, descrizione: 's' },
        { nome: 'query', tipo: 'posizionale', obbligatorio: true, variadico: true, descrizione: 'q' },
        { nome: 'limite', tipo: 'valore', obbligatorio: false, default: '10', descrizione: 'n' },
      ],
    }
    const v = parseArgsSpec(cmd, ['veneto-2026', 'tubo', 'corrugato', '32', '--limite', '5'])
    expect(v).toEqual({ slug: 'veneto-2026', query: ['tubo', 'corrugato', '32'], limite: '5' })
  })

  it('usage riflette lo spec (obbligatori <>, opzionali [])', () => {
    expect(usage(CMD)).toBe('ehub test:demo <file> [--out <val>] [--json]')
  })
})
