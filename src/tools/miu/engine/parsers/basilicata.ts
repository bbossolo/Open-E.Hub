/**
 * Parser per la famiglia **Basilicata** (`<Prezzario>` con anagrafica annidata).
 *
 * Struttura:
 *   <Prezzario><anno>2025</anno>
 *     <capitoli><Capitolo><codice>A</codice><descrizione>NOLEGGI</descrizione>
 *       <categorie><Categoria><codice>01</codice><descrizione>Noleggi</descrizione>
 *         <voci><Voce><codice>001</codice><descrizione>Veicolo…</descrizione>
 *           <sottovoci><Sottovoce>
 *             <codice>01</codice><descrizione>fino a kg 1200…</descrizione>
 *             <unitaMisura><codice>ora</codice></unitaMisura>
 *             <prezzo>61.77</prezzo><manodopera>46.75</manodopera>
 *           </Sottovoce></sottovoci>
 *
 * Le voci con prezzo sono le **Sottovoce**; la gerarchia (Capitolo/Categoria/Voce)
 * fornisce livelli e descrizione ereditata.
 */
import { composeDesc } from '../descriptions'
import { makeParser, num, toArray } from '../xml'
import type { ParseResult, PriceRow } from '../types'

// parseTagValue:false → i codici con zeri iniziali ("001") restano stringhe.
const parser = makeParser({ parseTagValue: false })

interface Sottovoce {
  codice?: string
  descrizione?: string
  unitaMisura?: { codice?: string }
  prezzo?: string
  manodopera?: string
}
interface Voce { codice?: string; descrizione?: string; sottovoci?: { Sottovoce?: Sottovoce | Sottovoce[] } }
interface Categoria { codice?: string; descrizione?: string; voci?: { Voce?: Voce | Voce[] } }
interface Capitolo { codice?: string; descrizione?: string; categorie?: { Categoria?: Categoria | Categoria[] } }

const str = (v: unknown): string => String(v ?? '').trim()

export function parseBasilicata(xml: string, fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const doc = parser.parse(xml)
  const root = doc?.Prezzario
  if (!root) return { rows: [], regione: fallback.regione ?? null, anno: fallback.anno ?? null }

  const regione = fallback.regione ?? 'Basilicata'
  const anno = str(root.anno) || (fallback.anno ?? null)

  const rows: PriceRow[] = []
  for (const cap of toArray<Capitolo>(root.capitoli?.Capitolo)) {
    const liv1 = str(cap.descrizione)
    for (const cat of toArray<Categoria>(cap.categorie?.Categoria)) {
      const liv2 = str(cat.descrizione)
      for (const voce of toArray<Voce>(cat.voci?.Voce)) {
        const liv3 = str(voce.descrizione)
        for (const sv of toArray<Sottovoce>(voce.sottovoci?.Sottovoce)) {
          const prezzo = num(sv.prezzo)
          if (prezzo === 0) continue
          const descSub = str(sv.descrizione)
          const codice = [cap.codice, cat.codice, voce.codice, sv.codice].map(str).filter(Boolean).join('.')

          // self-contained: liv3 ("Veicolo peso totale:") è il padre, descSub la foglia
          const estesa = [liv3, descSub].filter(Boolean).join(' — ') || codice
          const sintetica = composeDesc([liv1, liv2, liv3], descSub) || liv3 || codice

          rows.push({
            codice,
            declaratoria: estesa,
            desc_short: sintetica,
            um: str(sv.unitaMisura?.codice),
            prezzo,
            importo_netto: 0,
            ru: num(sv.manodopera),
            liv1, liv2, liv3, liv4: '',
            materia: '',
            disciplina: liv1,
            sistema: liv2,
            attivita: '',
            settore: liv3,
            keywords: '',
            tipologia: '',
            regione,
            anno: anno ?? '',
          })
        }
      }
    }
  }

  return { rows, regione, anno }
}
