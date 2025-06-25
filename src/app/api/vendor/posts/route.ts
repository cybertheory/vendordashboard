// vendor-dashboard/src/app/api/vendor/posts/route.ts
import { NextResponse } from 'next/server';
import { getAuthenticatedVendor } from '@/utils/authServer'; 
import { createClient } from '@supabase/supabase-js'; 
import type { Post } from '@/lib/types'; 
import { v4 as uuidv4 } from 'uuid'; // Import uuid for generating IDs and tokens

// Supabase client for server-side operations (uses SERVICE_ROLE_KEY)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!; 

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables for API routes: SUPABASE_URL, SUPABASE_SERVICE_KEY.");
    // Handle error gracefully in production.
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// --- GET handler for /api/vendor/posts (already exists) ---
export async function GET(request: Request) {
  try {
    const { vendor } = await getAuthenticatedVendor(request); 

    const { data: posts, error: postsError } = await supabaseAdmin
      .from('posts')
      .select('*') 
      .eq('vendor_id', vendor.id) 
      .eq('config_id', vendor.config_id) 
      .order('created_at', { ascending: false }); 

    if (postsError) {
      console.error('Error fetching vendor posts:', postsError);
      throw new Error('Failed to retrieve your posts.');
    }

    return NextResponse.json(posts as Post[]);

  } catch (error: any) {
    console.error('Error in /api/vendor/posts (GET):', error);
    if (error.message.includes('Authentication token missing') || error.message.includes('Invalid or expired authentication token')) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error.includes('User is not an active approved vendor')) {
      return NextResponse.json({ detail: error.message || 'User is not an active approved vendor.' }, { status: 403 });
    }
    return NextResponse.json({ detail: error.message || 'Internal server error.' }, { status: 500 });
  }
}


// --- POST handler for /api/vendor/posts (to create a new post directly) ---
export async function POST(request: Request) {
  try {
    // Authenticate the request and get the vendor's profile
    const { vendor } = await getAuthenticatedVendor(request); 

    // Get post_data from the request body.
    // The type NewPostFormInput is defined in new-post/page.tsx for the frontend form.
    // It's a subset of Post, so we cast it for strong typing.
    const { post_data }: { post_data: Partial<Post> } = await request.json(); 

    if (!post_data) {
      return NextResponse.json({ detail: 'Post data is required.' }, { status: 400 });
    }

    // Generate UUIDs for new post and edit token
    const newPostId = uuidv4();
    const editToken = uuidv4(); 
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Construct the full post object with all required fields
    const postToInsert: Post = {
      id: newPostId,
      title: post_data.title || '', // Ensure required fields are handled
      description: post_data.description || null,
      price: post_data.price || null,
      category_id: post_data.category_id || '', // Must be provided by frontend
      subcategory_id: post_data.subcategory_id || null,
      email: vendor.email, // Use vendor's email from authenticated profile
      status: 'verified', // Set status to "verified" as requested
      is_featured: post_data.is_featured || false,
      has_photo: post_data.has_photo || false, // Will be true if photos selected
      photo_urls: [], // Initial empty array, updated by upload-post-image
      edit_token: editToken,
      edit_token_expires_at: expiresAt.toISOString(),
      vendor_id: vendor.id, // From authenticated vendor
      is_vendor_post: true, // Always true for vendor posts
      condition: post_data.condition || null,
      brand: post_data.brand || null,
      dimensions: post_data.dimensions || null,
      location: post_data.location || null,
      bedrooms: post_data.bedrooms || null,
      bathrooms: post_data.bathrooms || null,
      square_feet: post_data.square_feet || null,
      job_type: post_data.job_type || null,
      compensation: post_data.compensation || null,
      company_name: post_data.company_name || vendor.company_name, // Use vendor's company name
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      published_at: now.toISOString(), // Publish immediately
      expires_at: expiresAt.toISOString(),
      config_id: vendor.config_id, // From authenticated vendor
      is_scraped: false, // Not scraped
      scraped_url: null,
    };

    // Validate that category_id is one of the vendor's allowed categories
    if (!vendor.allowed_categories.includes(postToInsert.category_id)) {
        return NextResponse.json(
            { detail: 'Vendor is not allowed to post in the selected main category.' },
            { status: 403 }
        );
    }
    // If subcategory is provided, ensure it's a child of the main category
    if (postToInsert.subcategory_id) {
        // You might need an additional lookup here to verify subcategory relationship
        // if this isn't implicitly handled by frontend data structure.
        // For now, we trust frontend selection but could add a DB query here if needed.
    }


    // Insert the new post directly into the 'posts' table
    const { data: newPost, error: insertError } = await supabaseAdmin
      .from('posts')
      .insert([postToInsert])
      .select() // Select the newly inserted row
      .single();

    if (insertError || !newPost) {
      console.error('Error inserting new post:', insertError);
      throw new Error(`Failed to create post: ${insertError?.message || 'Database error'}`);
    }

    // Return the newly created post's ID and edit token to the frontend
    return NextResponse.json({
      message: 'Post created successfully!',
      postId: newPost.id,
      editToken: newPost.edit_token,
    });

  } catch (error: any) {
    console.error('Error in /api/vendor/posts (POST):', error);
    if (error.message.includes('Authentication token missing') || error.message.includes('Invalid or expired authentication token')) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error.includes('User is not an active approved vendor') || error.message.includes('not allowed to post')) {
      return NextResponse.json({ detail: error.message || 'Unauthorized or forbidden action.' }, { status: 403 });
    }
    return NextResponse.json({ detail: error.message || 'Internal server error.' }, { status: 500 });
  }
}