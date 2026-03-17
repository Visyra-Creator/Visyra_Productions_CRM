import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
  ActivityIndicator,
  Switch,
  Pressable,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import * as paymentsService from '../src/api/services/payments';
import * as paymentRecordsService from '../src/api/services/paymentRecords';
import * as clientsService from '../src/api/services/clients';
import * as shootsService from '../src/api/services/shoots';
import * as appOptionsService from '../src/api/services/appOptions';
import { fetchPaymentsPageData } from '../src/api/services/paymentsPage';
import * as expensesService from '../src/api/services/expenses';
import { format, parseISO, isSameDay, isSameWeek, isSameMonth, isBefore, isWithinInterval, startOfMonth, endOfMonth, isAfter } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../src/store/authStore';

interface Invoice {
  id: number;
  payment_id?: string;
  client_id: string | number;
  shoot_id: string | number;
  client_name?: string;
  event_type?: string;
  total_amount: number;
  due_date?: string;
  created_at?: string;
  status?: string;
  calculatedBalance?: number;
  calculatedTotalPaid?: number;
}

interface PaymentRecord {
  id: number;
  invoice_id: number;
  amount: number;
  payment_date: string;
  payment_method?: string;
  notes?: string;
  created_at?: string;
}

interface Client { id: string | number; name: string; }
interface Shoot { id: string | number; client_id: string | number; event_type: string; }
interface AppOption {
  id: number;
  type: string;
  label: string;
  value: string;
  color: string;
}

const PAYMENT_METHODS_DEFAULTS = [
  { label: 'Cash', value: 'cash' },
  { label: 'Credit Card', value: 'credit_card' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'UPI', value: 'upi' },
  { label: 'Cheque', value: 'cheque' },
];

export default function Payments() {
  // Hooks must be called unconditionally and in the same order
  const { width, height } = useWindowDimensions();
  const isTablet = width > 768;
  const isSmallScreen = !isTablet;
  const summaryCardBasis = isTablet ? '31%' : (width < 390 ? '48%' : '31%');
  const { colors } = useThemeStore();
  const router = useRouter();
  const { role } = useAuthStore();
  const params = useLocalSearchParams();
  const lastProcessedNavigationToken = useRef<string | null>(null);
  const getParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const autoEditPaymentId = getParam(params?.autoEditPaymentId);
  const autoFillClientId = getParam(params?.autoFillClientId);
  const autoFillClientName = getParam(params?.autoFillClientName) ?? '';
  const autoFillTotalPrice = getParam(params?.autoFillTotalPrice) ?? '0';
  const autoFillEventType = getParam(params?.autoFillEventType) ?? '';
  const hasAutoOpenParams = Boolean(autoEditPaymentId || autoFillClientId || getParam(params?.openPaymentFormAt));
  const openPaymentFormAt = hasAutoOpenParams
    ? (getParam(params?.openPaymentFormAt)
      ?? [autoEditPaymentId ?? '', autoFillClientId ?? '', autoFillClientName, autoFillTotalPrice, autoFillEventType].join(':'))
    : undefined;

  // Data State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<AppOption[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // UI State
  const [modalVisible, setModalVisible] = useState(false);
  const [addPaymentModalVisible, setAddPaymentModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showPaymentHistoryId, setShowPaymentHistoryId] = useState<number | null>(null);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [shootPickerVisible, setShootPickerVisible] = useState(false);
  const [methodPickerVisible, setMethodPickerVisible] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [showClientPaymentsDropdown, setShowClientPaymentsDropdown] = useState(false);
  const [editingPaymentRecord, setEditingPaymentRecord] = useState<PaymentRecord | null>(null);
  const [prefilledShootEventLabel, setPrefilledShootEventLabel] = useState('');

  // Filter and Sort State
  const [sortBy, setSortBy] = useState<'id_asc' | 'id_desc' | 'date_desc' | 'date_asc' | 'client_asc'>('id_asc');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    client_id: 'all',
    payment_method: 'all',
    minAmount: '',
    maxAmount: '',
    minBalance: '',
    maxBalance: ''
  });
  const [activePicker, setActivePicker] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    shoot_id: null as string | number | null,
    total_amount: '',
    due_date: new Date(),
    payment_method: 'UPI',
    payment_title: '',
    present_date: new Date(),
    first_paid_amount: ''
  });

  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    payment_date: new Date(),
    payment_method: 'UPI',
    notes: ''
  });
  const isLoadingDataRef = useRef(false);
  const lastLoadAtRef = useRef(0);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Role Guard: Check auth early ────────────────────────────────────────────
  useEffect(() => {
    if (role !== null && role !== 'admin') {
      router.replace('/');
    }
  }, [role, router]);

  // Don't early return - will conditionally render at JSX level
  // ──────────────────────────────────────────────────────────────────────────

  const resetInvoiceForm = useCallback(() => {
    setFormData({
      client_id: '',
      client_name: '',
      shoot_id: null,
      total_amount: '',
      due_date: new Date(),
      payment_method: 'UPI',
      payment_title: '',
      present_date: new Date(),
      first_paid_amount: ''
    });
    setPrefilledShootEventLabel('');
    setEditingInvoice(null);
    setClientPickerVisible(false);
    setShootPickerVisible(false);
    setMethodPickerVisible(false);
    setShowDueDatePicker(false);
    setShowPaymentDatePicker(false);
    setShowClientPaymentsDropdown(false);
    setClientSearch('');
  }, []);

  const closeInvoiceModal = useCallback(() => {
    if (openPaymentFormAt) {
      lastProcessedNavigationToken.current = openPaymentFormAt;
    }

    setModalVisible(false);
    resetInvoiceForm();
  }, [openPaymentFormAt, resetInvoiceForm]);

  const loadData = useCallback(async (reason: string, opts?: { force?: boolean }) => {
    const now = Date.now();
    if (isLoadingDataRef.current) {
      console.log(`[Payments] Skipping ${reason}; fetch already in progress.`);
      return;
    }
    if (!opts?.force && now - lastLoadAtRef.current < 500) {
      console.log(`[Payments] Skipping ${reason}; throttled.`);
      return;
    }

    isLoadingDataRef.current = true;
    try {
      console.log(`[Payments] Loading data (${reason})...`);
      setDbReady(true);
      setLoading(true);

      const [data, expResult] = await Promise.all([
        fetchPaymentsPageData({
          paymentMethodsDefaults: PAYMENT_METHODS_DEFAULTS,
        }),
        expensesService.getAll(),
      ]);

      setInvoices(data.invoices as Invoice[]);
      setPaymentRecords(data.paymentRecords as PaymentRecord[]);
      setClients(data.clients as Client[]);
      setShoots(data.shoots as Shoot[]);
      setPaymentMethods(data.paymentMethods as AppOption[]);
      setExpenses(expResult as any[]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      lastLoadAtRef.current = Date.now();
      isLoadingDataRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData('mount', { force: true }); }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      void loadData('focus');
      return () => {};
    }, [loadData])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadData('app-active');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadData]);

  useEffect(() => {
    const scheduleRefresh = (reason: string) => {
      if (realtimeRefreshTimeoutRef.current) clearTimeout(realtimeRefreshTimeoutRef.current);
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        void loadData(reason, { force: true });
      }, 250);
    };

    const unsubscribePayments = paymentsService.subscribeToPaymentChanges(() => scheduleRefresh('realtime-payments'));
    const unsubscribePaymentRecords = paymentRecordsService.subscribeToPaymentRecordChanges(() => scheduleRefresh('realtime-payment-records'));
    const unsubscribeClients = clientsService.subscribeToClientChanges(() => scheduleRefresh('realtime-clients'));
    const unsubscribeShoots = shootsService.subscribeToShootChanges(() => scheduleRefresh('realtime-shoots'));
    const unsubscribeExpenses = expensesService.subscribeToExpenseChanges(() => scheduleRefresh('realtime-expenses'));
    const unsubscribeOptions = appOptionsService.subscribeToAppOptionChanges(() => scheduleRefresh('realtime-options'));

    return () => {
      if (realtimeRefreshTimeoutRef.current) clearTimeout(realtimeRefreshTimeoutRef.current);
      unsubscribePayments();
      unsubscribePaymentRecords();
      unsubscribeClients();
      unsubscribeShoots();
      unsubscribeExpenses();
      unsubscribeOptions();
    };
  }, [loadData]);

  // Handle auto-fill form from navigation params
  useEffect(() => {
    if (!openPaymentFormAt || lastProcessedNavigationToken.current === openPaymentFormAt) {
      return;
    }

    if (autoEditPaymentId && invoices.length > 0) {
      const invoiceToEdit = invoices.find(inv => String(inv.id) === String(autoEditPaymentId));

      if (invoiceToEdit && !modalVisible) {
        const firstPayment = paymentRecords.find(p => p.invoice_id === invoiceToEdit.id);
        const eventTypeParam = autoFillEventType || '';

        let selectedShootId = invoiceToEdit.shoot_id;
        if (eventTypeParam && shoots.length > 0) {
          const matchingShoot = shoots.find(
            s => s.client_id === Number(invoiceToEdit.client_id) && s.event_type === eventTypeParam
          );
          if (matchingShoot) {
            selectedShootId = matchingShoot.id;
          }
        }

        setEditingInvoice(invoiceToEdit);
        setFormData({
          client_id: String(invoiceToEdit.client_id),
          client_name: invoiceToEdit.client_name || '',
          shoot_id: selectedShootId,
          total_amount: String(invoiceToEdit.total_amount),
          due_date: invoiceToEdit.due_date ? parseISO(invoiceToEdit.due_date) : new Date(),
          payment_method: firstPayment?.payment_method || 'UPI',
          payment_title: firstPayment?.notes || '',
          present_date: firstPayment?.payment_date ? parseISO(firstPayment.payment_date) : new Date(),
          first_paid_amount: firstPayment ? String(firstPayment.amount) : ''
        });
        setPrefilledShootEventLabel(eventTypeParam || invoiceToEdit.event_type || '');
        setModalVisible(true);
        lastProcessedNavigationToken.current = openPaymentFormAt;
      }
      return;
    }

    if (autoFillClientId && clients.length > 0) {
      const clientId = autoFillClientId;
      const clientName = autoFillClientName;
      const totalPrice = autoFillTotalPrice;
      const eventType = autoFillEventType;

      if (!modalVisible) {
        let selectedShootId: number | null = null;
        if (eventType && shoots.length > 0) {
          const matchingShoot = shoots.find(
            s => String(s.client_id) === String(clientId) && normalizeEventText(s.event_type) === normalizeEventText(eventType)
          );
          if (matchingShoot) {
            selectedShootId = matchingShoot.id;
          }
        }

        setFormData(prev => ({
          ...prev,
          client_id: clientId,
          client_name: clientName,
          total_amount: totalPrice,
          shoot_id: selectedShootId,
          due_date: new Date()
        }));
        setPrefilledShootEventLabel(eventType);
        setModalVisible(true);
        lastProcessedNavigationToken.current = openPaymentFormAt;
      }
    }
  }, [
    autoEditPaymentId,
    autoFillClientId,
    autoFillClientName,
    autoFillTotalPrice,
    autoFillEventType,
    openPaymentFormAt,
    clients.length,
    invoices.length,
    paymentRecords.length,
    shoots.length,
    modalVisible
  ]);

  const getInvoiceBalance = (invoiceId: number): number => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return 0;
    const totalPaid = paymentRecords
      .filter(pr => pr.invoice_id === invoiceId)
      .reduce((sum, pr) => sum + pr.amount, 0);
    return invoice.total_amount - totalPaid;
  };

  const getInvoiceTotalPaid = (invoiceId: number): number => {
    return paymentRecords
      .filter(pr => pr.invoice_id === invoiceId)
      .reduce((sum, pr) => sum + pr.amount, 0);
  };

  const getInvoiceStatus = (invoice: Invoice): string => {
    const balance = getInvoiceBalance(invoice.id);
    const today = new Date();
    
    if (balance === 0) return 'paid';
    if (balance > 0 && invoice.due_date) {
      try {
        const dueDate = parseISO(invoice.due_date);
        if (isAfter(today, dueDate)) return 'overdue';
      } catch (e) {}
    }
    return balance > 0 ? 'partial' : 'pending';
  };

  const [expenses, setExpenses] = useState<any[]>([]);

  const stats = useMemo(() => {
    const now = new Date();
    const totalRevenue = invoices.reduce((s, inv) => s + (inv.total_amount || 0), 0);
    const totalCollected = paymentRecords.reduce((s, pr) => s + (pr.amount || 0), 0);
    const thisMonth = paymentRecords
      .filter(pr => {
        try { return isWithinInterval(parseISO(pr.payment_date), { start: startOfMonth(now), end: endOfMonth(now) }); } catch (e) { return false; }
      })
      .reduce((s, pr) => s + (pr.amount || 0), 0);
    return { totalRevenue, thisMonth, totalCollected };
  }, [invoices, paymentRecords]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }, [expenses]);

  const profit = useMemo(() => {
    return stats.totalCollected - totalExpenses;
  }, [stats.totalCollected, totalExpenses]);

  const isAnyFilterActive = useMemo(() => {
    return filters.startDate !== '' || filters.endDate !== '' || filters.status !== 'all' || filters.client_id !== 'all' || filters.payment_method !== 'all' || filters.minAmount !== '' || filters.maxAmount !== '' || filters.minBalance !== '' || filters.maxBalance !== '';
  }, [filters]);

  const filteredInvoices = useMemo(() => {
    let result = [...invoices];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(inv =>
        (inv.client_name?.toLowerCase().includes(query)) ||
        (inv.payment_id?.toLowerCase().includes(query))
      );
    }

    // Apply filters
    if (filters.status !== 'all') {
      result = result.filter(inv => {
        const balance = getInvoiceBalance(inv.id);
        const status = getInvoiceStatus(inv);
        return status === filters.status;
      });
    }
    if (filters.client_id !== 'all') {
      result = result.filter(inv => String(inv.client_id) === String(filters.client_id));
    }
    if (filters.payment_method !== 'all') {
      result = result.filter(inv => {
        const payments = paymentRecords.filter(p => p.invoice_id === inv.id);
        return payments.some(p => p.payment_method === filters.payment_method);
      });
    }
    if (filters.minAmount) {
      const minAmount = parseFloat(filters.minAmount);
      result = result.filter(inv => inv.total_amount >= minAmount);
    }
    if (filters.maxAmount) {
      const maxAmount = parseFloat(filters.maxAmount);
      result = result.filter(inv => inv.total_amount <= maxAmount);
    }
    if (filters.minBalance) {
      const minBalance = parseFloat(filters.minBalance);
      result = result.filter(inv => getInvoiceBalance(inv.id) >= minBalance);
    }
    if (filters.maxBalance) {
      const maxBalance = parseFloat(filters.maxBalance);
      result = result.filter(inv => getInvoiceBalance(inv.id) <= maxBalance);
    }
    if (filters.startDate) {
      result = result.filter(inv => {
        const payments = paymentRecords.filter(p => p.invoice_id === inv.id);
        return payments.some(p => p.payment_date >= filters.startDate);
      });
    }
    if (filters.endDate) {
      result = result.filter(inv => {
        const payments = paymentRecords.filter(p => p.invoice_id === inv.id);
        return payments.some(p => p.payment_date <= filters.endDate);
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'id_asc': return a.id - b.id;
        case 'id_desc': return b.id - a.id;
        case 'date_desc': {
          const aPayments = paymentRecords.filter(p => p.invoice_id === a.id);
          const bPayments = paymentRecords.filter(p => p.invoice_id === b.id);
          const aDate = aPayments.length > 0 ? parseISO(aPayments[aPayments.length - 1].payment_date) : new Date(a.created_at || '');
          const bDate = bPayments.length > 0 ? parseISO(bPayments[bPayments.length - 1].payment_date) : new Date(b.created_at || '');
          return bDate.getTime() - aDate.getTime();
        }
        case 'date_asc': {
          const aPayments = paymentRecords.filter(p => p.invoice_id === a.id);
          const bPayments = paymentRecords.filter(p => p.invoice_id === b.id);
          const aDate = aPayments.length > 0 ? parseISO(aPayments[aPayments.length - 1].payment_date) : new Date(a.created_at || '');
          const bDate = bPayments.length > 0 ? parseISO(bPayments[bPayments.length - 1].payment_date) : new Date(b.created_at || '');
          return aDate.getTime() - bDate.getTime();
        }
        case 'client_asc': return (a.client_name || '').localeCompare(b.client_name || '');
        default: return 0;
      }
    });

    return result;
  }, [invoices, searchQuery, filters, sortBy, paymentRecords]);

  const getDisplayPaymentId = useCallback((invoice: Invoice) => {
    const rawPaymentId = String(invoice.payment_id ?? '').trim();
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawPaymentId);

    if (rawPaymentId && !looksLikeUuid) {
      return rawPaymentId;
    }

    const index = invoices.findIndex((inv) => String(inv.id) === String(invoice.id));
    const serial = index >= 0 ? index + 1 : 0;
    return `P${String(serial).padStart(4, '0')}`;
  }, [invoices]);

  const normalizeEventText = useCallback((value: string | null | undefined) => {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }, []);

  const resolveShootIdForClientEvent = useCallback((
    clientIdRaw: string | number | null | undefined,
    eventLabelRaw: string | null | undefined,
    preferredShootId?: string | number | null,
  ): string | number | null => {
    const clientId = String(clientIdRaw ?? '').trim();
    if (!clientId) return null;

    const clientShoots = shoots.filter((s) => String(s.client_id) === clientId);
    if (clientShoots.length === 0) return null;

    if (preferredShootId !== null && preferredShootId !== undefined && String(preferredShootId) !== '') {
      const preferred = clientShoots.find((s) => String(s.id) === String(preferredShootId));
      if (preferred) return preferred.id;
    }

    const target = normalizeEventText(eventLabelRaw);
    if (target) {
      const exact = clientShoots.find((s) => normalizeEventText(s.event_type) === target);
      if (exact) return exact.id;

      const fuzzy = clientShoots.find((s) => {
        const eventType = normalizeEventText(s.event_type);
        return eventType.includes(target) || target.includes(eventType);
      });
      if (fuzzy) return fuzzy.id;
    }

    if (clientShoots.length === 1) return clientShoots[0].id;
    return null;
  }, [normalizeEventText, shoots]);

  useEffect(() => {
    if (!formData.client_id || formData.shoot_id || !prefilledShootEventLabel) return;
    const resolved = resolveShootIdForClientEvent(formData.client_id, prefilledShootEventLabel);
    if (resolved) {
      setFormData((prev) => ({ ...prev, shoot_id: resolved }));
    }
  }, [formData.client_id, formData.shoot_id, prefilledShootEventLabel, resolveShootIdForClientEvent]);

  const handleSaveInvoice = async () => {
    console.log('[Payments] Create Invoice handler triggered');
    if (!formData.client_id) {
      console.log('[Payments] Create Invoice blocked: missing client');
      Alert.alert('Error', 'Please select a client');
      return;
    }
    const resolvedShootId = formData.shoot_id ?? resolveShootIdForClientEvent(formData.client_id, prefilledShootEventLabel);
    if (!resolvedShootId) {
      console.log('[Payments] Create Invoice blocked: missing shoot/event');
      Alert.alert('Error', 'Please select a shoot/event');
      return;
    }
    if (!formData.total_amount || isNaN(parseFloat(formData.total_amount))) {
      console.log('[Payments] Create Invoice blocked: invalid total amount', formData.total_amount);
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      const { client_id, total_amount, due_date, present_date, first_paid_amount, payment_method, payment_title } = formData;
      const shoot_id = resolvedShootId;
      const total = parseFloat(total_amount);
      const paidAmount = first_paid_amount ? parseFloat(first_paid_amount) : 0;
      console.log('[Payments] Saving invoice...', { editingInvoiceId: editingInvoice?.id ?? null, client_id, shoot_id, total, paidAmount });

      let invoiceId: number | null = null;

      if (editingInvoice) {
        // Only update invoice details, don't touch payment records
        const updatedInvoice: any = await paymentsService.update(String(editingInvoice.id), {
          client_id,
          shoot_id,
          total_amount: total,
          due_date: format(due_date, 'yyyy-MM-dd'),
        });

        if (!updatedInvoice) {
          throw new Error('Invoice update failed');
        }

        invoiceId = editingInvoice.id;
      } else {
        // Create new invoice
        const result: any = await paymentsService.create({
          client_id,
          shoot_id,
          total_amount: total,
          due_date: format(due_date, 'yyyy-MM-dd'),
          payment_date: format(new Date(), 'yyyy-MM-dd'),
        });
        console.log('[Payments] Invoice create result:', result);

        invoiceId = result?.id ?? null;
      }

      if (!invoiceId) {
        throw new Error('Invoice ID missing');
      }

      // Create first payment record if amount is provided
      if (paidAmount > 0) {
        await paymentRecordsService.create({
          invoice_id: invoiceId,
          amount: paidAmount,
          payment_date: format(present_date, 'yyyy-MM-dd'),
          payment_method,
          notes: payment_title,
        });
      }

      closeInvoiceModal();
      await loadData();
      setModalVisible(false);
      console.log('[Payments] Invoice saved successfully, modal closed, list refreshed');
      Alert.alert('Success', `Invoice ${editingInvoice ? 'updated' : 'created'} successfully`);
    } catch (error) {
      console.error('Error saving invoice:', error);
      Alert.alert('Error', 'Failed to save invoice');
    }
  };

  const handleAddPayment = async () => {
    if (!selectedInvoiceForPayment && !editingPaymentRecord) return;
    if (!paymentFormData.amount || isNaN(parseFloat(paymentFormData.amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      const amount = parseFloat(paymentFormData.amount);

      if (editingPaymentRecord) {
        // Update existing payment record
        await paymentRecordsService.update(String(editingPaymentRecord.id), {
          amount,
          payment_date: format(paymentFormData.payment_date, 'yyyy-MM-dd'),
          payment_method: paymentFormData.payment_method,
          notes: paymentFormData.notes,
        });
        Alert.alert('Success', 'Payment updated successfully');
      } else if (selectedInvoiceForPayment) {
        // Create new payment record
        await paymentRecordsService.create({
          invoice_id: selectedInvoiceForPayment.id,
          amount,
          payment_date: format(paymentFormData.payment_date, 'yyyy-MM-dd'),
          payment_method: paymentFormData.payment_method,
          notes: paymentFormData.notes,
        });
        Alert.alert('Success', 'Payment recorded successfully');
      }

      setPaymentFormData({
        amount: '',
        payment_date: new Date(),
        payment_method: 'UPI',
        notes: ''
      });

      setAddPaymentModalVisible(false);
      setSelectedInvoiceForPayment(null);
      setEditingPaymentRecord(null);
      await loadData('after-save-payment', { force: true });
    } catch (error) {
      console.error('Error saving payment:', error);
      Alert.alert('Error', 'Failed to record payment');
    }
  };

  const handleDeletePaymentRecord = (recordId: number) => {
    Alert.alert('Delete Payment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await paymentRecordsService.delete(String(recordId));
              await loadData('after-delete-payment-record', { force: true });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete payment';
            Alert.alert('Delete blocked', message);
          }
        }
      }
    ]);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    
    // Get the first payment record for this invoice to populate form
    const firstPayment = paymentRecords.find(p => p.invoice_id === invoice.id);
    
    setFormData({
      client_id: String(invoice.client_id),
      client_name: invoice.client_name || '',
      shoot_id: invoice.shoot_id,
      total_amount: String(invoice.total_amount),
      due_date: invoice.due_date ? parseISO(invoice.due_date) : new Date(),
      payment_method: firstPayment?.payment_method || 'UPI',
      payment_title: firstPayment?.notes || '',
      present_date: firstPayment?.payment_date ? parseISO(firstPayment.payment_date) : new Date(),
      first_paid_amount: firstPayment ? String(firstPayment.amount) : ''
    });
    setPrefilledShootEventLabel(invoice.event_type || '');
    setModalVisible(true);
  };

  const handleDeleteInvoice = (invoiceId: number) => {
    Alert.alert('Delete Invoice', 'This will also delete all payment records. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await paymentsService.delete(String(invoiceId));
              await loadData('after-delete-invoice', { force: true });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete invoice';
            Alert.alert('Delete blocked', message);
          }
        }
      }
    ]);
  };

  const SummaryCard = ({ title, count, icon, gradient, color }: any) => {
    const useGradient = Array.isArray(gradient) && gradient.length > 1;
    const content = (
      <View style={styles.summaryContent}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryCount, { fontSize: isTablet ? 24 : 20 }, useGradient ? styles.summaryCountLight : { color: colors.text }]}>{count}</Text>
          <Text
            style={[styles.summaryTitle, { fontSize: isTablet ? 14 : 12 }, useGradient ? styles.summaryTitleLight : { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <View
          style={[
            styles.summaryIconContainer,
            { width: isTablet ? 44 : 36, height: isTablet ? 44 : 36 },
            useGradient ? styles.summaryIconContainerLight : { backgroundColor: (color || colors.primary) + '15' },
          ]}
        >
          <Ionicons name={icon} size={isTablet ? 28 : 24} color={useGradient ? '#fff' : (color || colors.primary)} />
        </View>
      </View>
    );

    if (useGradient) {
      return (
        <LinearGradient colors={gradient} style={[styles.summaryCard, { height: isTablet ? 100 : 80, flexBasis: summaryCardBasis, maxWidth: summaryCardBasis }]}>
          {content}
        </LinearGradient>
      );
    }

    return (
      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, height: isTablet ? 100 : 80, flexBasis: summaryCardBasis, maxWidth: summaryCardBasis }]}>
        {content}
      </View>
    );
  };

  const renderInvoiceRow = ({ item: invoice }: { item: Invoice }) => {
    const balance = getInvoiceBalance(invoice.id);
    const totalPaid = getInvoiceTotalPaid(invoice.id);
    const invoiceStatus = getInvoiceStatus(invoice);
    const invoicePayments = paymentRecords.filter(pr => pr.invoice_id === invoice.id);

    return (
      <View style={{ marginBottom: 16 }}>
        <View style={[styles.invoiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Top Section with Info and Actions */}
          <View style={[styles.invoiceCardTop, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={{ flex: 1, marginRight: 12 }}
              onPress={() => setShowPaymentHistoryId(showPaymentHistoryId === invoice.id ? null : invoice.id)}
              activeOpacity={0.7}
            >
              <View>
                <Text style={[styles.invoiceClient, { color: colors.text }]}>{invoice.client_name || '-'}</Text>
                <View style={styles.invoiceMetaRow}>
                  <Text style={[styles.invoiceId, { color: colors.primary }]}>{getDisplayPaymentId(invoice)}</Text>
                  <Text style={[styles.invoiceMetaDot, { color: colors.textTertiary }]}>•</Text>
                  <Text style={[styles.invoiceMetaText, { color: colors.textSecondary }]}>{invoice.event_type || 'No event type'}</Text>
                </View>
                <View style={styles.invoiceMetaRow}>
                  {invoicePayments.length > 0 && invoicePayments[0].payment_date ? (
                    <Text style={[styles.invoiceMetaText, { color: colors.textSecondary }]}>
                      Last payment: {format(parseISO(invoicePayments[0].payment_date), 'dd-MMM-yy')}
                    </Text>
                  ) : (
                    <Text style={[styles.invoiceMetaText, { color: colors.textTertiary }]}>No payments recorded yet</Text>
                  )}
                  {invoice.due_date && (
                    <>
                      <Text style={[styles.invoiceMetaDot, { color: colors.textTertiary }]}>•</Text>
                      <Text style={[styles.invoiceMetaText, { color: colors.textSecondary }]}>Due {format(parseISO(invoice.due_date), 'dd-MMM-yy')}</Text>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {/* Action Buttons at Top Right */}
            <View style={styles.cardActions}>
              {balance > 0 && (
                <TouchableOpacity
                  style={[styles.actionIconBtn, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => {
                    setSelectedInvoiceForPayment(invoice);
                    setPaymentFormData({ amount: '', payment_date: new Date(), payment_method: 'UPI', notes: '' });
                    setAddPaymentModalVisible(true);
                  }}
                >
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionIconBtn, { backgroundColor: colors.warning + '20' }]}
                onPress={() => handleEditInvoice(invoice)}
              >
                <Ionicons name="create" size={20} color={colors.warning} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionIconBtn, { backgroundColor: colors.error + '20' }]}
                onPress={() => handleDeleteInvoice(invoice.id)}
              >
                <Ionicons name="trash" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats Section */}
          <View style={styles.invoiceStatsSection}>
            <View style={styles.statBlock}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>₹{(invoice.total_amount || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBlock}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Paid</Text>
              <Text style={[styles.statValue, { color: colors.success }]}>₹{totalPaid.toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBlock}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Balance</Text>
              <Text style={[styles.statValue, { color: colors.error }]}>₹{balance.toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={[styles.statusBadgeContainer, { backgroundColor: (invoiceStatus === 'paid' ? colors.success : invoiceStatus === 'overdue' ? colors.error : colors.warning) + '10' }]}>
              <Text style={[styles.statusText, { color: invoiceStatus === 'paid' ? colors.success : invoiceStatus === 'overdue' ? colors.error : colors.warning }]}>
                {invoiceStatus.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Payment History */}
          {showPaymentHistoryId === invoice.id && invoicePayments.length > 0 && (
            <View style={[styles.paymentHistory, { borderTopColor: colors.border }]}>
              <Text style={[styles.historyTitle, { color: colors.text }]}>Payment History</Text>
              {invoicePayments
                .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
                .map((payment, idx) => {
                  const sortedPayments = invoicePayments.sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());
                  const remainingAfter = invoice.total_amount - sortedPayments.slice(0, idx + 1).reduce((s, p) => s + p.amount, 0);
                  return (
                  <View key={payment.id} style={[styles.historyItem, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.historyDate, { color: colors.text }]}>
                        {format(parseISO(payment.payment_date), 'dd-MMM-yy')} • {payment.payment_method || 'N/A'}
                      </Text>
                      {payment.notes && <Text style={[styles.historyNotes, { color: colors.textSecondary }]}>{payment.notes}</Text>}
                    </View>
                    <View style={styles.historyAmount}>
                      <Text style={[styles.historyPaid, { color: colors.success }]}>₹{payment.amount.toLocaleString()}</Text>
                      <Text style={[styles.historyBalance, { color: colors.textSecondary }]}>Remaining: ₹{remainingAfter.toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                      setEditingPaymentRecord(payment);
                      setPaymentFormData({ amount: String(payment.amount), payment_date: parseISO(payment.payment_date), payment_method: payment.payment_method || 'UPI', notes: payment.notes || '' });
                      setAddPaymentModalVisible(true);
                    }} style={styles.deletePaymentBtn}>
                      <Ionicons name="create" size={16} color={colors.warning} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeletePaymentRecord(payment.id)} style={styles.deletePaymentBtn}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // SortOption component
  const SortOption = ({ label, value, icon }: { label: string; value: string; icon: any }) => (
    <TouchableOpacity
      style={[styles.sortOption, { backgroundColor: sortBy === value ? colors.primary : colors.surface, borderColor: colors.border }]}
      onPress={() => {
        setSortBy(value as any);
        setIsSortModalVisible(false);
      }}
    >
      <Ionicons name={icon} size={18} color={sortBy === value ? '#fff' : colors.text} />
      <Text style={[styles.sortOptionText, { color: sortBy === value ? '#fff' : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );


  if (role !== null && role !== 'admin') {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.summaryContainer}>
        <SummaryCard title="Total Income" count={`₹${stats.totalRevenue.toLocaleString()}`} icon="cash-outline" gradient={['#10b981', '#059669']} />
        <SummaryCard title="This Month" count={`₹${stats.thisMonth.toLocaleString()}`} icon="calendar-outline" gradient={['#3b82f6', '#2563eb']} />
        <SummaryCard title="Collected" count={`₹${stats.totalCollected.toLocaleString()}`} icon="checkmark-done-outline" gradient={['#8b5cf6', '#7c3aed']} />
      </View>

      <View style={[styles.filterBar, isSmallScreen && styles.filterBarCompact]}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }, isSmallScreen && styles.searchContainerCompact]}>
          <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search invoices..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setIsSortModalVisible(true)}
        >
          <Ionicons name="swap-vertical" size={20} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: isAnyFilterActive ? colors.primary : colors.surface, borderColor: isAnyFilterActive ? colors.primary : colors.border }]}
          onPress={() => setIsFilterModalVisible(true)}
        >
          <Ionicons name="funnel-outline" size={20} color={isAnyFilterActive ? '#fff' : colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => {
            resetInvoiceForm();
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.financialSummaryContainer}>
        <View style={[styles.financialSummaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.financialSummaryContent}>
            <View style={styles.financialSummaryItem}>
              <Text style={[styles.financialSummaryLabel, { color: colors.textSecondary }]}>Revenue</Text>
              <Text style={[styles.financialSummaryValue, { color: colors.success }]}>₹{stats.totalCollected.toLocaleString()}</Text>
            </View>
            <View style={[styles.financialSummaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.financialSummaryItem}>
              <Text style={[styles.financialSummaryLabel, { color: colors.textSecondary }]}>Expenses</Text>
              <Text style={[styles.financialSummaryValue, { color: colors.error }]}>₹{totalExpenses.toLocaleString()}</Text>
            </View>
            <View style={[styles.financialSummaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.financialSummaryItem}>
              <Text style={[styles.financialSummaryLabel, { color: colors.textSecondary }]}>Profit</Text>
              <Text style={[styles.financialSummaryValue, { color: profit >= 0 ? colors.success : colors.error }]}>
                {profit >= 0 ? `₹${profit.toLocaleString()}` : `-₹${Math.abs(profit).toLocaleString()}`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {filteredInvoices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No invoices found</Text>
          </View>
        ) : (
          filteredInvoices.map((invoice) => <View key={invoice.id}>{renderInvoiceRow({ item: invoice })}</View>)
        )}
      </ScrollView>

      {/* New Invoice Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editingInvoice ? 'Edit Invoice' : 'New Invoice'}</Text>
              <TouchableOpacity onPress={closeInvoiceModal}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Client</Text>
              <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setClientPickerVisible(true)}>
                <Text style={{ color: formData.client_id ? colors.text : colors.textTertiary }}>{formData.client_name || 'Select Client'}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              {clientPickerVisible && (
                <FlatList
                  data={clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))}
                  keyExtractor={item => item.id.toString()}
                  scrollEnabled={false}
                  ListEmptyComponent={<Text style={{ color: colors.textTertiary, padding: 10 }}>No clients found</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerItem, { backgroundColor: formData.client_id === String(item.id) ? colors.primary + '20' : colors.background }]}
                      onPress={() => {
                        setPrefilledShootEventLabel('');
                        setFormData({ ...formData, client_id: String(item.id), client_name: item.name, shoot_id: null });
                        setClientPickerVisible(false);
                        setClientSearch('');
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: formData.client_id === String(item.id) ? '700' : '600' }}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}

              {formData.client_id && (
                <>
                  <TouchableOpacity style={[styles.selector, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]} onPress={() => setShowClientPaymentsDropdown(!showClientPaymentsDropdown)}>
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>View Client Payments ({invoices.filter(inv => String(inv.client_id) === String(formData.client_id)).length})</Text>
                    <Ionicons name={showClientPaymentsDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
                  </TouchableOpacity>

                  {showClientPaymentsDropdown && (
                    <FlatList
                      data={invoices.filter(inv => String(inv.client_id) === String(formData.client_id))}
                      keyExtractor={item => item.id.toString()}
                      scrollEnabled={false}
                      ListEmptyComponent={<Text style={{ color: colors.textTertiary, padding: 10 }}>No payments for this client</Text>}
                      renderItem={({ item }) => {
                        const payments = paymentRecords.filter(p => p.invoice_id === item.id);
                        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
                        const balance = item.total_amount - totalPaid;
                        return (
                          <View style={[styles.pickerItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 4 }}>Invoice: {getDisplayPaymentId(item as Invoice)}</Text>
                              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Total: ₹{item.total_amount.toLocaleString()}</Text>
                              <Text style={{ color: colors.success, fontSize: 12 }}>Paid: ₹{totalPaid.toLocaleString()}</Text>
                              <Text style={{ color: colors.error, fontSize: 12 }}>Balance: ₹{balance.toLocaleString()}</Text>
                            </View>
                          </View>
                        );
                      }}
                    />
                  )}
                </>
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>Shoot / Event</Text>
              <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => { if (!formData.client_id) return Alert.alert('Notice', 'Please select a client first'); setShootPickerVisible(true); }}>
                <Text style={{ color: formData.shoot_id || prefilledShootEventLabel ? colors.text : colors.textTertiary }}>{shoots.find(s => s.id === formData.shoot_id)?.event_type || prefilledShootEventLabel || 'Select Shoot'}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              {shootPickerVisible && (
                <FlatList
                  data={shoots.filter(s => String(s.client_id) === String(formData.client_id))}
                  keyExtractor={item => item.id.toString()}
                  scrollEnabled={false}
                  ListEmptyComponent={<Text style={{ color: colors.textTertiary, padding: 10 }}>No shoots found for this client</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerItem, { backgroundColor: formData.shoot_id === item.id ? colors.primary + '20' : colors.background }]}
                      onPress={() => {
                        setFormData(prev => ({ ...prev, shoot_id: item.id }));
                        setPrefilledShootEventLabel(item.event_type || '');
                        setShootPickerVisible(false);
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: formData.shoot_id === item.id ? '700' : '600' }}>{item.event_type || `Shoot #${item.id}`}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>Total Amount</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" placeholder="₹0" placeholderTextColor={colors.textTertiary} value={formData.total_amount} onChangeText={t => setFormData({ ...formData, total_amount: t })} />

              {/* Dates Row - Due Date and Present Date Side by Side */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Due Date</Text>
                  <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowDueDatePicker(true)}>
                    <Text style={{ color: colors.text }}>{format(formData.due_date, 'dd-MMM-yyyy')}</Text>
                    <Ionicons name="calendar" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Present Date</Text>
                  <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowPaymentDatePicker(true)}>
                    <Text style={{ color: colors.text }}>{format(formData.present_date || new Date(), 'dd-MMM-yyyy')}</Text>
                    <Ionicons name="calendar" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>

              {showDueDatePicker && (
                <DateTimePicker
                  value={formData.due_date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, date) => {
                    if (date) setFormData({ ...formData, due_date: date });
                    setShowDueDatePicker(false);
                  }}
                />
              )}

              {showPaymentDatePicker && (
                <DateTimePicker
                  value={formData.present_date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, date) => {
                    if (date) setFormData({ ...formData, present_date: date });
                    setShowPaymentDatePicker(false);
                  }}
                />
              )}

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20 }]}>First Payment Details</Text>
              
              <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Title / Notes</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="e.g., Advance Payment, Final Payment" placeholderTextColor={colors.textTertiary} value={formData.payment_title} onChangeText={t => setFormData({ ...formData, payment_title: t })} />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Paid Amount</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" placeholder="₹0" placeholderTextColor={colors.textTertiary} value={formData.first_paid_amount} onChangeText={t => setFormData({ ...formData, first_paid_amount: t })} />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Method (Optional)</Text>
              <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setMethodPickerVisible(true)}>
                <Text style={{ color: colors.text }}>{formData.payment_method}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              {methodPickerVisible && (
                <FlatList
                  data={paymentMethods}
                  keyExtractor={item => item.id.toString()}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerItem, { backgroundColor: formData.payment_method === item.label ? colors.primary + '20' : colors.background }]}
                      onPress={() => {
                        setFormData({ ...formData, payment_method: item.label });
                        setMethodPickerVisible(false);
                      }}
                    >
                      <Text style={{ color: colors.text }}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  console.log('Create Invoice button clicked');
                  handleSaveInvoice();
                }}
              >
                <Text style={styles.submitBtnText}>{editingInvoice ? 'Update Invoice' : 'Create Invoice'}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Payment Modal */}
      <Modal visible={addPaymentModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editingPaymentRecord ? 'Edit Payment' : 'Record Payment'}</Text>
              <TouchableOpacity onPress={() => {
                setAddPaymentModalVisible(false);
                setEditingPaymentRecord(null);
                setPaymentFormData({ amount: '', payment_date: new Date(), payment_method: 'UPI', notes: '' });
              }}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>
              {selectedInvoiceForPayment && (
                <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{selectedInvoiceForPayment.client_name}</Text>
                  <Text style={[styles.infoValue, { color: colors.primary }]}>₹{selectedInvoiceForPayment.total_amount.toLocaleString()} Due</Text>
                </View>
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Title / Heading</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="e.g., Advance Payment, Final Payment" placeholderTextColor={colors.textTertiary} value={paymentFormData.notes} onChangeText={t => setPaymentFormData({ ...paymentFormData, notes: t })} />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Amount</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" placeholder="₹0" placeholderTextColor={colors.textTertiary} value={paymentFormData.amount} onChangeText={t => setPaymentFormData({ ...paymentFormData, amount: t })} />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Date</Text>
              <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowPaymentDatePicker(true)}>
                <Text style={{ color: colors.text }}>{format(paymentFormData.payment_date, 'dd-MMM-yyyy')}</Text>
                <Ionicons name="calendar" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              {showPaymentDatePicker && (
                <DateTimePicker
                  value={paymentFormData.payment_date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, date) => {
                    if (date) setPaymentFormData({ ...paymentFormData, payment_date: date });
                    setShowPaymentDatePicker(false);
                  }}
                />
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Method</Text>
              <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setMethodPickerVisible(true)}>
                <Text style={{ color: colors.text }}>{paymentFormData.payment_method}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={handleAddPayment}>
                <Text style={styles.submitBtnText}>{editingPaymentRecord ? 'Update Payment' : 'Record Payment'}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={isSortModalVisible} transparent animationType="fade" onRequestClose={() => setIsSortModalVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsSortModalVisible(false)}>
          <View style={[styles.sortModalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.sortModalHeader}><Text style={[styles.sortModalTitle, { color: colors.text }]}>Sort Payments</Text></View>
            <View style={{ padding: 8 }}>
              <SortOption label="ID: Oldest First" value="id_asc" icon="list-outline" />
              <SortOption label="ID: Newest First" value="id_desc" icon="list-outline" />
              <SortOption label="Date: Newest First" value="date_desc" icon="calendar-outline" />
              <SortOption label="Date: Oldest First" value="date_asc" icon="calendar-outline" />
              <SortOption label="Client: A to Z" value="client_asc" icon="person-outline" />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={isFilterModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1, width: '100%' }} onPress={() => setIsFilterModalVisible(false)} />
          <View style={{ backgroundColor: colors.surface, width: '90%', borderRadius: 24, overflow: 'hidden', maxHeight: '80%', minHeight: '50%', alignSelf: 'center' }}>
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Filter Payments</Text>
              <TouchableOpacity onPress={() => {
                setFilters({
                  startDate: '',
                  endDate: '',
                  status: 'all',
                  client_id: 'all',
                  payment_method: 'all',
                  minAmount: '',
                  maxAmount: '',
                  minBalance: '',
                  maxBalance: ''
                });
              }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView nestedScrollEnabled={true} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={true}>
              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginBottom: 10 }]}>Payment Status</Text>
              <View style={styles.filterSourceGrid}>
                <TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.status === 'all' ? colors.primary : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, status: 'all' })}>
                  <Text style={{ color: filters.status === 'all' ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.status === 'paid' ? colors.success : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, status: 'paid' })}>
                  <Text style={{ color: filters.status === 'paid' ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>Paid</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.status === 'partial' ? colors.warning : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, status: 'partial' })}>
                  <Text style={{ color: filters.status === 'partial' ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>Partial</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.status === 'overdue' ? colors.error : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, status: 'overdue' })}>
                  <Text style={{ color: filters.status === 'overdue' ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>Overdue</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 10 }]}>Client</Text>
              <TouchableOpacity style={[styles.input, { backgroundColor: colors.background, padding: 10, borderRadius: 8 }]} onPress={() => setFilters({ ...filters, client_id: filters.client_id === 'all' ? clients[0]?.id.toString() || 'all' : 'all' })}>
                <Text style={{ color: filters.client_id !== 'all' ? colors.text : colors.textTertiary, fontSize: 13 }}>{filters.client_id !== 'all' ? clients.find(c => String(c.id) === String(filters.client_id))?.name || 'Select Client' : 'All Clients'}</Text>
              </TouchableOpacity>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 10 }]}>Payment Method</Text>
              <View style={styles.filterSourceGrid}>
                <TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.payment_method === 'all' ? colors.primary : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, payment_method: 'all' })}>
                  <Text style={{ color: filters.payment_method === 'all' ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>All</Text>
                </TouchableOpacity>
                {paymentMethods.map(method => (
                  <TouchableOpacity key={method.id} style={[styles.filterChip, { backgroundColor: filters.payment_method === method.label ? colors.primary : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, payment_method: method.label })}>
                    <Text style={{ color: filters.payment_method === method.label ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>{method.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 10 }]}>Amount Range (₹)</Text>
              <View style={styles.rangeRow}>
                <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, padding: 10, borderRadius: 8 }]} value={filters.minAmount} onChangeText={(text) => setFilters({ ...filters, minAmount: text })} placeholder="Min" keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, paddingHorizontal: 8, fontSize: 12 }}>to</Text>
                <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, padding: 10, borderRadius: 8 }]} value={filters.maxAmount} onChangeText={(text) => setFilters({ ...filters, maxAmount: text })} placeholder="Max" keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 10 }]}>Balance Range (₹)</Text>
              <View style={styles.rangeRow}>
                <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, padding: 10, borderRadius: 8 }]} value={filters.minBalance} onChangeText={(text) => setFilters({ ...filters, minBalance: text })} placeholder="Min" keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, paddingHorizontal: 8, fontSize: 12 }}>to</Text>
                <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, padding: 10, borderRadius: 8 }]} value={filters.maxBalance} onChangeText={(text) => setFilters({ ...filters, maxBalance: text })} placeholder="Max" keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 10 }]}>Payment Date Range</Text>
              <View style={styles.rangeRow}>
                <TouchableOpacity style={[styles.input, { flex: 1, backgroundColor: colors.background, padding: 10, borderRadius: 8 }]} onPress={() => setActivePicker('startDate')}>
                  <Text style={{ color: filters.startDate ? colors.text : colors.textTertiary, fontSize: 13 }}>{filters.startDate || 'Start Date'}</Text>
                </TouchableOpacity>
                <Text style={{ color: colors.textSecondary, paddingHorizontal: 8, fontSize: 12 }}>to</Text>
                <TouchableOpacity style={[styles.input, { flex: 1, backgroundColor: colors.background, padding: 10, borderRadius: 8 }]} onPress={() => setActivePicker('endDate')}>
                  <Text style={{ color: filters.endDate ? colors.text : colors.textTertiary, fontSize: 13 }}>{filters.endDate || 'End Date'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={() => {
                setIsFilterModalVisible(false);
              }}>
                <Text style={styles.submitButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1, width: '100%' }} onPress={() => setIsFilterModalVisible(false)} />
        </View>
        {activePicker && <DateTimePicker value={filters[activePicker as keyof typeof filters] ? parseISO(filters[activePicker as keyof typeof filters] as string) : new Date()} mode="date" onChange={(event, date) => {
          if (date) {
            const formattedDate = format(date, 'yyyy-MM-dd');
            setFilters({ ...filters, [activePicker!]: formattedDate });
          }
          setActivePicker(null);
        }} />}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryContainer: { flexDirection: 'row', paddingHorizontal: 10, gap: 6, marginTop: 10, justifyContent: 'space-between', flexWrap: 'wrap' },
  summaryCard: { flexGrow: 1, borderRadius: 16, padding: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, borderWidth: 1, overflow: 'hidden', minWidth: 120 },
  summaryContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryCount: { fontWeight: '800', fontSize: 16 },
  summaryCountLight: { color: '#fff' },
  summaryTitle: { fontWeight: '600', fontSize: 12, marginTop: 4 },
  summaryTitleLight: { color: 'rgba(255,255,255,0.8)' },
  summaryIconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryIconContainerLight: { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 15, marginBottom: 12, alignItems: 'center' },
  filterBarCompact: { flexWrap: 'wrap', rowGap: 10 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, height: 44, borderWidth: 1 },
  searchContainerCompact: { flexBasis: '100%', width: '100%' },
  searchInput: { flex: 1, paddingHorizontal: 8, fontSize: 16 },
  iconButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, elevation: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, elevation: 2 },
  invoiceCard: { borderRadius: 16, overflow: 'hidden', elevation: 2, borderWidth: 1 },
  invoiceCardTop: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1 },
  invoiceId: { fontWeight: '700', fontSize: 13 },
  invoiceClient: { fontWeight: '700', fontSize: 18, marginBottom: 8 },
  invoiceMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  invoiceMetaText: { fontSize: 13, fontWeight: '500' },
  invoiceMetaDot: { marginHorizontal: 6, fontSize: 12, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionIconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  invoiceStatsSection: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 0 },
  statBlock: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 40, marginHorizontal: 0, opacity: 0.1 },
  statLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '800' },
  statusBadgeContainer: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, alignItems: 'center' },
  statusText: { fontSize: 10, fontWeight: '800' },
  paymentHistory: { borderTopWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  historyTitle: { fontWeight: '800', fontSize: 13, marginBottom: 12 },
  historyItem: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyDate: { fontWeight: '600', fontSize: 12, marginBottom: 2 },
  historyNotes: { fontSize: 11 },
  historyAmount: { alignItems: 'flex-end' },
  historyPaid: { fontWeight: '700', fontSize: 13 },
  historyBalance: { fontSize: 11 },
  deletePaymentBtn: { padding: 8 },
  emptyText: { fontSize: 14, fontWeight: '600', marginTop: 16 },
  emptyState: { flex: 1, minHeight: 260, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '92%', maxHeight: '90%', borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15 },
  selector: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoBox: { marginBottom: 20, padding: 15, borderRadius: 12 },
  infoLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  infoValue: { fontSize: 18, fontWeight: '800' },
  submitBtn: { padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 30, marginBottom: 20, justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pickerItem: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  sortOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  sortOptionText: { fontSize: 14, fontWeight: '600', marginLeft: 10 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  sortModalContainer: { width: '85%', borderRadius: 24, padding: 20 },
  sortModalHeader: { marginBottom: 10 },
  sortModalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  filterSectionTitle: { fontSize: 12, fontWeight: '700' },
  filterSourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  submitButton: { padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#007AFF' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  financialSummaryContainer: { paddingHorizontal: 16, marginBottom: 12 },
  financialSummaryCard: { borderRadius: 16, padding: 12, elevation: 2, borderWidth: 1 },
  financialSummaryContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  financialSummaryItem: { flex: 1, alignItems: 'center' },
  financialSummaryLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  financialSummaryValue: { fontSize: 16, fontWeight: '800' },
  financialSummaryDivider: { width: 1, height: 40, marginHorizontal: 8, opacity: 0.3 }
});
