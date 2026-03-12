import { create } from 'zustand';
import { colors, ThemeColors } from '../theme/colors';

type ThemeMode = 'light' | 'dark';

interface ThemeStore {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: 'dark',
  colors: colors.dark,
  toggleTheme: () =>
    set((state) => ({
      mode: state.mode === 'dark' ? 'light' : 'dark',
      colors: state.mode === 'dark' ? colors.light : colors.dark,
    })),
  setTheme: (mode: ThemeMode) =>
    set({
      mode,
      colors: colors[mode],
    }),
}));
