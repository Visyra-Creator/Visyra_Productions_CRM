import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';

/**
 * Waiting for Approval Screen
 *
 * Shown when user is logged in but not yet approved by admin
 * Provides option to logout and try again later
 */
export default function WaitingForApprovalScreen() {
  const { colors } = useThemeStore();
  const { logout, loading } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
    >
      {/* Icon */}
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: colors.info + '20',
          justifyContent: 'center',
          alignItems: 'center',
          alignSelf: 'center',
          marginBottom: 32,
        }}
      >
        <Ionicons name="hourglass-outline" size={60} color={colors.info} />
      </View>

      {/* Title */}
      <Text
        style={{
          color: colors.text,
          fontSize: 28,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 12,
        }}
      >
        Waiting for Approval
      </Text>

      {/* Subtitle */}
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 16,
          textAlign: 'center',
          marginBottom: 32,
          lineHeight: 24,
        }}
      >
        Your account is pending approval from an administrator. This usually takes a few minutes to a few hours.
      </Text>

      {/* Info Box */}
      <View
        style={{
          backgroundColor: colors.info + '10',
          borderWidth: 1,
          borderColor: colors.info + '30',
          borderRadius: 12,
          padding: 16,
          marginBottom: 32,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Ionicons name="information-circle" size={20} color={colors.info} style={{ marginRight: 12, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
              What's next?
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              Once approved, you'll be able to access all features of the app. You may need to log out and log back in to see the changes.
            </Text>
          </View>
        </View>
      </View>

      {/* Checking Box */}
      <View
        style={{
          backgroundColor: colors.success + '10',
          borderWidth: 1,
          borderColor: colors.success + '30',
          borderRadius: 12,
          padding: 16,
          marginBottom: 32,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} style={{ marginRight: 12, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
              How to check status
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
              Try logging out and logging back in to refresh your status. If you're still waiting, contact your administrator.
            </Text>
          </View>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        onPress={handleLogout}
        disabled={loading}
        style={{
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <Ionicons name="log-out" size={18} color="white" />
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
              Log Out
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Additional Info */}
      <Text
        style={{
          color: colors.textTertiary,
          fontSize: 12,
          textAlign: 'center',
          marginTop: 24,
        }}
      >
        Still waiting? Contact your administrator for assistance.
      </Text>
    </ScrollView>
  );
}

