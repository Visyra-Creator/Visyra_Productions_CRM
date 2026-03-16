import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';

const TABLE = 'leads';

function extractMissingColumn(error: any): string | null {
  if (String(error?.code ?? '') !== 'PGRST204') return null;
  const message = String(error?.message ?? '');
  const match = message.match(/'([^']+)' column/);
  return match?.[1] ?? null;
}

async function executeWithMissingColumnRetries(
  payload: Record<string, any>,
  runner: (nextPayload: Record<string, any>) => Promise<{ data: any; error: any }>,
  mode: 'insert' | 'update'
): Promise<LeadRecord> {
  const sanitizedPayload = { ...(payload ?? {}) };
  const removedColumns = new Set<string>();

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await runner(sanitizedPayload);
    if (!error) return (data ?? null) as LeadRecord;

    const missingColumn = extractMissingColumn(error);
    if (!missingColumn || !(missingColumn in sanitizedPayload)) {
      console.error('Supabase query failed:', error);
      return null as LeadRecord;
    }

    removedColumns.add(missingColumn);
    delete sanitizedPayload[missingColumn];
  }

  console.error(`[${TABLE}] ${mode} failed after retrying missing-column fixes. Removed columns:`, [...removedColumns]);
  return null as LeadRecord;
}

async function createWithFallback(payload: LeadCreateInput): Promise<LeadRecord> {
  return executeWithMissingColumnRetries(
    (payload ?? {}) as Record<string, any>,
    (nextPayload) => supabase.from(TABLE).insert(nextPayload).select('*').single(),
    'insert'
  );
}

async function updateWithFallback(id: string, payload: LeadUpdateInput): Promise<LeadRecord> {
  return executeWithMissingColumnRetries(
    (payload ?? {}) as Record<string, any>,
    (nextPayload) => supabase.from(TABLE).update(nextPayload).eq('id', id).select('*').single(),
    'update'
  );
}

export type LeadRecord = any;
export type LeadCreateInput = any;
export type LeadUpdateInput = Partial<LeadCreateInput>;

export async function getAll(): Promise<LeadRecord[]> {
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as LeadRecord[];
}

export async function create(payload: LeadCreateInput): Promise<LeadRecord> {
  return createWithFallback(payload);
}

export async function update(id: string, payload: LeadUpdateInput): Promise<LeadRecord> {
  return updateWithFallback(id, payload);
}

async function deleteById(id: string): Promise<void> {
  await safeQuery(
    supabase.from(TABLE).delete().eq('id', id),
    null
  );
}

export { deleteById as delete };

