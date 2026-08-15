/**
 * Utenti aziendali di Open E.Hub — PREDISPOSIZIONE locale (nessun backend).
 *
 * Finché non ci sarà il server aziendale, gli utenti vivono in
 * localStorage (`hub:users`), seminati da SEED_USERS al primo avvio. L'admin li
 * gestisce dal pannello Amministrazione (aggiungi/rimuovi/attiva/ruolo). Quando
 * arriverà l'auth server, questo store verrà sostituito dalle API mantenendo la
 * stessa forma di `HubUser` (additivo, nessun break — vedi engine/auth).
 *
 * NB: non ci sono password per-utente in questa fase: l'accesso aziendale usa la
 * password dimostrativa dell'azienda (= id azienda), e l'utente identifica solo la
 * persona. La validazione vera (hash/sessione) arriverà col server.
 */

export type UserRole = 'user' | 'admin'

export interface HubUser {
  /** Id stabile (immutabile). */
  id: string
  /** Nome per il login (campo "Utente"), univoco per azienda, case-insensitive. */
  username: string
  /** Nome e cognome mostrato. */
  name: string
  /** Azienda di appartenenza (id in COMPANIES); null = profilo senza azienda. */
  companyId: string | null
  /** Ruolo. */
  role: UserRole
  /** Se disattivato, non può accedere. */
  active: boolean
}

/** Utente demo (predisposizione — ogni studio aggiungerà i suoi dal pannello α).
 *  L'admin di sistema (nome «admin» + password dedicata) è separato e non ha
 *  azienda: vedi engine/auth. */
export const SEED_USERS: HubUser[] = [
  { id: 'studio-demo-u1', username: 'utente1', name: 'Utente 1', companyId: 'studio-demo', role: 'user', active: true },
]

/** Type-guard di un utente salvato (per il ripristino da localStorage). */
export function isValidUser(u: unknown): u is HubUser {
  if (!u || typeof u !== 'object') return false
  const o = u as Record<string, unknown>
  return (
    typeof o.id === 'string' && o.id.length > 0 &&
    typeof o.username === 'string' && o.username.length > 0 &&
    typeof o.name === 'string' &&
    (typeof o.companyId === 'string' || o.companyId === null) &&
    (o.role === 'user' || o.role === 'admin') &&
    typeof o.active === 'boolean'
  )
}

/** Normalizza la lista salvata; se assente/corrotta ritorna i SEED. */
export function normalizeUsers(raw: unknown): HubUser[] {
  if (!Array.isArray(raw)) return [...SEED_USERS]
  const ok = raw.filter(isValidUser)
  return ok.length ? ok : [...SEED_USERS]
}

/** Utenti (attivi) di un'azienda. */
export function usersOfCompany(users: HubUser[], companyId: string): HubUser[] {
  return users.filter(u => u.companyId === companyId)
}

/** Profili non legati ad alcuna azienda. */
export function usersWithoutCompany(users: HubUser[]): HubUser[] {
  return users.filter(u => u.companyId === null)
}

/** Trova un utente per username in un'azienda (case-insensitive). */
export function findUser(users: HubUser[], companyId: string, username: string): HubUser | null {
  const q = (username || '').trim().toLowerCase()
  if (!q) return null
  return users.find(u => u.companyId === companyId && u.username.toLowerCase() === q) || null
}

/** Trova un utente senza azienda per username (case-insensitive). */
export function findUserNoCompany(users: HubUser[], username: string): HubUser | null {
  const q = (username || '').trim().toLowerCase()
  if (!q) return null
  return users.find(u => u.companyId === null && u.username.toLowerCase() === q) || null
}

/** Crea un nuovo utente con id univoco e default sensati. `companyId` null = profilo senza azienda. */
export function makeUser(companyId: string | null, name: string, username: string): HubUser {
  const uname = (username || '').trim() || (name || '').trim().toLowerCase().replace(/\s+/g, '.')
  return {
    id: `${companyId || 'nc'}-${Date.now().toString(36)}`,
    username: uname,
    name: (name || '').trim() || uname,
    companyId,
    role: 'user',
    active: true,
  }
}
