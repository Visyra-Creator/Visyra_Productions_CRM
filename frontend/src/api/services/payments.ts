import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';
import { toDeleteError } from './deleteGuards';
import { getCurrentUser, withUserScope } from './rls';

const TABLE = 'payments';

export type PaymentRecord = any;
export type PaymentCreateInput = any;
export type PaymentUpdateInput = Partial<PaymentCreateInput>;
export type PaymentChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export async function getAll(): Promise<PaymentRecord[]> {
  await getCurrentUser();
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as PaymentRecord[];
}

export async function create(payload: PaymentCreateInput): Promise<PaymentRecord> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from(TABLE).insert(withUserScope(payload ?? {}, user.id)).select('*').single();
  if (error) {
    console.error(`[${TABLE}] create failed:`, error);
    throw error;
  }
  return data as PaymentRecord;
}

export async function update(id: string, payload: PaymentUpdateInput): Promise<PaymentRecord> {
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
  return data as PaymentRecord;
}

async function deleteById(id: string): Promise<void> {
  await getCurrentUser();
  const { error: childDeleteError } = await supabase.from('payment_records').delete().eq('invoice_id', id);
  if (childDeleteError) {
    console.error('[payments] delete child payment_records failed:', childDeleteError);
    throw toDeleteError('invoice', childDeleteError);
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error(`[${TABLE}] delete failed:`, error);
    throw toDeleteError('invoice', error);
  }
}

export function subscribeToPaymentChanges(onChange: (eventType: PaymentChangeEvent) => void): () => void {
  const channel = supabase
    .channel(`${TABLE}-sync-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const eventType = String(payload.eventType ?? '') as PaymentChangeEvent;
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
