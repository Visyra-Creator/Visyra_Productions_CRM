import { supabase } from '../supabase';

const TABLE = 'app_options';

let warnedMissingTable = false;
let localIdCounter = -1;
let localOptionsStore: AppOptionRecord[] = [];

export type AppOptionRecord = any;
export type AppOptionCreateInput = any;
export type AppOptionUpdateInput = Partial<AppOptionCreateInput>;

function isMissingTableError(error: any): boolean {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  return code === 'PGRST205' || message.includes('could not find the table');
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
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) {
    if (isMissingTableError(error)) {
      warnMissingTableOnce(error);
      return [...localOptionsStore];
    }
    console.error('Supabase error:', error);
    return [...localOptionsStore];
  }

  const normalized = ((data ?? []) as any[]).map(normalizeOptionRow);
  if (normalized.length > 0) {
    localOptionsStore = normalized;
  }
  return normalized;
}

export async function create(payload: AppOptionCreateInput): Promise<AppOptionRecord> {
  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single();
  if (!error) {
    const normalized = normalizeOptionRow(data);
    upsertLocalOption(normalized, String(normalized.id));
    return normalized;
  }

  if (isMissingTableError(error)) {
    warnMissingTableOnce(error);
    return upsertLocalOption(payload);
  }

  // Fallback for key/value schema: persist type + label into key.
  const fallbackPayload = {
    key: `${payload?.type ?? 'general'}:${payload?.label ?? payload?.value ?? 'option'}`,
    value: payload?.value ?? payload?.label ?? '',
  };

  const { data: fallbackData, error: fallbackError } = await supabase
    .from(TABLE)
    .insert(fallbackPayload)
    .select('*')
    .single();

  if (fallbackError) {
    if (isMissingTableError(fallbackError)) {
      warnMissingTableOnce(fallbackError);
      return upsertLocalOption(payload);
    }
    console.error('Supabase error:', fallbackError);
    return upsertLocalOption(payload);
  }

  const normalized = normalizeOptionRow(fallbackData);
  upsertLocalOption(normalized, String(normalized.id));
  return normalized;
}

export async function update(id: string, payload: AppOptionUpdateInput): Promise<AppOptionRecord> {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single();
  if (!error) {
    const normalized = normalizeOptionRow(data);
    upsertLocalOption(normalized, String(normalized.id));
    return normalized;
  }

  if (isMissingTableError(error)) {
    warnMissingTableOnce(error);
    return upsertLocalOption(payload, id);
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
      return upsertLocalOption(payload, id);
    }
    console.error('Supabase error:', fallbackError);
    return upsertLocalOption(payload, id);
  }

  const normalized = normalizeOptionRow(fallbackData);
  upsertLocalOption(normalized, String(normalized.id));
  return normalized;
}

async function deleteById(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  localOptionsStore = localOptionsStore.filter((item) => String(item.id) !== String(id));
  if (error) {
    if (isMissingTableError(error)) {
      warnMissingTableOnce(error);
      return;
    }
    console.error('Supabase error:', error);
  }
}

export { deleteById as delete };

