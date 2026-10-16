export const ENV = {
  API_BASE_URL:
    import.meta.env.VITE_API_BASE_URL ||
    (typeof window !== 'undefined' && window.location.origin
      ? `${window.location.origin}/api/v1`
      : 'http://localhost:5000/api/v1'),
  TRTC_SDK_APP_ID: import.meta.env.VITE_TRTC_SDK_APP_ID || '20049417',
  APP_TITLE: import.meta.env.VITE_APP_TITLE || 'CloudNews Admin Portal',
};
