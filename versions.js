/**
 * FONTE DI VERITÀ delle versioni Open E.Hub. Caricato dall'hub (browser)
 * e dagli script (Node). NON modificare a mano: usare `npm run bump`.
 */
(function (root) {
  var V = {
    "app": {
      "name": "Open E.Hub",
      "version": "1.0.2"
    },
    "developer": {
      "name": "Davide Bottura",
      "github": "https://github.com/bbossolo",
      "badge": ""
    }
  }

  if (typeof window !== 'undefined') root.EHUB_VERSIONS = V
  if (typeof module !== 'undefined' && module.exports) module.exports = V
})(typeof window !== 'undefined' ? window : this)
