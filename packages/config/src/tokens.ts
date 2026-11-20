/**
 * Jonoshheba AI — "NOSTOS" Cinematic Design Tokens
 * - NIGHT ("Steel & Gold") — default after dark local time
 * - DAY ("Bleached Light") — overexposed sea-mist & sand
 * - Typography: Anek Bangla (variable), Montserrat (wide-tracked caps), Cormorant Garamond (italic editorial)
 * - WCAG 2.2 AA contrast ratios (>= 4.5:1 for all text/background pairs in both themes)
 * - Safety Rule: 999 button is always solid #B3261E with #FFFFFF text
 */

export const nostosThemes = {
  night: {
    name: 'Steel & Gold',
    page: '#050709',
    surface: '#0A0F16',
    surface2: '#0E1824',
    text: '#ECE6DA',
    textMuted: '#9AA3AC',
    heroText: '#F1ECE2',
    heroMuted: '#A9B6C2',
    accent: '#9CC3E6',
    gold: '#D9B46C',
    goldFill: '#C9A45C',
    goldLine: 'rgba(217,180,108,0.55)',
    hair: 'rgba(236,230,218,0.14)',
    hairSoft: 'rgba(236,230,218,0.07)',
    field: 'rgba(5,8,12,0.55)',
    panel: 'rgba(6,9,13,0.92)',
    emergencyRed: '#B3261E',
    emergencyText: '#FFFFFF',
    sky: 'linear-gradient(180deg,#020304 0%,#06090E 30%,#0C1520 58%,#13212F 61%,#0A121B 62%,#05080C 100%)',
    sea: 'linear-gradient(180deg,#0B1621 0%,#070E15 40%,#040609 100%)',
    celestial: 'radial-gradient(circle at 42% 40%,#F4F1EA,#D7DCE0 45%,#9FB0BE 80%)',
    band: 'linear-gradient(120deg,#070B10 0%,#0E1824 55%,#16243A 100%)',
  },
  day: {
    name: 'Bleached Light',
    page: '#ECE8E0',
    surface: '#F6F2EA',
    surface2: '#E4DFD5',
    text: '#14191F',
    textMuted: '#4E5862',
    heroText: '#101820',
    heroMuted: '#3B4A57',
    accent: '#2E4A63',
    gold: '#86642A',
    goldFill: '#735420',
    goldLine: 'rgba(134,100,42,0.55)',
    hair: 'rgba(20,25,31,0.16)',
    hairSoft: 'rgba(20,25,31,0.08)',
    field: 'rgba(246,242,234,0.60)',
    panel: 'rgba(246,242,234,0.95)',
    emergencyRed: '#B3261E',
    emergencyText: '#FFFFFF',
    sky: 'linear-gradient(180deg,#C9D6DF 0%,#DCE3E6 35%,#EEEAE1 58%,#F6F1E6 61%,#B9C7CE 62%,#A9B9C2 100%)',
    sea: 'linear-gradient(180deg,#B7C6CD,#8EA2AD)',
    celestial: 'radial-gradient(circle,#FFFDF6,#FBF3DD 40%,transparent 70%)',
    band: 'linear-gradient(120deg,#E6E1D6 0%,#DCE3E6 55%,#C9D6DF 100%)',
  },
} as const;

export type NostosThemeMode = keyof typeof nostosThemes;

export const colors = {
  brand: {
    primary: '#9CC3E6',
    primaryHover: '#D9B46C',
    primarySoft: 'rgba(156,195,230,0.12)',
    secondary: '#2E4A63',
    secondarySoft: 'rgba(46,74,99,0.12)',
    accent: '#D9B46C',
    accentSoft: 'rgba(217,180,108,0.14)',
  },
  surface: {
    background: '#050709',
    subtle: '#0A0F16',
    elevated: '#0E1824',
    border: 'rgba(236,230,218,0.14)',
    borderStrong: 'rgba(217,180,108,0.55)',
    darkBackground: '#050709',
    darkSubtle: '#0A0F16',
    darkBorder: 'rgba(236,230,218,0.14)',
  },
  text: {
    primary: '#ECE6DA',
    secondary: '#A9B6C2',
    muted: '#9AA3AC',
    onBrand: '#050709',
    darkPrimary: '#ECE6DA',
    darkSecondary: '#9AA3AC',
  },
  semantic: {
    success: '#9CC3E6',
    successSoft: 'rgba(156,195,230,0.12)',
    warning: '#D9B46C',
    warningSoft: 'rgba(217,180,108,0.12)',
    danger: '#B3261E',
    dangerSoft: 'rgba(179,38,30,0.16)',
    info: '#9CC3E6',
    infoSoft: 'rgba(156,195,230,0.12)',
    neutral: '#9AA3AC',
    neutralSoft: 'rgba(236,230,218,0.07)',
  },
  highContrast: {
    background: '#050709',
    surface: '#0A0F16',
    text: '#ECE6DA',
    accent: '#D9B46C',
    border: '#ECE6DA',
  },
} as const;

export const typography = {
  fontFamily: {
    bangla: 'var(--font-anek-bangla, "Anek Bangla"), "Noto Sans Bengali", system-ui, sans-serif',
    latin: 'var(--font-montserrat, "Montserrat"), system-ui, sans-serif',
    editorial: 'var(--font-cormorant, "Cormorant Garamond"), Georgia, serif',
    sans: 'var(--font-anek-bangla, "Anek Bangla"), var(--font-montserrat, "Montserrat"), system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  fontSize: {
    meta: '0.6875rem', // 11px tracked uppercase
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1.0625rem', // 17px editorial body
    lg: '1.1875rem',
    xl: '1.375rem',
    '2xl': '1.75rem',
    '3xl': '2.75rem', // 44px section h2
    '4xl': '3.25rem', // 52px section h2
    hero: 'clamp(3rem, 6.4vw, 6rem)', // 48px -> 96px
  },
  lineHeight: {
    display: 1.06,
    tight: 1.25,
    normal: 1.65,
    relaxed: 1.8,
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  tracking: {
    overline: '0.38em',
    widest: '0.52em',
  },
} as const;

export const motionTokens = {
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  durationsMs: {
    micro: 300,
    buttonFill: 700,
    rowRule: 900,
    chatDevelop: 1100,
    plateZoom: 1400,
    themeRegrade: 1400,
  },
} as const;

export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

export const radii = {
  none: '0px',
  sm: '2px',
  md: '2px',
  lg: '4px',
  xl: '4px',
  full: '9999px', // Reserved for the 999 emergency pill
} as const;

export const breakpoints = {
  xs: '360px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

export const designTokens = {
  nostosThemes,
  colors,
  typography,
  motionTokens,
  spacing,
  radii,
  breakpoints,
} as const;

export type DesignTokens = typeof designTokens;
