/**
 * useQuery Hook - React Query-like data fetching with intelligent caching
 * Features: caching, background refresh, retry logic, stale-while-revalidate
 */

import { CACHE_TTL, getCache, getCacheMeta, removeCache, setCache, type CacheOptions } from '@/services/cache';
import { useCallback, useEffect, useRef, useState } from 'react';

// Query state types
interface QueryState<T> {
  data: T | null;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  isStale: boolean;
  lastUpdated: Date | null;
}

// Query options
interface UseQueryOptions<T> extends CacheOptions {
  queryKey: string | (string | number | boolean | null | undefined)[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;      // Time before data is considered stale
  cacheTime?: number;      // Time to keep inactive data in cache
  retry?: number | boolean;  // Number of retries or false for no retry
  retryDelay?: number;      // Delay between retries
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  refetchInterval?: number | false; // Auto-refetch interval in ms
  initialData?: T;
  placeholderData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  select?: (data: T) => any; // Transform data before returning
}

// Query result
interface UseQueryResult<T> extends QueryState<T> {
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
  remove: () => Promise<void>;
}

// Generate cache key from query key
function generateCacheKey(queryKey: string | (string | number | boolean | null | undefined)[]): string {
  if (typeof queryKey === 'string') {
    return `query:${queryKey}`;
  }
  return `query:${queryKey.map(k => k ?? 'null').join(':')}`;
}

// Retry with exponential backoff
async function retryFetch<T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryFetch(fn, retries - 1, delay * 2);
  }
}

export function useQuery<T>(options: UseQueryOptions<T>): UseQueryResult<T> {
  const {
    queryKey,
    queryFn,
    enabled = true,
    staleTime = CACHE_TTL.API.DEFAULT,
    cacheTime = CACHE_TTL.API.LONG,
    retry = 3,
    retryDelay = 1000,
    refetchInterval = false,
    initialData,
    placeholderData,
    onSuccess,
    onError,
    select,
    version = '1.0',
  } = options;

  const cacheKey = generateCacheKey(queryKey);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const retryCountRef = useRef(0);

  // State
  const [state, setState] = useState<QueryState<T>>({
    data: initialData ?? placeholderData ?? null,
    isLoading: enabled && !initialData && !placeholderData,
    isFetching: false,
    isSuccess: !!initialData,
    isError: false,
    error: null,
    isStale: false,
    lastUpdated: initialData ? new Date() : null,
  });

  // Fetch function
  const fetchData = useCallback(async (background = false) => {
    if (!isMounted.current) return;

    // Set loading state
    if (!background) {
      setState(prev => ({ ...prev, isLoading: true, isFetching: false }));
    } else {
      setState(prev => ({ ...prev, isFetching: true }));
    }

    try {
      // Calculate retry attempts
      const maxRetries = typeof retry === 'number' ? retry : retry ? 3 : 0;
      
      // Fetch with retry
      const data = await retryFetch(queryFn, maxRetries, retryDelay);
      
      if (!isMounted.current) return;

      // Transform data if select function provided
      const finalData = select ? select(data) : data;

      // Save to cache
      await setCache(cacheKey, data, {
        ttl: cacheTime,
        version,
        persistent: true,
        priority: 'both',
      });

      // Update state
      setState(prev => ({
        ...prev,
        data: finalData,
        isLoading: false,
        isFetching: false,
        isSuccess: true,
        isError: false,
        error: null,
        isStale: false,
        lastUpdated: new Date(),
      }));

      retryCountRef.current = 0;
      onSuccess?.(finalData);
    } catch (error) {
      if (!isMounted.current) return;

      const err = error instanceof Error ? error : new Error(String(error));
      retryCountRef.current++;

      // If we have cached data, keep showing it on error
      if (state.data) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isFetching: false,
          isError: true,
          error: err,
        }));
      } else {
        setState(prev => ({
          ...prev,
          data: null,
          isLoading: false,
          isFetching: false,
          isError: true,
          error: err,
          isSuccess: false,
        }));
      }

      onError?.(err);
    }
  }, [queryFn, cacheKey, cacheTime, retry, retryDelay, select, onSuccess, onError, state.data, version]);

  // Initial fetch and cache check
  useEffect(() => {
    isMounted.current = true;

    if (!enabled) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const init = async () => {
      // Check cache first
      const cached = await getCache<T>(cacheKey, { version });
      
      if (cached !== null) {
        // Check if stale
        const meta = await getCacheMeta(cacheKey);
        const isStale = meta ? (Date.now() - meta.timestamp) > staleTime : true;

        const finalData = select ? select(cached) : cached;

        setState(prev => ({
          ...prev,
          data: finalData,
          isLoading: false,
          isStale,
          isSuccess: true,
          lastUpdated: new Date(meta?.timestamp || Date.now()),
        }));

        // Refetch if stale
        if (isStale) {
          fetchData(true);
        }
      } else {
        // No cache, fetch fresh
        await fetchData(false);
      }
    };

    init();

    return () => {
      isMounted.current = false;
    };
  }, [enabled, cacheKey, staleTime, version, select]);

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && enabled && isMounted.current) {
      intervalRef.current = setInterval(() => {
        fetchData(true);
      }, refetchInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refetchInterval, enabled, fetchData]);

  // Manual refetch
  const refetch = useCallback(async () => {
    await fetchData(false);
  }, [fetchData]);

  // Invalidate cache and refetch
  const invalidate = useCallback(async () => {
    await removeCache(cacheKey);
    await fetchData(false);
  }, [cacheKey, fetchData]);

  // Remove from cache
  const remove = useCallback(async () => {
    await removeCache(cacheKey);
    setState(prev => ({
      ...prev,
      data: null,
      isSuccess: false,
      lastUpdated: null,
    }));
  }, [cacheKey]);

  return {
    ...state,
    refetch,
    invalidate,
    remove,
  };
}

// Convenience hook for multiple parallel queries
export function useQueries<T extends any[]>(
  queries: { [K in keyof T]: UseQueryOptions<T[K]> }
): { [K in keyof T]: UseQueryResult<T[K]> } {
  return queries.map(q => useQuery(q)) as any;
}

// Hook for infinite scroll / pagination
interface UseInfiniteQueryOptions<T, TPageParam = number> extends Omit<UseQueryOptions<T[]>, 'queryFn'> {
  queryFn: (pageParam: TPageParam) => Promise<T[]>;
  getNextPageParam: (lastPage: T[], allPages: T[][]) => TPageParam | undefined;
  initialPageParam: TPageParam;
}

interface UseInfiniteQueryResult<T> extends UseQueryResult<T[]> {
  data: T[];
  hasNextPage: boolean;
  fetchNextPage: () => Promise<void>;
  isFetchingNextPage: boolean;
}

export function useInfiniteQuery<T, TPageParam = number>(
  options: UseInfiniteQueryOptions<T, TPageParam>
): UseInfiniteQueryResult<T> {
  const {
    queryFn,
    getNextPageParam,
    initialPageParam,
    ...restOptions
  } = options;

  const [pages, setPages] = useState<T[][]>([]);
  const [pageParams, setPageParams] = useState<TPageParam[]>([initialPageParam]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) return;

    setIsFetchingNextPage(true);
    
    try {
      const nextParam = getNextPageParam(pages[pages.length - 1], pages);
      
      if (nextParam === undefined) {
        setHasNextPage(false);
        setIsFetchingNextPage(false);
        return;
      }

      const newPage = await queryFn(nextParam);
      
      setPages(prev => [...prev, newPage]);
      setPageParams(prev => [...prev, nextParam]);
      setHasNextPage(getNextPageParam(newPage, [...pages, newPage]) !== undefined);
    } catch (error) {
      console.error('Error fetching next page:', error);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [queryFn, getNextPageParam, pages, hasNextPage, isFetchingNextPage]);

  // Flatten pages for the result
  const flattenedData = pages.flat();

  const baseQuery = useQuery({
    ...restOptions,
    queryFn: () => queryFn(initialPageParam),
    onSuccess: (data) => {
      setPages([data]);
      setHasNextPage(getNextPageParam(data, [data]) !== undefined);
      restOptions.onSuccess?.(flattenedData as any);
    },
  });

  return {
    ...baseQuery,
    data: flattenedData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  };
}

// Mutation hook for data modifications
interface UseMutationOptions<TData, TVariables, TError = Error> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void;
  onSettled?: (data: TData | null, error: TError | null, variables: TVariables) => void;
  invalidateQueries?: string[];
}

interface UseMutationResult<TData, TVariables, TError = Error> {
  mutate: (variables: TVariables) => Promise<TData | undefined>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: TError | null;
  data: TData | null;
  reset: () => void;
}

export function useMutation<TData, TVariables, TError = Error>(
  options: UseMutationOptions<TData, TVariables, TError>
): UseMutationResult<TData, TVariables, TError> {
  const { mutationFn, onSuccess, onError, onSettled, invalidateQueries } = options;

  const [state, setState] = useState({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null as TError | null,
    data: null as TData | null,
  });

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    setState(prev => ({ ...prev, isLoading: true, isError: false, error: null }));

    try {
      const data = await mutationFn(variables);

      setState(prev => ({
        ...prev,
        isLoading: false,
        isSuccess: true,
        data,
      }));

      // Invalidate related queries
      if (invalidateQueries) {
        for (const key of invalidateQueries) {
          await removeCache(`query:${key}`);
        }
      }

      await onSuccess?.(data, variables);
      onSettled?.(data, null, variables);

      return data;
    } catch (error) {
      const err = (error instanceof Error ? error : new Error(String(error))) as TError;

      setState(prev => ({
        ...prev,
        isLoading: false,
        isError: true,
        error: err,
      }));

      onError?.(err, variables);
      onSettled?.(null, err, variables);

      throw error;
    }
  }, [mutationFn, onSuccess, onError, onSettled, invalidateQueries]);

  const mutate = useCallback(async (variables: TVariables) => {
    try {
      return await mutateAsync(variables);
    } catch {
      return undefined;
    }
  }, [mutateAsync]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: null,
    });
  }, []);

  return {
    mutate,
    mutateAsync,
    ...state,
    reset,
  };
}

