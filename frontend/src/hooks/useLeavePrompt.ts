import { useEffect, useRef } from 'react';

/**
 * Custom hook to warn users before leaving the page
 * @param onLeave - Callback function to execute when user is about to leave
 * @param enabled - Whether the prompt is enabled
 */
export function useLeavePrompt(
  onLeave?: () => void,
  enabled: boolean = true
) {
  const onLeaveRef = useRef(onLeave);

  // Keep onLeave ref up to date
  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Execute the callback
      onLeaveRef.current?.();

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