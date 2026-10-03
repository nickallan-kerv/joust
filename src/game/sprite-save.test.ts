import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { saveSpriteJson, spriteSaveMiddleware } from '../../vite-plugin-sprite-save'

let testDirectory: string | undefined

afterEach(async () => {
  if (testDirectory) await rm(testDirectory, { recursive: true, force: true })
  testDirectory = undefined
})

describe('sprite JSON saving', () => {
  it('backs up the current document before overwriting and rotates the backup on later saves', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'joust-sprite-save-'))
    testDirectory = directory
    const filename = 'animation-player.json'
    const original = '{\n  "id": "player",\n  "revision": 1\n}\n'
    const targetPath = join(directory, filename)
    await writeFile(targetPath, original)

    await expect(saveSpriteJson(directory, filename, { id: 'player', revision: 2 })).resolves.toBe(`${filename}.bak`)
    expect(JSON.parse(await readFile(targetPath, 'utf8'))).toEqual({ id: 'player', revision: 2 })
    expect(await readFile(`${targetPath}.bak`, 'utf8')).toBe(original)

    await saveSpriteJson(directory, filename, { id: 'player', revision: 3 })
    expect(JSON.parse(await readFile(`${targetPath}.bak`, 'utf8'))).toEqual({ id: 'player', revision: 2 })
  })

  it('rejects filenames outside the known sprite documents', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'joust-sprite-save-'))
    testDirectory = directory
    await expect(saveSpriteJson(directory, '../package.json', { id: 'player' })).rejects.toThrow(/not allowed/)
  })

  it('writes through the local endpoint and returns the backup filename', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'joust-sprite-save-'))
    testDirectory = directory
    const filename = 'animation-player.json'
    const original = '{"id":"player","revision":1}\n'
    await writeFile(join(directory, filename), original)
    const server = createHttpServer(spriteSaveMiddleware(directory))

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
      })
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('HTTP server did not expose a TCP address.')
      const response = await fetch(`http://127.0.0.1:${address.port}/__sprite-inspector/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ filename, contents: { id: 'player', revision: 2 } }] }),
      })

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ saved: [filename], backups: [`${filename}.bak`] })
      expect(await readFile(join(directory, filename), 'utf8')).toContain('"revision": 2')
      expect(await readFile(join(directory, `${filename}.bak`), 'utf8')).toBe(original)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})