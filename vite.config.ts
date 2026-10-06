import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { spriteSavePlugin } from './vite-plugin-sprite-save.ts'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/joust/' : '/',
  plugins: [spriteSavePlugin(fileURLToPath(new URL('./src/game/sprites/', import.meta.url)))],
  build: {
    rollupOptions: {
      input: {
        game: fileURLToPath(new URL('./index.html', import.meta.url)),
        spriteInspector: fileURLToPath(new URL('./sprite-inspector/index.html', import.meta.url)),
      },
    },
  },
})