import { useEffect, useCallback } from 'react';
import socket from '../utils/socket';
import type { ServerToClientEvents } from '@onskone/shared';

/**
 * Custom hook to handle socket event listeners with automatic cleanup
 * @param event - The socket event name
 * @param handler - The callback function to handle the event
 * @param deps - Dependencies array for the handler
 */
export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K],
  deps: React.DependencyList = []
) {
  // Memoize the handler to prevent unnecessary re-subscriptions
  const memoizedHandler = useCallback(handler, deps);

  useEffect(() => {
    // Subscribe to the socket event
    socket.on(event, memoizedHandler as any);

    // Cleanup: unsubscribe when component unmounts or dependencies change
    return () => {
      socket.off(event, memoizedHandler as any);
    };
  }, [event, memoizedHandler]);
}