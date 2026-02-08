# End-to-End Testing Suite

This directory contains comprehensive end-to-end (E2E) tests for the BPOC platform's critical workflows using Playwright.

## Overview

The E2E test suite covers the following critical user journeys:

1. **Application Submission Flow** - Complete candidate application process from browsing jobs to status updates
2. **Interview Scheduling Flow** - Interview invitation, acceptance, and video room creation
3. **Offer Negotiation Flow** - Offer creation, counter-offers, and acceptance
4. **Onboarding Flow** - Complete onboarding process from offer acceptance to employment confirmation

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- Running local development server (`npm run dev`)
- Valid Supabase credentials in `.env.local`
- Test user accounts (candidate and recruiter)

## Installation

Install Playwright and dependencies:

```bash
npm install --save-dev @playwright/test
npx playwright install
```

## Configuration

The test configuration is defined in `playwright.config.ts` at the root of the project.

Key configuration options:
- **Base URL**: `http://localhost:3001`
- **Test Directory**: `./tests/e2e`
- **Browser**: Chromium (can be extended to Firefox and WebKit)
- **Retries**: 2 retries on CI, 0 locally
- **Screenshots**: Captured on failure
- **Video**: Recorded on failure
- **Traces**: Captured on first retry

## Test Structure

```
tests/e2e/
├── helpers/
│   ├── auth.ts           # Authentication helpers (login, logout, etc.)
│   ├── test-data.ts      # Test data generation and utilities
│   └── database.ts       # Database helpers for test setup/cleanup
├── application-flow.spec.ts    # Application submission tests
├── interview-flow.spec.ts      # Interview scheduling tests
├── offer-flow.spec.ts          # Offer negotiation tests
├── onboarding-flow.spec.ts     # Onboarding workflow tests
└── README.md                   # This file
```

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test tests/e2e/application-flow.spec.ts
```

### Run tests in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run tests in debug mode
```bash
npx playwright test --debug
```

### Run tests with UI mode (recommended for development)
```bash
npx playwright test --ui
```

### Run specific test by name
```bash
npx playwright test --grep "should complete full application workflow"
```

## Test Helpers

### Authentication (`helpers/auth.ts`)

Provides login/logout utilities for different user roles:

```typescript
import { loginAsCandidate, loginAsRecruiter, logout } from './helpers/auth';

// Login as candidate
await loginAsCandidate(page);

// Login as recruiter
await loginAsRecruiter(page);

// Logout
await logout(page);
```

**Test User Credentials:**
- **Candidate**: `jennifer.tuason@testbpo.com` / `testtest1`
- **Recruiter**: `recruiter@shoreagents.com` / `recruiter123`
- **Admin**: `admin@bpoc.ai` / `admin123`

### Test Data Generation (`helpers/test-data.ts`)

Utilities for generating test data and interacting with UI:

```typescript
import {
  generateTestId,
  waitForNotification,
  navigateAndWait,
  fillFieldByLabel
} from './helpers/test-data';

// Generate unique test ID
const testId = generateTestId();

// Wait for notification
await waitForNotification(page, 'success');

// Navigate and wait for page load
await navigateAndWait(page, '/candidate/applications');

// Fill form field by label
await fillFieldByLabel(page, 'Email', 'test@example.com');
```

### Database Helpers (`helpers/database.ts`)

Direct database access for test setup and cleanup:

```typescript
import {
  createTestJob,
  createTestCandidate,
  createTestApplication,
  cleanupTestData
} from './helpers/database';

// Create test data
const job = await createTestJob({ title: 'Test Job' });
const candidate = await createTestCandidate({
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User'
});

// Cleanup
await cleanupTestData(testId);
```

## Test Workflows

### 1. Application Flow

Tests the complete application submission workflow:
- Candidate logs in and browses jobs
- Submits application to job
- Receives notification
- Application appears in recruiter dashboard
- Recruiter updates status
- Candidate receives status update notification

**File**: `application-flow.spec.ts`

### 2. Interview Flow

Tests the interview scheduling workflow:
- Recruiter proposes interview times
- Candidate receives notification
- Candidate accepts interview
- Daily.co video room is created
- Join links are accessible to all parties

**File**: `interview-flow.spec.ts`

### 3. Offer Flow

Tests the offer negotiation workflow:
- Recruiter sends offer
- Candidate receives notification
- Candidate counters offer
- Recruiter receives counter notification
- Recruiter accepts counter
- Contract is generated

**File**: `offer-flow.spec.ts`

### 4. Onboarding Flow

Tests the complete onboarding workflow:
- Candidate accepts offer
- Onboarding wizard is triggered
- Candidate completes onboarding steps
- Documents are uploaded
- Contract is signed
- Employment is confirmed

**File**: `onboarding-flow.spec.ts`

## Environment Variables

Required environment variables (should be in `.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Best Practices

### Test Isolation
- Each test should be independent and not rely on other tests
- Use unique test IDs to avoid data conflicts
- Clean up test data after each test run

### Waiting Strategies
- Use `waitForLoadingComplete()` after navigation
- Use `waitForNotification()` to verify user feedback
- Use `waitForRecord()` to verify database changes
- Avoid `page.waitForTimeout()` when possible (use only for UI delays)

### Error Handling
- Tests include graceful fallbacks for UI variations
- Use `.catch(() => false)` for optional elements
- Log meaningful messages for debugging

### Data Management
- Test data is prefixed with unique IDs
- Cleanup is performed in `afterAll()` hooks
- Use database helpers for consistent test setup

## Debugging Failed Tests

### View trace
```bash
npx playwright show-trace trace.zip
```

### View test report
```bash
npx playwright show-report
```

### Run single test in debug mode
```bash
npx playwright test tests/e2e/application-flow.spec.ts --debug
```

## Common Issues

### Issue: Tests fail with "Timeout waiting for page"
**Solution**: Ensure development server is running on `http://localhost:3001`

### Issue: Database-related failures
**Solution**: Check Supabase credentials and ensure tables exist

### Issue: Authentication failures
**Solution**: Verify test user accounts exist in database

### Issue: Flaky tests
**Solution**: Increase timeouts or add explicit waits for async operations

## CI/CD Integration

The test suite is configured for CI environments with:
- Automatic retries (2 attempts)
- Sequential execution (workers: 1)
- Screenshot and video capture on failure
- HTML report generation

Example GitHub Actions workflow:

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Contributing

When adding new tests:
1. Follow existing test patterns
2. Use helper functions for common operations
3. Add meaningful test descriptions
4. Include proper cleanup in `afterAll()` hooks
5. Document any new test users or setup requirements

## Test Coverage

Current coverage:
- ✅ Application submission and status updates
- ✅ Interview scheduling and acceptance
- ✅ Offer creation and negotiation
- ✅ Onboarding completion
- ✅ Notification delivery
- ✅ Multi-user workflows (candidate + recruiter)

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

## Support

For issues or questions:
- Check existing test documentation
- Review Playwright logs and traces
- Consult team documentation
- Create issue with full error details and reproduction steps
