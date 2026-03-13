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
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { getDatabase } from '../src/database/db';
import { format, parseISO, isSameDay, isSameWeek, isSameMonth, isBefore, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

interface Payment {
  id: number;
  payment_id?: string;
  client_id: number;
  shoot_id: number;
  client_name?: string;
  event_type?: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  payment_date: string;
  due_date?: string;
  status: string;
  payment_method: string;
  receipt_path?: string;
  is_cleared?: number;
}

interface Client { id: number; name: string; }
interface Shoot { id: number; client_id: number; event_type: string; }
interface AppOption { id: number; label: string; }

export default function Payments() {
  const { width, height } = useWindowDimensions();
  const isTablet = width > 768;
  const { colors } = useThemeStore();
  
  // Data State
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<AppOption[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // UI State
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [shootPickerVisible, setShootPickerVisible] = useState(false);
  const [methodPickerVisible, setMethodPickerVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  
  const [formData, setFormData] = useState({
    client_id: '', client_name: '', shoot_id: null as number | null, total_amount: '',
    paid_amount: '', payment_date: new Date(), status: 'pending',
    payment_method: 'UPI', receipt_path: '', is_cleared: false
  });

  const loadData = useCallback(async () => {
    try {
      const db = getDatabase();
      if (!db) { setDbReady(false); return; }
      setDbReady(true);
      setLoading(true);

      const [p, c, s, methods] = await Promise.all([
        db.getAllAsync(`SELECT p.*, c.name as client_name, s.event_type FROM payments p LEFT JOIN clients c ON p.client_id = c.id LEFT JOIN shoots s ON p.shoot_id = s.id ORDER BY p.id ASC`),
        db.getAllAsync('SELECT id, name FROM clients ORDER BY name'),
        db.getAllAsync('SELECT id, client_id, event_type FROM shoots'),
        db.getAllAsync("SELECT id, label FROM app_options WHERE type = 'payment_method' ORDER BY label ASC")
      ]);
      setPayments(p as Payment[]);
      setClients(c as Client[]);
      setShoots(s as Shoot[]);
      setPaymentMethods(methods as AppOption[]);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => {
    const now = new Date();
    const totalRevenue = payments.reduce((s, p) => s + (p.total_amount || 0), 0);
    const totalCollected = payments.reduce((s, p) => s + (p.paid_amount || 0), 0);
    const thisMonth = payments.filter(p => {
      try { return isWithinInterval(parseISO(p.payment_date), { start: startOfMonth(now), end: endOfMonth(now) }); } catch (e) { return false; }
    }).reduce((s, p) => s + (p.paid_amount || 0), 0);
    return { totalRevenue, thisMonth, totalCollected };
  }, [payments]);

  const processedPayments = useMemo(() => {
    let result = [...payments];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        (p.client_name?.toLowerCase().includes(query)) ||
        (p.payment_id?.toLowerCase().includes(query))
      );
    }
    return result;
  }, [payments, searchQuery]);

  const handleSavePayment = async () => {
    if (!formData.client_id) { Alert.alert('Error', 'Please select a client'); return; }
    if (!formData.shoot_id) { Alert.alert('Error', 'Please select a shoot/event'); return; }
    if (!formData.total_amount || isNaN(parseFloat(formData.total_amount))) { Alert.alert('Error', 'Please enter a valid total amount'); return; }
    if (formData.paid_amount && isNaN(parseFloat(formData.paid_amount))) { Alert.alert('Error', 'Please enter a valid paid amount'); return; }

    try {
      const db = getDatabase();
      const { client_id, shoot_id, total_amount, paid_amount, payment_date, payment_method, receipt_path, is_cleared } = formData;
      const total = parseFloat(total_amount), paid = parseFloat(paid_amount) || 0;
      const balance = total - paid;
      const status = balance <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'pending');

      if (editingPayment) {
        await db.runAsync(
          `UPDATE payments SET client_id=?, shoot_id=?, total_amount=?, paid_amount=?, balance=?, payment_date=?, status=?, payment_method=?, receipt_path=?, is_cleared=? WHERE id=?`,
          [parseInt(client_id), shoot_id, total, paid, balance, format(payment_date, 'yyyy-MM-dd'), status, payment_method, receipt_path, is_cleared ? 1 : 0, editingPayment.id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO payments (client_id, shoot_id, total_amount, paid_amount, balance, payment_date, status, payment_method, receipt_path, is_cleared) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [parseInt(client_id), shoot_id, total, paid, balance, format(payment_date, 'yyyy-MM-dd'), status, payment_method, receipt_path, is_cleared ? 1 : 0]
        );
      }
      setModalVisible(false);
      loadData();
      Alert.alert('Success', `Payment ${editingPayment ? 'updated' : 'added'} successfully`);
    } catch (error) {
      console.error('Error saving payment:', error);
      Alert.alert('Error', 'Failed to save payment');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Payment', 'Are you sure you want to delete this payment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = getDatabase();
            await db.runAsync('DELETE FROM payments WHERE id = ?', [id]);
            loadData();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete payment');
          }
        }
      }
    ]);
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      client_id: String(payment.client_id),
      client_name: payment.client_name || '',
      shoot_id: payment.shoot_id,
      total_amount: String(payment.total_amount),
      paid_amount: String(payment.paid_amount),
      payment_date: parseISO(payment.payment_date),
      is_cleared: payment.is_cleared === 1,
      status: payment.status,
      payment_method: payment.payment_method || 'UPI',
      receipt_path: payment.receipt_path || ''
    });
    setModalVisible(true);
  };

  const SummaryCard = ({ title, count, icon, gradient, color }: any) => (
    <View
      style={[
        styles.summaryCard,
        { height: isTablet ? 100 : 80, backgroundColor: colors.surface }
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.summaryCount, { fontSize: isTablet ? 24 : 20, color: colors.text }]}>{count}</Text>
        <Text style={[styles.summaryTitle, { fontSize: isTablet ? 14 : 12, color: colors.textSecondary }]} numberOfLines={1}>{title}</Text>
      </View>
      <View style={[styles.summaryIconContainer, { width: isTablet ? 44 : 36, height: isTablet ? 44 : 36, backgroundColor: (color || colors.primary) + '15' }]}>
        <Ionicons name={icon} size={isTablet ? 28 : 24} color={color || colors.primary} />
      </View>
    </View>
  );

  const TableHeader = () => (
    <View style={[styles.tableHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.columnHeader, styles.colId, { color: colors.textSecondary }]}>ID</Text>
      <Text style={[styles.columnHeader, styles.colActions, { color: colors.textSecondary }]}>ACTIONS</Text>
      <Text style={[styles.columnHeader, styles.colName, { color: colors.textSecondary }]}>CLIENT</Text>
      <Text style={[styles.columnHeader, styles.colDate, { color: colors.textSecondary }]}>DATE</Text>
      <Text style={[styles.columnHeader, styles.colPrice, { color: colors.textSecondary }]}>TOTAL</Text>
      <Text style={[styles.columnHeader, styles.colPrice, { color: colors.textSecondary }]}>PAID</Text>
      <Text style={[styles.columnHeader, styles.colPrice, { color: colors.textSecondary }]}>BALANCE</Text>
      <Text style={[styles.columnHeader, styles.colStatus, { color: colors.textSecondary }]}>STATUS</Text>
    </View>
  );

  const renderPaymentRow = ({ item: p }: { item: Payment }) => (
    <View style={[styles.tableRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.colId, { color: colors.primary, fontWeight: '700', fontSize: 13 }]}>{p.payment_id || `P${p.id}`}</Text>
      <View style={[styles.colActions, styles.rowActions]}>
        <TouchableOpacity onPress={() => handleEdit(p)} style={styles.actionBtn}>
          <Ionicons name="create-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(p.id)} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.colName, { color: colors.text, fontSize: 14 }]} numberOfLines={1}>{p.client_name || '-'}</Text>
      <Text style={[styles.colDate, { color: colors.textSecondary, fontSize: 13 }]}>{format(parseISO(p.payment_date), 'dd-MMM-yy')}</Text>
      <Text style={[styles.colPrice, { color: colors.text, fontSize: 13 }]}>₹{(p.total_amount || 0).toLocaleString()}</Text>
      <Text style={[styles.colPrice, { color: colors.success, fontSize: 13 }]}>₹{(p.paid_amount || 0).toLocaleString()}</Text>
      <Text style={[styles.colPrice, { color: colors.error, fontSize: 13 }]}>₹{(p.balance || 0).toLocaleString()}</Text>
      <View style={[styles.colStatus, { alignItems: 'center' }]}>
        <View style={[styles.statusBadge, { backgroundColor: (p.status === 'paid' ? colors.success : colors.warning) + '20' }]}>
          <Text style={[styles.statusText, { color: p.status === 'paid' ? colors.success : colors.warning }]}>{p.status}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.summaryContainer}>
        <SummaryCard title="Total Revenue" count={`₹${stats.totalRevenue.toLocaleString()}`} icon="cash-outline" color={colors.primary} />
        <SummaryCard title="Collected (Month)" count={`₹${stats.thisMonth.toLocaleString()}`} icon="calendar-outline" color={colors.info} />
        <SummaryCard title="Total Collected" count={`₹${stats.totalCollected.toLocaleString()}`} icon="checkmark-done-outline" color={colors.success} />
      </View>

      <View style={styles.filterBar}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search payments..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { setEditingPayment(null); setModalVisible(true); }}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addBtnText}>Add Payment</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.tableContainer, { backgroundColor: colors.surface }]}>
        <TableHeader />
        <FlatList
          data={processedPayments}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPaymentRow}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editingPayment ? 'Edit Payment' : 'New Payment'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Client</Text>
              <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setClientPickerVisible(true)}>
                <Text style={{ color: formData.client_id ? colors.text : colors.textTertiary }}>{formData.client_name || 'Select Client'}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Shoot / Event</Text>
              <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => { if (!formData.client_id) return Alert.alert('Notice', 'Please select a client first'); setShootPickerVisible(true); }}>
                <Text style={{ color: formData.shoot_id ? colors.text : colors.textTertiary }}>{shoots.find(s => s.id === formData.shoot_id)?.event_type || 'Select Shoot'}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Total Price</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" placeholder="₹0" placeholderTextColor={colors.textTertiary} value={formData.total_amount} onChangeText={t => setFormData({ ...formData, total_amount: t })} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Amount Paid</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} keyboardType="numeric" placeholder="₹0" placeholderTextColor={colors.textTertiary} value={formData.paid_amount} onChangeText={t => setFormData({ ...formData, paid_amount: t })} />
                </View>
              </View>

              <View style={[styles.balanceBox, { backgroundColor: colors.primary + '10' }]}>
                <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Calculated Balance</Text>
                <Text style={[styles.balanceVal, { color: colors.primary }]}>₹{(parseFloat(formData.total_amount || '0') - parseFloat(formData.paid_amount || '0')).toLocaleString('en-IN')}</Text>
              </View>

              <View style={styles.toggleRow}>
                <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>Payment Cleared</Text>
                <Switch value={formData.is_cleared} onValueChange={v => setFormData({ ...formData, is_cleared: v })} trackColor={{ false: colors.border, true: colors.success }} />
              </View>

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={handleSavePayment}>
                <Text style={styles.submitBtnText}>{editingPayment ? 'Update Payment' : 'Save Payment'}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryContainer: { flexDirection: 'row', padding: 16, gap: 12, justifyContent: 'space-between' },
  summaryCard: { flex: 1, borderRadius: 16, padding: 12, elevation: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryCount: { fontWeight: '800' },
  summaryTitle: { fontWeight: '600' },
  summaryIconContainer: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filterBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12, alignItems: 'center' },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderRadius: 16, height: 48 },
  searchInput: { flex: 1, paddingHorizontal: 8, fontSize: 16 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 12, borderRadius: 16 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tableContainer: { flex: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 18, borderBottomWidth: 2, alignItems: 'center' },
  columnHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 14, borderBottomWidth: 1, alignItems: 'center' },
  colId: { flex: 0.5, textAlign: 'center' },
  colActions: { flex: 0.8, alignItems: 'center' },
  colName: { flex: 1.5 },
  colDate: { flex: 1 },
  colPrice: { flex: 1, textAlign: 'center' },
  colStatus: { flex: 1, textAlign: 'center' },
  rowActions: { flexDirection: 'row', justifyContent: 'center' },
  actionBtn: { padding: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, alignItems: 'center' },
  statusText: { fontSize: 11, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '92%', maxHeight: '85%', borderRadius: 30, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15 },
  selector: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formRow: { flexDirection: 'row' },
  balanceBox: { marginTop: 20, padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { fontSize: 13, fontWeight: '600' },
  balanceVal: { fontSize: 18, fontWeight: '800' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  submitBtn: { padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 30, marginBottom: 20 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
