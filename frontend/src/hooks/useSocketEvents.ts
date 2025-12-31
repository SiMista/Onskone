import { useEffect, useRef } from 'react';
import socket from '../utils/socket';
import type { ServerToClientEvents } from '@onskone/shared';

type SocketEventHandlers = {
  [K in keyof ServerToClientEvents]?: ServerToClientEvents[K];
};

/**
 * Custom hook to handle multiple socket event listeners with automatic cleanup
 * Simplifies managing many socket listeners in a single component
 *
 * @example
 * useSocketEvents({
 *   gameState: (data) => setGame(data.game),
 *   gameStarted: (data) => setGame(data.game),
 *   error: (data) => setError(data.message),
 * }, [setGame, setError]);
 *
 * @param handlers - Object mapping event names to handler functions
 * @param deps - Dependencies array (handlers will be re-registered when deps change)
 */
export function useSocketEvents(
  handlers: SocketEventHandlers,
  deps: React.DependencyList = []
) {
  // Store handlers in a ref to avoid re-subscribing on every render
  const handlersRef = useRef(handlers);

  // Update ref when handlers change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const currentHandlers = handlersRef.current;
    const eventNames = Object.keys(currentHandlers) as (keyof ServerToClientEvents)[];

    // Subscribe to all events
    eventNames.forEach(event => {
      const handler = currentHandlers[event];
      if (handler) {
        socket.on(event, handler as any);
      }
    });

    // Cleanup: unsubscribe from all events
    return () => {
      eventNames.forEach(event => {
        const handler = currentHandlers[event];
        if (handler) {
          socket.off(event, handler as any);
        }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
