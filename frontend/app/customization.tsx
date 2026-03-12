import React, { useEffect, useState, useCallback } from 'react';
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
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { getDatabase } from '../src/database/db';
import { useRouter } from 'expo-router';

interface AppOption {
  id: number;
  type: string;
  label: string;
}

type OptionType = 'lead_source' | 'event_type' | 'payment_method' | 'shoot_category';

export default function CustomizationPage() {
  const { colors } = useThemeStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [currentOptionType, setCurrentOptionType] = useState<OptionType>('lead_source');
  const [options, setOptions] = useState<AppOption[]>([]);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [editingOption, setEditingOption] = useState<AppOption | null>(null);

  const loadOptions = useCallback(async (type: OptionType) => {
    setLoading(true);
    try {
      const db = getDatabase();
      const result = await db.getAllAsync(
        "SELECT * FROM app_options WHERE type = ? ORDER BY label ASC",
        [type]
      );
      setOptions(result as AppOption[]);
    } catch (error) {
      console.error('Error loading options:', error);
      Alert.alert('Error', 'Could not load options. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openOptionsManager = (type: OptionType) => {
    setCurrentOptionType(type);
    loadOptions(type);
    setIsOptionsModalVisible(true);
  };

  const handleAddOption = async () => {
    if (!newOptionLabel.trim()) return;
    try {
      const db = getDatabase();
      if (editingOption) {
        await db.runAsync(
          'UPDATE app_options SET label = ? WHERE id = ?',
          [newOptionLabel.trim(), editingOption.id]
        );
        setEditingOption(null);
      } else {
        await db.runAsync(
          "INSERT INTO app_options (type, label) VALUES (?, ?)",
          [currentOptionType, newOptionLabel.trim()]
        );
      }
      setNewOptionLabel('');
      loadOptions(currentOptionType);
    } catch (error) {
      console.error('Error saving option:', error);
      Alert.alert('Error', 'Failed to save option.');
    }
  };

  const handleDeleteOption = (id: number) => {
    Alert.alert(
      'Delete Option',
      `Are you sure you want to delete this ${currentOptionType.replace('_', ' ')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getDatabase();
              await db.runAsync('DELETE FROM app_options WHERE id = ?', [id]);
              loadOptions(currentOptionType);
            } catch (error) {
              console.error('Error deleting option:', error);
            }
          },
        },
      ]
    );
  };

  const CustomizationItem = ({ icon, title, subtitle, onPress }: any) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Customization</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Configure the options and categories used throughout the app.
          </Text>
        </View>

        <View style={styles.grid}>
          <CustomizationItem
            icon="funnel-outline"
            title="Lead Sources"
            subtitle="Instagram, Facebook, Referrals, Ads..."
            onPress={() => openOptionsManager('lead_source')}
          />
          <CustomizationItem
            icon="camera-outline"
            title="Event Types"
            subtitle="Wedding, Pre-wedding, Maternity, Corporate..."
            onPress={() => openOptionsManager('event_type')}
          />
          <CustomizationItem
            icon="card-outline"
            title="Payment Methods"
            subtitle="Cash, UPI, Bank Transfer, Cheque..."
            onPress={() => openOptionsManager('payment_method')}
          />
          <CustomizationItem
            icon="images-outline"
            title="Shoot Categories"
            subtitle="Cinematic, Traditional, Candid, Drone..."
            onPress={() => openOptionsManager('shoot_category')}
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Changes made here will reflect in the selection dropdowns when creating new leads, events, or recording payments.
          </Text>
        </View>
      </ScrollView>

      {/* Options Management Modal */}
      <Modal
        visible={isOptionsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsOptionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Manage {currentOptionType.replace('_', ' ')}
              </Text>
              <TouchableOpacity onPress={() => setIsOptionsModalVisible(false)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.addOptionContainer}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={newOptionLabel}
                onChangeText={setNewOptionLabel}
                placeholder={editingOption ? "Edit item..." : "Add new item..."}
                placeholderTextColor={colors.textTertiary}
                autoFocus={false}
              />
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleAddOption}
              >
                <Ionicons name={editingOption ? "checkmark" : "add"} size={24} color="#fff" />
              </TouchableOpacity>
              {editingOption && (
                <TouchableOpacity
                  style={[styles.cancelEditButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => {
                    setEditingOption(null);
                    setNewOptionLabel('');
                  }}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={options}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.optionsList}
                renderItem={({ item }) => (
                  <View style={[styles.optionItem, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>{item.label}</Text>
                    <View style={styles.optionActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingOption(item);
                          setNewOptionLabel(item.label);
                        }}
                        style={styles.actionIcon}
                      >
                        <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteOption(item.id)}
                        style={styles.actionIcon}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  grid: {
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '80%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  addOptionContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  input: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelEditButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsList: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionActions: {
    flexDirection: 'row',
    gap: 18,
  },
  actionIcon: {
    padding: 4,
  },
});
