import type { Tour } from '../../../shared/ui/components/tour'

export const DELTA_TOUR: Tour = {
  id: 'delta',
  steps: [
    {
      selector: '#dTabTemplate',
      title: 'Scegli e prepara il template',
      text: 'Carica il modello di copertina dello studio (PDF o immagine) o applicane uno dalla libreria: diventa lo sfondo su cui aggiungere e posizionare i campi, fissi e variabili — apri «Editor campi» per lavorarci.',
    },
    {
      selector: '#dTabElenco',
      title: 'Importa l\'elenco',
      text: 'Un elaborato per riga da CSV/Excel — anche con più fogli o righe di preambolo, δ trova da solo la tabella giusta. Una copertina per riga.',
    },
    {
      selector: '#dTabGenera',
      title: 'Genera i PDF',
      text: 'Anteprima copertina per copertina, poi «Genera copertine»: un PDF vero per ogni elaborato, tutti in uno ZIP.',
    },
  ],
}
