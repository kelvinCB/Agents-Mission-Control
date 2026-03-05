import { test, expect } from '@playwright/test';

test('loads mission control with left side menu and memory search', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.brand')).toHaveText('Mission Control');
  await expect(page.getByRole('button', { name: 'Memory', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Search memory...')).toBeVisible();

  await page.getByRole('button', { name: 'Projects' }).click();
  await expect(page.getByText('Task_Manager')).toBeVisible();
});
