import { useStored } from './storage';

export type Recent = { id: string; at: number };

export function usePinned() {
  const [pinned, setPinned] = useStored<string[]>('pinned', ['attendance', 'cgpa']);
  const toggle = (id: string) => setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return { pinned, toggle };
}

export function useRecent() {
  const [recent, setRecent] = useStored<Recent[]>('recent', []);
  const touch = (id: string) => setRecent((r) => [{ id, at: Date.now() }, ...r.filter((x) => x.id !== id)].slice(0, 12));
  return { recent, touch };
}
