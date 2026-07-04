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
  /** Focus layer this node lives in. Only nodes in the active (top) layer are reachable. */
  layer: number;
  /** Prefer this node when its layer activates (e.g. a modal's primary button). */
  autoFocus?: boolean;
  /** Last known window rect — used when a fresh measure returns null (mid-layout),
   *  so a transient bad measure never makes navigation jump or lose the cursor. */
  rect?: Rect | null;
}

/** Notified with the authoritative focused id on every focus change. */
type FocusListener = (focusedId: string | null) => void;
type KeyHandler = (key: RemoteKey) => boolean | void;

interface RemoteCtx {
  register: (n: Node) => void;
  unregister: (id: string) => void;
  requestFocus: (id: string) => void;
  /** Subscribe to focus changes. Called immediately with the current focus. Returns an unsubscribe. */
  subscribe: (fn: FocusListener) => () => void;
  pushHandler: (h: KeyHandler) => () => void;
  dispatch: (key: RemoteKey) => void;
  setPointerMode: (v: boolean) => void;
  /** Push/pop a focus layer (modal trap): while active, only its nodes are reachable. */
  activateLayer: (layer: number) => void;
  deactivateLayer: (layer: number) => void;
}

const Ctx = createContext<RemoteCtx | null>(null);

/** The focus layer new Focusables register into. Modals raise it via <FocusLayer>. */
export const FocusLayerContext = createContext<number>(0);

let layerCounterSeed = 0;

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
  const listeners = useRef(new Set<FocusListener>());
  const handlers = useRef<KeyHandler[]>([]);
  const focusedRef = useRef<string | null>(null);
  // Last known center of the focused node — anchor for re-homing after an unmount
  // so focus lands on a spatial neighbour instead of teleporting to node #0.
  const focusedCenterRef = useRef<{ x: number; y: number } | null>(null);
  // Layer stack (base 0). Only nodes in the top layer are reachable → modal trap.
  const layerStackRef = useRef<number[]>([0]);
  const savedFocusRef = useRef<Record<number, string | null>>({});
  const activeLayer = () => layerStackRef.current[layerStackRef.current.length - 1];

  // pointerMode is intentionally NOT part of the context value (the ring is always
  // shown when focused), so pointer/key transitions don't re-render the tree.
  const setPointerMode = useCallback((_v: boolean) => {}, []);

  // Single source of truth: the focused id lives in a ref. Every change is
  // broadcast to ALL focusables with the authoritative id, so a stale/stuck
  // ring is impossible (each computes focused = myId === focusedId). React
  // bails out of unchanged setState, so only the two affected nodes re-render.
  const setFocus = useCallback((id: string | null) => {
    if (focusedRef.current === id) return;
    focusedRef.current = id;
    listeners.current.forEach((l) => l(id));
  }, []);

  const subscribe = useCallback((fn: FocusListener) => {
    listeners.current.add(fn);
    fn(focusedRef.current);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const register = useCallback(
    (n: Node) => {
      nodes.current.set(n.id, n);
      // Auto-focus the first element that registers on an empty (active-layer) screen.
      if (!focusedRef.current && n.layer === activeLayer()) setFocus(n.id);
    },
    [setFocus],
  );

  // Re-home focus onto the spatially nearest surviving node in the active layer
  // (anchored to where focus just was), instead of dropping to null / node #0.
  const rehome = useCallback(async () => {
    if (focusedRef.current) return; // already refocused meanwhile
    const layer = activeLayer();
    const candidates = Array.from(nodes.current.values()).filter((n) => n.layer === layer);
    if (!candidates.length) return; // nothing to focus yet — watchdog will retry on next register
    const anchor = focusedCenterRef.current;
    if (!anchor) {
      setFocus(candidates[0].id);
      return;
    }
    const measured = await Promise.all(
      candidates.map(async (n) => {
        const fresh = await n.measure();
        if (fresh) n.rect = fresh;
        return { n, r: fresh ?? n.rect ?? null };
      }),
    );
    if (focusedRef.current) return;
    let best: Node | null = null;
    let bestD = Infinity;
    for (const { n, r } of measured) {
      if (!r) continue;
      const c = center(r);
      const d = (c.x - anchor.x) ** 2 + (c.y - anchor.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    setFocus(best ? best.id : candidates[0].id);
  }, [setFocus]);

  // Watchdog: schedule a re-home AFTER the current commit settles, so it sees the
  // final mounted set (post-virtualization / post-category-switch). Guarantees
  // focus is never left null while focusable nodes exist → the cursor is never lost.
  const rehomeScheduled = useRef(false);
  const scheduleRehome = useCallback(() => {
    if (rehomeScheduled.current) return;
    rehomeScheduled.current = true;
    const run = () => {
      rehomeScheduled.current = false;
      rehome();
    };
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(run);
    else setTimeout(run, 0);
  }, [rehome]);

  const unregister = useCallback(
    (id: string) => {
      const wasFocused = focusedRef.current === id;
      nodes.current.delete(id);
      if (wasFocused) {
        setFocus(null); // clear the (now-gone) ring immediately…
        scheduleRehome(); // …then re-home once the tree settles
      }
    },
    [setFocus, scheduleRehome],
  );

  const requestFocus = useCallback(
    (id: string) => {
      // Only focusable if the node lives in the active (top) layer — this traps
      // focus inside a modal and blocks hover/auto-focus from bleeding behind it.
      const n = nodes.current.get(id);
      if (n && n.layer === activeLayer()) setFocus(id);
    },
    [setFocus],
  );

  const activateLayer = useCallback(
    (layer: number) => {
      savedFocusRef.current[layer] = focusedRef.current;
      layerStackRef.current.push(layer);
      // Focus the layer's primary (autoFocus) node if it has one, else the first.
      const inLayer = Array.from(nodes.current.values()).filter((n) => n.layer === layer);
      const target = inLayer.find((n) => n.autoFocus) ?? inLayer[0];
      setFocus(target ? target.id : null);
    },
    [setFocus],
  );

  const deactivateLayer = useCallback(
    (layer: number) => {
      layerStackRef.current = layerStackRef.current.filter((l) => l !== layer);
      const restore = savedFocusRef.current[layer];
      delete savedFocusRef.current[layer];
      const n = restore ? nodes.current.get(restore) : undefined;
      setFocus(n && n.layer === activeLayer() ? restore! : null);
    },
    [setFocus],
  );

  // Serialize moves: measuring is async (measureInWindow), so overlapping moves
  // could read stale rects mid-scroll and pick the wrong neighbour. While one is
  // resolving we remember only the latest pending direction and run it after.
  const movingRef = useRef(false);
  const pendingDirRef = useRef<RemoteKey | null>(null);

  const move = useCallback(
    async (dir: RemoteKey) => {
      if (movingRef.current) {
        pendingDirRef.current = dir;
        return;
      }
      movingRef.current = true;
      try {
        // Hard cap: even if moveOnce somehow stalls, the lock releases within
        // 300ms so the remote can NEVER get permanently stuck ("cursor freezes
        // after a while"). Per-measure timeouts already bound the normal path.
        await Promise.race([moveOnce(dir), new Promise((r) => setTimeout(r, 300))]);
      } finally {
        movingRef.current = false;
        const next = pendingDirRef.current;
        pendingDirRef.current = null;
        if (next) move(next);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const moveOnce = useCallback(
    async (dir: RemoteKey) => {
      const layer = activeLayer();
      // Only consider nodes in the active layer (modal trap) — never navigate behind.
      const list = Array.from(nodes.current.values()).filter((n) => n.layer === layer);
      if (!list.length) return;
      const current = focusedRef.current ? nodes.current.get(focusedRef.current) : null;
      // Measure fresh, but fall back to each node's last known rect when a measure
      // returns null (view mid-layout / mid-scroll). A transient bad measure must
      // never make navigation jump or lose the cursor — this kills the "sometimes
      // it works, sometimes not" flicker.
      const rects = await Promise.all(
        list.map(async (n) => {
          const fresh = await n.measure();
          if (fresh) n.rect = fresh;
          return { n, r: fresh ?? n.rect ?? null };
        }),
      );
      const valid = rects.filter((x) => x.r) as { n: Node; r: Rect }[];

      // Pick the node nearest to where focus last was (spatial re-home), used only
      // when there is genuinely no current focus (it was null).
      const nearestToAnchor = () => {
        const a = focusedCenterRef.current;
        if (!a) return valid[0];
        let pick = valid[0];
        let bestD = Infinity;
        for (const v of valid) {
          const c = center(v.r);
          const d = (c.x - a.x) ** 2 + (c.y - a.y) ** 2;
          if (d < bestD) {
            bestD = d;
            pick = v;
          }
        }
        return pick;
      };
      const remember = (r: Rect) => {
        focusedCenterRef.current = center(r);
      };

      if (!current) {
        const p = nearestToAnchor();
        if (p) {
          remember(p.r);
          setFocus(p.n.id);
        }
        return;
      }
      // Inside a modal (raised layer), navigate by registration order so a couple
      // of buttons in a row are ALWAYS reachable — native Modals live in a separate
      // window where measureInWindow is unreliable, so geometry alone can leave you
      // stuck on one button ("couldn't move between Aggiorna and Più tardi").
      const cycleInLayer = () => {
        const ids = list.map((n) => n.id);
        const idx = ids.indexOf(current.id);
        if (idx < 0 || ids.length < 2) return;
        const fwd = dir === 'right' || dir === 'down';
        const nextIdx = (idx + (fwd ? 1 : -1) + ids.length) % ids.length;
        setFocus(ids[nextIdx]);
      };
      const inModal = layer !== 0;

      const fromRect = valid.find((x) => x.n.id === current.id)?.r;
      if (!fromRect) {
        // Current node couldn't be located this frame. In a modal, fall back to
        // order cycling; on a normal screen keep focus put and retry next press.
        if (inModal) cycleInLayer();
        return;
      }
      let best: { id: string; cost: number; r: Rect } | null = null;
      for (const { n, r } of valid) {
        if (n.id === current.id) continue;
        const cost = directionalCost(dir, fromRect, r);
        if (cost < 0) continue;
        if (!best || cost < best.cost) best = { id: n.id, cost, r };
      }
      if (best) {
        remember(best.r);
        setFocus(best.id);
      } else if (inModal) {
        // No directional neighbour found via geometry — cycle the modal's buttons.
        cycleInLayer();
      }
    },
    [setFocus],
  );

  const dispatch = useCallback(
    (key: RemoteKey) => {
      // A remote/keyboard key means we're in "key" mode → show focus rings.
      setPointerMode(false);
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
    [move, setPointerMode],
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
    () => ({ register, unregister, requestFocus, subscribe, pushHandler, dispatch, setPointerMode, activateLayer, deactivateLayer }),
    [register, unregister, requestFocus, subscribe, pushHandler, dispatch, setPointerMode, activateLayer, deactivateLayer],
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

/** The focus layer the current subtree registers into (0 = base screen). */
export function useFocusLayer() {
  return useContext(FocusLayerContext);
}

/**
 * Wrap a modal's content in <FocusLayer> to TRAP the D-pad inside it: while
 * mounted, only Focusables rendered within it are reachable, and focus can't
 * bleed to the screen behind. On unmount, focus returns to where it was.
 */
export function FocusLayer({ children }: { children: React.ReactNode }) {
  const { activateLayer, deactivateLayer } = useRemote();
  const layerRef = useRef(0);
  if (layerRef.current === 0) layerRef.current = ++layerCounterSeed;
  const layer = layerRef.current;
  useEffect(() => {
    activateLayer(layer);
    return () => deactivateLayer(layer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <FocusLayerContext.Provider value={layer}>{children}</FocusLayerContext.Provider>;
}
