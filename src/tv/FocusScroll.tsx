import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, View, type ScrollViewProps } from 'react-native';
import type { Rect } from './RemoteProvider';

type Ctx = { scrollToRect: (r: Rect) => void } | null;
const ScrollCtx = createContext<Ctx>(null);
export const useFocusScroll = () => useContext(ScrollCtx);

/**
 * A ScrollView that scrolls to keep the currently-focused element on screen
 * (so remote navigation never "loses" the highlight off the fold) AND above the
 * on-screen keyboard. On Android TV the IME overlays the window WITHOUT resizing
 * it, so we track the keyboard height and treat the area it covers as not
 * visible — otherwise a focused field in the lower half stays hidden behind the
 * keyboard ("il campo coperto dalla tastiera").
 */
export function FocusScrollView({
  children,
  ...rest
}: ScrollViewProps & { children: React.ReactNode }) {
  const ref = useRef<ScrollView>(null);
  const wrapRef = useRef<View>(null);
  const offset = useRef(0);
  const box = useRef({ y: 0, h: 0 });
  const kbH = useRef(0);
  // State so the bottom spacer re-renders — it gives the ScrollView enough room
  // to scroll the LAST fields up above the keyboard.
  const [kbSpace, setKbSpace] = useState(0);

  useEffect(() => {
    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      kbH.current = h;
      setKbSpace(h);
    };
    const onHide = () => {
      kbH.current = 0;
      setKbSpace(0);
    };
    const s1 = Keyboard.addListener('keyboardDidShow', onShow);
    const s2 = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  const measureBox = useCallback(() => {
    const node = wrapRef.current as any;
    node?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
      box.current = { y, h };
    });
  }, []);

  const scrollToRect = useCallback((r: Rect) => {
    const { y: vy, h: vh } = box.current;
    if (!vh) return;
    // Visible height = viewport minus the keyboard overlay. Clamp to half the
    // viewport so that on boxes that DO resize the window (double-counting the
    // keyboard) the field just lands a bit higher instead of scrolling absurdly.
    const visibleH = Math.max(vh * 0.5, vh - kbH.current);
    const relTop = r.y - vy;
    const relBottom = relTop + r.h;
    const m = 80; // comfortable margin from the top edge / above the keyboard
    let dy = 0;
    if (relTop < m) dy = relTop - m;
    else if (relBottom > visibleH - m) dy = relBottom - (visibleH - m);
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
          {/* Extra room so even the last field can scroll up above the keyboard. */}
          <View style={{ height: kbSpace }} />
        </ScrollView>
      </View>
    </ScrollCtx.Provider>
  );
}
