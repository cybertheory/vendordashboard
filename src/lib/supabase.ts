// vendor-dashboard/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Ensure these are set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  // In a real app, you might want a more robust error display or fallback
}

// Create a Supabase client for client-side interactions
export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function for handling Supabase errors (from ucinternal)
export function handleSupabaseError(error: any, operation: string) {
  console.error(`Supabase error in ${operation}:`, error);

  if (error?.code === 'PGRST116') {
    throw new Error('No data found');
  } else if (error?.code === 'PGRST301') {
    throw new Error('Unauthorized access');
  } else if (error?.message) {
    throw new Error(error.message);
  } else {
    throw new Error(`Failed to ${operation}`);
  }
}