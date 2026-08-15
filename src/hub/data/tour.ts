import type { Tour } from '../../shared/ui/components/tour'

export const HUB_TOUR: Tour = {
  id: 'home',
  steps: [
    {
      selector: '#brand-mark',
      title: 'Benvenuto in Open E.Hub',
      text: 'È la suite di strumenti per la progettazione impiantistica: ogni tool copre un pezzo del flusso e si passano dati fra loro senza doverli ridigitare.',
    },
    {
      selector: '#search-wrap',
      title: 'Cerca un tool',
      text: 'Digita per filtrare l’elenco qui sotto, o premi / per metterti subito a fuoco sulla ricerca.',
    },
    {
      selector: '#welcome-cards',
      title: 'I tool, raggruppati per tema',
      text: 'Le card sono raggruppate per area (progettazione, computo, documenti…). Clicca una card per aprire quel tool.',
    },
    {
      selector: '#side-proj',
      title: 'Progetto Open E.Hub',
      text: 'Salva/Apri un file .ehub per portarti dietro lo stato di tutti i tool insieme. "Nuovo progetto" riparte da zero.',
    },
    {
      selector: '.side-proj-btn--guide',
      title: 'La Guida resta sempre qui',
      text: 'Da qui puoi riaprire la guida rapida e rivedere questo tour quando vuoi.',
    },
  ],
}
