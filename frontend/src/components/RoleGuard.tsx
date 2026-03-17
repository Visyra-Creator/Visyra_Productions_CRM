import { useEffect } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { View, Text, ActivityIndicator } from 'react-native';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRoles: ('admin' | 'employee')[];
  fallbackRoute?: string;
}

/**
 * RoleGuard Component
 *
 * Protects pages based on user role
 *
 * Usage:
 * <RoleGuard requiredRoles={['admin']} fallbackRoute="/">
 *   <YourPageContent />
 * </RoleGuard>
 */
export function RoleGuard({
  children,
  requiredRoles,
  fallbackRoute = '/',
}: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, loading, approved } = useAuthStore();

  useEffect(() => {
    // Wait for loading to complete
    if (loading) {
      return;
    }

    // Check if user is authenticated and approved
    if (!role || !approved) {
      router.replace('/auth/login');
      return;
    }

    // Check if user has required role
    if (!requiredRoles.includes(role)) {
      router.replace(fallbackRoute);
      return;
    }
  }, [role, loading, approved, requiredRoles, fallbackRoute, pathname]);

  // Show loading state while checking permissions
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="mt-4 text-gray-600">Loading...</Text>
      </View>
    );
  }

  // User not authenticated
  if (!role) {
    return null;
  }

  // User doesn't have required role
  if (!requiredRoles.includes(role)) {
    return null;
  }

  // User not approved
  if (!approved) {
    return null;
  }

  // User has access
  return <>{children}</>;
}

export default RoleGuard;

