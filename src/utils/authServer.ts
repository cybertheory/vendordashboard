// vendor-dashboard/src/utils/authServer.ts
import { createClient } from '@supabase/supabase-js';
import type { ApprovedVendor } from '@/lib/types'; //
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken'; // You should have this installed

// Supabase configuration for server-side (API Route) use.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// This key is used for admin-level lookups (e.g., in the backdoor) and bypassing RLS.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!; 
// This secret is used for verifying real Supabase JWTs.
const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET!; 

if (!supabaseUrl || !supabaseJwtSecret) {
    console.error("Missing critical Supabase environment variables for server-side auth (SUPABASE_URL, SUPABASE_JWT_SECRET).");
}
if (!supabaseServiceKey) {
    console.warn("SUPABASE_SERVICE_KEY is missing. Some backend operations (e.g., admin tasks, bypassing RLS) may fail.");
}

// Client for admin-level lookups (uses SERVICE_ROLE_KEY)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || 'dummy-key');

interface DecodedToken {
  sub: string; // This is the auth.users.id from a real JWT
  email: string;
  // Add other relevant claims from your Supabase JWT if needed
}

// === WARNING: BACKDOOR MOCK TOKEN VALUE ===
// This must exactly match the mock token returned by /api/vendor/token route's backdoor.
const MOCK_TEST_TOKEN = 'mock-test-token-for-dev';
// ===========================================

export async function getAuthenticatedVendor(request: Request): Promise<{ vendor: ApprovedVendor; accessToken: string }> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split(' ')[1]; // Expects 'Bearer <token>'

  if (!token) {
    throw new Error('Authentication token missing.');
  }

  let decoded: DecodedToken;

  // === BACKDOOR CHECK IN AUTHENTICATION HELPER ===
  // If the token is our specific mock token, bypass actual JWT verification.
  if (token === MOCK_TEST_TOKEN) {
    console.warn("BACKDOOR TOKEN USED: Bypassing JWT verification for testing.");
    
    // These values must match what your /api/vendor/token route's backdoor returns
    // and what you've configured in your DB for your test vendor.
    const TEST_EMAIL_FROM_BACKDOOR = 'testcars@example.com'; 
    const TEST_USER_AUTH_ID_FOR_BACKDOOR = '34fdd697-0589-4805-9f44-fc9c20c329c3'; // This is the auth.users.id

    decoded = {
      sub: TEST_USER_AUTH_ID_FOR_BACKDOOR, // Simulate the 'sub' claim (auth.users.id)
      email: TEST_EMAIL_FROM_BACKDOOR,
    };

  } else {
    // If it's not the mock token, attempt real JWT verification.
    try {
      // This step requires SUPABASE_JWT_SECRET to be correctly set in .env.local
      decoded = jwt.verify(token, supabaseJwtSecret) as DecodedToken;
    } catch (error) {
      console.error('JWT verification failed for real token:', error);
      throw new Error('Invalid or expired authentication token.');
    }
  }
  // ===============================================

  const authUserId = decoded.sub; // This is the auth.users.id from the decoded token (real or mock)

  // Perform vendor lookup using supabaseAdmin (with SERVICE_ROLE_KEY).
  // This client bypasses RLS policies, ensuring the lookup works to find the vendor linked by user_id.
  const { data: vendorData, error: vendorError } = await supabaseAdmin
    .from('approved_vendors')
    .select('*') // Select all fields for the vendor
    .eq('user_id', authUserId) // Lookup by auth.users.id
    .single();

  if (vendorError || !vendorData || vendorData.status !== 'active') {
    console.error('Vendor lookup/status check failed:', vendorError);
    // This error indicates either:
    // 1. No approved_vendors row with the matching user_id.
    // 2. The found approved_vendors row has status !== 'active'.
    throw new Error('User is not an active approved vendor.');
  }

  return { vendor: vendorData as ApprovedVendor, accessToken: token };
}