export async function safeQuery(query: Promise<any>, fallback: any = []) {
  try {
    const { data, error } = await query;

    if (error) {
      const message = String(error?.message ?? '').toLowerCase();
      const code = String(error?.code ?? '');
      const missingTable =
        code === 'PGRST205' ||
        message.includes('table does not exist') ||
        message.includes('could not find the table');
      const missingColumn =
        code === 'PGRST204' ||
        message.includes('could not find the') && message.includes('column');

      if (missingTable) {
        console.warn('Supabase missing table (using fallback):', error);
        return fallback;
      }

      if (missingColumn) {
        console.warn('Supabase missing column (using fallback):', error);
        return fallback;
      }

      console.error('Supabase query failed:', error);
      return fallback;
    }

    return data ?? fallback;
  } catch (err) {
    console.error('Unexpected query error:', err);
    return fallback;
  }
}

