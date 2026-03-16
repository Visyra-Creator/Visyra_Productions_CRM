import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

const TABLE = 'packages';

export type PackageRecord = any;
export type PackageCreateInput = any;
export type PackageUpdateInput = Partial<PackageCreateInput>;

export async function getAll(): Promise<PackageRecord[]> {
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as PackageRecord[];
}

export async function create(payload: PackageCreateInput): Promise<PackageRecord> {
  return (await safeQuery(
    supabase.from(TABLE).insert(payload).select('*').single(),
    null
  )) as PackageRecord;
}

export async function update(id: string, payload: PackageUpdateInput): Promise<PackageRecord> {
  return (await safeQuery(
    supabase.from(TABLE).update(payload).eq('id', id).select('*').single(),
    null
  )) as PackageRecord;
}

async function deleteById(id: string): Promise<void> {
  await safeQuery(
    supabase.from(TABLE).delete().eq('id', id),
    null
  );
}

export { deleteById as delete };

