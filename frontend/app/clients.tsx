import React, { useEffect, useState, useMemo, useCallback } from 'react';

// return number of calendar weeks covering the given month/year (4-6).
const getWeeksInMonthCount = (month: number, year: number) => {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstWeekStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });
  const diffInDays = Math.ceil((lastWeekEnd.getTime() - firstWeekStart.getTime()) / (1000 * 60 * 60 * 24));
  return Math.ceil(diffInDays / 7);
};
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  useWindowDimensions,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { getDatabase } from '../src/database/db';
import { LinearGradient } from 'expo-linear-gradient';
import { format, isToday, isThisWeek, isThisMonth, parseISO, startOfWeek, endOfWeek, addWeeks, differenceInCalendarWeeks, isSameDay, isSameWeek, isSameMonth } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';

interface Client {
  id: number;
  client_id?: string;
  name: string;
  phone: string;
  email: string;
  event_type: string;
  event_date: string;
  event_location: string;
  package_name: string;
  total_price: number;
  lead_source: string;
  notes: string;
  status: string;
  created_at?: string;
}

interface AppOption {
  id: number;
  label: string;
}

const CLIENT_STATUSES = [
  { key: 'all', label: 'All Clients' },
  { key: 'booked', label: 'Booked', color: '#3b82f6' },
  { key: 'scheduled', label: 'Scheduled', color: '#8b5cf6' },
  { key: 'shoot completed', label: 'Shoot Completed', color: '#10b981' },
  { key: 'editing', label: 'Editing', color: '#f59e0b' },
  { key: 'delivered', label: 'Delivered', color: '#059669' },
  { key: 'closed', label: 'Closed', color: '#6b7280' },
  { key: 'cancelled', label: 'Cancelled', color: '#ef4444' },
];

// month names used in summary picker
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

type SortKey = 'id_asc' | 'id_desc' | 'date_desc' | 'date_asc' | 'name_asc';

export default function Clients() {
  const { width, height } = useWindowDimensions();
  const isTablet = width > 768;
  const { colors } = useThemeStore();
  const router = useRouter();
  const params = useLocalSearchParams();
  const autoEditClientId = params?.autoEditClientId ? parseInt(params.autoEditClientId as string) : null;

  // Data State
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0 });
  const [dbReady, setDbReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Summary filter state
  const [activeSummaryType, setActiveSummaryType] = useState<'today' | 'week' | 'month' | null>(null);
  const [summaryDates, setSummaryDates] = useState({
    today: new Date(),
    week: new Date(),
    month: new Date()
  });
  const [showSummaryPicker, setShowSummaryPicker] = useState<'today' | 'week' | 'month' | null>(null);
  const [tempMonth, setTempMonth] = useState(new Date().getMonth());
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [tempWeek, setTempWeek] = useState(1);
  const [selectedWeekMonthYear, setSelectedWeekMonthYear] = useState<{month:number;year:number}>({
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });

  // Custom Options State
  const [eventTypes, setEventTypes] = useState<AppOption[]>([]);
  const [leadSources, setLeadSources] = useState<AppOption[]>([]);
  const [availablePackages, setAvailablePackages] = useState<AppOption[]>([]);

  // UI State
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('id_asc');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isEventTypePickerVisible, setIsEventTypePickerVisible] = useState(false);
  const [isPackagePickerVisible, setIsPackagePickerVisible] = useState(false);
  const [isSourcePickerVisible, setIsSourcePickerVisible] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    event_type: '',
    event_date: format(new Date(), 'yyyy-MM-dd'),
    event_location: '',
    selectedPackages: [] as string[],
    total_price: '',
    lead_source: '',
    notes: '',
    status: 'booked'
  });

  const loadData = useCallback(async () => {
    try {
      const db = getDatabase();
      if (!db) {
        setDbReady(false);
        return;
      }
      setDbReady(true);
      setLoading(true);

      const result = await db.getAllAsync('SELECT * FROM clients ORDER BY id ASC');
      const allClients = result as Client[];
      setClients(allClients);

      // Calculate Stats
      let todayCount = 0;
      let weekCount = 0;
      let monthCount = 0;
      const today = new Date();

      allClients.forEach(client => {
        if (client.event_date) {
          try {
            const date = parseISO(client.event_date);
            if (isSameDay(date, today)) todayCount++;
            if (isSameWeek(date, today, { weekStartsOn: 1 })) weekCount++;
            if (isSameMonth(date, today)) monthCount++;
          } catch (e) {}
        }
      });

      setStats({
        today: todayCount,
        week: weekCount,
        month: monthCount
      });

    } catch (error) {
      console.error('Error loading clients:', error);
      if (error instanceof Error && error.message.includes('initialized')) {
        setDbReady(false);
        setTimeout(loadData, 500);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const onSummaryDatePickerChange = (event: any, date?: Date) => {
    console.log('onSummaryDatePickerChange called', { event, date });
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        setShowSummaryPicker(null);
        return;
      }
    }
    if (date) {
      console.log('Setting today filter with date:', date);
      setSummaryDates(prev => ({ ...prev, today: date }));
      // apply filter immediately after selecting
      setActiveSummaryType(null);
      // clear other UI filters (search/status)
      setSearchQuery('');
      setStatusFilter('all');
      setTimeout(() => {
        setActiveSummaryType('today');
        setShowSummaryPicker(null);
      }, 10);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-open edit form if navigated from lead conversion
  useEffect(() => {
    if (autoEditClientId && clients.length > 0) {
      const clientToEdit = clients.find(c => c.id === autoEditClientId);
      if (clientToEdit) {
        handleEdit(clientToEdit);
      }
    }
  }, [autoEditClientId, clients]);

  const processedClients = useMemo(() => {
    let result = [...clients];

    // apply summary filter first if active
    if (activeSummaryType) {
      result = result.filter(c => {
        if (!c.event_date) return false;
        try {
          const d = parseISO(c.event_date);
          switch (activeSummaryType) {
            case 'today': return isSameDay(d, summaryDates.today);
            case 'week': return isSameWeek(d, summaryDates.week, { weekStartsOn: 1 });
            case 'month': return isSameMonth(d, summaryDates.month);
          }
        } catch {
          return false;
        }
        return true;
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        (c.client_id && c.client_id.toLowerCase().includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.event_location && c.event_location.toLowerCase().includes(query))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(c => (c.status || 'booked').toLowerCase() === statusFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'id_asc': return a.id - b.id;
        case 'id_desc': return b.id - a.id;
        case 'date_desc': return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
        case 'date_asc': return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        case 'name_asc': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    // sequencing is handled by FlatList index when rendering; we keep db ids untouched
    return result;
  }, [clients, searchQuery, statusFilter, sortBy, activeSummaryType, summaryDates]);

  const displayStats = useMemo(() => {
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    const today = new Date();

    processedClients.forEach(client => {
      if (client.event_date) {
        try {
          const date = parseISO(client.event_date);
          if (isSameDay(date, today)) todayCount++;
          if (isSameWeek(date, today, { weekStartsOn: 1 })) weekCount++;
          if (isSameMonth(date, today)) monthCount++;
        } catch (e) {}
      }
    });

    return {
      today: todayCount,
      week: weekCount,
      month: monthCount
    };
  }, [processedClients]);

  const handleSaveClient = async () => {
    if (!formData.name || !formData.phone) {
      Alert.alert('Error', 'Please fill in name and phone');
      return;
    }

    try {
      const db = getDatabase();
      const pkgString = formData.selectedPackages.join(', ');
      const totalPrice = parseFloat(formData.total_price) || 0;

      if (editingClientId) {
        await db.runAsync(
          'UPDATE clients SET name=?, phone=?, email=?, event_type=?, event_date=?, event_location=?, package_name=?, total_price=?, lead_source=?, notes=?, status=? WHERE id=?',
          [formData.name, formData.phone, formData.email, formData.event_type, formData.event_date, formData.event_location, pkgString, totalPrice, formData.lead_source, formData.notes, formData.status, editingClientId]
        );
      } else {
        await db.runAsync(
          'INSERT INTO clients (name, phone, email, event_type, event_date, event_location, package_name, total_price, lead_source, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [formData.name, formData.phone, formData.email, formData.event_type, formData.event_date, formData.event_location, pkgString, totalPrice, formData.lead_source, formData.notes, formData.status]
        );
      }
      
      setModalVisible(false);
      resetForm();
      loadData();
      Alert.alert('Success', `Client ${editingClientId ? 'updated' : 'added'} successfully`);
    } catch (error) {
      console.error('Error saving client:', error);
      Alert.alert('Error', 'Failed to save client');
    }
  };

  const handleEdit = (client: Client) => {
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      event_type: client.event_type || '',
      event_date: client.event_date,
      event_location: client.event_location || '',
      selectedPackages: client.package_name ? client.package_name.split(', ') : [],
      total_price: client.total_price?.toString() || '0',
      lead_source: client.lead_source || '',
      notes: client.notes || '',
      status: client.status || 'booked'
    });
    setEditingClientId(client.id);
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Client', 'Are you sure you want to delete this client?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = getDatabase();
            await db.runAsync('DELETE FROM clients WHERE id = ?', [id]);
            loadData();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete client');
          }
        }
      }
    ]);
  };

  const handleRestore = (client: Client) => {
    Alert.alert('Restore Lead', 'Copy this client back to leads?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore', onPress: async () => {
          try {
            const db = getDatabase();
            if (!db) return;

            // attempt to find an existing lead by phone (unique key)
            const existing: any[] = await db.getAllAsync('SELECT id FROM leads WHERE phone = ? LIMIT 1', [client.phone]);
            if (existing.length > 0) {
              const lid = existing[0].id;
              await db.runAsync(
                'UPDATE leads SET name=?, email=?, company_name=?, event_type=?, event_date=?, source=?, stage=?, notes=? WHERE id=?',
                [
                  client.name,
                  client.email || null,
                  client.event_location || null, // restore company name from location
                  client.event_type || null,
                  client.event_date || null,
                  client.lead_source || null,
                  'new',
                  client.notes || null,
                  lid
                ]
              );
            } else {
              await db.runAsync(
                'INSERT INTO leads (name, phone, email, company_name, event_type, event_date, source, stage, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                  client.name,
                  client.phone,
                  client.email || null,
                  client.event_location || null,
                  client.event_type || null,
                  client.event_date || null,
                  client.lead_source || null,
                  'new',
                  client.notes || null
                ]
              );
            }
            // delete client record after restoring
            await db.runAsync('DELETE FROM clients WHERE id = ?', [client.id]);

            Alert.alert('Success', 'Client restored to leads');
            loadData();
          } catch (e) {
            console.error('Restore failed', e);
            Alert.alert('Error', 'Failed to restore lead');
          }
        }}
    ]);
  };
  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      event_type: '',
      event_date: format(new Date(), 'yyyy-MM-dd'),
      event_location: '',
      selectedPackages: [],
      total_price: '',
      lead_source: '',
      notes: '',
      status: 'booked'
    });
    setEditingClientId(null);
  };

  const resetSummarySelection = () => {
    const now = new Date();
    setSearchQuery('');
    setStatusFilter('all');
    setSummaryDates({
      today: now,
      week: now,
      month: now
    });
    setSelectedWeekMonthYear({ month: now.getMonth(), year: now.getFullYear() });
    setTempMonth(now.getMonth());
    setTempYear(now.getFullYear());
    setTempWeek(1);
    // Reload data to recalculate stats with today's dates
    loadData();
    // Apply 'today' filter after reset
    setTimeout(() => setActiveSummaryType('today'), 50);
  };

  const togglePackage = (pkg: string) => {
    setFormData(prev => {
      const selected = prev.selectedPackages.includes(pkg)
        ? prev.selectedPackages.filter(p => p !== pkg)
        : [...prev.selectedPackages, pkg];
      return { ...prev, selectedPackages: selected };
    });
  };

  const getStatusColor = (status: string) => {
    return CLIENT_STATUSES.find(s => s.key === (status || 'booked').toLowerCase())?.color || colors.textTertiary;
  };

  const DetailRow = ({ label, value, icon }: { label: string, value: string | undefined, icon: any }) => (
    <View style={styles.detailRow}>
      <View style={[styles.detailIconContainer, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.detailTextContainer}>
        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.text }]}>{value || '-'}</Text>
      </View>
    </View>
  );

const SummaryCard = ({ title, count, icon, gradient, type }: any) => {
    const isActive = activeSummaryType === type;

    const getDateDisplay = () => {
      const today = new Date();
      switch (type) {
        case 'today':
          return format(today, 'MMM dd, yyyy');
        case 'week':
          const weekStart = startOfWeek(today, { weekStartsOn: 1 });
          const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
          return `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`;
        case 'month':
          return format(today, 'MMMM yyyy');
        default:
          return '';
      }
    };

    const handleConfigPress = (e?: any) => {
      console.log('handleConfigPress called for type:', type);
      if (e && e.stopPropagation) e.stopPropagation();
      if (type === 'month') {
        setTempMonth(summaryDates.month.getMonth());
        setTempYear(summaryDates.month.getFullYear());
      } else if (type === 'week') {
        setTempMonth(selectedWeekMonthYear.month);
        setTempYear(selectedWeekMonthYear.year);
        const monthStart = startOfWeek(new Date(selectedWeekMonthYear.year, selectedWeekMonthYear.month, 1), { weekStartsOn: 1 });
        const idx = differenceInCalendarWeeks(summaryDates.week, monthStart, { weekStartsOn: 1 }) + 1;
        setTempWeek(idx > 0 ? idx : 1);
      }
      console.log('Setting showSummaryPicker to:', type);
      setShowSummaryPicker(type);
    };

    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.summaryCard,
          { height: isTablet ? 100 : 80 },
          isActive && { borderWidth: 2, borderColor: '#fff' }
        ]}
      >
        <TouchableOpacity
          style={styles.summaryContent}
          activeOpacity={0.8}
          onPress={() => {
            console.log('Card pressed for type:', type);
            const newType = activeSummaryType === type ? null : type;
            console.log('Toggling activeSummaryType to:', newType);
            setActiveSummaryType(newType);
            setSearchQuery('');
            setStatusFilter('all');
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryCount, { fontSize: isTablet ? 24 : 20 }]}>{count}</Text>
            <Text style={[styles.summaryTitle, { fontSize: isTablet ? 14 : 12 }]}>{title}</Text>
            {isActive && (
              <Text style={[styles.summarySubtitle, { fontSize: isTablet ? 11 : 9 }]}>{getDateDisplay()}</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleConfigPress(e);
            }}
            style={[styles.summaryIconContainer, { width: isTablet ? 44 : 36, height: isTablet ? 44 : 36 }]}
            activeOpacity={0.7}
          >
            <Ionicons name={icon} size={isTablet ? 28 : 24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </LinearGradient>
    );
  };

  const TableHeader = () => (
    <View style={[styles.tableHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.columnHeader, styles.colId, { color: colors.textSecondary }]}>ID</Text>
      <Text style={[styles.columnHeader, styles.colActions, { color: colors.textSecondary }]}>ACTIONS</Text>
      <Text style={[styles.columnHeader, styles.colDate, { color: colors.textSecondary }]}>EVENT DATE</Text>
      <Text style={[styles.columnHeader, styles.colName, { color: colors.textSecondary }]}>NAME</Text>
      <Text style={[styles.columnHeader, styles.colPhone, { color: colors.textSecondary }]}>PHONE</Text>
      <Text style={[styles.columnHeader, styles.colEvent, { color: colors.textSecondary }]}>EVENT TYPE</Text>
      <Text style={[styles.columnHeader, styles.colLocation, { color: colors.textSecondary }]}>LOCATION</Text>
      <Text style={[styles.columnHeader, styles.colPackage, { color: colors.textSecondary }]}>PACKAGES</Text>
      <Text style={[styles.columnHeader, styles.colPrice, { color: colors.textSecondary }]}>TOTAL</Text>
      <Text style={[styles.columnHeader, styles.colSource, { color: colors.textSecondary }]}>SOURCE</Text>
      <Text style={[styles.columnHeader, styles.colNotes, { color: colors.textSecondary }]}>NOTES</Text>
      <Text style={[styles.columnHeader, styles.colStatus, { color: colors.textSecondary }]}>STATUS</Text>
    </View>
  );

  const renderClientRow = ({ item: client, index }: { item: Client; index: number }) => (
    <View key={client.id} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.colId, { color: colors.primary, fontWeight: '700' }]} numberOfLines={1}>{index + 1}</Text>
      <View style={[styles.colActions, styles.rowActions]}>
        <TouchableOpacity onPress={() => handleRestore(client)} style={styles.actionBtn}>
          <Ionicons name="arrow-back-outline" size={20} color={colors.success} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setSelectedClientForDetail(client); setIsDetailModalVisible(true); }} style={styles.actionBtn}>
          <Ionicons name="eye-outline" size={20} color={colors.info} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleEdit(client)} style={styles.actionBtn}>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(client.id)} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.colDate, { color: colors.textSecondary }]} numberOfLines={1}>{client.event_date}</Text>
      <Text style={[styles.colName, styles.clientName, { color: colors.text }]} numberOfLines={1}>{client.name}</Text>
      <Text style={[styles.colPhone, { color: colors.textSecondary }]} numberOfLines={1}>{client.phone}</Text>
      <Text style={[styles.colEvent, { color: colors.textSecondary }]} numberOfLines={1}>{client.event_type || '-'}</Text>
      <Text style={[styles.colLocation, { color: colors.textSecondary }]} numberOfLines={1}>{client.event_location || '-'}</Text>
      <Text style={[styles.colPackage, { color: colors.textSecondary }]} numberOfLines={1}>{client.package_name || '-'}</Text>
      <Text style={[styles.colPrice, { color: colors.textSecondary }]}>₹{(client.total_price || 0).toLocaleString()}</Text>
      <Text style={[styles.colSource, { color: colors.textSecondary }]} numberOfLines={1}>{client.lead_source || '-'}</Text>
      <Text style={[styles.colNotes, { color: colors.textSecondary }]} numberOfLines={1}>{client.notes || '-'}</Text>
      <View style={[styles.colStatus, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(client.status) + '20', borderColor: getStatusColor(client.status) }]}>
          <Text style={[styles.statusText, { color: getStatusColor(client.status) }]}>{client.status || 'Booked'}</Text>
        </View>
      </View>
    </View>
  );

  const SortOption = ({ label, value, icon }: { label: string, value: SortKey, icon: string }) => (
    <TouchableOpacity
      style={[styles.sortOption, { backgroundColor: sortBy === value ? colors.primary + '15' : 'transparent' }]}
      onPress={() => { setSortBy(value); setIsSortModalVisible(false); }}
    >
      <View style={styles.sortOptionLeft}>
        <Ionicons name={icon as any} size={20} color={sortBy === value ? colors.primary : colors.textSecondary} />
        <Text style={[styles.sortOptionLabel, { color: sortBy === value ? colors.primary : colors.text }]}>{label}</Text>
      </View>
      {sortBy === value && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
    </TouchableOpacity>
  );

  if (!dbReady || (loading && clients.length === 0)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Connecting to database...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <SummaryCard type="today" title="Today" count={displayStats.today} icon="today-outline" gradient={['#3b82f6', '#2563eb']} />
        <SummaryCard type="week" title="This Week" count={displayStats.week} icon="calendar-outline" gradient={['#8b5cf6', '#7c3aed']} />
        <SummaryCard type="month" title="This Month" count={displayStats.month} icon="pie-chart-outline" gradient={['#ec4899', '#db2777']} />
      </View>

      {/* Filter and Search Bar */}
      <View style={styles.filterBar}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search clients (ID, Name, Phone)..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {(activeSummaryType !== null || searchQuery) && (
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.surface }]}
            onPress={resetSummarySelection}
            title="Reset filters"
          >
            <Ionicons name="refresh-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.surface }]}
          onPress={() => setIsSortModalVisible(true)}
        >
          <Ionicons name="swap-vertical" size={20} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { resetForm(); setModalVisible(true); }}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addBtnText}>Add Client</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Status Filter */}
      <View style={styles.statusFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusFilterScroll}>
          {CLIENT_STATUSES.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: statusFilter === s.key ? (s.color || colors.primary) : colors.surface,
                  borderColor: statusFilter === s.key ? (s.color || colors.primary) : colors.border
                }
              ]}
              onPress={() => setStatusFilter(s.key)}
            >
              <Text style={[styles.filterChipText, { color: statusFilter === s.key ? '#fff' : colors.textSecondary }]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Table View */}
      <View style={[styles.tableContainer, { backgroundColor: colors.surface }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            <TableHeader />
            <FlatList
              data={processedClients}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderClientRow}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={colors.textTertiary} style={{ marginBottom: 12 }} />
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No clients found</Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          </View>
        </ScrollView>
      </View>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{editingClientId ? 'Edit Client' : 'Add New Client'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                    placeholder="Enter client name"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Phone *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                    value={formData.phone}
                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                    placeholder="Enter email"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Event Date</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                    value={formData.event_date}
                    onChangeText={(text) => setFormData({ ...formData, event_date: text })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Event Location</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                    value={formData.event_location}
                    onChangeText={(text) => setFormData({ ...formData, event_location: text })}
                    placeholder="Enter venue or city"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Event Type</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => setIsEventTypePickerVisible(true)}
                  >
                    <Text style={{ color: formData.event_type ? colors.text : colors.textTertiary }}>
                      {formData.event_type || 'Select event type'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Packages (Select Multiple)</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => setIsPackagePickerVisible(true)}
                  >
                    <Text style={{ color: formData.selectedPackages.length > 0 ? colors.text : colors.textTertiary }} numberOfLines={1}>
                      {formData.selectedPackages.length > 0 ? formData.selectedPackages.join(', ') : 'Select packages'}
                    </Text>
                    <Ionicons name="list-outline" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Total Price</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                    value={formData.total_price}
                    onChangeText={(text) => setFormData({ ...formData, total_price: text })}
                    placeholder="₹ 0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Lead Source</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => setIsSourcePickerVisible(true)}
                  >
                    <Text style={{ color: formData.lead_source ? colors.text : colors.textTertiary }}>
                      {formData.lead_source || 'Select source'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text }]}
                    value={formData.notes}
                    onChangeText={(text) => setFormData({ ...formData, notes: text })}
                    placeholder="Add client requirements or details..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
                  <View style={styles.statusPicker}>
                    {CLIENT_STATUSES.filter(s => s.key !== 'all').map((s) => (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.statusChip, { backgroundColor: formData.status === s.key ? s.color : colors.background, borderColor: s.color }]}
                        onPress={() => setFormData({ ...formData, status: s.key })}
                      >
                        <Text style={[styles.statusChipText, { color: formData.status === s.key ? '#fff' : s.color }]}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={handleSaveClient}
                >
                  <Text style={styles.submitButtonText}>{editingClientId ? 'Update Client' : 'Add Client'}</Text>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Client Detail Modal */}
      <Modal visible={isDetailModalVisible} animationType="fade" transparent={true} onRequestClose={() => setIsDetailModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsDetailModalVisible(false)}>
          <View style={[styles.modalContainer, { width: '90%' }]}> 
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}> 
              <View style={styles.modalHeader}> 
                <View> 
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Client Details</Text> 
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{selectedClientForDetail?.client_id}</Text> 
                </View> 
                <TouchableOpacity onPress={() => setIsDetailModalVisible(false)}> 
                  <Ionicons name="close" size={28} color={colors.textSecondary} /> 
                </TouchableOpacity> 
              </View> 
              <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}> 
                <DetailRow label="Name" value={selectedClientForDetail?.name} icon="person-outline" /> 
                <DetailRow label="Phone" value={selectedClientForDetail?.phone} icon="call-outline" /> 
                <DetailRow label="Email" value={selectedClientForDetail?.email} icon="mail-outline" /> 
                <DetailRow label="Event Type" value={selectedClientForDetail?.event_type} icon="calendar-outline" /> 
                <DetailRow label="Event Date" value={selectedClientForDetail?.event_date} icon="calendar-outline" /> 
                <DetailRow label="Location" value={selectedClientForDetail?.event_location} icon="location-outline" /> 
                <DetailRow label="Package" value={selectedClientForDetail?.package_name} icon="bag-outline" /> 
                <DetailRow label="Total Price" value={selectedClientForDetail?.total_price ? `₹${selectedClientForDetail.total_price.toLocaleString()}` : undefined} icon="cash-outline" /> 
                <DetailRow label="Lead Source" value={selectedClientForDetail?.lead_source} icon="share-social-outline" /> 
                <DetailRow label="Status" value={selectedClientForDetail?.status} icon="checkmark-done-outline" /> 
                <DetailRow label="Notes" value={selectedClientForDetail?.notes} icon="document-text-outline" /> 
                <TouchableOpacity 
                  style={[styles.submitButton, { backgroundColor: colors.primary, width: '100%', marginBottom: 10 }]} 
                  onPress={() => {
                    if (selectedClientForDetail) {
                      setIsDetailModalVisible(false);
                      handleEdit(selectedClientForDetail);
                    }
                  }}
                >
                  <Text style={styles.submitButtonText}>Edit Client</Text>
                </TouchableOpacity>
              </ScrollView> 
            </View> 
          </View> 
        </TouchableOpacity>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={isSortModalVisible} transparent animationType="fade" onRequestClose={() => setIsSortModalVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsSortModalVisible(false)}>
          <View style={[styles.sortModalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.sortModalHeader}><Text style={[styles.sortModalTitle, { color: colors.text }]}>Sort Clients</Text></View>
            <View style={{ padding: 8 }}>
              <SortOption label="ID: Oldest First" value="id_asc" icon="barcode-outline" />
              <SortOption label="ID: Newest First" value="id_desc" icon="barcode-outline" />
              <SortOption label="Date: Newest First" value="date_desc" icon="calendar" />
              <SortOption label="Date: Oldest First" value="date_asc" icon="calendar-outline" />
              <SortOption label="Name: A to Z" value="name_asc" icon="text-outline" />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Summary Filter Custom Pickers */}
      {showSummaryPicker === 'today' ? (
        <DateTimePicker
          value={summaryDates.today}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onSummaryDatePickerChange}
        />
      ) : (
        <Modal visible={showSummaryPicker !== null} transparent animationType="fade" onRequestClose={() => setShowSummaryPicker(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '85%' }]}> 
              <View style={styles.modalHeader}> 
                <Text style={[styles.modalTitle, { color: colors.text }]}> 
                  {showSummaryPicker === 'month' ? 'Select Month & Year' : 'Select Month & Week'} 
                </Text> 
                <TouchableOpacity onPress={() => setShowSummaryPicker(null)}> 
                  <Ionicons name="close" size={24} color={colors.textSecondary} /> 
                </TouchableOpacity> 
              </View> 

              {showSummaryPicker === 'month' ? (
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                  <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Select Month</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                    {MONTHS.map((m, i) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: tempMonth === i ? colors.primary : colors.background,
                            borderColor: tempMonth === i ? colors.primary : colors.border,
                            width: '23%',
                            height: 40,
                            paddingHorizontal: 0,
                            justifyContent: 'center',
                            alignItems: 'center'
                          }
                        ]}
                        onPress={() => setTempMonth(i)}
                      >
                        <Text style={{ color: tempMonth === i ? '#fff' : colors.textSecondary }}>{m.slice(0,3)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Select Year</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <TouchableOpacity onPress={() => setTempYear(prev => prev - 1)}><Ionicons name="chevron-back" size={24} color={colors.textSecondary} /></TouchableOpacity>
                    <Text style={{ color: colors.text, fontSize: 18 }}>{tempYear}</Text>
                    <TouchableOpacity onPress={() => setTempYear(prev => prev + 1)}><Ionicons name="chevron-forward" size={24} color={colors.textSecondary} /></TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: colors.primary, height: 52 }]}
                    onPress={() => {
                      console.log('Month apply pressed:', { tempMonth, tempYear });
                      // apply month filter
                      setSummaryDates(prev => ({ ...prev, month: new Date(tempYear, tempMonth, 1) }));
                      setActiveSummaryType(null);
                      setSearchQuery('');
                      setStatusFilter('all');
                      setTimeout(() => {
                        setActiveSummaryType('month');
                        setShowSummaryPicker(null);
                      }, 10);
                    }}
                  >
                    <Text style={styles.submitButtonText}>Apply</Text>
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                  <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Select Month</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                    {MONTHS.map((m, i) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: tempMonth === i ? colors.primary : colors.background,
                            borderColor: tempMonth === i ? colors.primary : colors.border,
                            width: '23%',
                            height: 40,
                            paddingHorizontal: 0,
                            justifyContent: 'center',
                            alignItems: 'center'
                          }
                        ]}
                        onPress={() => {
                          setTempMonth(i);
                          setTempWeek(1);
                        }}
                      >
                        <Text style={{ color: tempMonth === i ? '#fff' : colors.textSecondary }}>{m.slice(0,3)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Select Week</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                    {Array.from({ length: getWeeksInMonthCount(tempMonth, tempYear) }, (_, i) => i + 1).map((w) => (
                      <TouchableOpacity
                        key={w}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: tempWeek === w ? colors.primary : colors.background,
                            borderColor: tempWeek === w ? colors.primary : colors.border,
                            paddingHorizontal: 12,
                            height: 40,
                            justifyContent: 'center',
                            alignItems: 'center'
                          }
                        ]}
                        onPress={() => setTempWeek(w)}
                      >
                        <Text style={{ color: tempWeek === w ? '#fff' : colors.textSecondary }}>{w}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: colors.primary, height: 52 }]}
                    onPress={() => {
                      console.log('Week apply pressed:', { tempMonth, tempYear, tempWeek });
                      // compute the chosen week start date
                      const monthStart = startOfWeek(new Date(tempYear, tempMonth, 1), { weekStartsOn: 1 });
                      const weekDate = addWeeks(monthStart, tempWeek - 1);
                      setSummaryDates(prev => ({ ...prev, week: weekDate }));
                      setSelectedWeekMonthYear({ month: tempMonth, year: tempYear });
                      setActiveSummaryType(null);
                      setSearchQuery('');
                      setStatusFilter('all');
                      setTimeout(() => {
                        setActiveSummaryType('week');
                        setShowSummaryPicker(null);
                      }, 10);
                    }}
                  >
                    <Text style={styles.submitButtonText}>Apply</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Event Type Picker Modal */}
      <Modal visible={isEventTypePickerVisible} transparent={true} animationType="fade" onRequestClose={() => setIsEventTypePickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsEventTypePickerVisible(false)}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '85%' }]}>
            <View style={styles.pickerHeader}><Text style={[styles.pickerTitle, { color: colors.text }]}>Select Event Type</Text></View>
            <FlatList data={eventTypes} keyExtractor={(item) => item.id.toString()} renderItem={({ item }) => (
              <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => { setFormData({ ...formData, event_type: item.label }); setIsEventTypePickerVisible(false); }}>
                <Text style={[styles.pickerItemText, { color: colors.text }]}>{item.label}</Text>
                {formData.event_type === item.label && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Package Multi-Picker Modal */}
      <Modal visible={isPackagePickerVisible} transparent={true} animationType="fade" onRequestClose={() => setIsPackagePickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsPackagePickerVisible(false)}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '85%' }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Packages</Text>
              <TouchableOpacity onPress={() => setIsPackagePickerVisible(false)}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>DONE</Text>
              </TouchableOpacity>
            </View>
            <FlatList data={availablePackages} keyExtractor={(item) => item.id.toString()} renderItem={({ item }) => (
              <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => togglePackage(item.label)}>
                <Text style={[styles.pickerItemText, { color: colors.text }]}>{item.label}</Text>
                <Ionicons name={formData.selectedPackages.includes(item.label) ? "checkbox" : "square-outline"} size={22} color={colors.primary} />
              </TouchableOpacity>
            )} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Lead Source Picker Modal */}
      <Modal visible={isSourcePickerVisible} transparent={true} animationType="fade" onRequestClose={() => setIsSourcePickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsSourcePickerVisible(false)}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '85%' }]}>
            <View style={styles.pickerHeader}><Text style={[styles.pickerTitle, { color: colors.text }]}>Select Lead Source</Text></View>
            <FlatList data={leadSources} keyExtractor={(item) => item.id.toString()} renderItem={({ item }) => (
              <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => { setFormData({ ...formData, lead_source: item.label }); setIsSourcePickerVisible(false); }}>
                <Text style={[styles.pickerItemText, { color: colors.text }]}>{item.label}</Text>
                {formData.lead_source === item.label && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )} />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryContainer: { flexDirection: 'row', padding: 16, gap: 12, justifyContent: 'space-between' },
  summaryCard: { flex: 1, borderRadius: 16, padding: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  summaryContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryCount: { color: '#fff', fontWeight: '800' },
  summaryTitle: { color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  summarySubtitle: { color: 'rgba(255,255,255,0.6)', fontWeight: '500', marginTop: 2 },
  summaryIconContainer: { borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  filterBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12, alignItems: 'center' },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderRadius: 16, height: 48 },
  searchInput: { flex: 1, paddingHorizontal: 8, fontSize: 16 },
  iconButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 12, borderRadius: 16, elevation: 2 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  statusFilterContainer: { marginBottom: 16 },
  statusFilterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: '700' },

  tableContainer: { flex: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, gap: 12 },
  columnHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  tableRow: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, alignItems: 'center', gap: 12 },

  colId: { width: 70, textAlign: 'center' },
  colActions: { width: 100, alignItems: 'center', justifyContent: 'center' },
  colDate: { width: 100, textAlign: 'center' },
  colName: { width: 150, textAlign: 'center' },
  colPhone: { width: 120, textAlign: 'center' },
  colEmail: { width: 150, textAlign: 'center' },
  colEvent: { width: 100, textAlign: 'center' },
  colLocation: { width: 130, textAlign: 'center' },
  colPackage: { width: 150, textAlign: 'center' },
  colPrice: { width: 100, textAlign: 'center' },
  colSource: { width: 120, textAlign: 'center' },
  colNotes: { width: 150, textAlign: 'center' },
  colStatus: { width: 90, textAlign: 'center' },

  rowActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  actionBtn: { padding: 4 },
  clientName: { fontSize: 15, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  emptyContainer: { padding: 80, alignItems: 'center', width: Dimensions.get('window').width },
  emptyText: { fontSize: 16, fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '95%', maxHeight: '90%' },
  modalContent: { borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  modalTitle: { fontSize: 22, fontWeight: '700' },
  formContainer: { padding: 20 },
  inputGroup: { marginBottom: 20 },
  inputRow: { flexDirection: 'row' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { padding: 16, borderRadius: 12, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  submitButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 24 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  statusPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, borderWidth: 1.5 },
  statusChipText: { fontSize: 14, fontWeight: '800' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  pickerContainer: { maxHeight: '60%', borderRadius: 24, overflow: 'hidden' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  pickerTitle: { fontSize: 18, fontWeight: '700' },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 16 },

  sortModalContainer: { width: '85%', borderRadius: 24, overflow: 'hidden', paddingBottom: 12 },
  sortModalHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  sortModalTitle: { fontSize: 18, fontWeight: '700' },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16 },
  sortOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sortOptionLabel: { fontSize: 16, fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 15 },
  detailIconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  detailTextContainer: { flex: 1 },
  detailLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  detailValue: { fontSize: 16, fontWeight: '600' },
});
