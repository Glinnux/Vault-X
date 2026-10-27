import { useEffect, useState } from 'react';

function detectMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const mobileUserAgent = /android|webos|iphone|ipod|ipad|blackberry|iemobile|opera mini|mobile/.test(userAgent);
  const iPadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return mobileUserAgent || iPadDesktopMode;
}

/**
 * Detects the physical device, rather than the current browser-window width.
 * This prevents a resized desktop window from switching to the Android UI.
 */
export function useDeviceDetection() {
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    setIsMobileDevice(detectMobileDevice());
  }, []);

  return { isMobileDevice };
}
