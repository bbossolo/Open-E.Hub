/* μ (Prezzi) legacy — esportazione verso il formato METEL.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { buildMetelContent } from './export.js'
import { collectExportRows } from './computo-overlay.js'
import { toast } from './index.js'

// UM mapping for METEL format
export const UM_METEL = {
  'cad':'PZ ', 'm':'ML ', 'm²':'MQ ', 'm³':'MC ', 'kg':'KG ', 'kW':'KW ',
  'kw':'KW ', 'kwp':'KW ', 'dm':'DM ', 'ha':'HA ', 'l':'LT ',
  'pcs':'PZ ', 'nr':'PZ ', 'n°':'PZ ','':' NR'
};

export function pad(s,len){return String(s||'').substring(0,len).padEnd(len,' ');}

// ══════════════════════════════════════════════════════════════
// EXPORT METEL (spec mida-metel 1.0.0)
// Header 233 char, record 177 char, latin-1, CRLF.
// Incollabile/importabile sia in Elenco Prezzi sia (creando le voci)
// utilizzabile per agganciare le Misurazioni.
// ══════════════════════════════════════════════════════════════
export function padN(n,len){ return String(Math.max(0,Math.round(n))).padStart(len,'0').slice(-len); }

export function umToMetel(um){
  const u=(um||'').toLowerCase().trim();
  if(u==='m²'||u==='mq'||u==='m2') return 'MQ ';
  if(u==='m³'||u==='mc'||u==='m3') return 'MC ';
  if(u==='m'||u==='ml'||u==='mt') return 'MT ';
  if(u==='kg'||u==='kgm') return 'KG ';
  if(u==='kw'||u==='kwp') return 'KW ';
  if(u==='l'||u==='lt') return 'LT ';
  if(u==='h'||u==='ora'||u==='ore') return 'H  ';
  if(u==='cad'||u==='cadauno'||u==='n'||u==='nr'||u==='pz') return 'PZ ';
  return 'PZ ';
}


// converte una stringa in bytes latin-1 per il download (METEL è ISO-8859-1)
export function latin1Bytes(str){
  const out=new Uint8Array(str.length);
  for(let i=0;i<str.length;i++){ out[i]=str.charCodeAt(i)&0xff; }
  return out;
}

export function exportMetel(){
  const rows=collectExportRows();
  if(!rows.length){toast('Nessuna voce da esportare','warn');return;}

  // Avviso: il campo product_code METEL è lungo 16 char. Codici più lunghi
  // (es. prezzari pubblici come Lombardia) verrebbero troncati creando collisioni.
  const longCodes=rows.filter(r=>String(r.codice).length>16);
  if(longCodes.length){
    const tronc=new Set(rows.map(r=>String(r.codice).substring(0,16)));
    const collisioni=rows.length-tronc.size;
    const msg=`Attenzione: ${longCodes.length} voci hanno un codice più lungo di 16 caratteri.\n\n`+
      `Il formato METEL tronca il codice a 16 caratteri`+
      (collisioni>0?`, generando ${collisioni} codici duplicati che il gestionale destinatario potrebbe scartare.`:`.`)+
      `\n\nQuesto formato è adatto a prezzari con codici corti (FVG, listini privati).\n`+
      `Per i prezzari con codici lunghi usa "Elenco Prezzi" (copia-incolla), che li preserva interi.\n\n`+
      `Vuoi esportare comunque il METEL?`;
    if(!confirm(msg)) return;
  }

  const {content,regLabel,annoLabel}=buildMetelContent(rows);
  const dateStr=new Date().toISOString().slice(0,10).replace(/-/g,'');
  const blob=new Blob([latin1Bytes(content)],{type:'text/plain;charset=iso-8859-1'});
  const a=Object.assign(document.createElement('a'),{
    href:URL.createObjectURL(blob),
    download:`METEL_${regLabel}${annoLabel?'_'+annoLabel:''}_${dateStr}.txt`
  });
  a.click(); URL.revokeObjectURL(a.href);
  toast(`${rows.length.toLocaleString('it')} voci esportate in METEL`,'ok');
}

// Utility XML generiche (escape/sanitize) e etichetta unità, usate da chi genera
// export in formato XML/Excel a partire dalle righe del computo.
export function xmlEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
// Rimuove i caratteri di controllo ILLEGALI in XML 1.0 (C0 tranne TAB/LF/CR): se finiscono
// grezzi in un file XML/Excel non è ben formato e l'import viene rifiutato in blocco.
export function sanitizeXmlText(s){return String(s==null?'':s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');}

export function umLabel(um){
  // etichetta unità per la riga SOMMANO
  const u=(um||'').trim();
  return u||'cad';
}
