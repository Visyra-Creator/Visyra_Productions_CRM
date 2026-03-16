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
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import * as paymentsService from '../src/api/services/payments';
import * as paymentRecordsService from '../src/api/services/paymentRecords';
import * as clientsService from '../src/api/services/clients';
import * as shootsService from '../src/api/services/shoots';
import * as appOptionsService from '../src/api/services/appOptions';
import * as expensesService from '../src/api/services/expenses';
import { format, parseISO, isSameDay, isSameWeek, isSameMonth, isBefore, isWithinInterval, startOfMonth, endOfMonth, isAfter } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

interface Invoice {
  id: number;
  payment_id?: string;
  client_id: number;
  shoot_id: number;
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

interface Client { id: number; name: string; }
interface Shoot { id: number; client_id: number; event_type: string; }
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
  const { width, height } = useWindowDimensions();
  const isTablet = width > 768;
  const { colors } = useThemeStore();
  const router = useRouter();
  const params = useLocalSearchParams();
  const navigationParamsProcessed = useRef(false);

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
    shoot_id: null as number | null,
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

  const loadData = useCallback(async () => {
    try {
      setDbReady(true);
      setLoading(true);

      // Seed default payment methods if they don't exist
      const options = await appOptionsService.getAll();
      const existingMethods = options.filter((option) => option.type === 'payment_method');
      if (existingMethods.length === 0) {
        for (const method of PAYMENT_METHODS_DEFAULTS) {
          await appOptionsService.create({ type: 'payment_method', label: method.label, value: method.value });
        }
      }

      const [inv, pr, c, s, allOptions] = await Promise.all([
        paymentsService.getAll(),
        paymentRecordsService.getAll(),
        clientsService.getAll(),
        shootsService.getAll(),
        appOptionsService.getAll(),
      ]);

      const clientsById = new Map(c.map((client: any) => [String(client.id), client]));
      const shootsById = new Map(s.map((shoot: any) => [String(shoot.id), shoot]));

      const invoicesWithRelations = [...inv]
        .map((payment: any) => ({
          ...payment,
          client_name: clientsById.get(String(payment.client_id))?.name ?? null,
          event_type: shootsById.get(String(payment.shoot_id))?.event_type ?? null,
        }))
        .sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));

      setInvoices(invoicesWithRelations as Invoice[]);
      setPaymentRecords(
        [...pr].sort((a: any, b: any) => String(b.payment_date ?? '').localeCompare(String(a.payment_date ?? ''))) as PaymentRecord[]
      );
      setClients(
        [...c].sort((a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? ''))) as Client[]
      );
      setShoots(s as Shoot[]);
      setPaymentMethods(
        allOptions
          .filter((option) => option.type === 'payment_method')
          .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? ''))) as AppOption[]
      );
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle auto-fill form from navigation params
  useEffect(() => {
    if (navigationParamsProcessed.current) {
      return;
    }

    if (params?.autoFillClientId && clients.length > 0) {
      const clientId = params.autoFillClientId as string;
      const clientName = params.autoFillClientName as string || '';
      const totalPrice = params.autoFillTotalPrice as string || '0';
      const eventType = params.autoFillEventType as string || '';

      if (!modalVisible) {
        let selectedShootId: number | null = null;
        if (eventType && shoots.length > 0) {
          const matchingShoot = shoots.find(s => s.client_id === parseInt(clientId) && s.event_type === eventType);
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
        setModalVisible(true);
        navigationParamsProcessed.current = true;
      }
    }
  }, [params?.autoFillClientId, params?.autoFillClientName, params?.autoFillTotalPrice, params?.autoFillEventType, clients.length, shoots.length, modalVisible]);

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

  const loadExpenses = useCallback(async () => {
    try {
      const expResult = await expensesService.getAll();
      setExpenses(expResult as any[]);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

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
      result = result.filter(inv => inv.client_id === parseInt(filters.client_id));
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

  const handleSaveInvoice = async () => {
    if (!formData.client_id) { Alert.alert('Error', 'Please select a client'); return; }
    if (!formData.shoot_id) { Alert.alert('Error', 'Please select a shoot/event'); return; }
    if (!formData.total_amount || isNaN(parseFloat(formData.total_amount))) { Alert.alert('Error', 'Please enter a valid amount'); return; }

    try {
      const { client_id, shoot_id, total_amount, due_date, present_date, first_paid_amount, payment_method, payment_title } = formData;
      const total = parseFloat(total_amount);
      const paidAmount = first_paid_amount ? parseFloat(first_paid_amount) : 0;

      if (editingInvoice) {
        // Only update invoice details, don't touch payment records
        await paymentsService.update(String(editingInvoice.id), {
          client_id,
          shoot_id,
          total_amount: total,
          due_date: format(due_date, 'yyyy-MM-dd'),
        });
      } else {
        // Create new invoice
        const result: any = await paymentsService.create({
          client_id,
          shoot_id,
          total_amount: total,
          due_date: format(due_date, 'yyyy-MM-dd'),
          payment_date: format(new Date(), 'yyyy-MM-dd'),
        });

        // Create first payment record if amount is provided
        if (paidAmount > 0 && result?.id) {
          await paymentRecordsService.create({
            invoice_id: result.id,
            amount: paidAmount,
            payment_date: format(present_date, 'yyyy-MM-dd'),
            payment_method,
            notes: payment_title,
          });
        }
      }

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

      setModalVisible(false);
      setEditingInvoice(null);
      loadData();
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
      loadData();
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
            loadData();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete payment');
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
            loadData();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete invoice');
          }
        }
      }
    ]);
  };

  const SummaryCard = ({ title, count, icon, color }: any) => (
    <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.summaryCount, { color: colors.text }]}>{count}</Text>
        <Text style={[styles.summaryTitle, { color: colors.textSecondary }]}>{title}</Text>
      </View>
      <View style={[styles.summaryIconContainer, { backgroundColor: (color || colors.primary) + '15' }]}>
        <Ionicons name={icon} size={24} color={color || colors.primary} />
      </View>
    </View>
  );

  const renderInvoiceRow = ({ item: invoice }: { item: Invoice }) => {
    const balance = getInvoiceBalance(invoice.id);
    const totalPaid = getInvoiceTotalPaid(invoice.id);
    const invoiceStatus = getInvoiceStatus(invoice);
    const invoicePayments = paymentRecords.filter(pr => pr.invoice_id === invoice.id);

    return (
      <View style={{ marginBottom: 16 }}>
        <View style={[styles.invoiceCard, { backgroundColor: colors.surface }]}>
          {/* Top Section with Info and Actions */}
          <View style={[styles.invoiceCardTop, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setShowPaymentHistoryId(showPaymentHistoryId === invoice.id ? null : invoice.id)}
              activeOpacity={0.7}
            >
              <View>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                  <View style={{ flex: 0.8 }}>
                    <Text style={[styles.invoiceId, { color: colors.primary }]}>{invoice.payment_id || `P${invoice.id}`}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.invoiceClient, { color: colors.text }]}>{invoice.client_name || '-'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.invoiceDue, { color: colors.textSecondary }]}>
                      {invoice.event_type || '-'}
                    </Text>
                  </View>
                  {invoicePayments.length > 0 && invoicePayments[0].payment_date && (
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.invoiceDue, { color: colors.textSecondary }]}>
                        {format(parseISO(invoicePayments[0].payment_date), 'dd-MMM-yy')}
                      </Text>
                    </View>
                  )}
                  {invoice.due_date && (
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.invoiceDue, { color: colors.textSecondary }]}>Due: {format(parseISO(invoice.due_date), 'dd-MMM-yy')}</Text>
                    </View>
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.summaryContainer}>
        <SummaryCard title="Total Income" count={`₹${stats.totalRevenue.toLocaleString()}`} icon="cash-outline" color={colors.primary} />
        <SummaryCard title="This Month" count={`₹${stats.thisMonth.toLocaleString()}`} icon="calendar-outline" color={colors.info} />
        <SummaryCard title="Collected" count={`₹${stats.totalCollected.toLocaleString()}`} icon="checkmark-done-outline" color={colors.success} />
      </View>

      <View style={styles.filterBar}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
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
          style={[styles.iconButton, { backgroundColor: colors.surface }]}
          onPress={() => setIsSortModalVisible(true)}
        >
          <Ionicons name="swap-vertical" size={20} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: isAnyFilterActive ? colors.primary : colors.surface }]}
          onPress={() => setIsFilterModalVisible(true)}
        >
          <Ionicons name="funnel-outline" size={20} color={isAnyFilterActive ? '#fff' : colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            setEditingInvoice(null);
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
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {filteredInvoices.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
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
                        setFormData({ ...formData, client_id: String(item.id), client_name: item.name });
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
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>View Client Payments ({invoices.filter(inv => inv.client_id === parseInt(formData.client_id as string)).length})</Text>
                    <Ionicons name={showClientPaymentsDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
                  </TouchableOpacity>

                  {showClientPaymentsDropdown && (
                    <FlatList
                      data={invoices.filter(inv => inv.client_id === parseInt(formData.client_id as string))}
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
                              <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 4 }}>Invoice: {item.payment_id || `P${item.id}`}</Text>
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
                <Text style={{ color: formData.shoot_id ? colors.text : colors.textTertiary }}>{shoots.find(s => s.id === formData.shoot_id)?.event_type || 'Select Shoot'}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

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

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={handleSaveInvoice}>
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
                <Text style={{ color: filters.client_id !== 'all' ? colors.text : colors.textTertiary, fontSize: 13 }}>{filters.client_id !== 'all' ? clients.find(c => c.id === parseInt(filters.client_id))?.name || 'Select Client' : 'All Clients'}</Text>
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
  summaryContainer: { flexDirection: 'row', padding: 16, gap: 12 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 12, elevation: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryCount: { fontWeight: '800', fontSize: 16 },
  summaryTitle: { fontWeight: '600', fontSize: 12, marginTop: 4 },
  summaryIconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filterBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12, alignItems: 'center' },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderRadius: 16, height: 48 },
  searchInput: { flex: 1, paddingHorizontal: 8, fontSize: 16 },
  iconButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  invoiceCard: { borderRadius: 16, overflow: 'hidden', elevation: 2 },
  invoiceCardTop: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1 },
  invoiceId: { fontWeight: '800', fontSize: 18, marginBottom: 4 },
  invoiceClient: { fontWeight: '600', fontSize: 16 },
  invoiceDue: { fontSize: 14, marginTop: 4 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '92%', maxHeight: '90%', borderRadius: 30, overflow: 'hidden' },
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
  financialSummaryCard: { borderRadius: 16, padding: 12, elevation: 2 },
  financialSummaryContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  financialSummaryItem: { flex: 1, alignItems: 'center' },
  financialSummaryLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  financialSummaryValue: { fontSize: 16, fontWeight: '800' },
  financialSummaryDivider: { width: 1, height: 40, marginHorizontal: 8, opacity: 0.3 }
});
