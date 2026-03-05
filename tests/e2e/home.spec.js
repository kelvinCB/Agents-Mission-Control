import { test, expect } from '@playwright/test';

test('loads mission control with left side menu and memory search', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mission Control', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Memory', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Search memory...')).toBeVisible();
  await expect(page.getByText('Drag & drop .md files here')).toBeVisible();

  await page.getByRole('button', { name: 'Projects' }).click();
  await expect(page.getByText('Task_Manager')).toBeVisible();
});

test('memory accordion and add-agent modal interactions', async ({ page }) => {
  await page.goto('/');

  const etivenHeader = page.getByRole('button', { name: /Etiven/ }).first();
  await expect(etivenHeader).toBeVisible();

  // collapse + expand (header keeps working)
  await etivenHeader.click();
  await etivenHeader.click();
  await expect(page.getByRole('button', { name: 'main-memory.md Etiven' })).toBeVisible();

  await page.getByRole('button', { name: 'Agregar Agente' }).click();
  await expect(page.getByRole('heading', { name: 'Add Agent' })).toBeVisible();

  await page.getByPlaceholder('Agent name').fill('Etiven');
  await page.getByRole('button', { name: 'Add Agent' }).click();
  await expect(page.getByText('This agent already exists.')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Add Agent')).not.toBeVisible();
});
