import { create } from 'zustand';

interface MenuStore {
  isMenuOpen: boolean;
  openMenu: () => Promise<void>;
  closeMenu: () => Promise<void>;
  toggleMenu: () => Promise<void>;
}

export const useMenuStore = create<MenuStore>((set) => ({
  isMenuOpen: false,
  openMenu: async () => {
    set({ isMenuOpen: true });
  },
  closeMenu: async () => {
    set({ isMenuOpen: false });
  },
  toggleMenu: async () => {
    set((state) => ({ isMenuOpen: !state.isMenuOpen }));
  },
}));
