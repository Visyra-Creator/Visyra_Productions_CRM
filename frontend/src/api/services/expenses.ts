import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

const TABLE = 'expenses';

export type ExpenseRecord = any;
export type ExpenseCreateInput = any;
export type ExpenseUpdateInput = Partial<ExpenseCreateInput>;

export async function getAll(): Promise<ExpenseRecord[]> {
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as ExpenseRecord[];
}

export async function create(payload: ExpenseCreateInput): Promise<ExpenseRecord> {
  return (await safeQuery(
    supabase.from(TABLE).insert(payload).select('*').single(),
    null
  )) as ExpenseRecord;
}

export async function update(id: string, payload: ExpenseUpdateInput): Promise<ExpenseRecord> {
  return (await safeQuery(
    supabase.from(TABLE).update(payload).eq('id', id).select('*').single(),
    null
  )) as ExpenseRecord;
}

async function deleteById(id: string): Promise<void> {
  await safeQuery(
    supabase.from(TABLE).delete().eq('id', id),
    null
  );
}

export { deleteById as delete };

