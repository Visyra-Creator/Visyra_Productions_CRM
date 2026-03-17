import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  BackHandler,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../src/store/themeStore';
import { useAuthStore } from '../src/store/authStore';
import { fetchDashboardData, type DashboardPortfolioImage, type DashboardStats, type DashboardTimelineItem } from '../src/api/services/dashboard';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { getCurrentAvatarUrl } from '../src/api/services/auth';
import * as shootsService from '../src/api/services/shoots';
import * as leadsService from '../src/api/services/leads';
import * as clientsService from '../src/api/services/clients';
import * as paymentsService from '../src/api/services/payments';
import * as paymentRecordsService from '../src/api/services/paymentRecords';
import * as expensesService from '../src/api/services/expenses';
import * as portfolioService from '../src/api/services/portfolio';

interface TimelineItem extends DashboardTimelineItem {}
interface PortfolioImage extends DashboardPortfolioImage {}

export default function Dashboard() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { role, user, loading: authLoading } = useAuthStore();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth > 768;
  const isPhone = !isTablet;
  const isCompactPhone = windowWidth < 390;
  const overdueCardBasis = isTablet ? '23%' : (isCompactPhone ? '100%' : '48%');
  const overdueOuterHeight = isTablet ? 240 : (isCompactPhone ? 168 : 200);
  const overdueInnerHeight = isTablet ? 200 : (isCompactPhone ? 140 : 160);
  const overdueIconSize = isTablet ? 24 : (isCompactPhone ? 20 : 24);
  const overdueTitleFontSize = isTablet ? 15 : (isCompactPhone ? 13 : 15);
  const overdueCountFontSize = isTablet ? 13 : (isCompactPhone ? 11 : 13);
  const timelinePanelHeight = isTablet ? 240 : (isCompactPhone ? 210 : 240);
  const timelineCardHeight = isTablet ? 240 : (isCompactPhone ? 200 : 240);
  const timelineCardIconSize = isTablet ? 20 : (isCompactPhone ? 18 : 20);
  const timelineTitleSize = isTablet ? 15 : (isCompactPhone ? 13 : 15);
  const timelineClientSize = isTablet ? 13 : (isCompactPhone ? 12 : 13);
  const timelineMetaSize = isTablet ? 11 : (isCompactPhone ? 10 : 11);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Shared card width for Shoots/Leads/Clients/Payments timelines.
  // Phone: near full width; Tablet/Desktop: clamped to stable readable width.
  const horizontalCardWidth = isPhone
    ? Math.max(windowWidth - 56, 280)
    : Math.min(Math.max(windowWidth * 0.42, 360), 520);
  // Keep phone full-width; increase second frame width further on large screens.
  const timelineSecondFrameWidth = isPhone
    ? '100%'
    : windowWidth >= 1200
      ? Math.min(Math.max(windowWidth * 0.48, 500), 700)
      : Math.min(Math.max(windowWidth * 0.44, 380), 560);

  const [stats, setStats] = useState<DashboardStats>({
    upcomingShoots: 0,
    totalLeads: 0,
    totalClients: 0,
    pendingPayments: 0,
    outstandingBalance: 0,
    monthlyRevenue: 0,
    totalExpenses: 0,
    monthlyProfit: 0,
    todaysShoots: [] as any[],
    todaysFollowUps: [] as any[],
    todaysClientFollowUps: [] as any[],
    todaysPayments: [] as any[],
    overdueShoots: [] as any[],
    overdueLeads: [] as any[],
    overdueClientFollowUps: [] as any[],
    overduePayments: [] as any[],
  });
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
  const [recentPortfolio, setRecentPortfolio] = useState<PortfolioImage[]>([]);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const isLoadingDataRef = useRef(false);
  const lastLoadAtRef = useRef(0);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const loadProfileAvatar = useCallback(async () => {
    try {
      const avatar = await getCurrentAvatarUrl();
      setProfileAvatarUrl(avatar);
    } catch (error) {
      console.error('[Dashboard] Failed to load profile avatar:', error);
    }
  }, []);

  // Handle Exit Confirmation
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert('Exit App', 'Are you sure you want to exit?', [
          { text: 'Cancel', onPress: () => null, style: 'cancel' },
          { text: 'YES', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      loadProfileAvatar();
    }, [loadProfileAvatar])
  );

  const loadData = useCallback(async (reason = 'manual', opts?: { force?: boolean }) => {
    if (authLoading) {
      console.log(`[Dashboard] Skipping ${reason}; auth state is still loading.`);
      return;
    }

    if (!user?.id) {
      console.log(`[Dashboard] Skipping ${reason}; no authenticated user.`);
      setLoading(false);
      return;
    }

    const now = Date.now();
    if (isLoadingDataRef.current) {
      console.log(`[Dashboard] Skipping ${reason}; fetch already in progress.`);
      return;
    }
    if (!opts?.force && now - lastLoadAtRef.current < 500) {
      console.log(`[Dashboard] Skipping ${reason}; throttled.`);
      return;
    }

    isLoadingDataRef.current = true;
    setLoading(true);

    try {
      console.log(`[Dashboard] Starting data load (${reason})...`);
      const data = await fetchDashboardData();

      setStats(data.stats);
      setTimelineData(data.timelineData);
      setRecentPortfolio(data.recentPortfolio);

      console.log('[Dashboard] Data load completed successfully');
    } catch (error) {
      console.error('[Dashboard] Error loading dashboard data:', error);
    } finally {
      lastLoadAtRef.current = Date.now();
      isLoadingDataRef.current = false;
      console.log('[Dashboard] Releasing loading lock');
      setLoading(false);
    }
  }, [authLoading, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading || !user?.id) {
        return () => {};
      }
      void loadData('focus');
      return () => {};
    }, [authLoading, user?.id, loadData])
  );

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return () => {};
    }

    const scheduleRefresh = (reason: string) => {
      if (realtimeRefreshTimeoutRef.current) clearTimeout(realtimeRefreshTimeoutRef.current);
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        void loadData(reason, { force: true });
      }, 250);
    };

    const unsubShoots = shootsService.subscribeToShootChanges(() => scheduleRefresh('realtime-shoots'));
    const unsubLeads = leadsService.subscribeToLeadChanges(() => scheduleRefresh('realtime-leads'));
    const unsubClients = clientsService.subscribeToClientChanges(() => scheduleRefresh('realtime-clients'));
    const unsubPayments = paymentsService.subscribeToPaymentChanges(() => scheduleRefresh('realtime-payments'));
    const unsubPaymentRecords = paymentRecordsService.subscribeToPaymentRecordChanges(() => scheduleRefresh('realtime-payment-records'));
    const unsubExpenses = expensesService.subscribeToExpenseChanges(() => scheduleRefresh('realtime-expenses'));
    const unsubPortfolio = portfolioService.subscribeToPortfolioChanges(() => scheduleRefresh('realtime-portfolio'));

    return () => {
      if (realtimeRefreshTimeoutRef.current) clearTimeout(realtimeRefreshTimeoutRef.current);
      unsubShoots();
      unsubLeads();
      unsubClients();
      unsubPayments();
      unsubPaymentRecords();
      unsubExpenses();
      unsubPortfolio();
    };
  }, [user?.id, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData('pull-to-refresh', { force: true });
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const StatCard = ({ icon, title, value, gradientColors, onPress, fullWidth, subtitle }: any) => (
    <TouchableOpacity
      style={[styles.statCardContainer, fullWidth && { flex: 0, width: '100%' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statCard}
      >
        <View style={styles.statCardContent}>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
            <Text style={styles.statTitle} numberOfLines={1}>{title}</Text>
            {subtitle && (
              <Text style={styles.statSubtitle} numberOfLines={1}>{subtitle}</Text>
            )}
          </View>
          <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name={icon} size={22} color="#fff" />
          </View>
        </View>
        <View style={styles.statCardGlow} />
      </LinearGradient>
    </TouchableOpacity>
  );

  const QuickActionCard = ({ icon, title, color, onPress }: any) => (
    <TouchableOpacity
      style={[
        styles.actionCard,
        { backgroundColor: colors.surface }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.actionCardContent}>
        <View style={[styles.actionIconWrapper, { backgroundColor: color + '15' }]}>
          <LinearGradient
            colors={[color, color + 'cc']}
            style={styles.actionIconGradient}
          >
            <Ionicons name={icon} size={22} color="#fff" />
          </LinearGradient>
        </View>
        <Text style={[styles.actionTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  const TimelineRow = ({ item, isLast }: { item: TimelineItem; isLast: boolean }) => {
    const isToday = format(item.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    let iconName: any = 'camera';
    let iconColor = colors.primary;

    if (item.type === 'shoot') {
      iconName = 'camera';
      iconColor = colors.primary;
    } else if (item.type === 'payment') {
      iconName = 'card';
      iconColor = colors.accent;
    } else if (item.type === 'lead') {
      iconName = 'call';
      iconColor = colors.info;
    } else if (item.type === 'client') {
      iconName = 'person-circle';
      iconColor = colors.success;
    }

    return (
      <View style={styles.timelineItemWrapper}>
        <View style={styles.timelineLeft}>
          <Text style={[styles.timelineDate, { color: isToday ? colors.primary : colors.textSecondary }]}>
            {format(item.date, 'dd')}
          </Text>
          <Text style={[styles.timelineMonth, { color: colors.textTertiary }]}>
            {format(item.date, 'MMM')}
          </Text>
        </View>

        <View style={styles.timelineIndicator}>
          <View style={[styles.timelineDot, { backgroundColor: iconColor }]} />
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
        </View>

        <View style={[styles.timelineContent, { backgroundColor: colors.surface }]}>
          <View style={styles.timelineContentHeader}>
            <View style={[styles.timelineIconWrapper, { backgroundColor: iconColor + '15' }]}>
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
            <View style={styles.timelineTextContainer}>
              <Text style={[styles.timelineTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.timelineSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{item.subtitle}</Text>
            </View>
          </View>
          {isToday && (
            <View style={[styles.todayBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.todayBadgeText, { color: colors.primary }]}>Today</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const ManageItem = ({ icon, title, color, onPress, isLast }: any) => (
    <TouchableOpacity
      style={[styles.manageItem, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.manageIconWrapper, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={[styles.manageTextContainer, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <Text style={[styles.manageTitle, { color: colors.text }]}>{title}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Connecting to database...</Text>
      </View>
    );
  }

  // PRECISE WIDTH CALCULATION FOR 5 FRAMES
  const effectiveWidth = Math.min(windowWidth, 1200);
  const sidePadding = (isTablet ? 20 : 0) + 24; // tabletContentWrapper + section padding
  const availableWidth = effectiveWidth - (sidePadding * 2);
  const ITEM_GAP = 10;
  const frameWidth = (availableWidth - (ITEM_GAP * 4)) / 5;
  const frameHeight = frameWidth * 1.35; // Taller proper framing

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary + '15', colors.background, colors.background]}
        style={styles.backgroundGradient}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={[styles.contentWrapper, isTablet && styles.tabletContentWrapper]}>
          {/* Greeting Section */}
          <View style={styles.greetingSection}>
            <View>
              <Text style={[styles.greeting, { color: colors.text }]}>{getGreeting()} 👋</Text>
              <Text style={[styles.date, { color: colors.textSecondary }]}>
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.profileButton, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/profile')}
            >
              {profileAvatarUrl ? (
                <Image source={{ uri: profileAvatarUrl }} style={styles.profileAvatarImage} contentFit="cover" />
              ) : (
                <Ionicons name="person" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Overview Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Overview</Text>
              <View style={styles.liveBadge}>
                <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.liveBadgeText, { color: colors.success }]}>Live Updates</Text>
              </View>
            </View>
            <View style={styles.statsGrid}>
              <StatCard
                icon="camera"
                title="Total Shoots"
                value={stats.upcomingShoots}
                gradientColors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                onPress={() => router.push('/shoots')}
              />
              <StatCard
                icon="people"
                title="Total Leads"
                value={stats.totalLeads}
                gradientColors={[colors.accentGradientStart, colors.accentGradientEnd]}
                onPress={() => router.push('/leads')}
              />
            </View>
            <View style={[styles.statsGrid, { marginTop: 12 }]}>
              <StatCard
                icon="person-circle-outline"
                title="Total Clients"
                value={stats.totalClients}
                gradientColors={['#6366f1', '#4f46e5']}
                onPress={() => router.push('/clients')}
              />
              {role === 'admin' && (
                <StatCard
                  icon="time"
                  title="Pending Payments"
                  value={stats.pendingPayments}
                  subtitle={`Bal: ₹${stats.outstandingBalance.toLocaleString()}`}
                  gradientColors={['#ef4444', '#dc2626']}
                  onPress={() => router.push('/payments')}
                />
              )}
            </View>
            <View style={[styles.statsGrid, { marginTop: 12 }]}>
              {role === 'admin' && (
                <StatCard
                  icon="trending-up"
                  title="Monthly Revenue"
                  value={`₹${stats.monthlyRevenue.toLocaleString()}`}
                  subtitle={`Profit: ₹${stats.monthlyProfit.toLocaleString()}`}
                  gradientColors={['#10b981', '#059669']}
                  onPress={() => router.push('/payments')}
                />
              )}
              {role === 'admin' && (
                <StatCard
                  icon="receipt-outline"
                  title="Monthly Expenses"
                  value={`₹${stats.totalExpenses.toLocaleString()}`}
                  gradientColors={['#f59e0b', '#d97706']}
                  onPress={() => router.push('/expenses')}
                />
              )}
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <QuickActionCard icon="person-add" title="Add Client" color={colors.primary} onPress={() => router.push('/clients')} />
              <QuickActionCard icon="calendar" title="Book Shoot" color={colors.accent} onPress={() => router.push('/shoots')} />
              <QuickActionCard icon="funnel" title="Add Lead" color={colors.info} onPress={() => router.push('/leads')} />
              <QuickActionCard icon="images" title="Portfolio" color={colors.success} onPress={() => router.push('/portfolio')} />
            </View>
          </View>

          {/* Shoots Timeline (Shoots & Payments) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Shoots Timeline</Text>
              <TouchableOpacity onPress={() => router.push('/shoots')}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.timelineSplitRow, isPhone && { flexDirection: 'column' }]}>
              <View
                style={{ flex: isPhone ? 1 : 0, minHeight: timelinePanelHeight, width: isPhone ? '100%' : horizontalCardWidth }}
              >
                {stats.todaysShoots.length > 0 ? (
                  <View style={{ flex: 1 }}>
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={{ flex: 1, flexGrow: 1 }}
                    >
                      {stats.todaysShoots.map((shoot: any, index: number) => (
                        <TouchableOpacity
                          key={shoot.id}
                          style={[
                            styles.todayShootSplitCard,
                            {
                              backgroundColor: colors.primary + '15',
                              borderColor: colors.primary + '30',
                              minHeight: timelineCardHeight,
                              width: horizontalCardWidth,
                              position: 'relative'
                            }
                          ]}
                          onPress={() => router.push('/shoots')}
                        >
                          {/* Badge visible only on first card */}
                          {index === 0 && (
                            <View style={[styles.shootCountBadgeFixed, { backgroundColor: colors.primary }]}>
                              <Text style={styles.shootCountText}>{stats.todaysShoots.length}</Text>
                            </View>
                          )}
                          <View style={styles.todayShootHeader}>
                            <LinearGradient
                              colors={[colors.primary, colors.primaryGradientEnd]}
                              style={styles.todayShootIconSmall}
                            >
                              <Ionicons name="camera" size={timelineCardIconSize} color="#fff" />
                            </LinearGradient>
                            <Text style={[styles.todayShootLabel, { color: colors.primary }]}>TODAY</Text>
                          </View>

                          <Text style={[styles.todayShootTitle, { color: colors.text, fontSize: timelineTitleSize }]} numberOfLines={2}>
                            {shoot.event_type}
                          </Text>
                          <Text style={[styles.todayShootClient, { color: colors.textSecondary, fontSize: timelineClientSize }]} numberOfLines={1}>
                            {shoot.client_name}
                          </Text>

                          <View style={styles.todayShootFooter}>
                            <View style={styles.todayShootMetaItem}>
                              <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                              <Text style={[styles.todayShootMetaText, { color: colors.textTertiary, fontSize: timelineMetaSize }]}>{shoot.start_time}</Text>
                            </View>
                            <View style={styles.todayShootMetaItem}>
                              <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                              <Text style={[styles.todayShootMetaText, { color: colors.textTertiary, fontSize: timelineMetaSize }]} numberOfLines={1}>{shoot.location || 'TBD'}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {stats.todaysShoots.length > 1 && (
                      <View style={styles.swipeIndicatorContainer}>
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.primary} />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[styles.todayShootSplitCard, { backgroundColor: colors.surface, borderStyle: 'dashed', borderColor: colors.border, minHeight: timelineCardHeight, width: horizontalCardWidth, justifyContent: 'center', alignItems: 'center' }]}>
                     <Ionicons name="cafe-outline" size={24} color={colors.textTertiary} />
                     <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>Free Day</Text>
                     <Text style={{ color: colors.textTertiary, fontSize: 10, textAlign: 'center', marginTop: 4 }}>No shoots today</Text>
                  </View>
                )}
              </View>

              <View style={[styles.cardContainer, { backgroundColor: colors.surface, flex: isPhone ? 1 : 0, padding: isCompactPhone ? 10 : 12, minHeight: timelinePanelHeight, width: timelineSecondFrameWidth }]}>
                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                  {timelineData.filter(i => i.type === 'shoot').length > 0 ? (
                    timelineData.filter(i => i.type === 'shoot').map((item, index, arr) => (
                      <TimelineRow
                        key={`${item.type}-${item.id}`}
                        item={item}
                        isLast={index === arr.length - 1}
                      />
                    ))
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 20 }}>
                      <View style={[styles.emptyState, { backgroundColor: 'transparent' }]}>
                        <Ionicons name="calendar-clear-outline" size={30} color={colors.textTertiary} />
                        <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontSize: 12, textAlign: 'center' }]}>No upcoming events</Text>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* Leads Follow Up Timeline */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Leads Follow Up Timeline</Text>
              <TouchableOpacity onPress={() => router.push('/leads')}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.timelineSplitRow, isPhone && { flexDirection: 'column' }]}>
              <View
                style={{ flex: isPhone ? 1 : 0, minHeight: timelinePanelHeight, width: isPhone ? '100%' : horizontalCardWidth, minWidth: 0 }}
              >
                {stats.todaysFollowUps.length > 0 ? (
                  <View style={{ flex: 1 }}>
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={{ flex: 1, flexGrow: 1 }}
                    >
                      {stats.todaysFollowUps.map((lead: any, index: number) => (
                        <TouchableOpacity
                          key={lead.id}
                          style={[
                            styles.todayShootSplitCard,
                            {
                              backgroundColor: colors.info + '15',
                              borderColor: colors.info + '30',
                              minHeight: timelineCardHeight,
                              width: horizontalCardWidth,
                              position: 'relative'
                            }
                          ]}
                          onPress={() => router.push('/leads')}
                        >
                          {/* Badge visible only on first card */}
                          {index === 0 && (
                            <View style={[styles.shootCountBadgeFixed, { backgroundColor: colors.info }]}>
                              <Text style={styles.shootCountText}>{stats.todaysFollowUps.length}</Text>
                            </View>
                          )}
                          <View style={styles.todayShootHeader}>
                            <LinearGradient
                              colors={[colors.info, '#0ea5e9']}
                              style={styles.todayShootIconSmall}
                            >
                              <Ionicons name="call" size={timelineCardIconSize} color="#fff" />
                            </LinearGradient>
                            <Text style={[styles.todayShootLabel, { color: colors.info }]}>TODAY</Text>
                          </View>

                          <Text style={[styles.todayShootTitle, { color: colors.text, fontSize: timelineTitleSize }]} numberOfLines={2}>
                            {lead.name}
                          </Text>
                          <Text style={[styles.todayShootClient, { color: colors.textSecondary, fontSize: timelineClientSize }]} numberOfLines={1}>
                            {lead.source || 'Lead'}
                          </Text>

                          <View style={styles.todayShootFooter}>
                            <View style={styles.todayShootMetaItem}>
                              <Ionicons name="call-outline" size={12} color={colors.textTertiary} />
                              <Text
                                style={[styles.todayShootMetaText, { color: colors.textTertiary, fontSize: timelineMetaSize }]}
                                numberOfLines={1}
                              >
                                {lead.phone}
                              </Text>
                            </View>
                            <View style={styles.todayShootMetaItem}>
                              <Ionicons name="chatbubble-outline" size={12} color={colors.textTertiary} />
                              <Text style={[styles.todayShootMetaText, { color: colors.textTertiary, fontSize: timelineMetaSize }]} numberOfLines={1}>{lead.notes || 'No notes'}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {stats.todaysFollowUps.length > 1 && (
                      <View style={styles.swipeIndicatorContainer}>
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.info} />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[styles.todayShootSplitCard, { backgroundColor: colors.surface, borderStyle: 'dashed', borderColor: colors.border, minHeight: timelineCardHeight, width: horizontalCardWidth, justifyContent: 'center', alignItems: 'center' }]}>
                     <Ionicons name="notifications-off-outline" size={24} color={colors.textTertiary} />
                     <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>All Caught Up</Text>
                     <Text style={{ color: colors.textTertiary, fontSize: 10, textAlign: 'center', marginTop: 4 }}>No follow-ups today</Text>
                  </View>
                )}
              </View>

              <View style={[styles.cardContainer, { backgroundColor: colors.surface, flex: isPhone ? 1 : 0, padding: isCompactPhone ? 14 : 20, minHeight: timelinePanelHeight, width: timelineSecondFrameWidth }]}>
                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                  {timelineData.filter(i => i.type === 'lead').length > 0 ? (
                    timelineData.filter(i => i.type === 'lead').map((item, index, arr) => (
                      <TimelineRow
                        key={`${item.type}-${item.id}`}
                        item={item}
                        isLast={index === arr.length - 1}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyStateContainer}>
                      <Ionicons name="call-outline" size={30} color={colors.textTertiary} />
                      <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontSize: 12, textAlign: 'center' }]}>No upcoming follow-ups</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* Clients Follow Up Timeline */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Clients Follow Up Timeline</Text>
              <TouchableOpacity onPress={() => router.push('/clients')}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.timelineSplitRow, isPhone && { flexDirection: 'column' }]}>
              <View
                style={{ flex: isPhone ? 1 : 0, minHeight: timelinePanelHeight, width: isPhone ? '100%' : horizontalCardWidth }}
              >
                {stats.todaysClientFollowUps.length > 0 ? (
                  <View style={{ flex: 1 }}>
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={{ flex: 1, flexGrow: 1 }}
                    >
                      {stats.todaysClientFollowUps.map((client: any, index: number) => (
                        <TouchableOpacity
                          key={client.id}
                          style={[
                            styles.todayShootSplitCard,
                            {
                              backgroundColor: colors.success + '15',
                              borderColor: colors.success + '30',
                              minHeight: timelineCardHeight,
                              width: horizontalCardWidth,
                              position: 'relative'
                            }
                          ]}
                          onPress={() => router.push('/clients')}
                        >
                          {/* Badge visible only on first card */}
                          {index === 0 && (
                            <View style={[styles.shootCountBadgeFixed, { backgroundColor: colors.success }]}>
                              <Text style={styles.shootCountText}>{stats.todaysClientFollowUps.length}</Text>
                            </View>
                          )}
                          <View style={styles.todayShootHeader}>
                            <LinearGradient
                              colors={[colors.success, '#16a34a']}
                              style={styles.todayShootIconSmall}
                            >
                              <Ionicons name="call" size={timelineCardIconSize} color="#fff" />
                            </LinearGradient>
                            <Text style={[styles.todayShootLabel, { color: colors.success }]}>TODAY</Text>
                          </View>

                          <Text style={[styles.todayShootTitle, { color: colors.text, fontSize: timelineTitleSize }]} numberOfLines={2}>
                            {client.name}
                          </Text>
                          <Text style={[styles.todayShootClient, { color: colors.textSecondary, fontSize: timelineClientSize }]} numberOfLines={1}>
                            {client.event_type || 'Client'}
                          </Text>

                          <View style={styles.todayShootFooter}>
                            <View style={styles.todayShootMetaItem}>
                              <Ionicons name="call-outline" size={12} color={colors.textTertiary} />
                              <Text style={[styles.todayShootMetaText, { color: colors.textTertiary, fontSize: timelineMetaSize }]}>{client.phone}</Text>
                            </View>
                            <View style={styles.todayShootMetaItem}>
                              <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                              <Text style={[styles.todayShootMetaText, { color: colors.textTertiary, fontSize: timelineMetaSize }]} numberOfLines={1}>{client.event_location || 'No location'}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {stats.todaysClientFollowUps.length > 1 && (
                      <View style={styles.swipeIndicatorContainer}>
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.success} />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[styles.todayShootSplitCard, { backgroundColor: colors.surface, borderStyle: 'dashed', borderColor: colors.border, minHeight: timelineCardHeight, width: horizontalCardWidth, justifyContent: 'center', alignItems: 'center' }]}>
                     <Ionicons name="checkmark-circle-outline" size={24} color={colors.textTertiary} />
                     <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>All Followed Up</Text>
                     <Text style={{ color: colors.textTertiary, fontSize: 10, textAlign: 'center', marginTop: 4 }}>No client follow-ups today</Text>
                  </View>
                )}
              </View>

              <View style={[styles.cardContainer, { backgroundColor: colors.surface, flex: isPhone ? 1 : 0, padding: isCompactPhone ? 14 : 20, minHeight: timelinePanelHeight, width: timelineSecondFrameWidth }]}>
                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                  {timelineData.filter(i => i.type === 'client').length > 0 ? (
                    timelineData.filter(i => i.type === 'client').map((item, index, arr) => (
                      <TimelineRow
                        key={`${item.type}-${item.id}`}
                        item={item}
                        isLast={index === arr.length - 1}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyStateContainer}>
                      <Ionicons name="call-outline" size={30} color={colors.textTertiary} />
                      <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontSize: 12, textAlign: 'center' }]}>No upcoming client follow-ups</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* Payments Timeline */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Payments Timeline</Text>
              <TouchableOpacity onPress={() => router.push('/payments')}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.timelineSplitRow, isPhone && { flexDirection: 'column' }]}>
              <View
                style={{ flex: isPhone ? 1 : 0, minHeight: timelinePanelHeight, width: isPhone ? '100%' : horizontalCardWidth }}
              >
                {stats.todaysPayments.length > 0 ? (
                  <View style={{ flex: 1 }}>
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={{ flex: 1, flexGrow: 1 }}
                    >
                      {stats.todaysPayments.map((payment: any, index: number) => (
                        <TouchableOpacity
                          key={payment.id}
                          style={[
                            styles.todayShootSplitCard,
                            {
                              backgroundColor: colors.accent + '15',
                              borderColor: colors.accent + '30',
                              minHeight: timelineCardHeight,
                              width: horizontalCardWidth,
                              position: 'relative'
                            }
                          ]}
                          onPress={() => router.push('/payments')}
                        >
                          {/* Badge visible only on first card */}
                          {index === 0 && (
                            <View style={[styles.shootCountBadgeFixed, { backgroundColor: colors.accent }]}>
                              <Text style={styles.shootCountText}>{stats.todaysPayments.length}</Text>
                            </View>
                          )}
                          <View style={styles.todayShootHeader}>
                            <LinearGradient
                              colors={[colors.accent, '#f59e0b']}
                              style={styles.todayShootIconSmall}
                            >
                              <Ionicons name="card" size={timelineCardIconSize} color="#fff" />
                            </LinearGradient>
                            <Text style={[styles.todayShootLabel, { color: colors.accent }]}>TODAY</Text>
                          </View>

                          <Text style={[styles.todayShootTitle, { color: colors.text, fontSize: timelineTitleSize }]} numberOfLines={2}>
                            Payment Due
                          </Text>
                          <Text style={[styles.todayShootClient, { color: colors.textSecondary, fontSize: timelineClientSize }]} numberOfLines={1}>
                            {payment.client_name}
                          </Text>

                          <View style={styles.todayShootFooter}>
                            <View style={styles.todayShootMetaItem}>
                              <Ionicons name="cash-outline" size={12} color={colors.textTertiary} />
                              <Text style={[styles.todayShootMetaText, { color: colors.textTertiary, fontSize: timelineMetaSize }]}>₹{payment.total_amount?.toLocaleString() || 0}</Text>
                            </View>
                            <View style={styles.todayShootMetaItem}>
                              <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
                              <Text style={[styles.todayShootMetaText, { color: colors.textTertiary, fontSize: timelineMetaSize }]} numberOfLines={1}>{payment.payment_date}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {stats.todaysPayments.length > 1 && (
                      <View style={styles.swipeIndicatorContainer}>
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.accent} />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[styles.todayShootSplitCard, { backgroundColor: colors.surface, borderStyle: 'dashed', borderColor: colors.border, minHeight: timelineCardHeight, width: horizontalCardWidth, justifyContent: 'center', alignItems: 'center' }]}>
                     <Ionicons name="cash-outline" size={24} color={colors.textTertiary} />
                     <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>No Payments Due</Text>
                     <Text style={{ color: colors.textTertiary, fontSize: 10, textAlign: 'center', marginTop: 4 }}>No payments due today</Text>
                  </View>
                )}
              </View>

              <View style={[styles.cardContainer, { backgroundColor: colors.surface, flex: isPhone ? 1 : 0, padding: isCompactPhone ? 14 : 20, minHeight: timelinePanelHeight, width: timelineSecondFrameWidth }]}>
                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                  {timelineData.filter(i => i.type === 'payment').length > 0 ? (
                    timelineData.filter(i => i.type === 'payment').map((item, index, arr) => (
                      <TimelineRow
                        key={`${item.type}-${item.id}`}
                        item={item}
                        isLast={index === arr.length - 1}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyStateContainer}>
                      <Ionicons name="cash-outline" size={30} color={colors.textTertiary} />
                      <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontSize: 12, textAlign: 'center' }]}>No upcoming payments</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* Overdue Items Section - NEW STANDALONE SECTION */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Overdue Items</Text>

            <View style={[styles.overdueGrid, { justifyContent: isTablet ? 'flex-start' : 'space-between' }]}>
              <View style={[styles.cardContainer, { backgroundColor: colors.surface, padding: isCompactPhone ? 12 : 16, minHeight: overdueOuterHeight, flexBasis: overdueCardBasis, maxWidth: overdueCardBasis }]}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <View style={[styles.todayShootSplitCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30', minHeight: overdueInnerHeight, width: '100%', justifyContent: 'center', alignItems: 'center' }]}>
                    <LinearGradient
                      colors={[colors.primary, colors.primaryGradientEnd]}
                      style={styles.todayShootIconSmall}
                    >
                      <Ionicons name="camera" size={overdueIconSize} color="#fff" />
                    </LinearGradient>
                    <Text numberOfLines={1} style={[styles.todayShootTitle, { color: colors.text, textAlign: 'center', marginTop: isCompactPhone ? 8 : 12, alignSelf: 'center', fontSize: overdueTitleFontSize }]}>Overdue Shoots</Text>
                    <Text style={[styles.todayShootClient, { color: colors.textSecondary, textAlign: 'center', alignSelf: 'center', fontSize: overdueCountFontSize, marginBottom: isCompactPhone ? 8 : 12 }]}>{stats.overdueShoots.length} items</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.cardContainer, { backgroundColor: colors.surface, padding: isCompactPhone ? 12 : 16, minHeight: overdueOuterHeight, flexBasis: overdueCardBasis, maxWidth: overdueCardBasis }]}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <View style={[styles.todayShootSplitCard, { backgroundColor: colors.info + '15', borderColor: colors.info + '30', minHeight: overdueInnerHeight, width: '100%', justifyContent: 'center', alignItems: 'center' }]}>
                    <LinearGradient
                      colors={[colors.info, '#0ea5e9']}
                      style={styles.todayShootIconSmall}
                    >
                      <Ionicons name="call" size={overdueIconSize} color="#fff" />
                    </LinearGradient>
                    <Text numberOfLines={1} style={[styles.todayShootTitle, { color: colors.text, textAlign: 'center', marginTop: isCompactPhone ? 8 : 12, alignSelf: 'center', fontSize: overdueTitleFontSize }]}>Overdue Leads</Text>
                    <Text style={[styles.todayShootClient, { color: colors.textSecondary, textAlign: 'center', alignSelf: 'center', fontSize: overdueCountFontSize, marginBottom: isCompactPhone ? 8 : 12 }]}>{stats.overdueLeads.length} items</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.cardContainer, { backgroundColor: colors.surface, padding: isCompactPhone ? 12 : 16, minHeight: overdueOuterHeight, flexBasis: overdueCardBasis, maxWidth: overdueCardBasis }]}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <View style={[styles.todayShootSplitCard, { backgroundColor: colors.success + '15', borderColor: colors.success + '30', minHeight: overdueInnerHeight, width: '100%', justifyContent: 'center', alignItems: 'center' }]}>
                    <LinearGradient
                      colors={[colors.success, '#16a34a']}
                      style={styles.todayShootIconSmall}
                    >
                      <Ionicons name="person-circle" size={overdueIconSize} color="#fff" />
                    </LinearGradient>
                    <Text numberOfLines={1} style={[styles.todayShootTitle, { color: colors.text, textAlign: 'center', marginTop: isCompactPhone ? 8 : 12, alignSelf: 'center', fontSize: overdueTitleFontSize }]}>Overdue Clients</Text>
                    <Text style={[styles.todayShootClient, { color: colors.textSecondary, textAlign: 'center', alignSelf: 'center', fontSize: overdueCountFontSize, marginBottom: isCompactPhone ? 8 : 12 }]}>{stats.overdueClientFollowUps.length} items</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.cardContainer, { backgroundColor: colors.surface, padding: isCompactPhone ? 12 : 16, minHeight: overdueOuterHeight, flexBasis: overdueCardBasis, maxWidth: overdueCardBasis }]}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <View style={[styles.todayShootSplitCard, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30', minHeight: overdueInnerHeight, width: '100%', justifyContent: 'center', alignItems: 'center' }]}>
                    <LinearGradient
                      colors={[colors.accent, '#f59e0b']}
                      style={styles.todayShootIconSmall}
                    >
                      <Ionicons name="cash" size={overdueIconSize} color="#fff" />
                    </LinearGradient>
                    <Text numberOfLines={1} style={[styles.todayShootTitle, { color: colors.text, textAlign: 'center', marginTop: isCompactPhone ? 8 : 12, alignSelf: 'center', fontSize: overdueTitleFontSize }]}>Overdue Payments</Text>
                    <Text style={[styles.todayShootClient, { color: colors.textSecondary, textAlign: 'center', alignSelf: 'center', fontSize: overdueCountFontSize, marginBottom: isCompactPhone ? 8 : 12 }]}>{stats.overduePayments.length} items</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Manage Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>Manage</Text>
            <View style={[styles.cardContainer, { backgroundColor: colors.surface, padding: 0 }]}>
              <ManageItem icon="people-outline" title="Clients" color={colors.primary} onPress={() => router.push('/clients')} />
              <ManageItem icon="camera-outline" title="Shoots" color={colors.accent} onPress={() => router.push('/shoots')} />
              {role === 'admin' && (
                <ManageItem icon="card-outline" title="Payments" color={colors.error} onPress={() => router.push('/payments')} />
              )}
              <ManageItem
                icon="gift-outline"
                title="Packages"
                color={colors.success}
                onPress={() => router.push('/packages')}
                isLast={role !== 'admin'}
              />
              {role === 'admin' && (
                <ManageItem
                  icon="people"
                  title="Manage Employees"
                  color="#8b5cf6"
                  onPress={() => router.push('/(admin)/employees')}
                  isLast
                />
              )}
            </View>
          </View>

          {/* Recent Portfolio Section - Static Preview ONLY */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Recent Portfolio</Text>
              <TouchableOpacity onPress={() => router.push('/portfolio')}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>View All</Text>
              </TouchableOpacity>
            </View>

            {recentPortfolio.length > 0 ? (
              <View style={[styles.portfolioStrip, { gap: ITEM_GAP }]}>
                {recentPortfolio.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.portfolioFrame, { width: frameWidth, height: frameHeight }]}
                  >
                    <Image
                      source={item.image_path}
                      style={styles.portfolioFrameImage}
                      contentFit="cover"
                      allowDownscaling={false}
                      cachePolicy="memory-disk"
                      priority="high"
                      transition={200}
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.6)']}
                      style={styles.portfolioFrameOverlay}
                    />
                  </View>
                ))}
                {/* Visual padding frames if less than 5 items */}
                {recentPortfolio.length < 5 && Array.from({ length: 5 - recentPortfolio.length }).map((_, i) => (
                  <View
                    key={`empty-${i}`}
                    style={[styles.portfolioFrame, { width: frameWidth, height: frameHeight, backgroundColor: colors.surface, opacity: 0.5, justifyContent: 'center', alignItems: 'center' }]}
                  >
                    <Ionicons name="camera-outline" size={Math.max(frameWidth * 0.3, 16)} color={colors.textTertiary} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.cardContainer, { backgroundColor: colors.surface, padding: 40 }]}>
                <View style={styles.emptyState}>
                  <Ionicons name="images-outline" size={40} color={colors.textTertiary} />
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No portfolio items</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 350,
  },
  scrollView: {
    flex: 1,
  },
  contentWrapper: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  tabletContentWrapper: {
    paddingHorizontal: 20,
  },
  greetingSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 14,
    opacity: 0.8,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  overviewContainer: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCardContainer: {
    flex: 1,
    minWidth: 150,
    minHeight: 95,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  statCardContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statTextContainer: {
    flex: 1,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginTop: 2,
  },
  statCardGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    borderRadius: 20,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionCardContent: {
    alignItems: 'center',
    gap: 12,
    flexDirection: 'row',
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  cardContainer: {
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  timelineItemWrapper: {
    flexDirection: 'row',
  },
  timelineLeft: {
    width: 40,
    alignItems: 'center',
    paddingTop: 8,
  },
  timelineDate: {
    fontSize: 16,
    fontWeight: '800',
  },
  timelineMonth: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  timelineIndicator: {
    width: 16,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 14,
    zIndex: 2,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    opacity: 0.1,
  },
  timelineContent: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  timelineContentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  timelineIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineTextContainer: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    flexShrink: 1,
  },
  timelineSubtitle: {
    fontSize: 11,
    opacity: 0.7,
    flexShrink: 1,
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
    flexShrink: 0,
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timelineSplitRow: {
    flexDirection: 'row',
    gap: 12,
  },
   todayShootSplitCard: {
     flex: 1,
     flexDirection: 'column',
     padding: 16,
     borderRadius: 24,
     borderWidth: 1,
     overflow: 'hidden',
     justifyContent: 'flex-start',
     alignItems: 'flex-start',
   },
  todayShootHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
    width: '100%',
  },
  todayShootIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayShootLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  shootCountBadgeFixed: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  shootCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  todayShootTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  todayShootClient: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.8,
    alignSelf: 'flex-start',
  },
  todayShootFooter: {
    width: '100%',
    gap: 6,
    marginTop: 'auto',
  },
  todayShootMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayShootMetaText: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  swipeIndicatorContainer: {
    position: 'absolute',
    bottom: 8,
    width: '100%',
    alignItems: 'center',
  },
  manageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  manageIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  manageTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    marginLeft: 14,
  },
  manageTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  portfolioStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  portfolioFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  portfolioFrameImage: {
    width: '100%',
    height: '100%',
  },
  portfolioFrameOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  shootFrameInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  shootFrameTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  shootFrameClient: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.8,
  },
  overdueIconContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
