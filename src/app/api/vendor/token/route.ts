// vendor-dashboard/src/app/api/vendor/token/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ApprovedVendor } from '@/lib/types'; //

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Note: supabaseServiceKey is no longer needed in this specific file after backdoor removal.
// It's still needed in authServer.ts for real JWT verification/admin client.

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LoginRequestBody {
  email: string;
  password: string;
}

export async function POST(request: Request) {
  try {
    const { email, password }: LoginRequestBody = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { detail: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // 1. Authenticate with Supabase Auth
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user || !data.session) {
      console.error('Supabase authentication error:', authError);
      return NextResponse.json(
        { detail: authError?.message || 'Invalid credentials or user not found.' },
        { status: 401 }
      );
    }

    const authUserId = data.user.id; // Get the user ID from auth.users
    const userEmail = data.user.email;
    const accessToken = data.session.access_token;

    // 2. Verify if the authenticated user is an approved vendor by user_id
    const { data: vendorData, error: vendorError } = await supabase
      .from('approved_vendors')
      .select('id, email, status, user_id') 
      .eq('user_id', authUserId) // Lookup by auth.users.id
      .single();

    if (vendorError || !vendorData) {
      console.error('Approved vendor lookup error:', vendorError);
      await supabase.auth.signOut(); 
      return NextResponse.json(
        { detail: 'Your account is not linked to an approved vendor profile. Access denied.' },
        { status: 403 }
      );
    }

    if (vendorData.status !== 'active') {
      await supabase.auth.signOut();
      return NextResponse.json(
        { detail: 'Your vendor account is not active. Please contact support.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'bearer',
      user_email: userEmail,
      vendor_id: vendorData.id, // This is the approved_vendors.id
    });

  } catch (error) {
    console.error('API /api/vendor/token error:', error);
    return NextResponse.json(
      { detail: 'An unexpected error occurred during login.' },
      { status: 500 }
    );
  }
}