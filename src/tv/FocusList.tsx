import React, { forwardRef } from 'react';
import { FlatList, type FlatListProps } from 'react-native';

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
      // Forced — never let a caller re-enable clipping or shrink the window
      // below what keeps focusable rows mounted.
      removeClippedSubviews={false}
      windowSize={Math.max(21, props.windowSize ?? 0)}
    />
  );
});
