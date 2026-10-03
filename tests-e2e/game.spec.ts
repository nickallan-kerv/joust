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

test('starts a run with Enter and exposes the current state accessibly', async ({ page }) => {
  const canvas = page.locator('#gameCanvas')
  await expect(canvas).toHaveAttribute('aria-label', /Mode: title/)
  await canvas.focus()
  await page.keyboard.press('Enter')
  await expect(canvas).toHaveAttribute('aria-label', /Mode: playing\. Player facing right\. Wave 1/)
})

test('updates player facing in both steering directions', async ({ page }) => {
  const canvas = page.locator('#gameCanvas')
  await canvas.focus()
  await page.keyboard.press('Enter')
  await expect(canvas).toHaveAttribute('aria-label', /Mode: playing/)

  await page.keyboard.press('ArrowLeft')
  await expect(canvas).toHaveAttribute('aria-label', /Player facing left/)

  await page.keyboard.press('ArrowRight')
  await expect(canvas).toHaveAttribute('aria-label', /Player facing right/)
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