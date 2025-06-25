// vendor-dashboard/src/lib/auth.ts

const ACCESS_TOKEN_KEY = 'vendor_access_token';
const VENDOR_ID_KEY = 'vendor_id';
const VENDOR_EMAIL_KEY = 'vendor_email';

export const saveAuthData = (accessToken: string, vendorId: string, vendorEmail: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(VENDOR_ID_KEY, vendorId);
    localStorage.setItem(VENDOR_EMAIL_KEY, vendorEmail);
  }
};

export const getAccessToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return null;
};

export const getVendorId = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(VENDOR_ID_KEY);
  }
  return null;
};

export const getVendorEmail = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(VENDOR_EMAIL_KEY);
  }
  return null;
};

export const clearAuthData = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(VENDOR_ID_KEY);
    localStorage.removeItem(VENDOR_EMAIL_KEY);
  }
};

export const isAuthenticated = (): boolean => {
  return typeof window !== 'undefined' && localStorage.getItem(ACCESS_TOKEN_KEY) !== null;
};