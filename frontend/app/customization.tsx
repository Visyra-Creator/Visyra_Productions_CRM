import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useThemeStore } from '../src/store/themeStore';
import * as appOptionsService from '../src/api/services/appOptions';

interface AppOption {
  id: number;
  label: string;
  type: string;
}

const LOCAL_FALLBACK_OPTIONS: Record<string, string[]> = {
  lead_source: ['Instagram', 'Google', 'WhatsApp', 'Referral', 'Facebook'],
  lead_stage: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'],
  event_type: ['Wedding', 'Engagement', 'Birthday', 'Corporate'],
  package: ['Basic', 'Standard', 'Premium'],
  client_status: ['Booked', 'Scheduled', 'Delivered', 'Cancelled'],
  payment_method: ['UPI', 'Cash', 'Card', 'Bank Transfer'],
  expense_status: ['Paid', 'Pending', 'Scheduled'],
  linked_shoot_event: ['None'],
  location_type: ['Indoor', 'Outdoor', 'Studio'],
};

  const customizationSections = [
  {
    title: 'Leads Page',
    options: [
      { label: 'Lead Source', type: 'lead_source' },
      { label: 'Lead Stage', type: 'lead_stage' },
    ],
  },
  {
    title: 'Clients Page',
    options: [
      { label: 'Event Type', type: 'event_type' },
      { label: 'Packages', type: 'package' },
      { label: 'Lead Source', type: 'lead_source' },
      { label: 'Status', type: 'client_status' },
    ],
  },
  {
    title: 'Shoots Page',
    options: [{ label: 'Event Type', type: 'event_type' }],
  },
  {
    title: 'Payments Page',
    options: [{ label: 'Payment Method', type: 'payment_method' }],
  },
  {
    title: 'Expenses Page',
    options: [
      { label: 'Payment Method', type: 'payment_method' },
      { label: 'Status', type: 'expense_status' },
      { label: 'Linked Shoot/Event', type: 'linked_shoot_event' },
    ],
  },
  {
    title: 'Locations Page',
    options: [{ label: 'Type', type: 'location_type' }],
  },
];

const OptionManager = ({ type, label }: { type: string; label: string }) => {
  const { colors } = useThemeStore();
  const [options, setOptions] = useState<AppOption[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOption, setEditingOption] = useState<AppOption | null>(null);
  const [newOptionLabel, setNewOptionLabel] = useState('');

  const fallbackForType = useCallback((): AppOption[] => {
    return (LOCAL_FALLBACK_OPTIONS[type] ?? []).map((item, index) => ({
      id: -(index + 1),
      label: item,
      type,
    }));
  }, [type]);

  const loadOptions = useCallback(async () => {
    try {
      const result = await appOptionsService.getAll();
      const filtered = result
        .filter((option) => option.type === type)
        .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? '')));
      setOptions(filtered.length > 0 ? (filtered as AppOption[]) : fallbackForType());
    } catch (error) {
      console.error(`Error loading options for type ${type}:`, error);
      setOptions(fallbackForType());
    }
  }, [type, fallbackForType]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useFocusEffect(
    useCallback(() => {
      loadOptions();
    }, [loadOptions])
  );

  const handleSave = async () => {
    if (!newOptionLabel.trim()) {
      Alert.alert('Error', 'Option label cannot be empty.');
      return;
    }
    try {
      let saved: any = null;
      if (editingOption) {
        saved = await appOptionsService.update(String(editingOption.id), { label: newOptionLabel });
      } else {
        saved = await appOptionsService.create({ type, label: newOptionLabel });
      }

      if (!saved) {
        // Keep customization usable even when remote schema/options table is unavailable.
        const optimistic: AppOption = {
          id: Date.now(),
          label: newOptionLabel,
          type,
        };
        setOptions(prev => {
          const next = [...prev.filter(o => o.label.toLowerCase() !== newOptionLabel.toLowerCase()), optimistic];
          return next.sort((a, b) => a.label.localeCompare(b.label));
        });
        Alert.alert('Saved locally', 'Could not persist to database, but the option is available for this session.');
        setModalVisible(false);
        setEditingOption(null);
        setNewOptionLabel('');
        return;
      }

      setModalVisible(false);
      setEditingOption(null);
      setNewOptionLabel('');
      loadOptions();
    } catch (error) {
      console.error('Error saving option:', error);
      Alert.alert('Error', 'Failed to save option.');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Option', 'Are you sure you want to delete this option?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await appOptionsService.delete(String(id));
            loadOptions();
          } catch (error) {
            console.error('Error deleting option:', error);
            Alert.alert('Error', 'Failed to delete option.');
          }
        },
      },
    ]);
  };

  const openModal = (option: AppOption | null = null) => {
    setEditingOption(option);
    setNewOptionLabel(option ? option.label : '');
    setModalVisible(true);
  };

  return (
    <View style={[styles.optionManagerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.optionManagerLabel, { color: colors.text }]}>{label}</Text>
      <FlatList
        data={options}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.optionItem, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary }}>{item.label}</Text>
            <View style={styles.optionActions}>
              <TouchableOpacity onPress={() => openModal(item)}>
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 10 }}>No options yet.</Text>}
      />
      <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => openModal()}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Add New</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingOption ? 'Edit' : 'Add'} {label}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={newOptionLabel}
              onChangeText={setNewOptionLabel}
              placeholder={`Enter ${label}`}
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={{ color: '#fff' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const CustomizationSection = ({ title, options }: { title: string; options: { label: string; type: string }[] }) => {
  const { colors } = useThemeStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setExpanded(!expanded)}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={24} color={colors.textSecondary} />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.optionsContainer}>
          {options.map((option) => (
            <OptionManager key={option.type} type={option.type} label={option.label} />
          ))}
        </View>
      )}
    </View>
  );
};

export default function CustomizationPage() {
  const { colors } = useThemeStore();

  const renderItem = ({ item }: { item: any }) => (
    <CustomizationSection title={item.title} options={item.options} />
  );

  return (
    <FlatList
      data={customizationSections}
      renderItem={renderItem}
      keyExtractor={(item) => item.title}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 30 }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  optionsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  optionManagerContainer: {
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  optionManagerLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  optionActions: {
    flexDirection: 'row',
    gap: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
});