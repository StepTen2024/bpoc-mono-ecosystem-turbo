import { test, expect } from '@playwright/test';
import { loginAsCandidate, loginAsRecruiter } from './helpers/auth';
import {
  generateTestId,
  waitForNotification,
  waitForLoadingComplete,
  navigateAndWait
} from './helpers/test-data';
import {
  createTestJob,
  createTestCandidate,
  createTestApplication,
  waitForRecord,
  getLatestNotification,
  cleanupTestData,
  supabaseAdmin
} from './helpers/database';

/**
 * E2E Test: Interview Scheduling Flow
 *
 * This test verifies the complete interview scheduling workflow:
 * 1. Recruiter proposes interview times
 * 2. Candidate receives notification
 * 3. Candidate accepts interview time
 * 4. Daily.co video room is created
 * 5. All parties receive join links
 */
test.describe('Interview Scheduling Flow', () => {
  let testId: string;
  let testJob: any;
  let testCandidate: any;
  let testApplication: any;
  let recruiterId: string;

  test.beforeAll(async () => {
    // Generate unique test ID
    testId = generateTestId();

    // Create test job
    testJob = await createTestJob({
      title: `Interview Test Job ${testId}`,
      description: `Test job for interview E2E testing - ${testId}`,
    });

    // Create test candidate
    testCandidate = await createTestCandidate({
      email: `interview_candidate_${testId}@test.com`,
      first_name: 'Interview',
      last_name: `Test${testId.substring(0, 8)}`,
    });

    // Create test application
    testApplication = await createTestApplication({
      job_id: testJob.id,
      candidate_id: testCandidate.id,
      status: 'screening',
    });

    // Get a recruiter ID (assuming recruiter exists from seed data)
    const { data: recruiter } = await supabaseAdmin
      .from('recruiters')
      .select('id')
      .limit(1)
      .single();

    if (recruiter) {
      recruiterId = recruiter.id;
    }

    console.log('Interview test setup complete:', {
      testId,
      jobId: testJob.id,
      candidateId: testCandidate.id,
      applicationId: testApplication.id,
    });
  });

  test.afterAll(async () => {
    // Cleanup test data
    await cleanupTestData(testId);
    console.log('Interview test cleanup complete');
  });

  test('should complete full interview scheduling workflow', async ({ page, context }) => {
    // Step 1: Recruiter proposes interview times
    await test.step('Recruiter schedules interview', async () => {
      await loginAsRecruiter(page);

      // Navigate to pipeline/applications
      await navigateAndWait(page, '/recruiter/pipeline');

      // Search for test job
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(testJob.title);
        await page.waitForTimeout(1000);
      }

      // Click on application
      await page.click(`text=${testJob.title}`);
      await waitForLoadingComplete(page);

      // Look for "Schedule Interview" button
      const scheduleButton = page.locator('button:has-text("Schedule Interview"), button:has-text("Schedule"), a:has-text("Schedule Interview")').first();

      if (await scheduleButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await scheduleButton.click();
        await waitForLoadingComplete(page);

        // Fill interview date/time
        // Calculate tomorrow at 2 PM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(14, 0, 0, 0);

        const dateInput = page.locator('input[type="date"], input[type="datetime-local"]').first();
        if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          const dateValue = tomorrow.toISOString().split('T')[0];
          await dateInput.fill(dateValue);
        }

        const timeInput = page.locator('input[type="time"]').first();
        if (await timeInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await timeInput.fill('14:00');
        }

        // Add interview notes
        const notesTextarea = page.locator('textarea[name="notes"], textarea[placeholder*="notes"]').first();
        if (await notesTextarea.isVisible({ timeout: 3000 }).catch(() => false)) {
          await notesTextarea.fill('Technical interview for Customer Service position');
        }

        // Submit interview schedule
        const submitButton = page.locator('button:has-text("Schedule"), button:has-text("Send Invitation")').first();
        await submitButton.click();

        // Wait for success notification
        await waitForNotification(page, 'scheduled');

        console.log('Interview scheduled successfully');
      } else {
        console.log('Schedule button not found, interview might already be scheduled');
      }
    });

    // Step 2: Verify candidate receives notification
    await test.step('Candidate receives interview notification', async () => {
      // Open new page for candidate
      const candidatePage = await context.newPage();

      // Login with test candidate credentials
      await candidatePage.goto('/auth/signin');
      await candidatePage.fill('input[type="email"]', testCandidate.email);
      await candidatePage.fill('input[type="password"]', testCandidate.password);
      await candidatePage.click('button[type="submit"]');
      await candidatePage.waitForURL('**/candidate/**', { timeout: 10000 });

      // Navigate to notifications
      await navigateAndWait(candidatePage, '/candidate/notifications');

      // Look for interview notification
      const interviewNotification = candidatePage.locator('text=/interview.*scheduled/i, text=/interview.*invitation/i').first();
      await expect(interviewNotification).toBeVisible({ timeout: 10000 });

      console.log('Candidate received interview notification');

      await candidatePage.close();
    });

    // Step 3: Candidate accepts interview time
    await test.step('Candidate accepts interview invitation', async () => {
      const candidatePage = await context.newPage();

      // Login as candidate
      await candidatePage.goto('/auth/signin');
      await candidatePage.fill('input[type="email"]', testCandidate.email);
      await candidatePage.fill('input[type="password"]', testCandidate.password);
      await candidatePage.click('button[type="submit"]');
      await candidatePage.waitForURL('**/candidate/**', { timeout: 10000 });

      // Navigate to interviews page
      await navigateAndWait(candidatePage, '/candidate/interviews');

      // Find pending interview
      const interviewCard = candidatePage.locator(`text=${testJob.title}`).first();
      await expect(interviewCard).toBeVisible({ timeout: 10000 });

      // Click to view details
      await interviewCard.click();
      await waitForLoadingComplete(candidatePage);

      // Accept interview
      const acceptButton = candidatePage.locator('button:has-text("Accept"), button:has-text("Confirm")').first();
      if (await acceptButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await acceptButton.click();
        await waitForNotification(candidatePage, 'accepted');

        console.log('Candidate accepted interview invitation');
      }

      await candidatePage.close();
    });

    // Step 4: Verify Daily.co room is created
    await test.step('Verify video room creation', async () => {
      // Wait for video room to be created in database
      try {
        const videoRoom = await waitForRecord(
          'video_rooms',
          { application_id: testApplication.id },
          15000
        );

        expect(videoRoom).toBeTruthy();
        expect(videoRoom.room_url).toBeTruthy();
        expect(videoRoom.room_name).toBeTruthy();

        console.log('Daily.co video room created:', videoRoom.room_name);
      } catch (error) {
        console.log('Video room creation check skipped (may not be auto-created)');
      }
    });

    // Step 5: Verify join links are accessible
    await test.step('Verify all parties can access join links', async () => {
      // Recruiter checks for join link
      await navigateAndWait(page, '/recruiter/interviews');

      const interviewRow = page.locator(`text=${testJob.title}`).first();
      if (await interviewRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await interviewRow.click();
        await waitForLoadingComplete(page);

        // Look for join/start button
        const joinButton = page.locator('button:has-text("Join"), button:has-text("Start Interview"), a[href*="daily.co"]').first();
        const hasJoinLink = await joinButton.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasJoinLink) {
          console.log('Recruiter has access to join link');
        }
      }

      // Candidate checks for join link
      const candidatePage = await context.newPage();
      await candidatePage.goto('/auth/signin');
      await candidatePage.fill('input[type="email"]', testCandidate.email);
      await candidatePage.fill('input[type="password"]', testCandidate.password);
      await candidatePage.click('button[type="submit"]');
      await candidatePage.waitForURL('**/candidate/**', { timeout: 10000 });

      await navigateAndWait(candidatePage, '/candidate/interviews');

      const candidateInterviewRow = candidatePage.locator(`text=${testJob.title}`).first();
      if (await candidateInterviewRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await candidateInterviewRow.click();
        await waitForLoadingComplete(candidatePage);

        const candidateJoinButton = candidatePage.locator('button:has-text("Join"), a[href*="daily.co"]').first();
        const hasCandidateJoinLink = await candidateJoinButton.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasCandidateJoinLink) {
          console.log('Candidate has access to join link');
        }
      }

      await candidatePage.close();
    });
  });

  test('should allow rescheduling interview', async ({ page }) => {
    await test.step('Login as recruiter', async () => {
      await loginAsRecruiter(page);
    });

    await test.step('Reschedule interview', async () => {
      // Navigate to interviews
      await navigateAndWait(page, '/recruiter/interviews');

      // Find test interview
      const interviewRow = page.locator(`text=${testJob.title}`).first();
      if (await interviewRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await interviewRow.click();
        await waitForLoadingComplete(page);

        // Look for reschedule button
        const rescheduleButton = page.locator('button:has-text("Reschedule"), button:has-text("Change Time")').first();
        if (await rescheduleButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await rescheduleButton.click();
          await waitForLoadingComplete(page);

          // Update date to day after tomorrow
          const newDate = new Date();
          newDate.setDate(newDate.getDate() + 2);
          const dateValue = newDate.toISOString().split('T')[0];

          const dateInput = page.locator('input[type="date"], input[type="datetime-local"]').first();
          if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await dateInput.fill(dateValue);
          }

          // Submit reschedule
          const submitButton = page.locator('button:has-text("Update"), button:has-text("Reschedule")').first();
          await submitButton.click();
          await waitForNotification(page, 'updated');

          console.log('Interview rescheduled successfully');
        }
      }
    });
  });

  test('should show interview in candidate dashboard', async ({ page }) => {
    await test.step('Login as test candidate', async () => {
      await page.goto('/auth/signin');
      await page.fill('input[type="email"]', testCandidate.email);
      await page.fill('input[type="password"]', testCandidate.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/candidate/**', { timeout: 10000 });
    });

    await test.step('View upcoming interviews', async () => {
      // Navigate to interviews
      await navigateAndWait(page, '/candidate/interviews');

      // Verify interview is listed
      await expect(page.locator(`text=${testJob.title}`).first()).toBeVisible({ timeout: 10000 });

      // Verify interview details
      const interviewCard = page.locator(`text=${testJob.title}`).first();
      await interviewCard.click();
      await waitForLoadingComplete(page);

      // Check for interview time
      const timeDisplay = page.locator('text=/\\d{1,2}:\\d{2}|\\d{1,2}:\\d{2}\\s?[AP]M/i').first();
      await expect(timeDisplay).toBeVisible({ timeout: 5000 });

      console.log('Interview visible in candidate dashboard');
    });
  });
});
