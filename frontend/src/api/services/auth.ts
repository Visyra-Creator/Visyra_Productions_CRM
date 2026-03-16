import { supabase } from '../supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignupPayload {
  name: string;
  username: string;
  phone: string;
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username: string;
  phone: string;
  role: 'employee' | 'admin';
  approved: boolean;
}

export interface AuthResult {
  user: AuthUser | null;
  error: string | null;
}

// FIX: LoginPayload now uses `username`, not `email`.
// The login function resolves username → email before calling Supabase Auth.
export interface LoginPayload {
  username: string;
  password: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fetch the full user row from public.users by auth id. */
async function fetchUserRow(id: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, username, phone, role, approved')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('[auth] fetchUserRow error:', error?.message);
    return null;
  }
  return data as AuthUser;
}

/** Map raw Supabase / DB error codes to friendly messages. */
function mapError(message: string, code?: string): string {
  if (code === '23505') {
    if (message.includes('username')) return 'That username is already taken.';
    if (message.includes('email'))    return 'An account with that email already exists.';
    return 'An account with those details already exists.';
  }
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Invalid username or password.';
  }
  if (message.toLowerCase().includes('email not confirmed')) {
    return 'Please verify your email before logging in.';
  }
  return message;
}

// ─── signup ───────────────────────────────────────────────────────────────────
//
// Flow:
//   1. supabase.auth.signUp()  — creates the auth.users row
//   2. The DB trigger handle_new_user() inserts into public.users automatically
//   3. We do NOT manually insert — that caused a race condition / duplicate key
//   4. Sign out immediately — user must wait for admin approval before login
//
export async function signup(payload: SignupPayload): Promise<AuthResult> {
  // ── Step 1: create auth user, pass profile fields as metadata ──────────────
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email:    payload.email,
    password: payload.password,
    options: {
      data: {                     // consumed by handle_new_user() trigger
        name:     payload.name,
        username: payload.username,
        phone:    payload.phone,
      },
    },
  });

  if (authError) {
    return { user: null, error: mapError(authError.message) };
  }

  if (!authData.user?.id) {
    return { user: null, error: 'Signup failed — no user returned from auth.' };
  }

  // ── Step 2: trigger fires automatically — wait briefly then fetch the row ──
  // Small delay gives the trigger time to commit before we SELECT.
  await new Promise(r => setTimeout(r, 500));

  const userRow = await fetchUserRow(authData.user.id);

  // ── Step 3: sign out — user cannot access the app until admin approves ─────
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    // Non-fatal but log it; the session may linger until token expiry
    console.warn('[auth] signOut after signup failed:', signOutError.message);
  }

  return {
    user:  userRow,   // may be null if trigger hasn't committed yet (edge case)
    error: null,
  };
}

// ─── login ────────────────────────────────────────────────────────────────────
//
// Flow:
//   1. Resolve username → email via get_email_by_username() RPC
//      (RLS blocks direct table reads for unauthenticated users,
//       so we use a SECURITY DEFINER function)
//   2. supabase.auth.signInWithPassword({ email, password })
//   3. Fetch role + approved from public.users
//   4. Block login if approved = false, sign out immediately
//
export async function login(payload: LoginPayload): Promise<AuthResult> {
  // ── Step 1: resolve username → email ───────────────────────────────────────
  const { data: email, error: rpcError } = await supabase
    .rpc('get_email_by_username', { p_username: payload.username.trim() });

  if (rpcError) {
    console.error('[auth] username lookup error:', rpcError.message);
    return { user: null, error: 'Invalid username or password.' };
  }

  if (!email) {
    // Username not found — return generic message to avoid username enumeration
    return { user: null, error: 'Invalid username or password.' };
  }

  // ── Step 2: authenticate with Supabase Auth ─────────────────────────────────
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email:    email as string,
    password: payload.password,
  });

  if (authError) {
    return { user: null, error: mapError(authError.message) };
  }

  if (!authData.user?.id) {
    return { user: null, error: 'Login failed — no user returned from auth.' };
  }

  // ── Step 3: fetch role + approved from public.users ─────────────────────────
  const userRow = await fetchUserRow(authData.user.id);

  if (!userRow) {
    await supabase.auth.signOut();
    return { user: null, error: 'Could not load your account. Please try again.' };
  }

  // ── Step 4: block if not yet approved ───────────────────────────────────────
  if (!userRow.approved) {
    await supabase.auth.signOut();
    return {
      user:  null,
      error: 'Your account is pending admin approval. Please check back later.',
    };
  }

  return { user: userRow, error: null };
}

// ─── getCurrentUser ───────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return fetchUserRow(session.user.id);
}

// ─── logout ───────────────────────────────────────────────────────────────────

export async function logout(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error ? error.message : null };
}

// ─── updateProfile ────────────────────────────────────────────────────────────

export async function updateProfile(
  userId: string,
  payload: Partial<{ name: string; username: string; phone: string }>,
): Promise<AuthResult> {
  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)
    .select('id, email, name, username, phone, role, approved')
    .single();

  if (error) {
    return { user: null, error: mapError(error.message, error.code) };
  }
  return { user: data as AuthUser, error: null };
}

// ─── isAuthenticated ──────────────────────────────────────────────────────────

export async function isAuthenticated(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session?.user;
}

// ─── onAuthStateChange ────────────────────────────────────────────────────────

export function onAuthStateChange(
  callback: (user: AuthUser | null) => void,
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session?.user && event === 'SIGNED_IN') {
        const user = await getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    },
  );
  return () => subscription.unsubscribe();
}
