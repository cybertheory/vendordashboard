// vendor-dashboard/src/app/api/vendor/me/route.ts
import { NextResponse } from 'next/server';
import { getAuthenticatedVendor } from '@/utils/authServer'; // Your authentication helper
import type { ApprovedVendor } from '@/lib/types'; // Import ApprovedVendor type

// GET handler for /api/vendor/me
export async function GET(request: Request) {
  try {
    // Authenticate the request and get the vendor's profile
    // This helper uses SUPABASE_JWT_SECRET and SUPABASE_SERVICE_KEY internally.
    const { vendor } = await getAuthenticatedVendor(request); 

    // Return the authenticated vendor's profile data
    return NextResponse.json(vendor as ApprovedVendor);

  } catch (error: any) {
    console.error('Error in /api/vendor/me:', error);
    // Return appropriate error response based on the error message from authServer.ts
    if (error.message.includes('Authentication token missing') || error.message.includes('Invalid or expired authentication token')) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error.message.includes('User is not an active approved vendor')) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }
    return NextResponse.json({ detail: error.message || 'Internal server error.' }, { status: 500 });
  }
}