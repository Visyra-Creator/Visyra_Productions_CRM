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

  const [formData, setFormData] = useState({
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

    return { total, thisMonth, thisYear, operational, projected };
  }, [expenses]);

  const handleAddExpense = async () => {
    if (!formData.title || !formData.amount) {
      Alert.alert('Error', 'Title and Amount are required');
      return;
    }

    try {
      const db = getDatabase();
      await db.runAsync(
        'INSERT INTO expenses (title, amount, category, paid_to, payment_method, status, date, notes, shoot_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [formData.title, parseFloat(formData.amount), formData.category, formData.paid_to, formData.payment_method, formData.status, formData.date, formData.notes, formData.shoot_id]
      );

      setIsModalVisible(false);
      resetForm();
      loadData();
      Alert.alert('Success', 'Expense recorded');
    } catch (error) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', 'Failed to save expense');
    }
  };

  const resetForm = () => {
    setFormData({
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

  const StatCard = ({ title, value, color, icon }: any) => (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>₹{Math.round(value).toLocaleString('en-IN')}</Text>
      <Text style={[styles.statTitle, { color: colors.textSecondary }]} numberOfLines={1}>{title}</Text>
    </View>
  );

  const TableHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Text style={[styles.col, styles.colTitle, { color: colors.textSecondary }]}>EXPENSE TITLE</Text>
      <Text style={[styles.col, styles.colCategory, { color: colors.textSecondary }]}>CATEGORY</Text>
      <Text style={[styles.col, styles.colShoot, { color: colors.textSecondary }]}>LINKED SHOOT</Text>
      <Text style={[styles.col, styles.colPaidTo, { color: colors.textSecondary }]}>PAID TO</Text>
      <Text style={[styles.col, styles.colAmount, { color: colors.textSecondary }]}>AMOUNT</Text>
      <Text style={[styles.col, styles.colMethod, { color: colors.textSecondary }]}>METHOD</Text>
      <Text style={[styles.col, styles.colDate, { color: colors.textSecondary }]}>DATE</Text>
      <Text style={[styles.col, styles.colStatus, { color: colors.textSecondary }]}>STATUS</Text>
      <Text style={[styles.col, styles.colNotes, { color: colors.textSecondary }]}>NOTES</Text>
    </View>
  );

  const renderExpenseRow = ({ item }: { item: any }) => (
    <View style={[styles.tableRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.col, styles.colTitle, { color: colors.text, fontWeight: '700' }]}>{item.title}</Text>
      <Text style={[styles.col, styles.colCategory, { color: colors.textSecondary }]}>{item.category}</Text>
      <Text style={[styles.col, styles.colShoot, { color: colors.primary, fontWeight: '600' }]}>{item.shoot_name || '-'}</Text>
      <Text style={[styles.col, styles.colPaidTo, { color: colors.text }]}>{item.paid_to || '-'}</Text>
      <Text style={[styles.col, styles.colAmount, { color: colors.error, fontWeight: '800' }]}>₹{(item.amount || 0).toLocaleString('en-IN')}</Text>
      <Text style={[styles.col, styles.colMethod, { color: colors.textSecondary }]}>{item.payment_method}</Text>
      <Text style={[styles.col, styles.colDate, { color: colors.textTertiary }]}>
        {item.date ? format(parseISO(item.date), 'dd MMM yyyy') : '-'}
      </Text>
      <View style={[styles.col, styles.colStatus]}>
        <View style={[styles.statusBadge, { backgroundColor: (item.status === 'paid' ? colors.success : item.status === 'pending' ? colors.warning : colors.info) + '20' }]}>
          <Text style={[styles.statusBadgeText, { color: item.status === 'paid' ? colors.success : item.status === 'pending' ? colors.warning : colors.info }]}>{item.status?.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={[styles.col, styles.colNotes, { color: colors.textTertiary }]}>{item.notes || '-'}</Text>
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
        <StatCard title="Total" value={stats.total} color={colors.error} icon="wallet-outline" />
        <StatCard title="Month" value={stats.thisMonth} color={colors.warning} icon="calendar-outline" />
        <StatCard title="Year" value={stats.thisYear} color={colors.info} icon="stats-chart-outline" />
        <StatCard title="Proj." value={stats.projected} color={colors.primary} icon="trending-down-outline" />
        <StatCard title="Ops" value={stats.operational} color={colors.success} icon="business-outline" />
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

      <View style={styles.tableWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            <TableHeader />
            <FlatList
              data={filteredExpenses}
              renderItem={renderExpenseRow}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={[styles.emptyState, { width: screenWidth }]}>
                  <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No expenses found</Text>
                </View>
              }
            />
          </View>
        </ScrollView>
      </View>

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
  statCard: { flex: 1, padding: 8, borderRadius: 12, borderLeftWidth: 3, elevation: 4, alignItems: 'center', minHeight: 80, justifyContent: 'center' },
  statIcon: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statValue: { fontSize: 11, fontWeight: '800' },
  statTitle: { fontSize: 8, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },

  searchBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, marginTop: 15 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, height: 44 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  actionBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, elevation: 2 },

  tableWrapper: { flex: 1, marginTop: 20 },
  tableHeader: { flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: 1 },
  tableRow: { flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: 1, alignItems: 'center' },
  col: { fontSize: 12, fontWeight: '600' },
  colTitle: { width: 200 },
  colCategory: { width: 130 },
  colShoot: { width: 160 },
  colPaidTo: { width: 140 },
  colAmount: { width: 120 },
  colMethod: { width: 150 },
  colDate: { width: 120 },
  colStatus: { width: 110 },
  colNotes: { width: 250 },

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
});
