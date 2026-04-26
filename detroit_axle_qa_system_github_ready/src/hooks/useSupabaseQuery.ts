import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

/**
 * Custom hook for Supabase queries with TanStack Query
 * Provides automatic caching, refetching, and loading states
 */
export function useSupabaseQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T>({
    queryKey,
    queryFn,
    ...options,
  });
}

/**
 * Hook for paginated Supabase queries
 */
export function useSupabasePaginatedQuery<T>(
  queryKey: string[],
  queryFn: (page: number, limit: number) => Promise<T[]>,
  page: number = 1,
  limit: number = 20,
  options?: Omit<UseQueryOptions<T[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T[]>({
    queryKey: [...queryKey, page, limit],
    queryFn: () => queryFn(page, limit),
    ...options,
  });
}
