import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.resolve(__dirname, '../dist')
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 4173)
const basePath = '/tintedtasks'

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, headers)
  response.end(body)
}

async function resolveFilePath(urlPath) {
  if (urlPath === '/' || urlPath === '') {
    return null
  }

  if (!urlPath.startsWith(basePath)) {
    return undefined
  }

  const relativePath = urlPath.slice(basePath.length).replace(/^\/+/, '')
  const requestedPath = relativePath ? path.resolve(distDir, relativePath) : path.resolve(distDir, 'index.html')

  if (!requestedPath.startsWith(distDir)) {
    return undefined
  }

  try {
    const fileStat = await stat(requestedPath)
    if (fileStat.isFile()) {
      return requestedPath
    }
  } catch {
    // Fall through to SPA fallback.
  }

  if (path.extname(requestedPath)) {
    return undefined
  }

  return path.resolve(distDir, 'index.html')
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    send(response, 400, 'Bad Request')
    return
  }

  const url = new URL(request.url, `http://${host}:${port}`)

  if (url.pathname === '/') {
    response.writeHead(302, { Location: `${basePath}/` })
    response.end()
    return
  }

  const filePath = await resolveFilePath(url.pathname)

  if (filePath === undefined) {
    send(response, 404, 'Not Found')
    return
  }

  if (filePath === null) {
    response.writeHead(302, { Location: `${basePath}/` })
    response.end()
    return
  }

  const extension = path.extname(filePath)
  const contentType = contentTypes.get(extension) || 'application/octet-stream'
  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' })
  createReadStream(filePath).pipe(response)
})

server.listen(port, host, () => {
  console.log(`Release server running at http://${host}:${port}${basePath}/`)
})
