import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { getDatabase } from '../src/database/db';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO, isToday, isThisWeek, isThisMonth, isSameDay, isSameWeek, isSameMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth, setMonth, setYear, setDate } from 'date-fns';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import XLSX from 'xlsx';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Lead {
  id: number;
  lead_id?: string;
  name: string;
  company_name?: string;
  phone: string;
  email: string;
  source: string;
  notes: string;
  event_date: string;
  next_follow_up?: string;
  created_at?: string;
}

interface AppOption {
  id: number;
  type: string;
  label: string;
}

type SortKey = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'id_desc' | 'id_asc';

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i);
const WEEKS = [1, 2, 3, 4, 5];

export default function Leads() {
  const { width } = useWindowDimensions();
  const isTablet = width > 768;
  const { colors } = useThemeStore();
  const router = useRouter();

  // Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSources, setLeadSources] = useState<AppOption[]>([]);
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0 });
  const [dbReady, setDbReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // UI State
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSourcePickerVisible, setIsSourcePickerVisible] = useState(false);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);

  // Summary Filter State
  const [summaryDates, setSummaryDates] = useState({
    today: new Date(),
    week: new Date(),
    month: new Date()
  });
  const [activeSummaryType, setActiveSummaryType] = useState<'today' | 'week' | 'month' | null>(null);
  const [showSummaryPicker, setShowSummaryPicker] = useState<'today' | 'week' | 'month' | null>(null);

  // Custom Picker States
  const [tempMonth, setTempMonth] = useState(new Date().getMonth());
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [tempWeek, setTempWeek] = useState(1);

  // Sort & Filter State
  const [sortBy, setSortBy] = useState<SortKey>('id_desc');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // Advanced Range Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    source: 'all',
    followUpStart: '',
    followUpEnd: '',
    nameStarts: ''
  });

  const [activePicker, setActivePicker] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    source: '',
    event_date: format(new Date(), 'yyyy-MM-dd'),
    next_follow_up: '',
    notes: ''
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

      const result = await db.getAllAsync('SELECT * FROM leads ORDER BY id DESC');
      const allLeads = result as Lead[];
      setLeads(allLeads);

      const sources = await db.getAllAsync("SELECT * FROM app_options WHERE type = 'lead_source' ORDER BY label ASC");
      setLeadSources(sources as AppOption[]);

      let todayCount = 0;
      let weekCount = 0;
      let monthCount = 0;

      allLeads.forEach(lead => {
        const dateStr = lead.next_follow_up;
        if (dateStr) {
          try {
            const date = parseISO(dateStr);
            if (isSameDay(date, summaryDates.today)) todayCount++;
            if (isSameWeek(date, summaryDates.week, { weekStartsOn: 1 })) weekCount++;
            if (isSameMonth(date, summaryDates.month)) monthCount++;
          } catch (e) {}
        }
      });

      setStats({ today: todayCount, week: weekCount, month: monthCount });

    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  }, [summaryDates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const processedLeads = useMemo(() => {
    let result = [...leads];

    // Summary Card Filters (Take precedence)
    if (activeSummaryType === 'today') {
      result = result.filter(l => {
        try { return l.next_follow_up && isSameDay(parseISO(l.next_follow_up), summaryDates.today); } catch { return false; }
      });
    } else if (activeSummaryType === 'week') {
      result = result.filter(l => {
        try { return l.next_follow_up && isSameWeek(parseISO(l.next_follow_up), summaryDates.week, { weekStartsOn: 1 }); } catch { return false; }
      });
    } else if (activeSummaryType === 'month') {
      result = result.filter(l => {
        try { return l.next_follow_up && isSameMonth(parseISO(l.next_follow_up), summaryDates.month); } catch { return false; }
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(query) ||
        l.phone.includes(query) ||
        (l.company_name && l.company_name.toLowerCase().includes(query)) ||
        (l.email && l.email.toLowerCase().includes(query))
      );
    }

    // Range-based Filters
    if (filters.startDate) {
      result = result.filter(l => l.event_date >= filters.startDate);
    }
    if (filters.endDate) {
      result = result.filter(l => l.event_date <= filters.endDate);
    }

    if (filters.source !== 'all') {
      result = result.filter(l => l.source === filters.source);
    }

    if (filters.followUpStart) {
      result = result.filter(l => l.next_follow_up && l.next_follow_up >= filters.followUpStart);
    }
    if (filters.followUpEnd) {
      result = result.filter(l => l.next_follow_up && l.next_follow_up <= filters.followUpEnd);
    }

    if (filters.nameStarts) {
      const prefix = filters.nameStarts.toLowerCase();
      result = result.filter(l => l.name.toLowerCase().startsWith(prefix));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc': return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
        case 'date_asc': return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'id_desc': return b.id - a.id;
        case 'id_asc': return a.id - b.id;
        default: return 0;
      }
    });

    return result;
  }, [leads, searchQuery, filters, sortBy, activeSummaryType, summaryDates]);

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleConvertToClient = async () => {
    if (selectedIds.size === 0) return;
    Alert.alert('Convert Leads', `Are you sure you want to convert ${selectedIds.size} leads to clients?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Convert', onPress: async () => {
          try {
            const db = getDatabase();
            if (!db) return;

            const selectedLeads = leads.filter(l => selectedIds.has(l.id));
            
            for (const lead of selectedLeads) {
              // Add to clients table
              await db.runAsync(
                `INSERT INTO clients (name, phone, email, lead_source, notes, status) 
                 VALUES (?, ?, ?, ?, ?, 'active')`,
                [lead.name, lead.phone, lead.email, lead.source, lead.notes]
              );
              // Remove from leads table
              await db.runAsync('DELETE FROM leads WHERE id = ?', [lead.id]);
            }

            Alert.alert('Success', `${selectedIds.size} leads converted to clients successfully`);
            setSelectedIds(new Set());
            loadData();
          } catch (error) {
            console.error('Failed to convert leads:', error);
            Alert.alert('Error', 'Failed to convert leads to clients');
          }
        }}
    ]);
  };

  const formatName = (text: string) => {
    let cleaned = text.replace(/[^a-zA-Z\s.-]/g, '');
    cleaned = cleaned.replace(/^[^a-zA-Z]+/, '');
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned.trim();
  };

  const formatCompanyName = (text: string) => {
    let cleaned = text.replace(/[^a-zA-Z0-9\s&.\-']/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned.trim();
  };

  const handleNameChange = (text: string) => {
    setFormData({ ...formData, name: text });
  };

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').trim();
    setFormData({ ...formData, phone: cleaned });
  };

  const handleEmailChange = (text: string) => {
    const cleaned = text.replace(/\s/g, '').toLowerCase();
    setFormData({ ...formData, email: cleaned });
  };

  const validateGmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return { valid: true, email: '' };
    if (!trimmed.endsWith('@gmail.com')) return { valid: false, message: 'Gmail must end with @gmail.com' };
    const username = trimmed.split('@')[0];
    if (username.length < 6 || username.length > 30) return { valid: false, message: 'Gmail username must be 6-30 chars' };
    if (!/^[a-z0-9.]+$/.test(username)) return { valid: false, message: 'Only letters, numbers, and periods allowed' };
    if (username.startsWith('.') || username.endsWith('.')) return { valid: false, message: 'Cannot start or end with a period' };
    if (username.includes('..')) return { valid: false, message: 'Cannot contain consecutive periods' };
    return { valid: true, email: trimmed };
  };

  const handleResetForm = () => {
    setFormData({
      name: '',
      company_name: '',
      phone: '',
      email: '',
      source: '',
      event_date: format(new Date(), 'yyyy-MM-dd'),
      next_follow_up: '',
      notes: ''
    });
  };

  const handleSaveLead = async (confirmDuplicate = false) => {
    const finalName = formatName(formData.name);
    const finalCompanyName = formatCompanyName(formData.company_name);
    const rawPhone = formData.phone.trim();
    const gmailResult = validateGmail(formData.email);

    if (!finalName) { Alert.alert('Warning', 'Name field cannot be empty'); return; }
    if (finalName.length < 2) { Alert.alert('Warning', 'Name must be at least 2 characters'); return; }

    if (!rawPhone) { Alert.alert('Warning', 'Phone number is mandatory'); return; }
    if (rawPhone.length !== 10) { Alert.alert('Warning', 'Phone number must be 10 digits'); return; }

    const normalizedPhone = `+91${rawPhone}`;
    if (!gmailResult.valid) { Alert.alert('Warning', gmailResult.message); return; }

    try {
      const db = getDatabase();
      if (!editingLeadId && !confirmDuplicate) {
        const existing: any = await db.getAllAsync('SELECT name FROM leads WHERE phone = ?', [normalizedPhone]);
        if (existing.length > 0) {
          Alert.alert('Duplicate', `A lead named "${existing[0].name}" exists. Add anyway?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Anyway', onPress: () => handleSaveLead(true) }
          ]);
          return;
        }
      }

      if (editingLeadId) {
        await db.runAsync(
          'UPDATE leads SET name=?, company_name=?, phone=?, email=?, source=?, event_date=?, next_follow_up=?, notes=? WHERE id=?',
          [finalName, finalCompanyName || null, normalizedPhone, gmailResult.email || null, formData.source, formData.event_date, formData.next_follow_up || null, formData.notes, editingLeadId]
        );
      } else {
        await db.runAsync(
          'INSERT INTO leads (name, company_name, phone, email, source, event_date, next_follow_up, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [finalName, finalCompanyName || null, normalizedPhone, gmailResult.email || null, formData.source, formData.event_date, formData.next_follow_up || null, formData.notes]
        );
      }
      setModalVisible(false);
      setEditingLeadId(null);
      loadData();
      Alert.alert('Success', `Lead ${editingLeadId ? 'updated' : 'added'} successfully`);
    } catch (error) { Alert.alert('Error', 'Failed to save lead'); }
  };

  const handleEdit = (lead: Lead) => {
    const editablePhone = lead.phone.startsWith('+91') ? lead.phone.slice(3) : lead.phone;
    setFormData({
      name: lead.name,
      company_name: lead.company_name || '',
      phone: editablePhone,
      email: lead.email || '',
      source: lead.source || '',
      event_date: lead.event_date || format(new Date(), 'yyyy-MM-dd'),
      next_follow_up: lead.next_follow_up || '',
      notes: lead.notes || ''
    });
    setEditingLeadId(lead.id);
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Lead', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const db = getDatabase();
            await db.runAsync('DELETE FROM leads WHERE id = ?', [id]);
            loadData();
          } catch (e) { Alert.alert('Error', 'Failed to delete'); }
        }}
    ]);
  };

  const handleImportExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'] });
      if (result.canceled) return;
      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
      const workbook = XLSX.read(fileContent, { type: 'base64' });
      const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      const db = getDatabase();
      let count = 0;
      for (const row of data) {
        const name = row.Name || row.name || '';
        const rawPhone = String(row.Phone || row.phone || '').replace(/\D/g, '').trim();
        if (!name || rawPhone.length !== 10) continue;
        await db.runAsync('INSERT INTO leads (name, company_name, phone, email, source, event_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [name, row.Company || null, `+91${rawPhone}`, row.Email || null, row.Source || 'Excel', row.Date || format(new Date(), 'yyyy-MM-dd'), row.Notes || '']);
        count++;
      }
      loadData();
      Alert.alert('Success', `Imported ${count} leads.`);
    } catch (e) { Alert.alert('Error', 'Import failed'); }
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', source: 'all', followUpStart: '', followUpEnd: '', nameStarts: '' });
    setActiveSummaryType(null);
  };

  const isAnyFilterActive = useMemo(() => {
    return filters.startDate !== '' || filters.endDate !== '' || filters.source !== 'all' || filters.followUpStart !== '' || filters.followUpEnd !== '' || filters.nameStarts !== '' || activeSummaryType !== null;
  }, [filters, activeSummaryType]);

  const onDatePickerChange = (event: any, date?: Date) => {
    const picker = activePicker;
    setActivePicker(null);
    if (date) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      setFilters(prev => ({ ...prev, [picker!]: formattedDate }));
    }
  };

  const onSummaryDatePickerChange = (event: any, date?: Date) => {
    const type = showSummaryPicker;
    setShowSummaryPicker(null);
    if (date && type) {
      setSummaryDates(prev => ({ ...prev, [type]: date }));
      setActiveSummaryType(type);
    }
  };

  const handleApplyMonthYear = () => {
    const newDate = setYear(setMonth(new Date(), tempMonth), tempYear);
    setSummaryDates(prev => ({ ...prev, month: newDate }));
    setActiveSummaryType('month');
    setShowSummaryPicker(null);
  };

  const handleApplyMonthWeek = () => {
    // Set to roughly the middle of the selected week in the selected month
    const newDate = setDate(setMonth(new Date(), tempMonth), (tempWeek - 1) * 7 + 4);
    setSummaryDates(prev => ({ ...prev, week: newDate }));
    setActiveSummaryType('week');
    setShowSummaryPicker(null);
  };

  const getSummaryTitle = (type: 'today' | 'week' | 'month', defaultTitle: string) => {
    const date = summaryDates[type];
    if (type === 'today') {
      return isToday(date) ? 'Today' : format(date, 'MMM dd');
    } else if (type === 'week') {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      const end = endOfWeek(date, { weekStartsOn: 1 });
      return isThisWeek(date, { weekStartsOn: 1 }) ? 'This Week' : `${format(start, 'MMM dd')} - ${format(end, 'dd')}`;
    } else {
      return isThisMonth(date) ? 'This Month' : format(date, 'MMM yyyy');
    }
  };

  const SummaryCard = ({ title, count, icon, gradient, type }: any) => {
    const isActive = activeSummaryType === type;
    const displayTitle = getSummaryTitle(type, title);

    const handleCompleteAction = async () => {
      if (count === 0) {
        Alert.alert('Info', `No leads to complete for ${displayTitle}`);
        return;
      }

      Alert.alert(
        'Complete Action',
        `Do you want to mark all ${count} leads in ${displayTitle} as followed up?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Complete',
            onPress: async () => {
              try {
                const db = getDatabase();
                if (!db) return;

                const leadsToUpdate = leads.filter(l => {
                  if (!l.next_follow_up) return false;
                  const date = parseISO(l.next_follow_up);
                  if (type === 'today') return isSameDay(date, summaryDates.today);
                  if (type === 'week') return isSameWeek(date, summaryDates.week, { weekStartsOn: 1 });
                  if (type === 'month') return isSameMonth(date, summaryDates.month);
                  return false;
                });

                for (const lead of leadsToUpdate) {
                  await db.runAsync('UPDATE leads SET next_follow_up = NULL WHERE id = ?', [lead.id]);
                }

                Alert.alert('Success', `Completed ${leadsToUpdate.length} leads`);
                loadData();
              } catch (error) {
                console.error('Failed to complete action:', error);
                Alert.alert('Error', 'Failed to complete leads');
              }
            }
          }
        ]
      );
    };

    const handleConfigPress = () => {
      if (type === 'month') {
        setTempMonth(summaryDates.month.getMonth());
        setTempYear(summaryDates.month.getFullYear());
      } else if (type === 'week') {
        setTempMonth(summaryDates.week.getMonth());
        // Estimate week of month
        setTempWeek(Math.floor((summaryDates.week.getDate() - 1) / 7) + 1);
      }
      setShowSummaryPicker(type);
    };

    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.summaryCard,
          { height: isTablet ? 110 : 90 },
          isActive && { borderWidth: 2, borderColor: '#fff' }
        ]}
      >
        <TouchableOpacity
          style={styles.summaryContent}
          activeOpacity={0.8}
          onPress={() => setActiveSummaryType(activeSummaryType === type ? null : type)}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryCount, { fontSize: isTablet ? 24 : 20 }]}>{count}</Text>
            <Text style={[styles.summaryTitle, { fontSize: isTablet ? 14 : 12 }]} numberOfLines={1}>{displayTitle}</Text>
          </View>
          
          <View style={styles.summaryCardActions}>
            <TouchableOpacity
              onPress={handleCompleteAction}
              style={[styles.summaryActionIcon, { width: isTablet ? 40 : 32, height: isTablet ? 40 : 32 }]}
            >
              <Ionicons name="checkmark-done-circle-outline" size={isTablet ? 28 : 22} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfigPress}
              style={[styles.summaryActionIcon, { width: isTablet ? 40 : 32, height: isTablet ? 40 : 32 }]}
            >
              <Ionicons name={icon} size={isTablet ? 24 : 20} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </LinearGradient>
    );
  };

  const TableHeader = () => (
    <View style={[styles.tableHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.colSelect}>
        <TouchableOpacity onPress={() => setSelectedIds(selectedIds.size === processedLeads.length ? new Set() : new Set(processedLeads.map(l => l.id)))}>
          <Ionicons name={selectedIds.size > 0 && selectedIds.size === processedLeads.length ? "checkbox" : "square-outline"} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.columnHeader, styles.colId, { color: colors.textSecondary }]}>ID</Text>
      <Text style={[styles.columnHeader, styles.colActions, { color: colors.textSecondary }]}>ACTIONS</Text>
      <Text style={[styles.columnHeader, styles.colDate, { color: colors.textSecondary }]}>DATE</Text>
      <Text style={[styles.columnHeader, styles.colName, { color: colors.textSecondary }]}>NAME</Text>
      <Text style={[styles.columnHeader, styles.colCompany, { color: colors.textSecondary }]}>COMPANY</Text>
      <Text style={[styles.columnHeader, styles.colPhone, { color: colors.textSecondary }]}>PHONE</Text>
      <Text style={[styles.columnHeader, styles.colEmail, { color: colors.textSecondary }]}>GMAIL</Text>
      <Text style={[styles.columnHeader, styles.colSource, { color: colors.textSecondary }]}>SOURCE</Text>
      <Text style={[styles.columnHeader, styles.colDate, { color: colors.textSecondary }]}>FOLLOW UP</Text>
      <Text style={[styles.columnHeader, styles.colNotes, { color: colors.textSecondary }]}>NOTES</Text>
    </View>
  );

  const renderLeadRow = ({ item: lead }: { item: Lead }) => (
    <View key={lead.id} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={() => toggleSelection(lead.id)} style={styles.colSelect}>
        <Ionicons name={selectedIds.has(lead.id) ? "checkbox" : "square-outline"} size={20} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[styles.colId, { color: colors.primary, fontWeight: '700' }]}>{lead.lead_id || '-'}</Text>
      <View style={[styles.colActions, styles.rowActions]}>
        <TouchableOpacity onPress={() => handleEdit(lead)} style={styles.actionBtn}><Ionicons name="create-outline" size={20} color={colors.primary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(lead.id)} style={styles.actionBtn}><Ionicons name="trash-outline" size={20} color={colors.error} /></TouchableOpacity>
      </View>
      <Text style={[styles.colDate, { color: colors.textSecondary }]}>{lead.event_date || '-'}</Text>
      <Text style={[styles.colName, styles.leadName, { color: colors.text }]} numberOfLines={1}>{lead.name}</Text>
      <Text style={[styles.colCompany, { color: colors.textSecondary }]} numberOfLines={1}>{lead.company_name || '-'}</Text>
      <Text style={[styles.colPhone, { color: colors.textSecondary }]}>{lead.phone.startsWith('+91') ? `+91 ${lead.phone.slice(3)}` : lead.phone}</Text>
      <Text style={[styles.colEmail, { color: colors.textSecondary }]} numberOfLines={1}>{lead.email || '-'}</Text>
      <Text style={[styles.colSource, { color: colors.textSecondary }]}>{lead.source || '-'}</Text>
      <Text style={[styles.colDate, { color: colors.textSecondary }]}>{lead.next_follow_up || '-'}</Text>
      <Text style={[styles.colNotes, { color: colors.textSecondary }]} numberOfLines={1}>{lead.notes || '-'}</Text>
    </View>
  );

  const SortOption = ({ label, value, icon }: any) => (
    <TouchableOpacity style={[styles.sortOption, { backgroundColor: sortBy === value ? colors.primary + '15' : 'transparent' }]} onPress={() => { setSortBy(value); setIsSortModalVisible(false); }}>
      <View style={styles.sortOptionLeft}><Ionicons name={icon} size={20} color={sortBy === value ? colors.primary : colors.textSecondary} /><Text style={[styles.sortOptionLabel, { color: sortBy === value ? colors.primary : colors.text }]}>{label}</Text></View>
      {sortBy === value && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.summaryContainer}>
        <SummaryCard type="today" title="Follow Up Today" count={stats.today} icon="today-outline" gradient={['#3b82f6', '#2563eb']} />
        <SummaryCard type="week" title="Weekly Follow Up" count={stats.week} icon="calendar-outline" gradient={['#8b5cf6', '#7c3aed']} />
        <SummaryCard type="month" title="Monthly Follow Up" count={stats.month} icon="pie-chart-outline" gradient={['#ec4899', '#db2777']} />
      </View>

      <View style={styles.filterBar}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
          <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search leads..." placeholderTextColor={colors.textTertiary} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={18} color={colors.textTertiary} /></TouchableOpacity> : null}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.surface }]} onPress={() => setIsFilterModalVisible(true)}><Ionicons name="funnel-outline" size={20} color={isAnyFilterActive ? colors.primary : colors.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.surface }]} onPress={() => setIsSortModalVisible(true)}><Ionicons name="swap-vertical" size={20} color={colors.primary} /></TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.surface }]} onPress={handleImportExcel}><Ionicons name="document-text-outline" size={20} color={colors.info} /></TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => { setEditingLeadId(null); setFormData({ name: '', company_name: '', phone: '', email: '', source: '', event_date: format(new Date(), 'yyyy-MM-dd'), next_follow_up: '', notes: '' }); setModalVisible(true); }}><Ionicons name="add" size={24} color="#fff" /><Text style={styles.addBtnText}>Add Lead</Text></TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tableContainer, { backgroundColor: colors.surface }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View><TableHeader /><FlatList data={processedLeads} keyExtractor={(item) => item.id.toString()} renderItem={renderLeadRow} ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="funnel-outline" size={48} color={colors.textTertiary} /><Text style={[styles.emptyText, { color: colors.textTertiary }]}>No leads found</Text></View>} contentContainerStyle={{ paddingBottom: 100 }} /></View>
        </ScrollView>
      </View>

      {selectedIds.size > 0 && (
        <TouchableOpacity style={[styles.convertFloatingBtn, { backgroundColor: colors.success }]} onPress={handleConvertToClient}><Ionicons name="person-add" size={24} color="#fff" /><Text style={styles.convertFloatingText}>Convert {selectedIds.size} to Clients</Text></TouchableOpacity>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>{editingLeadId ? 'Edit Lead' : 'Add New Lead'}</Text><TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={28} color={colors.textSecondary} /></TouchableOpacity></View>
              <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text><TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.textSecondary }]} value={formData.event_date} editable={false} /></View>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Name *</Text><TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={formData.name} onChangeText={handleNameChange} placeholder="Enter lead name" placeholderTextColor={colors.textTertiary} /></View>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Company Name (Optional)</Text><TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={formData.company_name} onChangeText={(text) => setFormData({ ...formData, company_name: text })} placeholder="Enter company name" placeholderTextColor={colors.textTertiary} /></View>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number *</Text><TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={formData.phone} onChangeText={handlePhoneChange} placeholder="10-digit number" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" maxLength={10} /></View>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Gmail (Optional)</Text><TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={formData.email} onChangeText={handleEmailChange} placeholder="example@gmail.com" placeholderTextColor={colors.textTertiary} keyboardType="email-address" autoCapitalize="none" /></View>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Lead Source</Text><TouchableOpacity style={[styles.input, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => { Keyboard.dismiss(); setIsSourcePickerVisible(true); }}><Text style={{ color: formData.source ? colors.text : colors.textTertiary }}>{formData.source || 'Select source'}</Text><Ionicons name="chevron-down" size={20} color={colors.textSecondary} /></TouchableOpacity></View>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Next Follow Up (Optional)</Text><TouchableOpacity style={[styles.input, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => { Keyboard.dismiss(); setShowFollowUpPicker(true); }}><Text style={{ color: formData.next_follow_up ? colors.text : colors.textTertiary }}>{formData.next_follow_up || 'Select follow up date'}</Text><Ionicons name="calendar-outline" size={20} color={colors.textSecondary} /></TouchableOpacity>{showFollowUpPicker && <DateTimePicker value={formData.next_follow_up ? parseISO(formData.next_follow_up) : new Date()} mode="date" display="default" onChange={(e, d) => { setShowFollowUpPicker(false); if (d) setFormData({ ...formData, next_follow_up: format(d, 'yyyy-MM-dd') }); }} minimumDate={new Date()} />}</View>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Notes (Optional)</Text><TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text }]} value={formData.notes} onChangeText={(text) => setFormData({ ...formData, notes: text })} placeholder="Add any details..." placeholderTextColor={colors.textTertiary} multiline numberOfLines={4} /></View>
                <View style={styles.formFooter}><TouchableOpacity style={[styles.resetButton, { borderColor: colors.border }]} onPress={handleResetForm}><Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>Reset</Text></TouchableOpacity><TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={() => handleSaveLead()}><Text style={styles.submitButtonText}>{editingLeadId ? 'Update Lead' : 'Add Lead'}</Text></TouchableOpacity></View>
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Advanced Filter Modal */}
      <Modal visible={isFilterModalVisible} transparent animationType="fade" onRequestClose={() => setIsFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '90%', maxHeight: '80%' }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>Filter Leads</Text><TouchableOpacity onPress={clearFilters}><Text style={{ color: colors.primary, fontWeight: '700' }}>Clear All</Text></TouchableOpacity></View>
            <ScrollView style={{ padding: 20 }}>
              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary }]}>Creation Date Range</Text>
              <View style={styles.rangeRow}>
                <TouchableOpacity style={[styles.input, { flex: 1, backgroundColor: colors.background }]} onPress={() => setActivePicker('startDate')}><Text style={{ color: filters.startDate ? colors.text : colors.textTertiary }}>{filters.startDate || 'Start Date'}</Text></TouchableOpacity>
                <Text style={{ color: colors.textSecondary }}>to</Text>
                <TouchableOpacity style={[styles.input, { flex: 1, backgroundColor: colors.background }]} onPress={() => setActivePicker('endDate')}><Text style={{ color: filters.endDate ? colors.text : colors.textTertiary }}>{filters.endDate || 'End Date'}</Text></TouchableOpacity>
              </View>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 20 }]}>Lead Source</Text>
              <View style={styles.filterSourceGrid}><TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.source === 'all' ? colors.primary : colors.background, borderColor: colors.primary }]} onPress={() => setFilters({ ...filters, source: 'all' })}><Text style={{ color: filters.source === 'all' ? '#fff' : colors.textSecondary }}>All</Text></TouchableOpacity>{leadSources.map(s => <TouchableOpacity key={s.id} style={[styles.filterChip, { backgroundColor: filters.source === s.label ? colors.primary : colors.background, borderColor: colors.primary }]} onPress={() => setFilters({ ...filters, source: s.label })}><Text style={{ color: filters.source === s.label ? '#fff' : colors.textSecondary }}>{s.label}</Text></TouchableOpacity>)}</View>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 20 }]}>Follow Up Range</Text>
              <View style={styles.rangeRow}>
                <TouchableOpacity style={[styles.input, { flex: 1, backgroundColor: colors.background }]} onPress={() => setActivePicker('followUpStart')}><Text style={{ color: filters.followUpStart ? colors.text : colors.textTertiary }}>{filters.followUpStart || 'Start Date'}</Text></TouchableOpacity>
                <Text style={{ color: colors.textSecondary }}>to</Text>
                <TouchableOpacity style={[styles.input, { flex: 1, backgroundColor: colors.background }]} onPress={() => setActivePicker('followUpEnd')}><Text style={{ color: filters.followUpEnd ? colors.text : colors.textTertiary }}>{filters.followUpEnd || 'End Date'}</Text></TouchableOpacity>
              </View>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 20 }]}>Name Starts From</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={filters.nameStarts} onChangeText={(text) => setFilters({ ...filters, nameStarts: text })} placeholder="e.g. S" placeholderTextColor={colors.textTertiary} autoCapitalize="characters" maxLength={5} />

              <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary, marginTop: 30, marginBottom: 20 }]} onPress={() => setIsFilterModalVisible(false)}><Text style={styles.submitButtonText}>Apply Filters</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        {activePicker && <DateTimePicker value={filters[activePicker as keyof typeof filters] ? parseISO(filters[activePicker as keyof typeof filters] as string) : new Date()} mode="date" onChange={onDatePickerChange} />}
      </Modal>

      {/* Summary Filter Custom Pickers */}
      <Modal visible={showSummaryPicker !== null} transparent animationType="fade" onRequestClose={() => setShowSummaryPicker(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {showSummaryPicker === 'month' ? 'Select Month & Year' : showSummaryPicker === 'week' ? 'Select Month & Week' : 'Select Date'}
              </Text>
              <TouchableOpacity onPress={() => setShowSummaryPicker(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {showSummaryPicker === 'today' ? (
              <DateTimePicker
                value={summaryDates.today}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onSummaryDatePickerChange}
              />
            ) : showSummaryPicker === 'month' ? (
              <View style={{ padding: 20 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Month</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.filterChip, { backgroundColor: tempMonth === i ? colors.primary : colors.background, borderColor: colors.primary, marginRight: 8 }]}
                      onPress={() => setTempMonth(i)}
                    >
                      <Text style={{ color: tempMonth === i ? '#fff' : colors.textSecondary }}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Year</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 30 }}>
                  {YEARS.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.filterChip, { backgroundColor: tempYear === y ? colors.primary : colors.background, borderColor: colors.primary, marginRight: 8 }]}
                      onPress={() => setTempYear(y)}
                    >
                      <Text style={{ color: tempYear === y ? '#fff' : colors.textSecondary }}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleApplyMonthYear}>
                  <Text style={styles.submitButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ padding: 20 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Month</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.filterChip, { backgroundColor: tempMonth === i ? colors.primary : colors.background, borderColor: colors.primary, marginRight: 8 }]}
                      onPress={() => setTempMonth(i)}
                    >
                      <Text style={{ color: tempMonth === i ? '#fff' : colors.textSecondary }}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Week</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30 }}>
                  {WEEKS.map((w) => (
                    <TouchableOpacity
                      key={w}
                      style={[styles.filterChip, { backgroundColor: tempWeek === w ? colors.primary : colors.background, borderColor: colors.primary }]}
                      onPress={() => setTempWeek(w)}
                    >
                      <Text style={{ color: tempWeek === w ? '#fff' : colors.textSecondary }}>Week {w}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleApplyMonthWeek}>
                  <Text style={styles.submitButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Other Modals (Sort, Source Picker) */}
      <Modal visible={isSortModalVisible} transparent animationType="fade" onRequestClose={() => setIsSortModalVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsSortModalVisible(false)}><View style={[styles.sortModalContainer, { backgroundColor: colors.surface }]}><View style={styles.sortModalHeader}><Text style={[styles.sortModalTitle, { color: colors.text }]}>Sort Leads</Text></View><View style={{ padding: 8 }}><SortOption label="ID: Newest First" value="id_desc" icon="barcode-outline" /><SortOption label="ID: Oldest First" value="id_asc" icon="barcode-outline" /><SortOption label="Date: Newest First" value="date_desc" icon="calendar" /><SortOption label="Date: Oldest First" value="date_asc" icon="calendar-outline" /><SortOption label="Name: A to Z" value="name_asc" icon="text-outline" /><SortOption label="Name: Z to A" value="name_desc" icon="text-outline" /></View></View></TouchableOpacity>
      </Modal>

      <Modal visible={isSourcePickerVisible} transparent={true} animationType="fade" onRequestClose={() => setIsSourcePickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsSourcePickerVisible(false)}><View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '85%' }]}><View style={styles.pickerHeader}><Text style={[styles.pickerTitle, { color: colors.text }]}>Select Lead Source</Text></View><FlatList data={leadSources} keyExtractor={(item) => item.id.toString()} renderItem={({ item }) => (<TouchableOpacity style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => { setFormData({ ...formData, source: item.label }); setIsSourcePickerVisible(false); }}><Text style={[styles.pickerItemText, { color: colors.text }]}>{item.label}</Text>{formData.source === item.label && <Ionicons name="checkmark" size={20} color={colors.primary} />}</TouchableOpacity>)} /></View></TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryContainer: { flexDirection: 'row', padding: 16, gap: 12, justifyContent: 'space-between' },
  summaryCard: { flex: 1, borderRadius: 16, padding: 0, elevation: 4, overflow: 'hidden' },
  summaryContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  summaryCount: { color: '#fff', fontWeight: '800' },
  summaryTitle: { color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  summaryIconContainer: { borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  summaryCardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  summaryActionIcon: { borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  filterBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12, alignItems: 'center' },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderRadius: 16, height: 48 },
  searchInput: { flex: 1, paddingHorizontal: 8, fontSize: 16 },
  actionButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 12, borderRadius: 16, elevation: 2 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tableContainer: { flex: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', padding: 16, borderBottomWidth: 1 },
  columnHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  tableRow: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, alignItems: 'center' },
  colSelect: { width: 40 },
  colId: { width: 80 },
  colActions: { width: 100 },
  colDate: { width: 120 },
  colName: { width: 180 },
  colCompany: { width: 180 },
  colPhone: { width: 150 },
  colEmail: { width: 180 },
  colSource: { width: 120 },
  colIdName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colNotes: { width: 250 },
  rowActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  actionBtn: { padding: 4 },
  leadName: { fontSize: 15, fontWeight: '700' },
  emptyContainer: { padding: 80, alignItems: 'center', width: Dimensions.get('window').width },
  emptyText: { fontSize: 16, fontWeight: '500', marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '95%', maxHeight: '90%' },
  modalContent: { borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  modalTitle: { fontSize: 22, fontWeight: '700' },
  formContainer: { padding: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { padding: 16, borderRadius: 12, fontSize: 16, justifyContent: 'center' },
  textArea: { height: 100, textAlignVertical: 'top' },
  formFooter: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 24 },
  resetButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, justifyContent: 'center' },
  resetButtonText: { fontSize: 16, fontWeight: '600' },
  submitButton: { flex: 2, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  convertFloatingBtn: { position: 'absolute', bottom: 30, right: 30, left: 30, flexDirection: 'row', height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 12, zIndex: 9999 },
  convertFloatingText: { color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 12 },
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
  filterSourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
