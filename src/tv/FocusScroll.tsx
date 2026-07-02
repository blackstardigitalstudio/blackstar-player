import React, { createContext, useCallback, useContext, useRef } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import type { Rect } from './RemoteProvider';

type Ctx = { scrollToRect: (r: Rect) => void } | null;
const ScrollCtx = createContext<Ctx>(null);
export const useFocusScroll = () => useContext(ScrollCtx);

/**
 * A ScrollView that scrolls to keep the currently-focused element on screen
 * (so remote navigation never "loses" the highlight off the fold).
 */
export function FocusScrollView({
  children,
  ...rest
}: ScrollViewProps & { children: React.ReactNode }) {
  const ref = useRef<ScrollView>(null);
  const wrapRef = useRef<View>(null);
  const offset = useRef(0);
  const box = useRef({ y: 0, h: 0 });

  const measureBox = useCallback(() => {
    const node = wrapRef.current as any;
    node?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
      box.current = { y, h };
    });
  }, []);

  const scrollToRect = useCallback((r: Rect) => {
    const { y: vy, h: vh } = box.current;
    if (!vh) return;
    const relTop = r.y - vy;
    const relBottom = relTop + r.h;
    const m = 96; // keep a comfortable margin from the edges
    let dy = 0;
    if (relTop < m) dy = relTop - m;
    else if (relBottom > vh - m) dy = relBottom - (vh - m);
    if (Math.abs(dy) > 2) {
      offset.current = Math.max(0, offset.current + dy);
      // animated:false → the next D-pad measure is immediately accurate (no mid-animation race).
      ref.current?.scrollTo({ y: offset.current, animated: false });
    }
  }, []);

  return (
    <ScrollCtx.Provider value={{ scrollToRect }}>
      <View ref={wrapRef} style={{ flex: 1 }} onLayout={measureBox}>
        <ScrollView
          ref={ref}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          {...rest}
        >
          {children}
        </ScrollView>
      </View>
    </ScrollCtx.Provider>
  );
}
