import { getAgencyJobIds } from '@/lib/db/agency-jobs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyAuthToken } from '@/lib/auth/verify-token';
import { logApplicationActivity } from '@/lib/db/applications/queries.supabase';

/**
 * GET /api/recruiter/offers
 * Fetch offers for jobs that belong to this recruiter's agency
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    
    if (!userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    // Get recruiter's agency_id
    const { data: recruiter, error: recruiterError } = await supabaseAdmin
      .from('agency_recruiters')
      .select('agency_id')
      .eq('user_id', userId)
      .single();

    if (recruiterError || !recruiter) {
      return NextResponse.json({ 
        offers: [],
        message: 'Recruiter not found'
      });
    }

    const agencyId = recruiter.agency_id;

    // Get ALL job IDs for this agency (client + agency-direct)
    const jobIds = await getAgencyJobIds(agencyId);
    if (jobIds.length === 0) {
      return NextResponse.json({ offers: [], message: 'No jobs found' });
    }

    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('id, title')
      .in('id', jobIds);
    const jobMap = Object.fromEntries((jobs || []).map(j => [j.id, j.title]));

    // Get applications for these jobs
    const { data: applications } = await supabaseAdmin
      .from('job_applications')
      .select('id, job_id, candidate_id')
      .in('job_id', jobIds);

    if (!applications || applications.length === 0) {
      return NextResponse.json({ offers: [] });
    }

    const appIds = applications.map(a => a.id);
    const appMap = Object.fromEntries(applications.map(a => [a.id, { job_id: a.job_id, candidate_id: a.candidate_id }]));

    // Get offers for these applications with ALL details
    const { data: offers, error: offersError } = await supabaseAdmin
      .from('job_offers')
      .select(`
        *,
        counter_offers (
          id,
          requested_salary,
          requested_currency,
          candidate_message,
          employer_response,
          response_type,
          status,
          created_at,
          responded_at
        )
      `)
      .in('application_id', appIds)
      .order('created_at', { ascending: false });

    if (offersError) {
      console.error('Error fetching offers:', offersError);
      return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 });
    }

    // Get candidate details (including email for video calls)
    const candidateIds = [...new Set(applications.map(a => a.candidate_id))];
    let candidateMap: Record<string, { name: string; email: string; avatar_url?: string }> = {};
    
    if (candidateIds.length > 0) {
      const { data: candidates } = await supabaseAdmin
        .from('candidates')
        .select('id, first_name, last_name, email, avatar_url')
        .in('id', candidateIds);

      if (candidates) {
        candidateMap = Object.fromEntries(
          candidates.map(c => [c.id, {
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
            email: c.email || '',
            avatar_url: c.avatar_url || undefined,
          }])
        );
      }
    }

    // Get video call rooms for these applications (for offer negotiation calls)
    const { data: videoCalls } = await supabaseAdmin
      .from('video_call_rooms')
      .select('*')
      .in('application_id', appIds)
      .eq('call_type', 'recruiter_offer') // Only offer-related calls
      .order('created_at', { ascending: false});

    const videoCallsByAppId: Record<string, any[]> = {};
    if (videoCalls) {
      for (const call of videoCalls) {
        if (!videoCallsByAppId[call.application_id]) {
          videoCallsByAppId[call.application_id] = [];
        }
        videoCallsByAppId[call.application_id].push({
          id: call.id,
          created_at: call.created_at,
          endedAt: call.ended_at,
          status: call.status,
          duration: call.duration_seconds,
          rating: call.rating,
          notes: call.notes,
        });
      }
    }

    // Format response with all fields needed for video calls and full details
    const formattedOffers = (offers || []).map(offer => {
      const app = appMap[offer.application_id];
      const candidateInfo = app ? candidateMap[app.candidate_id] : null;
      const videoCalls = videoCallsByAppId[offer.application_id] || [];
      
      return {
        id: offer.id,
        applicationId: offer.application_id,
        // Candidate info for video calls
        candidate_id: app?.candidate_id || null,
        candidate_name: candidateInfo?.name || 'Unknown',
        candidate_email: candidateInfo?.email || '',
        candidate_avatar: candidateInfo?.avatar_url || undefined,
        // Job info
        job_id: app?.job_id || null,
        job_title: app ? jobMap[app.job_id] || 'Unknown Job' : 'Unknown Job',
        // Offer details - ALL FIELDS
        salaryOffered: offer.salary_offered,
        currency: offer.currency || 'PHP',
        salaryType: offer.salary_type || 'monthly',
        start_date: offer.start_date,
        benefits: offer.benefits_offered,
        additionalTerms: offer.additional_terms,
        // Status and timestamps
        status: offer.status,
        sentAt: offer.sent_at || offer.created_at,
        viewedAt: offer.viewed_at,
        respondedAt: offer.responded_at,
        expiresAt: offer.expires_at,
        created_at: offer.created_at,
        updated_at: offer.updated_at,
        // Response info
        candidateResponse: offer.candidate_response,
        rejectionReason: offer.rejection_reason,
        // Counter offers
        counterOffers: (offer.counter_offers || []).map((co: any) => ({
          id: co.id,
          requestedSalary: co.requested_salary,
          requestedCurrency: co.requested_currency,
          candidateMessage: co.candidate_message,
          employerResponse: co.employer_response,
          responseType: co.response_type,
          status: co.status,
          created_at: co.created_at,
          respondedAt: co.responded_at,
        })),
        // Video calls (offer negotiation calls)
        offerCalls: videoCalls,
        // Negotiation history (derived from counter offers)
        negotiationHistory: [
          {
            id: 'initial',
            type: 'offer_sent',
            amount: Number(offer.salary_offered),
            currency: offer.currency,
            created_at: offer.sent_at || offer.created_at,
            actor: 'recruiter',
          },
          ...(offer.counter_offers || []).flatMap((co: any) => [
            {
              id: co.id,
              type: 'counter_offer',
              amount: Number(co.requested_salary),
              currency: co.requested_currency,
              note: co.candidate_message,
              created_at: co.created_at,
              actor: 'candidate',
            },
            ...(co.responded_at ? [{
              id: `${co.id}-response`,
              type: co.response_type === 'accepted' ? 'accepted' : co.response_type === 'rejected' ? 'rejected' : 'note',
              note: co.employer_response,
              created_at: co.responded_at,
              actor: 'recruiter',
            }] : [])
          ]),
          ...(offer.status === 'accepted' && offer.responded_at ? [{
            id: 'final-accept',
            type: 'accepted',
            created_at: offer.responded_at,
            actor: 'candidate',
          }] : []),
          ...(offer.status === 'rejected' && offer.responded_at ? [{
            id: 'final-reject',
            type: 'rejected',
            note: offer.rejection_reason,
            created_at: offer.responded_at,
            actor: 'candidate',
          }] : []),
        ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      };
    });

    return NextResponse.json({ 
      offers: formattedOffers,
      total: formattedOffers.length 
    });

  } catch (error) {
    console.error('Error in recruiter offers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/recruiter/offers
 * Create a new job offer
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuthToken(request);
    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { application_id, salaryOffered, currency, salaryType, startDate, benefits } = await request.json();

    if (!application_id || !salaryOffered) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get recruiter's agency_recruiters ID
    const { data: recruiter } = await supabaseAdmin
      .from('agency_recruiters')
      .select('id')
      .eq('user_id', userId)
      .single();

    // Create offer
    const { data: offer, error } = await supabaseAdmin
      .from('job_offers')
      .insert({
        application_id: application_id,
        salary_offered: salaryOffered,
        currency: currency || 'PHP',
        salary_type: salaryType || 'monthly',
        start_date: startDate,
        benefits_offered: benefits || [],
        status: 'sent',
        sent_at: new Date().toISOString(),
        created_by: recruiter?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating offer:', error);
      return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 });
    }

    // Update application status
    await supabaseAdmin
      .from('job_applications')
      .update({ status: 'offer_sent' })
      .eq('id', application_id);

    // Log timeline activity for offer sent
    try {
      await logApplicationActivity(application_id, {
        action_type: 'offer_sent',
        performed_by_type: 'recruiter',
        performed_by_id: recruiter?.id || userId,
        description: `Job offer sent: ${currency || 'PHP'} ${salaryOffered}${startDate ? ' (Start: ' + startDate + ')' : ''}`,
        metadata: {
          offer_id: offer.id,
          salary_offered: salaryOffered,
          currency: currency || 'PHP',
          salary_type: salaryType || 'monthly',
          start_date: startDate || null,
          benefits: benefits || [],
          timestamp: new Date().toISOString()
        }
      });
    } catch (logError) {
      console.error('Failed to log offer sent:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ success: true, offer });

  } catch (error) {
    console.error('Error creating offer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

