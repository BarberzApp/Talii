import { ANIMATION_TIMING, SPRING_CONFIG } from '../constants/animations';

export const theme = {
  colors: {
    // Backgrounds
    background: '#FFFFFF',
    foreground: '#1C1917',
    card: '#FFFFFF',
    cardForeground: '#1C1917',
    popover: '#FFFFFF',
    popoverForeground: '#1C1917',

    // Primary (Talii brand orange)
    primary: '#EE6D23',
    primaryForeground: '#FFFFFF',
    primaryDark: '#D85A1A',
    primarySubtle: '#FFF4EE',
    primaryTint: '#FFE4D1',

    // Secondary (outlined style — not another orange)
    secondary: '#FFFFFF',
    secondaryForeground: '#EE6D23',

    // Muted
    muted: '#F5F5F4',
    mutedForeground: '#78716C',

    // Accent (repurposed as orange tint, not a duplicate of primary)
    accent: '#FFF4EE',
    accentForeground: '#EE6D23',

    // Utility
    destructive: '#FF4D4F',
    destructiveForeground: '#FFFFFF',
    border: '#E7E5E4',
    input: '#F3F4F6',
    ring: '#EE6D23',
    radius: '0.5rem',

    // Surface colors for cards and elevated elements
    surface: '#FAFAF9',
    surfaceForeground: '#1C1917',

    // @deprecated — retained for legacy references, migrate away from these
    grey: '#272a2f',
    saffronBrown: '#EE6D23',
    coffeeBrown: '#D85A1A',
    beige: '#F5F5F5',
    darkGrey: '#272a2f',
    lightGrey: '#F5F5F5',

    // Social Media Colors
    bookingHighlight: '#ff3b30',
    socialInstagram: '#e1306c',
    socialTwitter: '#1da1f2',
    socialTiktok: '#000000',
    socialFacebook: '#1877f3',

    // Status colors
    success: '#22C55E',
    successForeground: '#FFFFFF',
    successSubtle: '#DCFCE7',
    warning: '#F59E0B',
    warningForeground: '#FFFFFF',
    premium: '#F59E0B',
    premiumSubtle: 'rgba(245, 158, 11, 0.15)',
    info: '#0EA5E9',
    infoForeground: '#FFFFFF',
    infoSubtle: 'rgba(14, 165, 233, 0.1)',
    infoBorder: 'rgba(14, 165, 233, 0.3)',
    destructiveSubtle: '#FFF1F0',

    // Glass / overlay tokens (tuned per mode)
    glass: 'rgba(39, 42, 47, 0.06)',
    glassBorder: 'rgba(39, 42, 47, 0.12)',
    backdrop: 'rgba(39, 42, 47, 0.45)',
    surfaceElevated: '#FFFFFF',

    // Dark theme overrides
    dark: {
      background: '#1C1917',
      foreground: '#FAFAF9',
      card: '#292524',
      cardForeground: '#FAFAF9',
      popover: '#292524',
      popoverForeground: '#FAFAF9',
      surface: '#292524',
      surfaceForeground: '#FAFAF9',
      surfaceElevated: '#3C3835',
      muted: '#44403C',
      mutedForeground: '#A8A29E',
      border: '#44403C',
      input: '#44403C',
      glass: 'rgba(0, 0, 0, 0.25)',
      glassBorder: 'rgba(255, 255, 255, 0.12)',
      backdrop: 'rgba(0, 0, 0, 0.65)',
      primarySubtle: '#3A2418',
      primaryTint: '#52311E',
      accent: '#3A2418',
      accentForeground: '#EE6D23',
      info: '#38BDF8',
      successSubtle: 'rgba(34, 197, 94, 0.2)',
      destructiveSubtle: 'rgba(255, 77, 79, 0.2)',
      infoSubtle: 'rgba(14, 165, 233, 0.15)',
      infoBorder: 'rgba(59, 130, 246, 0.4)',
      premiumSubtle: 'rgba(245, 158, 11, 0.2)',
    },
  },
  
  // Enhanced gradient definitions - Talii brand (matching web)
  gradients: {
    primary: ['#EE6D23', '#D85A1A'],
    background: ['#FFFFFF', '#FAFAF9'],
    backgroundDark: ['#1C1917', '#292524'],
    glass: ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)'],
    logo: ['#EE6D23', '#D85A1A'],
    text: ['#EE6D23', '#D85A1A'],
    button: ['#EE6D23', '#D85A1A'],
    glow: ['rgba(238, 109, 35, 0.35)', 'rgba(238, 109, 35, 0.08)'],
  },

  // Animation configuration
  animations: {
    timing: ANIMATION_TIMING,
    spring: SPRING_CONFIG,
  },

  spacing: {
    // Tailwind default spacing scale
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
    28: 112,
    32: 128,
    36: 144,
    40: 160,
    44: 176,
    48: 192,
    52: 208,
    56: 224,
    60: 240,
    64: 256,
    72: 288,
    80: 320,
    96: 384,
  },
  borderRadius: {
    // Matches web app Tailwind config
    none: 0,
    sm: 2, // calc(var(--radius) - 4px)
    md: 6, // calc(var(--radius) - 2px)
    lg: 8, // var(--radius) = 0.5rem = 8px
    xl: 12,
    '2xl': 16,
    '3xl': 24,
    full: 9999,
  },
  typography: {
    fontSizes: {
      // Tailwind default font sizes
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
      '6xl': 60,
      '7xl': 72,
      '8xl': 96,
      '9xl': 128,
    },
    fontWeights: {
      thin: '100',
      extralight: '200',
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    fontFamily: {
      sans: ['SF Pro Display', 'Inter', 'sans-serif'],
      bebas: ['BebasNeue-Regular', 'Bebas Neue', 'cursive', 'sans-serif'],
    },
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
} as const;

export type Theme = typeof theme;

export type ColorScheme = 'light' | 'dark';

export type ResolvedColors = typeof theme.colors & {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  surface: string;
  surfaceForeground: string;
  surfaceElevated: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  glass: string;
  glassBorder: string;
  backdrop: string;
  primary: string;
  primaryForeground: string;
  primaryDark: string;
  primarySubtle: string;
  primaryTint: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  destructiveSubtle: string;
  success: string;
  successForeground: string;
  successSubtle: string;
  warning: string;
  warningForeground: string;
  premium: string;
  premiumSubtle: string;
  info: string;
  infoForeground: string;
  infoSubtle: string;
  infoBorder: string;
};

export function getResolvedColors(mode: ColorScheme): ResolvedColors {
  const colors = theme?.colors;
  if (!colors || typeof colors !== 'object') {
    throw new Error('Theme colors not initialized');
  }
  const { dark: darkOverrides, ...lightColors } = colors as typeof colors & { dark: Record<string, string> };
  const light = lightColors as Record<string, string>;
  if (mode === 'dark' && darkOverrides && typeof darkOverrides === 'object') {
    return { ...light, ...darkOverrides } as unknown as ResolvedColors;
  }
  return light as unknown as ResolvedColors;
} 