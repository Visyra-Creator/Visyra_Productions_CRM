import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

const TABLE = 'shoots';

export type ShootRecord = any;
export type ShootCreateInput = any;
export type ShootUpdateInput = Partial<ShootCreateInput>;

export async function getAll(): Promise<ShootRecord[]> {
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as ShootRecord[];
}

export async function create(payload: ShootCreateInput): Promise<ShootRecord> {
  return (await safeQuery(
    supabase.from(TABLE).insert(payload).select('*').single(),
    null
  )) as ShootRecord;
}

export async function update(id: string, payload: ShootUpdateInput): Promise<ShootRecord> {
  return (await safeQuery(
    supabase.from(TABLE).update(payload).eq('id', id).select('*').single(),
    null
  )) as ShootRecord;
}

async function deleteById(id: string): Promise<void> {
  await safeQuery(
    supabase.from(TABLE).delete().eq('id', id),
    null
  );
}

export { deleteById as delete };

