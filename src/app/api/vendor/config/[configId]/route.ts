// vendor-dashboard/src/app/api/vendor/config/[configId]/route.ts
import { NextResponse } from 'next/server';
import { getAuthenticatedVendor } from '@/utils/authServer'; // Your authentication helper
import { createClient } from '@supabase/supabase-js'; // Import createClient for database ops
import type { Config } from '@/lib/types'; // Import Config type [cite: types.ts]

// Supabase client for admin-level lookups (needs SERVICE_ROLE_KEY)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!; 

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables for API routes: SUPABASE_URL, SUPABASE_SERVICE_KEY.");
    // In a real application, handle this gracefully.
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// GET handler for /api/vendor/config/[configId]
// Fetches a specific Config by its ID
export async function GET(request: Request, { params }: { params: { configId: string } }) {
  try {
    // Authenticate the request first (though config data is not user-owned, this protects the API endpoint)
    await getAuthenticatedVendor(request); 

    const configId = params.configId;

    if (!configId) {
      return NextResponse.json({ detail: 'Config ID is required.' }, { status: 400 });
    }

    // Fetch the config data using the admin client to bypass RLS
    // This is safe because this endpoint only *reads* a single config record based on its ID.
    const { data: configData, error: configError } = await supabaseAdmin
      .from('config')
      .select('id, school_name') // Only select necessary fields
      .eq('id', configId)
      .single();

    if (configError || !configData) {
      console.error('Error fetching config:', configError);
      return NextResponse.json(
        { detail: 'Configuration not found or failed to fetch.' },
        { status: 404 }
      );
    }

    // Return only the necessary config details
    return NextResponse.json({
      id: configData.id,
      school_name: configData.school_name,
    });

  } catch (error: any) {
    console.error('Error in /api/vendor/config/[configId]:', error);
    if (error.message.includes('Authentication token missing') || error.message.includes('Invalid or expired authentication token')) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error.message.includes('User is not an active approved vendor')) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }
    return NextResponse.json({ detail: error.message || 'Internal server error.' }, { status: 500 });
  }
}