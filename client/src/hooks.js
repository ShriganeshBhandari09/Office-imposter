import { useEffect } from 'react';

// Phones: go full screen and lock to landscape on the first tap (browsers only allow it after a tap).
// The Android app is already full screen, so failures are ignored.
export function useFullscreenOnTap() {
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    const go = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        }
        await screen.orientation?.lock?.('landscape');
      } catch { /* not supported here */ }
    };
    window.addEventListener('pointerup', go, { once: true });
    return () => window.removeEventListener('pointerup', go);
  }, []);
}

// Phones and tablets get an on-screen joystick and touch-sized buttons.
export const IS_TOUCH = typeof window !== 'undefined'
  && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
