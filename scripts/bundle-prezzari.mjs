/**
 * Genera i bundle dei prezzari interni per Price List, caricati a RICHIESTA.
 * Per ogni prezzari/<slug>.json.gz produce prezzari/_bundle/<slug>.js che
 * registra il gzip (base64) su window.__PRZ[slug]; + manifest.js con l'elenco.
 * I .js sono caricati via <script src> (funziona sotto file://, a differenza di
 * fetch) e decompressi a runtime con Blob+DecompressionStream.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve, join } from 'node:path'

const SRC = resolve('prezzari')
const OUT = resolve('prezzari/_bundle')
mkdirSync(OUT, { recursive: true })

/* Alcuni prezzari condividono regione+anno perché sono PARTI diverse della stessa
   edizione (es. Lombardia 2026: Parti 1-3 nel formato standard, Parte 4 "Elenco
   prezzi" nel formato dataroot). Senza un'etichetta distintiva apparirebbero come
   due "Lombardia 2026" indistinguibili a video. `variante` disambigua per family. */
const VARIANTE = {
  'lombardia': 'Parti 1-3',
  'lombardia-dataroot': 'Parte 4 · Elenco prezzi',
}

const manifest = []
for (const f of readdirSync(SRC).filter(f => f.endsWith('.json.gz')).sort()) {
  const slug = f.replace(/\.json\.gz$/, '')
  const gz = readFileSync(join(SRC, f))
  const meta = JSON.parse(gunzipSync(gz).toString('utf-8')).meta
  writeFileSync(join(OUT, slug + '.js'),
    `(window.__PRZ=window.__PRZ||{})[${JSON.stringify(slug)}]=${JSON.stringify(gz.toString('base64'))};\n`)
  manifest.push({ slug, regione: meta.regione, anno: meta.anno, family: meta.family, source: meta.source, count: meta.count, categoria: meta.categoria ?? 'pubblico', variante: VARIANTE[meta.family] })
  console.log(`  ${slug}: ${meta.count} voci, ${(gz.length / 1048576).toFixed(1)} MB`)
}
manifest.sort((a, b) => String(a.regione).localeCompare(String(b.regione)))
// L'hub mostra solo i campi utili a video (niente percorso sorgente). `variante`
// solo quando presente (parti distinte della stessa edizione).
const forApp = manifest.map(({ slug, regione, anno, count, categoria, variante }) =>
  variante ? { slug, regione, anno, count, categoria, variante } : { slug, regione, anno, count, categoria })
writeFileSync(join(OUT, 'manifest.js'), `window.__PRZ_MANIFEST=${JSON.stringify(forApp)};\n`)

// STATUS.md — record di tracking LOCALE (gitignored): cosa è impacchettato e da quale grezzo.
// I listini `metel` (fornitore) sono dati privati dello studio: esclusi dal file
// committato — restano solo i prezzari pubblici/istituzionali.
const forStatus = manifest.filter(m => m.categoria !== 'metel')
const totVoci = forStatus.reduce((s, m) => s + (m.count || 0), 0)
const status = '# Prezzari interni — stato\n\n' +
  '> Generato da `npm run bundle:prezzari`. Traccia regione, **anno** (edizione), voci e grezzo.\n' +
  '> Quando una regione pubblica un anno nuovo: aggiorna il grezzo in `prezzari-src/`, poi\n' +
  '> `npm run build:prezzari <regione>` e `npm run bundle:prezzari`.\n' +
  '>\n' +
  '> Le voci in formato `metel` (listini fornitore) sono dati privati e non sono elencate qui:\n' +
  '> ogni studio porta i propri sotto `prezzari-src/Listini METEL/<Fornitore>/`, gitignored.\n\n' +
  `**${forStatus.length} regioni · ${totVoci.toLocaleString('it')} voci**\n\n` +
  '| Regione | Anno | Voci | Formato | Grezzo |\n|---|---|---:|---|---|\n' +
  forStatus.map(m => `| ${m.regione} | ${m.anno} | ${(m.count || 0).toLocaleString('it')} | ${m.family} | \`${m.source}\` |`).join('\n') + '\n'
writeFileSync(join(SRC, 'STATUS.md'), status)
console.log(`✓ ${manifest.length} prezzari (${totVoci} voci) → prezzari/_bundle/ + prezzari/STATUS.md`)
