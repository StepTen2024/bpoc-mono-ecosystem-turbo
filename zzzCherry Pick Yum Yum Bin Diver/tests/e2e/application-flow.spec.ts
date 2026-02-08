import { test, expect } from '@playwright/test';
import { loginAsCandidate, loginAsRecruiter, logout } from './helpers/auth';
import {
  generateTestId,
  waitForNotification,
  waitForLoadingComplete,
  navigateAndWait
} from './helpers/test-data';
import {
  createTestJob,
  createTestCandidate,
  waitForRecord,
  updateApplicationStatus,
  getLatestNotification,
  cleanupTestData
} from './helpers/database';

/**
 * E2E Test: Application Submission Flow
 *
 * This test verifies the complete application submission workflow:
 * 1. Candidate logs in
 * 2. Browses available jobs
 * 3. Applies to a job
 * 4. Receives notification about application submission
 * 5. Application appears in recruiter dashboard
 * 6. Recruiter updates application status
 * 7. Candidate receives notification about status change
 */
test.describe('Application Submission Flow', () => {
  let testId: string;
  let testJob: any;
  let candidateId: string;

  test.beforeAll(async () => {
    // Generate unique test ID for data isolation
    testId = generateTestId();

    // Create test job
    testJob = await createTestJob({
      title: `Customer Service Rep ${testId}`,
      description: `Test job for E2E testing - ${testId}`,
    });

    console.log('Test setup complete:', { testId, jobId: testJob.id });
  });

  test.afterAll(async () => {
    // Cleanup test data
    await cleanupTestData(testId);
    console.log('Test cleanup complete');
  });

  test('should complete full application workflow', async ({ page, context }) => {
    // Step 1: Candidate logs in
    await test.step('Candidate logs in', async () => {
      await loginAsCandidate(page);
      await expect(page).toHaveURL(/\/candidate/);
    });

    // Step 2: Browse available jobs
    await test.step('Browse jobs and find test job', async () => {
      // Navigate to jobs page
      await navigateAndWait(page, '/jobs');

      // Search for our test job
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(testJob.title);
        await page.waitForTimeout(1000); // Wait for search results
      }

      // Verify job is visible
      await expect(page.locator(`text=${testJob.title}`).first()).toBeVisible({ timeout: 10000 });
    });

    // Step 3: Apply to job
    await test.step('Apply to job', async () => {
      // Click on the job to view details
      await page.click(`text=${testJob.title}`);
      await waitForLoadingComplete(page);

      // Click apply button
      const applyButton = page.locator('button:has-text("Apply"), button:has-text("Apply Now")').first();
      await expect(applyButton).toBeVisible({ timeout: 5000 });
      await applyButton.click();

      // Handle application form/modal if present
      const submitButton = page.locator('button:has-text("Submit"), button:has-text("Submit Application")').first();
      if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitButton.click();
      }

      // Wait for success notification
      await waitForNotification(page, 'success');

      console.log('Application submitted successfully');
    });

    // Step 4: Verify application notification
    await test.step('Verify candidate receives notification', async () => {
      // Navigate to notifications
      await page.click('a[href*="/notifications"], button:has-text("Notifications")');
      await waitForLoadingComplete(page);

      // Check for application submission notification
      const notificationText = page.locator('text=/application.*submitted/i, text=/applied.*job/i').first();
      await expect(notificationText).toBeVisible({ timeout: 10000 });
    });

    // Get candidate ID for later steps
    const url = page.url();
    const candidateMatch = url.match(/\/candidate\/([^\/]+)/);
    if (candidateMatch) {
      candidateId = candidateMatch[1];
    }

    // Step 5: Switch to recruiter and verify application appears
    await test.step('Recruiter sees application in dashboard', async () => {
      // Open recruiter in new page
      const recruiterPage = await context.newPage();

      // Login as recruiter
      await loginAsRecruiter(recruiterPage);

      // Navigate to applications/pipeline
      await navigateAndWait(recruiterPage, '/recruiter/pipeline');

      // Search for our test job applications
      const searchInput = recruiterPage.locator('input[type="search"], input[placeholder*="Search"]').first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(testJob.title);
        await recruiterPage.waitForTimeout(1000);
      }

      // Verify application appears
      await expect(recruiterPage.locator(`text=${testJob.title}`).first()).toBeVisible({ timeout: 10000 });

      console.log('Application visible in recruiter dashboard');

      await recruiterPage.close();
    });

    // Step 6: Recruiter updates application status
    await test.step('Recruiter updates application status', async () => {
      const recruiterPage = await context.newPage();
      await loginAsRecruiter(recruiterPage);

      // Navigate to applications
      await navigateAndWait(recruiterPage, '/recruiter/pipeline');

      // Find and click on the application
      await recruiterPage.click(`text=${testJob.title}`);
      await waitForLoadingComplete(recruiterPage);

      // Update status to "screening"
      const statusDropdown = recruiterPage.locator('[role="combobox"]:has-text("Status"), select[name="status"]').first();
      if (await statusDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
        await statusDropdown.click();
        await recruiterPage.waitForTimeout(500);

        // Select "screening" or "in_review" status
        const screeningOption = recruiterPage.locator('[role="option"]:has-text("Screening"), option:has-text("Screening")').first();
        if (await screeningOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await screeningOption.click();

          // Save/update button
          const saveButton = recruiterPage.locator('button:has-text("Save"), button:has-text("Update")').first();
          if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await saveButton.click();
            await waitForNotification(recruiterPage, 'updated');
          }

          console.log('Application status updated to screening');
        }
      }

      await recruiterPage.close();
    });

    // Step 7: Verify candidate receives status update notification
    await test.step('Candidate receives status update notification', async () => {
      // Refresh notifications page
      await page.reload();
      await waitForLoadingComplete(page);

      // Navigate to notifications if not already there
      if (!page.url().includes('/notifications')) {
        await page.click('a[href*="/notifications"], button:has-text("Notifications")');
        await waitForLoadingComplete(page);
      }

      // Look for status update notification
      const statusNotification = page.locator('text=/status.*updated/i, text=/application.*screening/i').first();

      // If not visible, check if notifications need to be expanded/loaded
      if (!await statusNotification.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Try clicking "show all" or refresh
        const showAllButton = page.locator('button:has-text("Show All"), button:has-text("Load More")').first();
        if (await showAllButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await showAllButton.click();
          await page.waitForTimeout(1000);
        }
      }

      // Verify notification exists
      await expect(statusNotification).toBeVisible({ timeout: 10000 });

      console.log('Candidate received status update notification');
    });
  });

  test('should prevent duplicate applications', async ({ page }) => {
    await test.step('Login as candidate', async () => {
      await loginAsCandidate(page);
    });

    await test.step('Try to apply to same job again', async () => {
      // Navigate to jobs
      await navigateAndWait(page, '/jobs');

      // Find the test job
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(testJob.title);
        await page.waitForTimeout(1000);
      }

      // Click on job
      await page.click(`text=${testJob.title}`);
      await waitForLoadingComplete(page);

      // Apply button should show "Applied" or be disabled
      const applyButton = page.locator('button:has-text("Applied"), button:has-text("Apply")[disabled]').first();

      // Verify cannot apply again
      const canApply = await page.locator('button:has-text("Apply Now"):not([disabled])').count() === 0;
      expect(canApply).toBeTruthy();

      console.log('Duplicate application prevented successfully');
    });
  });

  test('should show application in candidate applications list', async ({ page }) => {
    await test.step('Login as candidate', async () => {
      await loginAsCandidate(page);
    });

    await test.step('View applications list', async () => {
      // Navigate to candidate applications
      await navigateAndWait(page, '/candidate/applications');

      // Verify test job application appears
      await expect(page.locator(`text=${testJob.title}`).first()).toBeVisible({ timeout: 10000 });

      // Verify application status is displayed
      const statusBadge = page.locator('text=/submitted|screening|pending/i').first();
      await expect(statusBadge).toBeVisible();

      console.log('Application visible in candidate applications list');
    });
  });
});
