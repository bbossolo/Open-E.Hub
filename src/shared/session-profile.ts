/**
 * Dove vive il profilo di sessione sul CLIENT — punto unico.
 *
 * Sta in **sessionStorage**, non in localStorage: la sessione muore chiudendo
 * il browser. Su una macchina condivisa (studio con più persone a turno) chi
 * si siede dopo NON deve trovare la suite già aperta con l'identità di chi
 * c'era prima.
 *
 * Open E.Hub (edizione 'desktop', unica edizione) non ha login: l'hub scrive
 * qui un profilo admin locale fisso all'avvio (`initAuth`, vedi hub/ui/auth.js),
 * così i tool caricati in iframe (stessa origine, sessionStorage condiviso)
 * possono riconoscere che la sessione è passata dall'hub — usato in
 * particolare dal gate difensivo di α (Centro di controllo), che va protetto
 * anche se qualcuno apre il suo HTML direttamente.
 */

export const AUTH_KEY = 'hub:auth'

/** Profilo salvato, forma minima usata qui (il tipo pieno è AuthProfile in hub/engine/auth). */
interface StoredProfile {
  companyId?: string | null
  utente?: string
  azienda?: string
  [k: string]: unknown
}

/** Storage della sessione; `null` se non disponibile (privacy mode, storage off). */
function store(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

/** Il profilo grezzo salvato, o null. Non valida: usa `isValidProfile` a valle. */
export function readAuth(): StoredProfile | null {
  try {
    const raw = store()?.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as StoredProfile) : null
  } catch {
    return null
  }
}

export function writeAuth(profile: unknown): void {
  try { store()?.setItem(AUTH_KEY, JSON.stringify(profile)) } catch { /* storage off */ }
}

export function clearAuth(): void {
  try { store()?.removeItem(AUTH_KEY) } catch { /* storage off */ }
}

/** Azienda del profilo corrente (null per admin e profili senza azienda). */
export function authCompanyId(): string | null {
  const p = readAuth()
  return typeof p?.companyId === 'string' ? p.companyId : null
}
