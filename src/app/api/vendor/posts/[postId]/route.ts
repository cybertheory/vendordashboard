// vendor-dashboard/src/app/api/vendor/posts/[postId]/route.ts
import { NextResponse } from 'next/server';
import { getAuthenticatedVendor } from '@/utils/authServer'; 
import { createClient } from '@supabase/supabase-js'; 
import type { Post } from '@/lib/types'; //

// Supabase configuration for server-side operations (uses SERVICE_ROLE_KEY)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!; 

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables for API routes: SUPABASE_URL, SUPABASE_SERVICE_KEY.");
    // Handle error gracefully in production.
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// --- GET handler for /api/vendor/posts/[postId] ---
export async function GET(request: Request, { params }: { params: { postId: string } }) {
  try {
    const { vendor } = await getAuthenticatedVendor(request); 
    const postId = params.postId;
    if (!postId) { return NextResponse.json({ detail: 'Post ID is required.' }, { status: 400 }); }
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('vendor_id', vendor.id)
      .single();
    if (postError || !post) {
      console.error('Error fetching single post:', postError);
      return NextResponse.json({ detail: 'Post not found or unauthorized to access.' }, { status: 404 });
    }
    return NextResponse.json(post as Post);
  } catch (error: any) {
    console.error('Error in /api/vendor/posts/[postId] (GET):', error);
    if (error.message.includes('Authentication token missing') || error.message.includes('Invalid or expired authentication token')) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error.message.includes('User is not an active approved vendor') || error.message.includes('unauthorized to access')) {
      return NextResponse.json({ detail: error.message || 'Unauthorized or forbidden action.' }, { status: 403 });
    }
    return NextResponse.json({ detail: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// --- DELETE handler for /api/vendor/posts/[postId] ---
export async function DELETE(request: Request, { params }: { params: { postId: string } }) {
  try {
    const { vendor } = await getAuthenticatedVendor(request); 
    const postId = params.postId;
    if (!postId) { return NextResponse.json({ detail: 'Post ID is required.' }, { status: 400 }); }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: postData, error: postError } = await supabaseAdmin
      .from('posts')
      .select('edit_token, config_id, vendor_id')
      .eq('id', postId)
      .eq('vendor_id', vendor.id)
      .single();
    if (postError || !postData) {
      console.error('Error fetching post for deletion token:', postError);
      return NextResponse.json({ detail: 'Post not found or unauthorized to delete.' }, { status: 404 });
    }
    const editToken = postData.edit_token;
    const configId = postData.config_id;
    const edgeFunctionResponse = await fetch(`${supabaseUrl}/functions/v1/delete-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({ token: editToken, postId: postId, config_id: configId }),
    });
    if (!edgeFunctionResponse.ok) {
      const errorData = await edgeFunctionResponse.json();
      console.error('Supabase Edge Function (delete-post) error:', errorData);
      return NextResponse.json({ detail: errorData.error || 'Failed to delete post via Edge Function.' }, { status: edgeFunctionResponse.status });
    }
    const data = await edgeFunctionResponse.json();
    if (data.success) { return NextResponse.json({ message: data.message }); } else { return NextResponse.json({ detail: data.error || 'Failed to delete post.' }, { status: 500 }); }
  } catch (error: any) {
    console.error('Error in /api/vendor/posts/[postId] (DELETE):', error);
    if (error.message.includes('Authentication token missing') || error.message.includes('Invalid or expired authentication token')) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error.message.includes('User is not an active approved vendor') || error.message.includes('unauthorized to delete')) {
      return NextResponse.json({ detail: error.message || 'Unauthorized or forbidden action.' }, { status: 403 });
    }
    return NextResponse.json({ detail: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// --- PATCH handler for /api/vendor/posts/[postId] (to update a post) ---
export async function PATCH(request: Request, { params }: { params: { postId: string } }) {
  try {
    const { vendor } = await getAuthenticatedVendor(request); 
    const postId = params.postId;
    const updates: Partial<Post> = await request.json(); 

    if (!postId || !updates) {
      return NextResponse.json({ detail: 'Post ID and update data are required.' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    // Perform the update directly on the 'posts' table.
    // REMOVED .single() here to avoid PGRST116/null errors on successful updates
    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .eq('vendor_id', vendor.id); 
      // .single(); <-- REMOVED THIS LINE!

    if (updateError) { // Now, only check for a non-null error object
      console.error('Supabase update error details (PATCH):', JSON.stringify(updateError, null, 2)); 
      throw new Error(`Failed to update post: ${updateError?.message || 'Database error'}`);
    }
    
    // If updateError is null, the update was successful.
    // We can return a success message or refetch the updated post if needed.
    // For simplicity, we just return a success message as the frontend will re-fetch listings.
    return NextResponse.json({ message: 'Post updated successfully!' });

  } catch (error: any) {
    console.error('Error in /api/vendor/posts/[postId] (PATCH):', error);
    if (error.message.includes('Authentication token missing') || error.message.includes('Invalid or expired authentication token')) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error.message.includes('User is not an active approved vendor') || error.message.includes('unauthorized to update')) {
      return NextResponse.json({ detail: error.message || 'Unauthorized or forbidden action.' }, { status: 403 });
    }
    return NextResponse.json({ detail: error.message || 'Internal server error.' }, { status: 500 });
  }
}