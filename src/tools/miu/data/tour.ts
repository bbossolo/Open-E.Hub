import type { Tour } from '../../../shared/ui/components/tour'

export const MIU_TOUR: Tour = {
  id: 'miu',
  steps: [
    {
      selector: '#miu-rail',
      title: 'I 4 passi del lavoro',
      text: 'Cerca o componi → Misura → Categorizza → Esporta. Clicca un passo (o i tasti 1–4) per spostarti; Esc torna a Cerca.',
    },
    {
      selector: '#archive-list',
      title: 'Carica un prezzario',
      text: 'Da qui apri uno o più prezzari regionali: puoi tenerne aperti più di uno insieme. Servono a consultare e a pescare le voci.',
    },
    {
      selector: '#search-input',
      title: 'Cerca in linguaggio naturale',
      text: 'Scrivi come lo chiami tu — «passerella a filo», «tubo corrugato» — non serve la dicitura esatta del prezzario.',
    },
    {
      selector: '#btn-add-sel',
      title: 'Aggiungi al computo',
      text: 'Seleziona le voci e premi qui: ne finisce una COPIA nel computo. Cambiare o svuotare la ricerca non te le toglie più.',
    },
    {
      selector: '#componi-btn',
      title: 'Componi una descrizione',
      text: 'Se il prezzario non ha la voce che ti serve, componila dalle famiglie — con Σ Analisi Prezzi ne calcoli anche il prezzo.',
    },
    {
      selector: '#cart-btn',
      title: 'Il Computo Metrico',
      text: "Qui misuri le voci e trovi l'Elenco Prezzi del progetto. Ogni voce è modificabile (✎): cambi descrizione e prezzo sulla TUA copia, il prezzario resta intatto.",
    },
    {
      selector: '#ampere-btn',
      title: 'Lista cavi da Ampère',
      text: 'Importa un export Ampère (o trascinalo qui): le lunghezze diventano le quantità e i cavi si agganciano da soli alle voci di prezzario. Gli unipolari sono già moltiplicati per i conduttori, e ogni linea eredita il suo quadro come Sottocategoria.',
    },
    {
      selector: '#guide-btn',
      title: 'La Guida resta sempre qui',
      text: 'Da qui riapri la guida completa e rivedi questo tour quando vuoi.',
    },
  ],
}
