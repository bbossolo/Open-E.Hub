/**
 * Open E.Hub è un tool self-hosted per un singolo studio, offline-first: NON
 * esiste (e non esisterà) un'edizione 'server'/SaaS multi-azienda — quella
 * resta nel prodotto privato da cui questa repo deriva. Qui c'è solo l'app
 * desktop/statica: .exe Electron o build HTML aperta dal browser, senza
 * login, senza API, senza sessione. Questo file non porta più un flag da
 * controllare a runtime: se serve distinguere un comportamento, non è
 * un'edizione diversa, è semplicemente un'altra funzione.
 */

/** Avviso d'uso per il .exe desktop NON firmato (toast all'avvio della sola app Electron). */
export const UNSIGNED_NOTICE = 'uso interno · build non firmata'
