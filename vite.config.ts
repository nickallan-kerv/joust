import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { spriteSavePlugin } from './vite-plugin-sprite-save.ts'

const isPagesBuild = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  base: isPagesBuild ? '/joust/' : '/',
  plugins: [spriteSavePlugin(fileURLToPath(new URL('./src/game/sprites/', import.meta.url)))],
  build: {
    rollupOptions: {
      input: {
        game: fileURLToPath(new URL('./index.html', import.meta.url)),
        ...(!isPagesBuild && {
          spriteInspector: fileURLToPath(new URL('./sprite-inspector/index.html', import.meta.url)),
        }),
      },
    },
  },
})