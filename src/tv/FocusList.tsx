import React, { forwardRef, useCallback, useRef } from 'react';
import { FlatList, type FlatListProps, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

/**
 * The ONE scroll-follow logic for every navigable list (R3). Margin-based +
 * animated:false: it scrolls ONLY when the focused item would fall outside a
 * comfortable margin, and jumps instantly (no animation) so the next D-pad
 * measure is accurate — animated scrolls used to race the next keypress and
 * "lose the cursor" after a few rows. Works for vertical and horizontal lists.
 *
 * Wire it up: spread {...ref/onScroll/onLayout} onto the <FocusList>, and call
 * reveal(itemStart, itemSize) from each item's onFocus.
 */
export function useListScroll(horizontal = false) {
  const ref = useRef<FlatList<any>>(null);
  const offset = useRef(0);
  const viewport = useRef(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = horizontal ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y;
    },
    [horizontal],
  );
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewport.current = horizontal ? e.nativeEvent.layout.width : e.nativeEvent.layout.height;
    },
    [horizontal],
  );
  const reveal = useCallback((start: number, size: number) => {
    const v = viewport.current;
    if (!v) return;
    const end = start + size;
    const m = Math.min(size, v * 0.25); // keep a comfortable margin from the edges
    let target = offset.current;
    if (start - offset.current < m) target = start - m;
    else if (end - offset.current > v - m) target = end - (v - m);
    target = Math.max(0, target);
    if (Math.abs(target - offset.current) > 1) {
      offset.current = target;
      ref.current?.scrollToOffset({ offset: target, animated: false });
    }
  }, []);

  return { ref, onScroll, onLayout, reveal };
}

/**
 * The ONLY list to use for D-pad-navigable content (channels, categories,
 * rails, grids, EPG rows). It bakes in the fixed anti-virtualization rules so
 * they can never be forgotten on a new screen:
 *
 *  - removeClippedSubviews={false}: Android defaults this to TRUE, which UNMOUNTS
 *    offscreen rows. If the focused row unmounts, the remote "loses the cursor".
 *    This is the single most common cause of lost focus on a box. Forced off.
 *  - a large windowSize so the focused item is effectively never virtualized away
 *    during normal one-step navigation.
 *
 * Callers still pass data/renderItem/getItemLayout/onScroll/ref as usual; the
 * critical props are forced AFTER the spread so they can't be weakened.
 * Rule R3 — see memory box-app-rules.
 */
export const FocusList = forwardRef<FlatList<any>, FlatListProps<any>>(function FocusList(props, ref) {
  return (
    <FlatList
      ref={ref}
      initialNumToRender={props.initialNumToRender ?? 12}
      maxToRenderPerBatch={props.maxToRenderPerBatch ?? 12}
      updateCellsBatchingPeriod={props.updateCellsBatchingPeriod ?? 40}
      scrollEventThrottle={props.scrollEventThrottle ?? 16}
      {...props}
      // Forced — never let a caller re-enable clipping (Android default TRUE
      // unmounts offscreen focusables → lost cursor) and keep a generous window
      // so the target row is always mounted even in a 2000+ item list during
      // fast scroll (a small window lets the next row unmount → focus jumps to a
      // far card). Speed comes from the margin-based animated:false scroll (it
      // rarely scrolls at all), not from rendering fewer rows.
      removeClippedSubviews={false}
      windowSize={Math.max(21, props.windowSize ?? 21)}
    />
  );
});
