import { test, expect } from '@playwright/test';

test.describe('Onboarding Wizard', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to test page
        await page.goto('http://localhost:3001/test/onboarding');

        // Log in as Jennifer Tuason
        await page.goto('http://localhost:3001/auth/signin');
        await page.fill('input[type="email"]', 'jennifer.tuason@testbpo.com');
        await page.fill('input[type="password"]', 'testtest1');
        await page.click('button[type="submit"]');

        // Wait for redirect
        await page.waitForURL('**/candidate/**', { timeout: 10000 });

        // Go back to test page
        await page.goto('http://localhost:3001/test/onboarding');
    });

    test('should load the test page', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('Onboarding Wizard Test');
    });

    test('should create test onboarding and open wizard', async ({ page }) => {
        // Click the launch button
        await page.click('button:has-text("Launch Onboarding Wizard")');

        // Wait for wizard to open
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=Complete Your Onboarding')).toBeVisible();

        // Check that Step 1 is displayed
        await expect(page.locator('text=Step 1 of 8')).toBeVisible();
    });

    test('should submit Step 1: Personal Info', async ({ page }) => {
        // Create test onboarding
        await page.click('button:has-text("Launch Onboarding Wizard")');
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

        // Fill out personal info form
        await page.fill('input[type="text"]', 'Jennifer');
        await page.fill('input[placeholder*="Middle"]', 'Marie');
        await page.fill('input[placeholder*="Last"]', 'Tuason');

        // Select gender
        await page.click('[role="combobox"]:has-text("Select gender")');
        await page.click('[role="option"]:has-text("Female")');

        // Select civil status
        await page.click('[role="combobox"]:has-text("Select status")');
        await page.click('[role="option"]:has-text("Single")');

        // Fill date of birth
        await page.fill('input[type="date"]', '1995-06-15');

        // Fill contact number
        await page.fill('input[placeholder*="XXX"]', '+63 912 345 6789');

        // Fill email
        await page.fill('input[type="email"]', 'jennifer.tuason@testbpo.com');

        // Fill address
        await page.fill('textarea', '123 Test Street, Makati City, Metro Manila 1200');

        // Submit form
        await page.click('button:has-text("Save & Continue")');

        // Wait for success message or next step
        await expect(page.locator('text=Step 2 of 8')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate between steps', async ({ page }) => {
        // Create test onboarding
        await page.click('button:has-text("Launch Onboarding Wizard")');
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

        // Click on step 2 in the progress bar
        await page.click('text=Resume');
        await expect(page.locator('text=Step 2 of 8')).toBeVisible();

        // Go back to step 1
        await page.click('button:has-text("Previous")');
        await expect(page.locator('text=Step 1 of 8')).toBeVisible();

        // Try to go to next step
        await page.click('button:has-text("Next")');
        await expect(page.locator('text=Step 2 of 8')).toBeVisible();
    });

    test('should show progress percentage', async ({ page }) => {
        // Create test onboarding
        await page.click('button:has-text("Launch Onboarding Wizard")');
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

        // Initially should be 0%
        await expect(page.locator('text=0% Complete')).toBeVisible();
    });
});
