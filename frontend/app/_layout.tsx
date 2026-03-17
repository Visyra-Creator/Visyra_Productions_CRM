import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Platform, ActivityIndicator, useWindowDimensions, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useThemeStore } from '../src/store/themeStore';
import { useMenuStore } from '../src/store/menuStore';
import { useAuthStore } from '../src/store/authStore';
import { updateProfile } from '../src/api/services/auth';
import { supabase } from '../src/api/supabase';
import WebNotice from './web-notice';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

function RootLayoutNav() {
  const { colors } = useThemeStore();
  const { isMenuOpen, closeMenu, toggleMenu } = useMenuStore();
  const { role, user, setUser, logout } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const isTablet = width > 768;

  const allMenuItems = [
    { icon: 'grid-outline',     title: 'Dashboard', route: '/',          adminOnly: false },
    { icon: 'people-outline',   title: 'Clients',   route: '/clients',   adminOnly: false },
    { icon: 'camera-outline',   title: 'Shoots',    route: '/shoots',    adminOnly: false },
    { icon: 'location-outline', title: 'Locations', route: '/locations', adminOnly: false },
    { icon: 'funnel-outline',   title: 'Leads',     route: '/leads',     adminOnly: false },
    { icon: 'card-outline',     title: 'Payments',  route: '/payments',  adminOnly: true  },
    { icon: 'pricetag-outline', title: 'Packages',  route: '/packages',  adminOnly: false },
    { icon: 'receipt-outline',  title: 'Expenses',  route: '/expenses',  adminOnly: true  },
    { icon: 'images-outline',   title: 'Portfolio', route: '/portfolio', adminOnly: false },
  ];

  // Filter out admin-only items for employees
  const menuItems = allMenuItems.filter(item => !item.adminOnly || role === 'admin');

  const isDashboard = segments.length === 0 || (segments.length === 1 && segments[0] === 'index');
  const isLeadsPage = segments.length > 0 && segments[segments.length - 1] === 'leads';
  const isClientsPage = segments.length > 0 && segments[segments.length - 1] === 'clients';

  const [profileDropdownVisible, setProfileDropdownVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadAvatar = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const avatar = (data?.user?.user_metadata?.avatar_url as string | undefined) || null;
        setAvatarUrl(avatar);
      } catch (error) {
        console.error('[layout] avatar load failed:', error);
      }
    };

    loadAvatar();
  }, [segments, user?.id]);

  const openEditDetails = () => {
    setProfileDropdownVisible(false);
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
    setEmail(user?.email ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setEditModalVisible(true);
  };

  const handleLogout = async () => {
    setProfileDropdownVisible(false);
    await logout();
    router.replace('/auth/login');
  };

  const handleProfileIconPress = () => {
    setProfileDropdownVisible((prev) => !prev);
  };

  const handleSaveDetails = async () => {
    if (!user) return;
    setSavingProfile(true);

    try {
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();

      const profileRes = await updateProfile(user.id, {
        name: trimmedName,
        phone: trimmedPhone,
      });

      if (profileRes.error || !profileRes.user) {
        Alert.alert('Update Failed', profileRes.error ?? 'Could not update profile details.');
        return;
      }

      // Keep auth store in sync with updated profile data
      setUser(profileRes.user);

      // Password update is optional. Only run if user typed anything in this section.
      const wantsPasswordChange =
        currentPassword.length > 0 || newPassword.length > 0 || confirmNewPassword.length > 0;

      if (wantsPasswordChange) {
        if (!currentPassword || !newPassword || !confirmNewPassword) {
          Alert.alert('Password Error', 'Please fill all password fields.');
          return;
        }

        if (newPassword !== confirmNewPassword) {
          Alert.alert('Password Error', 'New password and confirm password do not match.');
          return;
        }

        // Verify current password by re-authenticating
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (verifyError) {
          Alert.alert('Password Error', 'Current password is incorrect.');
          return;
        }

        // Update password in Supabase Auth
        const { error: updatePasswordError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (updatePasswordError) {
          Alert.alert('Password Error', updatePasswordError.message);
          return;
        }
      }

      Alert.alert('Success', 'Details updated successfully.');
      setEditModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Something went wrong while updating details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const SideMenu = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isMenuOpen}
      onRequestClose={closeMenu}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalDismiss} onPress={closeMenu} />
        <View style={[styles.menuContainer, { backgroundColor: colors.background, width: isTablet ? 350 : 300 }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={[styles.menuBrand, { color: colors.primary }]}>VISYRA</Text>
                <Text style={[styles.menuSubBrand, { color: colors.textSecondary }]}>Productions Control Center</Text>
              </View>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.surface }]}
                onPress={closeMenu}
              >
                <Ionicons name="close-outline" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuItemsContainer} showsVerticalScrollIndicator={false}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={() => {
                    closeMenu();
                    router.push(item.route as any);
                  }}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.surface }]}>
                    <Ionicons name={item.icon as any} size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.menuItemText, { color: colors.text }]}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={[styles.menuFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => {
                  closeMenu();
                  router.push('/settings');
                }}
              >
                <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.settingsMenuText, { color: colors.textSecondary }]}>Settings</Text>
              </TouchableOpacity>
              <Text style={[styles.versionText, { color: colors.textTertiary }]}>v1.0.0</Text>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );

  const ProfileDropdown = () => (
    <Modal
      transparent
      animationType="fade"
      visible={profileDropdownVisible}
      onRequestClose={() => setProfileDropdownVisible(false)}
    >
      <View style={styles.dropdownBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileDropdownVisible(false)} />
        <View
          style={[
            styles.profileDropdown,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity style={styles.profileDropdownItem} onPress={openEditDetails}>
            <Ionicons name="create-outline" size={18} color={colors.text} />
            <Text style={[styles.profileDropdownText, { color: colors.text }]}>Edit Details</Text>
          </TouchableOpacity>

          <View style={[styles.profileDropdownDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.profileDropdownItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={[styles.profileDropdownText, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const EditDetailsModal = () => (
    <Modal
      transparent
      animationType="slide"
      visible={editModalVisible}
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View style={styles.editModalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditModalVisible(false)} />
        <View
          style={[
            styles.editModalCard,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <View style={styles.editModalHeader}>
            <Text style={[styles.editModalTitle, { color: colors.text }]}>Edit Details</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={colors.textTertiary}
              style={[styles.inputBox, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Phone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Phone"
              placeholderTextColor={colors.textTertiary}
              style={[styles.inputBox, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              value={email}
              editable={false}
              placeholder="Email"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.inputBox,
                {
                  color: colors.textSecondary,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: 0.7,
                },
              ]}
            />

            <Text style={[styles.passwordSectionTitle, { color: colors.text }]}>Change Password</Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Current Password</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholder="Current Password"
              placeholderTextColor={colors.textTertiary}
              style={[styles.inputBox, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>New Password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="New Password"
              placeholderTextColor={colors.textTertiary}
              style={[styles.inputBox, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Confirm New Password</Text>
            <TextInput
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
              placeholder="Confirm New Password"
              placeholderTextColor={colors.textTertiary}
              style={[styles.inputBox, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveDetails}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.surface,
            },
            headerTintColor: colors.text,
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isLeadsPage && (
                  <TouchableOpacity
                    onPress={() => router.push('/clients')}
                    style={{ marginRight: 8, padding: 8 }}
                  >
                    <Ionicons name="people-outline" size={24} color={colors.primary} />
                  </TouchableOpacity>
                )}
                {isClientsPage && (
                  <>
                    <TouchableOpacity
                      onPress={() => router.push('/shoots')}
                      style={{ marginRight: 8, padding: 8 }}
                    >
                      <Ionicons name="camera-outline" size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => router.push('/payments')}
                      style={{ marginRight: 8, padding: 8 }}
                    >
                      <Ionicons name="card-outline" size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => router.push('/leads')}
                      style={{ marginRight: 8, padding: 8 }}
                    >
                      <Ionicons name="funnel-outline" size={24} color={colors.primary} />
                    </TouchableOpacity>
                  </>
                )}
                {!isDashboard && (
                  <TouchableOpacity
                    onPress={() => router.replace('/')}
                    style={{ marginRight: 8, padding: 8 }}
                  >
                    <Ionicons name="home-outline" size={24} color={colors.primary} />
                  </TouchableOpacity>
                )}
                <Pressable
                  onPress={handleProfileIconPress}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginRight: 8, padding: 8 }}
                >
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: 28, height: 28, borderRadius: 14 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="person-circle-outline" size={28} color={colors.text} />
                  )}
                </Pressable>
                <TouchableOpacity
                  onPress={toggleMenu}
                  style={{ marginRight: 8, padding: 8 }}
                >
                  <Ionicons name="menu-outline" size={28} color={colors.text} />
                </TouchableOpacity>
              </View>
            ),
            contentStyle: {
              backgroundColor: colors.background,
            }
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'Visyra Productions',
              headerLeft: () => null,
              headerBackVisible: false,
              gestureEnabled: false
            }}
          />
          {/* Auth screens — shown before login, no app header */}
          <Stack.Screen name="auth/login"            options={{ headerShown: false }} />
          <Stack.Screen name="auth/signup"           options={{ headerShown: false }} />
          <Stack.Screen name="waiting-for-approval"  options={{ headerShown: false }} />
          {/* App screens */}
          <Stack.Screen name="clients"           options={{ title: 'Clients' }} />
          <Stack.Screen name="shoots"            options={{ title: 'Shoots' }} />
          <Stack.Screen name="locations"         options={{ title: 'Locations' }} />
          <Stack.Screen name="payments"          options={{ title: 'Payments' }} />
          <Stack.Screen name="packages"          options={{ title: 'Packages' }} />
          <Stack.Screen name="wedding-packages"  options={{ title: 'Wedding Packages' }} />
          <Stack.Screen name="fashion-packages"  options={{ title: 'Fashion Packages' }} />
          <Stack.Screen name="event-packages"    options={{ title: 'Event Packages' }} />
          <Stack.Screen name="commercial-packages" options={{ title: 'Commercial Packages' }} />
          <Stack.Screen name="expenses"          options={{ title: 'Expenses' }} />
          <Stack.Screen name="leads"             options={{ title: 'Leads' }} />
          <Stack.Screen name="portfolio"         options={{ title: 'Portfolio' }} />
          <Stack.Screen name="settings"          options={{ title: 'Settings' }} />
          <Stack.Screen name="customization"     options={{ title: 'Customization' }} />
        </Stack>
        <SideMenu />
        <ProfileDropdown />
        <EditDetailsModal />
      </View>
    </SafeAreaProvider>
  );
}


export default function RootLayout() {
  const router   = useRouter();
  const pathname = usePathname();

  const { user, approved, loading, checkSession } = useAuthStore();

  // ── Splash animation ───────────────────────────────────────────────────────
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── mounted flag ───────────────────────────────────────────────────────────
  // Expo Router throws "Attempted to navigate before mounting the Root Layout"
  // if router.replace() is called before the Stack inside RootLayoutNav has
  // finished its first render.  This flag gates ALL navigation until the
  // component is fully mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Guard: checkSession runs EXACTLY ONCE on app start ────────────────────
  // useRef prevents double-execution in React Strict Mode and after fast-refresh.
  const sessionChecked = useRef(false);

  useEffect(() => {
    if (sessionChecked.current) return;
    sessionChecked.current = true;

    checkSession().then(() => {
      // Fade out splash after session is resolved
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue:  0,
          duration: 600,
          useNativeDriver: true,
        }).start(() => setShowSplash(false));
      }, 800);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation guard ───────────────────────────────────────────────────────
  useEffect(() => {
    // Do not navigate until the Stack is mounted AND session check is done
    if (!mounted || loading) return;

    if (!user) {
      // Not authenticated — go to login, but only if not already on an auth screen
      if (!pathname.startsWith('/auth')) {
        router.replace('/auth/login');
      }
      return;
    }

    if (!approved) {
      // Authenticated but pending admin approval
      if (pathname !== '/waiting-for-approval') {
        router.replace('/waiting-for-approval');
      }
      return;
    }

    // Authenticated + approved — redirect away from auth screens into the app
    if (pathname.startsWith('/auth') || pathname === '/waiting-for-approval') {
      router.replace('/');
    }
  }, [mounted, user, approved, loading, pathname]); // `router` intentionally omitted — stable ref

  // ── Web notice ─────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return <WebNotice />;
  }

  // ── Always render the navigation tree ─────────────────────────────────────
  // NEVER conditionally swap between a plain <View> and <RootLayoutNav>.
  // Swapping unmounts the navigation tree, which remounts RootLayout and
  // restarts the checkSession effect — causing the infinite loop.
  // Instead, render the Stack at all times and show a loading overlay on top.
  return (
    <>
      <RootLayoutNav />

      {/* Loading overlay — sits above the Stack while session is being restored.
          The Stack is already mounted underneath, so there is no remount on
          transition from "loading" to "ready". */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Splash screen — fades out after checkSession resolves */}
      {showSplash && (
        <Animated.View style={[styles.splashOverlay, { opacity: fadeAnim }]}>
          <View style={styles.splashContent}>
            <Text style={styles.splashLogo}>V</Text>
            <Text style={styles.splashBrand}>VISYRA</Text>
            {loading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loaderText}>Loading...</Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  dropdownBackdrop: {
    flex: 1,
  },
  profileDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 96 : 82,
    right: 12,
    minWidth: 170,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  profileDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  profileDropdownText: {
    fontSize: 14,
    fontWeight: '600',
  },
  profileDropdownDivider: {
    height: 1,
    opacity: 0.6,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  editModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '82%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  fieldLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  inputBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  passwordSectionTitle: {
    marginTop: 18,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    marginTop: 18,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  menuContainer: {
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  menuHeader: {
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  menuBrand: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  menuSubBrand: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
    opacity: 0.8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuItemIconActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '700',
  },
  menuFooter: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  settingsMenuText: {
    fontSize: 14,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
  },
  splashLogo: {
    fontSize: 120,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -10,
  },
  splashBrand: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 8,
    marginTop: -10,
    opacity: 0.8,
  },
  loaderContainer: {
    marginTop: 40,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
    letterSpacing: 1,
  },
});
