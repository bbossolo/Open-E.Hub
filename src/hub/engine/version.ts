/* Estrazione versione dal filename — ora vive nel modulo condiviso
   (src/shared/version.ts), usato anche dai tool. Qui si re-esporta per non
   cambiare i call-site dell'hub e i test (tests/hub). */
export { parseVersionFromFilename } from '../../shared/version'
