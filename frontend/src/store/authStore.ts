import { create } from 'zustand';
import {
  login as authLogin,
  signup as authSignup,
  logout as authLogout,
  restoreSessionUser,
} from '../api/services/auth';
import type { AuthUser, AuthResult, SignupPayload } from '../api/services/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthStore {
  user:     AuthUser | null;
  role:     'admin' | 'employee' | null;
  approved: boolean;
  loading:  boolean;               // renamed from isLoading
  error:    string | null;

  signup:       (payload: SignupPayload) => Promise<AuthResult>;
  login:        (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout:       () => Promise<void>;
  checkSession: () => Promise<void>;
  setUser:      (user: AuthUser | null) => void;
  clearError:   () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyUser(user: AuthUser) {
  return { user, role: user.role, approved: user.approved, loading: false, error: null };
}

function clearUser(error: string | null = null) {
  return {
    user:     null as AuthUser | null,
    role:     null as 'admin' | 'employee' | null,
    approved: false,
    loading:  false,
    error,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>((set) => ({
  user:     null,
  role:     null,
  approved: false,
  loading:  false,
  error:    null,

  signup: async (payload: SignupPayload): Promise<AuthResult> => {
    set({ loading: true, error: null });
    const result = await authSignup(payload);
    set(result.error ? { ...clearUser(result.error) } : { loading: false, error: null });
    return result;
  },

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    const result = await authLogin({ username, password });
    if (result.error || !result.user) {
      set({ ...clearUser(result.error ?? 'Login failed') });
      return { success: false, error: result.error ?? 'Login failed' };
    }
    set(applyUser(result.user));
    return { success: true };
  },

  logout: async () => {
    set({ loading: true });
    await authLogout();
    set({ ...clearUser() });
  },

  // checkSession is called once on app start.
  // It MUST always resolve — never leave loading: true stuck.
  checkSession: async () => {
    set({ loading: true });
    try {
      const user = await restoreSessionUser();
      if (!user) {
        set({ ...clearUser() });
        return;
      }

      set(applyUser(user));
    } catch (err) {
      console.error('[authStore] checkSession error:', err instanceof Error ? err.message : err);
      set({ ...clearUser() });
    } finally {
      set({ loading: false });
    }
  },

  setUser:    (user) => set(user ? applyUser(user) : clearUser()),
  clearError: ()     => set({ error: null }),
}));
