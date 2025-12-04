import { test, expect } from '@playwright/test'

test('editor shell loads timeline', async ({ page }) => {
  await page.goto('/#/app')
  await expect(page.getByText('Timeline')).toBeVisible()
  await expect(page.getByText('Inspector')).toBeVisible()
  await expect(page.getByText('Project')).toBeVisible()
})
