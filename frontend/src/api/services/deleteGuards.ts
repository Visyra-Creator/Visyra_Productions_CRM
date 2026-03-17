import { supabase } from '../supabase';

export interface DeleteDependency {
  table: string;
  column: string;
  label: string;
}

export function toDeleteError(entityLabel: string, error: any): Error {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  const isFkViolation = code === '23503' || message.includes('foreign key') || message.includes('still referenced');

  if (isFkViolation) {
    return new Error(`Cannot delete ${entityLabel}. It is linked to other records. Delete related data first.`);
  }

  return new Error(`Failed to delete ${entityLabel}. Please try again.`);
}

export async function assertNoDependencies(entityLabel: string, id: string, dependencies: DeleteDependency[]): Promise<void> {
  await assertNoDependenciesForUser(entityLabel, id, dependencies);
}

export async function assertNoDependenciesForUser(
  entityLabel: string,
  id: string,
  dependencies: DeleteDependency[],
  userId?: string,
): Promise<void> {
  const blockers: string[] = [];

  for (const dependency of dependencies) {
    let query = supabase
      .from(dependency.table)
      .select('*', { count: 'exact', head: true })
      .eq(dependency.column, id);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { count, error } = await query;

    if (error) {
      throw toDeleteError(entityLabel, error);
    }

    if ((count ?? 0) > 0) {
      blockers.push(`${dependency.label} (${count})`);
    }
  }

  if (blockers.length > 0) {
    throw new Error(`Cannot delete ${entityLabel}. It has related ${blockers.join(', ')}. Delete related data first.`);
  }
}

