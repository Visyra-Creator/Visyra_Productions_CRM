import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

const TABLE = 'payment_records';

export type PaymentRecordRow = any;
export type PaymentRecordCreateInput = any;
export type PaymentRecordUpdateInput = Partial<PaymentRecordCreateInput>;

export async function getAll(): Promise<PaymentRecordRow[]> {
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as PaymentRecordRow[];
}

export async function create(payload: PaymentRecordCreateInput): Promise<PaymentRecordRow> {
  return (await safeQuery(
    supabase.from(TABLE).insert(payload).select('*').single(),
    null
  )) as PaymentRecordRow;
}

export async function update(id: string, payload: PaymentRecordUpdateInput): Promise<PaymentRecordRow> {
  return (await safeQuery(
    supabase.from(TABLE).update(payload).eq('id', id).select('*').single(),
    null
  )) as PaymentRecordRow;
}

async function deleteById(id: string): Promise<void> {
  await safeQuery(
    supabase.from(TABLE).delete().eq('id', id),
    null
  );
}

export { deleteById as delete };

