import { randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const spriteDocumentIds = new Map([
  ['atlas-joust.json', 'joust'],
  ['animation-player.json', 'player'],
  ['animation-bounder.json', 'bounder'],
  ['animation-hunter.json', 'hunter'],
])

interface SaveRequest {
  files: Array<{ filename: string; contents: unknown }>
}

export class SpriteSaveInputError extends Error {}

function validateSaveRequest(value: unknown): SaveRequest {
  if (typeof value !== 'object' || value === null || !('files' in value) || !Array.isArray(value.files)) {
    throw new SpriteSaveInputError('Expected a files array.')
  }
  if (value.files.length === 0 || value.files.length > spriteDocumentIds.size) {
    throw new SpriteSaveInputError('The save must contain between one and four sprite files.')
  }

  const names = new Set<string>()
  for (const file of value.files) {
    if (typeof file !== 'object' || file === null || !('filename' in file) || !('contents' in file)) {
      throw new SpriteSaveInputError('Each saved item must include a filename and contents.')
    }
    const filename = file.filename
    if (typeof filename !== 'string' || !spriteDocumentIds.has(filename)) {
      throw new SpriteSaveInputError('The requested sprite filename is not allowed.')
    }
    if (names.has(filename)) throw new SpriteSaveInputError(`Duplicate sprite filename "${filename}".`)
    names.add(filename)
    if (typeof file.contents !== 'object' || file.contents === null || Array.isArray(file.contents)) {
      throw new SpriteSaveInputError(`Contents for "${filename}" must be a JSON object.`)
    }
    if (!('id' in file.contents) || file.contents.id !== spriteDocumentIds.get(filename)) {
      throw new SpriteSaveInputError(`Contents do not match sprite filename "${filename}".`)
    }
  }
  return value as SaveRequest
}

export async function saveSpriteJson(directory: string, filename: string, contents: unknown): Promise<string> {
  const request = validateSaveRequest({ files: [{ filename, contents }] })
  const file = request.files[0]
  const target = join(resolve(directory), file.filename)
  const backup = `${target}.bak`
  const temporary = `${target}.${randomUUID()}.tmp`
  const serialized = `${JSON.stringify(file.contents, null, 2)}\n`

  await writeFile(temporary, serialized, { flag: 'wx' })
  try {
    await rm(backup, { force: true })
    await rename(target, backup)
    try {
      await rename(temporary, target)
    } catch (error) {
      await rename(backup, target)
      throw error
    }
  } finally {
    await rm(temporary, { force: true })
  }
  return `${file.filename}.bak`
}

async function readRequest(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 256 * 1024) throw new SpriteSaveInputError('Save request is too large.')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new SpriteSaveInputError('Save request is not valid JSON.')
  }
}

function respond(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

export function spriteSaveMiddleware(spriteDirectory: string): RequestListener {
  return (request, response) => {
        if (request.method !== 'POST') {
          respond(response, 405, { error: 'Use POST to save sprite JSON.' })
          return
        }
        const origin = request.headers.origin
        const host = request.headers.host
        if (origin && host && new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
          respond(response, 403, { error: 'Cross-origin sprite saves are not allowed.' })
          return
        }
        if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
          respond(response, 415, { error: 'Sprite saves require application/json.' })
          return
        }

        void (async () => {
          const save = validateSaveRequest(await readRequest(request))
          const backups: string[] = []
          for (const file of save.files) {
            backups.push(await saveSpriteJson(spriteDirectory, file.filename, file.contents))
          }
          respond(response, 200, { saved: save.files.map((file) => file.filename), backups })
        })().catch((error: unknown) => {
          respond(response, error instanceof SpriteSaveInputError ? 400 : 500, {
            error: error instanceof Error ? error.message : 'Sprite JSON save failed.',
          })
        })
  }
}

export function spriteSavePlugin(spriteDirectory: string): Plugin {
  return {
    name: 'joust-sprite-json-save',
    configureServer(server) {
      server.middlewares.use('/__sprite-inspector/save', spriteSaveMiddleware(spriteDirectory))
    },
  }
}