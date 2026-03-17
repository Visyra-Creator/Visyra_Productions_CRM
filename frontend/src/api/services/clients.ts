import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';
import { assertNoDependenciesForUser, toDeleteError } from './deleteGuards';
import { getCurrentUser, withUserScope } from './rls';

const TABLE = 'clients';

export type ClientRecord = any;
export type ClientCreateInput = any;
export type ClientUpdateInput = Partial<ClientCreateInput>;
export type ClientChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export async function getAll(): Promise<ClientRecord[]> {
  await getCurrentUser();
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as ClientRecord[];
}

export async function create(payload: ClientCreateInput): Promise<ClientRecord> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from(TABLE).insert(withUserScope(payload ?? {}, user.id)).select('*').single();
  if (error) {
    console.error(`[${TABLE}] create failed:`, error);
    throw error;
  }
  return data as ClientRecord;
}

export async function update(id: string, payload: ClientUpdateInput): Promise<ClientRecord> {
  await getCurrentUser();
  const { data, error } = await supabase
    .from(TABLE)
    .update(payload ?? {})
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error(`[${TABLE}] update failed:`, error);
    throw error;
  }
  return data as ClientRecord;
}

async function deleteById(id: string): Promise<void> {
  await getCurrentUser();
  await assertNoDependenciesForUser('client', id, [
    { table: 'shoots', column: 'client_id', label: 'shoots' },
    { table: 'payments', column: 'client_id', label: 'invoices' },
  ]);

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error(`[${TABLE}] delete failed:`, error);
    throw toDeleteError('client', error);
  }
}

export function subscribeToClientChanges(onChange: (eventType: ClientChangeEvent) => void): () => void {
  const channel = supabase
    .channel(`${TABLE}-sync-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const eventType = String(payload.eventType ?? '') as ClientChangeEvent;
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

export { deleteById as delete };
