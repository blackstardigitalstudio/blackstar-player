import type React from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, focusRing, radius } from '@/theme/tokens';

// TV-NATIVE build (react-native-tvos): a Focusable is just a Pressable that Android
// TV can focus with the D-pad on its own. `focused` comes from the NATIVE focus
// (onFocus/onBlur), so the selection ring is always exactly ONE element and always
// visible — no custom JS focus engine fighting the platform. `autoFocus` maps to
// hasTVPreferredFocus (the element the screen wants focused first). The render prop
// keeps its old signature (focused, focusSelf) so every screen works unchanged.

interface Props {
  onSelect?: () => void;
  onLongSelect?: () => void;
  onFocus?: () => void;
  style?: StyleProp<ViewStyle>;
  focusStyle?: StyleProp<ViewStyle>;
  focusKey?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  children: React.ReactNode | ((focused: boolean, focusSelf: () => void) => React.ReactNode);
}

const noop = () => {};

export function Focusable({
  onSelect,
  onLongSelect,
  onFocus,
  style,
  focusStyle,
  autoFocus,
  disabled,
  children,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      disabled={disabled}
      // react-native-tvos: focus this element first when the screen mounts.
      {...(autoFocus ? { hasTVPreferredFocus: true } : {})}
      onPress={onSelect}
      onLongPress={onLongSelect}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[style, focused && (focusStyle ?? styles.focused)]}
    >
      {typeof children === 'function' ? (children as any)(focused, noop) : children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Color-only focus ring (border + brighter fill, no scale/shadow) — matches the
  // project's box-app-rules convention used by Card/FolderTile/Browser. Avoids the
  // scale transform that can clip a near-edge control under TV overscan or jitter.
  focused: {
    borderColor: colors.borderFocus,
    borderWidth: focusRing.borderWidth,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
  },
});
