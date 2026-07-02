/**
 * Blackstar Digital Studio — design tokens.
 * Base: deep black. Accent "star": violet → magenta.
 * Sizes are scaled up so the UI stays readable from across a room on a TV.
 * Made in Italy.
 */

export const colors = {
  // Backgrounds (near-black, slightly violet-tinted)
  bg: '#0A0A0F',
  bgElevated: '#12121A',
  surface: '#171722',
  surfaceHi: '#20202E',
  border: '#2A2A3A',
  borderFocus: '#D946EF',

  // Brand "star" — violet to magenta
  primary: '#A855F7', // violet
  primaryDim: '#7C3AED',
  accent: '#D946EF', // magenta
  accentHot: '#E879F9',
  glow: 'rgba(217, 70, 239, 0.45)',

  // Text
  text: '#F5F3FF',
  textMuted: '#A7A3C2',
  textFaint: '#6E6A8A',
  onAccent: '#0A0A0F',

  // Status
  live: '#22D3EE',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FB7185',

  black: '#000000',
  white: '#FFFFFF',
} as const;

export const gradients = {
  brand: ['#7C3AED', '#A855F7', '#D946EF'] as const,
  brandSoft: ['#7C3AED', '#D946EF'] as const,
  fade: ['transparent', 'rgba(10,10,15,0.6)', '#0A0A0F'] as const,
};

// Single 10-foot layout: this app targets Android boxes / Android TV only.
// No phone/compact mode — one consistent sizing everywhere (fixed rule).
const r = (n: number) => n;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
};

export const spacing = {
  xs: r(6),
  sm: r(10),
  md: r(16),
  lg: r(22),
  xl: r(34),
  xxl: r(52),
};

// Type scale — large for TV, scaled down on phones.
export const font = {
  display: r(40),
  h1: r(30),
  h2: r(24),
  h3: r(20),
  body: r(17),
  small: r(15),
  tiny: r(13),
  weightBold: '800' as const,
  weightSemi: '600' as const,
  weightReg: '400' as const,
};

export const focusRing = {
  borderWidth: 2,
  scale: 1.06,
};
