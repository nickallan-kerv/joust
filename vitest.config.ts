import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/game/audio.ts', 'src/game/input.ts', 'src/game/simulation.ts', 'src/game/sprite-mapping.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        statements: 95,
        branches: 85,
        functions: 95,
        lines: 98,
      },
      thresholds: {
        statements: 95,
        branches: 85,
        functions: 95,
        lines: 98,
      },
    },
  },
})