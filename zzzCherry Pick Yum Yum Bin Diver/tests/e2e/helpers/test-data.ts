import { Page } from '@playwright/test';

/**
 * Generate unique test data to avoid conflicts
 */
export function generateTestId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Test job data
 */
export function createTestJobData() {
  const testId = generateTestId();
  return {
    title: `Test Job ${testId}`,
    description: 'This is a test job posting for E2E testing',
    location: 'Remote - Philippines',
    employmentType: 'Full-time',
    salary: '50000-80000',
    requirements: [
      'Excellent communication skills',
      '2+ years of experience',
      'Bachelor\'s degree preferred',
    ],
  };
}

/**
 * Test candidate data
 */
export function createTestCandidateData() {
  const testId = generateTestId();
  return {
    email: `candidate_${testId}@test.com`,
    firstName: 'Test',
    lastName: 'Candidate',
    phone: '+63 912 345 6789',
    location: 'Manila, Philippines',
  };
}

/**
 * Test offer data
 */
export function createTestOfferData() {
  return {
    position: 'Customer Service Representative',
    salary: 60000,
    startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    benefits: [
      'Health Insurance',
      'Paid Time Off',
      'Performance Bonus',
    ],
  };
}

/**
 * Wait for notification to appear
 */
export async function waitForNotification(page: Page, message?: string, timeout = 10000) {
  const notificationSelector = message
    ? `[role="alert"]:has-text("${message}"), .toast:has-text("${message}"), .notification:has-text("${message}")`
    : '[role="alert"], .toast, .notification';

  await page.waitForSelector(notificationSelector, { timeout, state: 'visible' });
}

/**
 * Wait for loading state to complete
 */
export async function waitForLoadingComplete(page: Page, timeout = 10000) {
  // Wait for common loading indicators to disappear
  const loadingSelectors = [
    '[data-testid="loading"]',
    '.loading',
    '.spinner',
    '[aria-busy="true"]',
  ];

  for (const selector of loadingSelectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
      await element.waitFor({ state: 'hidden', timeout });
    }
  }
}

/**
 * Fill form field by label
 */
export async function fillFieldByLabel(page: Page, label: string, value: string) {
  // Try multiple strategies to find and fill the field
  const strategies = [
    // Strategy 1: Label with for attribute
    async () => {
      const labelElement = page.locator(`label:has-text("${label}")`).first();
      const forAttr = await labelElement.getAttribute('for').catch(() => null);
      if (forAttr) {
        await page.fill(`#${forAttr}`, value);
        return true;
      }
      return false;
    },
    // Strategy 2: Input with placeholder
    async () => {
      await page.fill(`input[placeholder*="${label}"]`, value);
      return true;
    },
    // Strategy 3: Input with aria-label
    async () => {
      await page.fill(`input[aria-label="${label}"]`, value);
      return true;
    },
  ];

  for (const strategy of strategies) {
    try {
      if (await strategy()) {
        return;
      }
    } catch (e) {
      // Try next strategy
      continue;
    }
  }

  throw new Error(`Could not find field with label: ${label}`);
}

/**
 * Select option from dropdown by label
 */
export async function selectOptionByLabel(page: Page, label: string, option: string) {
  // Click the combobox/select
  const selectButton = page.locator(`[role="combobox"]:has-text("${label}"), button:has-text("${label}")`).first();
  await selectButton.click();

  // Wait for options to appear
  await page.waitForTimeout(500);

  // Click the option
  const optionElement = page.locator(`[role="option"]:has-text("${option}"), li:has-text("${option}")`).first();
  await optionElement.click();
}

/**
 * Upload file to file input
 */
export async function uploadFile(page: Page, selector: string, filePath: string) {
  const fileInput = page.locator(selector);
  await fileInput.setInputFiles(filePath);
}

/**
 * Navigate to page and wait for it to load
 */
export async function navigateAndWait(page: Page, url: string, timeout = 10000) {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout });
  await waitForLoadingComplete(page);
}

/**
 * Click button and wait for navigation
 */
export async function clickAndWaitForNavigation(page: Page, selector: string) {
  await Promise.all([
    page.waitForNavigation(),
    page.click(selector),
  ]);
}

/**
 * Check if element exists (without throwing)
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  return await page.locator(selector).count() > 0;
}
