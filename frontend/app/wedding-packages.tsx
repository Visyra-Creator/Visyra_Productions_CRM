import React, { useEffect, useState, useMemo } from 'react';
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
  ImageBackground,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { getDatabase } from '../src/database/db';
import { LinearGradient } from 'expo-linear-gradient';

interface Package {
  id: number;
  name: string;
  event_type: string;
  price: number;
  duration_hours: number;
  deliverables: string;
  description: string;
  covers: string;
  team_type: string;
  team_size: number;
}

const WEDDING_SECTION_TYPES = [
  { label: 'Main Package', icon: 'heart-outline', type: 'Wedding Package' },
  { label: 'Additional Event Coverage', icon: 'camera-outline', type: 'Additional Event Coverage' },
  { label: 'Additional Services', icon: 'sparkles-outline', type: 'Additional Services' },
  { label: 'Additional Deliverables', icon: 'images-outline', type: 'Additional Deliverables' },
];

const TEAM_TYPES = [
  'Photography Only',
  'Videography Only',
  'Photo + Video (Standard)',
  'Photo + Video (Premium)',
  'Cinematic Team',
  'Custom Team',
];

export default function WeddingPackages() {
  const { colors } = useThemeStore();
  const [packages, setPackages] = useState<Package[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isActionMenuVisible, setIsActionMenuVisible] = useState(false);
  const [isTeamPickerVisible, setIsTeamPickerVisible] = useState(false);
  const [isBuilderVisible, setIsBuilderVisible] = useState(false);

  // Package Builder State
  const [selectedPackageIds, setSelectedPackageIds] = useState<number[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    event_type: 'Wedding Package',
    price: '',
    duration_hours: '',
    covers: '',
    team_type: 'Photo + Video (Standard)',
    team_size: '2',
    deliverables: '',
    description: '',
  });

  const loadPackages = async () => {
    try {
      const db = getDatabase();
      const typeList = WEDDING_SECTION_TYPES.map(t => `'${t.type}'`).join(', ');
      const result = await db.getAllAsync(
        `SELECT * FROM packages WHERE event_type IN (${typeList}, 'Wedding') ORDER BY price ASC`
      );
      setPackages(result as Package[]);
    } catch (error) {
      console.error('Error loading wedding packages:', error);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const sections = useMemo(() => {
    return WEDDING_SECTION_TYPES.map(section => ({
      title: section.label,
      type: section.type,
      data: packages.filter(p => p.event_type === section.type || (section.type === 'Wedding Package' && p.event_type === 'Wedding'))
    })).filter(section => section.data.length > 0 || !isBuilderVisible);
  }, [packages, isBuilderVisible]);

  const totalCalculatedPrice = useMemo(() => {
    return selectedPackageIds.reduce((sum, id) => {
      const pkg = packages.find(p => p.id === id);
      return sum + (pkg?.price || 0);
    }, 0);
  }, [selectedPackageIds, packages]);

  const togglePackageSelection = (id: number) => {
    setSelectedPackageIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleOpenAddModal = (type: string) => {
    setFormData({
      name: '',
      event_type: type,
      price: '',
      duration_hours: '',
      covers: '',
      team_type: 'Photo + Video (Standard)',
      team_size: '2',
      deliverables: '',
      description: '',
    });
    setIsActionMenuVisible(false);
    setIsModalVisible(true);
  };

  const handleAddPackage = async () => {
    if (!formData.name || !formData.price) {
      Alert.alert('Error', 'Name and Price are required');
      return;
    }

    try {
      const db = getDatabase();
      await db.runAsync(
        'INSERT INTO packages (name, event_type, price, duration_hours, covers, team_type, team_size, deliverables, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          formData.name,
          formData.event_type,
          parseFloat(formData.price),
          parseInt(formData.duration_hours) || 0,
          formData.covers,
          formData.team_type,
          parseInt(formData.team_size) || 0,
          formData.deliverables,
          formData.description
        ]
      );

      setIsModalVisible(false);
      loadPackages();
      Alert.alert('Success', `${formData.event_type} created`);
    } catch (error) {
      console.error('Error adding wedding package:', error);
      Alert.alert('Error', 'Failed to save package');
    }
  };

  const renderPackage = ({ item }: { item: Package }) => (
    <View style={[styles.packageCard, { backgroundColor: colors.surface }]}>
      <LinearGradient
        colors={[colors.primary + '10', 'transparent']}
        style={styles.cardGradient}
      />
      <View style={styles.packageHeader}>
        <View style={styles.nameContainer}>
          <Text style={[styles.packageName, { color: colors.text }]}>{item.name}</Text>
        </View>
        <Text style={[styles.packagePrice, { color: colors.accent }]}>
          ₹{item.price?.toLocaleString()}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoGrid}>
        {item.duration_hours > 0 && (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {item.duration_hours} Hours
            </Text>
          </View>
        )}
        {item.team_type ? (
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {item.team_type} ({item.team_size} Persons)
            </Text>
          </View>
        ) : item.covers ? (
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {item.covers}
            </Text>
          </View>
        ) : null}
      </View>

      {item.deliverables ? (
        <View style={styles.deliverablesContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Deliverables:</Text>
          <Text style={[styles.deliverablesText, { color: colors.textSecondary }]}>
            {item.deliverables}
          </Text>
        </View>
      ) : null}

      {item.description ? (
        <Text style={[styles.description, { color: colors.textTertiary }]}>
          {item.description}
        </Text>
      ) : null}

      <TouchableOpacity style={[styles.editBtn, { borderColor: colors.border }]}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Edit Details</Text>
      </TouchableOpacity>
    </View>
  );

  const BuilderItem = ({ item }: { item: Package }) => {
    const isSelected = selectedPackageIds.includes(item.id);
    return (
      <TouchableOpacity
        onPress={() => togglePackageSelection(item.id)}
        style={[
          styles.builderCard,
          { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border }
        ]}
      >
        <View style={styles.builderCardContent}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.builderItemName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.builderItemPrice, { color: colors.primary }]}>₹{item.price.toLocaleString()}</Text>
          </View>
          <View style={[styles.checkbox, { backgroundColor: isSelected ? colors.primary : 'transparent', borderColor: isSelected ? colors.primary : colors.textTertiary }]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section: { title } }: { section: { title: string } }) => (
    <View style={[styles.sectionHeaderContainer, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionHeading, { color: colors.text }]}>{title}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={() => setIsBuilderVisible(false)}
          style={[styles.tab, !isBuilderVisible && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        >
          <Text style={[styles.tabText, { color: !isBuilderVisible ? colors.primary : colors.textSecondary }]}>Catalog</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setIsBuilderVisible(true)}
          style={[styles.tab, isBuilderVisible && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        >
          <Text style={[styles.tabText, { color: isBuilderVisible ? colors.primary : colors.textSecondary }]}>Package Builder</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={isBuilderVisible ?
          ({ item }) => <BuilderItem item={item} /> :
          ({ item }) => renderPackage({ item })
        }
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          !isBuilderVisible ? (
            <ImageBackground
              source={{ uri: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop' }}
              style={styles.banner}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.bannerGradient}
              >
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerSubtitle}>LUXURY COLLECTIONS</Text>
                  <Text style={styles.bannerTitle}>Wedding Packages</Text>
                  <TouchableOpacity
                    style={[styles.addInlineBtn, { backgroundColor: colors.primary, marginTop: 12, alignSelf: 'flex-start' }]}
                    onPress={() => setIsActionMenuVisible(true)}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.addInlineText}>Add New Item</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </ImageBackground>
          ) : (
            <View style={styles.builderHeader}>
              <Text style={[styles.builderTitle, { color: colors.text }]}>Pick Your Items</Text>
              <Text style={[styles.builderSubtitle, { color: colors.textSecondary }]}>Select multiple items to see the total live price</Text>
            </View>
          )
        }
        ListFooterComponent={<View style={{ height: isBuilderVisible ? 140 : 100 }} />}
        contentContainerStyle={styles.sectionListContent}
      />

      {/* Bottom Total Bar for Builder */}
      {isBuilderVisible && (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.totalContainer}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>TOTAL ESTIMATE</Text>
            <Text style={[styles.totalAmount, { color: colors.primary }]}>₹{totalCalculatedPrice.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            style={[styles.continueBtn, { backgroundColor: colors.primary }]}
            onPress={() => Alert.alert('Estimate Ready', `Total price for selected items: ₹${totalCalculatedPrice.toLocaleString()}`)}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Selection Modal */}
      <Modal
        visible={isActionMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsActionMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.actionModalOverlay}
          activeOpacity={1}
          onPress={() => setIsActionMenuVisible(false)}
        >
          <View style={[styles.actionMenuContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.actionMenuTitle, { color: colors.text }]}>Select Category</Text>
            {WEDDING_SECTION_TYPES.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionMenuItem, { borderBottomColor: colors.border }]}
                onPress={() => handleOpenAddModal(action.type)}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name={action.icon as any} size={24} color={colors.primary} />
                </View>
                <Text style={[styles.actionMenuText, { color: colors.text }]}>{action.label}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Team Picker Modal */}
      <Modal visible={isTeamPickerVisible} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setIsTeamPickerVisible(false)}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.pickerHeader}><Text style={[styles.pickerTitle, { color: colors.text }]}>Select Team Type</Text></View>
            <FlatList data={TEAM_TYPES} keyExtractor={(item) => item} renderItem={({ item }) => (
              <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => { setFormData({ ...formData, team_type: item }); setIsTeamPickerVisible(false); }}>
                <Text style={[styles.pickerItemText, { color: colors.text }]}>{item}</Text>
                {formData.team_type === item && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>New {formData.event_type}</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textTertiary }]}>Wedding Category</Text>
                </View>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {formData.event_type === 'Additional Event Coverage' ? 'Event Name *' :
                     formData.event_type === 'Additional Services' ? 'Service Name *' :
                     formData.event_type === 'Additional Deliverables' ? 'Deliverable Name *' :
                     'Package Name *'}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                    placeholder="Enter name"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                {formData.event_type === 'Wedding Package' ? (
                  <>
                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Duration (Hrs)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                          value={formData.duration_hours}
                          onChangeText={(text) => setFormData({ ...formData, duration_hours: text })}
                          placeholder="e.g. 12"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Covers</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                          value={formData.covers}
                          onChangeText={(text) => setFormData({ ...formData, covers: text })}
                          placeholder="e.g. Traditional"
                          placeholderTextColor={colors.textTertiary}
                        />
                      </View>
                    </View>

                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, { flex: 2, marginRight: 12 }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Team Type</Text>
                        <TouchableOpacity
                          style={[styles.input, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                          onPress={() => setIsTeamPickerVisible(true)}
                        >
                          <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>{formData.team_type}</Text>
                          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Persons</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                          value={formData.team_size}
                          onChangeText={(text) => setFormData({ ...formData, team_size: text })}
                          placeholder="No."
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Deliverables</Text>
                      <TextInput
                        style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text }]}
                        value={formData.deliverables}
                        onChangeText={(text) => setFormData({ ...formData, deliverables: text })}
                        placeholder="What's included?"
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        numberOfLines={3}
                      />
                    </View>
                  </>
                ) : (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Description/Details</Text>
                    <TextInput
                      style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text }]}
                      value={formData.deliverables}
                      onChangeText={(text) => setFormData({ ...formData, deliverables: text })}
                      placeholder="Describe the service or items"
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Price (₹) *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                    value={formData.price}
                    onChangeText={(text) => setFormData({ ...formData, price: text })}
                    placeholder="Amount"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>

                {formData.event_type === 'Wedding Package' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Additional Notes</Text>
                    <TextInput
                      style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text }]}
                      value={formData.description}
                      onChangeText={(text) => setFormData({ ...formData, description: text })}
                      placeholder="Special mentions or terms..."
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddPackage}
                >
                  <Text style={styles.submitButtonText}>Create {formData.event_type}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: { height: 240, width: '100%' },
  bannerGradient: { flex: 1, justifyContent: 'flex-end', padding: 24 },
  bannerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  bannerTitle: { color: '#fff', fontSize: 32, fontWeight: '900' },
  bannerContent: { flex: 1, justifyContent: 'flex-end' },

  addInlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, elevation: 2 },
  addInlineText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  sectionHeaderContainer: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 16 },
  sectionHeading: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },

  sectionListContent: { paddingBottom: 40 },

  packageCard: { borderRadius: 24, padding: 24, marginHorizontal: 20, marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, overflow: 'hidden' },
  cardGradient: { ...StyleSheet.absoluteFillObject },
  packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  nameContainer: { flex: 1 },
  packageName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  packagePrice: { fontSize: 22, fontWeight: '900' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 16 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, fontWeight: '600' },
  deliverablesContainer: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  deliverablesText: { fontSize: 13, lineHeight: 18 },
  description: { fontSize: 12, fontStyle: 'italic', marginBottom: 16 },
  editBtn: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '92%', maxHeight: '85%' },
  modalContent: { borderRadius: 32, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  formContent: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  inputRow: { flexDirection: 'row' },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  input: { padding: 16, borderRadius: 16, fontSize: 15 },
  textArea: { height: 100, textAlignVertical: 'top' },
  submitButton: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 12, marginBottom: 24 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  actionModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  actionMenuContent: { width: '85%', borderRadius: 24, padding: 20, elevation: 20 },
  actionMenuTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
  actionMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  actionIconContainer: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  actionMenuText: { flex: 1, fontSize: 15, fontWeight: '700' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  pickerContainer: { width: '80%', maxHeight: '50%', borderRadius: 24, overflow: 'hidden' },
  pickerHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  pickerTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 16 },

  tabBar: { flexDirection: 'row', height: 50, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 14, fontWeight: '700' },

  builderHeader: { padding: 24, paddingBottom: 0 },
  builderTitle: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  builderSubtitle: { fontSize: 14 },
  builderCard: { padding: 20, borderRadius: 20, marginHorizontal: 20, marginBottom: 12, borderWidth: 2 },
  builderCardContent: { flexDirection: 'row', alignItems: 'center' },
  builderItemName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  builderItemPrice: { fontSize: 16, fontWeight: '800' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  totalContainer: { flex: 1 },
  totalLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  totalAmount: { fontSize: 22, fontWeight: '900' },
  continueBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, elevation: 4 },
  continueBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
