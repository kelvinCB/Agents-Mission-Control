import { test, expect } from '@playwright/test';

test('loads mission control and project cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Agents Mission Control' })).toBeVisible();
  await expect(page.getByText('Task_Manager')).toBeVisible();
});
