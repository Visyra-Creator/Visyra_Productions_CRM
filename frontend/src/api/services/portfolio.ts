import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

const TABLE = 'portfolio';

export type PortfolioRecord = any;
export type PortfolioCreateInput = any;
export type PortfolioUpdateInput = Partial<PortfolioCreateInput>;

export async function getAll(): Promise<PortfolioRecord[]> {
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as PortfolioRecord[];
}

export async function create(payload: PortfolioCreateInput): Promise<PortfolioRecord> {
  return (await safeQuery(
    supabase.from(TABLE).insert(payload).select('*').single(),
    null
  )) as PortfolioRecord;
}

export async function update(id: string, payload: PortfolioUpdateInput): Promise<PortfolioRecord> {
  return (await safeQuery(
    supabase.from(TABLE).update(payload).eq('id', id).select('*').single(),
    null
  )) as PortfolioRecord;
}

async function deleteById(id: string): Promise<void> {
  await safeQuery(
    supabase.from(TABLE).delete().eq('id', id),
    null
  );
}

export { deleteById as delete };

