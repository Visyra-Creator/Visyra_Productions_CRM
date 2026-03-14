import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { getDatabase } from '../src/database/db';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, startOfYear, endOfYear } from 'date-fns';

interface AppOption {
  id: number;
  label: string;
}

export default function Expenses() {
  const { colors } = useThemeStore();
  const { width: screenWidth } = useWindowDimensions();

  const [expenses, setExpenses] = useState<any[]>([]);
  const [shoots, setShoots] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<AppOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCalcVisible, setIsCalcVisible] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingExpense, setEditingExpense] = useState<any | null>(null);

  // auto-generate next expense_id based on existing expenses
  // new format: E followed by four digits (e.g. E0001)
  // Fills gaps first - if E0001 is deleted, next new expense gets E0001
  const getNextExpenseId = useCallback(() => {
    const existingIds = new Set<number>();
    
    expenses.forEach(e => {
      if (e.expense_id) {
        // strip non-digits, then parse
        const digits = e.expense_id.replace(/\D/g, '');
        const n = parseInt(digits, 10);
        if (!isNaN(n)) {
          existingIds.add(n);
        }
      }
    });

    // Find the first missing number starting from 1
    let nextNumber = 1;
    while (existingIds.has(nextNumber)) {
      nextNumber++;
    }

    // Format as E0001, E0002, etc.
    if (nextNumber > 9999) return 'E' + nextNumber.toString();
    return 'E' + nextNumber.toString().padStart(4, '0');
  }, [expenses]);

  const [formData, setFormData] = useState({
    expense_id: getNextExpenseId(),
    title: '',
    amount: '',
    category: 'Other',
    paid_to: '',
    payment_method: 'UPI',
    status: 'paid',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    shoot_id: null as number | null,
  });

  const categories = ['Equipment', 'Travel', 'Freelancers', 'Studio', 'Marketing', 'Software', 'Operations', 'Other'];
  const statusOptions = ['paid', 'pending', 'scheduled'];

  const loadData = useCallback(async () => {
    try {
      const db = getDatabase();
      const [expResult, shootResult, methodResult] = await Promise.all([
        db.getAllAsync(
          `SELECT e.*, s.event_type as shoot_name
           FROM expenses e
           LEFT JOIN shoots s ON e.shoot_id = s.id
           ORDER BY e.date DESC`
        ),
        db.getAllAsync('SELECT id, event_type FROM shoots'),
        db.getAllAsync("SELECT id, label FROM app_options WHERE type = 'payment_method' ORDER BY label ASC")
      ]);
      setExpenses(expResult as any[]);
      setShoots(shootResult as any[]);
      setPaymentMethods(methodResult as AppOption[]);

      if (methodResult.length > 0 && !formData.payment_method) {
        setFormData(prev => ({ ...prev, payment_method: (methodResult[0] as AppOption).label }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [formData.payment_method]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredExpenses = useMemo(() => {
    if (!searchQuery) return expenses;
    const query = searchQuery.toLowerCase();
    return expenses.filter(e =>
      e.title.toLowerCase().includes(query) ||
      e.category.toLowerCase().includes(query) ||
      (e.paid_to && e.paid_to.toLowerCase().includes(query)) ||
      (e.shoot_name && e.shoot_name.toLowerCase().includes(query))
    );
  }, [expenses, searchQuery]);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<any[]>([]);

  const loadPaymentsData = useCallback(async () => {
    try {
      const db = getDatabase();
      const [invResult, prResult] = await Promise.all([
        db.getAllAsync('SELECT * FROM payments'),
        db.getAllAsync('SELECT * FROM payment_records')
      ]);
      setInvoices(invResult as any[]);
      setPaymentRecords(prResult as any[]);
    } catch (error) {
      console.error('Error loading payments data:', error);
    }
  }, []);

  useEffect(() => {
    loadPaymentsData();
  }, [loadPaymentsData]);

  const stats = useMemo(() => {
    const now = new Date();
    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const thisMonth = expenses
      .filter(e => {
        try {
          return isWithinInterval(parseISO(e.date), { start: startOfMonth(now), end: endOfMonth(now) });
        } catch (err) {
          return false;
        }
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const thisYear = expenses
      .filter(e => {
        try {
          return isWithinInterval(parseISO(e.date), { start: startOfYear(now), end: endOfYear(now) });
        } catch (err) {
          return false;
        }
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const operational = expenses
      .filter(e => ['Studio', 'Software', 'Operations'].includes(e.category))
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const projected = Math.round(thisMonth * 1.15);

    // Calculate total income from payments
    const totalIncome = paymentRecords.reduce((sum, pr) => sum + (pr.amount || 0), 0);

    // Calculate profit
    const profit = totalIncome - total;

    return { total, thisMonth, thisYear, operational, projected, totalIncome, profit };
  }, [expenses, invoices, paymentRecords]);

  const handleAddExpense = async () => {
    if (!formData.title || !formData.amount) {
      Alert.alert('Error', 'Title and Amount are required');
      return;
    }

    try {
      const db = getDatabase();
      
      if (editingExpense) {
        // Update existing expense
        await db.runAsync(
          'UPDATE expenses SET title = ?, amount = ?, category = ?, paid_to = ?, payment_method = ?, status = ?, date = ?, notes = ?, shoot_id = ? WHERE id = ?',
          [formData.title, parseFloat(formData.amount), formData.category, formData.paid_to, formData.payment_method, formData.status, formData.date, formData.notes, formData.shoot_id, editingExpense.id]
        );
        Alert.alert('Success', 'Expense updated successfully');
      } else {
        // Create new expense
        await db.runAsync(
          'INSERT INTO expenses (title, amount, category, paid_to, payment_method, status, date, notes, shoot_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [formData.title, parseFloat(formData.amount), formData.category, formData.paid_to, formData.payment_method, formData.status, formData.date, formData.notes, formData.shoot_id]
        );
        Alert.alert('Success', 'Expense recorded');
      }

      setIsModalVisible(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense');
    }
  };

  const resetForm = () => {
    setFormData({
      expense_id: getNextExpenseId(),
      title: '',
      amount: '',
      category: 'Other',
      paid_to: '',
      payment_method: paymentMethods[0]?.label || 'UPI',
      status: 'paid',
      date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      shoot_id: null,
    });
  };

  const handleCalcPress = (val: string) => {
    if (val === 'C') {
      setCalcDisplay('0');
    } else if (val === '=') {
      try {
        // Safe evaluation alternative
        const tokens = calcDisplay.replace('x', '*').replace('÷', '/').match(/(\d+\.?\d*)|[\+\-\*\/]/g);
        if (!tokens) return;

        let result = parseFloat(tokens[0]);
        for (let i = 1; i < tokens.length; i += 2) {
          const op = tokens[i];
          const nextVal = parseFloat(tokens[i + 1]);
          if (op === '+') result += nextVal;
          if (op === '-') result -= nextVal;
          if (op === '*') result *= nextVal;
          if (op === '/') result /= nextVal;
        }
        setCalcDisplay(String(Number(result.toFixed(2))));
      } catch (e) {
        setCalcDisplay('Error');
      }
    } else {
      setCalcDisplay(prev => prev === '0' ? val : prev + val);
    }
  };

  const SummaryCard = ({ title, count, icon, gradient, type }: any) => {
    const isTablet = screenWidth > 768;
    
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.summaryCard,
          { height: isTablet ? 100 : 80 }
        ]}
      >
        <View style={styles.summaryContent}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryCount, { fontSize: isTablet ? 24 : 20 }]}>{count}</Text>
            <Text style={[styles.summaryTitle, { fontSize: isTablet ? 14 : 12 }]} numberOfLines={1}>{title}</Text>
          </View>
          <View style={[styles.summaryIconContainer, { width: isTablet ? 44 : 36, height: isTablet ? 44 : 36 }]}>
            <Ionicons name={icon} size={isTablet ? 28 : 24} color="#fff" />
          </View>
        </View>
      </LinearGradient>
    );
  };

  const TableHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Text style={[styles.col, styles.colDate, { color: colors.textSecondary, textAlign: 'center' }]}>DATE</Text>
      <Text style={[styles.col, styles.colTitle, { color: colors.textSecondary, textAlign: 'center' }]}>EXPENSE TITLE</Text>
      <Text style={[styles.col, styles.colCategory, { color: colors.textSecondary, textAlign: 'center' }]}>CATEGORY</Text>
      <Text style={[styles.col, styles.colShoot, { color: colors.textSecondary, textAlign: 'center' }]}>LINKED SHOOT</Text>
      <Text style={[styles.col, styles.colPaidTo, { color: colors.textSecondary, textAlign: 'center' }]}>PAID TO</Text>
      <Text style={[styles.col, styles.colAmount, { color: colors.textSecondary, textAlign: 'center' }]}>AMOUNT</Text>
      <Text style={[styles.col, styles.colMethod, { color: colors.textSecondary, textAlign: 'center' }]}>METHOD</Text>
      <Text style={[styles.col, styles.colStatus, { color: colors.textSecondary, textAlign: 'center' }]}>STATUS</Text>
      <Text style={[styles.col, styles.colNotes, { color: colors.textSecondary, textAlign: 'center' }]}>NOTES</Text>
    </View>
  );

  const handleEditExpense = (expense: any) => {
    setFormData({
      expense_id: expense.expense_id || `E${(expense.id || 1).toString().padStart(4, '0')}`,
      title: expense.title || '',
      amount: String(expense.amount || ''),
      category: expense.category || 'Other',
      paid_to: expense.paid_to || '',
      payment_method: expense.payment_method || 'UPI',
      status: expense.status || 'paid',
      date: expense.date ? format(parseISO(expense.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      notes: expense.notes || '',
      shoot_id: expense.shoot_id || null,
    });
    setEditingExpense(expense);
    setIsModalVisible(true);
  };

  const handleDeleteExpense = (expenseId: number) => {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = getDatabase();
            await db.runAsync('DELETE FROM expenses WHERE id = ?', [expenseId]);
            loadData();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete expense');
          }
        }
      }
    ]);
  };

  const renderExpenseCard = ({ item }: { item: any }) => (
    <View style={{ marginBottom: 16 }}>
      <View style={[styles.expenseCard, { backgroundColor: colors.surface }]}>
        {/* Top Section with Info and Actions */}
        <View style={[styles.expenseCardTop, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <View>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expenseTitle, { color: colors.text }]}>{item.title}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>
                    {item.date ? format(parseISO(item.date), 'dd-MMM-yy') : '-'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expenseId, { color: colors.primary, fontWeight: '700', fontSize: 13 }]}>
                    {item.expense_id || `E${(item.id || 1).toString().padStart(4, '0')}`}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons at Top Right */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionIconBtn, { backgroundColor: colors.warning + '20' }]}
              onPress={() => handleEditExpense(item)}
            >
              <Ionicons name="create" size={20} color={colors.warning} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionIconBtn, { backgroundColor: colors.error + '20' }]}
              onPress={() => handleDeleteExpense(item.id)}
            >
              <Ionicons name="trash" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.expenseStatsSection}>
          <View style={styles.statBlock}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Amount</Text>
            <Text style={[styles.statValue, { color: colors.error }]}>₹{(item.amount || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Paid To</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{item.paid_to || '-'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Method</Text>
            <Text style={[styles.statValue, { color: colors.textSecondary }]}>{item.payment_method}</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.statusBadgeContainer, { backgroundColor: (item.status === 'paid' ? colors.success : item.status === 'pending' ? colors.warning : colors.info) + '10' }]}>
            <Text style={[styles.statusText, { color: item.status === 'paid' ? colors.success : item.status === 'pending' ? colors.warning : colors.info }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Additional Details - Three Column Layout */}
        {(item.shoot_name || item.category || item.notes) && (
          <View style={[styles.expenseDetails, { borderTopColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                {item.shoot_name && (
                  <>
                    <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Linked Shoot</Text>
                    <Text style={[styles.detailsValue, { color: colors.primary }]}>{item.shoot_name}</Text>
                  </>
                )}
              </View>
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                {item.category && (
                  <>
                    <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Category</Text>
                    <Text style={[styles.detailsValue, { color: colors.text }]}>{item.category}</Text>
                  </>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                {item.notes && (
                  <>
                    <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Notes</Text>
                    <Text style={[styles.detailsValue, { color: colors.text }]}>{item.notes}</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderExpenseRow = ({ item }: { item: any }) => (
    <View style={[styles.tableRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.col, styles.colDate, { color: colors.textTertiary, textAlign: 'center' }]}>
        {item.date ? format(parseISO(item.date), 'dd MMM yyyy') : '-'}
      </Text>
      <Text style={[styles.col, styles.colTitle, { color: colors.text, fontWeight: '700', textAlign: 'center' }]}>{item.title}</Text>
      <Text style={[styles.col, styles.colCategory, { color: colors.textSecondary, textAlign: 'center' }]}>{item.category}</Text>
      <Text style={[styles.col, styles.colShoot, { color: colors.primary, fontWeight: '600', textAlign: 'center' }]}>{item.shoot_name || '-'}</Text>
      <Text style={[styles.col, styles.colPaidTo, { color: colors.text, textAlign: 'center' }]}>{item.paid_to || '-'}</Text>
      <Text style={[styles.col, styles.colAmount, { color: colors.error, fontWeight: '800', textAlign: 'center' }]}>₹{(item.amount || 0).toLocaleString('en-IN')}</Text>
      <Text style={[styles.col, styles.colMethod, { color: colors.textSecondary, textAlign: 'center' }]}>{item.payment_method}</Text>
      <View style={[styles.col, styles.colStatus]}>
        <View style={[styles.statusBadge, { backgroundColor: (item.status === 'paid' ? colors.success : item.status === 'pending' ? colors.warning : colors.info) + '20' }]}>
          <Text style={[styles.statusBadgeText, { color: item.status === 'paid' ? colors.success : item.status === 'pending' ? colors.warning : colors.info }]}>{item.status?.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={[styles.col, styles.colNotes, { color: colors.textTertiary, textAlign: 'center' }]}>{item.notes || '-'}</Text>
    </View>
  );

  if (loading && expenses.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.statsContainer}>
        <SummaryCard title="Total Expenses" count={`₹${Math.round(stats.total).toLocaleString('en-IN')}`} icon="wallet-outline" gradient={['#ef4444', '#dc2626']} type="total" />
        <SummaryCard title="This Month" count={`₹${Math.round(stats.thisMonth).toLocaleString('en-IN')}`} icon="calendar-outline" gradient={['#f59e0b', '#d97706']} type="month" />
        <SummaryCard title="This Year" count={`₹${Math.round(stats.thisYear).toLocaleString('en-IN')}`} icon="stats-chart-outline" gradient={['#3b82f6', '#2563eb']} type="year" />
      </View>

      <View style={styles.searchBarRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            placeholder="Search expenses..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setIsCalcVisible(true)}
        >
          <Ionicons name="calculator-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => { resetForm(); setIsModalVisible(true); }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Financial Summary Section */}
      <View style={styles.financialSummaryContainer}>
        <View style={styles.financialSummaryCard}>
          <View style={styles.financialSummaryContent}>
            <View style={styles.financialSummaryItem}>
              <Text style={[styles.financialSummaryLabel, { color: colors.textSecondary }]}>Total Income</Text>
              <Text style={[styles.financialSummaryValue, { color: colors.success }]}>₹{Math.round(stats.totalIncome).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.financialSummaryDivider} />
            <View style={styles.financialSummaryItem}>
              <Text style={[styles.financialSummaryLabel, { color: colors.textSecondary }]}>Total Expenses</Text>
              <Text style={[styles.financialSummaryValue, { color: colors.error }]}>₹{Math.round(stats.total).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.financialSummaryDivider} />
            <View style={styles.financialSummaryItem}>
              <Text style={[styles.financialSummaryLabel, { color: colors.textSecondary }]}>Profit</Text>
              <Text style={[styles.financialSummaryValue, { color: stats.profit >= 0 ? colors.success : colors.error }]}>
                {stats.profit >= 0 ? `₹${Math.round(stats.profit).toLocaleString('en-IN')}` : `-₹${Math.round(Math.abs(stats.profit)).toLocaleString('en-IN')}`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {filteredExpenses.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No expenses found</Text>
          </View>
        ) : (
          filteredExpenses.map((expense) => <View key={expense.id}>{renderExpenseCard({ item: expense })}</View>)
        )}
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>New Expense Entry</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Expense Title *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                  placeholder="e.g. Memory Cards Purchase"
                  placeholderTextColor={colors.textTertiary}
                />

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Amount *</Text>
                    <View style={styles.amountInputContainer}>
                      <Text style={[styles.currencySymbol, { color: colors.text }]}>₹</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, paddingLeft: 35 }]}
                        value={formData.amount}
                        onChangeText={(text) => setFormData({ ...formData, amount: text.replace(/[^0-9.]/g, '') })}
                        placeholder="0.00"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Paid To</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      value={formData.paid_to}
                      onChangeText={(text) => setFormData({ ...formData, paid_to: text })}
                      placeholder="Vendor Name"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
                <View style={styles.chipPicker}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, { backgroundColor: formData.category === cat ? colors.primary : colors.background, borderColor: colors.border }]}
                      onPress={() => setFormData({ ...formData, category: cat })}
                    >
                      <Text style={[styles.chipText, { color: formData.category === cat ? '#fff' : colors.text }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Method</Text>
                <View style={styles.chipPicker}>
                  {paymentMethods.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.chip, { backgroundColor: formData.payment_method === m.label ? colors.primary : colors.background, borderColor: colors.border }]}
                      onPress={() => setFormData({ ...formData, payment_method: m.label })}
                    >
                      <Text style={[styles.chipText, { color: formData.payment_method === m.label ? '#fff' : colors.text }]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
                <View style={styles.chipPicker}>
                  {statusOptions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, { backgroundColor: formData.status === s ? colors.primary : colors.background, borderColor: colors.border }]}
                      onPress={() => setFormData({ ...formData, status: s })}
                    >
                      <Text style={[styles.chipText, { color: formData.status === s ? '#fff' : colors.text }]}>{s.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Expense Date</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={formData.date}
                  onChangeText={(text) => setFormData({ ...formData, date: text })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                />

                <Text style={[styles.label, { color: colors.textSecondary }]}>Linked Shoot / Event</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shootPicker}>
                  <TouchableOpacity
                    style={[styles.chip, { backgroundColor: formData.shoot_id === null ? colors.primary : colors.background, borderColor: colors.border }]}
                    onPress={() => setFormData({ ...formData, shoot_id: null })}
                  >
                    <Text style={{ color: formData.shoot_id === null ? '#fff' : colors.text }}>None</Text>
                  </TouchableOpacity>
                  {shoots.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.chip, { backgroundColor: formData.shoot_id === s.id ? colors.primary : colors.background, borderColor: colors.border }]}
                      onPress={() => setFormData({ ...formData, shoot_id: s.id })}
                    >
                      <Text style={{ color: formData.shoot_id === s.id ? '#fff' : colors.text }}>{s.event_type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  placeholder="Add additional notes here..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                />

                <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleAddExpense}>
                  <Text style={styles.submitButtonText}>Save Expense Entry</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Calculator Modal */}
      <Modal visible={isCalcVisible} animationType="fade" transparent={true}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsCalcVisible(false)}>
          <View style={[styles.calcContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.calcHeader}>
              <Text style={[styles.calcTitle, { color: colors.text }]}>Expense Calculator</Text>
              <Text style={[styles.calcDisplay, { color: colors.primary, backgroundColor: colors.background }]}>{calcDisplay}</Text>
            </View>
            <View style={styles.calcGrid}>
              {['7','8','9','÷','4','5','6','x','1','2','3','-','0','.','=','+','C'].map(btn => (
                <TouchableOpacity
                  key={btn}
                  style={[styles.calcBtnSmall, { backgroundColor: btn === '=' ? colors.primary : colors.background }]}
                  onPress={() => handleCalcPress(btn)}
                >
                  <Text style={[styles.calcBtnText, { color: btn === '=' ? '#fff' : colors.text }]}>{btn}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsContainer: { flexDirection: 'row', paddingHorizontal: 10, gap: 6, marginTop: 10, justifyContent: 'space-between' },
  summaryCard: { flex: 1, borderRadius: 16, padding: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  summaryContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryCount: { color: '#fff', fontWeight: '800' },
  summaryTitle: { color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  summaryIconContainer: { borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  searchBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, marginTop: 15 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, height: 44 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  actionBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, elevation: 2 },

  tableWrapper: { flex: 1, marginTop: 20 },
  tableHeader: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 2 },
  tableRow: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, backgroundColor: '#fff' },
  col: {},
  colTitle: { width: 240, flexShrink: 1 },
  colCategory: { width: 130, flexShrink: 1 },
  colShoot: { width: 160, flexShrink: 1 },
  colPaidTo: { width: 180, flexShrink: 1 },
  colAmount: { width: 140, flexShrink: 1 },
  colMethod: { width: 150, flexShrink: 1 },
  colDate: { width: 140, flexShrink: 1 },
  colStatus: { width: 130, flexShrink: 1 },
  colNotes: { width: 220, flexShrink: 1 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },

  listContent: { paddingBottom: 100 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '92%', maxHeight: '85%' },
  modalContent: { borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  formContent: { padding: 20 },
  formRow: { flexDirection: 'row', marginBottom: 0 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  input: { padding: 12, borderRadius: 12, fontSize: 15, borderWidth: 1 },
  amountInputContainer: { position: 'relative', justifyContent: 'center' },
  currencySymbol: { position: 'absolute', left: 12, fontSize: 16, fontWeight: '700', zIndex: 1 },
  textArea: { height: 80, textAlignVertical: 'top' },
  chipPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
  shootPicker: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  submitButton: { padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 30, marginBottom: 20 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  calcContainer: { width: '85%', borderRadius: 24, padding: 20 },
  calcHeader: { marginBottom: 20 },
  calcTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  calcDisplay: { fontSize: 28, fontWeight: '700', padding: 15, borderRadius: 12, textAlign: 'right' },
  calcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  calcBtnSmall: { width: '22%', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  calcBtnText: { fontSize: 18, fontWeight: '700' },
  financialSummaryContainer: { paddingHorizontal: 16, marginBottom: -7, marginTop: 5 },
  financialSummaryCard: { borderRadius: 16, padding: 12, elevation: 2 },
  financialSummaryContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  financialSummaryItem: { flex: 1, alignItems: 'center' },
  financialSummaryLabel: { fontSize: 12, fontWeight: '600', marginRight: 4 },
  financialSummaryValue: { fontSize: 16, fontWeight: '800' },
  financialSummaryDivider: { width: 1, height: 40, marginHorizontal: 8, opacity: 0.3 },

  // Expense Card Styles
  expenseCard: { borderRadius: 16, overflow: 'hidden', elevation: 2 },
  expenseCardTop: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1 },
  expenseTitle: { fontWeight: '800', fontSize: 18, marginBottom: 4 },
  expenseCategory: { fontWeight: '600', fontSize: 16 },
  expenseDate: { fontSize: 14, marginTop: 4 },
  expenseStatsSection: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 0 },
  expenseDetails: { borderTopWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  detailsLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  detailsValue: { fontSize: 14, fontWeight: '600' },

  // Shared styles with Payments page
  statBlock: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '800' },
  divider: { width: 1, height: 40, marginHorizontal: 0, opacity: 0.1 },
  statusBadgeContainer: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, alignItems: 'center' },
  statusText: { fontSize: 10, fontWeight: '800' },
  expenseId: { fontSize: 13, fontWeight: '700' },

  // Action button styles (from Payments page)
  cardActions: { flexDirection: 'row', gap: 8 },
  actionIconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }
});
