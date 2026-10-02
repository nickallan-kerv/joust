import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
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
  await expect(canvas).toHaveAttribute('aria-label', /Mode: playing\. Wave 1/)
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