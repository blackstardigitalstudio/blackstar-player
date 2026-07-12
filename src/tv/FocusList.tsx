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
      // unmounts offscreen focusables → lost cursor). Keep a window big enough
      // that the next row in a one-step move is always mounted (measurable), but
      // no longer the full RN default of 21 screens: on a low-RAM box a 2000+
      // channel Xtream list with logos mounted ~21 screens deep runs out of
      // memory and the app is killed ("mi butta fuori"). 11 keeps ~5 screens
      // each way (plenty for D-pad) and roughly halves the live view count; the
      // engine's SYNCHRONOUS re-home now keeps the ring alive even if the focused
      // card is ever virtualized away, so a smaller window can't lose the cursor.
      removeClippedSubviews={false}
      windowSize={Math.max(11, props.windowSize ?? 11)}
    />
  );
});
