import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

const TABLE = 'payments';

export type PaymentRecord = any;
export type PaymentCreateInput = any;
export type PaymentUpdateInput = Partial<PaymentCreateInput>;

export async function getAll(): Promise<PaymentRecord[]> {
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as PaymentRecord[];
}

export async function create(payload: PaymentCreateInput): Promise<PaymentRecord> {
  return (await safeQuery(
    supabase.from(TABLE).insert(payload).select('*').single(),
    null
  )) as PaymentRecord;
}

export async function update(id: string, payload: PaymentUpdateInput): Promise<PaymentRecord> {
  return (await safeQuery(
    supabase.from(TABLE).update(payload).eq('id', id).select('*').single(),
    null
  )) as PaymentRecord;
}

async function deleteById(id: string): Promise<void> {
  await safeQuery(
    supabase.from(TABLE).delete().eq('id', id),
    null
  );
}

export { deleteById as delete };

