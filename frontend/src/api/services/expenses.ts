import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';
import { toDeleteError } from './deleteGuards';
import { getCurrentUser, withUserScope } from './rls';

const TABLE = 'expenses';

export type ExpenseRecord = any;
export type ExpenseCreateInput = any;
export type ExpenseUpdateInput = Partial<ExpenseCreateInput>;
export type ExpenseChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export async function getAll(): Promise<ExpenseRecord[]> {
  await getCurrentUser();
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as ExpenseRecord[];
}

export async function create(payload: ExpenseCreateInput): Promise<ExpenseRecord> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from(TABLE).insert(withUserScope(payload ?? {}, user.id)).select('*').single();
  if (error) {
    console.error(`[${TABLE}] create failed:`, error);
    throw error;
  }
  return data as ExpenseRecord;
}

export async function update(id: string, payload: ExpenseUpdateInput): Promise<ExpenseRecord> {
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
  return data as ExpenseRecord;
}

async function deleteById(id: string): Promise<void> {
  await getCurrentUser();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error(`[${TABLE}] delete failed:`, error);
    throw toDeleteError('expense', error);
  }
}

export function subscribeToExpenseChanges(onChange: (eventType: ExpenseChangeEvent) => void): () => void {
  const channel = supabase
    .channel(`${TABLE}-sync-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const eventType = String(payload.eventType ?? '') as ExpenseChangeEvent;
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
