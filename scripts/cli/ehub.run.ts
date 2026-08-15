/** Runner sottile della CLI «ehub» (vedi scripts/cli/ehub.ts).
 *  Uso: npm run ehub -- <comando> [argomenti]   ·   npm run ehub -- help [--json] */
import { runCli } from './ehub'
import { CliError } from './types'

try {
  const esito = await runCli(process.argv.slice(2))
  for (const r of esito.stdout) console.log(r)
  for (const r of esito.stderr) console.error(r)
} catch (err) {
  const msg = err instanceof CliError || err instanceof Error ? err.message : String(err)
  console.error('✗ ' + msg)
  process.exit(1)
}
