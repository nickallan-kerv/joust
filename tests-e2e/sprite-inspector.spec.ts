import { expect, test } from './fixtures'

test('inspects animation frames and mounted rider composition data', async ({ page, appUrl }) => {
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByLabel('Sprite', { exact: true }).selectOption('bounder')
  await page.getByRole('button', { name: 'Pause animation' }).click()
  await page.getByRole('button', { name: '← Left' }).click()

  await expect(page.locator('#details-title')).toHaveText('Bounder walk left')
    const startX = Number(await page.getByRole('spinbutton', { name: 'Start X' }).inputValue())
    const startY = Number(await page.getByRole('spinbutton', { name: 'Start Y' }).inputValue())
    const frameWidth = Number(await page.getByRole('spinbutton', { name: 'Frame width' }).inputValue())
    const frameHeight = Number(await page.getByRole('spinbutton', { name: 'Frame height' }).inputValue())
    const frameCount = Number(await page.getByRole('spinbutton', { name: 'Frame count' }).inputValue())
    await expect(page.locator('#mapping-details').locator('[data-summary="start"]')).toHaveText(`(${startX}, ${startY})`)
    await expect(page.locator('#mapping-details').locator('[data-summary="stop"]')).toHaveText(
      `(${startX + frameWidth * frameCount}, ${startY + frameHeight})`,
    )
  await expect(page.locator('#mapping-details')).toContainText('riderBounderLeft')
  await expect(page.getByRole('spinbutton', { name: 'Rider offset Y' })).toHaveValue('-17')

  await page.getByRole('button', { name: 'Next frame' }).click()
  await expect(page.locator('#mapping-details')).toContainText('1 of 4')

  await page.getByRole('button', { name: 'Fly' }).click()
  await expect(page.locator('#mapping-details')).toContainText('flyLeft')
  await expect(page.locator('#mapping-details')).toContainText('42 × 32 px')
})

test('inspects the pterodactyl as a three-frame mount without rider composition', async ({ page, appUrl }) => {
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByRole('button', { name: 'Pause animation' }).click()
  await page.getByLabel('Sprite', { exact: true }).selectOption('pterodactyl')

  await expect(page.locator('#details-title')).toHaveText('Pterodactyl fly right')
  await expect(page.locator('#motion-controls')).toBeHidden()
  await expect(page.getByLabel('Show rider composition')).toBeHidden()
  await expect(page.getByLabel('Animation frame')).toHaveAttribute('max', '2')
  await expect(page.locator('#mapping-details')).toContainText('0 of 2')
  await expect(page.locator('#mapping-details')).toContainText('pterodactylFlyLeft1')

  await page.getByRole('button', { name: '← Left' }).click()
  await expect(page.locator('#details-title')).toHaveText('Pterodactyl fly left')
  await page.getByRole('button', { name: 'Next frame' }).click()
  await expect(page.locator('#mapping-details')).toContainText('1 of 2')
  await expect(page.locator('#mapping-details')).toContainText('pterodactylFlyLeft2')
})

test('inspects the egg movement and hatching sequence', async ({ page, appUrl }) => {
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByRole('button', { name: 'Pause animation' }).click()
  await page.getByLabel('Sprite', { exact: true }).selectOption('egg')

  await expect(page.locator('#details-title')).toHaveText('Egg stationary')
  await expect(page.getByLabel('Animation frame')).toHaveAttribute('max', '5')
  await expect(page.locator('#motion-controls')).toBeHidden()
  await expect(page.locator('#facing-controls')).toBeHidden()
  await expect(page.getByLabel('Show rider composition')).toBeHidden()

  for (const [index, frameName, pose] of [
    [0, 'eggStationary', 'Stationary'],
    [1, 'eggRollingRight', 'Rolling right'],
    [2, 'eggRollingLeft', 'Rolling left'],
    [3, 'eggHatching1', 'Hatching 1'],
    [4, 'eggHatching2', 'Hatching 2'],
    [5, 'eggHatching3', 'Hatching 3'],
  ] as const) {
    await expect(page.locator('#mapping-details')).toContainText(frameName)
    await expect(page.locator('#mapping-details')).toContainText(`${index} of 5`)
    await expect(page.locator('#details-title')).toHaveText(`Egg ${pose.toLowerCase()}`)
    if (index < 5) await page.getByRole('button', { name: 'Next frame' }).click()
  }
})

test('edits the Player native-facing rider composition', async ({ page, appUrl }) => {
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  const composition = page.getByLabel('Show rider composition')
  await expect(composition).toBeEnabled()
  await expect(composition).toBeChecked()
  await expect(page.locator('#mapping-details')).toContainText('riderPlayerRight')
  await expect(page.getByRole('spinbutton', { name: 'Rider X' })).toHaveValue('405')
  await expect(page.getByRole('spinbutton', { name: 'Rider offset Y' })).toHaveValue('-17')

  await page.getByRole('button', { name: 'Increase Rider X by one' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Rider X' })).toHaveValue('406')
  await page.getByRole('button', { name: 'Undo last edit' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Rider X' })).toHaveValue('405')
})

test('groups rider composition coordinates and paired dimensions on shared rows', async ({ page, appUrl }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByRole('button', { name: 'Pause animation' }).click()

  const topOf = (label: string) => page.getByText(label, { exact: true }).evaluate((element) => element.getBoundingClientRect().top)
  expect(await topOf('Rider X')).toBeGreaterThan(await topOf('Rider frame'))
  for (const [first, second] of [
    ['Rider X', 'Rider Y'],
    ['Rider crop width', 'Rider crop height'],
    ['Rider offset X', 'Rider offset Y'],
    ['Mount draw width', 'Mount draw height'],
    ['Rider draw width', 'Rider draw height'],
  ]) {
    expect(await topOf(first)).toBe(await topOf(second))
  }
})

test('inspects atlas crop bounds and adapts to a narrow viewport', async ({ page, appUrl }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByRole('tab', { name: 'Atlas' }).click()
  await expect(page.locator('#details-title')).toHaveText('Entire Atlas')
  await expect(page.locator('#mapping-details')).toContainText('Animation frames')
  await expect(page.locator('#preview-note')).toHaveText('Mapped crops outlined by atlas and mount class')
  await page.getByLabel('Atlas view').selectOption('platformStandard')

  await expect(page.locator('#details-title')).toHaveText('Platform Standard')
    const startX = Number(await page.getByRole('spinbutton', { name: 'Start X' }).inputValue())
    const startY = Number(await page.getByRole('spinbutton', { name: 'Start Y' }).inputValue())
    const width = Number(await page.getByRole('spinbutton', { name: 'Crop width' }).inputValue())
    const height = Number(await page.getByRole('spinbutton', { name: 'Crop height' }).inputValue())
    await expect(page.locator('#mapping-details').locator('[data-summary="start"]')).toHaveText(`(${startX}, ${startY})`)
    await expect(page.locator('#mapping-details').locator('[data-summary="stop"]')).toHaveText(`(${startX + width}, ${startY + height})`)
  await expect(page.locator('#source-file')).toHaveText('atlas-joust.json')
    await page.getByLabel('Atlas view').selectOption('platformSpawnWide')
    await expect(page.locator('#details-title')).toHaveText('Platform Spawn Wide')
    await expect(page.getByRole('spinbutton', { name: 'Start X' })).toHaveValue('185')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('selects platform sprites directly from the Sprite selector', async ({ page, appUrl }) => {
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByLabel('Sprite', { exact: true }).selectOption('platformSpawnWide')

  await expect(page.locator('#preview-title')).toHaveText('Platform Spawn Wide')
  await expect(page.locator('#details-title')).toHaveText('Platform Spawn Wide')
  await expect(page.getByLabel('Motion state')).toBeHidden()
  await expect(page.getByLabel('Facing direction')).toBeHidden()
  await expect(page.getByLabel('Show rider composition')).toBeHidden()
  await expect(page.getByLabel('Animation frame')).toBeDisabled()
  await expect(page.getByRole('spinbutton', { name: 'Start X' })).toHaveValue('185')
  await expect(page.getByRole('spinbutton', { name: 'Crop width' })).toHaveValue('176')

  await page.getByLabel('Sprite', { exact: true }).selectOption('platformLong')
  await expect(page.locator('#preview-title')).toHaveText('Platform Long')
  await expect(page.getByRole('spinbutton', { name: 'Start X' })).toHaveValue('0')
  await expect(page.getByRole('spinbutton', { name: 'Start Y' })).toHaveValue('67')
  await expect(page.getByRole('spinbutton', { name: 'Crop width' })).toHaveValue('374')
  await expect(page.getByRole('spinbutton', { name: 'Crop height' })).toHaveValue('4')
})

test('keeps the Source rect row stable when animation frame digits change', async ({ page, appUrl }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByRole('button', { name: 'Pause animation' }).click()
  await page.getByRole('button', { name: 'Fly' }).click()

  const sourceRect = page.locator('[data-summary="source-rect"]')
  await expect(sourceRect).toHaveCSS('white-space', 'nowrap')
  const firstHeight = await sourceRect.evaluate((element) => element.getBoundingClientRect().height)
  await page.getByRole('button', { name: 'Next frame' }).click()
  const secondHeight = await sourceRect.evaluate((element) => element.getBoundingClientRect().height)
  expect(secondHeight).toBe(firstHeight)
})

test('edits, undoes, and saves a mapping JSON document', async ({ page, appUrl }) => {
  let savedFiles: Array<{ filename: string; contents: { id: string; strips?: { walkRight?: { frameWidth?: number } } } }> = []
  await page.route('**/__sprite-inspector/save', async (route) => {
    const body = route.request().postDataJSON() as { files: typeof savedFiles }
    savedFiles = body.files
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ saved: savedFiles.map((file) => file.filename), backups: ['animation-player.json.bak'] }),
    })
  })
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await expect(page.getByRole('button', { name: 'Save JSON' })).toBeDisabled()

  const frameWidth = Number(await page.getByRole('spinbutton', { name: 'Frame width' }).inputValue())
  const frameCount = Number(await page.getByRole('spinbutton', { name: 'Frame count' }).inputValue())
  const frameHeight = Number(await page.getByRole('spinbutton', { name: 'Frame height' }).inputValue())
  const [startX, startY] = (await page.locator('#mapping-details').locator('[data-summary="start"]').innerText())
    .match(/\d+/g)!
    .map(Number)

  await page.getByRole('button', { name: 'Pause animation' }).click()
  await page.locator('#frame-range').focus()
  await page.locator('#frame-range').press('End')
  await page.getByLabel('Magnification').focus()
  await page.getByLabel('Magnification').press('End')

  await page.getByRole('button', { name: 'Increase Frame width by one' }).click()
  await expect(page.locator('#mapping-details').locator('[data-summary="stop"]')).toHaveText(
    `(${startX + (frameWidth + 1) * frameCount}, ${startY + frameHeight})`,
  )
  await expect(page.getByRole('button', { name: 'Save JSON' })).toBeEnabled()
  await page.getByRole('button', { name: 'Undo last edit' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Frame width' })).toHaveValue(String(frameWidth))
  await expect(page.locator('#mapping-details').locator('[data-summary="stop"]')).toHaveText(
    `(${startX + frameWidth * frameCount}, ${startY + frameHeight})`,
  )
  await expect(page.getByRole('button', { name: 'Save JSON' })).toBeDisabled()

  await page.getByRole('button', { name: 'Decrease Frame width by one' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Frame width' })).toHaveValue(String(frameWidth - 1))
  await page.getByRole('button', { name: 'Undo last edit' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Frame width' })).toHaveValue(String(frameWidth))

  await page.getByRole('spinbutton', { name: 'Frame width' }).fill(String(frameWidth + 1))
  await page.getByRole('button', { name: 'Save JSON' }).click()
  expect(savedFiles).toHaveLength(1)
  expect(savedFiles[0].filename).toBe('animation-player.json')
  expect(savedFiles[0].contents.strips?.walkRight?.frameWidth).toBe(frameWidth + 1)
  await expect(page.locator('#editor-status')).toHaveText('Saved 1 JSON file; .json.bak backup created')
  await expect(page.locator('#details-title')).toHaveText('Player walk right')
  await expect(page.getByLabel('Sprite', { exact: true })).toHaveValue('player')

  await page.reload()
  await expect(page.locator('#details-title')).toHaveText('Player walk right')
  await expect(page.getByRole('spinbutton', { name: 'Frame width' })).toHaveValue(String(frameWidth + 1))
  await expect(page.locator('#frame-range')).toHaveValue('4')
  await expect(page.getByLabel('Magnification')).toHaveValue('12')
  await expect(page.getByRole('button', { name: 'Save JSON' })).toBeEnabled()
})

test('resumes after an edit only when playback was already active', async ({ page, appUrl }) => {
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByRole('spinbutton', { name: 'Frame width' }).fill('43')
  await expect(page.locator('#play-toggle')).toHaveText('Play')
  await expect(page.locator('#play-toggle')).toHaveText('Pause', { timeout: 2000 })

  await page.getByRole('button', { name: 'Pause animation' }).click()
  await page.getByRole('spinbutton', { name: 'Frame width' }).fill('44')
  await page.waitForTimeout(650)
  await expect(page.locator('#play-toggle')).toHaveText('Play')
})

test('keeps the preview canvas viewport-sized until sprite bounds exceed it', async ({ page, appUrl }) => {
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByLabel('Show rider composition').uncheck()
  const zoom = page.getByLabel('Magnification')
  await zoom.focus()
  await zoom.press('Home')

  const lowZoom = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('#canvas-viewport')!
    const canvas = document.querySelector<HTMLCanvasElement>('#sprite-canvas')!
    return { viewport: [viewport.clientWidth, viewport.clientHeight], canvas: [canvas.width, canvas.height] }
  })
  expect(lowZoom.canvas).toEqual(lowZoom.viewport)

  await zoom.press('End')
  const highZoom = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('#canvas-viewport')!
    const canvas = document.querySelector<HTMLCanvasElement>('#sprite-canvas')!
    return { viewport: [viewport.clientWidth, viewport.clientHeight], canvas: [canvas.width, canvas.height] }
  })
    const frameWidth = Number(await page.getByRole('spinbutton', { name: 'Frame width' }).inputValue())
    const frameHeight = Number(await page.getByRole('spinbutton', { name: 'Frame height' }).inputValue())
    expect(highZoom.canvas[0]).toBe(Math.max(highZoom.viewport[0], frameWidth * 12 + 128))
    expect(highZoom.canvas[1]).toBe(Math.max(highZoom.viewport[1], frameHeight * 12 + 128))
})

test('maps and saves individual bitmap font glyph crops', async ({ page, appUrl }) => {
  let savedFiles: Array<{ filename: string; contents: { font?: { glyphs?: Record<string, { x?: number }> } } }> = []
  await page.route('**/__sprite-inspector/save', async (route) => {
    const body = route.request().postDataJSON() as { files: typeof savedFiles }
    savedFiles = body.files
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ saved: savedFiles.map((file) => file.filename), backups: ['atlas-joust.json.bak'] }),
    })
  })
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByRole('tab', { name: 'Font' }).click()
  await expect(page.getByLabel('Magnification')).toHaveValue('12')
  await expect(page.getByLabel('Pixel grid')).toBeChecked()
  await page.getByLabel('Font character').selectOption('000')

  await expect(page.locator('#details-title')).toHaveText('Glyph 000 · single character')
  const startX = Number(await page.getByRole('spinbutton', { name: 'Start X' }).inputValue())
  const cropWidth = Number(await page.getByRole('spinbutton', { name: 'Crop width' }).inputValue())
  await expect(page.getByRole('spinbutton', { name: 'Start Y' })).toHaveValue('389')
  expect(cropWidth).toBeGreaterThan(0)
  await expect(page.getByRole('spinbutton', { name: 'Crop height' })).toHaveValue('10')

  await page.getByRole('button', { name: 'Increase Start X by one' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Start X' })).toHaveValue(String(startX + 1))
  await page.getByRole('button', { name: 'Undo last edit' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Start X' })).toHaveValue(String(startX))

  await page.getByRole('spinbutton', { name: 'Start X' }).fill(String(startX + 1))
  await page.getByRole('button', { name: 'Save JSON' }).click()
  expect(savedFiles).toHaveLength(1)
  expect(savedFiles[0].filename).toBe('atlas-joust.json')
  expect(savedFiles[0].contents.font?.glyphs?.['000']?.x).toBe(startX + 1)
})