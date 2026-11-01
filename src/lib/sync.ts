import { useEffect, useRef, useState } from 'react';
import { getSyncData, saveSyncData } from 'zitejs/api';
import { exportAll, importAll, localUpdatedAt, onAnyChange } from './storage';

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

export function useSync(userId: string | null) {
  const [status, setStatus] = useState<SyncStatus>('off');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!userId) {
      setStatus('off');
      return;
    }
    let cancelled = false;
    let ready = false;

    const push = async () => {
      setStatus('syncing');
      try {
        await saveSyncData({ savedData: JSON.stringify({ updatedAt: localUpdatedAt() || Date.now(), data: exportAll() }) });
        if (!cancelled) setStatus('synced');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    (async () => {
      setStatus('syncing');
      try {
        const res = await getSyncData({});
        if (cancelled) return;
        if (res.savedData) {
          const server = JSON.parse(res.savedData) as { updatedAt: number; data: Record<string, unknown> };
          const local = exportAll();
          const serverNewer = server.updatedAt > localUpdatedAt();
          const merged = serverNewer ? { ...local, ...server.data } : { ...server.data, ...local };
          importAll(merged, { stamp: Math.max(server.updatedAt, localUpdatedAt()) });
        }
        ready = true;
        await push();
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    const off = onAnyChange(() => {
      if (!ready) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(push, 1500);
    });
    return () => {
      cancelled = true;
      off();
      clearTimeout(timer.current);
    };
  }, [userId]);

  return status;
}
