import { supabase } from './supabase';

type ClientRow = Record<string, unknown>;

// Debug helper to verify Supabase queries work correctly.
export async function fetchClientsFromSupabaseTemp(): Promise<ClientRow[]> {
  const { data, error } = await supabase.from('clients').select('*').limit(20);

  if (error) {
    console.error('[TEMP] Supabase clients query failed:', error);
    return [];
  }

  console.log('[TEMP] Supabase clients:', data ?? []);
  return (data ?? []) as ClientRow[];
}

