/**
 * Riallinea i DOC alla FONTE DI VERITÀ del catalogo tool: [src/hub/data/registry.ts].
 * Rigenera i blocchi delimitati da marker `AUTO:<blocco>:<variante>:START/END` nei
 * documenti target, così l'elenco strumenti, gli stati (stabile/beta) e il flusso di
 * integrazione restano SEMPRE aggiornati senza interventi manuali.
 *
 * Blocchi disponibili (fonte di verità → doc):
 *   AUTO:tools:table    → tabella catalogo (categoria · cosa fa · stato)      [registry]
 *   AUTO:tools:list     → elenco puntato (nome — tagline (stato))            [registry]
 *   AUTO:flow:_         → integrazioni fra i tool (dai `notes` del registry) [registry]
 *   AUTO:files:root     → HTML a root ↔ cartella sorgente                    [registry]
 *   AUTO:guide:<tool>   → "primi passi" dagli step del tour guidato          [data/tour.ts]
 *   AUTO:tours:coverage → quali tool hanno un tour e quali no                [data/tour.ts]
 *   AUTO:scripts:npm    → comandi npm per scopo                              [package.json]
 *   AUTO:bus:messages   → contratto dei messaggi hub↔tool                    [src/shared/bus.ts]
 *   AUTO:shared:layer   → moduli di src/shared/ e loro ruolo                 [src/shared]
 *   AUTO:tests:areas    → aree di test e cosa coprono (senza numeri)         [tests/ + manifest]
 *   AUTO:docs:index     → indice della documentazione                       [docs-manifest.ts]
 *   AUTO:cli:commands   → catalogo comandi della CLI unificata «ehub»        [scripts/cli/registry.ts]
 *
 * NON si generano dati volatili (conteggi di commit, di file, di test): un numero
 * qui dentro renderebbe `npm test` rosso a ogni commit, per un'informazione che
 * nessuno consulta.
 *
 * Uso:
 *   npm run sync:docs           # riscrive i blocchi nei doc
 *   vite-node scripts/sync-docs.ts --check   # esce ≠0 se qualcosa è fuori sync (per la CI)
 *
 * Chiamato automaticamente da scripts/release.mjs (push su main) e verificato dal test
 * [tests/docs/docs-in-sync.test.ts] (parte di `npm test` → blocca il build se i doc
 * sono stale). NON editare a mano il testo fra i marker.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { APP_REGISTRY, groupByCategory, CATEGORY_LABELS, type AppDef } from '../src/hub/data/registry'
import { DOCS, TEST_AREAS, SHARED_AREAS, type DocEntry } from './docs-manifest'
import { COMANDI } from './cli/registry'
import { usage } from './cli/args'
import type { Tour } from '../src/shared/ui/components/tour'
import { HUB_TOUR } from '../src/hub/data/tour'
import { MIU_TOUR } from '../src/tools/miu/data/tour'

/** Tour disponibili per il blocco AUTO:guide:<id>. */
const TOURS: Record<string, Tour> = { home: HUB_TOUR, miu: MIU_TOUR }

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const statusLabel = (s: string) => (s === 'beta' ? 'beta' : 'stabile')

/**
 * Il registry DEVE descrivere tool che esistono davvero: per ogni voce verifica
 * la cartella sorgente (`src/tools/<srcDir>/index.html`) e l'HTML a root. Senza
 * questo controllo un `srcDir` sbagliato finirebbe nei doc come path plausibile
 * ma inesistente (è già successo: `src/tools/undefined/`). Gira anche in
 * `--check`, quindi il drift blocca la CI e non solo la scrittura.
 */
export function assertRegistrySane(root: string): void {
  const bad: string[] = []
  for (const a of APP_REGISTRY) {
    if (!existsSync(resolve(root, 'src/tools', a.srcDir, 'index.html')))
      bad.push(`${a.name}: manca src/tools/${a.srcDir}/index.html (srcDir errato?)`)
  }
  if (bad.length) throw new Error('sync-docs: registry incoerente col filesystem:\n  ' + bad.join('\n  '))
}

function appVersion(): string {
  try {
    const require = createRequire(import.meta.url)
    return require(resolve(ROOT, 'versions.js')).app.version
  } catch {
    return JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8')).version as string
  }
}

const NOTE = '<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/registry.ts) — NON editare a mano -->'
/** Come NOTE, ma dichiarando la fonte di verità specifica del blocco. */
const noteFrom = (src: string) => `<!-- ⚙️ generato da \`npm run sync:docs\` (fonte: ${src}) — NON editare a mano -->`

/** Tool in ordine di categoria, come li mostra l'hub. */
const flat = (): AppDef[] => groupByCategory(APP_REGISTRY).flatMap((g) => g.apps)

function renderToolsList(): string {
  const apps = flat()
  const lines = apps.map((a) => `- **${a.name}** — ${a.tagline} _(${statusLabel(a.status)})_`)
  return [NOTE, `Strumenti: **${apps.length}** (Open E.Hub v${appVersion()}).`, '', ...lines].join('\n')
}

function renderToolsTable(): string {
  const rows = ['| Strumento | Categoria | Cosa fa | Stato |', '|---|---|---|---|']
  for (const g of groupByCategory(APP_REGISTRY)) {
    for (const a of g.apps) {
      rows.push(`| **${a.name}** (\`src/tools/${a.srcDir}/\`) | ${CATEGORY_LABELS[g.key]} | ${a.tagline} | ${statusLabel(a.status)} |`)
    }
  }
  return [NOTE, ...rows].join('\n')
}

function renderFlow(): string {
  const lines: string[] = []
  for (const a of APP_REGISTRY) {
    for (const n of a.notes || []) lines.push(`- **${a.name}** — ${n.text}`)
  }
  return [NOTE, ...lines].join('\n')
}

function renderGuide(toolId: string): string {
  const tour = TOURS[toolId]
  if (!tour) throw new Error(`sync-docs: nessun tour per "guide:${toolId}"`)
  const lines = tour.steps.map((s) => `- **${s.title}** — ${s.text}`)
  return [noteFrom(toolId === 'home' ? 'src/hub/data/tour.ts' : `src/tools/${toolId}/data/tour.ts`), ...lines].join('\n')
}

/**
 * File HTML a root (quelli che l'hub apre) ↔ cartella sorgente che li genera.
 * `up` è il prefisso per risalire alla radice del repo dal doc che ospita il
 * blocco (vuoto per README.md, `../` per i doc dentro Docs/): senza, i link
 * sarebbero rotti in metà dei target.
 */
function renderFilesRoot(up: string): string {
  const rows = [
    noteFrom('src/hub/data/registry.ts'),
    '| File a root (aperto dall\'hub) | Sorgente | Strumento |',
    '|---|---|---|',
    `| \`EHub.html\` | [\`src/hub/\`](${up}src/hub/) | Open E.Hub — il lanciatore |`,
  ]
  for (const a of flat()) rows.push(`| \`${a.file}\` | [\`src/tools/${a.srcDir}/\`](${up}src/tools/${a.srcDir}/) | ${a.name} |`)
  rows.push('', 'I file a root sono **artefatti di build** (rigenerati da `npm run build:web`): si modifica il sorgente, mai l\'HTML a root.')
  return rows.join('\n')
}

/** Comandi npm, raggruppati per scopo. Fonte: package.json. */
function renderScripts(): string {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8')) as { scripts: Record<string, string> }
  const groups: Array<{ label: string; match: (k: string) => boolean }> = [
    { label: 'Qualità', match: (k) => ['typecheck', 'lint:css', 'test', 'test:watch'].includes(k) },
    { label: 'Build', match: (k) => k === 'build' || k.startsWith('build:') },
    { label: 'Dati e asset', match: (k) => k.startsWith('bundle:') || k === 'validate:dxf' },
    { label: 'CLI e batch', match: (k) => k === 'ehub' || k.startsWith('batch:') },
    { label: 'Versioni e documentazione', match: (k) => k === 'bump' || k === 'release' || k.startsWith('sync:') },
    { label: 'Avvio', match: (k) => k === 'start' },
  ]
  const rows = [noteFrom('package.json'), '| Scopo | Comando | Cosa esegue |', '|---|---|---|']
  const seen = new Set<string>()
  for (const g of groups) {
    for (const [k, v] of Object.entries(pkg.scripts)) {
      if (seen.has(k) || !g.match(k)) continue
      seen.add(k)
      rows.push(`| ${g.label} | \`npm run ${k}\` | \`${v}\` |`)
    }
  }
  return rows.join('\n')
}

/** Indice della documentazione. Fonte: scripts/docs-manifest.ts. */
function renderDocsIndex(): string {
  const rel = (d: DocEntry) => d.file
  const vivi = DOCS.filter((d) => d.file !== 'README.md')
  const out = [noteFrom('scripts/docs-manifest.ts'), '| Doc | A cosa serve | Quando leggerlo |', '|---|---|---|']
  for (const d of vivi) out.push(`| [${d.title}](${rel(d)}) | ${d.purpose} | ${d.when} |`)
  return out.join('\n')
}

/** Prima frase del commento di testa di un file .ts (il suo "a cosa serve"). */
function firstDocSentence(abs: string): string {
  const src = readFileSync(abs, 'utf-8')
  const m = /^\s*\/\*\*([\s\S]*?)\*\//.exec(src)
  if (!m) return '—'
  const text = m[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .join(' ')
    .trim()
  const dot = text.indexOf('. ')
  const one = (dot > 0 ? text.slice(0, dot) : text.replace(/\.$/, '')).trim()
  const flat = one.replace(/\s+/g, ' ')
  return flat.length > 160 ? flat.slice(0, 157).trimEnd() + '…' : flat
}

/** Layer condiviso: file e sottocartelle di src/shared/, descritti dal loro JSDoc. */
function renderSharedLayer(up: string): string {
  const dir = resolve(ROOT, 'src/shared')
  const entries = readdirSync(dir).sort()
  const files = entries.filter((e) => e.endsWith('.ts') && e !== 'index.ts')
  const dirs = entries.filter((e) => statSync(resolve(dir, e)).isDirectory())
  const out = [noteFrom('src/shared — commenti di testa dei moduli'), '| Modulo | Ruolo |', '|---|---|']
  for (const f of files) out.push(`| [${f}](${up}src/shared/${f}) | ${firstDocSentence(resolve(dir, f))} |`)
  out.push('', '| Area | Ruolo |', '|---|---|')
  for (const d of dirs) {
    const idx = resolve(dir, d, 'index.ts')
    const ruolo = existsSync(idx) ? firstDocSentence(idx) : SHARED_AREAS[d]
    if (!ruolo || ruolo === '—')
      throw new Error(`sync-docs: l'area src/shared/${d}/ non è descritta — aggiungi un commento di testa al suo index.ts, oppure una voce in SHARED_AREAS (scripts/docs-manifest.ts)`)
    out.push(`| [${d}/](${up}src/shared/${d}/) | ${ruolo} |`)
  }
  return out.join('\n')
}

/**
 * Aree di test e loro ruolo. DELIBERATAMENTE senza conteggi: un numero di file
 * qui dentro renderebbe `npm test` rosso a ogni test aggiunto, per un dato che
 * nessuno usa.
 */
function renderTestAreas(up: string): string {
  const dir = resolve(ROOT, 'tests')
  const dirs = readdirSync(dir).filter((e) => statSync(resolve(dir, e)).isDirectory() && e !== 'fixtures').sort()
  const out = [noteFrom('tests/ + scripts/docs-manifest.ts'), '| Area | Cosa copre |', '|---|---|']
  for (const d of dirs) {
    const role = TEST_AREAS[d]
    if (!role) throw new Error(`sync-docs: area di test "tests/${d}/" non descritta — aggiungila a TEST_AREAS in scripts/docs-manifest.ts`)
    out.push(`| [tests/${d}/](${up}tests/${d}/) | ${role} |`)
  }
  return out.join('\n')
}

/** Quali tool hanno un tour guidato (e quindi una sezione "primi passi") e quali no. */
function renderToursCoverage(): string {
  const withTour = flat().filter((a) => TOURS[a.srcDir])
  const without = flat().filter((a) => !TOURS[a.srcDir])
  const out = [noteFrom('src/hub/data/tour.ts + src/tools/*/data/tour.ts')]
  out.push(`Hanno un tour guidato (▶ nell'hub) e i "primi passi" qui sotto: ${withTour.map((a) => a.name).join(' · ')}.`)
  if (without.length) out.push('', `Non ancora coperti da un tour: ${without.map((a) => a.name).join(' · ')}.`)
  return out.join('\n')
}

/** Un messaggio del bus, come dichiarato in src/shared/bus.ts. */
interface BusMsg { type: string; payload: string; doc: string }

/**
 * Estrae il contratto del bus dalle union `HubToTool`/`ToolToHub`. La direzione
 * segue la SEZIONE, non il prefisso: `hub:navigate` e `hub:go-home` sono
 * richieste del tool verso l'hub pur avendo prefisso `hub:` (la vecchia tabella
 * scritta a mano le classificava male).
 */
export function parseBusContract(src: string): { hubToTool: BusMsg[]; toolToHub: BusMsg[] } {
  const section = (name: string): string => {
    const start = src.indexOf(`export type ${name} =`)
    if (start < 0) throw new Error(`sync-docs: union ${name} non trovata in src/shared/bus.ts`)
    const rest = src.slice(start)
    const end = rest.search(/\n(?:export type |const |\/\*\* Messaggi)/)
    return end > 0 ? rest.slice(0, end) : rest
  }
  const parse = (block: string): BusMsg[] => {
    const out: BusMsg[] = []
    let doc = ''
    for (const raw of block.split('\n')) {
      const line = raw.trim()
      if (line.startsWith('/**') || line.startsWith('*') || line.startsWith('*/')) {
        if (line.startsWith('/**')) doc = ''
        doc = (doc + ' ' + line.replace(/^\/\*\*|^\*\/|^\*/g, '').replace(/\*\/$/, '')).trim()
        continue
      }
      const m = /^\|\s*\{\s*type:\s*'([^']+)'\s*;?\s*(.*)\}\s*$/.exec(line)
      if (!m) continue
      // I tipi annidati (`deleted?: { cavidotti?: string[] }`) vanno rimossi PRIMA
      // di separare i campi: altrimenti i loro membri interni diventerebbero
      // campi di primo livello inesistenti.
      const fields = m[2]
        .replace(/\{[^{}]*\}/g, '…')
        .split(';')
        .map((f) => f.split(':')[0].trim())
        .filter(Boolean)
      // Solo la PRIMA frase: la tabella deve restare leggibile, il dettaglio
      // completo sta nel JSDoc del contratto. `|` va neutralizzato o spezza la tabella.
      // Fine frase = punto NON di abbreviazione («es.», «cfr.», «p.») seguito da spazio.
      const flatDoc = doc.replace(/\s+/g, ' ').trim()
      const cut = flatDoc.search(/(?<!\bes)(?<!\bcfr)(?<!\bp)(?<!\bvedi)\.\s/)
      out.push({
        type: m[1],
        payload: fields.length ? fields.map((f) => `\`${f}\``).join(', ') : '—',
        doc: (cut > 0 ? flatDoc.slice(0, cut + 1) : flatDoc).replace(/\|/g, '\\|'),
      })
      doc = ''
    }
    return out
  }
  return { hubToTool: parse(section('HubToTool')), toolToHub: parse(section('ToolToHub')) }
}

function renderBus(): string {
  const { hubToTool, toolToHub } = parseBusContract(readFileSync(resolve(ROOT, 'src/shared/bus.ts'), 'utf-8'))
  const table = (title: string, msgs: BusMsg[]) => [
    `**${title}**`,
    '',
    '| Messaggio | Dati | Cosa fa |',
    '|---|---|---|',
    ...msgs.map((m) => `| \`${m.type}\` | ${m.payload} | ${m.doc || '—'} |`),
    '',
  ]
  return [
    noteFrom('src/shared/bus.ts'),
    ...table('Hub → Tool', hubToTool),
    ...table('Tool → Hub', toolToHub),
  ].join('\n')
}

/** Catalogo dei comandi della CLI unificata «ehub». Fonte: scripts/cli/registry.ts. */
function renderCliCommands(): string {
  const out = [noteFrom('scripts/cli/registry.ts')]
  for (const c of [...COMANDI].sort((a, b) => a.nome.localeCompare(b.nome))) {
    out.push('', `### \`${c.nome}\``, '', c.descrizione, '', '```', usage(c), '```')
    if (c.argomenti.length) {
      out.push('', '| Argomento | Tipo | Obbligatorio | Default | Descrizione |', '|---|---|---|---|---|')
      for (const a of c.argomenti) {
        const nome = a.tipo === 'posizionale' ? `\`${a.nome}\`` : `\`--${a.nome}\``
        // Il `|` nelle descrizioni (es. ".json|.ehub") romperebbe la cella markdown.
        const desc = a.descrizione.replace(/\|/g, '\\|')
        out.push(`| ${nome} | ${a.tipo}${a.variadico ? ' (variadico)' : ''} | ${a.obbligatorio ? 'sì' : 'no'} | ${a.default !== undefined ? `\`${a.default}\`` : '—'} | ${desc} |`)
      }
    }
    if (c.esempi.length) out.push('', ...c.esempi.map((e) => `- \`${e}\``))
  }
  return out.join('\n')
}

const RENDERERS: Record<string, (variant: string, up: string) => string> = {
  tools: (v) => (v === 'list' ? renderToolsList() : renderToolsTable()),
  flow: () => renderFlow(),
  guide: (v) => renderGuide(v),
  files: (_v, up) => renderFilesRoot(up),
  scripts: () => renderScripts(),
  docs: () => renderDocsIndex(),
  shared: (_v, up) => renderSharedLayer(up),
  tests: (_v, up) => renderTestAreas(up),
  tours: () => renderToursCoverage(),
  bus: () => renderBus(),
  cli: () => renderCliCommands(),
}

/** `up` = come risalire alla radice del repo dal doc target (link corretti ovunque). */
function render(block: string, variant: string, up: string): string {
  const fn = RENDERERS[block]
  if (!fn) throw new Error(`sync-docs: blocco AUTO sconosciuto "${block}:${variant}"`)
  return fn(variant, up)
}

/** Doc che possono contenere blocchi AUTO (i marker vengono sostituiti dove presenti). */
export const TARGETS = [
  'README.md',
  'Docs/README.md',
  'Docs/01-Panoramica-e-Architettura.md',
  'Docs/02-Guida-Utente.md',
  'Docs/03-Build-e-Release.md',
]

const BLOCK_RE = /(<!-- AUTO:([a-z]+):([a-z_]+):START -->)[\s\S]*?(<!-- AUTO:\2:\3:END -->)/g

/**
 * Rigenera i blocchi AUTO nei doc target. In `check` non scrive: ritorna solo l'elenco
 * dei file che RISULTEREBBERO modificati (per il test/CI anti-drift).
 */
export function syncDocs(root: string = ROOT, { check = false }: { check?: boolean } = {}): { changed: string[] } {
  assertRegistrySane(root)
  const changed: string[] = []
  for (const rel of TARGETS) {
    const p = resolve(root, rel)
    // Un target rinominato/cancellato NON deve passare in silenzio: senza questo
    // throw, spostare un doc lo escluderebbe dalla rigenerazione per sempre.
    if (!existsSync(p)) throw new Error(`sync-docs: TARGET dichiarato ma inesistente: ${rel} (aggiorna TARGETS)`)
    const src = readFileSync(p, 'utf-8')
    const up = '../'.repeat(rel.split('/').length - 1)
    const out = src.replace(BLOCK_RE, (_m, start, block, variant, end) => `${start}\n${render(block, variant, up)}\n${end}`)
    // Confronto EOL-insensibile: su working tree Windows (autocrlf) il file su
    // disco è CRLF ma i blocchi rigenerati sono LF; senza normalizzare, ogni doc
    // risulterebbe sempre "fuori sync". Il drift REALE (contenuto) resta rilevato.
    const norm = (s: string) => s.replace(/\r\n/g, '\n')
    if (norm(out) !== norm(src)) {
      changed.push(rel)
      if (!check) writeFileSync(p, out)
    }
  }
  return { changed }
}

/**
 * Entrypoint CLI (chiamato da scripts/sync-docs.run.ts, non con auto-detect di argv
 * che con vite-node è inaffidabile). Con `--check` non scrive ed esce ≠0 sul drift.
 * Il modulo resta privo di side-effect all'import → il test può importare `syncDocs`.
 */
export function main(argv: string[] = process.argv.slice(2)): void {
  const check = argv.includes('--check')
  const { changed } = syncDocs(ROOT, { check })
  if (check) {
    if (changed.length) {
      console.error('✗ doc fuori sync col registry:\n  ' + changed.join('\n  ') + '\n  → esegui: npm run sync:docs')
      process.exit(1)
    }
    console.log('✓ doc in sync col registry')
  } else {
    console.log(changed.length ? '✓ doc aggiornati:\n  ' + changed.join('\n  ') : '✓ doc già aggiornati')
  }
}
