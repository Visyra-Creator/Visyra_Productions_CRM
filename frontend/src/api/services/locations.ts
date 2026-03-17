import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';
import { toDeleteError } from './deleteGuards';
import { getCurrentUser, withUserScope } from './rls';

const TABLE = 'locations';

export type LocationRecord = any;
export type LocationCreateInput = any;
export type LocationUpdateInput = Partial<LocationCreateInput>;
export type LocationChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export async function getAll(): Promise<LocationRecord[]> {
  await getCurrentUser();
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as LocationRecord[];
}

export async function create(payload: LocationCreateInput): Promise<LocationRecord> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from(TABLE).insert(withUserScope(payload ?? {}, user.id)).select('*').single();
  if (error) {
    console.error(`[${TABLE}] create failed:`, error);
    throw error;
  }
  return data as LocationRecord;
}

export async function update(id: string, payload: LocationUpdateInput): Promise<LocationRecord> {
  await getCurrentUser();
  const { data, error } = await supabase
    .from(TABLE)
    .update(payload ?? {})
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error(`[${TABLE}] update failed:`, error);
    throw error;
  }
  return data as LocationRecord;
}

async function deleteById(id: string): Promise<void> {
  await getCurrentUser();
  const { error: childDeleteError } = await supabase.from('location_images').delete().eq('location_id', id);
  if (childDeleteError) {
    console.error('[locations] delete child location_images failed:', childDeleteError);
    throw toDeleteError('location', childDeleteError);
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error(`[${TABLE}] delete failed:`, error);
    throw toDeleteError('location', error);
  }
}

export function subscribeToLocationChanges(onChange: (eventType: LocationChangeEvent) => void): () => void {
  const channel = supabase
    .channel(`${TABLE}-sync-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const eventType = String(payload.eventType ?? '') as LocationChangeEvent;
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
