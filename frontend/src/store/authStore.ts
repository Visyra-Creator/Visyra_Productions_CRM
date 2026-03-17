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

function isMissingSessionError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message?.toLowerCase?.() ?? '';
  return message.includes('auth session missing');
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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        if (isMissingSessionError(sessionError)) {
          set({ ...clearUser() });
          return;
        }
        console.error('[authStore] getSession error:', sessionError.message);
        set({ ...clearUser() });
        return;
      }

      if (!sessionData.session?.user?.id) {
        set({ ...clearUser() });
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) {
        if (isMissingSessionError(authError)) {
          set({ ...clearUser() });
          return;
        }
        console.error('[authStore] getUser error:', authError.message);
        set({ ...clearUser() });
        return;
      }

      console.log('Auth User ID:', authData.user.id);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name, username, phone, role, approved')
        .eq('id', authData.user.id)
        .single();

      if (userError) {
        console.error('[authStore] user fetch error:', userError?.message);
        set({ ...clearUser() });
        return;
      }

      console.log('Fetched User Row:', userData);
      console.log('Approved:', userData?.approved);

      if (!userData) {
        console.log('User row not found');
        set({ ...clearUser() });
        return;
      }

      if (!userData.approved) {
        console.log('User not approved');
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
