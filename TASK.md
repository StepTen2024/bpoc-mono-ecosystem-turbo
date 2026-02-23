# Task: Build Recruiter Sync API Endpoint

## Context
BPOC is a recruitment platform. Agencies connect via API keys stored on `agencies.api_key`. 
The existing `/api/v1/clients/get-or-create` endpoint (at `apps/recruiter/src/app/api/v1/clients/get-or-create/route.ts`) is the pattern to follow.

## What to Build
Create `/api/v1/recruiters/get-or-create` endpoint in the recruiter app.

### Location
`apps/recruiter/src/app/api/v1/recruiters/get-or-create/route.ts`

### Behavior
1. Authenticate via `X-API-Key` header (use `validateApiKey` from `../../auth`)
2. Accept POST body: `{ email, first_name, last_name, phone?, position?, linkedin_url? }`
3. Check if recruiter with this email already exists for this agency in `agency_recruiters` table
4. If exists → return existing recruiter ID
5. If not → create auth user (via supabaseAdmin.auth.admin.createUser with email_confirm:true, role:'recruiter' in user_metadata), then create `agency_recruiters` record linked to the agency
6. Return: `{ recruiter_id, email, name, created: boolean }`

### Follow the exact patterns from:
- `apps/recruiter/src/app/api/v1/clients/get-or-create/route.ts` (CORS, auth, transform)
- `apps/recruiter/src/app/api/v1/auth.ts` (validateApiKey)
- `apps/recruiter/src/app/api/v1/cors.ts` (handleCorsOptions, withCors)
- `@/lib/api/transform` (transformToApi, transformFromApi)

### Important
- Include OPTIONS handler for CORS
- Set verification_status to 'verified' (they're being added by the agency via API, already trusted)
- Set is_active: true, can_post_jobs: true, can_manage_applications: true
- Use `supabaseAdmin` from `@/lib/supabase/admin`
- Generate a random password for the auth user (they'll use magic link to login)

Do NOT modify any existing files. Only create the new route file.
Commit when done with message: "feat: add /api/v1/recruiters/get-or-create endpoint"
