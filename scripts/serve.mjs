// Server statico locale, zero dipendenze — serve la root del repo così
// EHub.html può caricare i tool via fetch (da file:// i browser lo bloccano
// per CORS sui moduli). Solo per uso offline in locale: nessun bind esterno.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = process.cwd()
const PORT = Number(process.env.PORT) || 8080

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.gz': 'application/gzip',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  if (path === '/' || path === '') path = '/EHub.html'
  const file = join(ROOT, path)
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return }
  try {
    const st = await stat(file)
    if (st.isDirectory()) { res.writeHead(404); res.end('Not found'); return }
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404); res.end('Not found')
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Open E.Hub in locale: http://127.0.0.1:${PORT}/EHub.html`)
})
