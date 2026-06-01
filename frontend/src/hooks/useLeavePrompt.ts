import { useEffect } from 'react';
import { isStudioFrame } from '../utils/studioStorage';

/**
 * Custom hook to warn users before leaving the page
 * @param enabled - Whether the prompt is enabled
 */
export function useLeavePrompt(
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;
    // Studio: never block reloads/navigations inside a studio iframe.
    if (isStudioFrame) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Note: Modern browsers ignore custom messages and show a generic prompt
      // We just need to set returnValue to trigger the prompt
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);
}