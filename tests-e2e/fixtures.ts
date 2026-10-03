import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { expect, test as base } from '@playwright/test'

async function isAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

export const test = base.extend<{ appUrl: string }>({
  appUrl: async ({}, use) => {
    for (const url of ['http://127.0.0.1:4173', 'http://127.0.0.1:5173']) {
      if (await isAvailable(url)) {
        await use(url)
        return
      }
    }

    const server = await createServer({
      configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
      logLevel: 'error',
      server: { host: '127.0.0.1', port: 0 },
    })
    try {
      await server.listen()
      const address = server.httpServer?.address()
      if (!address || typeof address === 'string') throw new Error('Vite did not expose a TCP address.')
      await use(`http://127.0.0.1:${address.port}`)
    } finally {
      await server.close()
    }
  },
})

export { expect }