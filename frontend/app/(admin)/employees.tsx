import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '@/store/themeStore';
import * as usersService from '@/api/services/users';
import type { User } from '@/api/services/users';

/**
 * Employees Admin Screen
 *
 * Features:
 * - Display statistics of employees
 * - Fetch and display pending (unapproved) employees
 * - Approve or reject users
 * - Matches UI pattern of other app pages
 */
export default function EmployeesScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width > 768;
  const { colors } = useThemeStore();

  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const [pending, all] = await Promise.all([
        usersService.getPendingUsers(),
        usersService.getAllUsers(),
      ]);
      setPendingUsers(pending);
      setAllUsers(all);
    } catch (error) {
      console.error('Failed to load users:', error);
      Alert.alert('Error', 'Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleApproveUser = async (user: User) => {
    Alert.alert(
      'Approve Employee',
      `Are you sure you want to approve ${user.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            await approveUserConfirmed(user.id);
          },
        },
      ]
    );
  };

  const approveUserConfirmed = async (userId: string) => {
    try {
      setApproving(userId);
      const updatedUser = await usersService.approveUser(userId);

      if (updatedUser) {
        setPendingUsers(pendingUsers.filter(u => u.id !== userId));
        setAllUsers([...allUsers.filter(u => u.id !== userId), { ...updatedUser, approved: true } as User]);
        Alert.alert('Success', 'Employee has been approved');
      } else {
        Alert.alert('Error', 'Failed to approve employee');
      }
    } catch (error) {
      console.error('Failed to approve user:', error);
      Alert.alert('Error', 'Failed to approve employee');
    } finally {
      setApproving(null);
    }
  };

  const handleRejectUser = async (user: User) => {
    Alert.alert(
      'Reject Employee',
      `Are you sure you want to reject and remove ${user.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            await rejectUserConfirmed(user.id);
          },
        },
      ]
    );
  };

  const rejectUserConfirmed = async (userId: string) => {
    try {
      setApproving(userId);
      await usersService.rejectUser(userId);

      setPendingUsers(pendingUsers.filter(u => u.id !== userId));
      setAllUsers(allUsers.filter(u => u.id !== userId));
      Alert.alert('Success', 'Employee has been rejected');
    } catch (error) {
      console.error('Failed to reject user:', error);
      Alert.alert('Error', 'Failed to reject employee');
    } finally {
      setApproving(null);
    }
  };

  const approvedUsers = allUsers.filter(u => u.approved);

  const StatCard = ({
    icon,
    title,
    value,
    gradientColors,
    onPress
  }: {
    icon: string;
    title: string;
    value: number | string;
    gradientColors: [string, string];
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{ flex: 1, marginRight: isTablet ? 12 : 8 }}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.statCard, { borderRadius: 16 }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={[styles.statCardTitle, { color: 'rgba(255,255,255,0.8)' }]}>
              {title}
            </Text>
            <Text style={[styles.statCardValue, { color: '#ffffff' }]}>
              {value}
            </Text>
          </View>
          <Ionicons name={icon as any} size={32} color="rgba(255,255,255,0.6)" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderUserCard = ({ item: user }: { item: User }) => (
    <View
      style={[
        styles.userCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* User Header with Avatar */}
      <View style={styles.userHeader}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.primary + '20' },
          ]}
        >
          <Ionicons name="person" size={24} color={colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: colors.text }]}>
            {user.name}
          </Text>
          <Text style={[styles.userHandle, { color: colors.textSecondary }]}>
            @{user.username}
          </Text>
        </View>

        <View style={[
          styles.badge,
          { backgroundColor: user.approved ? '#d1fae5' : '#fca5a5' }
        ]}>
          <Text style={[
            styles.badgeText,
            { color: user.approved ? '#065f46' : '#7f1d1d' }
          ]}>
            {user.approved ? 'APPROVED' : 'PENDING'}
          </Text>
        </View>
      </View>

      {/* User Info */}
      <View style={[
        styles.userInfo,
        { borderBottomColor: colors.border }
      ]}>
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {user.email}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {user.phone || 'N/A'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {new Date(user.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      {!user.approved && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => handleApproveUser(user)}
            disabled={approving === user.id}
            style={[
              styles.actionButton,
              styles.approveButton,
              { opacity: approving === user.id ? 0.7 : 1 }
            ]}
          >
            {approving === user.id ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleRejectUser(user)}
            disabled={approving === user.id}
            style={[
              styles.actionButton,
              styles.rejectButton,
              { opacity: approving === user.id ? 0.7 : 1 }
            ]}
          >
            {approving === user.id ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={16} color="white" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading employees...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="person-add-outline"
          title="Pending"
          value={pendingUsers.length}
          gradientColors={['#f59e0b', '#d97706']}
        />
        <StatCard
          icon="checkmark-done-outline"
          title="Approved"
          value={approvedUsers.length}
          gradientColors={['#10b981', '#059669']}
        />
        <StatCard
          icon="people-outline"
          title="Total"
          value={allUsers.length}
          gradientColors={['#3b82f6', '#1d4ed8']}
        />
      </View>

      {/* Pending Employees Section */}
      {pendingUsers.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Pending Approvals
            </Text>
            <View style={[styles.sectionBadge, { backgroundColor: '#fee2e2' }]}>
              <Text style={[styles.sectionBadgeText, { color: '#991b1b' }]}>
                {pendingUsers.length}
              </Text>
            </View>
          </View>

          <FlatList
            data={pendingUsers}
            renderItem={renderUserCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      ) : (
        <View style={styles.emptyStateContainer}>
          <View
            style={[
              styles.emptyStateIcon,
              { backgroundColor: colors.primary + '20' },
            ]}
          >
            <Ionicons name="checkmark-done" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            All Caught Up!
          </Text>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            No pending employee approvals at the moment.
          </Text>
        </View>
      )}

      {/* Approved Employees Section */}
      {approvedUsers.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Approved Employees
            </Text>
            <View style={[styles.sectionBadge, { backgroundColor: '#dbeafe' }]}>
              <Text style={[styles.sectionBadgeText, { color: '#1e40af' }]}>
                {approvedUsers.length}
              </Text>
            </View>
          </View>

          <FlatList
            data={approvedUsers}
            renderItem={renderUserCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  headerSection: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 28,
    gap: 12,
  },
  statCard: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    overflow: 'hidden',
  },
  statCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statCardValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userHandle: {
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  userInfo: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: '80%',
  },
});

