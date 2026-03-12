import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
  Switch,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { getDatabase } from '../src/database/db';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isBefore } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';

const { width } = Dimensions.get('window');

// Interfaces
interface Payment {
  id: number; payment_id?: string; client_id: number; shoot_id: number; client_name?: string;
  event_type?: string; total_amount: number; paid_amount: number; balance: number;
  payment_date: string; status: string; payment_method: string; receipt_path?: string;
  is_cleared?: number;
}
interface Client { id: number; name: string; }
interface Shoot { id: number; client_id: number; event_type: string; }
interface AppOption { id: number; label: string; }

export default function PaymentsPage() {
  const { colors } = useThemeStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<AppOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  // Custom Pickers Visibility
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [shootPickerVisible, setShootPickerVisible] = useState(false);
  const [methodPickerVisible, setMethodPickerVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [sortBy, setSortBy] = useState<'id_asc' | 'date_desc' | 'date_asc'>('id_asc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [formData, setFormData] = useState({
    client_id: '', client_name: '', shoot_id: null as number | null, total_amount: '',
    paid_amount: '', payment_date: new Date(), status: 'pending',
    payment_method: 'UPI', receipt_path: '', is_cleared: false
  });

  const loadData = useCallback(async () => {
    try {
      const db = getDatabase();
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => {
    const now = new Date();
    const totalRevenue = payments.reduce((s, p) => s + (p.total_amount || 0), 0);
    const totalCollected = payments.reduce((s, p) => s + (p.paid_amount || 0), 0);
    const pending = totalRevenue - totalCollected;
    const thisMonth = payments.filter(p => {
      try {
        return isWithinInterval(parseISO(p.payment_date), { start: startOfMonth(now), end: endOfMonth(now) });
      } catch (e) {
        return false;
      }
    }).reduce((s, p) => s + (p.paid_amount || 0), 0);
    const overdue = payments.filter(p => {
      try {
        return p.status !== 'paid' && isBefore(parseISO(p.payment_date), now);
      } catch (e) {
        return false;
      }
    }).length;
    return { totalRevenue, pending, thisMonth, totalCollected, overdue };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    let result = payments.filter(p => {
      const clientName = p.client_name || '';
      const pid = p.payment_id || '';
      const matchesSearch = clientName.toLowerCase().includes(searchQuery.toLowerCase()) || pid.toLowerCase().includes(searchQuery.toLowerCase());
      if (filterStatus === 'all') return matchesSearch;
      if (filterStatus === 'overdue') {
        try {
          return matchesSearch && p.status !== 'paid' && isBefore(parseISO(p.payment_date), new Date());
        } catch (e) {
          return false;
        }
      }
      return matchesSearch && p.status === filterStatus;
    });

    result.sort((a, b) => {
      if (sortBy === 'id_asc') return a.id - b.id;
      const dateA = new Date(a.payment_date).getTime();
      const dateB = new Date(b.payment_date).getTime();
      return sortBy === 'date_desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [payments, searchQuery, filterStatus, sortBy]);

  const paginatedPayments = useMemo(() => {
    return filteredPayments.slice(0, page * PAGE_SIZE);
  }, [filteredPayments, page]);

  const handleSave = async () => {
    const { client_id, shoot_id, total_amount, paid_amount, payment_date, payment_method, receipt_path, is_cleared } = formData;
    if (!client_id || !total_amount) return Alert.alert('Error', 'Client and Total Amount are required.');
    const total = parseFloat(total_amount), paid = parseFloat(paid_amount) || 0;
    const balance = total - paid, status = balance <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'pending');

    try {
      const db = getDatabase();
      const query = editingPayment
        ? `UPDATE payments SET client_id=?, shoot_id=?, total_amount=?, paid_amount=?, balance=?, payment_date=?, status=?, payment_method=?, receipt_path=?, is_cleared=? WHERE id=?`
        : `INSERT INTO payments (client_id, shoot_id, total_amount, paid_amount, balance, payment_date, status, payment_method, receipt_path, is_cleared) VALUES (?,?,?,?,?,?,?,?,?,?)`;
      const params = editingPayment
        ? [client_id, shoot_id, total, paid, balance, format(payment_date, 'yyyy-MM-dd'), status, payment_method, receipt_path, is_cleared ? 1 : 0, editingPayment.id]
        : [client_id, shoot_id, total, paid, balance, format(payment_date, 'yyyy-MM-dd'), status, payment_method, receipt_path, is_cleared ? 1 : 0];
      await db.runAsync(query, params);
      setModalVisible(false); loadData();
      Alert.alert('Success', 'Payment saved successfully');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save payment');
    }
  };

  const openModal = (payment?: Payment) => {
    if (payment) {
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
    } else {
      setEditingPayment(null);
      setFormData({
        client_id: '', client_name: '', shoot_id: null, total_amount: '', paid_amount: '',
        payment_date: new Date(), status: 'pending', payment_method: paymentMethods[0]?.label || 'UPI',
        receipt_path: '', is_cleared: false
      });
    }
    setModalVisible(true);
  };

  const pickReceipt = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
      if (!result.canceled) {
        setFormData({ ...formData, receipt_path: result.assets[0].uri });
      }
    } catch (e) { console.error(e); }
  };

  const filteredShoots = useMemo(() => {
    if (!formData.client_id) return [];
    return shoots.filter(s => s.client_id === parseInt(formData.client_id));
  }, [formData.client_id, shoots]);

  const searchedClients = useMemo(() => {
    return clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clients, clientSearch]);

  const StatCard = ({ title, value, icon, color }: any) => (
    <View style={[styles.statCard, { backgroundColor: colors.surface, shadowColor: color, flex: 1 }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}><Ionicons name={icon} size={14} color={color} /></View>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>₹{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</Text>
      <Text style={[styles.statTitle, { color: colors.textSecondary }]} numberOfLines={1}>{title}</Text>
    </View>
  );

  if (loading && payments.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={paginatedPayments}
        keyExtractor={item => item.id.toString()}
        onEndReached={() => { if (paginatedPayments.length < filteredPayments.length) setPage(p => p + 1); }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            <View style={styles.statsContainer}>
              <StatCard title="Total" value={stats.totalRevenue} color={colors.primary} icon="cash-outline" />
              <StatCard title="Pending" value={stats.pending} color={colors.warning} icon="time-outline" />
              <StatCard title="Month" value={stats.thisMonth} color={colors.info} icon="calendar-outline" />
              <StatCard title="Received" value={stats.totalCollected} color={colors.success} icon="checkmark-done-outline" />
              <StatCard title="Overdue" value={stats.overdue} color={colors.error} icon="alert-circle-outline" />
            </View>

            <View style={styles.filtersSection}>
              <View style={styles.searchRow}>
                <View style={[styles.searchBox, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 0 }]}>
                  <Ionicons name="search" size={18} color={colors.textTertiary} />
                  <TextInput placeholder="Search client or ID..." placeholderTextColor={colors.textTertiary} style={[styles.searchInput, { color: colors.text }]} value={searchQuery} onChangeText={setSearchQuery} />
                </View>
                <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary, height: 44, paddingVertical: 0 }]} onPress={() => openModal()}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addBtnText}>Add Payment</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {['all', 'paid', 'pending', 'overdue'].map(s => (
                  <TouchableOpacity key={s} onPress={() => { setFilterStatus(s as any); setPage(1); }} style={[styles.filterChip, filterStatus === s && { backgroundColor: colors.primary }]}>
                    <Text style={[styles.chipText, { color: filterStatus === s ? '#fff' : colors.textSecondary }]}>{s.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCol, styles.idCol]}>ID</Text>
              <Text style={[styles.tableCol, styles.clientCol]}>CLIENT / EVENT</Text>
              <Text style={styles.tableCol}>TOTAL</Text>
              <Text style={styles.tableCol}>PAID</Text>
              <Text style={styles.tableCol}>BALANCE</Text>
              <Text style={[styles.tableCol, styles.statusCol]}>STATUS</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openModal(item)} style={[styles.tableRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.tableCol, styles.idCol, { color: colors.primary, fontWeight: '700' }]}>{item.payment_id || '-'}</Text>
            <View style={styles.clientCol}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{item.client_name}</Text>
              <Text style={[styles.rowSub, { color: colors.textTertiary }]}>{item.event_type} • {item.payment_method}</Text>
            </View>
            <Text style={[styles.tableCol, { color: colors.text }]}>₹{(item.total_amount || 0).toLocaleString('en-IN')}</Text>
            <Text style={[styles.tableCol, { color: colors.success }]}>₹{(item.paid_amount || 0).toLocaleString('en-IN')}</Text>
            <Text style={[styles.tableCol, { color: colors.error }]}>₹{(item.balance || 0).toLocaleString('en-IN')}</Text>
            <View style={[styles.tableCol, styles.statusCol]}>
              <View style={[styles.statusBadge, { backgroundColor: (item.status === 'paid' ? colors.success : item.status === 'pending' ? colors.warning : colors.error) + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: item.status === 'paid' ? colors.success : item.status === 'pending' ? colors.warning : colors.error }]}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

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
              <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => {
                if (!formData.client_id) return Alert.alert('Notice', 'Please select a client first');
                setShootPickerVisible(true);
              }}>
                <Text style={{ color: formData.shoot_id ? colors.text : colors.textTertiary }}>
                  {shoots.find(s => s.id === formData.shoot_id)?.event_type || 'Select Event'}
                </Text>
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
                <Text style={[styles.balanceVal, { color: colors.primary }]}>
                   ₹{(parseFloat(formData.total_amount || '0') - parseFloat(formData.paid_amount || '0')).toLocaleString('en-IN')}
                </Text>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Method</Text>
              <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setMethodPickerVisible(true)}>
                <Text style={{ color: colors.text }}>{formData.payment_method}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Date</Text>
              <TouchableOpacity style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowDatePicker(true)}>
                <Text style={{ color: colors.text }}>{format(formData.payment_date, 'MMMM dd, yyyy')}</Text>
                <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              <View style={styles.toggleRow}>
                <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>Payment Cleared</Text>
                <Switch value={formData.is_cleared} onValueChange={v => setFormData({ ...formData, is_cleared: v })} trackColor={{ false: colors.border, true: colors.success }} />
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Receipt Image (Optional)</Text>
              <TouchableOpacity style={[styles.uploadBtn, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={pickReceipt}>
                <Ionicons name={formData.receipt_path ? "checkmark-circle" : "cloud-upload-outline"} size={24} color={formData.receipt_path ? colors.success : colors.primary} />
                <Text style={[styles.uploadText, { color: formData.receipt_path ? colors.success : colors.textSecondary }]}>
                  {formData.receipt_path ? 'Receipt Selected' : 'Upload Receipt'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={styles.submitBtnText}>{editingPayment ? 'Update Payment' : 'Save Payment'}</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Searchable Client Picker Modal */}
      <Modal visible={clientPickerVisible} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Client</Text>
            <View style={[styles.pickerSearchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textTertiary} />
              <TextInput placeholder="Search client name..." placeholderTextColor={colors.textTertiary} style={[styles.searchInput, { color: colors.text, height: 40 }]} value={clientSearch} onChangeText={setClientSearch} />
            </View>
            <FlatList
              data={searchedClients}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => {
                  setFormData({ ...formData, client_id: String(item.id), client_name: item.name, shoot_id: null });
                  setClientPickerVisible(false);
                  setClientSearch('');
                }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closePicker} onPress={() => { setClientPickerVisible(false); setClientSearch(''); }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Shoot Picker Modal */}
      <Modal visible={shootPickerVisible} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Event</Text>
            <FlatList
              data={filteredShoots}
              keyExtractor={item => item.id.toString()}
              ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 20, color: colors.textTertiary }}>No events found for this client</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => {
                  setFormData({ ...formData, shoot_id: item.id });
                  setShootPickerVisible(false);
                }}>
                  <Text style={{ color: colors.text }}>{item.event_type}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closePicker} onPress={() => setShootPickerVisible(false)}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Method Picker Modal */}
      <Modal visible={methodPickerVisible} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: colors.surface, maxHeight: 300 }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Payment Method</Text>
            <FlatList
              data={paymentMethods}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => {
                  setFormData({ ...formData, payment_method: item.label });
                  setMethodPickerVisible(false);
                }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closePicker} onPress={() => setMethodPickerVisible(false)}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={formData.payment_date}
          mode="date"
          onChange={(e, d) => {
            setShowDatePicker(false);
            if (d) setFormData({ ...formData, payment_date: d });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, gap: 4 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  statsContainer: { paddingTop: 5, paddingHorizontal: 10, flexDirection: 'row', gap: 6, paddingBottom: 10 },
  statCard: { paddingVertical: 15, paddingHorizontal: 8, borderRadius: 12, marginBottom: 10, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, borderWidth: 1, alignItems: 'center', minHeight: 110, justifyContent: 'center' },
  statIcon: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statValue: { fontWeight: '800', marginBottom: 2, fontSize: 11 },
  statTitle: { fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.2, fontSize: 7 },

  filtersSection: { paddingHorizontal: 20, marginBottom: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, height: 44, marginLeft: 8, fontSize: 14 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  chipScroll: { paddingBottom: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  chipText: { fontSize: 11, fontWeight: '700' },

  tableHeaderRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.02)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  tableCol: { flex: 1, fontSize: 10, fontWeight: '800', color: '#999', textAlign: 'center' },
  idCol: { width: 70, textAlign: 'left' },
  clientCol: { flex: 2, textAlign: 'left' },
  statusCol: { flex: 1.2 },

  tableRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, alignItems: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 11, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'center' },
  statusBadgeText: { fontSize: 9, fontWeight: '800' },

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
  uploadBtn: { marginTop: 10, height: 60, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 },
  uploadText: { fontWeight: '600' },
  submitBtn: { padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 30, marginBottom: 20 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  pickerContent: { width: '85%', maxHeight: '70%', borderRadius: 20, padding: 20 },
  pickerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  pickerSearchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, marginBottom: 15 },
  pickerItem: { paddingVertical: 15, borderBottomWidth: 1 },
  closePicker: { marginTop: 20, alignItems: 'center' }
});
