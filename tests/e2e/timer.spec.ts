import { test, expect } from '@playwright/test';

test.describe('App rendering and mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/emom-timer/');
  });

  test('Has expected title and initial state', async ({ page }) => {
    await expect(page).toHaveTitle(/EMOM Timer/);
    await expect(page.locator('#start-btn')).toBeVisible();
    await expect(page.locator('#start-btn')).toHaveText('Start');
  });

  test('Can toggle settings panel and switch modes', async ({ page }) => {
    // Open settings
    await page.locator('#settings-toggle').click();
    await expect(page.locator('#settings-panel')).toBeVisible();

    // Select Fartlek
    await page.locator('#timer-mode-select').selectOption('fartlek');

    // Activity type should have auto-mapped to Running! (Value 8)
    await expect(page.locator('#activity-type-select')).toHaveValue('8');

    // Close settings
    await page.locator('#close-settings-btn').click();

    // Interval display should remain visible after mode switch
    await expect(page.locator('#interval-display')).toBeVisible();
  });
});
