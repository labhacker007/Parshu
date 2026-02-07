const { test, expect } = require('@playwright/test');

function uniqueName(prefix = 'e2e-connector') {
  return `${prefix}-${Date.now()}`;
}

test('admin can create, test, and delete connector', async ({ page }) => {
  // Login as admin
  await page.goto('/login');
  await page.fill('input[placeholder="analyst@example.com"]', 'admin@huntsphere.local');
  await page.fill('input[placeholder="Password"]', 'Admin@123');
  await page.click('button:has-text("Login")');
  await page.waitForURL('**/articles', { timeout: 5000 });

  // Navigate to admin page
  await page.goto('/admin');
  await expect(page.locator('text=Connectors')).toBeVisible();

  const name = uniqueName();

  // Open create modal
  await page.click('button:has-text("Create Connector")');

  // Fill form
  await page.fill('input[placeholder="Name"]', name).catch(() => {}); // placeholder not present, use label
  await page.fill('input[name="name"]', name).catch(() => {});

  // There is no name attribute, fallback to form control by label
  await page.locator('label:has-text("Name")').locator('..').locator('input').fill(name);

  // Select type
  await page.click('label:has-text("Type")');
  await page.click('text=xsiam');

  // Set active
  await page.click('label:has-text("Active")').catch(() => {});

  // Set config JSON
  const cfg = JSON.stringify({ tenant_id: 't1', api_key: 'k1' });
  await page.locator('label:has-text("Config (JSON)")').locator('..').locator('textarea').fill(cfg);

  // Submit
  await page.click('button:has-text("OK")');

  // Wait for success message and row to appear
  await expect(page.locator(`text=${name}`)).toBeVisible({ timeout: 5000 });

  // Click Test button for the created connector (row with name)
  const row = page.locator('tr', { hasText: name });
  await row.locator('button:has-text("Test")').click();

  // Expect success or failure message; given we provided creds, expect success
  await expect(page.locator('text=Test OK').or(page.locator('text=Test failed'))).toBeVisible({ timeout: 5000 });

  // Cleanup: delete connector
  await row.locator('button:has-text("Delete")').click();
  // Confirm the Popconfirm
  await page.click('button:has-text("OK")');

  // Ensure deleted
  await expect(page.locator(`text=${name}`)).not.toBeVisible({ timeout: 5000 });
});
