import { Page, expect } from '@playwright/test';

/**
 * Test user credentials for different roles
 */
export const TEST_USERS = {
  candidate: {
    email: 'jennifer.tuason@testbpo.com',
    password: 'testtest1',
    name: 'Jennifer Tuason',
  },
  recruiter: {
    email: 'recruiter@shoreagents.com',
    password: 'recruiter123',
    name: 'Test Recruiter',
  },
  admin: {
    email: 'admin@bpoc.ai',
    password: 'admin123',
    name: 'Admin User',
  },
};

/**
 * Login as a candidate
 */
export async function loginAsCandidate(page: Page) {
  await page.goto('/auth/signin');
  await page.fill('input[type="email"]', TEST_USERS.candidate.email);
  await page.fill('input[type="password"]', TEST_USERS.candidate.password);
  await page.click('button[type="submit"]');

  // Wait for redirect to candidate dashboard
  await page.waitForURL('**/candidate/**', { timeout: 10000 });

  // Verify we're logged in
  await expect(page).toHaveURL(/\/candidate/);
}

/**
 * Login as a recruiter
 */
export async function loginAsRecruiter(page: Page) {
  await page.goto('/recruiter/login');
  await page.fill('input[type="email"]', TEST_USERS.recruiter.email);
  await page.fill('input[type="password"]', TEST_USERS.recruiter.password);
  await page.click('button[type="submit"]');

  // Wait for redirect to recruiter dashboard
  await page.waitForURL('**/recruiter/**', { timeout: 10000 });

  // Verify we're logged in
  await expect(page).toHaveURL(/\/recruiter/);
}

/**
 * Login as an admin
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.fill('input[type="email"]', TEST_USERS.admin.email);
  await page.fill('input[type="password"]', TEST_USERS.admin.password);
  await page.click('button[type="submit"]');

  // Wait for redirect to admin dashboard
  await page.waitForURL('**/admin/**', { timeout: 10000 });

  // Verify we're logged in
  await expect(page).toHaveURL(/\/admin/);
}

/**
 * Logout from any authenticated session
 */
export async function logout(page: Page) {
  // Look for common logout patterns
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")').first();

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
  } else {
    // Alternative: clear cookies and storage
    await page.context().clearCookies();
  }

  // Wait for redirect to home or login
  await page.waitForURL(/\/(auth\/signin|recruiter\/login|admin\/login|^$)/, { timeout: 5000 }).catch(() => {});
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Check for common authenticated UI elements
  const authenticatedIndicators = [
    'button:has-text("Logout")',
    'button:has-text("Sign Out")',
    '[data-testid="user-menu"]',
  ];

  for (const selector of authenticatedIndicators) {
    if (await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
      return true;
    }
  }

  return false;
}
