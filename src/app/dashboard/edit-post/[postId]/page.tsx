// vendor-dashboard/src/app/dashboard/edit-post/[postId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation'; // Import useParams
import { isAuthenticated, getAccessToken, clearAuthData } from '@/lib/auth';
import { ChevronLeftIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import type { Category, Post, ApprovedVendor } from '@/lib/types'; // Import types

// Define the type for the data structure the API will expect for post updates
// It's a partial Post, as not all fields are editable
type UpdatePostFormInput = Partial<Omit<Post, 'id' | 'created_at' | 'updated_at' | 'edit_token' | 'edit_token_expires_at' | 'vendor_id' | 'config_id' | 'is_vendor_post' | 'is_scraped' | 'scraped_url'>>;


export default function EditPostPage() {
  const router = useRouter();
  const params = useParams(); // Get dynamic route parameters
  const postId = params.postId as string; // Extract postId from URL

  const [loadingPage, setLoadingPage] = useState(true); // Initial page load (fetching post, categories, profile)
  const [pageError, setPageError] = useState<string | null>(null);

  const [post, setPost] = useState<Post | null>(null); // State for the post being edited
  const [categories, setCategories] = useState<Category[]>([]); // All categories (for name lookup)
  const [vendorProfile, setVendorProfile] = useState<ApprovedVendor | null>(null); // Vendor profile for config_id and email


  // Form state for inputs (pre-populated from 'post' useEffect)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>(''); // Category ID
  const [subcategories, setSubcategories] = useState<Category[]>([]); // Filtered subcategories
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>(''); // Subcategory ID
  const [photos, setPhotos] = useState<File[]>([]); // For new photos to upload
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]); // For photos already on the post


  const [formLoading, setFormLoading] = useState(false); // State for form submission
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Authenticate user on page load and ensure postId is available
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    if (!postId) {
      setPageError('Post ID is missing in URL.');
      setLoadingPage(false);
      return;
    }
    fetchEditData();
  }, [router, postId]); // Re-run if postId changes

  // Effect to pre-populate form fields when post data is loaded
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setDescription(post.description || '');
      setPrice(post.price || 0);
      setSelectedCategory(post.category_id);
      setSelectedSubcategory(post.subcategory_id || '');
      setExistingPhotoUrls(post.photo_urls || []);
    }
  }, [post]);

  // Effect to filter subcategories based on selectedCategory (similar to new-post)
  useEffect(() => {
    if (selectedCategory) {
      const children = categories.filter(cat => cat.parent_id === selectedCategory);
      setSubcategories(children);
      // If the currently selected subcategory is not a child of the new main category, reset it.
      // This handles cases where a category switch invalidates the subcategory.
      if (!children.some(child => child.id === selectedSubcategory)) {
        setSelectedSubcategory('');
      }
    } else {
      setSubcategories([]);
      setSelectedSubcategory('');
    }
  }, [selectedCategory, categories, selectedSubcategory]); 


  const fetchEditData = async () => {
    setLoadingPage(true);
    setPageError(null);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error("No access token found. Please log in again.");
      }

      // 1. Fetch Post Data for editing
      // Assuming a GET handler for /api/vendor/posts/[postId] exists that returns a single post
      const postResponse = await fetch(`/api/vendor/posts/${postId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!postResponse.ok) {
        const errorData = await postResponse.json();
        throw new Error(errorData.detail || 'Failed to fetch post data.');
      }
      const postData: Post = await postResponse.json();
      setPost(postData); // Store the fetched post data

      // 2. Fetch All Categories (needed to map IDs to names and build subcategory logic)
      const categoriesResponse = await fetch('/api/vendor/categories', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!categoriesResponse.ok) {
        const errorData = await categoriesResponse.json();
        throw new Error(errorData.detail || 'Failed to fetch categories');
      }
      const categoriesData: Category[] = await categoriesResponse.json();
      setCategories(categoriesData); // Store all categories

      // 3. Fetch Vendor Profile (needed for config_id for photo uploads)
      const vendorProfileResponse = await fetch('/api/vendor/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (vendorProfileResponse.ok) {
        const data: ApprovedVendor = await vendorProfileResponse.json();
        setVendorProfile(data);
      } else {
        const errorData = await vendorProfileResponse.json();
        console.error("Failed to fetch vendor profile for config_id in edit-post page:", errorData);
        // This might not be a critical error for rendering the form, but impacts photo upload.
      }


    } catch (err: any) {
      console.error('Error fetching edit data:', err);
      setPageError(err.message || 'Failed to load post for editing.');
      if (err.message.includes('token missing') || err.message.includes('Invalid or expired')) {
        clearAuthData();
        router.push('/login');
      }
    } finally {
      setLoadingPage(false);
    }
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prevPhotos => [...prevPhotos, ...Array.from(e.target.files)]);
    }
  };
  
  const removeNewPhoto = (index: number) => {
    setPhotos(prevPhotos => prevPhotos.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = async (urlToRemove: string) => {
    if (!confirm('Are you sure you want to remove this existing photo? This change will be saved when you click "Save Changes".')) return;
    
    // Optimistically update UI
    setExistingPhotoUrls(prevUrls => prevUrls.filter(url => url !== urlToRemove));
    setFormSuccess('Photo marked for removal. Click "Save Changes" to apply.');
    // The actual deletion from storage and DB will happen on form submission (PATCH call)
    // For simplicity, we're not implementing individual photo DELETE API endpoint now.
    // The PATCH update will replace photo_urls with the 'existingPhotoUrls' state.
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    if (!post) { 
      setFormError('Post data not loaded. Cannot save changes.');
      setFormLoading(false);
      return;
    }
    if (!vendorProfile || !vendorProfile.config_id) {
      setFormError('Vendor profile or configuration ID not loaded. Please try again or refresh.');
      setFormLoading(false);
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      setFormError("No access token found. Please log in again.");
      setFormLoading(false);
      return;
    }

    // Prepare update data for the API route (only send potentially changed fields)
    const updates: UpdatePostFormInput = {
      title,
      description: description,
      price,
      // Category/subcategory can generally not be changed directly on edit for simplicity
      // in most systems, as it might change required fields/structure.
      // If allowed, you'd include: category_id: selectedCategory, subcategory_id: selectedSubcategory || null,
      
      // Update has_photo and photo_urls based on current state (existing + new)
      has_photo: (existingPhotoUrls.length > 0 || photos.length > 0), 
      photo_urls: existingPhotoUrls, // Send currently existing photos
    };

    try {
      setFormSuccess('Updating post...');

      // Call the API route to update the post
      const response = await fetch(`/api/vendor/posts/${postId}`, {
        method: 'PATCH', // Use PATCH for partial updates
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update post.');
      }

      // const responseData = await response.json(); // Not strictly needed, but could return updated post
      setFormSuccess('Post updated successfully!');

      // Handle NEW photo uploads only (existing photos handled by PATCH)
      if (photos.length > 0) {
        setFormLoading(true); // Keep loading while new photos upload
        setFormSuccess('Post updated. Uploading new photos...');
        for (const photo of photos) {
          const formData = new FormData();
          // Use original post's edit_token for upload (from 'post' state)
          formData.append('token', post.edit_token); 
          formData.append('postId', postId);
          formData.append('config_id', vendorProfile.config_id);
          formData.append('image', photo);

          // Direct call to Edge Function for image upload (using service key on server via headers)
          const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/upload-post-image`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` 
            },
            body: formData,
          });

          if (!uploadResponse.ok) {
            const uploadErrorData = await uploadResponse.json();
            console.error(`Failed to upload new photo ${photo.name}:`, uploadErrorData);
            setFormError(`Post updated, but failed to upload new photo: ${photo.name}. Error: ${uploadErrorData.error || uploadErrorData.detail}`);
            // Continue to try other photos or break based on severity
          }
        }
        setFormSuccess('Post updated and all new photos uploaded successfully!');
        // After successful uploads, clear new photos and refetch post data to get updated photo_urls
        setPhotos([]);
        await fetchEditData(); // Refetch post to get updated photo_urls from DB
      }
      
      router.push('/dashboard'); // Redirect back to dashboard after update
      
    } catch (err: any) {
      console.error('Post update failed:', err);
      setFormError(err.message || 'An unexpected error occurred during post update.');
      if (err.message.includes('token missing') || err.message.includes('Invalid or expired')) {
        clearAuthData();
        router.push('/login');
      }
    } finally {
      setFormLoading(false);
    }
  };


  if (!isAuthenticated()) {
    return null; // Component will not render if not authenticated, redirect handled by useEffect
  }

  // Initial loading state for fetching post, categories, and vendor profile
  if (loadingPage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading post for editing...</p>
        </div>
      </div>
    );
  }

  // Error state for initial data fetch
  if (pageError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600 text-center">Error: {pageError}</div>
      </div>
    );
  }
  
  // If post data is null after loading (e.g., post not found)
  if (!post) {
      return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-gray-500 text-center">Post not found or could not be loaded.</div>
          </div>
      );
  }

  // Helper to map category IDs to names for display
  const categoryMap = new Map<string, string>(); 
  categories.forEach(cat => categoryMap.set(cat.id, cat.name));
  
  // Note: Categories/subcategories are displayed as read-only for simplicity in edit form
  // Changing them would require re-validating against vendor's allowed_categories and potentially
  // dynamic fields (like bedrooms for housing).


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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Post: "{post.title}"</h2>

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
            {/* Category Dropdown (Displayed as read-only after creation) */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                id="category"
                value={categoryMap.get(post.category_id) || 'N/A'}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 cursor-not-allowed sm:text-sm"
                readOnly
              />
              {post.subcategory_id && (
                <input
                  type="text"
                  value={categoryMap.get(post.subcategory_id) || 'N/A'}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 cursor-not-allowed sm:text-sm"
                  readOnly
                />
              )}
              <p className="mt-2 text-xs text-gray-500">
                Category and Subcategory cannot be changed after creation. Please delete and create a new post if you need to change them.
              </p>
            </div>


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
                placeholder="e.g., Used MacBook Pro 2022"
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

            {/* Existing Photos */}
            {existingPhotoUrls.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Existing Photos
                </label>
                <div className="flex flex-wrap gap-2">
                  {existingPhotoUrls.map((url, idx) => (
                    <div key={idx} className="relative w-24 h-24 border border-gray-300 rounded-md overflow-hidden">
                      <img src={url} alt={`Existing Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeExistingPhoto(url)} 
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-md px-1 py-0.5 text-xs hover:bg-red-600"
                        title="Remove existing photo"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Photos */}
            <div>
              <label htmlFor="photos" className="block text-sm font-medium text-gray-700 mb-2">
                Add More Photos (Optional)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Upload new files</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} accept="image/*" />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB each</p>
                  {photos.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      New: {photos.map((file, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2 mb-1">
                          {file.name}
                          <button type="button" onClick={() => removeNewPhoto(idx)} className="ml-1 -mr-0.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
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
                    Saving Changes...
                  </div>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}