import { expect, test } from './fixtures'

test('inspects animation frames and mounted rider composition data', async ({ page, appUrl }) => {
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  await page.getByLabel('Mount', { exact: true }).selectOption('bounder')
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
  await expect(page.getByRole('spinbutton', { name: 'Rider offset Y' })).toHaveValue('-15')

  await page.getByRole('button', { name: 'Next frame' }).click()
  await expect(page.locator('#mapping-details')).toContainText('1 of 4')

  await page.getByRole('button', { name: 'Fly' }).click()
  await expect(page.locator('#mapping-details')).toContainText('flyLeft')
  await expect(page.locator('#mapping-details')).toContainText('42 × 40 px')
})

test('edits the Player native-facing rider composition', async ({ page, appUrl }) => {
  await page.goto(new URL('/sprite-inspector/', appUrl).toString())
  const composition = page.getByLabel('Show rider composition')
  await expect(composition).toBeEnabled()
  await expect(composition).toBeChecked()
  await expect(page.locator('#mapping-details')).toContainText('riderPlayerRight')
  await expect(page.getByRole('spinbutton', { name: 'Rider X' })).toHaveValue('398')
  await expect(page.getByRole('spinbutton', { name: 'Rider offset Y' })).toHaveValue('-15')

  await page.getByRole('button', { name: 'Increase Rider X by one' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Rider X' })).toHaveValue('399')
  await page.getByRole('button', { name: 'Undo last edit' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Rider X' })).toHaveValue('398')
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
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
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
  await expect(page.getByLabel('Mount', { exact: true })).toHaveValue('player')

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