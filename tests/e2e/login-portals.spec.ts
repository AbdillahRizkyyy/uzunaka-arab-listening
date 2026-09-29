import { test, expect } from '@playwright/test';
test.skip(process.env.E2E_ADMIN !== 'true', 'Requires local dummy accounts.');
test('separate login portals validate roles and redirect logout', async ({ page, context }) => {
  test.setTimeout(120000);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Masuk sebagai admin' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Daftar akun' })).toHaveCount(0);
  await page.getByLabel('Email', { exact: true }).fill('user1@istima.local');
  await page.getByLabel('Password', { exact: true }).fill('User1-Istima-2026!');
  await page.getByRole('button', { name: 'Masuk ke dashboard' }).click();
  await expect(page.locator('.notice[role=alert]')).toContainText('tidak memiliki akses admin', {
    timeout: 20000,
  });
  expect((await context.request.get('/api/platform/admin')).status()).toBe(401);
  await page.getByRole('link', { name: 'Login pengguna biasa' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/akun');
  await page.getByLabel('Email', { exact: true }).fill('admin@istima.local');
  await page.getByLabel('Password', { exact: true }).fill('Admin-Istima-2026!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).last().click();
  await expect(page.locator('.notice[role=alert]')).toContainText('Gunakan halaman login admin.');
  expect((await context.request.get('/api/platform/admin')).status()).toBe(401);
  await page.getByRole('link', { name: 'Login admin', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel('Email', { exact: true }).fill('admin@istima.local');
  await page.getByLabel('Password', { exact: true }).fill('Admin-Istima-2026!');
  await page.screenshot({ path: 'test-results/login-admin.png' });
  await page.getByRole('button', { name: 'Masuk ke dashboard' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/admin', { timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Dashboard admin' })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('button', { name: 'Keluar', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByRole('link', { name: 'Login pengguna biasa' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/akun');
  await page.getByLabel('Email', { exact: true }).fill('user1@istima.local');
  await page.getByLabel('Password', { exact: true }).fill('User1-Istima-2026!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).last().click();
  await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 20000 });
  expect((await context.request.get('/api/platform/admin')).status()).toBe(403);
});
