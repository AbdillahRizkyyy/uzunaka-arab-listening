import { test, expect as baseExpect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const expect = baseExpect.configure({ timeout: 15000 });

test.skip(process.env.E2E_ADMIN !== 'true', 'Opt-in local admin authoring test.');
test.use({
  actionTimeout: 30000,
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['microphone'],
});

test('admin authors all five question types with media and separate navigation', async ({
  page,
  context,
}, info) => {
  test.setTimeout(240000);
  page.on('pageerror', (error) => console.error('Browser:', error.message));
  const title = `QA authoring ${info.project.name} ${Date.now()}`;
  let unitId = '';
  const origin = new URL(process.env.E2E_URL ?? 'http://localhost:3000').origin;
  const post = (path: string, data: unknown) =>
    context.request.post('/api/platform/admin/' + path, { data, headers: { Origin: origin } });
  try {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    const unauth = await context.request.get('/api/admin/media');
    expect(unauth.status()).toBe(401);
    await page.getByLabel('Email', { exact: true }).fill('admin@istima.local');
    await page.getByLabel('Password', { exact: true }).fill('Admin-Istima-2026!');
    await page.getByRole('button', { name: 'Masuk ke dashboard', exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/admin', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Dashboard admin' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Navigasi admin' })).toBeVisible();
    await page.screenshot({
      path: `test-results/admin-dashboard-${info.project.name}.png`,
      fullPage: true,
    });
    await page.getByRole('link', { name: 'Paket materi', exact: true }).click();
    await page.getByRole('button', { name: 'Buat paket', exact: true }).click();
    await page.getByLabel('Judul paket').fill(title);
    await page.getByLabel('Tema', { exact: true }).fill('Kampus');
    await page.getByLabel('Deskripsi', { exact: true }).fill('Paket uji formulir admin');
    await page.getByRole('button', { name: 'Simpan paket' }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const admin = await (await context.request.get('/api/platform/admin')).json();
    unitId = admin.units.find((u: { title: string }) => u.title === title).id;
    await page.getByRole('link', { name: 'Media', exact: true }).click();
    await page
      .getByLabel('Unggah media')
      .setInputFiles({
        name: title + '.wav',
        mimeType: 'audio/wav',
        buffer: await readFile('public/media/test-tone.wav'),
      });
    await expect(page.locator('.admin-media-card').filter({ hasText: title })).toBeVisible();
    await page
      .getByLabel('Unggah media')
      .setInputFiles({
        name: title + '.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx1kAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    await expect(page.locator('.admin-media-card').filter({ hasText: title })).toHaveCount(2);
    await page.getByRole('button', { name: 'Rekam suara', exact: true }).click();
    await expect(page.getByRole('button', { name: /Hentikan/ })).toBeVisible();
    await page.waitForTimeout(1100);
    await page.getByRole('button', { name: /Hentikan/ }).click();
    await expect(page.getByRole('heading', { name: 'Dengarkan rekaman' })).toBeVisible();
    await page.getByRole('button', { name: 'Simpan rekaman', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dengarkan rekaman' })).toHaveCount(0);
    for (const type of ['pilihan_ganda', 'urutkan', 'dikte', 'beda_bunyi', 'pilih_gambar']) {
      await page.goto('/admin/soal?paket=' + unitId);
      await page.getByRole('button', { name: 'Buat soal baru' }).click();
      await page.getByRole('combobox', { name: 'Tipe soal', exact: true }).selectOption(type);
      await page.getByLabel('Kategori keterampilan').fill('Kampus');
      await page.getByLabel('Instruksi soal').fill(title + ' ' + type);
      await page.getByRole('button', { name: 'Tambahkan audio' }).click();
      await page.getByLabel('Cari media').fill(title + '.wav');
      await page.getByRole('button', { name: 'Gunakan media' }).click();
      if (type === 'beda_bunyi') {
        await page.getByRole('button', { name: 'Tambahkan audio' }).click();
        await page.getByLabel('Cari media').fill(title + '.wav');
        await page.getByRole('button', { name: 'Gunakan media' }).click();
      }
      const audioRows = page.locator('.admin-audio-row');
      for (let i = 0; i < (await audioRows.count()); i++) {
        await audioRows.nth(i).getByLabel('Izin penggunaan audio').fill('QA test only');
        await audioRows.nth(i).getByLabel('Direkam penutur native').check();
        await audioRows.nth(i).getByLabel('Pelafalan sudah ditinjau').check();
      }
      if (type === 'dikte') await page.getByLabel('Kunci dikte').fill('أَنَا.');
      else {
        await page
          .getByLabel(type === 'urutkan' ? 'Token 1' : 'Pilihan 1', { exact: true })
          .fill('أَنَا');
        await page
          .getByLabel(type === 'urutkan' ? 'Token 2' : 'Pilihan 2', { exact: true })
          .fill(type === 'urutkan' ? 'أَنَا' : 'هُوَ');
      }
      if (type === 'urutkan') {
        await page.getByRole('button', { name: '+ Tambah urutan alternatif', exact: true }).click();
        await page.getByRole('button', { name: 'Urutan 2 token 2 maju', exact: true }).click();
      }
      if (type === 'pilih_gambar')
        for (let i = 0; i < 2; i++) {
          await page.getByRole('button', { name: 'Pilih gambar', exact: true }).first().click();
          await page.getByLabel('Cari media').fill(title + '.png');
          await page.getByRole('button', { name: 'Gunakan media' }).first().click();
          await page.getByLabel('Izin penggunaan gambar').nth(i).fill('QA local image');
        }
      await page.getByLabel('Transkrip audio').fill('أَنَا.');
      await page.getByLabel('Pembahasan jawaban').fill('Pembahasan uji');
      await page.getByRole('button', { name: 'Pratinjau soal', exact: true }).click();
      await expect(page.locator('.admin-preview')).toBeVisible();
      await page.getByRole('button', { name: 'Tutup pratinjau' }).click();
      await page.getByRole('button', { name: 'Simpan draft', exact: true }).click();
      await expect(page.getByText(title + ' ' + type, { exact: true })).toBeVisible();
    }
    const saved = await (await context.request.get('/api/platform/admin')).json();
    const rows = saved.questions.filter((q: { unitId: string }) => q.unitId === unitId);
    expect(rows).toHaveLength(5);
    const tokens = rows.find((q: { data: { type: string } }) => q.data.type === 'urutkan').data;
    expect(tokens.options[0].id).not.toBe(tokens.options[1].id);
    expect(tokens.accepted).toHaveLength(2);
    // Optimistic versioning rejects stale saves and unit mismatches.
    const first = rows[0].data;
    expect((await post('question', first)).status()).toBe(200);
    expect((await post('question', first)).status()).toBe(409);
    expect((await post('question', { ...rows[1].data, level: 5 })).status()).toBe(400);
    expect(
      (await post('user-role', { userId: saved.currentUserId, role: 'student' })).status(),
    ).toBe(400);
    await page.reload();
    await page.getByRole('button', { name: 'Terbitkan', exact: true }).first().click();
    await expect(page.locator('.admin-status.published')).toHaveCount(1);
    const catalog = await (await context.request.get('/api/platform/catalog')).json();
    expect(catalog.units.find((u: { id: string }) => u.id === unitId).count).toBe(1);
    await page.screenshot({
      path: `test-results/admin-questions-${info.project.name}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const invalidUpload = await context.request.post('/api/admin/media', {
      headers: { Origin: origin },
      multipart: {
        file: {
          name: 'fake.png',
          mimeType: 'image/png',
          buffer: Buffer.from('<script>bad</script>'),
        },
        duration: '1',
      },
    });
    expect(invalidUpload.status()).toBe(400);
  } finally {
    if (unitId) {
      const state = await (await context.request.get('/api/platform/admin')).json();
      for (const row of state.questions.filter((q: { unitId: string }) => q.unitId === unitId)) {
        await post('publish', { id: row.id, publish: false });
        await post('delete-question', { id: row.id });
      }
      await post('delete-unit', { id: unitId });
    }
  }
});

test('student cannot enter admin or mutate content', async ({ page, context }) => {
  await page.goto('/akun');
  await page.getByLabel('Email', { exact: true }).fill('user1@istima.local');
  await page.getByLabel('Password', { exact: true }).fill('User1-Istima-2026!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).last().click();
  await expect(page).toHaveURL((url) => url.pathname === '/');
  await page.goto('/admin/soal');
  await expect(page.getByRole('heading', { name: 'Akses khusus admin' })).toBeVisible();
  expect((await context.request.get('/api/platform/admin')).status()).toBe(403);
  expect((await context.request.get('/api/admin/media')).status()).toBe(403);
  expect(
    (
      await context.request.post('/api/platform/admin/unit', {
        headers: { Origin: new URL(process.env.E2E_URL ?? 'http://localhost:3000').origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
});

