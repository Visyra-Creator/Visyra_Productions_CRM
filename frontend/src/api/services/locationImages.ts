import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

const TABLE = 'location_images';

export type LocationImageRow = any;
export type LocationImageCreateInput = any;
export type LocationImageUpdateInput = Partial<LocationImageCreateInput>;

export async function getAll(): Promise<LocationImageRow[]> {
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as LocationImageRow[];
}

export async function create(payload: LocationImageCreateInput): Promise<LocationImageRow> {
  return (await safeQuery(
    supabase.from(TABLE).insert(payload).select('*').single(),
    null
  )) as LocationImageRow;
}

export async function update(id: string, payload: LocationImageUpdateInput): Promise<LocationImageRow> {
  return (await safeQuery(
    supabase.from(TABLE).update(payload).eq('id', id).select('*').single(),
    null
  )) as LocationImageRow;
}

async function deleteById(id: string): Promise<void> {
  await safeQuery(
    supabase.from(TABLE).delete().eq('id', id),
    null
  );
}

export { deleteById as delete };

