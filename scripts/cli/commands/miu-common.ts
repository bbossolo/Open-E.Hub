/**
 * Loader condiviso dei comandi μ: prezzari interni `prezzari/<slug>.json.gz`
 * (JSON impacchettato + gzip — vedi src/tools/miu/engine/pack.ts). Da Node il
 * gunzip è node:zlib (il `DecompressionStream` browser-only resta un limite
 * solo della UI).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { unpackPrezzario } from '../../../src/tools/miu/engine/pack'
import type { PackedPrezzario, PriceRow, PrezzarioMeta } from '../../../src/tools/miu/engine/types'
import { CliError } from '../types'

export const PREZZARI_DIR = resolve('prezzari')

/** Slug disponibili (i `*.json.gz` in prezzari/), ordinati. */
export function elencaSlugs(dir: string = PREZZARI_DIR): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json.gz'))
    .map((f) => f.slice(0, -'.json.gz'.length))
    .sort()
}

/** Legge il pack di uno slug (gunzip + parse), SENZA spacchettare le righe —
 *  sufficiente per i metadati. CliError con l'elenco degli slug se assente. */
export function caricaPacked(slug: string, dir: string = PREZZARI_DIR): PackedPrezzario {
  const src = resolve(dir, `${slug}.json.gz`)
  if (!existsSync(src)) {
    const slugs = elencaSlugs(dir)
    const elenco = slugs.length ? `Disponibili:\n  - ${slugs.join('\n  - ')}` : `Nessun prezzario in ${dir}`
    throw new CliError(`Prezzario "${slug}" non trovato. ${elenco}`)
  }
  return JSON.parse(gunzipSync(readFileSync(src)).toString('utf-8')) as PackedPrezzario
}

/** Carica e spacchetta un prezzario completo (meta + righe). */
export function caricaPrezzario(slug: string, dir: string = PREZZARI_DIR): { meta: PrezzarioMeta; rows: PriceRow[] } {
  return unpackPrezzario(caricaPacked(slug, dir))
}
