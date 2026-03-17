import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import * as shootsService from '../src/api/services/shoots';
import * as clientsService from '../src/api/services/clients';
import * as appOptionsService from '../src/api/services/appOptions';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, startOfWeek, endOfWeek, isToday, isSameDay, isSameWeek, addDays, subDays, addWeeks, subWeeks, startOfDay, endOfDay, isWithinInterval, setHours, setMinutes } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';

interface Shoot {
  id: number;
  client_id: number;
  client_name?: string;
  event_type: string;
  shoot_date: string;
  start_time?: string;
  end_time?: string;
  location: string;
  status: string;
  notes: string;
}

interface AppOption {
  id: number;
  type: string;
  label: string;
  value: string;
}

const SHOOT_STATUSES_DEFAULTS = [
  { label: 'Scheduled', value: 'upcoming' },
  { label: 'Shoot Completed', value: 'completed' }
];

export default function Shoots() {
  const { colors } = useThemeStore();
  const { width: screenWidth } = useWindowDimensions();
  const params = useLocalSearchParams();
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [eventTypes, setEventTypes] = useState<AppOption[]>([]);
  const [shootStatuses, setShootStatuses] = useState<AppOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingShoot, setEditingShoot] = useState<Shoot | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [eventTypePickerVisible, setEventTypePickerVisible] = useState(false);
  const [addCategoryModalVisible, setAddCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Ref to track if navigation parameters have been processed
  const navigationParamsProcessed = useRef(false);

  // Date/Time Picker State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    event_type: '',
    shoot_date: new Date(),
    start_time: new Date(),
    end_time: null as Date | null,
    location: '',
    notes: '',
    status: 'upcoming'
  });

  const ADD_CATEGORY_ID = -999999;
  const eventTypesWithAdd = useMemo(
    () => [...eventTypes, { id: ADD_CATEGORY_ID, type: '__add__', label: '+ Add Category', value: '__add__' } as AppOption],
    [eventTypes]
  );

  const refreshEventTypes = useCallback(async () => {
    const latestOptions = await appOptionsService.getAll();
    setEventTypes(
      latestOptions
        .filter((option) => option.type === 'event_type')
        .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? ''))) as AppOption[]
    );
  }, []);

  const handleAddEventTypeCategory = async () => {
    const label = newCategoryName.trim();
    if (!label) {
      Alert.alert('Validation Error', 'Category name is required.');
      return;
    }

    try {
      setAddingCategory(true);
      const createdOrExisting = await appOptionsService.createIfNotExists('event_type', label);
      await refreshEventTypes();

      if (createdOrExisting) {
        setFormData((prev) => ({ ...prev, event_type: String(createdOrExisting.label ?? label) }));
      }

      setAddCategoryModalVisible(false);
      setEventTypePickerVisible(false);
      setNewCategoryName('');
    } catch (error) {
      console.error('Error adding event type category:', error);
      Alert.alert('Error', 'Failed to add category.');
    } finally {
      setAddingCategory(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Seed default shoot statuses if they don't exist
      const allOptions = await appOptionsService.getAll();
      const existingStatuses = allOptions.filter((option) => option.type === 'shoot_status');
      if (existingStatuses.length === 0) {
        for (const status of SHOOT_STATUSES_DEFAULTS) {
          await appOptionsService.create({ type: 'shoot_status', label: status.label, value: status.value });
        }
      }

      const [shootResult, clientResult, latestOptions] = await Promise.all([
        shootsService.getAll(),
        clientsService.getAll(),
        appOptionsService.getAll(),
      ]);

      const clientsById = new Map(clientResult.map((client: any) => [String(client.id), client]));
      const shootsWithClient = shootResult
        .map((shoot: any) => ({
          ...shoot,
          client_name: clientsById.get(String(shoot.client_id))?.name ?? '',
        }))
        .sort((a: any, b: any) => String(a.shoot_date ?? '').localeCompare(String(b.shoot_date ?? '')));

      setShoots(shootsWithClient as Shoot[]);
      setClients(
        [...clientResult].sort((a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
      );
      setEventTypes(
        latestOptions
          .filter((option) => option.type === 'event_type')
          .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? ''))) as AppOption[]
      );
      setShootStatuses(
        latestOptions
          .filter((option) => option.type === 'shoot_status')
          .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0)) as AppOption[]
      );
    } catch (error) {
      console.error('Error loading shoots data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-fill form from client navigation params
  useEffect(() => {
    // Check if navigation parameters have already been processed
    if (navigationParamsProcessed.current) {
      return;
    }

    // Handle autoEditShootId parameter for editing existing shoots
    if (params?.autoEditShootId && shoots.length > 0) {
      const shootId = parseInt(params.autoEditShootId as string);
      const shootToEdit = shoots.find(s => s.id === shootId);
      
      if (shootToEdit) {
        setEditingShoot(shootToEdit);
        setFormData({
          client_id: shootToEdit.client_id.toString(),
          client_name: shootToEdit.client_name || '',
          event_type: shootToEdit.event_type,
          shoot_date: parseISO(shootToEdit.shoot_date),
          start_time: new Date(), // Time parsing is complex, defaulting or simplified here
          end_time: shootToEdit.end_time ? new Date() : null,
          location: shootToEdit.location,
          notes: shootToEdit.notes,
          status: shootToEdit.status
        });
        setModalVisible(true);
        navigationParamsProcessed.current = true;
      }
    }
    // Handle autoFillClientId parameter for creating new shoots from clients
    else if (params?.autoFillClientId && clients.length > 0) {
      const clientId = params.autoFillClientId as string;
      const clientName = params.autoFillClientName as string || '';
      const eventType = params.autoFillEventType as string || '';
      const eventDate = params.autoFillEventDate as string || '';
      const location = params.autoFillLocation as string || '';

      // Only update form if we have valid data and modal is not already visible
      if (!modalVisible) {
        setFormData(prev => ({
          ...prev,
          client_id: clientId,
          client_name: clientName,
          event_type: eventType,
          shoot_date: eventDate ? parseISO(eventDate) : new Date(),
          start_time: new Date(),
          end_time: null,
          location: location,
          notes: '',
          status: 'upcoming'
        }));
        setModalVisible(true);
        navigationParamsProcessed.current = true;
      }
    }
  }, [params?.autoEditShootId, params?.autoFillClientId, params?.autoFillClientName, params?.autoFillEventType, params?.autoFillEventDate, params?.autoFillLocation, clients.length, shoots.length]);

  const stats = useMemo(() => {
    const total = shoots.length;
    const completed = shoots.filter(s => s.status === 'completed').length;
    const upcoming = shoots.filter(s => s.status === 'upcoming').length;
    return { total, completed, upcoming };
  }, [shoots]);

  const shootsByDate = useMemo(() => {
    const map: { [key: string]: Shoot[] } = {};
    shoots.forEach(shoot => {
      if (!map[shoot.shoot_date]) map[shoot.shoot_date] = [];
      map[shoot.shoot_date].push(shoot);
    });
    return map;
  }, [shoots]);

  const daysInGrid = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleOpenModal = (shoot?: Shoot) => {
    if (shoot) {
      setEditingShoot(shoot);
      setFormData({
        client_id: shoot.client_id.toString(),
        client_name: shoot.client_name || '',
        event_type: shoot.event_type,
        shoot_date: parseISO(shoot.shoot_date),
        start_time: new Date(), // Time parsing is complex, defaulting or simplified here
        end_time: shoot.end_time ? new Date() : null,
        location: shoot.location,
        notes: shoot.notes,
        status: shoot.status
      });
    } else {
      setEditingShoot(null);
      setFormData({
        client_id: '',
        client_name: '',
        event_type: '',
        shoot_date: new Date(),
        start_time: new Date(),
        end_time: null,
        location: '',
        notes: '',
        status: 'upcoming'
      });
    }
    setModalVisible(true);
  };

  const handleDeleteShoot = (id: number) => {
    Alert.alert(
      'Delete Shoot',
      'Are you sure you want to delete this shoot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await shootsService.delete(String(id));
              loadData();
              Alert.alert('Success', 'Shoot deleted successfully');
              // Close modal after deletion to prevent reappearing
              setModalVisible(false);
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to delete shoot');
            }
          }
        }
      ]
    );
  };

  const handleSaveShoot = async () => {
    if (!formData.client_id || !formData.shoot_date) {
      Alert.alert('Error', 'Please select a client and shoot date');
      return;
    }
    try {
      if (editingShoot) {
        await shootsService.update(String(editingShoot.id), {
          client_id: formData.client_id,
          event_type: formData.event_type,
          shoot_date: format(formData.shoot_date, 'yyyy-MM-dd'),
          start_time: format(formData.start_time, 'hh:mm a'),
          end_time: formData.end_time ? format(formData.end_time, 'hh:mm a') : '',
          location: formData.location,
          notes: formData.notes,
          status: formData.status,
        });
        Alert.alert('Success', 'Shoot updated successfully');
      } else {
        await shootsService.create({
          client_id: formData.client_id,
          event_type: formData.event_type,
          shoot_date: format(formData.shoot_date, 'yyyy-MM-dd'),
          start_time: format(formData.start_time, 'hh:mm a'),
          end_time: formData.end_time ? format(formData.end_time, 'hh:mm a') : '',
          location: formData.location,
          notes: formData.notes,
          status: formData.status,
        });
        Alert.alert('Success', 'Shoot scheduled successfully');
      }
      // Reset form state after successful save
      setFormData({
        client_id: '',
        client_name: '',
        event_type: '',
        shoot_date: new Date(),
        start_time: new Date(),
        end_time: null,
        location: '',
        notes: '',
        status: 'upcoming'
      });
      setEditingShoot(null);
      setModalVisible(false);
      loadData();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save shoot');
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'upcoming': return { color: colors.info, label: 'SCHEDULED', icon: 'time-outline' };
      case 'completed': return { color: colors.success, label: 'COMPLETED', icon: 'checkmark-circle-outline' };
      default: return { color: colors.textSecondary, label: status.toUpperCase(), icon: 'help-circle-outline' };
    }
  };

  const renderTableShootItem = ({ item }: { item: Shoot }) => {
    const statusInfo = getStatusInfo(item.status);
    const date = parseISO(item.shoot_date);

    return (
      <View style={[styles.premiumCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.cardAccent, { backgroundColor: statusInfo.color }]} />
        <View style={styles.cardMainContent}>
          <View style={styles.cardHeader}>
            <View style={styles.clientInfo}>
              <Text style={[styles.cardClientName, { color: colors.text }]}>{item.client_name}</Text>
              <View style={styles.cardEventTypeRow}>
                <Ionicons name="camera-outline" size={14} color={colors.primary} />
                <Text style={[styles.cardEventType, { color: colors.textSecondary }]}>{item.event_type || 'General Shoot'}</Text>
              </View>
            </View>
            <View style={styles.cardActionBtns}>
              <TouchableOpacity onPress={() => handleOpenModal(item)} style={styles.cardActionBtn}>
                <Ionicons name="pencil" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteShoot(item.id)} style={styles.cardActionBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

          <View style={styles.cardDetailsGrid}>
            <View style={styles.cardDetailItem}>
              <View style={[styles.iconBox, { backgroundColor: colors.background }]}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>DATE</Text>
                <Text style={[styles.cardDetailText, { color: colors.textSecondary }]}>
                  {format(date, 'MMM dd, yyyy')}
                </Text>
              </View>
            </View>
            <View style={styles.cardDetailItem}>
              <View style={[styles.iconBox, { backgroundColor: colors.background }]}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>TIME</Text>
                <Text style={[styles.cardDetailText, { color: colors.textSecondary }]}>
                  {item.start_time}{item.end_time ? ` - ${item.end_time}` : ''}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardFooter}>
            {item.location ? (
              <View style={styles.cardLocationRow}>
                <Ionicons name="location-outline" size={16} color={colors.textTertiary} />
                <Text numberOfLines={1} style={[styles.cardDetailText, { color: colors.textSecondary }]}>{item.location}</Text>
              </View>
            ) : <View />}
            <View style={[styles.cardStatusBadge, { backgroundColor: statusInfo.color + '15' }]}>
              <Ionicons name={statusInfo.icon as any} size={12} color={statusInfo.color} />
              <Text style={[styles.cardStatusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>

          {item.notes ? (
            <View style={[styles.cardNotesContainer, { backgroundColor: colors.background }]}>
              <Text numberOfLines={2} style={[styles.cardNotesText, { color: colors.textTertiary }]}>{item.notes}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const SummaryCards = () => (
    <View style={styles.statsContainer}>
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.statCard}>
        <Ionicons name="camera" size={24} color="#fff" />
        <Text style={styles.statNumber}>{stats.total}</Text>
        <Text style={styles.statLabelHeader}>Total Shoots</Text>
      </LinearGradient>

      <View style={[styles.statCard, { backgroundColor: colors.info + '15', borderWidth: 1, borderColor: colors.info + '30' }]}>
        <Ionicons name="calendar" size={24} color={colors.info} />
        <Text style={[styles.statNumber, { color: colors.text }]}>{stats.upcoming}</Text>
        <Text style={[styles.statLabelHeader, { color: colors.textSecondary }]}>Upcoming</Text>
      </View>

      <View style={[styles.statCard, { backgroundColor: colors.success + '15', borderWidth: 1, borderColor: colors.success + '30' }]}>
        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
        <Text style={[styles.statNumber, { color: colors.text }]}>{stats.completed}</Text>
        <Text style={[styles.statLabelHeader, { color: colors.textSecondary }]}>Completed</Text>
      </View>
    </View>
  );

  if (loading && shoots.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.contentArea}>
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
              style={[styles.navBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {format(currentMonth, 'MMMM yyyy').toUpperCase()}
            </Text>
            <TouchableOpacity
              onPress={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
              style={[styles.navBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.viewToggles, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setViewMode('calendar')}
              style={[styles.toggleBtn, viewMode === 'calendar' && { backgroundColor: colors.primary }]}
            >
              <Ionicons name="grid-outline" size={18} color={viewMode === 'calendar' ? '#fff' : colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('table')}
              style={[styles.toggleBtn, viewMode === 'table' && { backgroundColor: colors.primary }]}
            >
              <Ionicons name="list-outline" size={18} color={viewMode === 'table' ? '#fff' : colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === 'calendar' ? (
          <ScrollView style={styles.gridScroll} showsVerticalScrollIndicator={false}>
            <View style={[styles.gridHeader, { borderBottomColor: colors.border }]}>
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                <Text key={day} style={[styles.gridDayLabel, { color: colors.textTertiary }]}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {daysInGrid.map((day, index) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayShoots = shootsByDate[dateKey] || [];
                const isCurrent = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);

                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.7}
                    onPress={() => {
                      setFormData({...formData, shoot_date: day});
                      setEditingShoot(null);
                      setModalVisible(true);
                    }}
                    style={[
                      styles.gridCell,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      !isCurrent && { backgroundColor: colors.background, opacity: 0.4 },
                      isTodayDate && { borderColor: colors.primary, borderWidth: 1 }
                    ]}
                  >
                    <View style={styles.cellHeader}>
                      <View style={[styles.dayNumberCircle, isTodayDate && { backgroundColor: colors.primary }]}>
                        <Text style={[styles.dayNumber, { color: isTodayDate ? '#fff' : (isCurrent ? colors.text : colors.textTertiary) }]}>
                          {day.getDate()}
                        </Text>
                      </View>
                      {dayShoots.length > 0 && (
                        <View style={[styles.dayBadge, { backgroundColor: colors.success + '20' }]}>
                          <Text style={[styles.dayBadgeText, { color: colors.success }]}>
                            {Math.round((dayShoots.filter(s => s.status === 'completed').length / dayShoots.length) * 100)}%
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cellContent}>
                      {dayShoots.slice(0, 3).map(shoot => (
                        <View key={shoot.id} style={[styles.cellShootCard, { backgroundColor: colors.background }]}>
                          <View style={styles.cellShootHeader}>
                             <Ionicons
                                name={shoot.status === 'completed' ? "checkbox" : "square-outline"}
                                size={10}
                                color={shoot.status === 'completed' ? colors.success : colors.textTertiary}
                              />
                              <Text numberOfLines={1} style={[styles.cellShootTitle, { color: colors.text }]}>{shoot.client_name}</Text>
                          </View>
                          <Text numberOfLines={1} style={[styles.cellShootTime, { color: colors.textTertiary }]}>
                            {shoot.start_time && shoot.end_time 
                              ? `${shoot.start_time} - ${shoot.end_time}`
                              : shoot.start_time || 'Time not set'
                            }
                          </Text>
                        </View>
                      ))}
                      {dayShoots.length > 3 && (
                        <View style={styles.moreContainer}>
                          <Text style={[styles.moreText, { color: colors.primary }]}>+{dayShoots.length - 3} MORE</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.bottomSpacer} />
          </ScrollView>
        ) : (
          <FlatList
            data={shoots}
            renderItem={renderTableShootItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.tableListContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={SummaryCards}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="camera-outline" size={64} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No shoots scheduled yet</Text>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleOpenModal()}
                >
                  <Text style={styles.emptyBtnText}>Schedule Your First Shoot</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => handleOpenModal()}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
         <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{editingShoot ? 'Edit Shoot' : 'Schedule Shoot'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Select Client *</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => setClientPickerVisible(true)}
                  >
                    <Text style={{ color: formData.client_name ? colors.text : colors.textTertiary }}>
                      {formData.client_name || 'Select a client'}
                    </Text>
                    <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Shoot Date *</Text>
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={{ color: colors.text }}>{format(formData.shoot_date, 'MMM dd, yyyy')}</Text>
                      <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => setStatusPickerVisible(true)}
                    >
                      <Text style={{ color: colors.text }}>
                        {shootStatuses.find(o => o.value === formData.status)?.label || SHOOT_STATUSES_DEFAULTS.find(o => o.value === formData.status)?.label || 'Select Status'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Start Time</Text>
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => setShowStartTimePicker(true)}
                    >
                      <Text style={{ color: colors.text }}>{format(formData.start_time, 'hh:mm a')}</Text>
                      <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>End Time (Opt)</Text>
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => {
                        // Only set a default time if no end time is set yet
                        if (!formData.end_time) {
                          const defaultEndTime = new Date(formData.start_time);
                          defaultEndTime.setHours(defaultEndTime.getHours() + 1); // Default to 1 hour after start time
                          setFormData({...formData, end_time: defaultEndTime});
                        }
                        setShowEndTimePicker(true);
                      }}
                    >
                      <Text style={{ color: formData.end_time ? colors.text : colors.textTertiary }}>
                        {formData.end_time ? format(formData.end_time, 'hh:mm a') : '--:-- --'}
                      </Text>
                      <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Event Type</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => setEventTypePickerVisible(true)}
                  >
                    <Text style={{ color: formData.event_type ? colors.text : colors.textTertiary }}>
                      {formData.event_type || 'Select Event Type'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
                    value={formData.location}
                    onChangeText={(text) => setFormData({ ...formData, location: text })}
                    placeholder="Location"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, color: colors.text, minHeight: 80, textAlignVertical: 'top' }]}
                    value={formData.notes}
                    onChangeText={(text) => setFormData({ ...formData, notes: text })}
                    placeholder="Additional details..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={handleSaveShoot}
                >
                  <Text style={styles.submitButtonText}>{editingShoot ? 'Update Shoot' : 'Schedule Shoot'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {showDatePicker && <DateTimePicker value={formData.shoot_date} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(false); if(d) setFormData({...formData, shoot_date: d}); }} />}
      {showStartTimePicker && <DateTimePicker value={formData.start_time} mode="time" is24Hour={false} display="default" onChange={(e, d) => { setShowStartTimePicker(false); if(d) setFormData({...formData, start_time: d}); }} />}
      {showEndTimePicker && <DateTimePicker value={formData.end_time || new Date()} mode="time" is24Hour={false} display="default" onChange={(e, d) => { setShowEndTimePicker(false); if(d) setFormData({...formData, end_time: d}); }} />}

      <Modal visible={clientPickerVisible} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: colors.surface, maxHeight: '75%', width: '90%' }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Client</Text>
              <TouchableOpacity onPress={() => setClientPickerVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search clients..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <FlatList
              data={clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setFormData({ ...formData, client_id: item.id.toString(), client_name: item.name });
                    setClientPickerVisible(false);
                    setSearchQuery('');
                  }}
                >
                  <View>
                    <Text style={[styles.pickerText, { color: colors.text }]}>{item.name}</Text>
                    {item.email && <Text style={{ fontSize: 12, color: colors.textTertiary }}>{item.email}</Text>}
                  </View>
                  {formData.client_id === item.id.toString() && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={eventTypePickerVisible} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: colors.surface, maxHeight: '75%', width: '90%' }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Event Type</Text>
              <TouchableOpacity onPress={() => setEventTypePickerVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={eventTypesWithAdd}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    if (item.id === ADD_CATEGORY_ID) {
                      setNewCategoryName('');
                      setAddCategoryModalVisible(true);
                      return;
                    }
                    setFormData({ ...formData, event_type: item.label });
                    setEventTypePickerVisible(false);
                  }}
                >
                  <Text style={[styles.pickerText, { color: item.id === ADD_CATEGORY_ID ? colors.primary : colors.text }]}>{item.label}</Text>
                  {item.id !== ADD_CATEGORY_ID && formData.event_type === item.label && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={addCategoryModalVisible} transparent animationType="fade" onRequestClose={() => setAddCategoryModalVisible(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: colors.surface, width: '85%', maxHeight: '45%' }]}
          >
            <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Add Category</Text>
              <TouchableOpacity onPress={() => setAddCategoryModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
                placeholder="Category Name"
                placeholderTextColor={colors.textTertiary}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.navBtn, { flex: 1, borderColor: colors.border }]}
                  onPress={() => setAddCategoryModalVisible(false)}
                  disabled={addingCategory}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, { flex: 1, backgroundColor: colors.primary }]}
                  onPress={handleAddEventTypeCategory}
                  disabled={addingCategory}
                >
                  {addingCategory ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitButtonText}>Add</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={statusPickerVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setStatusPickerVisible(false)}>
          <View style={[styles.pickerContent, { backgroundColor: colors.surface, paddingBottom: 20 }]}>
            <Text style={[styles.pickerTitle, { color: colors.text, padding: 20, textAlign: 'center' }]}>Update Status</Text>
            {shootStatuses.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.pickerItem, { borderBottomColor: colors.border, paddingVertical: 18 }]}
                onPress={() => {
                  setFormData({ ...formData, status: option.value });
                  setStatusPickerVisible(false);
                }}
              >
                <Text style={[styles.pickerText, { color: colors.text }]}>{option.label}</Text>
                {formData.status === option.value && <Ionicons name="radio-button-on" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentArea: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  monthTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  viewToggles: { flexDirection: 'row', borderRadius: 12, padding: 4, borderWidth: 1 },
  toggleBtn: { width: 40, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  gridScroll: { flex: 1 },
  gridHeader: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1 },
  gridDayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '14.285%', minHeight: 130, borderWidth: 0.2, padding: 6 },
  cellHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayNumberCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dayNumber: { fontSize: 13, fontWeight: '700' },
  dayBadge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6 },
  dayBadgeText: { fontSize: 9, fontWeight: '800' },
  cellContent: { flex: 1 },
  cellShootCard: { padding: 4, borderRadius: 6, marginBottom: 4 },
  cellShootHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cellShootTitle: { fontSize: 9, fontWeight: '800', flex: 1 },
  cellShootTime: { fontSize: 8, fontWeight: '600', marginLeft: 14 },
  moreContainer: { alignItems: 'center', marginTop: 2 },
  moreText: { fontSize: 8, fontWeight: '900' },
  bottomSpacer: { height: 100 },

  // Stats Section
  statsContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, padding: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 4 },
  statNumber: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statLabelHeader: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.8)' },

  // Premium List Cards
  tableListContent: { padding: 20, paddingBottom: 100 },
  premiumCard: { borderRadius: 24, marginBottom: 16, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, overflow: 'hidden', flexDirection: 'row' },
  cardAccent: { width: 6 },
  cardMainContent: { flex: 1, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  clientInfo: { flex: 1 },
  cardClientName: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  cardEventTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardEventType: { fontSize: 13, fontWeight: '600' },
  cardActionBtns: { flexDirection: 'row', gap: 12 },
  cardActionBtn: { padding: 4 },
  cardDivider: { height: 1, marginVertical: 16 },
  cardDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  cardDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  detailLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  cardDetailText: { fontSize: 13, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  cardStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cardNotesContainer: { marginTop: 16, padding: 12, borderRadius: 12 },
  cardNotesText: { fontSize: 12, fontStyle: 'italic', lineHeight: 18 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16, textAlign: 'center', marginBottom: 24 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  fab: { position: 'absolute', bottom: 30, right: 30, width: 64, height: 64, borderRadius: 32, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
  fabGradient: { flex: 1, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '92%', maxHeight: '85%' },
  modalContent: { borderRadius: 32, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  formContainer: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  inputRow: { flexDirection: 'row', marginBottom: 0 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  input: { padding: 16, borderRadius: 16, fontSize: 15 },
  submitButton: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 12, marginBottom: 40 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  pickerContent: { width: '85%', borderRadius: 28, overflow: 'hidden' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 18, fontWeight: '800' },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  pickerText: { fontSize: 16, fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 16, paddingHorizontal: 16, borderRadius: 16 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 15 },
});
