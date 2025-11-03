import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';

/**
 * Custom hook for type-safe URL parameter extraction
 * @returns Object with utility functions to work with query parameters
 */
export function useQueryParams() {
  const [searchParams] = useSearchParams();

  const queryParams = useMemo(() => ({
    /**
     * Get a single query parameter value
     * @param key - The parameter name
     * @returns The parameter value or null
     */
    get: (key: string): string | null => {
      return searchParams.get(key);
    },

    /**
     * Get all query parameters as an object
     * @returns Object with all query parameters
     */
    getAll: (): Record<string, string> => {
      return Object.fromEntries(searchParams.entries());
    },

    /**
     * Check if a query parameter exists
     * @param key - The parameter name
     * @returns True if the parameter exists
     */
    has: (key: string): boolean => {
      return searchParams.has(key);
    },

    /**
     * Get multiple query parameters at once
     * @param keys - Array of parameter names
     * @returns Object with requested parameters
     */
    getMultiple: (keys: string[]): Record<string, string | null> => {
      return keys.reduce((acc, key) => {
        acc[key] = searchParams.get(key);
        return acc;
      }, {} as Record<string, string | null>);
    },
  }), [searchParams]);

  return queryParams;
}