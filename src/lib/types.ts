// vendor-dashboard/src/lib/types.ts

// --- Core Marketplace Types ---
export interface Config {
  id: string;
  school_id: string;
  school_name: string;
  site_name: string;
  site_url: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  header_background_color: string;
  footer_background_color: string;
  sidebar_background_color: string;
  content_background_color: string;
  link_color: string;
  text_color: string;
  secondary_text_color: string;
  border_color: string;
  button_color: string;
  button_text_color: string;
  header_text: string;
  footer_text: string;
  contact_email: string;
  created_at: string;
  updated_at: string;
  approved_email_domains: string[];
  city_name: string;
  base_url: string;
  is_scraping: boolean;
  state_abbreviated: string;
  presence_count: number;
  presence_last_updated: string;
  presence_base_count: number;
  subreddit_url: string;
  search_radius: number;
  zip_code: number;
}

export interface Post {
  id: string;
  title: string;
  description: string;
  price?: number; // Optional
  category_id: string;
  subcategory_id?: string; // Optional
  email: string;
  status: string;
  is_featured: boolean;
  has_photo: boolean;
  photo_urls: string[];
  edit_token: string;
  edit_token_expires_at: string;
  vendor_id?: string; // Optional, only if it's a vendor post
  is_vendor_post: boolean;
  condition?: string; // Optional
  brand?: string; // Optional
  dimensions?: string; // Optional
  location?: string; // Optional
  bedrooms?: number; // Optional
  bathrooms?: number; // Optional
  square_feet?: number; // Optional
  job_type?: string; // Optional
  compensation?: string; // Optional
  company_name?: string; // Optional
  created_at: string;
  updated_at: string;
  published_at: string;
  expires_at: string;
  config_id: string;
  is_scraped: boolean;
  scraped_url?: string; // Optional
}

// --- Vendor Specific Types ---
export interface ApprovedVendor {
  id: string;
  email: string;
  company_name: string;
  contact_name?: string;
  phone?: string;
  website?: string;
  allowed_categories: string[]; // UUIDs of categories
  status: string; // e.g., 'active', 'inactive'
  subscription_tier: string;
  subscription_amount: number;
  subscription_start_date?: string;
  subscription_expiry?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  config_id: string; // Links to Config table
}

// --- Category Types ---
export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  parent_id?: string; // For hierarchical categories
  display_order?: number;
  last_post_time?: string;
  created_at: string;
}