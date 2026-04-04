import { test, expect } from '@playwright/test';

// Explicitly fake value used only to verify the OAuth callback path — not a real credential
const TEST_OAUTH_PLACEHOLDER = '[test-only-not-a-real-token]';

test.describe('Google Fit Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/emom-timer/');
    // Open settings panel
    await page.locator('#settings-toggle').click();
    await expect(page.locator('#settings-panel')).toBeVisible();
  });

  test('Google Fit connect button is visible in settings', async ({ page }) => {
    await expect(page.locator('#connect-google-fit-btn')).toBeVisible();
  });

  test('Google Identity Services (GIS) library loads successfully', async ({ page }) => {
    // Wait for the GIS script to load — globalThis.google should be defined
    await page.waitForFunction(() => (globalThis as any).google !== undefined, {
      timeout: 10000,
    });
    const googleDefined = await page.evaluate(() => (globalThis as any).google !== undefined);
    expect(googleDefined).toBe(true);
  });

  test('Clicking connect button triggers GIS token request (mocked)', async ({ page }) => {
    // Inject a mock google.accounts.oauth2 before clicking
    await page.evaluate(() => {
      (globalThis as any).__mockTokenRequested = false;
      (globalThis as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: any) => ({
              requestAccessToken: () => {
                (globalThis as any).__mockTokenRequested = true;
                // Simulate a successful token response
                config.callback({ access_token: TEST_OAUTH_PLACEHOLDER, expires_in: 3600 });
              },
            }),
          },
        },
      };
    });

    await page.locator('#connect-google-fit-btn').click();
    await page.locator('#close-settings-btn').click();

    // Verify the mock requestAccessToken was called
    const wasRequested = await page.evaluate(() => (globalThis as any).__mockTokenRequested);
    expect(wasRequested).toBe(true);
  });
});
