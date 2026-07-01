import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, compact, focusRing, radius } from '@/theme/tokens';
import { useRemote, type Rect } from './RemoteProvider';

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
  const { register, unregister, requestFocus, pointerMode, setPointerMode } = useRemote();

  const measure = useCallback(
    () =>
      new Promise<Rect | null>((resolve) => {
        const node = ref.current as any;
        if (!node || !node.measureInWindow) return resolve(null);
        node.measureInWindow((x: number, y: number, w: number, h: number) => {
          if (!w && !h) resolve(null);
          else resolve({ x, y, w, h });
        });
      }),
    [],
  );

  useEffect(() => {
    if (disabled) {
      unregister(id);
      return;
    }
    register({
      id,
      measure,
      onSelect,
      onFocusChange: (f) => {
        setFocused(f);
        if (f) onFocus?.();
      },
    });
    return () => unregister(id);
  }, [register, unregister, id, measure, onSelect, onFocus, disabled]);

  useEffect(() => {
    if (autoFocus && !disabled) requestFocus(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TV: the focus ring is ALWAYS visible while focused (so you never lose your
  // place with the remote). Phone: show it only when navigating by key, not touch.
  const ring = compact ? focused && !pointerMode : focused;

  return (
    <Pressable
      ref={ref as any}
      disabled={disabled}
      onPress={onSelect}
      onPressIn={() => {
        setPointerMode(true);
        requestFocus(id);
      }}
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
