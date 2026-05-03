/**
 * Utility functions to detect device type and environment
 */

export const isTablet = () => {
  // Common breakpoint for tablets is 768px
  return window.innerWidth >= 768;
};

export const isNativeApp = () => {
  // Capacitor adds the Capacitor object to window
  return (window as any).Capacitor?.isNativePlatform === true;
};

export const getDeviceType = () => {
  if (isTablet()) return 'tablet';
  return 'phone';
};
