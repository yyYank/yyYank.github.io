import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE = path.resolve(__dirname, '../test/fixtures/sample.mp4');

test('MovieTrimmer trims an mp4 and produces a downloadable blob', async ({ page }) => {
  page.on('pageerror', (err) => console.error('pageerror:', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('console error:', msg.text());
  });

  await page.goto('/movie/');

  const fileInput = page.locator('#movie-upload');
  await fileInput.setInputFiles(SAMPLE);

  await expect(page.locator('video')).toBeVisible();
  await page.waitForFunction(() => {
    const v = document.querySelector('video') as HTMLVideoElement | null;
    return !!v && Number.isFinite(v.duration) && v.duration > 0;
  }, { timeout: 30_000 });

  await page.getByRole('button', { name: 'Trim' }).click();

  await expect(page.getByRole('button', { name: /Download/ })).toBeVisible({
    timeout: 90_000,
  });
});

test('MovToMp4Converter converts an mp4-shaped fixture and produces a downloadable blob', async ({ page }) => {
  page.on('pageerror', (err) => console.error('pageerror:', err.message));

  await page.goto('/movie/');

  const movInput = page.locator('#mov-upload');
  await movInput.setInputFiles(SAMPLE);

  await page.getByRole('button', { name: 'Convert to MP4' }).click();

  await expect(page.getByRole('button', { name: /Download/ }).last()).toBeVisible({
    timeout: 90_000,
  });
});
