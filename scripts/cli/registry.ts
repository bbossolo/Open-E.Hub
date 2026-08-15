/**
 * Registry della CLI «ehub» — FONTE DI VERITÀ dei comandi batch della suite.
 * Da qui nascono il dispatch (ehub.ts) e l'help (`ehub help [--json]`). I moduli
 * comando NON hanno side-effect all'import (requisito: questo file è importato
 * anche da sync-docs e dai test).
 *
 * Per aggiungere un comando: nuovo modulo in commands/ (pattern `tool:azione`),
 * voce qui sotto, `npm run sync:docs` — tests/cli/registry.test.ts fa da
 * guardia su nomi/descrizioni/esempi.
 */
import { betaAtti } from './commands/beta-atti'
import { chiSmista } from './commands/chi-smista'
import { deltaCopertine } from './commands/delta-copertine'
import { deltaElenco } from './commands/delta-elenco'
import { miuCerca } from './commands/miu-cerca'
import { miuElenco } from './commands/miu-elenco'
import type { ComandoCli } from './types'

export const COMANDI: ComandoCli[] = [
  betaAtti,
  chiSmista,
  deltaCopertine,
  deltaElenco,
  miuElenco,
  miuCerca,
]
