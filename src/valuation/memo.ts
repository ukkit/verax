/** Caches `load` by key; concurrent callers share one call, and a failed call is forgotten so a retry asks again. */
export function memoised<K, V>(load: (key: K) => Promise<V>, id: (key: K) => unknown = (key) => key): (key: K) => Promise<V> {
  const cache = new Map<unknown, Promise<V>>();
  return (key) => {
    const k = id(key);
    let pending = cache.get(k);
    if (!pending) {
      pending = load(key);
      cache.set(k, pending);
      pending.catch(() => cache.delete(k));
    }
    return pending;
  };
}
