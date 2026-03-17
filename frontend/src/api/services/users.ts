import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';
import { toDeleteError } from './deleteGuards';
import { getCurrentUser } from './rls';

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  phone: string;
  role: 'admin' | 'employee';
  approved: boolean;
  created_at: string;
  updated_at?: string;
}

export type UserChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Fetch all pending (unapproved) users
 */
export async function getPendingUsers(): Promise<User[]> {
  await getCurrentUser();
  return (await safeQuery(
    supabase
      .from('users')
      .select('*')
      .eq('approved', false)
      .order('created_at', { ascending: false }),
    []
  )) as User[];
}

/**
 * Fetch all approved users
 */
export async function getApprovedUsers(): Promise<User[]> {
  await getCurrentUser();
  return (await safeQuery(
    supabase
      .from('users')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false }),
    []
  )) as User[];
}

/**
 * Fetch all users
 */
export async function getAllUsers(): Promise<User[]> {
  await getCurrentUser();
  return (await safeQuery(
    supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false }),
    []
  )) as User[];
}

/**
 * Approve a user by ID
 */
export async function approveUser(userId: string): Promise<User | null> {
  await getCurrentUser();
  return (await safeQuery(
    supabase
      .from('users')
      .update({ approved: true })
      .eq('id', userId)
      .select('*')
      .single(),
    null
  )) as User | null;
}

/**
 * Reject/Delete a user by ID
 */
export async function rejectUser(userId: string): Promise<void> {
  await getCurrentUser();
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) {
    console.error('[users] rejectUser delete failed:', error);
    throw toDeleteError('user', error);
  }
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, role: 'admin' | 'employee'): Promise<User | null> {
  await getCurrentUser();
  return (await safeQuery(
    supabase
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select('*')
      .single(),
    null
  )) as User | null;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  await getCurrentUser();
  return (await safeQuery(
    supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single(),
    null
  )) as User | null;
}

export function subscribeToUserChanges(onChange: (eventType: UserChangeEvent) => void): () => void {
  const channel = supabase
    .channel(`users-sync-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      (payload) => {
        const eventType = String(payload.eventType ?? '') as UserChangeEvent;
        if (eventType === 'INSERT' || eventType === 'UPDATE' || eventType === 'DELETE') {
          onChange(eventType);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

