// vendor-dashboard/src/app/dashboard/new-post/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getAccessToken, getVendorId, clearAuthData } from '@/lib/auth';
import { ChevronLeftIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import type { Category, Post, ApprovedVendor } from '@/lib/types'; //

// Define the type for the data structure the API will expect for post creation.
type NewPostFormInput = Omit<Post, 
  'id' | 'created_at' | 'updated_at' | 'published_at' | 'expires_at' | 
  'edit_token' | 'edit_token_expires_at' | 'status' | 'is_featured' | 
  'photo_urls' | 'has_photo' | 'is_scraped' | 'scraped_url' | 
  'vendor_id' | 'config_id'
> & {
  price: number; 
  email?: string; 
};


export default function NewPostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true); // Initial page load state (for categories)
  const [error, setError] = useState<string | null>(null); // Error for initial data fetch
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(''); // Category ID
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>(''); // Subcategory ID
  
  const [formLoading, setFormLoading] = useState(false); // State for form submission
  const [formError, setFormError] = useState<string | null>(null); // Error for form submission
  const [formSuccess, setFormSuccess] = useState<string | null>(null); // Success for form submission

  // Form state for inputs
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [photos, setPhotos] = useState<File[]>([]); // For chosen files
  
  // State to hold vendor profile needed for config_id during photo upload.
  // This is fetched independently for this page to ensure config_id is always available for Edge Function calls.
  const [vendorProfile, setVendorProfile] = useState<ApprovedVendor | null>(null); 


  useEffect(() => {
    // Authenticate user on page load
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    // Fetch categories and vendor profile simultaneously
    const fetchData = async () => {
      await fetchCategories();
      await fetchVendorProfileForConfigId(); // Fetch profile early for config_id
      setLoading(false); // Set overall loading to false after both fetches
    };
    fetchData();
  }, [router]);

  // Filter subcategories based on selectedCategory
  useEffect(() => {
    if (selectedCategory) {
      const children = categories.filter(cat => cat.parent_id === selectedCategory);
      setSubcategories(children);
      setSelectedSubcategory(''); // Reset subcategory when parent changes
    } else {
      setSubcategories([]);
      setSelectedSubcategory('');
    }
  }, [selectedCategory, categories]);

  // Fetches all categories allowed to the vendor
  const fetchCategories = async () => {
    setError(null);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error("No access token found. Please log in again.");
      }

      const response = await fetch('/api/vendor/categories', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch categories');
      }
      const data: Category[] = await response.json();
      setCategories(data); // This is where the categories state is updated.

    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError(err.message || 'Failed to load categories.');
      if (err.message.includes('token missing') || err.message.includes('Invalid or expired')) {
        clearAuthData(); //
        router.push('/login');
      }
    }
  };

  // Fetches vendor profile specifically for config_id needed for photo upload
  const fetchVendorProfileForConfigId = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) return; // Handled by isAuthenticated check above
    try {
      const response = await fetch('/api/vendor/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data: ApprovedVendor = await response.json();
        setVendorProfile(data);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch vendor profile for config_id in new-post page:", errorData);
      }
    } catch (e) {
      console.error("Failed to fetch vendor profile for config_id in new-post page:", e);
    }
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prevPhotos => [...prevPhotos, ...Array.from(e.target.files)]);
    }
  };
  
  const removePhoto = (index: number) => {
    setPhotos(prevPhotos => prevPhotos.filter((_, i) => i !== index));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    const vendorId = getVendorId(); 
    if (!vendorId) {
      setFormError('Vendor ID not found. Please log in again.');
      setFormLoading(false);
      return;
    }

    if (!selectedCategory || !title || price === null || price < 0) {
      setFormError('Please fill all required fields: Category, Title, Price.');
      setFormLoading(false);
      return;
    }
    if (!vendorProfile || !vendorProfile.config_id) {
        setFormError('Vendor profile or configuration ID not loaded. Please try again or refresh.');
        setFormLoading(false);
        return;
    }

    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error("No access token found. Please log in again.");
      }

      // Prepare post data for the API route
      // Default/required fields for Post type, will be filled by backend/Edge Function
      const postData: NewPostFormInput = {
        title,
        description: description || '',
        price,
        category_id: selectedCategory,
        subcategory_id: selectedSubcategory || null,
        email: vendorProfile.email, 
        status: 'pending', // Default status for new posts
        is_featured: false,
        has_photo: photos.length > 0,
        // photo_urls will be populated by the upload-post-image function
        is_vendor_post: true,
        // Default values for required fields (some can be made optional in types if backend handles default)
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      };

      setFormSuccess('Creating post...');

      // Call the API route to create the post (which in turn calls Supabase Edge Function)
      const response = await fetch('/api/vendor/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, // Send authenticated token
        },
        body: JSON.stringify({ post_data: postData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create post.');
      }

      const responseData = await response.json();
      const newPostId = responseData.postId;
      const editToken = responseData.editToken;

      setFormSuccess('Post created. Uploading photos (if any)...');
      
      // Handle photo uploads if any
      if (photos.length > 0) {
        for (const photo of photos) {
          const formData = new FormData();
          formData.append('token', editToken); // Use the edit token for upload
          formData.append('postId', newPostId);
          formData.append('config_id', vendorProfile.config_id); // Use fetched config_id
          formData.append('image', photo);

          // Direct call to Edge Function for image upload (using service key on server via headers)
          const uploadResponse = await fetch('/api/vendor/upload-image', { // <-- CALL YOUR PROXY API ROUTE
            method: 'POST',
            // IMPORTANT: No 'Content-Type' header here for FormData. The browser sets it correctly.
            headers: {
              'Authorization': `Bearer ${accessToken}`, // Pass user's access token to your proxy API
            },
            body: formData, // Send the FormData
          });

          if (!uploadResponse.ok) {
            const uploadErrorData = await uploadResponse.json();
            console.error(`Failed to upload photo ${photo.name} for post ${newPostId}:`, uploadErrorData);
            setFormError(`Post created, but failed to upload photo: ${photo.name}. Error: ${uploadErrorData.error || uploadErrorData.detail}`);
            // If you want to stop all uploads on first failure: break; 
          }
        }
        setFormSuccess('Post created and all photos uploaded successfully!');
      } else {
        setFormSuccess('Post created successfully!');
      }
      
      // Clear form after successful submission
      setTitle('');
      setDescription('');
      setPrice(0);
      setSelectedCategory('');
      setSelectedSubcategory('');
      setPhotos([]);
      
      router.push('/dashboard'); // Redirect back to dashboard after creation/upload
      
    } catch (err: any) {
      console.error('Post creation failed:', err);
      setFormError(err.message || 'An unexpected error occurred during post creation.');
      if (err.message.includes('token missing') || err.message.includes('Invalid or expired')) {
        clearAuthData(); //
        router.push('/login');
      }
    } finally {
      setFormLoading(false);
    }
  };


  if (!isAuthenticated()) {
    return null; // Component will not render if not authenticated, redirect handled by useEffect
  }

  // Initial loading state for fetching categories and vendor profile
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading form data...</p>
        </div>
      </div>
    );
  }

  // Error state for initial data fetch (categories or vendor profile)
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600 text-center">Error loading categories: {error}</div>
      </div>
    );
  }
  
  // Filter for main categories (those without a parent_id).
  const mainCategories = categories.filter(cat => !cat.parent_id);


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors mb-6"
        >
          <ChevronLeftIcon className="h-5 w-5" />
          <span>Back to Dashboard</span>
        </button>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Post New Item</h2>

          {formSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{formSuccess}</span>
            </div>
          )}
          {formError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Dropdown */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Select Category <span className="text-red-500">*</span>
              </label>
              <select
                id="category"
                name="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                required
              >
                <option value="">-- Select a Category --</option>
                {/* Ensure mainCategories is not empty before mapping */}
                {mainCategories.length === 0 ? (
                    <option value="" disabled>No main categories available</option>
                ) : (
                    mainCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))
                )}
              </select>
              {mainCategories.length === 0 && !loading && !error && (
                <p className="mt-2 text-sm text-red-500">No main categories found. Ensure categories are in DB and linked to vendor's allowed categories.</p>
              )}
            </div>

            {/* Subcategory Dropdown (Optional) */}
            {selectedCategory && subcategories.length > 0 && ( // Only show if a main category is selected and subcategories exist
              <div>
                <label htmlFor="subcategory" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Subcategory (Optional)
                </label>
                <select
                  id="subcategory"
                  name="subcategory"
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">-- Select a Subcategory --</option>
                  {subcategories.map(subcat => (
                    <option key={subcat.id} value={subcat.id}>{subcat.name}</option>
                  ))}
                </select>
              </div>
            )}
            {selectedCategory && subcategories.length === 0 && !loading && !error && (
              <p className="mt-2 text-sm text-gray-500">No subcategories for this main category.</p>
            )}

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="e.g., Used MacBook Pro 2022, Studio Apt for Rent"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Provide more details about your item or listing..."
              ></textarea>
            </div>

            {/* Price */}
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                Price <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value))}
                  className="block w-full pl-7 pr-12 border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            {/* Add Photos */}
            <div>
              <label htmlFor="photos" className="block text-sm font-medium text-gray-700 mb-2">
                Add Photos (Optional)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} accept="image/*" />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB each</p>
                  {photos.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      Selected: {photos.map((file, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2 mb-1">
                          {file.name}
                          <button type="button" onClick={() => removePhoto(idx)} className="ml-1 -mr-0.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={formLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Posting...
                  </div>
                ) : (
                  'Post Item'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}