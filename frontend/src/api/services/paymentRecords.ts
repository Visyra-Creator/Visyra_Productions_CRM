import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';
import { toDeleteError } from './deleteGuards';
import { getCurrentUser, withUserScope } from './rls';

const TABLE = 'payment_records';

export type PaymentRecordRow = any;
export type PaymentRecordCreateInput = any;
export type PaymentRecordUpdateInput = Partial<PaymentRecordCreateInput>;
export type PaymentRecordChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export async function getAll(): Promise<PaymentRecordRow[]> {
  const user = await getCurrentUser();
  return (await safeQuery(
    supabase.from(TABLE).select('*').eq('user_id', user.id),
    []
  )) as PaymentRecordRow[];
}

export async function create(payload: PaymentRecordCreateInput): Promise<PaymentRecordRow> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from(TABLE).insert(withUserScope(payload ?? {}, user.id)).select('*').single();
  if (error) {
    console.error(`[${TABLE}] create failed:`, error);
    throw error;
  }
  return data as PaymentRecordRow;
}

export async function update(id: string, payload: PaymentRecordUpdateInput): Promise<PaymentRecordRow> {
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
  return data as PaymentRecordRow;
}

async function deleteById(id: string): Promise<void> {
  await getCurrentUser();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error(`[${TABLE}] delete failed:`, error);
    throw toDeleteError('payment record', error);
  }
}

export function subscribeToPaymentRecordChanges(onChange: (eventType: PaymentRecordChangeEvent) => void): () => void {
  const channel = supabase
    .channel(`${TABLE}-sync-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const eventType = String(payload.eventType ?? '') as PaymentRecordChangeEvent;
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
