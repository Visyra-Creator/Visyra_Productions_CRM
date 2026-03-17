import { supabase } from '../supabase';

export interface AuthUser {
  id: string;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error('Authentication required. Please log in again.');
  }

  const sessionUserId = sessionData?.session?.user?.id;
  if (sessionUserId) {
    return { id: sessionUserId };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    throw new Error('Authentication required. Please log in again.');
  }
  return { id: data.user.id };
}

export function withUserScope<T extends Record<string, any>>(payload: T, userId: string): T & { user_id: string } {
  return {
    ...payload,
    user_id: userId,
  };
}

export async function fetchItems<T = any>(table: string): Promise<T[]> {
  await getCurrentUser();
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function createItem<T = any>(table: string, payload: Record<string, any>): Promise<T> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from(table).insert(withUserScope(payload ?? {}, user.id)).select('*').single();
  if (error) throw error;
  return data as T;
}

export async function updateItem<T = any>(table: string, id: string, payload: Record<string, any>): Promise<T> {
  await getCurrentUser();
  const { data, error } = await supabase
    .from(table)
    .update(payload ?? {})
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as T;
}

export async function deleteItem(table: string, id: string): Promise<void> {
  await getCurrentUser();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

