import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

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

/**
 * Fetch all pending (unapproved) users
 */
export async function getPendingUsers(): Promise<User[]> {
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
  await safeQuery(
    supabase
      .from('users')
      .delete()
      .eq('id', userId),
    null
  );
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, role: 'admin' | 'employee'): Promise<User | null> {
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
  return (await safeQuery(
    supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single(),
    null
  )) as User | null;
}

