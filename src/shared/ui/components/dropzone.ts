/* Drop-zone condivisa Open E.Hub — collega drag&drop + click-per-sfogliare su un
   elemento esistente (di solito con classe `.ehb-dropzone`). Nessuna dipendenza. */

export interface DropzoneOptions {
  /** Filtro file input (es. ".ldt,.xlsx"). */
  accept?: string
  /** Permette selezione multipla (default true). */
  multiple?: boolean
  /** Classe applicata durante il dragover (default 'ehb-dropzone--over'). */
  overClass?: string
}

/**
 * Rende `el` una drop-zone: click apre il selettore file, drag&drop accetta i
 * file; in entrambi i casi invoca `onFiles`. Ritorna una funzione di teardown.
 */
export function makeDropzone(
  el: HTMLElement,
  onFiles: (files: FileList) => void,
  opts: DropzoneOptions = {},
): () => void {
  const { accept, multiple = true, overClass = 'ehb-dropzone--over' } = opts

  const input = document.createElement('input')
  input.type = 'file'
  input.hidden = true
  if (accept) input.accept = accept
  input.multiple = multiple
  el.appendChild(input)

  const onClick = () => input.click()
  const onChange = () => {
    if (input.files && input.files.length) onFiles(input.files)
    input.value = '' // consente di ricaricare lo stesso file
  }
  const onOver = (e: DragEvent) => {
    e.preventDefault()
    el.classList.add(overClass)
  }
  const onLeave = () => el.classList.remove(overClass)
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    el.classList.remove(overClass)
    if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files)
  }

  el.addEventListener('click', onClick)
  input.addEventListener('change', onChange)
  el.addEventListener('dragover', onOver)
  el.addEventListener('dragleave', onLeave)
  el.addEventListener('drop', onDrop)

  return () => {
    el.removeEventListener('click', onClick)
    input.removeEventListener('change', onChange)
    el.removeEventListener('dragover', onOver)
    el.removeEventListener('dragleave', onLeave)
    el.removeEventListener('drop', onDrop)
    input.remove()
  }
}
