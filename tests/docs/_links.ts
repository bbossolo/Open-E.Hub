import { readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * Helper condivisi delle guardie sulla documentazione.
 *
 * Il punto delicato è **cosa NON guardare**: i doc di Open E.Hub sono pieni di esempi
 * (tutorial in Docs/04, albero dei file in Docs/01, snippet di registry). Se si
 * estraessero path anche dai blocchi di codice, ogni esempio diventerebbe un
 * falso positivo e la guardia verrebbe disattivata dopo due giorni — cioè il
 * modo tipico in cui una guardia muore. Quindi: prima si spoglia il markdown dal
 * codice, poi si controlla.
 */

export const ROOT = resolve(__dirname, '../..')

/** Tutti i .md sotto Docs/ (incluso archivio/) più il README di root, come path relativi a ROOT. */
export function allDocs(): string[] {
  const out: string[] = ['README.md']
  const walk = (dir: string): void => {
    for (const e of readdirSync(resolve(ROOT, dir))) {
      const rel = join(dir, e)
      if (statSync(resolve(ROOT, rel)).isDirectory()) walk(rel)
      else if (e.endsWith('.md')) out.push(rel)
    }
  }
  walk('Docs')
  return out.sort()
}

/** Markdown senza blocchi recintati e senza code-span: quel che resta è prosa e link veri. */
export function stripCode(md: string): string {
  return md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
}

/**
 * Destinazioni dei link markdown `[testo](dest)`, escluse URL esterne e ancore pure.
 * I link NON vengono cercati nel codice d'esempio (vedi stripCode).
 */
export function linkedPaths(md: string): string[] {
  const out = new Set<string>()
  for (const m of stripCode(md).matchAll(/\]\(([^)\s]+)\)/g)) {
    const dest = m[1].split('#')[0].trim()
    if (!dest || /^(https?:|mailto:)/.test(dest)) continue
    out.add(dest)
  }
  return [...out]
}
