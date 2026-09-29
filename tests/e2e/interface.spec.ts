import { test, expect } from '@playwright/test';
test('catalog navigation, level detail, and responsive layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ahlan, selamat datang.' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Lima langkah, lebih banyak makna.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Jumlah Murakkabah/ }).click();
  await expect(page.getByRole('button', { name: 'Tutup', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/catalog-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Mulai tes penempatan' }).click();
  await expect(page).toHaveURL(/\/akun/);
});
test('registration and live forms have required inputs', async ({ page }) => {
  await page.goto('/akun');
  await page.getByRole('button', { name: 'Daftar akun', exact: true }).click();
  await expect(page.getByLabel('Nama', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveAttribute('minlength', '12');
  await page.goto('/live?code=ABC234');
  await expect(page.getByLabel('Kode ruang')).toHaveValue('ABC234');
  await expect(page.getByRole('heading', { name: 'Gabung sesi' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('private routes do not expose assessment material', async ({ request }) => {
  const response = await request.get('/api/platform/attempts/nonexistent');
  expect([401, 503]).toContain(response.status());
  expect(await response.text()).not.toContain('accepted');
  const admin = await request.get('/api/platform/admin');
  expect([401, 503]).toContain(admin.status());
});
