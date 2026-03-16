import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

const TABLE = 'clients';

export type ClientRecord = any;
export type ClientCreateInput = any;
export type ClientUpdateInput = Partial<ClientCreateInput>;

export async function getAll(): Promise<ClientRecord[]> {
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as ClientRecord[];
}

export async function create(payload: ClientCreateInput): Promise<ClientRecord> {
  return (await safeQuery(
    supabase.from(TABLE).insert(payload).select('*').single(),
    null
  )) as ClientRecord;
}

export async function update(id: string, payload: ClientUpdateInput): Promise<ClientRecord> {
  return (await safeQuery(
    supabase.from(TABLE).update(payload).eq('id', id).select('*').single(),
    null
  )) as ClientRecord;
}

async function deleteById(id: string): Promise<void> {
  await safeQuery(
    supabase.from(TABLE).delete().eq('id', id),
    null
  );
}

export { deleteById as delete };

