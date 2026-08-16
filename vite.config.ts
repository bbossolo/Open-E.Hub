import { resolve } from 'node:path'
// `defineConfig` viene da vitest/config, non da vite: è quello che conosce anche la
// chiave `test` qui sotto. Con l'import da 'vite' la config non type-checka più
// (da Vite 8 il tipo UserConfig non è più aperto all'augmentation di Vitest).
import { defineConfig } from 'vitest/config'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Ogni tool viene compilato in un singolo file HTML self-contained (JS+CSS inline)
// scritto nella root del progetto con NOME STABILE (senza versione): l'hub lo scopre
// per nome esatto e la versione vive in versions.js. Niente più rinomini ad ogni
// release → niente conflitti di merge. Le librerie in `vendor/` NON vengono inglobate:
// restano riferimenti relativi caricati a runtime, per preservare l'offline.
// Un tool per build (vedi nota su outDir). Default: hub.
const TOOL = process.env.TOOL ?? 'hub'
const TOOL_INPUT: Record<string, Record<string, string>> = {
  miu: { miu: resolve(__dirname, 'src/tools/miu/index.html') },
  alfa: { Alfa: resolve(__dirname, 'src/tools/alfa/index.html') },
  beta: { Beta: resolve(__dirname, 'src/tools/beta/index.html') },
  delta: { Delta: resolve(__dirname, 'src/tools/delta/index.html') },
  chi: { Chi: resolve(__dirname, 'src/tools/chi/index.html') },
  hub: { EHub: resolve(__dirname, 'src/hub/index.html') },
}

// Catalogo compositore (μ) — Open E.Hub non porta dataset di marchi/prodotti
// proprietari: lo studio importa il proprio catalogo dall'app (vedi engine/
// catalog-source.ts). Il bundle parte sempre dallo stub vuoto.
const COMPOSITORE_CATALOG_STUB = resolve(__dirname, 'src/shared/compositore/catalog-data-empty.ts')
const COMPOSITORE_CATALOG_ALIAS = {
  'compositore-catalog:marchi': COMPOSITORE_CATALOG_STUB,
  'compositore-catalog:libreria': COMPOSITORE_CATALOG_STUB,
  'compositore-catalog:sinonimi-parola': COMPOSITORE_CATALOG_STUB,
  'compositore-catalog:tematiche': COMPOSITORE_CATALOG_STUB,
  'compositore-catalog:macrocategorie': COMPOSITORE_CATALOG_STUB,
  'compositore-catalog:thesaurus': COMPOSITORE_CATALOG_STUB,
  'compositore-catalog:componi': COMPOSITORE_CATALOG_STUB,
}

export default defineConfig({
  // Riferimenti relativi: l'HTML buildato vive nella root, accanto a vendor/.
  base: './',
  resolve: { alias: { ...COMPOSITORE_CATALOG_ALIAS } },
  plugins: [viteSingleFile()],
  build: {
    // UN tool per invocazione (singlefile usa inlineDynamicImports, incompatibile
    // con input multipli). Si seleziona con la env var TOOL; build in dist/ (gitignored),
    // poi scripts/place-builds.mjs copia gli HTML a root dove l'hub li scopre.
    outDir: resolve(__dirname, `dist/web/${TOOL}`),
    emptyOutDir: true,
    // Niente cartella assets separata: singlefile inlina tutto nell'HTML
    // (compresi i dataset .json.gz dei prezzari interni di Price List).
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      input: TOOL_INPUT[TOOL]
    }
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts']
  }
})
