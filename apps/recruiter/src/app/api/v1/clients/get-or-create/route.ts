import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateApiKey } from '../../auth';
import { handleCorsOptions, withCors } from '../../cors';
import { transformToApi, transformFromApi } from '@/lib/api/transform';
import { findBestMatch } from '@/lib/utils/fuzzy-match';

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * POST /api/v1/clients/get-or-create
 * 
 * Find existing client or create new one for the agency.
 * Returns the BPOC client ID that the agency portal should store.
 * 
 * Body:
 *   name: string (required) - Company name
 *   email: string (optional) - Used for matching existing
 *   industry: string (optional)
 *   website: string (optional)
 *   contact_name: string (optional)
 *   contact_email: string (optional)
 *   contact_phone: string (optional)
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if ('error' in auth) {
    return withCors(NextResponse.json({ error: auth.error }, { status: auth.status }));
  }

  try {
    const body = await request.json();
    // Accept both camelCase and snake_case input
    const input = transformFromApi(body);
    const { 
      name, 
      email, 
      industry, 
      website,
      contact_name,
      contact_email,
      contact_phone,
    } = input;

    if (!name) {
      return withCors(NextResponse.json({ 
        error: 'Missing required field: name' 
      }, { status: 400 }));
    }

    // Type definition for client with company data
    type ClientWithCompany = {
      id: string;
      companies: {
        id: string;
        name: string;
        email: string | null;
      };
    };

    // First, check if a client with this name already exists for this agency
    const { data: existingClientsRaw } = await supabaseAdmin
      .from('agency_clients')
      .select(`
        id,
        companies!inner (
          id,
          name,
          email
        )
      `)
      .eq('agency_id', auth.agency_id);

    // Cast to proper type
    const existingClients = existingClientsRaw as ClientWithCompany[] | null;

    // Build list of candidates for fuzzy matching
    const candidates = (existingClients || [])
      .filter(c => c.companies?.name) // Only clients with company names
      .map(c => ({
        id: c.id,
        companyId: c.companies.id,
        name: c.companies.name,
        email: c.companies.email,
      }));

    console.log('🔍 Searching for client:', name);
    console.log('📊 Found', candidates.length, 'existing clients for agency');

    // Use fuzzy matching to find best match
    // This handles variations like "ShoreAgents Inc" vs "Shore Agents INC"
    const bestMatch = findBestMatch(name, candidates, {
      minSimilarity: 85, // 85% similarity threshold
      matchEmail: email, // Prioritize email match if provided
    });

    if (bestMatch) {
      console.log('✅ Found matching client:', {
        name: bestMatch.match.name,
        similarity: bestMatch.similarity + '%',
        method: bestMatch.similarity === 100 && email ? 'email' : 'fuzzy name match'
      });

      // Return existing client (using snake_case then transform)
      const response = {
        client_id: bestMatch.match.id,
        company_id: bestMatch.match.companyId,
        name: bestMatch.match.name,
        created: false,
        matched_by: bestMatch.similarity === 100 && email ? 'email' : 'name',
        similarity: bestMatch.similarity,
        message: `Existing client found (${bestMatch.similarity}% match)`,
      };
      return withCors(NextResponse.json(transformToApi(response)));
    }

    console.log('➕ No match found - creating new client for:', name);

    // No match - create new company and client

    // 1. Create company record
    const { data: newCompany, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name,
        email: email || null,
        industry: industry || null,
        website: website || null,
      })
      .select()
      .single();

    if (companyError || !newCompany) {
      console.error('Failed to create company:', companyError);
      return withCors(NextResponse.json({ 
        error: 'Failed to create company',
        details: companyError?.message 
      }, { status: 500 }));
    }

    // 2. Create agency_client link
    const { data: newClient, error: clientError } = await supabaseAdmin
      .from('agency_clients')
      .insert({
        agency_id: auth.agency_id,
        company_id: newCompany.id,
        status: 'active',
        primary_contact_name: contact_name || null,
        primary_contact_email: contact_email || null,
        primary_contact_phone: contact_phone || null,
      })
      .select()
      .single();

    if (clientError || !newClient) {
      console.error('Failed to create client:', clientError);
      // Rollback company creation
      await supabaseAdmin.from('companies').delete().eq('id', newCompany.id);
      return withCors(NextResponse.json({ 
        error: 'Failed to create client',
        details: clientError?.message 
      }, { status: 500 }));
    }

    console.log('✅ New client created:', {
      client_id: newClient.id,
      company_id: newCompany.id,
      name: newCompany.name,
    });

    const response = {
      client_id: newClient.id,  // This is the BPOC client ID to store
      company_id: newCompany.id,
      name: newCompany.name,
      created: true,
      message: 'New client created successfully',
    };
    return withCors(NextResponse.json(transformToApi(response), { status: 201 }));

  } catch (error) {
    console.error('API v1 clients/get-or-create error:', error);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

