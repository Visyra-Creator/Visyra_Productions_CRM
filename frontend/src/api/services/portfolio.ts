import { supabase } from '../supabase';
import { safeQuery } from '../../utils/safeQuery';
import { toDeleteError } from './deleteGuards';
import { getCurrentUser, withUserScope } from './rls';

const TABLE = 'portfolio';

export type PortfolioRecord = any;
export type PortfolioCreateInput = any;
export type PortfolioUpdateInput = Partial<PortfolioCreateInput>;
export type PortfolioChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export async function getAll(): Promise<PortfolioRecord[]> {
  await getCurrentUser();
  return (await safeQuery(
    supabase.from(TABLE).select('*'),
    []
  )) as PortfolioRecord[];
}

export async function create(payload: PortfolioCreateInput): Promise<PortfolioRecord> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from(TABLE).insert(withUserScope(payload ?? {}, user.id)).select('*').single();
  if (error) {
    console.error(`[${TABLE}] create failed:`, error);
    throw error;
  }
  return data as PortfolioRecord;
}

export async function update(id: string, payload: PortfolioUpdateInput): Promise<PortfolioRecord> {
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
  return data as PortfolioRecord;
}

async function deleteById(id: string): Promise<void> {
  await getCurrentUser();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    console.error(`[${TABLE}] delete failed:`, error);
    throw toDeleteError('portfolio item', error);
  }
}

export function subscribeToPortfolioChanges(onChange: (eventType: PortfolioChangeEvent) => void): () => void {
  const channel = supabase
    .channel(`${TABLE}-sync-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const eventType = String(payload.eventType ?? '') as PortfolioChangeEvent;
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
