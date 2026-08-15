/**
 * DATABASE CAVI CPR
 * Fonti: CEI-UNEL 35716 (FS17) · CEI 20-67 / CEI-UNEL 35318
 * Diametri MASSIMI di catalogo (lato sicurezza per il fill).
 *
 * Dati estratti 1:1 dal monolite phi_v6_12.html (const CABLE_DB).
 */

/** Mappa sezione (mm²) → diametro esterno (mm) per una formazione. */
export type FormSizes = Record<string, number>

/** Una famiglia di cavo: metadati + diametri per formazione ('1x','2G','3G',…). */
export interface CableFamily {
  norm: string
  v: string
  cls: string
  note: string
  form: Record<string, FormSizes>
}

export type CableDb = Record<string, CableFamily>

export const CABLE_DB: CableDb = {
  /* ── CPR · Rame PVC/HEPR (sostituiscono N07V-K, FG7OR, FG7M1) ── */
  'FS17': {
    norm: 'CEI-UNEL 35716', v: '450/750V', cls: 'Cca-s3,d1,a3',
    note: 'Unipolare flessibile PVC · ex N07V-K',
    form: { '1x': {1:2.8,1.5:3.0,2.5:3.7,4:4.2,6:4.6,10:6.1,16:7.3,25:9.0,35:10.1,50:12.1,70:13.7,95:15.9,120:17.1,150:19.2,185:22.0,240:25.2} }
  },
  /* ── CPR · Rame · UNIPOLARI (FG16R16 = senza "O") ── */
  'FG16R16': {
    norm: 'CEI 20-67 / CEI-UNEL 35318', v: '0,6/1kV', cls: 'Cca-s3,d1,a3',
    note: 'HEPR/PVC · ex FG7R · unipolare 0,6/1kV',
    form: { '1x': {1.5:6.4,2.5:7.0,4:7.4,6:8.0,10:9.1,16:10.2,25:11.8,35:13.0,50:14.6,70:16.4,95:18.6,120:20.3,150:22.4,185:24.8,240:28.0,300:31.0,400:35.0,500:39.5,630:44.5} }
  },
  'FG16M16': {
    norm: 'CEI 20-67 (LSZH)', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH · ex FG7M1 · unipolare · ambienti affollati',
    form: { '1x': {1.5:6.4,2.5:7.0,4:7.4,6:8.0,10:9.1,16:10.2,25:11.8,35:13.0,50:14.6,70:16.4,95:18.6,120:20.3,150:22.4,185:24.8,240:28.0,300:31.0,400:35.0,500:39.5,630:44.5} }
  },

  /* ── Unipolari da cablaggio / quadri (rame) ── */
  'FG17': {
    norm: 'CEI-UNEL 35720 / CEI 20-13', v: '450/750V', cls: 'Cca-s3,d1,a3',
    note: 'HEPR senza guaina · unipolare · cablaggio quadri e canalizzazioni',
    form: { '1x': {1.5:3.0,2.5:3.7,4:4.2,6:4.7,10:6.2,16:7.4,25:9.1,35:10.2,50:12.2,70:13.8,95:16.0,120:17.2,150:19.3,185:22.1,240:25.3} }
  },
  'H07Z-K': {
    norm: 'CEI-UNEL 35738 / HD 22.12', v: '450/750V', cls: 'Cca-s1b,d1,a1',
    note: 'LSZH · unipolare flessibile · cablaggi interni senza alogeni',
    form: { '1x': {1.5:3.0,2.5:3.6,4:4.1,6:4.7,10:6.1,16:7.3,25:9.0,35:10.1,50:12.1,70:13.8,95:16.0,120:17.3,150:19.4,185:22.2,240:25.5} }
  },
  'H05Z-K': {
    norm: 'CEI-UNEL 35738 / HD 22.12', v: '300/500V', cls: 'Cca-s1b,d1,a1',
    note: 'LSZH · unipolare flessibile · cablaggi interni di apparecchi',
    form: { '1x': {0.5:2.5,0.75:2.7,1:2.9,1.5:3.1,2.5:3.7} }
  },
  'H07V2-K': {
    norm: 'CEI-UNEL 35752 / HD 21.12', v: '450/750V', cls: 'Cca-s3,d1,a3',
    note: 'PVC 90 °C · unipolare flessibile · alte temperature interne',
    form: { '1x': {1.5:3.1,2.5:3.7,4:4.2,6:4.8,10:6.2,16:7.4,25:9.1,35:10.2,50:12.2,70:13.9,95:16.1,120:17.4,150:19.5,185:22.3,240:25.6} }
  },
  'H05V2-K': {
    norm: 'CEI-UNEL 35752 / HD 21.12', v: '300/500V', cls: 'Cca-s3,d1,a3',
    note: 'PVC 90 °C · unipolare flessibile · interno apparecchiature',
    form: { '1x': {0.5:2.6,0.75:2.8,1:3.0,1.5:3.3,2.5:3.9} }
  },

  /* ── CPR · Rame · MULTIPOLARI (FG16OR16 = con "O") ── */
  'FG16OR16': {
    norm: 'CEI 20-67 / CEI-UNEL 35318', v: '0,6/1kV', cls: 'Cca-s3,d1,a3',
    note: 'HEPR/PVC · ex FG7(O)R · multipolare 0,6/1kV',
    form: {
      '2G': {1.5:12.0,2.5:13.0,4:14.2,6:15.4,10:17.3,16:19.4,25:23.0,35:25.7,50:29.3,70:33.1,95:37.4,120:41.5,150:46.1,185:48.8,240:57.7},
      '3G': {1.5:12.5,2.5:13.6,4:14.9,6:16.2,10:18.2,16:20.6,25:24.5,35:27.3,50:31.2,70:35.6,95:40.4,120:44.4,150:49.5,185:55.2,240:61.9,300:68.0},
      '4G': {1.5:13.4,2.5:14.6,4:16.0,6:17.5,10:19.8,16:22.4,25:26.8,35:30.5,50:33.5,70:38.5,95:43.5,120:48.3,150:54.0,185:58.8,240:67.0},
      '5G': {1.5:14.4,2.5:15.6,4:17.3,6:18.9,10:21.5,16:24.4,25:29.3,35:32.8,50:38.2,70:44.6,95:49.3,120:55.0}
    }
  },
  'FG16OM16': {
    norm: 'CEI 20-67 (LSZH)', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH · ex FG7(O)M1 · multipolare · ambienti affollati',
    form: {
      '2G': {1.5:12.0,2.5:13.0,4:14.2,6:15.4,10:17.3,16:19.4,25:23.0,35:25.7,50:29.3,70:33.1,95:37.4,120:41.5,150:46.1,185:48.8,240:57.7},
      '3G': {1.5:12.5,2.5:13.6,4:14.9,6:16.2,10:18.2,16:20.6,25:24.5,35:27.3,50:31.2,70:35.6,95:40.4,120:44.4,150:49.5,185:55.2,240:61.9,300:68.0},
      '4G': {1.5:13.4,2.5:14.6,4:16.0,6:17.5,10:19.8,16:22.4,25:26.8,35:30.5,50:33.5,70:38.5,95:43.5,120:48.3,150:54.0,185:58.8,240:67.0},
      '5G': {1.5:14.4,2.5:15.6,4:17.3,6:18.9,10:21.5,16:24.4,25:29.3,35:32.8,50:38.2,70:44.6,95:49.3,120:55.0}
    }
  },

  'FS18OR18': {
    norm: 'CEI-UNEL 35718 / CEI 20-22 II', v: '300/500V', cls: 'Cca-s3,d1,a3',
    note: 'PVC · multipolare flessibile · energia e segnalamento · edilizia residenziale',
    form: {
      '2G': {0.5:5.8,0.75:6.2,1:6.6,1.5:7.2,2.5:8.4,4:9.8,6:11.0},
      '3G': {0.5:6.1,0.75:6.5,1:7.0,1.5:7.7,2.5:9.0,4:10.4,6:11.8},
      '4G': {0.5:6.7,0.75:7.1,1:7.6,1.5:8.4,2.5:9.9,4:11.4,6:12.9},
      '5G': {0.5:7.3,0.75:7.8,1:8.4,1.5:9.2,2.5:10.8,4:12.5,6:14.1}
    }
  },

  /* ── CPR · Resistente al fuoco ── */
  'FTG10(O)M1': {
    norm: 'CEI 20-45 / CEI-UNEL 35016', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH resistente al fuoco 850 °C · multipolare · vie di esodo (legacy, vedi FTG18OM16)',
    form: {
      '3G': {1.5:13.0,2.5:14.2,4:15.5,6:17.0,10:19.2,16:21.7,25:25.8,35:28.9,50:33.0,70:37.8,95:42.8,120:47.0,150:52.5,185:58.3,240:65.5},
      '4G': {1.5:14.0,2.5:15.3,4:16.7,6:18.4,10:20.9,16:23.6,25:28.3,35:32.3,50:35.5,70:40.8,95:46.0,120:51.2,150:57.0,185:62.5},
      '5G': {1.5:15.2,2.5:16.5,4:18.3,6:20.0,10:22.8,16:25.8,25:30.8,35:34.5,50:40.5}
    }
  },

  /* ── CPR · Resistente al fuoco · FTG18 (sostituisce FTG10) ── */
  'FTG18OM16': {
    norm: 'CEI 20-45 / EN 50200 · CEI-UNEL 35016', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH resistente al fuoco PH · multipolare · IRAI/EVAC · alimentazioni di sicurezza',
    form: {
      '2G': {1.5:11.5,2.5:12.5,4:14.0,6:15.2},
      '3G': {1.5:13.0,2.5:14.0,4:15.2,6:16.5,10:18.8,16:21.2,25:25.2,35:28.0,50:32.0,70:36.5,95:41.5,120:45.5,150:50.5,185:56.5,240:63.5},
      '4G': {1.5:14.0,2.5:15.0,4:16.5,6:18.0,10:20.5,16:23.0,25:27.5,35:31.0,50:35.0,70:40.0,95:45.5,120:50.5},
      '5G': {1.5:15.0,2.5:16.5,4:18.0,6:19.5,10:22.5,16:25.5,25:30.5,35:34.5,50:39.5}
    }
  },
  'FTG18M16': {
    norm: 'CEI 20-45 / EN 50200 · CEI-UNEL 35016', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH resistente al fuoco PH · unipolare · dorsali di sicurezza',
    form: { '1x': {1.5:9.5,2.5:10.5,4:11.4,6:12.4,10:13.9,16:15.5,25:18.0,35:20.0,50:22.5,70:25.5,95:29.0,120:32.0,150:35.5,185:39.5,240:44.5} }
  },
  'FG16H2M16': {
    norm: 'CEI-UNEL 35016 / CEI 20-105', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH resistente al fuoco (PH) · unipolare · diametri equiparati a FTG18M16 (stessa classe costruttiva, dato conservativo)',
    form: { '1x': {1.5:9.5,2.5:10.5,4:11.4,6:12.4,10:13.9,16:15.5,25:18.0,35:20.0,50:22.5,70:25.5,95:29.0,120:32.0,150:35.5,185:39.5,240:44.5} }
  },
  'FG16OH2M16': {
    norm: 'CEI-UNEL 35016 / CEI 20-105', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH resistente al fuoco (PH) · multipolare · diametri equiparati a FTG18OM16 (stessa classe costruttiva, dato conservativo)',
    form: {
      '2G': {1.5:11.5,2.5:12.5,4:14.0,6:15.2},
      '3G': {1.5:13.0,2.5:14.0,4:15.2,6:16.5,10:18.8,16:21.2,25:25.2,35:28.0,50:32.0,70:36.5,95:41.5,120:45.5,150:50.5,185:56.5,240:63.5},
      '4G': {1.5:14.0,2.5:15.0,4:16.5,6:18.0,10:20.5,16:23.0,25:27.5,35:31.0,50:35.0,70:40.0,95:45.5,120:50.5},
      '5G': {1.5:15.0,2.5:16.5,4:18.0,6:19.5,10:22.5,16:25.5,25:30.5,35:34.5,50:39.5}
    }
  },

  /* ── CPR · Alluminio HEPR ── */
  'ARG16R16': {
    norm: 'CEI 20-67 (alluminio)', v: '0,6/1kV', cls: 'Cca-s3,d1,a3',
    note: 'HEPR/PVC · alluminio · unipolare · montanti e dorsali grandi sezioni',
    form: { '1x': {16:12.5,25:14.1,35:15.7,50:17.5,70:19.2,95:21.9,120:23.9,150:26.3,185:28.8,240:32.1,300:34.8,400:39.5,500:46.5,630:52.5} }
  },
  'ARG16M16': {
    norm: 'CEI 20-67 (alluminio LSZH)', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH · alluminio · unipolare · ambienti affollati · grandi sezioni',
    form: { '1x': {16:12.5,25:14.1,35:15.7,50:17.5,70:19.2,95:21.9,120:23.9,150:26.3,185:28.8,240:32.1,300:34.8,400:39.5,500:46.5,630:52.5} }
  },
  'ARG16OR16': {
    norm: 'CEI 20-67 (alluminio)', v: '0,6/1kV', cls: 'Cca-s3,d1,a3',
    note: 'HEPR/PVC · alluminio CPR · multipolare · posa fissa · grandi sezioni',
    form: {
      '3G': {16:22.0,25:26.0,35:29.0,50:33.5,70:38.2,95:43.0,120:47.5,150:53.0,185:59.2,240:66.3,300:72.8},
      '4G': {16:24.0,25:28.5,35:32.5,50:36.0,70:41.5,95:47.0,120:52.0,150:58.0,185:63.5,240:72.0}
    }
  },
  'ARG16OM16': {
    norm: 'CEI 20-67 (alluminio LSZH)', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH · alluminio CPR · multipolare · ambienti affollati',
    form: {
      '3G': {16:22.5,25:26.5,35:29.5,50:34.0,70:38.8,95:43.5,120:48.2,150:53.8,185:60.0,240:67.0,300:73.5},
      '4G': {16:24.5,25:29.0,35:33.0,50:36.5,70:42.0,95:47.5,120:52.5,150:58.5,185:64.0,240:72.5}
    }
  },

  'AFG16M16': {
    norm: 'CEI 20-67 (alluminio LSZH)', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH · alluminio flessibile cl.5 · unipolare · ambienti affollati',
    form: { '1x': {16:12.5,25:14.1,35:15.7,50:17.5,70:19.2,95:21.9,120:23.9,150:26.3,185:28.8,240:32.1,300:34.8,400:39.5,500:46.5,630:52.5} }
  },
  'AFG16OM16': {
    norm: 'CEI 20-67 (alluminio LSZH)', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'HEPR/LSZH · alluminio flessibile cl.5 · multipolare · locali pubblici e vie di fuga',
    form: {
      '3G': {16:22.5,25:26.5,35:29.5,50:34.0,70:38.8,95:43.5,120:48.2,150:53.8,185:60.0,240:67.0,300:73.5},
      '4G': {16:24.5,25:29.0,35:33.0,50:36.5,70:42.0,95:47.5,120:52.5,150:58.5,185:64.0,240:72.5}
    }
  },
  'ARG7R': {
    norm: 'CEI 20-13 / IEC 60502 (legacy)', v: '0,6/1kV', cls: '—',
    note: 'HEPR/PVC · alluminio · multipolare · legacy aggiornato CPR (vedi ARG16OR16)',
    form: {
      '3G': {16:22.0,25:26.0,35:29.0,50:33.5,70:38.2,95:43.0,120:47.5,150:53.0,185:59.2,240:66.3,300:72.8},
      '4G': {16:24.0,25:28.5,35:32.5,50:36.0,70:41.5,95:47.0,120:52.0,150:58.0,185:63.5,240:72.0}
    }
  },

  /* ── Fotovoltaico (CPR · EN 50618) ── */
  'H1Z2Z2-K': {
    norm: 'EN 50618 / IEC 62930', v: '1,5kV DC', cls: 'Cca-s1b,d1,a1',
    note: 'Cavo solare rame stagnato · LSZH reticolato · resistente UV/ozono · moduli FV-inverter',
    form: { '1x': {1.5:4.9,2.5:5.4,4:6.6,6:7.4,10:8.8,16:10.1,25:12.5,35:14.0,50:16.0,70:18.0,95:20.5,120:22.5,150:25.0,185:28.0,240:31.0} }
  },
  'FG21M21': {
    norm: 'CEI 20-91 / EN 50618', v: '1,5kV DC', cls: 'Cca-s1b,d1,a1',
    note: 'Cavo solare rame · alte prestazioni al fuoco · stringhe e collegamenti FV',
    form: { '1x': {1.5:4.9,2.5:5.4,4:6.6,6:7.4,10:8.8,16:10.1,25:12.5,35:14.0,50:16.0,70:18.0,95:20.5,120:22.5,150:25.0,185:28.0,240:31.0} }
  },
  '1Z2Z2-AK': {
    norm: 'EN 50618 (alluminio)', v: '1,5kV DC', cls: 'Cca-s1b,d1,a1',
    note: 'Cavo solare alluminio · LSZH reticolato · grandi impianti FV',
    form: { '1x': {16:11.0,25:13.0,35:14.8,50:16.8,70:18.8,95:21.5,120:23.5,150:26.0,185:29.0,240:32.5} }
  },

  /* ── Silicone · Alta temperatura ── */
  'N07G9-K': {
    norm: 'CEI-UNEL 35752 / HD 21.3', v: '450/750V', cls: 'Cca-s3,d1,a3',
    note: 'Silicone 180 °C · alta temperatura · flessibile unipolare',
    form: {
      '1x': {0.5:2.8,0.75:3.0,1:3.4,1.5:3.8,2.5:4.4,4:5.1,6:5.8,10:7.3,16:8.7,25:10.5,35:11.8,50:13.8,70:15.8,95:18.0,120:20.2}
    }
  },
  'SiHF': {
    norm: 'VDE 0282-4 / HD 22.4', v: '300/500V', cls: '—',
    note: 'Silicone flessibile multipolare · 180 °C · quadri e macchine',
    form: {
      '1x': {0.5:2.8,0.75:3.0,1:3.4,1.5:3.8,2.5:4.4,4:5.1,6:5.8,10:7.3,16:8.7},
      '2x': {0.5:7.5,0.75:7.9,1:8.5,1.5:9.3,2.5:10.8,4:12.2,6:13.8},
      '3G': {0.5:8.1,0.75:8.5,1:9.2,1.5:10.1,2.5:11.7,4:13.3,6:15.1,10:18.5},
      '4G': {0.5:9.0,0.75:9.5,1:10.3,1.5:11.3,2.5:13.1,4:14.9,6:17.0,10:21.0},
      '5G': {0.5:10.0,0.75:10.5,1:11.4,1.5:12.5,2.5:14.6,4:16.6,6:19.0,10:23.5}
    }
  },

  /* ── Gomma / Cantieri (non sostituiti da CPR per usi mobili) ── */
  'H07RN-F': {
    norm: 'CEI 20-19/4 · IEC 60245-4', v: '450/750V', cls: '—',
    note: 'Gomma/neoprene · ambienti difficili · uso mobile · cantieri · non per posa fissa permanente',
    form: {
      '1x': {1.5:5.5,2.5:6.2,4:7.0,6:8.0,10:9.8,16:11.5,25:14.0,35:15.8,50:18.0,70:21.0,95:24.0,120:27.0},
      '2x': {1.5:11.2,2.5:12.5,4:14.0,6:16.0,10:19.5,16:22.5},
      '3G': {1.5:11.5,2.5:13.0,4:14.8,6:16.8,10:20.5,16:23.5,25:28.5,35:32.5,50:37.5,70:44.5,95:50.0,120:55.5},
      '4G': {1.5:12.5,2.5:14.0,4:16.2,6:18.5,10:22.5,16:26.0,25:31.5,35:36.0,50:41.0,70:49.5,95:55.0},
      '5G': {1.5:13.5,2.5:15.2,4:17.5,6:20.0,10:24.5,16:28.5,25:34.0,35:39.0,50:45.0}
    }
  },
  'H05RN-F': {
    norm: 'CEI 20-19/2 · IEC 60245-2', v: '300/500V', cls: '—',
    note: 'Gomma leggera · uso domestico mobile · proluunghe · non per posa fissa',
    form: {
      '1x': {0.5:3.2,0.75:3.5,1:3.8,1.5:4.3},
      '2x': {0.5:7.5,0.75:8.0,1:8.5,1.5:9.5,2.5:11.0,4:12.8},
      '3G': {0.5:8.0,0.75:8.5,1:9.0,1.5:10.0,2.5:11.8,4:13.5,6:15.5},
      '4G': {0.75:9.5,1:10.2,1.5:11.2,2.5:13.0,4:15.0},
      '5G': {0.75:10.5,1:11.2,1.5:12.2,2.5:14.5,4:16.8}
    }
  },
  'H07BQ-F': {
    norm: 'EN 50525-2-21 · CEI 20-19', v: '450/750V', cls: 'Cca-s1b,d1,a1',
    note: 'Poliuretano (PUR) · multipolare · alta resistenza meccanica · posa fissa e mobile gravosa',
    form: {
      '3G': {1.5:11.5,2.5:13.0,4:14.8,6:16.8,10:20.5,16:23.5,25:28.5,35:32.5,50:37.5},
      '4G': {1.5:12.5,2.5:14.0,4:16.2,6:18.5,10:22.5,16:26.0,25:31.5,35:36.0},
      '5G': {1.5:13.5,2.5:15.2,4:17.5,6:20.0,10:24.5,16:28.5,25:34.0}
    }
  },
  'FROR': {
    norm: 'EN 50525-2-51 · CEI 20-22 II', v: '450/750V', cls: '—',
    note: 'Flessibile PVC · CEI 20-22 II · cantieri · ambienti bagnati · uso temporaneo',
    form: {
      '2x': {1.5:11.5,2.5:12.8,4:14.5,6:16.5},
      '3G': {1.5:12.0,2.5:13.5,4:15.2,6:17.2,10:21.0,16:24.5,25:29.5,35:34.0},
      '4G': {1.5:13.2,2.5:14.8,4:16.8,6:19.2,10:23.5,16:27.5,25:33.5},
      '5G': {1.5:14.2,2.5:16.0,4:18.2,6:21.0,10:25.5,16:30.0}
    }
  },
  'FROR-F': {
    norm: 'EN 50525-2-51 · CEI 20-22 IV', v: '450/750V', cls: '—',
    note: 'PVC rinforzato · cantieri pesanti · gru · sollevamento',
    form: {
      '3G': {1.5:13.0,2.5:14.5,4:16.5,6:18.8,10:23.0,16:27.0,25:32.5,35:37.5,50:43.5,70:52.0,95:59.5},
      '4G': {1.5:14.2,2.5:16.0,4:18.2,6:21.0,10:25.5,16:30.0,25:36.5,35:42.0},
      '5G': {1.5:15.4,2.5:17.4,4:19.8,6:23.0,10:28.0,16:33.0,25:40.0}
    }
  },

  /* ── XLPE · Rame (non sostituito da sigla CPR specifica) ── */
  'N1XV': {
    norm: 'CEI-UNEL 35011 / HD 603', v: '0,6/1kV', cls: '—',
    note: 'XLPE/PVC · rame · posa fissa · sezioni medio-alte · non sostitutito da sigla CPR',
    form: {
      '1x': {1.5:5.8,2.5:6.5,4:7.2,6:8.0,10:9.5,16:10.9,25:12.8,35:14.3,50:16.2,70:18.3,95:21.0,120:23.3,150:26.0,185:28.8,240:32.5,300:36.0,400:40.8,500:46.5,630:53.0},
      '3G': {1.5:10.0,2.5:11.0,4:12.2,6:13.5,10:15.5,16:17.8,25:21.5,35:24.0,50:27.5,70:31.5,95:36.0,120:40.0,150:44.5,185:50.0,240:56.5,300:63.0},
      '4G': {1.5:11.0,2.5:12.0,4:13.4,6:14.9,10:17.2,16:19.8,25:24.0,35:26.8,50:30.5,70:35.0,95:40.0,120:44.5,150:49.5,185:55.5},
      '5G': {1.5:12.0,2.5:13.2,4:14.7,6:16.4,10:19.0,16:21.9,25:26.7,35:29.8,50:34.0,70:39.5,95:45.0,120:50.0}
    }
  },

  /* ── Alluminio · PVC (non CPR) ── */
  'NAYY': {
    norm: 'CEI-UNEL 35375 / HD 603', v: '0,6/1kV', cls: '—',
    note: 'PVC/PVC · conduttore in alluminio · posa fissa · economico per grandi sezioni',
    form: {
      '1x': {16:13.0,25:14.8,35:16.5,50:18.7,70:21.5,95:24.2,120:26.8,150:29.8,185:33.0,240:37.5,300:42.0,400:47.7,500:54.0,630:61.0},
      '3G': {16:27.5,25:31.2,35:34.5,50:39.5,70:45.5,95:51.5,120:57.0,150:63.5,185:70.5,240:80.0,300:89.0},
      '4G': {16:30.0,25:34.0,35:38.0,50:43.5,70:50.0,95:57.5,120:63.0,150:70.0,185:78.0,240:89.0}
    }
  },
  'NA2XRY': {
    norm: 'CEI-UNEL 35375 / IEC 60502', v: '0,6/1kV', cls: '—',
    note: 'XLPE/PVC armato · alluminio · interrato diretto · posa meccanicamente sollecitata',
    form: {
      '1x': {16:20.5,25:22.0,35:23.8,50:26.0,70:28.8,95:32.0,120:34.8,150:38.0,185:41.8,240:46.8,300:51.5,400:57.5,500:64.5,630:72.5},
      '3G': {16:36.5,25:40.5,35:44.5,50:49.5,70:56.5,95:63.5,120:69.5,150:76.5,185:85.0,240:95.0,300:105.0},
      '4G': {16:40.0,25:44.5,35:49.0,50:54.5,70:62.0,95:70.0,120:77.0,150:85.0,185:94.0,240:106.0}
    }
  },
  'NA2XY': {
    norm: 'CEI-UNEL 35375 / IEC 60502', v: '0,6/1kV', cls: '—',
    note: 'XLPE/PVC · alluminio · senza armatura · posa in tubo o cunicolo',
    form: {
      '1x': {16:13.5,25:15.3,35:17.0,50:19.2,70:22.0,95:24.8,120:27.5,150:30.5,185:33.8,240:38.3,300:42.8,400:48.5,500:55.0,630:62.5},
      '3G': {16:29.0,25:33.0,35:36.5,50:41.5,70:47.5,95:54.0,120:59.5,150:66.0,185:73.5,240:83.0,300:93.0},
      '4G': {16:32.0,25:36.5,35:40.5,50:46.0,70:53.0,95:60.0,120:66.5,150:73.5,185:82.5,240:93.5}
    }
  },

  /* ── Minerale · MICC ── */
  'MICC EM2': {
    norm: 'IEC 60702-1 · BS 6207', v: '500/750V', cls: '—',
    note: 'Minerale isolato · rame · 1000 °C · impianti antincendio · compatto e robusto',
    form: {
      '1x': {1.5:5.5,2.5:5.9,4:6.5,6:7.2,10:8.5,16:10.0,25:12.0,35:13.5,50:15.5,70:17.5,95:20.0,120:22.0},
      '2x': {1.5:7.0,2.5:8.0,4:9.0,6:10.2,10:12.5,16:14.5,25:17.5},
      '3G': {1.5:7.5,2.5:8.5,4:9.5,6:11.0,10:13.5,16:15.8,25:19.2,35:22.0,50:25.5},
      '4G': {1.5:8.0,2.5:9.2,4:10.5,6:12.0,10:14.8,16:17.5,25:21.5,35:25.0},
      '7x': {1.5:10.5,2.5:12.0,4:14.0,6:16.5,10:20.0}
    }
  },

  /* ── BT Armato · Rame ── */
  'FG7R': {
    norm: 'CEI-UNEL 35023 / IEC 60502', v: '0,6/1kV', cls: '—',
    note: 'HEPR/PVC armato rame · posa interrata diretta o in presenza di sforzi meccanici',
    form: {
      '1x': {4:16.0,6:17.0,10:18.5,16:20.2,25:22.5,35:25.0,50:27.8,70:31.0,95:35.0,120:38.0,150:42.5,185:46.5,240:52.5,300:58.0,400:65.5},
      '3G': {1.5:21.0,2.5:22.5,4:24.0,6:26.0,10:29.0,16:32.5,25:37.5,35:42.0,50:47.5,70:54.5,95:61.5,120:67.5,150:75.0,185:84.0,240:95.0},
      '4G': {1.5:22.5,2.5:24.2,4:26.0,6:28.2,10:31.8,16:35.5,25:41.5,35:46.5,50:52.5,70:60.0,95:68.5,120:75.0,150:83.5,185:93.0}
    }
  },
  'N2XH': {
    norm: 'HD 605 / IEC 60502', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'XLPE/LSZH · rame · CPR · ambienti affollati · alternativa LSZH a FG16OM16',
    form: {
      '1x': {1.5:8.0,2.5:8.8,4:9.7,6:10.7,10:12.3,16:14.0,25:16.5,35:18.5,50:21.0,70:23.8,95:27.0,120:30.0,150:33.5,185:37.0,240:42.0,300:46.5,400:53.0,500:60.5,630:69.0},
      '3G': {1.5:11.5,2.5:12.5,4:13.8,6:15.2,10:17.5,16:20.0,25:23.8,35:26.8,50:30.5,70:35.2,95:40.0,120:44.5,150:49.5,185:55.5,240:63.0,300:70.0},
      '4G': {1.5:12.5,2.5:13.8,4:15.2,6:16.8,10:19.5,16:22.2,25:26.5,35:29.8,50:34.0,70:39.2,95:44.8,120:50.0,150:55.5,185:62.0,240:70.5},
      '5G': {1.5:13.8,2.5:15.2,4:16.8,6:18.5,10:21.5,16:24.5,25:29.3,35:33.0,50:37.8,70:44.0,95:50.5,120:56.0}
    }
  },
  'N2XRH': {
    norm: 'HD 605 / IEC 60502', v: '0,6/1kV', cls: 'Cca-s1b,d1,a1',
    note: 'XLPE/LSZH armato · rame · CPR · posa interrata diretta',
    form: {
      '1x': {4:17.2,6:18.4,10:20.0,16:22.0,25:24.5,35:27.0,50:30.0,70:33.5,95:37.5,120:41.0,150:45.5,185:50.0,240:56.5,300:62.5,400:70.5},
      '3G': {1.5:22.5,2.5:24.0,4:25.8,6:28.0,10:31.5,16:35.0,25:40.5,35:45.5,50:51.5,70:59.0,95:66.5,120:73.5,150:82.0,185:91.5,240:103.0},
      '4G': {1.5:24.0,2.5:26.0,4:28.0,6:30.5,10:34.5,16:38.5,25:45.0,35:50.5,50:57.0,70:65.5,95:74.0,120:82.0}
    }
  }
}

/** Raggruppamenti famiglie per le optgroup del select (UI). */
export const FAM_GROUPS: Record<string, string[]> = {
  'CPR · Rame · Unipolari':    ['FS17','FG16R16','FG16M16'],
  'Unipolari · cablaggio':     ['FG17','H07Z-K','H05Z-K','H07V2-K','H05V2-K'],
  'CPR · Rame · Multipolari':  ['FG16OR16','FG16OM16','FS18OR18','N2XH','N2XRH'],
  'CPR · Resistente al fuoco': ['FTG18OM16','FTG18M16','FTG10(O)M1'],
  'CPR · Alluminio':           ['ARG16R16','ARG16M16','ARG16OR16','ARG16OM16','AFG16M16','AFG16OM16','ARG7R'],
  'Fotovoltaico':              ['H1Z2Z2-K','FG21M21','1Z2Z2-AK'],
  'Silicone · Alta temp.':     ['N07G9-K','SiHF'],
  'Gomma / Cantieri':          ['H07RN-F','H05RN-F','H07BQ-F','FROR','FROR-F'],
  'XLPE / PVC · Rame':         ['N1XV','FG7R'],
  'Alluminio (non CPR)':       ['NAYY','NA2XRY','NA2XY'],
  'Minerale antincendio':      ['MICC EM2']
}

/** Famiglia del DB per una sigla (match esatto, case-insensitive). */
export function famigliaCavo(sigla: unknown): CableFamily | null {
  const s = String(sigla ?? '').trim().toUpperCase()
  if (!s) return null
  for (const [k, v] of Object.entries(CABLE_DB)) {
    if (k.toUpperCase() === s) return v
  }
  return null
}

/**
 * Vero se la famiglia esiste a catalogo SOLO come unipolare (unica formazione '1x'):
 * es. FS17, FG16R16, H07Z-K. Conta perché un cavo unipolare si computa a metri di
 * CONDUTTORE: un circuito di 100 m con 6 conduttori sono 600 m di cavo.
 * Le famiglie che hanno anche 2G/3G/… (FG16OR16, FROR, …) sono multipolari: un cavo
 * multipolare da 100 m resta 100 m, qualunque sia il numero di anime.
 * `null` = famiglia sconosciuta (non decidibile dal catalogo).
 */
export function isFamigliaUnipolare(sigla: unknown): boolean | null {
  const fam = famigliaCavo(sigla)
  if (!fam) return null
  const forms = Object.keys(fam.form)
  return forms.length === 1 && forms[0] === '1x'
}
