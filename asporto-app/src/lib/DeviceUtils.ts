/**
 * Utility functions to detect device type and environment
 */

export const isTablet = () => {
  // Common breakpoint for tablets is 768px
  return window.innerWidth >= 768;
};

type WindowWithCapacitor = Window & {
  Capacitor?: { isNativePlatform?: boolean };
};

export const isNativeApp = () => {
  return (window as WindowWithCapacitor).Capacitor?.isNativePlatform === true;
};

export const getDeviceType = () => {
  if (isTablet()) return 'tablet';
  return 'phone';
};
