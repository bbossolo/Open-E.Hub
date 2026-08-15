/**
 * Sistema documentale unificato Open E.Hub — foglio di stile UNICO (single source of
 * truth) per TUTTI i documenti esportabili (PDF print). La firma comune è il
 * CARTIGLIO da tavola tecnica (golden standard): qui
 * diventa banda a piè di pagina sui documenti A4, con il brand Open E.Hub.
 *
 * Un accento per documento, scelto da `data-tool` sull'<html> (token reali della
 * suite). Niente dipendenze: è una stringa CSS pura, embeddata nel print HTML.
 */
import { EHUB_BRAND_CSS } from './brand'
import { PDF_FONT_CSS } from './pdf-font'

export const DOC_CSS = `
  ${EHUB_BRAND_CSS}
  ${PDF_FONT_CSS}
  :root { color-scheme: light; }
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    --paper:#fbfbf8; --ink:#15171c; --ink-soft:#444a55; --ink-faint:#7c8593;
    --line:#e3e3dc; --line-strong:#c7c8c0;
    --sans:"Arimo","Helvetica Neue","Segoe UI",system-ui,sans-serif;
    --mono:ui-monospace,"SF Mono","JetBrains Mono","Menlo",monospace;
    --serif:"Iowan Old Style","Palatino Linotype","Georgia",serif;
    --brand-dot:#e2342f;                 /* punto rosso del logo Open E.Hub */
    --accent:#c0392f; --accent-h:#d8584d; --on-accent:#fff;
  }
  /* Accenti per tool (token reali della suite) */
  html[data-tool="miu"]    { --accent:#1ca371; --accent-h:#2fc78d; --on-accent:#04231a; }
  html[data-tool="beta"]   { --accent:#b02a7a; --accent-h:#c74f9a; --on-accent:#fff; }

  /* print-color-adjust:exact su tutto il documento → gli accenti pieni e il punto
     rosso del logo Open E.Hub stampano A COLORI (niente "logo grigio" in PDF). */
  body { font:13px/1.5 var(--sans); color:var(--ink); background:var(--paper); margin:0; padding:14mm 16mm 0;
         -webkit-print-color-adjust:exact; print-color-adjust:exact; }

  /* Barra azioni (solo schermo) */
  .doc-bar { position:sticky; top:0; z-index:9; display:flex; gap:8px; justify-content:flex-end; margin:0 0 12px; }
  .doc-bar button { font:600 13px/1 var(--sans); padding:8px 15px; border-radius:8px; border:1px solid var(--accent); background:var(--accent); color:var(--on-accent); cursor:pointer; }
  .doc-bar button.ghost { background:#fff; color:var(--ink); border-color:var(--line-strong); }

  /* ===== Testata documento (discreta, tecnica: brand Open E.Hub + tag tool + filo d'accento) —
     GOLDEN STANDARD = cartiglio da tavola tecnica (ehubBrand + tag testo sull'accento,
     niente più chip/glifo su sfondo pieno). ===== */
  .dochead { display:flex; align-items:center; gap:4mm; border-bottom:.5mm solid var(--accent); padding-bottom:3mm; margin-bottom:8mm; }
  .dochead__tool { flex:0 0 auto; display:flex; align-items:baseline; gap:1.6mm; }
  .dochead__tool .name { font:700 3mm/1 var(--sans); color:var(--accent); letter-spacing:.01em; }
  .dochead__main { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:.6mm; }
  .dochead__kicker { font:600 2.2mm/1 var(--mono); letter-spacing:.2em; text-transform:uppercase; color:var(--accent); }
  .dochead__title { font:600 5mm/1.1 var(--sans); letter-spacing:-.01em; margin:0; }
  .dochead__sub { font:400 2.9mm/1.3 var(--sans); color:var(--ink-soft); margin:0; }
  .dochead__meta { flex:0 0 auto; display:grid; grid-template-columns:auto auto; gap:.8mm 4mm; align-content:center; font:400 2.6mm/1.2 var(--sans); }
  .dochead__meta .k { color:var(--ink-faint); font:600 2.1mm/1 var(--mono); letter-spacing:.06em; text-transform:uppercase; }
  .dochead__meta .v { font-variant-numeric:tabular-nums; text-align:right; }

  /* ===== Riepilogo a chip ===== */
  .chips { display:flex; gap:3mm; margin:0 0 7mm; flex-wrap:wrap; }
  .chip { border:.3mm solid var(--line-strong); border-radius:2mm; padding:2.5mm 4mm; min-width:26mm; border-left:1.2mm solid var(--accent); }
  .chip b { display:block; font:700 7mm/1 var(--sans); font-variant-numeric:tabular-nums; }
  .chip span { font:600 2.5mm/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--ink-faint); }
  .chip.warn { border-left-color:#d99412; }
  .chip.warn b { color:#9a6a00; }

  /* ===== Titolo di sezione ===== */
  .sec-h { font:600 4mm/1.2 var(--sans); margin:8mm 0 3mm; padding-bottom:1.5mm; border-bottom:.4mm solid var(--ink); display:flex; align-items:baseline; gap:3mm; }
  .sec-h[data-n]::before { content:attr(data-n); font:700 2.6mm/1 var(--mono); color:var(--on-accent); background:var(--accent); padding:1mm 2mm; border-radius:1mm; letter-spacing:.08em; }

  /* ===== Tabella documenti ===== */
  .dtable { width:100%; max-width:100%; border-collapse:collapse; font:400 3mm/1.35 var(--sans); }
  /* il testo lungo va a capo (niente colonne che sforano e si tagliano in stampa) */
  .dtable td, .dtable th { overflow-wrap:anywhere; word-break:break-word; }
  .dtable .num, .dtable .code { word-break:normal; }   /* numeri/codici restano interi */
  .dtable thead th { text-align:left; font:600 2.4mm/1.2 var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--ink-faint); padding:2mm 2.5mm; border-bottom:.5mm solid var(--accent); white-space:nowrap; }
  .dtable tbody td { padding:2mm 2.5mm; border-bottom:.3mm solid var(--line); vertical-align:top; }
  .dtable tbody tr:nth-child(even) td { background:color-mix(in srgb, var(--accent) 3.5%, transparent); }
  .dtable .num, .dtable th.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .dtable .code { font:500 2.7mm/1.2 var(--mono); color:var(--ink-soft); white-space:nowrap; }
  .dtable .sub { display:block; color:var(--ink-faint); font-size:2.6mm; margin-top:.6mm; }
  .dtable tr.nv td { color:var(--ink-faint); }
  .dtable tr.tot td { font-weight:700; border-top:.5mm solid var(--ink); border-bottom:none; background:color-mix(in srgb, var(--accent) 8%, transparent); }
  .dtable tr.sec td { background:color-mix(in srgb, var(--accent) 12%, #fff); font:600 2.9mm/1.2 var(--sans); border-bottom:.4mm solid var(--line-strong); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .dtable tr.sub td { font-weight:600; background:#fafafa; border-bottom:.6mm solid var(--line-strong); }
  .dtable tr.empty td { color:var(--ink-faint); font-style:italic; padding:4mm 2.5mm; }
  .dtable .prm { display:flex; gap:6px; align-items:baseline; }
  .dtable .prm .pl { color:var(--ink-soft); min-width:30mm; }
  .dtable .prm b { font-variant-numeric:tabular-nums; min-width:18mm; text-align:right; }
  .dtable .prm .pr { color:var(--ink-faint); font-size:2.7mm; }

  /* ===== Esito / badge ===== */
  .badge { display:inline-flex; align-items:center; gap:1.5mm; font:600 2.6mm/1 var(--mono); letter-spacing:.06em; text-transform:uppercase; padding:1.4mm 2.6mm; border-radius:1mm; }
  .badge--ok { background:#e7f6ec; color:#1d7a3e; border:.3mm solid #9bd9b1; }
  .badge--ko { background:#fdecec; color:#b3261e; border:.3mm solid #efb0ac; }
  .badge--na { background:#f0f1f3; color:#6b7280; border:.3mm solid #d4d7dd; }
  .esito-big { display:flex; align-items:center; gap:4mm; margin:0 0 7mm; border:.4mm solid var(--line-strong); border-left:1.5mm solid var(--accent); border-radius:2mm; padding:4mm 5mm; }
  .esito-big .lab { font:600 2.6mm/1 var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--ink-faint); }
  .esito-big .val { font:700 6mm/1 var(--sans); }

  /* key/value grid (geometria, ecc.) */
  .kvgrid { display:grid; grid-template-columns:repeat(2,1fr); gap:1.5mm 8mm; }
  .kv { display:flex; justify-content:space-between; gap:4mm; border-bottom:.3mm solid var(--line); padding:1.2mm 0; }
  .kv span { color:var(--ink-soft); }
  .kv b { text-align:right; font-variant-numeric:tabular-nums; }
  .kv.warn b { color:#9a6a00; }
  .note { font:400 2.8mm/1.4 var(--sans); color:var(--ink-soft); margin:0 0 2mm; }
  ul.excl { margin:0; padding-left:6mm; font-size:3mm; } ul.excl li { margin:.6mm 0; }

  /* ===== Prosa (relazione / capitolato) ===== */
  .prose { font:400 3.3mm/1.6 var(--sans); color:var(--ink); }
  .prose h2 { font:600 4.4mm/1.25 var(--serif); margin:7mm 0 2mm; display:flex; gap:3mm; align-items:baseline; }
  .prose h2 .art { font:700 3mm/1 var(--mono); color:var(--accent); }
  .prose h3 { font:600 3.4mm/1.3 var(--sans); margin:5mm 0 1.5mm; color:var(--ink-soft); }
  .prose p { margin:0 0 2.5mm; text-align:justify; }
  .prose ul { margin:0 0 3mm; padding-left:6mm; } .prose li { margin:0 0 1mm; text-align:justify; }
  .prose .lead { font-size:3.6mm; color:var(--ink-soft); }
  .prose blockquote { margin:3mm 0; padding:2.5mm 4mm; border-left:1.2mm solid var(--accent); background:color-mix(in srgb, var(--accent) 5%, #fff); color:var(--ink-soft); font-size:3.1mm; }
  .prose .d-norme { font:italic 400 2.7mm/1.4 var(--sans); color:var(--ink-faint); margin:0 0 1.5mm; }

  /* ===== Cartiglio a fascia (firma comune) + brand Open E.Hub — sobrio, una riga ===== */
  .docfoot { margin-top:auto; margin-left:-16mm; margin-right:-16mm; padding:2.5mm 16mm; border-top:.4mm solid var(--accent);
             display:flex; flex-wrap:wrap; gap:1.2mm 6mm; align-items:center; }
  .docfoot .df-lockup { display:inline-flex; align-items:baseline; gap:1.6mm; }
  .docfoot .df-tooltag { font:700 2.7mm/1 var(--sans); color:var(--accent); letter-spacing:.01em; }
  /* LETTERHEAD dello studio (azienda cliente di Open E.Hub) in ALTO: logo
     (immagine o TEMPLATE placeholder) + ragione sociale + indirizzo. */
  .doc-letterhead { display:flex; align-items:center; gap:3mm; padding-bottom:3mm; margin-bottom:4mm; border-bottom:.3mm solid #e6e8ec; }
  .doc-letterhead img { max-height:11mm; width:auto; object-fit:contain; }
  .doc-letterhead .co-logo--ph { display:inline-flex; align-items:center; justify-content:center; min-width:16mm; height:11mm; padding:0 2mm; border:.3mm dashed #b9bfca; border-radius:1.4mm; font:800 5mm/1 var(--mono); letter-spacing:.05em; color:#3a3f47; }
  .doc-letterhead .dl-name { font:700 4.4mm/1.1 var(--sans); color:#15171c; }
  .doc-letterhead .dl-addr { font:400 2.7mm/1.2 var(--sans); color:#6b7482; margin-top:.6mm; }
  @media print { .doc-letterhead .co-logo--ph { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  /* β — TESTATA ISTITUZIONALE dell'ENTE / stazione appaltante (atti della PA): logo +
     denominazione + righe (indirizzo, C.F.). Centrata, sobria, senza brand Open E.Hub: in
     testa a questi documenti comanda il committente pubblico, non Open E.Hub. */
  .doc-ente { display:flex; flex-direction:column; align-items:center; text-align:center; gap:2mm; padding-bottom:3.5mm; margin-bottom:5mm; border-bottom:.5mm solid var(--accent); }
  .doc-ente img { max-height:18mm; width:auto; object-fit:contain; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .doc-ente .de-name { font:700 4.8mm/1.15 var(--serif); color:#15171c; letter-spacing:.01em; }
  .doc-ente .de-sub { font:400 2.9mm/1.3 var(--sans); color:#4a4f59; }
  .docfoot.docfoot--nobrand { border-top-color:var(--line-strong); }
  /* β — blocchi degli atti contabili (parti del contratto, firme, segnaposto). */
  .bt-parti { display:grid; grid-template-columns:1fr 1fr; gap:4mm; margin:2mm 0 3mm; }
  .bt-parte { border:.3mm solid var(--line-strong); border-left:1.2mm solid var(--accent); border-radius:1.5mm; padding:3mm 4mm; }
  .bt-parte__ruolo { font:600 2.2mm/1 var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--ink-faint); margin-bottom:1.4mm; }
  .bt-parte__nome { font:700 3.4mm/1.2 var(--sans); }
  .bt-parte__riga { font:400 2.8mm/1.3 var(--sans); color:var(--ink-soft); }
  .bt-firme { display:flex; gap:8mm; margin:10mm 0 2mm; flex-wrap:wrap; break-inside:avoid; page-break-inside:avoid; }
  .bt-firma { flex:1 1 40mm; min-width:40mm; }
  .bt-firma__line { height:0; border-top:.3mm solid var(--ink); margin-bottom:1.4mm; }
  .bt-firma__ruolo { font:600 2.6mm/1.2 var(--sans); }
  .bt-firma__nome { font:400 2.7mm/1.2 var(--sans); color:var(--ink-soft); }
  .bt-todo { font:600 2.6mm/1 var(--sans); color:#9a6a00; background:#fbf1d8; padding:.4mm 1.4mm; border-radius:.8mm; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .docfoot .field { display:flex; align-items:baseline; gap:1.4mm; }
  .docfoot .field .k { font:600 2.1mm/1 var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--ink-faint); }
  .docfoot .field .v { font:500 2.8mm/1.1 var(--sans); font-variant-numeric:tabular-nums; }
  .docfoot .df-page { margin-left:auto; font:600 2.6mm/1 var(--mono); color:var(--ink-faint); }
  .docfoot .df-disc { flex-basis:100%; margin-top:1.2mm; padding-top:1.2mm; border-top:.3mm solid var(--line); font:400 2.3mm/1.35 var(--sans); color:var(--ink-soft); }

  body { min-height:100vh; display:flex; flex-direction:column; }
  .docbody { flex:1 0 auto; }

  /* ===== Paginazione: nessun titolo orfano a fondo pagina, blocchi non spezzati ===== */
  .sec-h, .prose h2, .prose h3, .dochead { break-after:avoid; page-break-after:avoid; }
  .sec-h, .prose h2, .prose h3 { break-inside:avoid; page-break-inside:avoid; }
  .dtable thead { display:table-header-group; }   /* intestazioni di tabella ripetute per pagina */
  /* una RIGA non si spezza mai tra due pagine (serve sia la prop moderna sia la
     legacy: Chrome in stampa rispetta page-break-inside su tr/td, non break-inside). */
  .dtable tr, .dtable td, .dtable th { break-inside:avoid; page-break-inside:avoid; }
  .chip, .esito-big, .kv { break-inside:avoid; page-break-inside:avoid; }
  .prose p, .prose li { orphans:3; widows:3; }

  /* ===== Anteprima A SCHERMO = come la stampa (WYSIWYG) =====
     Il documento si presenta già come un FOGLIO A4 su un piano scuro: stessi margini,
     stessi colori, cartiglio al suo posto. Così l'anteprima somiglia al PDF (l'unica
     differenza resta l'impaginazione su più pagine, che solo il motore di stampa calcola). */
  @media screen {
    html { background:#2b2e35; padding:24px 0; }
    body { width:210mm; min-height:297mm; margin:0 auto; box-shadow:0 14px 50px rgba(0,0,0,.45); }
  }

  @page { size:A4; margin:14mm 16mm; }
  @media print {
    /* In stampa il body torna a flusso a BLOCCHI: i container flex non frammentano
       bene tra le pagine e tagliano le tabelle. Niente flex → paginazione corretta.
       Le "intestazioni persistenti" sono i <thead> delle tabelle (table-header-group),
       che Chromium ripete su ogni pagina senza sovrapporsi al contenuto. */
    body { display:block; padding:0; min-height:0; }
    .docbody { display:block; }
    .docfoot { margin-top:0; break-inside:avoid; margin-left:-16mm; margin-right:-16mm; }
    .doc-bar { display:none !important; }
  }
`
