// vendor-dashboard/src/app/api/vendor/categories/route.ts
import { NextResponse } from 'next/server';
import { getAuthenticatedVendor } from '@/utils/authServer'; // Your authentication helper
import { createClient } from '@supabase/supabase-js'; // Import createClient for database ops
import type { Category } from '@/lib/types'; // Import Category type

// Supabase configuration for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!; 

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables for API routes: SUPABASE_URL, SUPABASE_SERVICE_KEY.");
    // In a real application, you might throw an error or handle this more gracefully.
}

// Use a client with SERVICE_ROLE_KEY to bypass RLS for fetching categories
// This is because categories are global and not user-owned, and you want to filter them
// based on 'allowed_categories' after fetching.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);


// GET handler for /api/vendor/categories
export async function GET(request: Request) {
  try {
    // Authenticate the request and get the vendor's profile
    // This will give us the vendor.allowed_categories and vendor.config_id
    const { vendor } = await getAuthenticatedVendor(request); 

    // Extract allowed_categories from the authenticated vendor's profile
    const allowedCategoryIds = vendor.allowed_categories;
    const vendorConfigId = vendor.config_id;

    if (!allowedCategoryIds || allowedCategoryIds.length === 0) {
      return NextResponse.json(
        { detail: 'No categories assigned to this vendor.' },
        { status: 200 } // Return 200 with empty array or message if no allowed categories
      );
    }

    // Fetch categories from the database that match the allowedCategoryIds
    // Use supabaseAdmin to ensure this lookup works regardless of RLS on 'categories'
    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from('categories')
      .select('*') // Select all fields for the category
      .in('id', allowedCategoryIds) // Filter by the allowed category IDs
      .order('name', { ascending: true }); // Order by name for consistent display

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      throw new Error('Failed to fetch categories.');
    }

    // Return the filtered list of categories
    return NextResponse.json(categories as Category[]);

  } catch (error: any) {
    console.error('Error in /api/vendor/categories:', error);
    // Return appropriate error response
    if (error.message.includes('Authentication token missing') || error.message.includes('Invalid or expired authentication token')) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error.message.includes('User is not an active approved vendor')) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }
    return NextResponse.json({ detail: error.message || 'Internal server error.' }, { status: 500 });
  }
}