import { test, expect } from '@playwright/test'

test('editor shell renders panels', async ({ page }) => {
  await page.goto('/#/app')
  await expect(page.getByText('Timeline')).toBeVisible()
  await expect(page.getByText('Inspector')).toBeVisible()
  const projectLabel = page.getByText('Project')
  await expect(projectLabel).toBeVisible()
  await page.getByRole('button', { name: /Hide assets/i }).click()
  await expect(projectLabel).not.toBeVisible({ timeout: 2000 })
})
