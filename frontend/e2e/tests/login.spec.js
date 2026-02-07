const { test, expect } = require('@playwright/test');

test('login as admin and see admin nav', async ({ page }) => {
  // Go to the login page
  await page.goto('/login');

  // Fill email and password
  await page.fill('input[placeholder="analyst@example.com"]', 'admin@huntsphere.local');
  await page.fill('input[placeholder="Password"]', 'Admin@123');

  // Submit
  await page.click('button:has-text("Login")');

  // Wait for navigation to articles and check header shows admin username
  await page.waitForURL('**/articles', { timeout: 5000 });
  await expect(page.locator('text=admin')).toBeVisible();
  await expect(page.locator('text=Admin')).toBeVisible();
});
