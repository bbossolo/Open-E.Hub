/**
 * Statistiche del centro di controllo (α) — SNAPSHOT LIVE, nessuno storico:
 * l'hub è offline-first (nessuna telemetria di rete), quindi ogni numero qui è
 * calcolato al volo da stato già in memoria/localStorage (registry, utenti,
 * flag, progetto corrente) — stesso principio di `diagnosticInfo()` in
 * hub/main.js, ma puro/testabile e riusato da α invece che duplicato.
 */
import type { AppDef, AppCategory } from '../data/registry'
import { CATEGORY_ORDER, CATEGORY_LABELS } from '../data/registry'
import type { HubUser } from '../data/users'
import type { HubProjectState } from './project-state'

export interface ToolCategoryStat {
  category: AppCategory
  label: string
  total: number
  stable: number
  beta: number
}

export interface AdminStats {
  tools: {
    total: number
    stable: number
    beta: number
    adminOnly: number
    perCategory: ToolCategoryStat[]
  }
  users: {
    total: number
    active: number
    admin: number
  }
  project: {
    /** progetto corrente aperto (nome/id), null se nessuno. */
    name: string | null
    /** quanti tool hanno stato salvato nel progetto corrente. */
    toolsWithState: number
    hasSharedPlan: boolean
    cavidottiCount: number
    circuitiCount: number
  }
  /** somma bytes (chiave+valore, UTF-16 ⇒ ×2) di TUTTE le chiavi localStorage. */
  storageTotalKB: number
  /** breakdown per prefisso di chiave (es. 'hub:users' → KB), solo chiavi note. */
  storageBreakdownKB: Record<string, number>
}

/** Conteggi tool per categoria (nell'ORDINE del registry), stabile vs beta. */
function toolsPerCategory(apps: AppDef[]): ToolCategoryStat[] {
  return CATEGORY_ORDER.map(category => {
    const inCat = apps.filter(a => a.category === category)
    return {
      category,
      label: CATEGORY_LABELS[category],
      total: inCat.length,
      stable: inCat.filter(a => a.status === 'stable').length,
      beta: inCat.filter(a => a.status === 'beta').length,
    }
  }).filter(c => c.total > 0)
}

export interface AdminStatsInput {
  registry: AppDef[]
  users: HubUser[]
  hubProjectState: HubProjectState | null
  /** [chiave, bytes] di ogni entry di localStorage (già letta dal chiamante — niente accesso diretto qui, resta puro). */
  storageEntries: Array<[string, number]>
  /** prefissi di chiave da riportare nel breakdown (es. ['hub:users','hub:tool-flags',...]). */
  storagePrefixes: string[]
}

export function computeAdminStats(input: AdminStatsInput): AdminStats {
  const { registry, users, hubProjectState, storageEntries, storagePrefixes } = input

  const storageTotalKB = Math.round(storageEntries.reduce((s, [, b]) => s + b, 0) / 1024)
  const storageBreakdownKB: Record<string, number> = {}
  for (const prefix of storagePrefixes) {
    const bytes = storageEntries.filter(([k]) => k === prefix).reduce((s, [, b]) => s + b, 0)
    storageBreakdownKB[prefix] = Math.round(bytes / 1024)
  }

  const tools = hubProjectState ? Object.keys(hubProjectState.tools).length : 0
  const plan = hubProjectState?.sharedPlan

  return {
    tools: {
      total: registry.length,
      stable: registry.filter(a => a.status === 'stable').length,
      beta: registry.filter(a => a.status === 'beta').length,
      adminOnly: registry.filter(a => a.adminOnly).length,
      perCategory: toolsPerCategory(registry),
    },
    users: {
      total: users.length,
      active: users.filter(u => u.active).length,
      admin: users.filter(u => u.role === 'admin').length,
    },
    project: {
      name: hubProjectState?.name ?? null,
      toolsWithState: tools,
      hasSharedPlan: !!(plan && plan.dxf),
      cavidottiCount: plan?.cavidotti.length ?? 0,
      circuitiCount: plan?.circuiti.length ?? 0,
    },
    storageTotalKB,
    storageBreakdownKB,
  }
}
