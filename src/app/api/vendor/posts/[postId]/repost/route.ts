// vendor-dashboard/src/app/api/vendor/posts/[postId]/repost/route.ts
import { NextResponse } from 'next/server';
import { getAuthenticatedVendor } from '@/utils/authServer'; 
import { createClient } from '@supabase/supabase-js'; 
import type { Post } from '@/lib/types'; 
import { v4 as uuidv4 } from 'uuid'; // Import uuid for generating new IDs

// Supabase client for server-side operations (uses SERVICE_ROLE_KEY)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!; 

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables for API routes: SUPABASE_URL, SUPABASE_SERVICE_KEY.");
    // Handle error gracefully in production.
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// POST handler for /api/vendor/posts/[postId]/repost
export async function POST(request: Request, { params }: { params: { postId: string } }) {
  try {
    // Authenticate the request and get the vendor's profile
    const { vendor } = await getAuthenticatedVendor(request); 

    const originalPostId = params.postId;

    if (!originalPostId) {
      return NextResponse.json({ detail: 'Original Post ID is required.' }, { status: 400 });
    }

    // 1. Fetch the original post data
    const { data: originalPost, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('*') // Select all fields to copy them
      .eq('id', originalPostId)
      .eq('vendor_id', vendor.id) // Ensure only the owner can repost their own post
      .single();

    if (fetchError || !originalPost) {
      console.error('Error fetching original post for repost:', fetchError);
      return NextResponse.json(
        { detail: 'Original post not found or unauthorized to repost.' },
        { status: 404 }
      );
    }

    // 2. Create a new post object based on the original
    const newPostId = uuidv4(); // Generate a new ID for the reposted item
    const newEditToken = uuidv4(); // Generate a new edit token for the reposted item
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // New expiry (30 days from now)

    const repostedPost: Post = {
      ...originalPost, // Copy all fields from the original post
      id: newPostId, // Override with new ID
      edit_token: newEditToken, // Override with new edit token
      edit_token_expires_at: newExpiresAt.toISOString(), // New expiry timestamp
      created_at: now.toISOString(), // Set creation time to now
      updated_at: now.toISOString(), // Set update time to now
      published_at: now.toISOString(), // Set published time to now (re-publish)
      expires_at: newExpiresAt.toISOString(), // Set new expiry time
      // Ensure these crucial fields are correct even if copied
      status: 'verified', // New posts should be 'verified' as per previous request
      is_vendor_post: true, 
      is_scraped: false, // Ensure reposted posts aren't marked as scraped
      scraped_url: null, // Clear scraped URL if present
    };

    // 3. Remove `id` from the object for insertion if it was passed by `...originalPost` and isn't allowed
    // (Supabase usually handles generating ID if not provided, but we generate it explicitly)
    // Ensure no `undefined` values from optional fields that cause issues
    const cleanRepostedPost = Object.fromEntries(
      Object.entries(repostedPost).filter(([_, value]) => value !== undefined)
    ) as Post;


    // 4. Insert the new post into the 'posts' table
    const { data: insertedPost, error: insertError } = await supabaseAdmin
      .from('posts')
      .insert([cleanRepostedPost])
      .select() // Select the newly inserted row to return it
      .single();

    if (insertError || !insertedPost) {
      console.error('Error inserting reposted post:', insertError);
      throw new Error(`Failed to repost item: ${insertError?.message || 'Database error'}`);
    }

    // Return success message and new post details
    return NextResponse.json({
      message: 'Post reposted successfully!',
      postId: insertedPost.id,
      editToken: insertedPost.edit_token,
    });

  } catch (error: any) {
    console.error('Error in /api/vendor/posts/[postId]/repost (POST):', error);
    if (error.message.includes('Authentication token missing') || error.message.includes('Invalid or expired authentication token')) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error.message.includes('User is not an active approved vendor') || error.message.includes('unauthorized to repost')) {
      return NextResponse.json({ detail: error.message || 'Unauthorized or forbidden action.' }, { status: 403 });
    }
    return NextResponse.json({ detail: error.message || 'Internal server error.' }, { status: 500 });
  }
}