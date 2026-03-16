import { create } from 'zustand';
import { colors, ThemeColors } from '../theme/colors';

type ThemeMode = 'light' | 'dark';

interface ThemeStore {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: 'dark',
  colors: colors.dark,
  toggleTheme: async () => {
    set((state) => ({
      mode: state.mode === 'dark' ? 'light' : 'dark',
      colors: state.mode === 'dark' ? colors.light : colors.dark,
    }));
  },
  setTheme: async (mode: ThemeMode) => {
    set({
      mode,
      colors: colors[mode],
    });
  },
}));
