// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { miuSource } from './miu-src'

/**
 * Bug: cliccando "Categorizza" sul binario, il pannello Categorizza si apriva
 * correttamente ma il binario evidenziava "Misura".
 *
 * Causa: in openCart(), _syncRail() decideva il passo guardando CART_VIEW
 * (la vista TABELLA/ELENCO dentro il carrello) invece di CART_MODE (misura vs
 * categorizza, impostata da setStep()). Da quando la vista "categorie" è stata
 * rimossa da cartViewSwitchHtml() (oggi CART_VIEW vale solo 'tabella'|'elenco',
 * vedi computo.js), la condizione `CART_VIEW==='categorie'` non è mai vera:
 * il binario finiva SEMPRE su "misura", anche in modalità Categorizza.
 *
 * Convenzione dei test DOM di μ: contratto sulla sorgente inline (miuSource()),
 * come search-wiring.test.ts.
 */

const html = miuSource()

describe('binario — "Categorizza" evidenzia il passo giusto (non più "Misura")', () => {
  it('openCart() sincronizza il binario su CART_MODE, non su CART_VIEW', () => {
    const openCart = html.slice(html.indexOf('function openCart('), html.indexOf('function removeFromCart('))
    expect(openCart).toContain("_syncRail(CART_MODE==='categorizza' ? 'categorizza' : 'misura')")
    expect(openCart).not.toMatch(/_syncRail\(CART_VIEW/)
  })

  it("setStep('misura') non contiene più il controllo morto su CART_VIEW==='categorie'", () => {
    const setStep = html.slice(html.indexOf('function setStep('), html.indexOf('function openExport('))
    expect(setStep).not.toContain("CART_VIEW==='categorie'")
  })

  it('replica logica: con CART_MODE=categorizza il rail sincronizza su "categorizza" qualunque sia CART_VIEW', () => {
    function railStepFor(cartMode: string, cartView: string): string {
      // mirror esatto della riga corretta in openCart()
      void cartView // CART_VIEW non deve più influenzare questa decisione
      return cartMode === 'categorizza' ? 'categorizza' : 'misura'
    }
    expect(railStepFor('categorizza', 'tabella')).toBe('categorizza')
    expect(railStepFor('categorizza', 'elenco')).toBe('categorizza')
    expect(railStepFor('misura', 'tabella')).toBe('misura')
    expect(railStepFor('misura', 'elenco')).toBe('misura')
  })
})
