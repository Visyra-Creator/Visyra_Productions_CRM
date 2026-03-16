import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Platform, ActivityIndicator, useWindowDimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { useMenuStore } from '../src/store/menuStore';
import WebNotice from './web-notice';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

function RootLayoutNav() {
  const { colors } = useThemeStore();
  const { isMenuOpen, closeMenu, toggleMenu } = useMenuStore();
  const router = useRouter();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const isTablet = width > 768;

  const menuItems = [
    { icon: 'grid-outline', title: 'Dashboard', route: '/' },
    { icon: 'people-outline', title: 'Clients', route: '/clients' },
    { icon: 'camera-outline', title: 'Shoots', route: '/shoots' },
    { icon: 'location-outline', title: 'Locations', route: '/locations' },
    { icon: 'funnel-outline', title: 'Leads', route: '/leads' },
    { icon: 'card-outline', title: 'Payments', route: '/payments' },
    { icon: 'pricetag-outline', title: 'Packages', route: '/packages' },
    { icon: 'receipt-outline', title: 'Expenses', route: '/expenses' },
    { icon: 'images-outline', title: 'Portfolio', route: '/portfolio' },
  ];

  const isDashboard = segments.length === 0 || (segments.length === 1 && segments[0] === 'index');
  const isLeadsPage = segments.length > 0 && segments[segments.length - 1] === 'leads';
  const isClientsPage = segments.length > 0 && segments[segments.length - 1] === 'clients';

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
          <Stack.Screen name="clients" options={{ title: 'Clients' }} />
          <Stack.Screen name="shoots" options={{ title: 'Shoots' }} />
          <Stack.Screen name="locations" options={{ title: 'Locations' }} />
          <Stack.Screen name="payments" options={{ title: 'Payments' }} />
          <Stack.Screen name="packages" options={{ title: 'Packages' }} />
          <Stack.Screen name="wedding-packages" options={{ title: 'Wedding Packages' }} />
          <Stack.Screen name="fashion-packages" options={{ title: 'Fashion Packages' }} />
          <Stack.Screen name="event-packages" options={{ title: 'Event Packages' }} />
          <Stack.Screen name="commercial-packages" options={{ title: 'Commercial Packages' }} />
          <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />
          <Stack.Screen name="leads" options={{ title: 'Leads' }} />
          <Stack.Screen name="portfolio" options={{ title: 'Portfolio' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="customization" options={{ title: 'Customization' }} />
        </Stack>
        <SideMenu />
      </View>
    </SafeAreaProvider>
  );
}

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Navigation logic can be added here if needed
  }, [segments, router]);
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    async function setup() {
      setAppReady(true);

      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }).start(() => setShowSplash(false));
      }, 2000);
    }
    setup();
  }, []);

  if (Platform.OS === 'web') {
    return <WebNotice />;
  }

  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <RootLayoutNav />
      {showSplash && (
        <Animated.View style={[styles.splashOverlay, { backgroundColor: '#0a0a0f', opacity: fadeAnim }]}>
          <View style={styles.splashContent}>
            <Text style={styles.splashLogo}>V</Text>
            <Text style={styles.splashBrand}>VISYRA</Text>
            {!appReady && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loaderText}>Syncing Engine...</Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
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
