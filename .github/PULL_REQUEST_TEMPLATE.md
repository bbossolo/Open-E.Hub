# Cosa cambia e perché

<!-- Il problema che risolvi, non solo l'elenco dei file toccati. -->

## Come l'hai verificato

<!-- Test aggiunti, o il percorso a mano seguito nell'app. -->

## Prima di chiedere la revisione

- [ ] `npm run typecheck` — 0 errori
- [ ] `npx vitest run` — tutto verde
- [ ] `npm run lint:css` — 0 violazioni del contratto UI
- [ ] `npm run sync:docs` — se hai toccato `src/hub/data/registry.ts`, `src/shared/bus.ts` o `scripts/docs-manifest.ts`
- [ ] `npm run build:web` — se hai toccato i sorgenti di un tool (i bundle `.html` non stanno nel repo: si rigenerano)

I dettagli su queste regole stanno in [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md); le
convenzioni vincolanti (bus tipizzato, round-trip del progetto `.ehub`, pulsanti `.ehb-btn*`,
niente dati fabbricati al posto di una fonte rimossa) in [CLAUDE.md](../blob/main/CLAUDE.md) §6.
