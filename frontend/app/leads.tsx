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
import * as leadsService from '../src/api/services/leads';
import * as clientsService from '../src/api/services/clients';
import * as appOptionsService from '../src/api/services/appOptions';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO, isToday, isThisWeek, isThisMonth, isSameDay, isSameWeek, isSameMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth, setMonth, setYear, setDate, addWeeks, differenceInCalendarWeeks } from 'date-fns';
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
  event_type?: string;
  event_location?: string;
  package_name?: string;
  total_price?: number;
  status?: string;
  budget?: number;
  stage: string;
  notes: string;
  event_date: string;
  next_follow_up?: string;
  created_at?: string;
}

interface AppOption {
  id: number;
  type: string;
  label: string;
  value: string;
  color: string;
}

const LEAD_STAGES_DEFAULTS = [
  { label: 'New', value: 'new', color: '#3b82f6' },
  { label: 'Contacted', value: 'contacted', color: '#8b5cf6' },
  { label: 'Qualified', value: 'qualified', color: '#10b981' },
  { label: 'Proposal Sent', value: 'proposal', color: '#f59e0b' },
  { label: 'Won', value: 'won', color: '#10b981' },
  { label: 'Lost', value: 'lost', color: '#ef4444' }
];

const LEAD_SOURCES_DEFAULTS = [
  { label: 'Instagram', value: 'instagram', color: '#e1306c' },
  { label: 'Google', value: 'google', color: '#4285f4' },
  { label: 'WhatsApp', value: 'whatsapp', color: '#25d366' },
  { label: 'Referral', value: 'referral', color: '#8b5cf6' },
  { label: 'Facebook', value: 'facebook', color: '#1877f2' }
];

interface AppOption {
  id: number;
  type: string;
  label: string;
  value: string;
  color: string;
}

const LEAD_STAGES = LEAD_STAGES_DEFAULTS;

type SortKey = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'id_desc' | 'id_asc';

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const getWeeksInMonthCount = (month: number, year: number) => {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  // Find the first Monday (weekStartsOn: 1) of the month (or leading into it)
  const firstWeekStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
  // Find the end of the last week of the month
  const lastWeekEnd = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });
  
  // Calculate total days between the start of the first week and the end of the last week
  const diffInDays = Math.ceil((lastWeekEnd.getTime() - firstWeekStart.getTime()) / (1000 * 60 * 60 * 24));
  // Return the number of weeks (should be 4, 5, or 6)
  return Math.ceil(diffInDays / 7);
};

export default function Leads() {
  const { width } = useWindowDimensions();
  const isTablet = width > 768;
  const { colors } = useThemeStore();
  const router = useRouter();

  // Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSources, setLeadSources] = useState<AppOption[]>([]);
  const [leadStages, setLeadStages] = useState<AppOption[]>([]);
  const [eventTypes, setEventTypes] = useState<AppOption[]>([]);
  const [stats, setStats] = useState({
    today: 0, 
    week: 0, 
    month: 0 
  });
  const [dbReady, setDbReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // UI State
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSourcePickerVisible, setIsSourcePickerVisible] = useState(false);
  const [isEventTypePickerVisible, setIsEventTypePickerVisible] = useState(false);
  const [isStagePickerVisible, setIsStagePickerVisible] = useState(false);
  const [showEventDatePicker, setShowEventDatePicker] = useState(false);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);

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
  // year is not selectable by the user; keep it so calculations still have a
  // value (defaults to current year or previously applied year).
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [tempWeek, setTempWeek] = useState(1);

  // auto-generate next lead_id based on existing leads
  // new format: L followed by four digits (e.g. L0001)
  const getNextLeadId = () => {
    let max = 0;
    leads.forEach(l => {
      if (l.lead_id) {
        // strip non-digits, then parse
        const digits = l.lead_id.replace(/\D/g, '');
        const n = parseInt(digits, 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    const next = max + 1;
    // if number exceeds 9999, allow longer sequence without padding
    if (next > 9999) return 'L' + next.toString();
    return 'L' + next.toString().padStart(4, '0');
  };

  // keep track of the month/year that were used when a "week" filter was applied
  // (summaryDates.week may point to a date in the previous month if the first
  // week of the month starts in the prior month). Storing the month/year lets
  // us reopen the picker showing the same year even though it's not exposed.
  const [selectedWeekMonthYear, setSelectedWeekMonthYear] = useState<{month:number;year:number}>({
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });

  // Sort & Filter State
  const [sortBy, setSortBy] = useState<SortKey>('id_desc');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // Advanced Range Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    source: 'all',
    stage: 'all',
    followUpStart: '',
    followUpEnd: '',
    nameStarts: ''
  });

  const [activePicker, setActivePicker] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    lead_id: '',
    name: '',
    company_name: '',
    phone: '',
    email: '',
    source: '',
    event_type: '',
    event_location: '',
    package_name: '',
    total_price: '',
    status: 'new',
    stage: 'new',
    event_date: format(new Date(), 'yyyy-MM-dd'),
    next_follow_up: '',
    notes: ''
  });

  const loadData = useCallback(async () => {
    try {
      setDbReady(true);
      setLoading(true);

      // Seed default lead stages if they don't exist
      const allOptions = await appOptionsService.getAll();
      const existingStages = allOptions.filter((option) => option.type === 'lead_stage');
      if (existingStages.length === 0) {
        for (const stage of LEAD_STAGES_DEFAULTS) {
          await appOptionsService.create({
            type: 'lead_stage',
            label: stage.label,
            value: stage.value,
            color: stage.color,
          });
        }
      }

      const result = await leadsService.getAll();
      const allLeads = [...result]
        .sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))) as Lead[];
      setLeads(allLeads);

      const refreshedOptions = await appOptionsService.getAll();
      const sourceOptions = refreshedOptions
        .filter((option) => option.type === 'lead_source')
        .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? ''))) as AppOption[];

      setLeadSources(
        sourceOptions.length > 0
          ? sourceOptions
          : LEAD_SOURCES_DEFAULTS.map((source, index) => ({
              id: -(index + 1),
              type: 'lead_source',
              label: source.label,
              value: source.value,
              color: source.color,
            }))
      );

      setLeadStages(
        refreshedOptions
          .filter((option) => option.type === 'lead_stage')
          .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0)) as AppOption[]
      );

      setEventTypes(
        refreshedOptions
          .filter((option) => option.type === 'event_type')
          .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? ''))) as AppOption[]
      );

      let todayCount = 0;
      let weekCount = 0;
      let monthCount = 0;
      const today = new Date();

      allLeads.forEach(lead => {
        const createdAtStr = lead.created_at;

        // Today, Week & Month: Total Leads created on that day/week/month
        if (createdAtStr) {
          try {
            const createdAt = parseISO(createdAtStr.replace(' ', 'T') + 'Z'); 
            if (isSameDay(createdAt, today)) todayCount++;
            if (isSameWeek(createdAt, today, { weekStartsOn: 1 })) weekCount++;
            if (isSameMonth(createdAt, today)) monthCount++;
          } catch (e) {}
        }
      });

      setStats({ 
        today: todayCount, 
        week: weekCount, 
        month: monthCount 
      });

    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const processedLeads = useMemo(() => {
    let result = [...leads];

    // Summary Card Filters (Take precedence)
    if (activeSummaryType === 'today') {
      result = result.filter(l => {
        try { 
          if (!l.created_at) return false;
          const createdAt = parseISO(l.created_at.replace(' ', 'T') + 'Z');
          return isSameDay(createdAt, summaryDates.today); 
        } catch { return false; }
      });
    } else if (activeSummaryType === 'week') {
      result = result.filter(l => {
        try {
          if (!l.created_at) return false;
          const creationDate = parseISO(l.created_at.replace(' ', 'T') + 'Z');
          // require both that the date falls in the chosen calendar week and
          // that it belongs to the selected month – this prevents, for example,
          // February 27 being included when the user asked for "March week 1".
          return (
            isSameWeek(creationDate, summaryDates.week, { weekStartsOn: 1 }) &&
            isSameMonth(creationDate, summaryDates.month)
          );
        } catch { return false; }
      });
    } else if (activeSummaryType === 'month') {
      result = result.filter(l => {
        try {
          if (!l.created_at) return false;
          const creationDate = parseISO(l.created_at.replace(' ', 'T') + 'Z');
          return isSameMonth(creationDate, summaryDates.month);
        } catch { return false; }
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

    if (filters.stage !== 'all') {
      result = result.filter(l => l.stage === filters.stage);
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

  const displayStats = useMemo(() => {
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    const today = new Date();

    processedLeads.forEach(lead => {
      if (lead.created_at) {
        try {
          const createdAt = parseISO(lead.created_at.replace(' ', 'T') + 'Z');
          if (isSameDay(createdAt, today)) todayCount++;
          if (isSameWeek(createdAt, today, { weekStartsOn: 1 })) weekCount++;
          if (isSameMonth(createdAt, today)) monthCount++;
        } catch (e) {}
      }
    });

    return {
      today: todayCount,
      week: weekCount,
      month: monthCount
    };
  }, [processedLeads]);

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
            const selectedLeads = leads.filter(l => selectedIds.has(l.id));
            
            for (const lead of selectedLeads) {
              // Add to clients table, preserving most lead fields so we can later restore exactly
              await clientsService.create({
                name: lead.name,
                phone: lead.phone,
                email: lead.email,
                event_type: lead.event_type || null,
                event_date: lead.event_date || null,
                event_location: lead.company_name || null,
                lead_source: lead.source,
                notes: lead.notes || null,
                status: 'active',
              });
              // Keep a copy in leads table (do not delete)
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

  const handleConvertSingleLead = async (lead: Lead) => {
    Alert.alert('Convert Lead', `Convert "${lead.name}" to client?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Convert', onPress: async () => {
          try {
            await clientsService.create({
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              event_type: lead.event_type || null,
              event_date: lead.event_date || null,
              event_location: lead.company_name || null,
              lead_source: lead.source,
              notes: lead.notes || null,
              status: 'active',
            });

            // Fetch the newly created client to open edit form
            const result = await clientsService.getAll() as any[];
            const sorted = [...result].sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));

            if (sorted.length > 0) {
              const newClient = sorted[0];
              Alert.alert('Success', 'Lead converted to client successfully', [
                { text: 'OK', onPress: () => {
                  // Navigate to clients page with parameter to auto-edit the new client
                  router.push({ pathname: 'clients', params: { autoEditClientId: newClient.id.toString() } });
                }}
              ]);
            }
            
            loadData();
          } catch (error) {
            console.error('Failed to convert lead:', error);
            Alert.alert('Error', 'Failed to convert lead to client');
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

  const handleLeadIdChange = (text: string) => {
    // enforce pattern: starts with 'L' followed by digits
    let t = text.toUpperCase();
    if (!t.startsWith('L')) {
      // strip non-digits then prefix L
      const digits = t.replace(/\D/g, '');
      t = 'L' + digits;
    } else {
      // keep L and strip non-digits from remainder
      const rest = t.slice(1).replace(/\D/g, '');
      t = 'L' + rest;
    }
    // limit to L + 4 digits
    if (t.length > 5) t = t.slice(0, 5);
    setFormData({ ...formData, lead_id: t });
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
      lead_id: '',
      name: '',
      company_name: '',
      phone: '',
      email: '',
      source: '',
      event_type: '',
      event_location: '',
      package_name: '',
      total_price: '',
      status: 'new',
      stage: 'new',
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

    if (!formData.source) { Alert.alert('Warning', 'Lead Source is mandatory'); return; }
    if (!formData.stage) { Alert.alert('Warning', 'Lead Stage is mandatory'); return; }

    const normalizedPhone = `+91${rawPhone}`;
    if (!gmailResult.valid) { Alert.alert('Warning', gmailResult.message); return; }

    try {
      if (!editingLeadId && !confirmDuplicate) {
        const allLeads = await leadsService.getAll();
        const existing: any[] = allLeads.filter((lead: any) => lead.phone === normalizedPhone);
        if (existing.length > 0) {
          Alert.alert('Duplicate', `A lead named "${existing[0].name}" exists. Add anyway?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Anyway', onPress: () => handleSaveLead(true) }
          ]);
          return;
        }
      }

  
      if (editingLeadId) {
        await leadsService.update(String(editingLeadId), {
          lead_id: formData.lead_id || null,
          name: finalName,
          company_name: finalCompanyName || null,
          phone: normalizedPhone,
          email: gmailResult.email || null,
          source: formData.source,
          stage: formData.stage,
          event_date: formData.event_date,
          next_follow_up: formData.next_follow_up || null,
          notes: formData.notes,
        });
      } else {
        await leadsService.create({
          lead_id: formData.lead_id || null,
          name: finalName,
          company_name: finalCompanyName || null,
          phone: normalizedPhone,
          email: gmailResult.email || null,
          source: formData.source,
          stage: formData.stage,
          event_date: formData.event_date,
          next_follow_up: formData.next_follow_up || null,
          notes: formData.notes,
        });
      }
      setModalVisible(false);
      setEditingLeadId(null);
      loadData();
      Alert.alert('Success', `Lead ${editingLeadId ? 'updated' : 'added'} successfully`);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save lead');
    }
  };

  const handleEdit = (lead: Lead) => {
    const editablePhone = lead.phone.startsWith('+91') ? lead.phone.slice(3) : lead.phone;
    setFormData({
      lead_id: lead.lead_id || '',
      name: lead.name,
      company_name: lead.company_name || '',
      phone: editablePhone,
      email: lead.email || '',
      source: lead.source || '',
      event_type: lead.event_type || '',
      event_location: lead.event_location || '',
      package_name: lead.package_name || '',
      total_price: lead.total_price?.toString() || '',
      status: lead.status || 'new',
      stage: lead.stage || 'new',
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
            await leadsService.delete(String(id));
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
          const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
      const workbook = XLSX.read(fileContent, { type: 'base64' });
      const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      let count = 0;
      for (const row of data) {
        const name = row.Name || row.name || '';
        const rawPhone = String(row.Phone || row.phone || '').replace(/\D/g, '').trim();
        if (!name || rawPhone.length !== 10) continue;
                await leadsService.create({
                  name,
                  company_name: row.Company || null,
                  phone: `+91${rawPhone}`,
                  email: row.Email || null,
                  source: row.Source || 'Excel',
                  event_type: row.Type || null,
                  budget: row.Budget || 0,
                  stage: 'new',
                  event_date: row.Date || format(new Date(), 'yyyy-MM-dd'),
                  notes: row.Notes || '',
                });
        count++;
      }
      loadData();
      Alert.alert('Success', `Imported ${count} leads.`);
    } catch (e) { Alert.alert('Error', 'Import failed'); }
  };

  const resetSummarySelection = () => {
    const now = new Date();
    setActiveSummaryType(null);
    setSummaryDates({
      today: now,
      week: now,
      month: now
    });
    setSelectedWeekMonthYear({ month: now.getMonth(), year: now.getFullYear() });
    setTempMonth(now.getMonth());
    setTempYear(now.getFullYear());
    setTempWeek(1);
    // Re-trigger loadData to recalculate stats with today's date
    setTimeout(() => {
      loadData();
      setActiveSummaryType('today');
    }, 50);
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', source: 'all', stage: 'all', followUpStart: '', followUpEnd: '', nameStarts: '' });
    resetSummarySelection();
  };

  const isAnyFilterActive = useMemo(() => {
    return filters.startDate !== '' || filters.endDate !== '' || filters.source !== 'all' || filters.stage !== 'all' || filters.followUpStart !== '' || filters.followUpEnd !== '' || filters.nameStarts !== '' || activeSummaryType !== null;
  }, [filters, activeSummaryType]);

  const onDatePickerChange = (event: any, date?: Date) => {
    const picker = activePicker;
    if (Platform.OS === 'android') {
      setActivePicker(null);
      if (event.type === 'set' && date) {
        const formattedDate = format(date, 'yyyy-MM-dd');
        setFilters(prev => ({ ...prev, [picker!]: formattedDate }));
      }
    } else {
      if (date) {
        const formattedDate = format(date, 'yyyy-MM-dd');
        setFilters(prev => ({ ...prev, [picker!]: formattedDate }));
      }
      if (event.type === 'dismissed' || event.type === 'set') {
        setActivePicker(null);
      }
    }
  };

  const onSummaryDatePickerChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        return;
      }
    }
    if (date) {
      setSummaryDates(prev => ({ ...prev, today: date }));
      
      if (Platform.OS === 'android' && event.type === 'set') {
        // Auto-apply the filter when a date is selected for "Today" card
        setFilters({ startDate: '', endDate: '', source: 'all', stage: 'all', followUpStart: '', followUpEnd: '', nameStarts: '' });
        setActiveSummaryType(null); // Force a reset
        setTimeout(() => {
          setActiveSummaryType('today');
          setShowSummaryPicker(null);
        }, 10);
      } else if (Platform.OS === 'ios') {
        setFilters({ startDate: '', endDate: '', source: 'all', stage: 'all', followUpStart: '', followUpEnd: '', nameStarts: '' });
        setActiveSummaryType(null);
        setTimeout(() => {
          setActiveSummaryType('today');
          setShowSummaryPicker(null);
        }, 10);
      }
    }
  };

  const handleApplyMonthYear = () => {
    const newDate = new Date(tempYear, tempMonth, 1);
    setSummaryDates(prev => ({ ...prev, month: newDate }));
    // Clear other filters to show only the selected summary filter
    setFilters({ startDate: '', endDate: '', source: 'all', stage: 'all', followUpStart: '', followUpEnd: '', nameStarts: '' });
    setActiveSummaryType(null); // Force a reset
    setTimeout(() => {
      setActiveSummaryType('month');
      setShowSummaryPicker(null);
    }, 10);
  };

  const handleApplyMonthWeek = () => {
    // remember the month/year the user picked so the config dialog can
    // re‑populate correctly later
    setSelectedWeekMonthYear({ month: tempMonth, year: tempYear });

    // calculate a date representing the start of the chosen week within the
    // selected month.  We always start from the first week that contains
    // any day of the month (the same logic as before) but the resulting date
    // will now be used only for filtering – the month/year are tracked
    // separately above.
    const monthStart = startOfWeek(new Date(tempYear, tempMonth, 1), { weekStartsOn: 1 });
    const targetWeekDate = addWeeks(monthStart, tempWeek - 1);

    setSummaryDates(prev => ({
      ...prev,
      week: targetWeekDate,
      // also record the selected month so filtering can exclude days from
      // adjacent months that happen to fall in the same calendar week
      month: new Date(tempYear, tempMonth, 1)
    }));

    // Clear other filters to show only the selected summary filter
    setFilters({ startDate: '', endDate: '', source: 'all', stage: 'all', followUpStart: '', followUpEnd: '', nameStarts: '' });
    setActiveSummaryType(null); // Force a reset
    setTimeout(() => {
      setActiveSummaryType('week');
      setShowSummaryPicker(null);
    }, 10);
  };

  const getSummaryTitle = (type: 'today' | 'week' | 'month', defaultTitle: string) => {
    const date = summaryDates[type];
    const today = new Date();
    if (type === 'today') {
      return isSameDay(date, today) ? 'Total Leads (Today)' : `Leads (${format(date, 'MMM dd')})`;
    } else if (type === 'week') {
      // For week filters we want the display range to respect the month/year the
      // user chose, even if the actual weekStart falls in the previous month.
      const monthStart = startOfWeek(new Date(selectedWeekMonthYear.year, selectedWeekMonthYear.month, 1), { weekStartsOn: 1 });
      let start = startOfWeek(date, { weekStartsOn: 1 });
      if (start < monthStart) {
        // clip the start to the beginning of the selected month
        start = new Date(selectedWeekMonthYear.year, selectedWeekMonthYear.month, 1);
      }
      const end = endOfWeek(start, { weekStartsOn: 1 });
      const isCurrentWeek = isSameWeek(start, today, { weekStartsOn: 1 });
      return isCurrentWeek ? 'Total Leads (Week)' : `${format(start, 'MMM dd')} - ${format(end, 'dd')}`;
    } else {
      return isSameMonth(date, today) ? 'Total Leads (Month)' : `Leads (${format(date, 'MMM yyyy')})`;
    }
  };

  const SummaryCard = ({ title, count, icon, gradient, type }: any) => {
    const isActive = activeSummaryType === type;
      const displayTitle = getSummaryTitle(type, title);

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
      if (e && e.stopPropagation) e.stopPropagation();
      if (type === 'month') {
        setTempMonth(summaryDates.month.getMonth());
        // retain the year we used previously so applying again doesn't jump to
        // the current year unexpectedly
        setTempYear(summaryDates.month.getFullYear());
      } else if (type === 'week') {
        setTempMonth(selectedWeekMonthYear.month);
        setTempYear(selectedWeekMonthYear.year);

        // compute the week index relative to the first week of the selected
        // month/year. differenceInCalendarWeeks handles all edge cases for us.
        const monthStart = startOfWeek(new Date(selectedWeekMonthYear.year, selectedWeekMonthYear.month, 1), { weekStartsOn: 1 });
        const idx = differenceInCalendarWeeks(summaryDates.week, monthStart, { weekStartsOn: 1 }) + 1;
        setTempWeek(idx > 0 ? idx : 1);
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
          onPress={() => {
            const newType = activeSummaryType === type ? null : type;
            setActiveSummaryType(newType);
            setFilters({ startDate: '', endDate: '', source: 'all', stage: 'all', followUpStart: '', followUpEnd: '', nameStarts: '' });
          }}
        >
          <View style={{ flex: 1 }}>
            <View>
              <Text style={[styles.summaryCount, { fontSize: isTablet ? 24 : 20 }]}>{count ?? 0}</Text>
              <Text style={[styles.summaryTitle, { fontSize: isTablet ? 14 : 12 }]} numberOfLines={1}>
                {displayTitle}
              </Text>
              {isActive && (
                <Text style={[styles.summarySubtitle, { fontSize: isTablet ? 11 : 9 }]}>{getDateDisplay()}</Text>
              )}
            </View>
          </View>
          
          <View style={styles.summaryCardActions}>
            <TouchableOpacity
              onPress={(e) => handleConfigPress(e)}
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
      <Text style={[styles.columnHeader, styles.colEmail, { color: colors.textSecondary }]}>EMAIL</Text>
      <Text style={[styles.columnHeader, styles.colSource, { color: colors.textSecondary }]}>SOURCE</Text>
      <Text style={[styles.columnHeader, styles.colStage, { color: colors.textSecondary }]}>STAGE</Text>
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
        <TouchableOpacity 
          onPress={() => {
            setSelectedLeadForDetail(lead);
            setDropdownVisible(true);
          }}
          style={styles.actionBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {/* convert icon moved inside actions, no separate column any more */}
      <Text style={[styles.colDate, { color: colors.textSecondary }]}>{lead.event_date ? format(parseISO(lead.event_date), 'dd-MMM-yy') : '-'}</Text>
      <Text style={[styles.colName, styles.leadName, { color: colors.text }]} numberOfLines={1}>{lead.name}</Text>
      <Text style={[styles.colCompany, { color: colors.textSecondary }]} numberOfLines={1}>{lead.company_name || '-'}</Text>
      <Text style={[styles.colPhone, { color: colors.textSecondary }]}>{lead.phone.startsWith('+91') ? `+91 ${lead.phone.slice(3)}` : lead.phone}</Text>
      <Text style={[styles.colEmail, { color: colors.textSecondary }]} numberOfLines={1}>{lead.email || '-'}</Text>
      <Text style={[styles.colSource, { color: colors.textSecondary }]}>{lead.source || '-'}</Text>
      <View style={styles.colStage}>
        <View style={[styles.stageBadge, { backgroundColor: leadStages.find(s => s.value === lead.stage)?.color + '20' || colors.primary + '20' }]}>
          <Text style={[styles.stageText, { color: leadStages.find(s => s.value === lead.stage)?.color || colors.primary }]}>
            {leadStages.find(s => s.value === lead.stage)?.label || lead.stage || 'New'}
          </Text>
        </View>
      </View>
      <Text style={[styles.colDate, { color: colors.textSecondary }]}>{lead.next_follow_up ? format(parseISO(lead.next_follow_up), 'dd-MMM-yy') : '-'}</Text>
      <Text style={[styles.colNotes, { color: colors.textSecondary }]} numberOfLines={1}>{lead.notes || '-'}</Text>
    </View>
  );

  const SortOption = ({ label, value, icon }: any) => (
    <TouchableOpacity style={[styles.sortOption, { backgroundColor: sortBy === value ? colors.primary + '15' : 'transparent' }]} onPress={() => { setSortBy(value); setIsSortModalVisible(false); }}>
      <View style={styles.sortOptionLeft}><Ionicons name={icon} size={20} color={sortBy === value ? colors.primary : colors.textSecondary} /><Text style={[styles.sortOptionLabel, { color: sortBy === value ? colors.primary : colors.text }]}>{label}</Text></View>
      {sortBy === value && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
    </TouchableOpacity>
  );

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCardsRow}>
          <SummaryCard type="today" title="Total Leads (Today)" count={displayStats.today} icon="people" gradient={['#3b82f6', '#2563eb']} />
          <SummaryCard 
            type="week" 
            title="Total Leads (Week)" 
            count={displayStats.week} 
            icon="calendar" 
            gradient={['#8b5cf6', '#7c3aed']} 
          />
          <SummaryCard 
            type="month" 
            title="Total Leads (Month)" 
            count={displayStats.month} 
            icon="calendar-outline" 
            gradient={['#ec4899', '#db2777']} 
          />
        </View>
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
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => {
                setEditingLeadId(null);
                setFormData({ lead_id: getNextLeadId(), name: '', company_name: '', phone: '', email: '', source: '', event_type: '', event_location: '', package_name: '', total_price: '', status: 'new', stage: 'new', event_date: format(new Date(), 'yyyy-MM-dd'), next_follow_up: '', notes: '' });
                setModalVisible(true);
              }}><Ionicons name="add" size={24} color="#fff" /><Text style={styles.addBtnText}>Add Lead</Text></TouchableOpacity>
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
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Lead ID</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                    value={formData.lead_id}
                    onChangeText={handleLeadIdChange}
                    placeholder="e.g. L0001"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={5}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => { Keyboard.dismiss(); setShowEventDatePicker(true); }}
                  >
                    <Text style={{ color: colors.text }}>{formData.event_date ? format(parseISO(formData.event_date), 'dd-MMM-yy') : ''}</Text>
                    <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showEventDatePicker && (
                    <DateTimePicker
                      value={parseISO(formData.event_date)}
                      mode="date"
                      display="default"
                      onChange={(e, d) => {
                        if (Platform.OS === 'android') {
                          setShowEventDatePicker(false);
                          if (e.type === 'set' && d) {
                            setFormData({ ...formData, event_date: format(d, 'yyyy-MM-dd') });
                          }
                        } else {
                          if (d) setFormData({ ...formData, event_date: format(d, 'yyyy-MM-dd') });
                          if (e.type === 'set' || e.type === 'dismissed') setShowEventDatePicker(false);
                        }
                      }}
                    />
                  )}
                </View>

                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Name *</Text><TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={formData.name} onChangeText={handleNameChange} placeholder="Enter lead name" placeholderTextColor={colors.textTertiary} /></View>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Company Name (Optional)</Text><TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={formData.company_name} onChangeText={(text) => setFormData({ ...formData, company_name: text })} placeholder="Enter company name" placeholderTextColor={colors.textTertiary} /></View>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number *</Text><TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={formData.phone} onChangeText={handlePhoneChange} placeholder="10-digit number" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" maxLength={10} /></View>
                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Gmail (Optional)</Text><TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={formData.email} onChangeText={handleEmailChange} placeholder="example@gmail.com" placeholderTextColor={colors.textTertiary} keyboardType="email-address" autoCapitalize="none" /></View>

                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Lead Source</Text><TouchableOpacity style={[styles.input, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => { Keyboard.dismiss(); setIsSourcePickerVisible(true); }}><Text style={{ color: formData.source ? colors.text : colors.textTertiary }}>{formData.source || 'Select source'}</Text><Ionicons name="chevron-down" size={20} color={colors.textSecondary} /></TouchableOpacity></View>



                <View style={styles.inputGroup}><Text style={[styles.label, { color: colors.textSecondary }]}>Lead Stage</Text><TouchableOpacity style={[styles.input, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => { Keyboard.dismiss(); setIsStagePickerVisible(true); }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{formData.stage && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LEAD_STAGES.find(s => s.value === formData.stage)?.color }} />}<Text style={{ color: colors.text }}>{LEAD_STAGES.find(s => s.value === formData.stage)?.label || 'Select stage'}</Text></View><Ionicons name="chevron-down" size={20} color={colors.textSecondary} /></TouchableOpacity></View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Next Follow Up (Optional)</Text>
                  <TouchableOpacity 
                    style={[styles.input, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                    onPress={() => { Keyboard.dismiss(); setShowFollowUpPicker(true); }}
                  >
                    <Text style={{ color: formData.next_follow_up ? colors.text : colors.textTertiary }}>{formData.next_follow_up || 'Select follow up date'}</Text>
                    <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showFollowUpPicker && (
                    <DateTimePicker 
                      value={formData.next_follow_up ? parseISO(formData.next_follow_up) : new Date()} 
                      mode="date" 
                      display="default" 
                      onChange={(e, d) => { 
                        if (Platform.OS === 'android') {
                          setShowFollowUpPicker(false); 
                          if (e.type === 'set' && d) {
                            setFormData({ ...formData, next_follow_up: format(d, 'yyyy-MM-dd') }); 
                          }
                        } else {
                          if (d) setFormData({ ...formData, next_follow_up: format(d, 'yyyy-MM-dd') });
                          if (e.type === 'set' || e.type === 'dismissed') setShowFollowUpPicker(false);
                        }
                      }} 
                      minimumDate={new Date()} 
                    />
                  )}
                </View>
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
              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary }]}>Date Range</Text>
              <View style={styles.rangeRow}>
                <TouchableOpacity style={[styles.input, { flex: 1, backgroundColor: colors.background }]} onPress={() => setActivePicker('startDate')}><Text style={{ color: filters.startDate ? colors.text : colors.textTertiary }}>{filters.startDate || 'Start Date'}</Text></TouchableOpacity>
                <Text style={{ color: colors.textSecondary }}>to</Text>
                <TouchableOpacity style={[styles.input, { flex: 1, backgroundColor: colors.background }]} onPress={() => setActivePicker('endDate')}><Text style={{ color: filters.endDate ? colors.text : colors.textTertiary }}>{filters.endDate || 'End Date'}</Text></TouchableOpacity>
              </View>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 20 }]}>Lead Stage</Text>
              <View style={styles.filterSourceGrid}>
                <TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.stage === 'all' ? colors.primary : colors.background, borderColor: colors.primary }]} onPress={() => setFilters({ ...filters, stage: 'all' })}>
                  <Text style={{ color: filters.stage === 'all' ? '#fff' : colors.textSecondary }}>All</Text>
                </TouchableOpacity>
                {LEAD_STAGES.map(s => (
                  <TouchableOpacity key={s.value} style={[styles.filterChip, { backgroundColor: filters.stage === s.value ? colors.primary : colors.background, borderColor: colors.primary }]} onPress={() => setFilters({ ...filters, stage: s.value })}>
                    <Text style={{ color: filters.stage === s.value ? '#fff' : colors.textSecondary }}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
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

              <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary, marginTop: 30, marginBottom: 20 }]} onPress={() => {
                setActiveSummaryType(null);
                setIsFilterModalVisible(false);
              }}><Text style={styles.submitButtonText}>Apply Filters</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        {activePicker && <DateTimePicker value={filters[activePicker as keyof typeof filters] ? parseISO(filters[activePicker as keyof typeof filters] as string) : new Date()} mode="date" onChange={onDatePickerChange} />}
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
                        <Text style={{ color: tempMonth === i ? '#fff' : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{m.substring(0, 3)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>


                  <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary, height: 52 }]} onPress={handleApplyMonthYear}>
                    <Text style={styles.submitButtonText}>Apply Filters</Text>
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
                          // Reset tempWeek if the new month has fewer weeks than currently selected
                          const newMaxWeeks = getWeeksInMonthCount(i, tempYear);
                          if (tempWeek > newMaxWeeks) {
                            setTempWeek(newMaxWeeks);
                          }
                        }}
                      >
                        <Text style={{ color: tempMonth === i ? '#fff' : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{m.substring(0, 3)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>


                  <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Select Week</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
                    {Array.from({ length: getWeeksInMonthCount(tempMonth, tempYear) }, (_, i) => i + 1).map((w) => (
                      <TouchableOpacity
                        key={w}
                        style={[
                          styles.filterChip, 
                          { 
                            backgroundColor: tempWeek === w ? colors.primary : colors.background, 
                            borderColor: tempWeek === w ? colors.primary : colors.border,
                            flex: 1,
                            minWidth: '45%',
                            height: 44,
                            justifyContent: 'center',
                            alignItems: 'center'
                          }
                        ]}
                        onPress={() => setTempWeek(w)}
                      >
                        <Text style={{ color: tempWeek === w ? '#fff' : colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Week {w}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary, height: 52 }]} onPress={handleApplyMonthWeek}>
                    <Text style={styles.submitButtonText}>Apply Filters</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Other Modals (Sort, Source Picker) */}
      <Modal visible={isSortModalVisible} transparent animationType="fade" onRequestClose={() => setIsSortModalVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsSortModalVisible(false)}><View style={[styles.sortModalContainer, { backgroundColor: colors.surface }]}><View style={styles.sortModalHeader}><Text style={[styles.sortModalTitle, { color: colors.text }]}>Sort Leads</Text></View><View style={{ padding: 8 }}><SortOption label="ID: Newest First" value="id_desc" icon="barcode-outline" /><SortOption label="ID: Oldest First" value="id_asc" icon="barcode-outline" /><SortOption label="Date: Newest First" value="date_desc" icon="calendar" /><SortOption label="Date: Oldest First" value="date_asc" icon="calendar-outline" /><SortOption label="Name: A to Z" value="name_asc" icon="text-outline" /><SortOption label="Name: Z to A" value="name_desc" icon="text-outline" /></View></View></TouchableOpacity>
      </Modal>

      <Modal visible={isSourcePickerVisible} transparent={true} animationType="fade" onRequestClose={() => setIsSourcePickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsSourcePickerVisible(false)}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '85%' }]}>
            <View style={styles.pickerHeader}><Text style={[styles.pickerTitle, { color: colors.text }]}>Select Lead Source</Text></View>
            <FlatList
              data={leadSources}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setFormData({ ...formData, source: item.label }); setIsSourcePickerVisible(false); }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.text }]}>{item.label}</Text>
                  {formData.source === item.label && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isEventTypePickerVisible} transparent={true} animationType="fade" onRequestClose={() => setIsEventTypePickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsEventTypePickerVisible(false)}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '85%' }]}>
            <View style={styles.pickerHeader}><Text style={[styles.pickerTitle, { color: colors.text }]}>Select Event Type</Text></View>
            <FlatList
              data={eventTypes}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setFormData({ ...formData, event_type: item.label }); setIsEventTypePickerVisible(false); }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.text }]}>{item.label}</Text>
                  {formData.event_type === item.label && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isStagePickerVisible} transparent={true} animationType="fade" onRequestClose={() => setIsStagePickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsStagePickerVisible(false)}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '85%' }]}>
            <View style={styles.pickerHeader}><Text style={[styles.pickerTitle, { color: colors.text }]}>Select Lead Stage</Text></View>
            <FlatList
              data={LEAD_STAGES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setFormData({ ...formData, stage: item.value }); setIsStagePickerVisible(false); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.color }} />
                    <Text style={[styles.pickerItemText, { color: colors.text }]}>{item.label}</Text>
                  </View>
                  {formData.stage === item.value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Lead Dropdown Modal */}
      <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
          <View style={[styles.dropdownContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.dropdownHeader}>
              <Text style={[styles.dropdownTitle, { color: colors.text }]}>Actions</Text>
              <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.dropdownActions}>
              <TouchableOpacity
                style={[styles.dropdownAction, { borderBottomColor: colors.border }]}
                onPress={() => {
                  if (selectedLeadForDetail) {
                    handleConvertSingleLead(selectedLeadForDetail);
                    setDropdownVisible(false);
                  }
                }}
              >
                <Ionicons name="person-add" size={24} color={colors.success} />
                <Text style={[styles.dropdownActionText, { color: colors.text }]}>Convert to Client</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dropdownAction, { borderBottomColor: colors.border }]}
                onPress={() => {
                  if (selectedLeadForDetail) {
                    setSelectedLeadForDetail(selectedLeadForDetail);
                    setIsDetailModalVisible(true);
                    setDropdownVisible(false);
                  }
                }}
              >
                <Ionicons name="eye-outline" size={24} color={colors.info} />
                <Text style={[styles.dropdownActionText, { color: colors.text }]}>View Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dropdownAction, { borderBottomColor: colors.border }]}
                onPress={() => {
                  if (selectedLeadForDetail) {
                    handleEdit(selectedLeadForDetail);
                    setDropdownVisible(false);
                  }
                }}
              >
                <Ionicons name="create-outline" size={24} color={colors.primary} />
                <Text style={[styles.dropdownActionText, { color: colors.text }]}>Edit Lead</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dropdownAction, { borderBottomColor: colors.border }]}
                onPress={() => {
                  if (selectedLeadForDetail) {
                    handleDelete(selectedLeadForDetail.id);
                    setDropdownVisible(false);
                  }
                }}
              >
                <Ionicons name="trash-outline" size={24} color={colors.error} />
                <Text style={[styles.dropdownActionText, { color: colors.text }]}>Delete Lead</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Lead Detail Modal */}
      <Modal visible={isDetailModalVisible} animationType="fade" transparent={true} onRequestClose={() => setIsDetailModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsDetailModalVisible(false)}>
          <View style={[styles.modalContainer, { width: '90%' }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Lead Details</Text>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{selectedLeadForDetail?.lead_id}</Text>
                </View>
                <TouchableOpacity onPress={() => setIsDetailModalVisible(false)}>
                  <Ionicons name="close" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
                <DetailRow label="Name" value={selectedLeadForDetail?.name} icon="person-outline" />
                <DetailRow label="Company" value={selectedLeadForDetail?.company_name} icon="business-outline" />
                <DetailRow label="Phone" value={selectedLeadForDetail?.phone} icon="call-outline" />
                <DetailRow label="Email" value={selectedLeadForDetail?.email} icon="mail-outline" />
                <DetailRow label="Source" value={selectedLeadForDetail?.source} icon="share-social-outline" />
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconContainer, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="flag-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.detailTextContainer}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Stage</Text>
                    <View style={[styles.stageBadge, { backgroundColor: LEAD_STAGES.find(s => s.value === selectedLeadForDetail?.stage)?.color + '20' || colors.primary + '20', marginTop: 4 }]}>
                      <Text style={[styles.stageText, { color: LEAD_STAGES.find(s => s.value === selectedLeadForDetail?.stage)?.color || colors.primary }]}>
                        {LEAD_STAGES.find(s => s.value === selectedLeadForDetail?.stage)?.label || selectedLeadForDetail?.stage || 'New'}
                      </Text>
                    </View>
                  </View>
                </View>
                <DetailRow label="Date" value={selectedLeadForDetail?.event_date ? format(parseISO(selectedLeadForDetail.event_date), 'dd/MM/yyyy') : undefined} icon="calendar-outline" />
                <DetailRow label="Next Follow Up" value={selectedLeadForDetail?.next_follow_up ? format(parseISO(selectedLeadForDetail.next_follow_up), 'dd/MM/yyyy') : undefined} icon="alarm-outline" />
                <DetailRow label="Notes" value={selectedLeadForDetail?.notes} icon="document-text-outline" />
                <View style={{ height: 20 }} />
                <TouchableOpacity 
                  style={[styles.submitButton, { backgroundColor: colors.primary, width: '100%', marginBottom: 10 }]} 
                  onPress={() => {
                    if (selectedLeadForDetail) {
                      setIsDetailModalVisible(false);
                      handleEdit(selectedLeadForDetail);
                    }
                  }}
                >
                  <Text style={styles.submitButtonText}>Edit Lead</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryContainer: { padding: 16, gap: 12 },
  summaryCardsRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  clearSummaryBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, marginTop: 4 },
  clearSummaryBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  clearSummaryText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 0, elevation: 4, overflow: 'hidden' },
  summaryContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  summaryCount: { color: '#fff', fontWeight: '800' },
  summaryTitle: { color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  summarySubtitle: { color: 'rgba(255,255,255,0.6)', fontWeight: '500', marginTop: 2 },
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
  tableHeader: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, gap: 12 },
  columnHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  tableRow: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, alignItems: 'center', gap: 12 },
  colSelect: { width: 40, alignItems: 'center', justifyContent: 'center' },
  colId: { width: 70, textAlign: 'center' },
  colActions: { width: 140, alignItems: 'center', justifyContent: 'center' },
  colDate: { width: 100, textAlign: 'center' },
  colName: { width: 150, textAlign: 'center' },
  colCompany: { width: 150, textAlign: 'center' },
  colPhone: { width: 120, textAlign: 'center' },
  colEmail: { width: 180, textAlign: 'center' },
  colSource: { width: 100, textAlign: 'center' },
  colStage: { width: 100, alignItems: 'center', justifyContent: 'center' },
  colIdName: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  colNotes: { width: 180, textAlign: 'center' },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  stageText: { fontSize: 12, fontWeight: '700' },
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
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 15 },
  detailIconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  detailTextContainer: { flex: 1 },
  detailLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  detailValue: { fontSize: 16, fontWeight: '600' },

  // Dropdown styles
  dropdownContainer: { width: '80%', borderRadius: 20, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  dropdownTitle: { fontSize: 18, fontWeight: '700' },
  dropdownActions: { paddingVertical: 8 },
  dropdownAction: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  dropdownActionText: { fontSize: 16, fontWeight: '600', marginLeft: 16 },
});
