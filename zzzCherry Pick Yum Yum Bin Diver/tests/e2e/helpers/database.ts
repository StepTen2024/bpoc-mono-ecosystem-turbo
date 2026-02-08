/**
 * Database helper utilities for E2E tests
 *
 * NOTE: These utilities should only be used in test environments.
 * They provide direct database access for test setup and cleanup.
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

// Create admin client for test operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Create a test job posting
 */
export async function createTestJob(data: {
  title: string;
  description?: string;
  agency_client_id?: string;
  recruiter_id?: string;
}) {
  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .insert({
      title: data.title,
      description: data.description || 'Test job description',
      status: 'active',
      agency_client_id: data.agency_client_id,
      recruiter_id: data.recruiter_id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test job: ${error.message}`);
  }

  return job;
}

/**
 * Create a test candidate
 */
export async function createTestCandidate(data: {
  email: string;
  first_name: string;
  last_name: string;
  password?: string;
}) {
  const password = data.password || 'TestPassword123!';

  // Create auth user
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      first_name: data.first_name,
      last_name: data.last_name,
    },
  });

  if (authError || !authUser.user) {
    throw new Error(`Failed to create test candidate auth: ${authError?.message}`);
  }

  // Create candidate record
  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from('candidates')
    .insert({
      id: authUser.user.id,
      email: data.email.toLowerCase(),
      first_name: data.first_name,
      last_name: data.last_name,
    })
    .select()
    .single();

  if (candidateError) {
    // Rollback: delete auth user
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(`Failed to create test candidate record: ${candidateError.message}`);
  }

  return {
    ...candidate,
    password,
  };
}

/**
 * Create a test application
 */
export async function createTestApplication(data: {
  job_id: string;
  candidate_id: string;
  status?: string;
}) {
  const { data: application, error } = await supabaseAdmin
    .from('job_applications')
    .insert({
      job_id: data.job_id,
      candidate_id: data.candidate_id,
      status: data.status || 'submitted',
      released_to_client: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test application: ${error.message}`);
  }

  return application;
}

/**
 * Create a test offer
 */
export async function createTestOffer(data: {
  application_id: string;
  recruiter_id: string;
  salary?: number;
  position?: string;
}) {
  const { data: offer, error } = await supabaseAdmin
    .from('offers')
    .insert({
      application_id: data.application_id,
      recruiter_id: data.recruiter_id,
      salary: data.salary || 60000,
      position: data.position || 'Test Position',
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test offer: ${error.message}`);
  }

  return offer;
}

/**
 * Create a test interview
 */
export async function createTestInterview(data: {
  application_id: string;
  recruiter_id: string;
  scheduled_at?: string;
}) {
  const { data: interview, error } = await supabaseAdmin
    .from('interviews')
    .insert({
      application_id: data.application_id,
      recruiter_id: data.recruiter_id,
      scheduled_at: data.scheduled_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test interview: ${error.message}`);
  }

  return interview;
}

/**
 * Get notification count for a user
 */
export async function getNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    throw new Error(`Failed to get notification count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Get latest notification for a user
 */
export async function getLatestNotification(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    throw new Error(`Failed to get latest notification: ${error.message}`);
  }

  return data;
}

/**
 * Clean up test data
 */
export async function cleanupTestData(testId: string) {
  // Delete records created during test (by matching test ID patterns)
  // This is a safety measure to prevent test data accumulation

  // Note: Order matters due to foreign key constraints
  await supabaseAdmin.from('notifications').delete().ilike('title', `%${testId}%`);
  await supabaseAdmin.from('interviews').delete().ilike('notes', `%${testId}%`);
  await supabaseAdmin.from('offers').delete().ilike('position', `%${testId}%`);
  await supabaseAdmin.from('job_applications').delete().ilike('notes', `%${testId}%`);
  await supabaseAdmin.from('jobs').delete().ilike('title', `%${testId}%`);
  await supabaseAdmin.from('candidates').delete().ilike('email', `%${testId}%`);
}

/**
 * Wait for database record to exist (polling)
 */
export async function waitForRecord(
  table: string,
  filter: Record<string, any>,
  timeout = 10000
): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .match(filter)
      .single();

    if (data && !error) {
      return data;
    }

    // Wait 500ms before next check
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Timeout waiting for record in ${table} with filter ${JSON.stringify(filter)}`);
}

/**
 * Update application status
 */
export async function updateApplicationStatus(applicationId: string, status: string) {
  const { data, error } = await supabaseAdmin
    .from('job_applications')
    .update({ status })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update application status: ${error.message}`);
  }

  return data;
}

export { supabaseAdmin };
