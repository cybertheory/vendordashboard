// vendor-dashboard/src/app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isAuthenticated } from '@/lib/auth'; // Using your auth utility

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      // Redirect to login page if not authenticated
      router.replace('/login');
    } else {
      // Redirect to dashboard if authenticated
      router.replace('/dashboard');
    }
  }, [router]);

  // You can show a loading spinner or message while redirecting
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}