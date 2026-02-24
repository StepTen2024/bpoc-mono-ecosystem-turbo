import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Get ALL job IDs for an agency — both client jobs and agency-direct jobs.
 * This is the single source of truth for "which jobs belong to this agency".
 */
export async function getAgencyJobIds(agencyId: string): Promise<string[]> {
  // 1. Get client job IDs
  const { data: clients } = await supabaseAdmin
    .from('agency_clients')
    .select('id')
    .eq('agency_id', agencyId);
  
  const clientIds = (clients || []).map(c => c.id);
  
  let clientJobIds: string[] = [];
  if (clientIds.length > 0) {
    const { data: clientJobs } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .in('agency_client_id', clientIds);
    clientJobIds = (clientJobs || []).map(j => j.id);
  }
  
  // 2. Get agency-direct job IDs (posted by agency recruiters, no client)
  const { data: recruiters } = await supabaseAdmin
    .from('agency_recruiters')
    .select('id')
    .eq('agency_id', agencyId);
  
  const recruiterIds = (recruiters || []).map(r => r.id);
  
  let directJobIds: string[] = [];
  if (recruiterIds.length > 0) {
    const { data: directJobs } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .is('agency_client_id', null)
      .in('posted_by', recruiterIds);
    directJobIds = (directJobs || []).map(j => j.id);
  }
  
  // Combine and deduplicate
  return [...new Set([...clientJobIds, ...directJobIds])];
}

/**
 * Get ALL jobs for an agency with full details.
 */
export async function getAgencyJobs(agencyId: string, select: string = 'id, title, agency_client_id, job_type, status') {
  const { data: clients } = await supabaseAdmin
    .from('agency_clients')
    .select('id')
    .eq('agency_id', agencyId);
  
  const clientIds = (clients || []).map(c => c.id);
  
  const { data: recruiters } = await supabaseAdmin
    .from('agency_recruiters')
    .select('id')
    .eq('agency_id', agencyId);
  
  const recruiterIds = (recruiters || []).map(r => r.id);
  
  let allJobs: any[] = [];
  
  if (clientIds.length > 0) {
    const { data: clientJobs } = await supabaseAdmin
      .from('jobs')
      .select(select)
      .in('agency_client_id', clientIds);
    if (clientJobs) allJobs.push(...clientJobs);
  }
  
  if (recruiterIds.length > 0) {
    const { data: directJobs } = await supabaseAdmin
      .from('jobs')
      .select(select)
      .is('agency_client_id', null)
      .in('posted_by', recruiterIds);
    if (directJobs) allJobs.push(...directJobs);
  }
  
  // Deduplicate by id
  const seen = new Set<string>();
  return allJobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
}
