export interface ThemePreset {
  id: string;
  label: string;
  colors: {
    charcoal: string;
    surface: string;
    surfaceLight: string;
    gold: string;
    goldHover: string;
  };
}

export const THEMES: ThemePreset[] = [
  {
    id: 'classic',
    label: 'Classico (nero + oro)',
    colors: {
      charcoal: '#121212',
      surface: '#1E1E1E',
      surfaceLight: '#2A2A2A',
      gold: '#CFA055',
      goldHover: '#b88b44',
    },
  },
  {
    id: 'ury',
    label: 'URY (nero + arancione)',
    colors: {
      charcoal: '#17181C',
      surface: '#1F2127',
      surfaceLight: '#2B2E36',
      gold: '#FF8B2B',
      goldHover: '#e0771f',
    },
  },
];

const STORAGE_KEY = 'app_theme';

export function getThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? 'classic';
  } catch {
    return 'classic';
  }
}

export function applyTheme(id: string): void {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--c-charcoal', theme.colors.charcoal);
  root.style.setProperty('--c-surface', theme.colors.surface);
  root.style.setProperty('--c-surface-light', theme.colors.surfaceLight);
  root.style.setProperty('--c-gold', theme.colors.gold);
  root.style.setProperty('--c-gold-hover', theme.colors.goldHover);
  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    /* ignore */
  }
}

export function initTheme(): void {
  applyTheme(getThemeId());
}
