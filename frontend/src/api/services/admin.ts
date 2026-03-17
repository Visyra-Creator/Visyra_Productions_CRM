import { supabase } from '../supabase';

export async function resetSharedCRMData(): Promise<void> {
  const { error } = await supabase.rpc('admin_reset_shared_crm_data');
  if (error) {
    const code = String((error as any)?.code ?? '');
    const message = String((error as any)?.message ?? 'Unknown error');
    const details = String((error as any)?.details ?? '');
    const hint = String((error as any)?.hint ?? '');

    // Common case: migration not applied in the active Supabase project.
    if (code === 'PGRST202' || message.toLowerCase().includes('could not find the function')) {
      throw new Error(
        'Reset function is not available in this database yet. Apply migration: 2026-03-18_admin_reset_shared_crm_data.sql'
      );
    }

    // Raised by the RPC guard when caller is not approved admin.
    if (message.toLowerCase().includes('only approved admins')) {
      throw new Error('Only approved admin accounts can reset CRM data.');
    }

    const debugSuffix = [code && `code=${code}`, details && `details=${details}`, hint && `hint=${hint}`]
      .filter(Boolean)
      .join(' | ');

    throw new Error(
      debugSuffix ? `Reset failed: ${message} (${debugSuffix})` : `Reset failed: ${message}`
    );
  }
}

