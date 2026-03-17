import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { View, Text, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';

/**
 * AdminLayout - Only accessible by admins
 *
 * Wraps admin-only pages:
 * - app/(admin)/payments.tsx
 * - app/(admin)/expenses.tsx
 */
export default function AdminLayout() {
  const router = useRouter();
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

    // Check if user is admin
    if (role !== 'admin') {
      router.replace('/');
      return;
    }
  }, [role, loading, approved, router]);

  // Show loading state while checking permissions
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="mt-4 text-gray-600">Checking permissions...</Text>
      </View>
    );
  }

  // Not authorized
  if (!role || role !== 'admin' || !approved) {
    return null;
  }

  // User is admin - show pages
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackVisible: true,
      }}
    >
      <Stack.Screen name="employees" options={{ headerShown: false }} />
      <Stack.Screen name="payments" options={{ title: 'Payments' }} />
      <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />
    </Stack>
  );
}

