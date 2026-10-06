import { expect, test } from './fixtures'

test.beforeEach(async ({ page, appUrl }) => {
  await page.goto(new URL('/', appUrl).toString())
})

test('keeps the game canvas full-window without external page furniture', async ({ page }) => {
  const canvas = page.locator('#gameCanvas')
  const bounds = await canvas.boundingBox()

  expect(bounds).not.toBeNull()
  expect(bounds?.x).toBe(0)
  expect(bounds?.y).toBe(0)
  expect(Math.abs((bounds?.width ?? 0) - await page.evaluate(() => innerWidth))).toBeLessThan(1)
  expect(Math.abs((bounds?.height ?? 0) - await page.evaluate(() => innerHeight))).toBeLessThan(1)
  await expect(page.locator('header, aside, button')).toHaveCount(0)

  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > innerWidth,
    vertical: document.documentElement.scrollHeight > innerHeight,
  }))
  expect(overflow).toEqual({ horizontal: false, vertical: false })
})

test('loads the bundled title artwork on the start screen', async ({ page }) => {
  let titleArtworkRequested = false
  await page.route('**/assets/joust-title.webp', async (route) => {
    titleArtworkRequested = true
    await route.continue()
  })
  await page.reload()
  await expect.poll(() => titleArtworkRequested).toBe(true)
  await expect(page.locator('#gameCanvas')).toHaveAttribute('aria-label', /Mode: title/)
})

test('starts a run with Enter and exposes the current state accessibly', async ({ page }) => {
  const canvas = page.locator('#gameCanvas')
  await expect(canvas).toHaveAttribute('aria-label', /Mode: title/)
  await canvas.focus()
  await page.keyboard.press('Enter')
  await expect(canvas).toHaveAttribute('aria-label', /Mode: playing\. Player facing right\. Wave 1/)
})

test('spawns early-wave fire across the surface and animates vertical-only flight', async ({ page }) => {
  await page.waitForLoadState('networkidle')
  const renderingChecks = await page.evaluate(async () => {
    const simulation = await import('/src/game/simulation.ts')
    const { renderGame } = await import('/src/game/renderer.ts')
    const { spriteAnimations, spriteAtlases } = await import('/src/game/sprite-data.ts')
    const game = simulation.createGameState()
    simulation.startGame(game)
    game.enemies = []
    game.player.materializeTimer = 0
    game.player.x = 480
    game.player.y = 250
    game.player.vx = 0
    game.player.vy = -90
    const canvas = document.createElement('canvas')
    canvas.width = 960
    canvas.height = 540
    const context = canvas.getContext('2d')!
    const draws: number[][] = []
    const drawImage = context.drawImage.bind(context)
    ;(context as unknown as { drawImage: (...args: unknown[]) => void }).drawImage = (...args) => {
      if (args.length === 9) {
        const [, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight] = args as [
          CanvasImageSource, number, number, number, number, number, number, number, number,
        ]
        draws.push([sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight])
      }
      drawImage(...args as [CanvasImageSource, number, number, number, number, number, number, number, number])
    }

    for (let second = 0; second < 60; second += 1) {
      game.time = second + 0.1
      renderGame(context, game)
    }
    const fireFrames = Array.from({ length: 7 }, (_, index) => spriteAtlases.joust.frames[`animatedFire${index + 1}`])
    const centralFireCenters = draws
      .filter(([x, y, width, height]) => fireFrames.some((frame) => frame.x === x && frame.y === y && frame.width === width && frame.height === height))
      .map(([, , , , x, , width]) => x + width / 2)
      .filter((x) => x > 240 && x < 720)

    const flyRight = spriteAnimations.player.strips.flyRight
    game.time = 0.1
    renderGame(context, game)
    game.time = 0.2
    renderGame(context, game)
    const verticalFlightFrames = [...new Set(draws
      .filter(([, y, width, height]) => y === flyRight.y && width === flyRight.frameWidth && height === flyRight.frameHeight)
      .map(([x]) => x)
      .filter((x) => x >= flyRight.x && x < flyRight.x + flyRight.count * flyRight.frameWidth))]
    return { centralFireCenters, verticalFlightFrames }
  })
  expect(renderingChecks.centralFireCenters.length).toBeGreaterThan(0)
  expect(renderingChecks.verticalFlightFrames.length).toBe(2)
})

test('shows lava beneath the translucent Score HUD', async ({ page }) => {
  const canvas = page.locator('#gameCanvas')
  await canvas.focus()
  await page.keyboard.press('Enter')
  await expect(canvas).toHaveAttribute('aria-label', /Mode: playing/)

  const lavaPixels = await canvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const context = canvas.getContext('2d')!
    const sample = (gameX: number, gameY: number) => {
      const x = Math.floor(canvas.width * gameX / 960)
      const y = Math.floor(canvas.height * gameY / 540)
      return Array.from(context.getImageData(x, y, 1, 1).data)
    }
    return {
      belowSurface: [320, 400, 480, 560, 640].map((x) => sample(x, 520)),
      surface: [320, 400, 480, 560, 640].map((x) => sample(x, 508)),
    }
  })
  for (const [red, green, blue] of lavaPixels.belowSurface) {
    expect(red).toBeGreaterThan(green)
    expect(green).toBeGreaterThan(blue)
  }
  for (const [red, green, blue] of lavaPixels.surface) {
    expect(red).toBeGreaterThan(160)
    expect(green).toBeGreaterThan(150)
    expect(blue).toBeLessThan(130)
  }
})

test('keeps the raised lava surface after Wave 3 when the game ends', async ({ page }) => {
  const lavaPixel = await page.evaluate(async () => {
    const simulation = await import('/src/game/simulation.ts')
    const { renderGame } = await import('/src/game/renderer.ts')
    const game = simulation.createGameState()
    simulation.startGame(game)
    game.enemies = []
    game.mode = 'gameover'
    game.player.lives = 0
    game.lavaSurfaceY = 475
    const canvas = document.createElement('canvas')
    canvas.width = 960
    canvas.height = 540
    const context = canvas.getContext('2d')!
    renderGame(context, game)
    return Array.from(context.getImageData(500, 480, 1, 1).data)
  })

  expect(lavaPixel[0]).toBeGreaterThan(lavaPixel[1])
})

test('updates player facing in both steering directions', async ({ page }) => {
  const canvas = page.locator('#gameCanvas')
  await canvas.focus()
  await page.keyboard.press('Enter')
  await expect(canvas).toHaveAttribute('aria-label', /Mode: playing/)

  await page.keyboard.down('ArrowLeft')
  await expect(canvas).toHaveAttribute('aria-label', /Player facing left/)
  await page.keyboard.up('ArrowLeft')

  await page.keyboard.down('ArrowRight')
  await expect(canvas).toHaveAttribute('aria-label', /Player facing right/)
  await page.keyboard.up('ArrowRight')
})

test('fits a narrow viewport without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const canvas = page.locator('#gameCanvas')
  const bounds = await canvas.boundingBox()

  expect(bounds).not.toBeNull()
  expect(Math.abs((bounds?.width ?? 0) - await page.evaluate(() => innerWidth))).toBeLessThan(1)
  expect(Math.abs((bounds?.height ?? 0) - await page.evaluate(() => innerHeight))).toBeLessThan(1)

  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > innerWidth,
    vertical: document.documentElement.scrollHeight > innerHeight,
  }))
  expect(overflow).toEqual({ horizontal: false, vertical: false })
})