import { create } from 'zustand';
import { supabase } from '../api/supabase';
import {
  login  as authLogin,
  signup as authSignup,
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
    await supabase.auth.signOut();
    set({ ...clearUser() });
  },

  // checkSession is called once on app start.
  // It MUST always resolve — never leave loading: true stuck.
  checkSession: async () => {
    set({ loading: true });
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[authStore] getSession error:', sessionError.message);
        set({ ...clearUser() });
        return;
      }

      if (!session?.user) {
        set({ ...clearUser() });
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name, username, phone, role, approved')
        .eq('id', session.user.id)
        .single();

      if (userError || !userData) {
        console.error('[authStore] user fetch error:', userError?.message);
        set({ ...clearUser() });
        return;
      }

      set(applyUser(userData as AuthUser));
    } catch (err) {
      console.error('[authStore] checkSession error:', err instanceof Error ? err.message : err);
      set({ ...clearUser() });
    }
  },

  setUser:    (user) => set(user ? applyUser(user) : clearUser()),
  clearError: ()     => set({ error: null }),
}));
