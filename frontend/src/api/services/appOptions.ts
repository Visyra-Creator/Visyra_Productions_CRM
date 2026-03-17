import { supabase } from '../supabase';
import { toDeleteError } from './deleteGuards';
import { getCurrentUser, withUserScope } from './rls';

const TABLE = 'app_options';

let warnedMissingTable = false;
let localIdCounter = -1;
let localOptionsStore: AppOptionRecord[] = [];

export type AppOptionRecord = any;
export type AppOptionCreateInput = any;
export type AppOptionUpdateInput = Partial<AppOptionCreateInput>;
export type AppOptionChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

function isMissingTableError(error: any): boolean {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  return code === 'PGRST205' || message.includes('could not find the table');
}

function isRlsError(error: any): boolean {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  return code === '42501' || message.includes('row-level security') || message.includes('violates row-level');
}

function warnMissingTableOnce(error: any) {
  if (!warnedMissingTable) {
    warnedMissingTable = true;
    void error;
  }
}

function upsertLocalOption(payload: any, existingId?: string): AppOptionRecord {
  const normalized = normalizeOptionRow({
    id: existingId ?? localIdCounter--,
    type: payload?.type ?? 'general',
    label: payload?.label ?? payload?.value ?? 'Option',
    value: payload?.value ?? payload?.label ?? '',
    color: payload?.color ?? '#6b7280',
  });

  const idAsString = String(normalized.id);
  const index = localOptionsStore.findIndex((item) => String(item.id) === idAsString);
  if (index > -1) {
    localOptionsStore[index] = { ...localOptionsStore[index], ...normalized };
  } else {
    localOptionsStore.push(normalized);
  }

  return normalized;
}

function normalizeOptionRow(row: any): AppOptionRecord {
  if (!row) return row;

  // Native schema: { id, type, label, value, color }
  if (row.type || row.label) {
    return {
      id: row.id,
      type: row.type ?? 'general',
      label: row.label ?? String(row.value ?? ''),
      value: row.value ?? row.label ?? '',
      color: row.color ?? '#6b7280',
    };
  }

  // Fallback schema: { id, key, value } where key is "type:label"
  const rawKey = String(row.key ?? 'general:option');
  const separator = rawKey.indexOf(':');
  const type = separator > -1 ? rawKey.slice(0, separator) : 'general';
  const keyLabel = separator > -1 ? rawKey.slice(separator + 1) : rawKey;
  const label = keyLabel || String(row.value ?? 'Option');

  return {
    id: row.id,
    type,
    label,
    value: row.value ?? label,
    color: row.color ?? '#6b7280',
  };
}

export async function getAll(): Promise<AppOptionRecord[]> {
  await getCurrentUser();
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) {
    if (isMissingTableError(error)) {
      warnMissingTableOnce(error);
      return [...localOptionsStore];
    }
    if (isRlsError(error)) {
      // RLS blocking read — run backend/migrations/2026-03-17_fix_rls_app_options_and_role.sql
      return [...localOptionsStore];
    }
    console.error('Supabase error:', error);
    throw error;
  }

  const normalized = ((data ?? []) as any[]).map(normalizeOptionRow);
  if (normalized.length > 0) {
    localOptionsStore = normalized;
  }
  return normalized;
}

export async function create(payload: AppOptionCreateInput): Promise<AppOptionRecord> {
  const user = await getCurrentUser();
  const scopedPayload = withUserScope((payload ?? {}) as Record<string, any>, user.id);
  const { data, error } = await supabase.from(TABLE).insert(scopedPayload).select('*').single();
  if (!error) {
    const normalized = normalizeOptionRow(data);
    upsertLocalOption(normalized, String(normalized.id));
    return normalized;
  }

  if (isMissingTableError(error)) {
    warnMissingTableOnce(error);
    return upsertLocalOption(scopedPayload);
  }

  if (isRlsError(error)) {
    // RLS blocking insert — run backend/migrations/2026-03-17_fix_rls_app_options_and_role.sql
    return upsertLocalOption(scopedPayload);
  }

  // Fallback for key/value schema: persist type + label into key.
  const fallbackPayload = {
    key: `${payload?.type ?? 'general'}:${payload?.label ?? payload?.value ?? 'option'}`,
    value: payload?.value ?? payload?.label ?? '',
    user_id: user.id,
  };

  const { data: fallbackData, error: fallbackError } = await supabase
    .from(TABLE)
    .insert(fallbackPayload)
    .select('*')
    .single();

  if (fallbackError) {
    if (isMissingTableError(fallbackError)) {
      warnMissingTableOnce(fallbackError);
      return upsertLocalOption(scopedPayload);
    }
    if (isRlsError(fallbackError)) {
      return upsertLocalOption(scopedPayload);
    }
    console.error('Supabase error:', fallbackError);
    throw fallbackError;
  }

  const normalized = normalizeOptionRow(fallbackData);
  upsertLocalOption(normalized, String(normalized.id));
  return normalized;
}

// Create an option only if the same type+label does not already exist (case-insensitive).
export async function createIfNotExists(type: string, label: string): Promise<AppOptionRecord | null> {
  const trimmedType = String(type ?? '').trim();
  const trimmedLabel = String(label ?? '').trim();
  if (!trimmedType || !trimmedLabel) return null;

  const normalizedTarget = trimmedLabel.toLowerCase();

  // Check current options first to prevent duplicates.
  const existing = (await getAll()).find((o: any) =>
    String(o?.type ?? '').trim() === trimmedType &&
    String(o?.label ?? '').trim().toLowerCase() === normalizedTarget
  );

  if (existing) return existing;

  // Use label as value by default to match existing app options conventions.
  return create({ type: trimmedType, label: trimmedLabel, value: trimmedLabel });
}

export async function update(id: string, payload: AppOptionUpdateInput): Promise<AppOptionRecord> {
  await getCurrentUser();
  const scopedPayload = (payload ?? {}) as Record<string, any>;
  const { data, error } = await supabase.from(TABLE).update(scopedPayload).eq('id', id).select('*').single();
  if (!error) {
    const normalized = normalizeOptionRow(data);
    upsertLocalOption(normalized, String(normalized.id));
    return normalized;
  }

  if (isMissingTableError(error)) {
    warnMissingTableOnce(error);
    return upsertLocalOption(scopedPayload, id);
  }

  if (isRlsError(error)) {
    return upsertLocalOption(scopedPayload, id);
  }

  // Fallback for key/value schema: update value only when label/type columns do not exist.
  const fallbackUpdate = {
    value: payload?.value ?? payload?.label ?? '',
  };
  const { data: fallbackData, error: fallbackError } = await supabase
    .from(TABLE)
    .update(fallbackUpdate)
    .eq('id', id)
    .select('*')
    .single();

  if (fallbackError) {
    if (isMissingTableError(fallbackError)) {
      warnMissingTableOnce(fallbackError);
      return upsertLocalOption(scopedPayload, id);
    }
    if (isRlsError(fallbackError)) {
      return upsertLocalOption(scopedPayload, id);
    }
    console.error('Supabase error:', fallbackError);
    throw fallbackError;
  }

  const normalized = normalizeOptionRow(fallbackData);
  upsertLocalOption(normalized, String(normalized.id));
  return normalized;
}

async function deleteById(id: string): Promise<void> {
  await getCurrentUser();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  localOptionsStore = localOptionsStore.filter((item) => String(item.id) !== String(id));
  if (error) {
    if (isMissingTableError(error)) {
      warnMissingTableOnce(error);
      return;
    }
    if (isRlsError(error)) {
      return;
    }
    console.error('Supabase error:', error);
    throw toDeleteError('app option', error);
  }
}

export function subscribeToAppOptionChanges(onChange: (eventType: AppOptionChangeEvent) => void): () => void {
  const channel = supabase
    .channel(`${TABLE}-sync-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const eventType = String(payload.eventType ?? '') as AppOptionChangeEvent;
        if (eventType === 'INSERT' || eventType === 'UPDATE' || eventType === 'DELETE') {
          onChange(eventType);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export { deleteById as delete };

