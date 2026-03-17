import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';
import { toDeleteError } from './deleteGuards';
import { getCurrentUser, withUserScope } from './rls';

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
    if (!error) {
      console.log(`[${TABLE}] ${mode} succeeded`, { removedColumns: [...removedColumns] });
      return (data ?? null) as LeadRecord;
    }

    const missingColumn = extractMissingColumn(error);
    if (!missingColumn || !(missingColumn in sanitizedPayload)) {
      console.error(`[${TABLE}] ${mode} failed:`, error);
      throw error;
    }

    console.warn(`[${TABLE}] Missing column '${missingColumn}'. Retrying ${mode} with sanitized payload.`);
    removedColumns.add(missingColumn);
    delete sanitizedPayload[missingColumn];
  }

  const retryError = new Error(`[${TABLE}] ${mode} failed after retrying missing-column fixes.`);
  console.error(retryError.message, { removedColumns: [...removedColumns] });
  throw retryError;
}

async function createWithFallback(payload: LeadCreateInput): Promise<LeadRecord> {
  const user = await getCurrentUser();
  return executeWithMissingColumnRetries(
    withUserScope((payload ?? {}) as Record<string, any>, user.id),
    (nextPayload) => supabase.from(TABLE).insert(nextPayload).select('*').single(),
    'insert'
  );
}

async function updateWithFallback(id: string, payload: LeadUpdateInput): Promise<LeadRecord> {
  await getCurrentUser();
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
  await getCurrentUser();
  const rows = (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as LeadRecord[];
  console.log(`[${TABLE}] getAll rows:`, Array.isArray(rows) ? rows.length : 0);
  return rows;
}

export async function create(payload: LeadCreateInput): Promise<LeadRecord> {
  return createWithFallback(payload);
}

export async function update(id: string, payload: LeadUpdateInput): Promise<LeadRecord> {
  return updateWithFallback(id, payload);
}

async function deleteById(id: string): Promise<void> {
  await getCurrentUser();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error(`[${TABLE}] delete failed:`, error);
    throw toDeleteError('lead', error);
  }
  console.log(`[${TABLE}] delete succeeded`, { id });
}

export type LeadChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';
export type LeadRealtimeStatus = 'connected' | 'disconnected';

export function subscribeToLeadChanges(
  onChange: (eventType: LeadChangeEvent) => void,
  onStatusChange?: (status: LeadRealtimeStatus) => void
): () => void {
  const channelName = `${TABLE}-sync-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const eventType = String(payload.eventType ?? '') as LeadChangeEvent;
        console.log(`[${TABLE}] realtime event:`, eventType);
        if (eventType === 'INSERT' || eventType === 'UPDATE' || eventType === 'DELETE') {
          onChange(eventType);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        onStatusChange?.('connected');
        console.log(`[${TABLE}] realtime subscribed`, { channelName });
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        onStatusChange?.('disconnected');
        console.warn(`[${TABLE}] realtime status: ${status}`, err ?? null);
      }
    });

  return () => {
    onStatusChange?.('disconnected');
    supabase.removeChannel(channel);
  };
}

export { deleteById as delete };
