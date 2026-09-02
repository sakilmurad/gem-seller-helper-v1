import { useCallback, useEffect, useRef, useState } from 'react';
import { getRecord, putRecord, type StoreName } from '../lib/indexedDb';

export interface CacheResult<T> {
  data: T;
  /** True only on the very first load when no cache exists. */
  loading: boolean;
  /** True while the background refresh is in progress. */
  refreshing: boolean;
  error: Error | null;
  /** Manually trigger a background refresh. */
  refresh: () => void;
  /** Update local state + cache without a server round-trip. */
  setData: (value: T | ((prev: T) => T)) => void;
}

/**
 * Offline-first, stale-while-revalidate hook.
 *
 * 1. Reads from IndexedDB → sets state immediately if cached.
 * 2. Calls `fetcher()` in the background.
 * 3. On success → updates React state + IndexedDB.
 *
 * @param store   IndexedDB object store name
 * @param key     Record key inside the store
 * @param initial Default value when nothing is cached yet
 * @param fetcher Async function that returns fresh data from the server
 */
export function useCache<T>(
  store: StoreName,
  key: string,
  initial: T,
  fetcher: () => Promise<T>,
): CacheResult<T> {
  const [data, setDataRaw] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  // Persist to IndexedDB whenever data changes from a refresh or manual setData
  const persistAndSet = useCallback(
    (value: T) => {
      setDataRaw(value);
      putRecord(store, key, value).catch(() => {
        /* silent — cache is best-effort */
      });
    },
    [store, key],
  );

  const setData = useCallback(
    (value: T | ((prev: T) => T)) => {
      setDataRaw((prev) => {
        const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        putRecord(store, key, next).catch(() => {});
        return next;
      });
    },
    [store, key],
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    fetcher()
      .then((fresh) => {
        if (mountedRef.current) persistAndSet(fresh);
      })
      .catch((err) => {
        if (mountedRef.current) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (mountedRef.current) {
          setRefreshing(false);
          setLoading(false);
        }
      });
  }, [fetcher, persistAndSet]);

  // On mount: read cache → then background refresh
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    getRecord<T>(store, key)
      .then((cached) => {
        if (!cancelled && cached !== undefined) {
          setDataRaw(cached);
          setLoading(false); // we have data to show
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) refresh();
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, key]);

  return { data, loading, refreshing, error, refresh, setData };
}
