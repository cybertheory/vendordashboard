// vendor-dashboard/src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, clearAuthData, getAccessToken, getVendorEmail, getVendorId } from '@/lib/auth';
import { ArrowRightOnRectangleIcon, PlusCircleIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'; // Added ArrowPathIcon for Repost
import type { ApprovedVendor, Config, Post } from '@/lib/types'; //

// Define a simplified type for the config returned by the API route
interface SimplifiedConfig {
  id: string;
  school_name: string;
}

export default function VendorDashboardPage() {
  const router = useRouter();
  const [vendorEmail, setVendorEmail] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorProfile, setVendorProfile] = useState<ApprovedVendor | null>(null);
  const [mainMarketplaceName, setMainMarketplaceName] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  const [loadingListings, setLoadingListings] = useState(false); // State for listings loading
  const [listingsError, setListingsError] = useState<string | null>(null); // State for listings error
  const [posts, setPosts] = useState<Post[]>([]); // State to hold vendor's posts

  // Add a state for transient success/error messages for actions like repost/delete
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionMessageType, setActionMessageType] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return; 
    }
    setVendorEmail(getVendorEmail());
    setVendorId(getVendorId());
    fetchVendorData();
  }, [router]);

  const fetchVendorData = async () => {
    setLoadingProfile(true);
    setProfileError(null);
    setLoadingListings(true); 
    setListingsError(null); 
    setActionMessage(null); // Clear messages on data fetch
    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error("No access token found. Please log in again.");
      }

      // Fetch Vendor Profile
      const profileResponse = await fetch('/api/vendor/me', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!profileResponse.ok) {
        const errorData = await profileResponse.json();
        throw new Error(errorData.detail || 'Failed to fetch vendor profile');
      }
      const profileData: ApprovedVendor = await profileResponse.json();
      setVendorProfile(profileData);

      // Fetch Main Marketplace Name (University Config Name)
      if (profileData.config_id) {
        const configResponse = await fetch(`/api/vendor/config/${profileData.config_id}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!configResponse.ok) {
          const errorData = await configResponse.json();
          console.error('Failed to fetch config data:', errorData);
          setMainMarketplaceName('Error loading marketplace');
        } else {
          const configData: SimplifiedConfig = await configResponse.json();
          setMainMarketplaceName(configData.school_name);
        }
      } else {
        setMainMarketplaceName('N/A');
      }

      // === FETCH VENDOR'S POSTS ===
      const postsResponse = await fetch('/api/vendor/posts', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!postsResponse.ok) {
        const errorData = await postsResponse.json();
        throw new Error(errorData.detail || 'Failed to fetch listings');
      }
      const postsData: Post[] = await postsResponse.json();
      setPosts(postsData);
      // ============================

    } catch (err: any) {
      console.error('Error in dashboard data fetch:', err);
      setProfileError(err.message || 'Failed to load dashboard data.');
      setListingsError(err.message || 'Failed to load your listings.'); 
      if (err.message.includes('token missing') || err.message.includes('Invalid or expired')) {
        clearAuthData();
        router.push('/login');
      }
    } finally {
      setLoadingProfile(false);
      setLoadingListings(false);
    }
  };
  
  const handleLogout = () => {
    clearAuthData();
    router.push('/login');
  };

  const handlePostNewItem = () => {
    console.log("Post New Item clicked!");
    router.push('/dashboard/new-post'); // Navigate to the new post creation page
  };

  const handleEditPost = (postId: string) => {
    router.push(`/dashboard/edit-post/${postId}`); // Navigate to the edit post page
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }
    setLoadingListings(true); 
    setListingsError(null); 
    setActionMessage(null); // Clear previous action message

    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error("No access token found. Please log in again.");
      }

      const response = await fetch(`/api/vendor/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`, 
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete post.');
      }

      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
      console.log(`Post ${postId} deleted successfully.`);
      setActionMessage('Post deleted successfully!');
      setActionMessageType('success');

    } catch (err: any) {
      console.error(`Error deleting post ${postId}:`, err);
      setListingsError(err.message || 'Failed to delete post.');
      setActionMessage(`Error deleting post: ${err.message}`);
      setActionMessageType('error');
      if (err.message.includes('token missing') || err.message.includes('Invalid or expired')) {
        clearAuthData();
        router.push('/login');
      }
    } finally {
      setLoadingListings(false);
    }
  };

  const handleRepostPost = async (postId: string) => {
    if (!confirm('Are you sure you want to repost this item? A new post will be created identical to this one, but with current date and time.')) {
      return;
    }
    setLoadingListings(true); 
    setListingsError(null); 
    setActionMessage(null); // Clear previous action message

    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error("No access token found. Please log in again.");
      }

      // Call the Repost API route
      const response = await fetch(`/api/vendor/posts/${postId}/repost`, {
        method: 'POST', // Repost is a POST request to create a new resource
        headers: {
          'Authorization': `Bearer ${accessToken}`, 
          'Content-Type': 'application/json', 
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to repost item.');
      }

      const responseData = await response.json();
      console.log('Post reposted successfully:', responseData);
      setActionMessage('Post reposted successfully!');
      setActionMessageType('success');
      
      // Re-fetch all posts to show the new reposted item
      await fetchVendorData(); 

    } catch (err: any) {
      console.error(`Error reposting post ${postId}:`, err);
      setListingsError(err.message || 'Failed to repost item.');
      setActionMessage(`Error reposting post: ${err.message}`);
      setActionMessageType('error');
      if (err.message.includes('token missing') || err.message.includes('Invalid or expired')) {
        clearAuthData();
        router.push('/login');
      }
    } finally {
      setLoadingListings(false);
    }
  };


  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Checking authentication and redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Auth Info */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendor Dashboard</h1>
            <p className="mt-2 text-gray-600">Welcome to your marketplace dashboard!</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Signed in as: <span className="font-medium">{vendorEmail}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
              title="Sign Out"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Action Message Display */}
        {actionMessage && (
          <div className={`mb-4 px-4 py-3 rounded relative ${actionMessageType === 'success' ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
            <span className="block sm:inline">{actionMessage}</span>
            <button 
              onClick={() => setActionMessage(null)} 
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
            >
              <svg className="fill-current h-6 w-6 text-gray-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.15a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.15 2.758 3.15a1.2 1.2 0 0 1 0 1.697z"/></svg>
            </button>
          </div>
        )}

        {/* Vendor Profile Section */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Profile</h2>
          {loadingProfile ? (
            <div className="text-center text-gray-500">Loading profile...</div>
          ) : profileError ? (
            <div className="text-red-600">Error: {profileError}</div>
          ) : vendorProfile ? (
            <div className="space-y-2 text-gray-700 text-sm">
              <p><strong>Name:</strong> {vendorProfile.contact_name || 'N/A'}</p>
              <p><strong>Email:</strong> {vendorProfile.email}</p>
              <p><strong>Phone:</strong> {vendorProfile.phone || 'N/A'}</p>
              <p><strong>Website:</strong> {vendorProfile.website || 'N/A'}</p>
              <p><strong>Main Marketplace:</strong> {mainMarketplaceName || 'Loading...'}</p>
            </div>
          ) : (
            <div className="text-center text-gray-500">No profile data available.</div>
          )}
        </div>

        {/* Your Listings Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Your Posted Posts</h2>
            <button
              onClick={handlePostNewItem}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <PlusCircleIcon className="h-5 w-5" />
              <span>Post New Item</span>
            </button>
          </div>

          {loadingListings ? (
            <div className="text-center text-gray-500 py-8">Loading listings...</div>
          ) : listingsError ? (
            <div className="text-red-600 text-center py-8">Error loading listings: {listingsError}</div>
          ) : posts.length === 0 ? (
            <div className="text-center text-gray-500 py-8">You haven't posted any items yet.</div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{post.title}</h3>
                    <p className="text-gray-600 text-sm">{post.description?.substring(0, 100)}{post.description && post.description.length > 100 ? '...' : ''}</p>
                    <p className="text-gray-500 text-xs">Price: ${post.price?.toFixed(2) || 'N/A'}</p>
                    <p className="text-gray-500 text-xs">Status: {post.status} | Published: {new Date(post.published_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditPost(post.id)}
                      className="p-2 rounded-full text-blue-600 hover:bg-blue-100"
                      title="Edit Post"
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleRepostPost(post.id)} // Repost button
                      className="p-2 rounded-full text-green-600 hover:bg-green-100"
                      title="Repost Item"
                    >
                      <ArrowPathIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-2 rounded-full text-red-600 hover:bg-red-100"
                      title="Delete Post"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}