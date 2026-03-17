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
  console.log('Auth User ID:', id);

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, username, phone, role, approved')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[auth] fetchUserRow error:', error?.message);
    return null;
  }

  if (!data) {
    console.log('User row not found');
    return null;
  }

  const normalizedUser: AuthUser = {
    ...(data as AuthUser),
    approved: normalizeApproved((data as { approved?: unknown }).approved),
  };

  console.log('Fetched User Row:', normalizedUser);
  console.log('Approved:', normalizedUser.approved);

  return normalizedUser;
}

/** Map raw Supabase / DB error codes to friendly messages. */
function mapError(message: string, code?: string): string {
  const normalized = message.toLowerCase();

  if (code === '23505') {
    if (message.includes('username')) return 'That username is already taken.';
    if (message.includes('email'))    return 'An account with that email already exists.';
    return 'An account with those details already exists.';
  }
  if (normalized.includes('email rate limit exceeded') || normalized.includes('rate limit exceeded')) {
    return 'Too many signup attempts right now. Please wait a few minutes and try again.';
  }
  if (normalized.includes('database error saving new user')) {
    return 'Could not create account. This username may already be taken. Please try a different username.';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'Invalid username or password.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Your account is not activated yet. Please contact admin if you are already approved.';
  }
  return message;
}

function isMissingSessionError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message?.toLowerCase?.() ?? '';
  return message.includes('auth session missing');
}

function normalizeApproved(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  if (typeof value === 'number') return value === 1;
  return false;
}

export async function getCurrentAvatarUrl(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (!isMissingSessionError(error)) {
      console.error('[auth] getCurrentAvatarUrl error:', error.message);
    }
    return null;
  }
  return ((data?.user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url ?? null) as string | null;
}

export async function updateAvatarMetadata(avatarUrl: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl },
  });
  if (error) {
    console.error('[auth] updateAvatarMetadata error:', error.message);
  }
  return { error: error?.message ?? null };
}

export async function changePasswordWithVerification(params: {
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ error: string | null }> {
  const { email, currentPassword, newPassword } = params;

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (verifyError) {
    return { error: 'Current password is incorrect.' };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: updateError.message || 'Failed to update password.' };
  }

  return { error: null };
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
  const normalizedName = payload.name.trim();
  const normalizedUsername = payload.username.trim();
  const normalizedPhone = payload.phone.trim();
  const normalizedEmail = payload.email.trim();

  // Pre-check username to avoid generic trigger error from auth signUp
  const { data: existingEmailForUsername, error: usernameLookupError } = await supabase
    .rpc('get_email_by_username', { p_username: normalizedUsername });

  if (!usernameLookupError && existingEmailForUsername) {
    return { user: null, error: 'That username is already taken.' };
  }

  // ── Step 1: create auth user, pass profile fields as metadata ──────────────
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email:    normalizedEmail,
    password: payload.password,
    options: {
      data: {                     // consumed by handle_new_user() trigger
        name:     normalizedName,
        username: normalizedUsername,
        phone:    normalizedPhone,
      },
    },
  });

  if (authError) {
    return { user: null, error: mapError(authError.message, authError.code) };
  }

  if (!authData.user?.id) {
    return { user: null, error: 'Signup failed — no user returned from auth.' };
  }

  // ── Step 2: trigger fires automatically — retry fetch briefly for consistency ──
  let userRow: AuthUser | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 300));
    }
    userRow = await fetchUserRow(authData.user.id);
    if (userRow) break;
  }

  // If trigger/replication is slightly delayed, return a safe user object so UI can continue.
  const safeUser: AuthUser = userRow ?? {
    id: authData.user.id,
    email: normalizedEmail,
    name: normalizedName,
    username: normalizedUsername,
    phone: normalizedPhone,
    role: 'employee',
    approved: false,
  };

  // ── Step 3: sign out — user cannot access the app until admin approves ─────
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    // Non-fatal but log it; the session may linger until token expiry
    console.warn('[auth] signOut after signup failed:', signOutError.message);
  }

  return {
    user:  safeUser,
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
    return { user: null, error: mapError(authError.message, authError.code) };
  }

  if (!authData.user?.id) {
    return { user: null, error: 'Login failed — no user returned from auth.' };
  }

  // ── Step 3: fetch role + approved from public.users ─────────────────────────
  // Retry briefly to avoid false negatives if approval was just toggled.
  let userRow: AuthUser | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    userRow = await fetchUserRow(authData.user.id);
    if (userRow) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!userRow) {
    await supabase.auth.signOut();
    return { user: null, error: 'Could not load your account. Please try again.' };
  }

  // ── Step 4: block if not yet approved ───────────────────────────────────────
  const isApproved = normalizeApproved(userRow.approved);
  console.log('[login] Auth UID:', authData.user.id);
  console.log('[login] Raw approved value from DB:', userRow.approved, '| type:', typeof userRow.approved);
  console.log('[login] Normalized approved:', isApproved);
  console.log('[login] Decision:', isApproved ? '✅ ALLOW login' : '🚫 BLOCK — not approved');

  if (!isApproved) {
    await supabase.auth.signOut();
    return {
      user: null,
      error: 'Your account is pending admin approval. Please check back later.',
    };
  }

  return { user: userRow, error: null };
}

// ─── getCurrentUser ───────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    if (!isMissingSessionError(sessionError)) {
      console.error('[auth] getCurrentUser getSession error:', sessionError.message);
    }
    return null;
  }

  if (!sessionData.session?.user?.id) {
    return null;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    if (!isMissingSessionError(authError)) {
      console.error('[auth] getCurrentUser getUser error:', authError.message);
    }
    return null;
  }

  if (!authData.user?.id) {
    return null;
  }

  return fetchUserRow(authData.user.id);
}

export async function restoreSessionUser(): Promise<AuthUser | null> {
  return getCurrentUser();
}

// ─── logout ───────────────────────────────────────────────────────────────────

export async function logout(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error ? error.message : null };
}

export async function signOutSafe(): Promise<{ error: string | null }> {
  return logout();
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
