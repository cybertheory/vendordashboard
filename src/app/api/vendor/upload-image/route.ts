// vendor-dashboard/src/app/api/vendor/upload-image/route.ts
import { NextResponse } from 'next/server';
import { getAuthenticatedVendor } from '@/utils/authServer'; // For authenticating the vendor
// No need to import createClient here as we're proxying to Edge Function

// Supabase URL (publicly accessible, so fine to use NEXT_PUBLIC_)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Supabase Service Role Key (SERVER-SIDE ONLY)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!; 

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing critical Supabase environment variables for image upload proxy.");
  // In a real application, handle this more gracefully.
}

// POST handler for /api/vendor/upload-image
export async function POST(request: Request) {
  try {
    // Authenticate the vendor making the request to this proxy API route
    // This ensures only logged-in vendors can upload
    await getAuthenticatedVendor(request); 

    // The request from the frontend will be FormData
    const formData = await request.formData();

    // The Edge Function expects 'token', 'postId', 'config_id', 'image'
    const token = formData.get('token');
    const postId = formData.get('postId');
    const config_id = formData.get('config_id');
    const imageFile = formData.get('image'); // This is a File object

    if (!token || !postId || !config_id || !imageFile) {
      return NextResponse.json(
        { detail: 'Missing required fields for image upload: token, postId, config_id, image.' },
        { status: 400 }
      );
    }

    // Forward the FormData directly to the Supabase Edge Function
    // The Authorization header with SERVICE_KEY is added securely here on the server
    const edgeFunctionResponse = await fetch(`${supabaseUrl}/functions/v1/upload-post-image`, { //
      method: 'POST',
      headers: {
        // DO NOT set Content-Type here for FormData, fetch sets it correctly
        'Authorization': `Bearer ${supabaseServiceKey}` // Securely use SERVICE_KEY
      },
      body: formData, // Forward the original FormData
    });

    if (!edgeFunctionResponse.ok) {
      const errorData = await edgeFunctionResponse.json();
      console.error('Supabase Edge Function (upload-post-image) error:', errorData);
      return NextResponse.json(
        { detail: errorData.error || 'Failed to upload image via Edge Function.' },
        { status: edgeFunctionResponse.status }
      );
    }

    // Return the response from the Edge Function to the frontend
    const data = await edgeFunctionResponse.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error in /api/vendor/upload-image (Proxy):', error);
    // Handle authentication/authorization errors from getAuthenticatedVendor
    if (error.message.includes('Authentication token missing') || error.message.includes('Invalid or expired authentication token')) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error.message.includes('User is not an active approved vendor')) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }
    return NextResponse.json({ detail: error.message || 'Internal server error during image upload.' }, { status: 500 });
  }
}