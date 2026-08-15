/**
 * STUB del catalogo compositore (alias di build, vedi vite.config.ts):
 * Open E.Hub non porta dataset di marchi/prodotti proprietari, quindi il
 * bundle parte sempre da questi array vuoti — lo studio importa il proprio
 * catalogo dall'app.
 */
import type { Marchio } from './marchi'
import type { VocePronta } from './libreria'
import type { MacroCategoria } from './macrocategorie'
import type { Famiglia } from './thesaurus'
import type { FrasarioFamiglia } from './componi'

export const MARCHI_DATA: Marchio[] = []
export const VOCI_PRONTE_DATA: VocePronta[] = []
export const GRUPPI_PAROLA_DATA: readonly (readonly string[])[] = []
export interface RegolaTemaData { tema: string; source: string }
export const RULES_DATA: RegolaTemaData[] = []
export const TEMATICHE_DATA: string[] = []
export const MACROCATEGORIE_DATA: MacroCategoria[] = []
export const BASE_DATA: Record<string, MacroCategoria[]> = {}
export const CH_NEG_SOURCE = ''
export const CH_EDILI_SOURCE = ''
export const CH_ELETTRICI_SOURCE = ''
export const CH_ILLUMINAZIONE_SOURCE = ''
export const CH_SPECIALI_SOURCE = ''
export const CH_MECCANICI_SOURCE = ''
export const CH_ANTINCENDIO_SOURCE = ''
export const KW_SPECIALI_SOURCE = ''
export const KW_ILLUMINAZIONE_SOURCE = ''
export const KW_ANTINCENDIO_SOURCE = ''
export const FAMIGLIE_DATA: Famiglia[] = []
export const FRASARIO_DATA: FrasarioFamiglia[] = []
