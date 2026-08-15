/**
 * Visibilità di un tool per l'utente corrente. PURO/testabile: nessun DOM,
 * nessuna lettura diretta di localStorage — riceve lo stato già letto dal
 * chiamante (main.js).
 *
 * Regola: tutti i tool sono visibili di default. L'UNICO gate rimasto è
 * `adminOnly` — divieto assoluto, nessun opt-in possibile: solo l'admin (di
 * sistema o aziendale) vede questi tool (es. α, il centro di controllo).
 */
import type { AppDef } from '../data/registry'

export interface ToolVisibilityCtx {
  /** true se il profilo loggato è admin (di sistema o aziendale). */
  isAdmin: boolean
}

/** Visibilità di un tool: nascosto SOLO se `adminOnly` e l'utente non è admin. */
export function isToolVisible(app: Pick<AppDef, 'adminOnly'>, ctx: ToolVisibilityCtx): boolean {
  return !app.adminOnly || ctx.isAdmin
}
