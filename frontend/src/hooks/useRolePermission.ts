import { useAuthStore } from '@/store/authStore';

interface UseRolePermissionOptions {
  requiredRole?: 'admin' | 'employee';
  requiredRoles?: ('admin' | 'employee')[];
}

/**
 * useRolePermission Hook
 *
 * Check user permissions easily in components
 *
 * Usage:
 * const { hasPermission, isAdmin, isEmployee } = useRolePermission({ requiredRole: 'admin' });
 *
 * if (!hasPermission) {
 *   return <Text>Access Denied</Text>;
 * }
 */
export function useRolePermission(options: UseRolePermissionOptions = {}) {
  const { role, approved, loading } = useAuthStore();

  const { requiredRole, requiredRoles = [] } = options;

  // Build the list of required roles
  const rolesRequired = requiredRole
    ? [requiredRole]
    : requiredRoles.length > 0
      ? requiredRoles
      : [];

  // Check if user has required role
  const hasPermission =
    !loading &&
    !!role &&
    approved &&
    (rolesRequired.length === 0 || rolesRequired.includes(role));

  const isAdmin = !loading && role === 'admin' && approved;
  const isEmployee = !loading && role === 'employee' && approved;
  const isAuthenticated = !loading && !!role && approved;

  return {
    hasPermission,
    isAdmin,
    isEmployee,
    isAuthenticated,
    role,
    loading,
    approved,
  };
}

export default useRolePermission;

