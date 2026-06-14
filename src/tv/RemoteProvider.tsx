import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';
import { androidKeyToRemote, webKeyToRemote, type RemoteKey } from './keys';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Node {
  id: string;
  measure: () => Promise<Rect | null>;
  onSelect?: () => void;
  onFocusChange?: (f: boolean) => void;
}

type KeyHandler = (key: RemoteKey) => boolean | void;

interface RemoteCtx {
  focusedId: string | null;
  register: (n: Node) => void;
  unregister: (id: string) => void;
  requestFocus: (id: string) => void;
  pushHandler: (h: KeyHandler) => () => void;
  dispatch: (key: RemoteKey) => void;
}

const Ctx = createContext<RemoteCtx | null>(null);

function center(r: Rect) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Score a candidate rect for movement in `dir` from `from`. Lower is better; -1 = invalid. */
function directionalCost(dir: RemoteKey, from: Rect, to: Rect): number {
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const PRIMARY_MIN = 8;
  switch (dir) {
    case 'right':
      if (dx <= PRIMARY_MIN) return -1;
      return dx + Math.abs(dy) * 2.5;
    case 'left':
      if (dx >= -PRIMARY_MIN) return -1;
      return -dx + Math.abs(dy) * 2.5;
    case 'down':
      if (dy <= PRIMARY_MIN) return -1;
      return dy + Math.abs(dx) * 2.5;
    case 'up':
      if (dy >= -PRIMARY_MIN) return -1;
      return -dy + Math.abs(dx) * 2.5;
    default:
      return -1;
  }
}

export function RemoteProvider({ children }: { children: React.ReactNode }) {
  const nodes = useRef(new Map<string, Node>());
  const handlers = useRef<KeyHandler[]>([]);
  const focusedRef = useRef<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const setFocus = useCallback((id: string | null) => {
    const prev = focusedRef.current;
    if (prev === id) return;
    if (prev) nodes.current.get(prev)?.onFocusChange?.(false);
    focusedRef.current = id;
    setFocusedId(id);
    if (id) nodes.current.get(id)?.onFocusChange?.(true);
  }, []);

  const register = useCallback(
    (n: Node) => {
      nodes.current.set(n.id, n);
      if (!focusedRef.current) setFocus(n.id);
    },
    [setFocus],
  );

  const unregister = useCallback(
    (id: string) => {
      nodes.current.delete(id);
      if (focusedRef.current === id) {
        focusedRef.current = null;
        setFocusedId(null);
      }
    },
    [],
  );

  const requestFocus = useCallback((id: string) => {
    if (nodes.current.has(id)) setFocus(id);
  }, [setFocus]);

  const move = useCallback(
    async (dir: RemoteKey) => {
      const list = Array.from(nodes.current.values());
      if (!list.length) return;
      const current = focusedRef.current ? nodes.current.get(focusedRef.current) : null;
      const rects = await Promise.all(
        list.map(async (n) => ({ n, r: await n.measure() })),
      );
      const valid = rects.filter((x) => x.r) as { n: Node; r: Rect }[];
      if (!current) {
        if (valid[0]) setFocus(valid[0].n.id);
        return;
      }
      const fromRect = valid.find((x) => x.n.id === current.id)?.r;
      if (!fromRect) {
        if (valid[0]) setFocus(valid[0].n.id);
        return;
      }
      let best: { id: string; cost: number } | null = null;
      for (const { n, r } of valid) {
        if (n.id === current.id) continue;
        const cost = directionalCost(dir, fromRect, r);
        if (cost < 0) continue;
        if (!best || cost < best.cost) best = { id: n.id, cost };
      }
      if (best) setFocus(best.id);
    },
    [setFocus],
  );

  const dispatch = useCallback(
    (key: RemoteKey) => {
      // app-level handlers first (LIFO)
      for (let i = handlers.current.length - 1; i >= 0; i--) {
        if (handlers.current[i](key) === true) return;
      }
      if (key === 'up' || key === 'down' || key === 'left' || key === 'right') {
        move(key);
      } else if (key === 'select') {
        const id = focusedRef.current;
        if (id) nodes.current.get(id)?.onSelect?.();
      }
    },
    [move],
  );

  const pushHandler = useCallback((h: KeyHandler) => {
    handlers.current.push(h);
    return () => {
      handlers.current = handlers.current.filter((x) => x !== h);
    };
  }, []);

  // Native key bridge (Android box / TV remote) + web keyboard fallback.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('BlackstarRemoteKey', (e: { keyCode: number }) => {
      const k = androidKeyToRemote(e?.keyCode);
      if (k) dispatch(k);
    });
    let webHandler: ((e: KeyboardEvent) => void) | null = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      webHandler = (e: KeyboardEvent) => {
        const k = webKeyToRemote(e.key);
        if (k) {
          e.preventDefault();
          dispatch(k);
        }
      };
      window.addEventListener('keydown', webHandler);
    }
    return () => {
      sub.remove();
      if (webHandler && typeof window !== 'undefined') window.removeEventListener('keydown', webHandler);
    };
  }, [dispatch]);

  const value = useMemo<RemoteCtx>(
    () => ({ focusedId, register, unregister, requestFocus, pushHandler, dispatch }),
    [focusedId, register, unregister, requestFocus, pushHandler, dispatch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRemote() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRemote must be used inside RemoteProvider');
  return ctx;
}

/** Subscribe a screen-level key handler. Return true from `handler` to consume the key. */
export function useKeyHandler(handler: KeyHandler, deps: React.DependencyList = []) {
  const { pushHandler } = useRemote();
  useEffect(() => {
    return pushHandler(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
