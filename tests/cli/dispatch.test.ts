import { describe, it, expect } from 'vitest'
import { runCli } from '../../scripts/cli/ehub'
import { COMANDI } from '../../scripts/cli/registry'
import { CliError } from '../../scripts/cli/types'

describe('CLI ehub — dispatch e help', () => {
  it('senza argomenti (o con help) stampa l\'help con tutti i comandi', async () => {
    for (const argv of [[], ['help'], ['--help']]) {
      const out = (await runCli(argv)).stdout.join('\n')
      for (const c of COMANDI) expect(out).toContain(c.nome)
    }
  })

  it('help --json è JSON parsabile con il contratto completo di ogni comando', async () => {
    const esito = await runCli(['help', '--json'])
    const dump = JSON.parse(esito.stdout.join('\n')) as Array<Record<string, unknown>>
    expect(dump.length).toBe(COMANDI.length)
    for (const d of dump) {
      expect(typeof d.nome).toBe('string')
      expect(typeof d.descrizione).toBe('string')
      expect(typeof d.uso).toBe('string')
      expect(Array.isArray(d.argomenti)).toBe(true)
      expect(Array.isArray(d.esempi)).toBe(true)
    }
  })

  it('help <comando> mostra uso, argomenti ed esempi', async () => {
    const cmd = COMANDI[0]!
    const out = (await runCli(['help', cmd.nome])).stdout.join('\n')
    expect(out).toContain(cmd.descrizione)
    expect(out).toContain('Uso: ehub ' + cmd.nome)
    for (const e of cmd.esempi) expect(out).toContain(e)
  })

  it('comando sconosciuto → CliError con suggerimento dello stesso namespace', async () => {
    await expect(runCli(['chi:boh'])).rejects.toThrowError(CliError)
    await expect(runCli(['chi:boh'])).rejects.toThrowError(/chi:smista/)
    await expect(runCli(['zzz:niente'])).rejects.toThrowError(/elenco completo/)
  })
})
