import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, focusRing, radius } from '@/theme/tokens';
import { useRemote, useFocusLayer, type Rect } from './RemoteProvider';
import { useFocusScroll } from './FocusScroll';

let counter = 0;

interface Props {
  onSelect?: () => void;
  onFocus?: () => void;
  style?: StyleProp<ViewStyle>;
  focusStyle?: StyleProp<ViewStyle>;
  /** Stable key; if omitted an auto id is used. */
  focusKey?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Render prop receives focus state + a focusSelf() to sync engine focus from a native input. */
  children: React.ReactNode | ((focused: boolean, focusSelf: () => void) => React.ReactNode);
}

export function Focusable({
  onSelect,
  onFocus,
  style,
  focusStyle,
  focusKey,
  autoFocus,
  disabled,
  children,
}: Props) {
  const ref = useRef<View>(null);
  const idRef = useRef(focusKey || `f${++counter}`);
  const id = idRef.current;
  const [focused, setFocused] = useState(false);
  const { register, unregister, requestFocus, setPointerMode, subscribe, reportRect } = useRemote();
  const layer = useFocusLayer();
  const scroll = useFocusScroll();

  // Keep callbacks in refs so the register effect never re-runs on every render
  // (inline onSelect/onFocus closures would otherwise churn register/unregister
  // and could drop focus notifications → stuck rings).
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  const measure = useCallback(
    () =>
      new Promise<Rect | null>((resolve) => {
        const node = ref.current as any;
        if (!node || !node.measureInWindow) return resolve(null);
        // CRITICAL: measureInWindow's callback may NEVER fire if the native view
        // gets detached (virtualization/unmount mid-scroll). Without a timeout the
        // promise hangs forever, the engine's "moving" lock never releases, and the
        // remote stops responding ("after a while the cursor freezes"). Always
        // resolve within a deadline — the caller falls back to the cached rect.
        let done = false;
        const finish = (r: Rect | null) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(r);
        };
        const timer = setTimeout(() => finish(null), 120);
        node.measureInWindow((x: number, y: number, w: number, h: number) => {
          if (!w && !h) finish(null);
          else finish({ x, y, w, h });
        });
      }),
    [],
  );

  // Measure and push the rect into the engine's cache. The cache is what D-pad
  // navigation reads (synchronously), so keeping it fresh here is what makes the
  // arrows both instant and reliable.
  const measureAndReport = useCallback(() => {
    measure().then((r) => reportRect(id, r));
  }, [measure, reportRect, id]);

  // Register once (stable deps). onSelect is read from the ref at call time.
  useEffect(() => {
    if (disabled) {
      unregister(id);
      return;
    }
    register({ id, measure, layer, autoFocus, onSelect: () => onSelectRef.current?.() });
    return () => unregister(id);
  }, [register, unregister, id, measure, disabled, layer, autoFocus]);

  // Authoritative focus subscription: recomputes focused = (focusedId === id)
  // on EVERY focus change. Impossible to miss an update → no stuck rings.
  useEffect(() => {
    return subscribe((focusedId) => {
      const f = focusedId === id;
      setFocused(f);
      if (f) {
        onFocusRef.current?.();
        // Refresh this node's cached rect (it's the anchor for the next move) and
        // keep it on screen inside a FocusScrollView.
        measure().then((r) => {
          if (r) reportRect(id, r);
          if (r && scroll) scroll.scrollToRect(r);
        });
      }
    });
  }, [subscribe, id, scroll, measure, reportRect]);

  useEffect(() => {
    if (autoFocus && !disabled) requestFocus(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The focus ring is ALWAYS visible while focused so you never lose your place.
  const ring = focused;

  return (
    <Pressable
      ref={ref as any}
      disabled={disabled}
      // Populate the position cache whenever this node is laid out (mount, and
      // when it scrolls into view a list re-lays it out) so navigation is instant.
      onLayout={measureAndReport}
      onPress={onSelect}
      onPressIn={() => {
        setPointerMode(true);
        requestFocus(id);
      }}
      // Mouse / air-mouse: hovering focuses the element (ring follows the cursor).
      onHoverIn={() => requestFocus(id)}
      onPointerEnter={() => requestFocus(id)}
      style={({ pressed }) => [style, ring && (focusStyle ?? styles.focused), pressed && styles.pressed]}
    >
      {typeof children === 'function' ? (children as any)(ring, () => requestFocus(id)) : children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focused: {
    borderColor: colors.borderFocus,
    borderWidth: focusRing.borderWidth,
    borderRadius: radius.md,
    transform: [{ scale: focusRing.scale }],
    shadowColor: colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
  },
  pressed: { opacity: 0.55 },
});
