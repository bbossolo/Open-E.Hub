/**
 * Profilo dell'hub.
 *
 * Open E.Hub è mono-studio locale: non c'è login. Si entra sempre con un
 * profilo admin locale, sintetizzato da `initAuth` (vedi hub/ui/auth.js) e
 * persistito per la sessione del browser (vedi shared/session-profile) così
 * i tool aperti in iframe (stessa origine) lo riconoscono. `AuthProfile`
 * resta il tipo condiviso del profilo; `isValidProfile`/`profileLabel` sono
 * usate sia dall'hub sia dal gate difensivo di α (Centro di controllo).
 */

export type AuthRole = 'user' | 'admin'

export interface AuthProfile {
  /** Ragione sociale (o 'admin'). */
  azienda: string
  utente: string
  role: AuthRole
  /** id azienda riconosciuta → logo/intestazioni; null = admin (comportamento normale). */
  companyId: string | null
  /** epoch ms del login. */
  ts: number
}

/** Type-guard di un profilo salvato (per il ripristino da sessionStorage). */
export function isValidProfile(p: unknown): p is AuthProfile {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return (
    typeof o.azienda === 'string' &&
    typeof o.utente === 'string' &&
    (o.role === 'user' || o.role === 'admin') &&
    (typeof o.companyId === 'string' || o.companyId === null)
  )
}

/**
 * Etichetta del profilo per la UI. Porta SEMPRE il nome di chi è entrato,
 * quando c'è: su una postazione condivisa vedere il proprio nome è ciò che fa
 * accorgere di stare usando la sessione di un collega (prima compariva solo la
 * ragione sociale, identica per tutti i colleghi della stessa azienda).
 */
export function profileLabel(p: AuthProfile): string {
  const chi = (p.utente || '').trim()
  if (p.companyId) return chi ? `${chi} · ${p.azienda}` : p.azienda
  if (p.role === 'admin') return chi && chi.toLowerCase() !== 'admin' ? `${chi} · Amministratore` : 'Amministratore'
  return chi || 'Profilo personale'
}
