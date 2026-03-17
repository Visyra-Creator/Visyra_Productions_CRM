import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';
import { assertNoDependenciesForUser, toDeleteError } from './deleteGuards';
import { getCurrentUser, withUserScope } from './rls';

const TABLE = 'shoots';

export type ShootRecord = any;
export type ShootCreateInput = any;
export type ShootUpdateInput = Partial<ShootCreateInput>;
export type ShootChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export async function getAll(): Promise<ShootRecord[]> {
  await getCurrentUser();
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as ShootRecord[];
}

export async function create(payload: ShootCreateInput): Promise<ShootRecord> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from(TABLE).insert(withUserScope(payload ?? {}, user.id)).select('*').single();
  if (error) {
    console.error(`[${TABLE}] create failed:`, error);
    throw error;
  }
  return data as ShootRecord;
}

export async function update(id: string, payload: ShootUpdateInput): Promise<ShootRecord> {
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
  return data as ShootRecord;
}

async function deleteById(id: string): Promise<void> {
  await getCurrentUser();
  await assertNoDependenciesForUser('shoot/event', id, [
    { table: 'payments', column: 'shoot_id', label: 'invoices' },
    { table: 'expenses', column: 'shoot_id', label: 'expenses' },
  ]);

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error(`[${TABLE}] delete failed:`, error);
    throw toDeleteError('shoot/event', error);
  }
}

export function subscribeToShootChanges(onChange: (eventType: ShootChangeEvent) => void): () => void {
  const channel = supabase
    .channel(`${TABLE}-sync-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const eventType = String(payload.eventType ?? '') as ShootChangeEvent;
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
