// μ (Prezzi) legacy — ESPORTAZIONI: builder di contenuti per l'interscambio
// (Elenco Prezzi TSV, distinta METEL, binario→bytes per xlsx). Estratti da index.js
// nello STEP 2 dello split. `pad/padN/umToMetel` restano in index.js (usati anche
// altrove) e sono importati come live-binding — l'import circolare è sicuro perché
// referenziati solo nei corpi funzione.
import { pad, padN, umToMetel } from './index.js'

function buildTSVContent(rows){
  const q=s=>'"'+String(s||'').replace(/"/g,'""').replace(/[\r\n]+/g,' ').trim()+'"';
  const price=n=>'"'+(Number(n)||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+'"';
  // Incidenza manodopera (%) — vuota se il prezzario non la fornisce
  const pct=n=>(n==null||n===''||!isFinite(Number(n)))?'""':'"'+Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+'"';
  const _n=t=>String(t||'').replace(/\s+/g,' ').trim();
  const lines=rows.map(r=>{
    // Sintetica = breve LEGGIBILE. Data-driven (come combineDesc): se la declaratoria
    // è "PADRE — foglia" (la contiene in coda, stile Basilicata) usa quella, così non
    // resta il frammento orfano "fino a kg 1.200…". Altrimenti la desc_short.
    // No-op sui prezzari con desc_short già completa (Veneto/Lombardia/Piemonte/…).
    const s=_n(r.desc_short), e=_n(r.declaratoria);
    const sintetica=(s&&e&&e!==s&&!e.startsWith(s)&&e.endsWith(s)) ? e : (s||e);
    const estesa=e||s;
    return [q(r.codice), q(sintetica), q(estesa), q(r.um), price(r.prezzo), pct(r.ru)].join('\t');
  });
  const regSet=[...new Set(rows.map(r=>r.regione))];
  const regLabel=(regSet.length===1?regSet[0]:'MultiReg').substring(0,20);
  const annoSet=[...new Set(rows.map(r=>r.anno).filter(a=>a&&a!=='—'))];
  const annoLabel=annoSet.length===1?annoSet[0]:'';
  return { content:lines.join('\r\n')+'\r\n', regLabel, annoLabel };
}

function buildMetelContent(rows){
  const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
  const regSet=[...new Set(rows.map(r=>r.regione))];
  const regLabel=(regSet.length===1?regSet[0]:'MultiReg');
  const annoSet=[...new Set(rows.map(r=>r.anno).filter(a=>a&&a!=='—'))];
  const annoLabel=annoSet.length===1?annoSet[0]:'';

  // ── HEADER (233 char) ──
  // [0:20] tipo file | [20:29] cod.fornitore | [29:53] date | [53:160] descrizione
  // [160:180] codice listino | [180:233] padding
  const desc=`PREZZARIO ${regLabel}${annoLabel?' '+annoLabel:''}`;
  const header=
    pad('LISTINO',20) +                 // 0-19 tipo file
    pad('PREZZOP',9) +                  // 20-28 codice fornitore
    (dateStr+dateStr+pad('',8)) +       // 29-52 date varie (24)
    pad(desc,107) +                     // 53-159 descrizione
    pad('PREZZARIOFLASH',20) +          // 160-179 codice listino
    pad('',53);                         // 180-232 padding
  const lines=[pad(header,233)];

  // ── RECORD (177 char) ──
  rows.forEach(r=>{
    const wholesale=padN((r.prezzo||0)*100,11);
    const pubPrice =padN((r.prezzo||0)*100,11);
    const line=
      pad('OP ',3) +                                  // 0-2   brand_code (generico opere pubbliche)
      pad(r.codice.substring(0,16),16) +              // 3-18  product_code
      pad('',13) +                                    // 19-31 ean (vuoto)
      pad((r.desc_short||r.declaratoria||'').replace(/[\r\n]+/g,' '),43) + // 32-74 description (43)
      pad('00001',5) +                                // 75-79 carton_qty
      pad('00001',5) +                                // 80-84 order_multiple
      pad('00001',5) +                                // 85-89 min_order_qty
      pad('000000',6) +                               // 90-95 max_order_qty
      '0' +                                           // 96    lead_time
      wholesale +                                     // 97-107  wholesale_price ×100 (11)
      pubPrice +                                      // 108-118 public_price ×100 (11)
      pad('000001',6) +                               // 119-124 price_multiplier
      'EUR' +                                         // 125-127 currency
      umToMetel(r.um) +                               // 128-130 unit (3)
      '0' +                                           // 131 composite_product
      '1' +                                           // 132 product_state (attivo)
      dateStr +                                       // 133-140 last_change_date
      pad('',18) +                                    // 141-158 discount_family
      pad('',18);                                     // 159-176 statistical_family
    lines.push(pad(line,177));
  });

  return { content:lines.join('\r\n')+'\r\n', regLabel:regLabel.substring(0,20), annoLabel };
}

function b64ToUint8(b64){
  const bin=atob(b64); const u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return u;
}

export { buildTSVContent, buildMetelContent, b64ToUint8 }
