import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /** Cached window rect. D-pad navigation reads THIS synchronously (never measures
   *  on the keypress) so arrows are instant and can never hang. Kept fresh by the
   *  Focusable (on layout + on focus) and a background refresh after each move. */
  rect?: Rect | null;
}

/** Notified with the authoritative focused id on every focus change. */
type FocusListener = (focusedId: string | null) => void;
type KeyHandler = (key: RemoteKey) => boolean | void;

interface RemoteCtx {
  register: (n: Node) => void;
  unregister: (id: string) => void;
  requestFocus: (id: string) => void;
  /** Focusable reports its measured window rect into the cache. */
  reportRect: (id: string, rect: Rect | null) => void;
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

const raf = (fn: () => void) =>
  typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(fn) : (setTimeout(fn, 0) as unknown as number);

export function RemoteProvider({ children }: { children: React.ReactNode }) {
  const nodes = useRef(new Map<string, Node>());
  const listeners = useRef(new Set<FocusListener>());
  const handlers = useRef<KeyHandler[]>([]);
  const focusedRef = useRef<string | null>(null);
  // Last known center of the focused node — anchor for re-homing after an unmount.
  const savedCenterRef = useRef<{ x: number; y: number } | null>(null);
  const layerStackRef = useRef<number[]>([0]);
  const savedFocusRef = useRef<Record<number, string | null>>({});
  const activeLayer = () => layerStackRef.current[layerStackRef.current.length - 1];

  // pointerMode is a no-op now (ring is always shown when focused).
  const setPointerMode = useCallback((_v: boolean) => {}, []);

  // Single source of truth: the focused id lives in a ref and every change is
  // broadcast to all focusables with the authoritative id, so a stale/stuck ring
  // is impossible. React bails on unchanged setState → only 2 nodes re-render.
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

  const reportRect = useCallback((id: string, rect: Rect | null) => {
    const n = nodes.current.get(id);
    if (n && rect) n.rect = rect;
  }, []);

  const register = useCallback(
    (n: Node) => {
      nodes.current.set(n.id, n);
      // Auto-focus the first element that registers on an empty (active-layer) screen.
      if (!focusedRef.current && n.layer === activeLayer()) setFocus(n.id);
    },
    [setFocus],
  );

  const activeNodes = () => Array.from(nodes.current.values()).filter((n) => n.layer === activeLayer());

  // Re-home focus onto the spatially nearest surviving node in the active layer
  // (using cached rects — synchronous), instead of dropping to null / node #0.
  const rehomeRef = useRef<() => void>(() => {});
  const rehomeRetries = useRef(0);
  const rehome = useCallback(() => {
    if (focusedRef.current) {
      rehomeRetries.current = 0;
      return;
    }
    const list = activeNodes();
    if (!list.length) {
      // Content not mounted yet (still loading after a modal close or category
      // swap). Retry for a few frames instead of leaving the ring gone.
      if (rehomeRetries.current++ < 20) raf(() => rehomeRef.current());
      return;
    }
    rehomeRetries.current = 0;
    const withRect = list.filter((n) => n.rect) as (Node & { rect: Rect })[];
    if (!withRect.length) {
      setFocus(list[0].id);
      return;
    }
    // Anchor on the last focused center if we have one.
    const anchor = savedCenterRef.current;
    if (!anchor) {
      setFocus(withRect[0].id);
      return;
    }
    let best = withRect[0];
    let bestD = Infinity;
    for (const n of withRect) {
      const c = center(n.rect);
      const d = (c.x - anchor.x) ** 2 + (c.y - anchor.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    setFocus(best.id);
  }, [setFocus]);
  rehomeRef.current = rehome;

  const rehomeScheduled = useRef(false);
  const scheduleRehome = useCallback(() => {
    if (rehomeScheduled.current) return;
    rehomeScheduled.current = true;
    raf(() => {
      rehomeScheduled.current = false;
      rehome();
    });
  }, [rehome]);

  const unregister = useCallback(
    (id: string) => {
      const wasFocused = focusedRef.current === id;
      nodes.current.delete(id);
      if (wasFocused) {
        // Synchronously hop to the nearest surviving on-screen node so the ring
        // NEVER blinks out. The old path set focus to null and re-homed on the
        // NEXT frame — during fast scroll / zapping in a long list the re-home
        // raced the remount and left you with no cursor ("mi perde la freccia").
        // Only fall back to the async re-home when nothing measurable survives.
        const anchor = savedCenterRef.current;
        const survivors = activeNodes().filter((n) => n.rect) as (Node & { rect: Rect })[];
        let best: (Node & { rect: Rect }) | null = survivors.length ? survivors[0] : null;
        if (best && anchor) {
          let bestD = Infinity;
          for (const n of survivors) {
            const c = center(n.rect);
            const d = (c.x - anchor.x) ** 2 + (c.y - anchor.y) ** 2;
            if (d < bestD) {
              bestD = d;
              best = n;
            }
          }
        }
        if (best) {
          savedCenterRef.current = center(best.rect);
          setFocus(best.id);
        } else {
          setFocus(null); // nothing to land on yet…
          scheduleRehome(); // …re-home once the tree settles
        }
      }
    },
    [setFocus, scheduleRehome],
  );

  const requestFocus = useCallback(
    (id: string) => {
      const n = nodes.current.get(id);
      if (n && n.layer === activeLayer()) setFocus(id);
    },
    [setFocus],
  );

  const activateLayer = useCallback(
    (layer: number) => {
      savedFocusRef.current[layer] = focusedRef.current;
      layerStackRef.current.push(layer);
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
      if (n && n.layer === activeLayer()) {
        setFocus(restore!);
      } else {
        // The node we were on is gone (unmounted / re-keyed while the modal was
        // open — very common). The old code dropped focus to null with NO
        // recovery: the ring vanished and the next press was wasted re-selecting
        // it ("perdo il quadratino" + "2-3 pressioni"). Re-home onto the nearest
        // surviving node instead.
        setFocus(null);
        rehome();
        if (!focusedRef.current) scheduleRehome();
      }
    },
    [setFocus, rehome, scheduleRehome],
  );

  // Background: keep cached rects fresh after a move (scroll settles, new rows
  // appear). Runs off the keypress path so navigation stays instant. The measure
  // itself has a hard timeout in Focusable, so this can never hang either.
  const refreshScheduled = useRef(false);
  const scheduleRectRefresh = useCallback(() => {
    if (refreshScheduled.current) return;
    refreshScheduled.current = true;
    raf(() => {
      refreshScheduled.current = false;
      const list = activeNodes();
      list.forEach((n) => {
        n.measure().then((r) => {
          if (r) n.rect = r;
        });
      });
    });
  }, []);

  // Inside a modal (raised layer), navigate a row of buttons by registration
  // order — robust where geometry can't help (native Modal = separate window).
  const cycleInLayer = useCallback(
    (dir: RemoteKey, list: Node[], current: Node) => {
      const ids = list.map((n) => n.id);
      const idx = ids.indexOf(current.id);
      if (idx < 0 || ids.length < 2) return;
      const fwd = dir === 'right' || dir === 'down';
      const nextIdx = (idx + (fwd ? 1 : -1) + ids.length) % ids.length;
      setFocus(ids[nextIdx]);
    },
    [setFocus],
  );

  // SYNCHRONOUS move using cached rects — instant, never awaits, never hangs.
  const move = useCallback(
    (dir: RemoteKey) => {
      const list = activeNodes();
      if (list.length) {
        const withRect = list.filter((n) => n.rect) as (Node & { rect: Rect })[];
        const current = focusedRef.current ? nodes.current.get(focusedRef.current) : null;

        const remember = (n: Node) => {
          if (n.rect) savedCenterRef.current = center(n.rect);
        };

        if (!current || !current.rect) {
          // No usable current position → nearest cached node to the anchor, else first.
          if (withRect.length) {
            const anchor = savedCenterRef.current;
            let pick = withRect[0];
            if (anchor) {
              let bestD = Infinity;
              for (const n of withRect) {
                const c = center(n.rect);
                const d = (c.x - anchor.x) ** 2 + (c.y - anchor.y) ** 2;
                if (d < bestD) {
                  bestD = d;
                  pick = n;
                }
              }
            }
            remember(pick);
            setFocus(pick.id);
          } else if (current) {
            // In a modal with no cached rects, still allow cycling by order.
            cycleInLayer(dir, list, current);
          }
        } else {
          const from = current.rect;
          let best: (Node & { rect: Rect }) | null = null;
          let bestCost = Infinity;
          for (const n of withRect) {
            if (n.id === current.id) continue;
            const cost = directionalCost(dir, from, n.rect);
            if (cost < 0) continue;
            if (cost < bestCost) {
              bestCost = cost;
              best = n;
            }
          }
          if (best) {
            remember(best);
            setFocus(best.id);
          } else if (activeLayer() !== 0) {
            // Inside a modal with no geometric neighbour → cycle the buttons by order.
            cycleInLayer(dir, list, current);
          }
        }
      }
      // Refresh the cache for next time (scroll-follow just moved things).
      scheduleRectRefresh();
    },
    [setFocus, scheduleRectRefresh, cycleInLayer],
  );

  const dispatch = useCallback(
    (key: RemoteKey) => {
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
    () => ({
      register,
      unregister,
      requestFocus,
      reportRect,
      subscribe,
      pushHandler,
      dispatch,
      setPointerMode,
      activateLayer,
      deactivateLayer,
    }),
    [register, unregister, requestFocus, reportRect, subscribe, pushHandler, dispatch, setPointerMode, activateLayer, deactivateLayer],
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
 * mounted, only Focusables rendered within it are reachable. On unmount, focus
 * returns to where it was.
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
