import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Focusable } from '@/tv/Focusable';
import { useRemote } from '@/tv/RemoteProvider';
import { colors, font, gradients, radius, spacing } from '@/theme/tokens';

type TxtProps = {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  variant?: keyof typeof variants;
  color?: string;
  numberOfLines?: number;
};

const variants = {
  display: { fontSize: font.display, fontWeight: font.weightBold, color: colors.text },
  h1: { fontSize: font.h1, fontWeight: font.weightBold, color: colors.text },
  h2: { fontSize: font.h2, fontWeight: font.weightBold, color: colors.text },
  h3: { fontSize: font.h3, fontWeight: font.weightSemi, color: colors.text },
  body: { fontSize: font.body, fontWeight: font.weightReg, color: colors.text },
  small: { fontSize: font.small, fontWeight: font.weightReg, color: colors.textMuted },
  tiny: { fontSize: font.tiny, fontWeight: font.weightReg, color: colors.textFaint },
} as const;

export function Txt({ children, style, variant = 'body', color, numberOfLines }: TxtProps) {
  return (
    <Text numberOfLines={numberOfLines} style={[variants[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top', 'bottom', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.accent} />
      {label ? (
        <Txt variant="small" style={{ marginTop: spacing.md }}>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

export function Empty({ icon = 'tv-outline', title, hint }: { icon?: any; title: string; hint?: string }) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={64} color={colors.textFaint} />
      <Txt variant="h3" style={{ marginTop: spacing.md, textAlign: 'center' }}>
        {title}
      </Txt>
      {hint ? (
        <Txt variant="small" style={{ marginTop: spacing.xs, textAlign: 'center', maxWidth: 460 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Image
        source={require('../../assets/images/brand-logo.png')}
        style={{ width: size + 12, height: size + 12 }}
        contentFit="contain"
      />
      <Text style={{ fontSize: size * 0.7, fontWeight: font.weightBold, color: colors.text, letterSpacing: 1 }}>
        BLACKSTAR
      </Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  autoFocus,
  wide,
}: {
  label: string;
  icon?: any;
  onPress: () => void;
  autoFocus?: boolean;
  wide?: boolean;
}) {
  return (
    <Focusable onSelect={onPress} autoFocus={autoFocus} style={{ borderRadius: radius.pill }}>
      {(focused) => {
        const active = focused;
        return (
          <LinearGradient
            colors={active ? gradients.brand : (['#2A2A3A', '#20202E'] as const)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.btn, wide && { paddingHorizontal: spacing.xxl }]}
          >
            {icon ? <Ionicons name={icon} size={20} color={active ? colors.white : colors.text} /> : null}
            <Text style={{ color: active ? colors.white : colors.text, fontWeight: font.weightBold, fontSize: font.body }}>
              {label}
            </Text>
          </LinearGradient>
        );
      }}
    </Focusable>
  );
}

export function GhostButton({ label, icon, onPress }: { label: string; icon?: any; onPress: () => void }) {
  return (
    <Focusable onSelect={onPress} style={styles.ghost} focusStyle={styles.ghostFocus}>
      {(focused) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Ionicons name={icon} size={18} color={focused ? colors.accent : colors.textMuted} /> : null}
          <Text style={{ color: focused ? colors.text : colors.textMuted, fontWeight: font.weightSemi }}>{label}</Text>
        </View>
      )}
    </Focusable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'url' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
}) {
  const [focused, setFocused] = React.useState(false);
  const [show, setShow] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);
  const { dispatch } = useRemote();
  return (
    <Focusable
      onSelect={() => inputRef.current?.focus()}
      onFocus={() => inputRef.current?.focus()}
      style={{ borderRadius: radius.md }}
      focusStyle={{}}
    >
      {(ring, focusSelf) => {
        const active = focused || ring; // selected via D-pad OR native keyboard focus
        return (
        <View style={{ gap: 6 }}>
          <Txt variant="small" color={active ? colors.accent : colors.textMuted}>
            {active ? '▸ ' : ''}
            {label}
          </Txt>
          <View style={[styles.fieldWrap, active && styles.fieldWrapActive]}>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={colors.textFaint}
              // Show the password in clear text when the eye toggle is on.
              secureTextEntry={secureTextEntry && !show}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              autoCorrect={false}
              // Enter on the on-screen keyboard advances to the next field (or the
              // submit button) — keep the keyboard up so it just hops down.
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => dispatch('down')}
              onFocus={() => {
                setFocused(true);
                focusSelf();
              }}
              onBlur={() => setFocused(false)}
              style={[styles.input, secureTextEntry && { paddingRight: 52 }, active && styles.inputActive]}
            />
            {secureTextEntry ? (
              <Focusable onSelect={() => setShow((v) => !v)} style={styles.eye} focusStyle={{ borderColor: colors.borderFocus, borderWidth: 1 }}>
                {(f) => <Ionicons name={show ? 'eye-off' : 'eye'} size={22} color={f ? colors.accent : colors.textMuted} />}
              </Focusable>
            ) : null}
          </View>
        </View>
        );
      }}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  ghost: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
  fieldWrap: { justifyContent: 'center', borderRadius: radius.md },
  fieldWrapActive: {
    // Strong, unmistakable highlight for the selected field on a 10-foot screen.
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 10,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: font.body,
  },
  inputActive: {
    borderColor: colors.borderFocus,
    borderWidth: 2.5,
    backgroundColor: colors.surfaceHi,
  },
  eye: {
    position: 'absolute',
    right: 6,
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
