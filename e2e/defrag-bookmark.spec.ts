import { test, expect } from '@playwright/test';

test('記事URLのブックマーク取得でプレビューが表示される', async ({ page }) => {
  await page.goto('/defrag/');

  // ブックマークシートを開く
  await page.getByRole('button', { name: '🔖' }).click();

  // URLを入力して取得
  const input = page.locator('.dfg-titleinput');
  await input.fill('https://example.com');
  await page.getByRole('button', { name: '取得' }).click();

  // プレビューが表示されるか、エラーが出るかを確認
  const preview = page.locator('.dfg-tweetpreview');
  const error = page.locator('.dfg-tweeterr');

  await expect(preview.or(error)).toBeVisible({ timeout: 15_000 });

  // エラーが出ていないことを検証（プロキシが生きていること）
  await expect(error).not.toBeVisible();
  await expect(preview).toBeVisible();
});
