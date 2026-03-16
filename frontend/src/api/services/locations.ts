import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

const TABLE = 'locations';

export type LocationRecord = any;
export type LocationCreateInput = any;
export type LocationUpdateInput = Partial<LocationCreateInput>;

export async function getAll(): Promise<LocationRecord[]> {
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as LocationRecord[];
}

export async function create(payload: LocationCreateInput): Promise<LocationRecord> {
  return (await safeQuery(
    supabase.from(TABLE).insert(payload).select('*').single(),
    null
  )) as LocationRecord;
}

export async function update(id: string, payload: LocationUpdateInput): Promise<LocationRecord> {
  return (await safeQuery(
    supabase.from(TABLE).update(payload).eq('id', id).select('*').single(),
    null
  )) as LocationRecord;
}

async function deleteById(id: string): Promise<void> {
  await safeQuery(
    supabase.from(TABLE).delete().eq('id', id),
    null
  );
}

export { deleteById as delete };

