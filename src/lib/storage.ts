import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'skp:';
const STAMP_KEY = PREFIX + '__updatedAt';
const keyListeners = new Map<string, Set<() => void>>();
const anyListeners = new Set<() => void>();

export function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function notify(key: string) {
  keyListeners.get(key)?.forEach((l) => l());
}

export function writeKey<T>(key: string, value: T, silent = false) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
  if (!silent) {
    localStorage.setItem(STAMP_KEY, String(Date.now()));
    anyListeners.forEach((l) => l());
  }
  notify(key);
}

export function onAnyChange(l: () => void) {
  anyListeners.add(l);
  return () => {
    anyListeners.delete(l);
  };
}

export function localUpdatedAt(): number {
  return Number(localStorage.getItem(STAMP_KEY) || 0);
}

export function exportAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith(PREFIX) && !k.startsWith(PREFIX + '__')) {
      try {
        out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
      } catch {
        /* skip bad entry */
      }
    }
  }
  return out;
}

export function importAll(data: Record<string, unknown>, opts: { silent?: boolean; stamp?: number } = {}) {
  Object.entries(data).forEach(([k, v]) => writeKey(k, v, true));
  localStorage.setItem(STAMP_KEY, String(opts.stamp ?? Date.now()));
  if (!opts.silent) anyListeners.forEach((l) => l());
}

export function useStored<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(() => readKey(key, initial));
  useEffect(() => {
    const l = () => setVal(readKey(key, initial));
    if (!keyListeners.has(key)) keyListeners.set(key, new Set());
    keyListeners.get(key)!.add(l);
    l();
    return () => {
      keyListeners.get(key)!.delete(l);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(readKey(key, initial)) : v;
      writeKey(key, next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [val, set] as const;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
