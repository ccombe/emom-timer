import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility scanning', () => {
  test('Main timer view should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/emom-timer/');
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    // We expect 0 violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Settings panel should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/emom-timer/');
    // Open settings first
    await page.locator('#settings-toggle').click();
    await expect(page.locator('#settings-panel')).toBeVisible();
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
