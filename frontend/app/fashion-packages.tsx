import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import * as packagesService from '../src/api/services/packages';
import { LinearGradient } from 'expo-linear-gradient';

interface Package {
  id: number;
  name: string;
  event_type: string;
  price: number;
  duration_hours: number;
  deliverables: string;
  description: string;
}

export default function FashionPackages() {
  const { colors } = useThemeStore();
  const [packages, setPackages] = useState<Package[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    event_type: 'Fashion',
    price: '',
    duration_hours: '',
    deliverables: '',
    description: '',
  });

  const loadPackages = async () => {
    try {
      const result = await packagesService.getAll();
      const filtered = result
        .filter((pkg) => pkg.event_type === 'Fashion')
        .sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
      setPackages(filtered as Package[]);
    } catch (error) {
      console.error('Error loading fashion packages:', error);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const handleAddPackage = async () => {
    if (!formData.name || !formData.price) {
      Alert.alert('Error', 'Name and Price are required');
      return;
    }

    try {
      await packagesService.create({
        name: formData.name,
        event_type: formData.event_type,
        price: parseFloat(formData.price),
        duration_hours: parseInt(formData.duration_hours, 10) || 0,
        deliverables: formData.deliverables,
        description: formData.description,
      });

      setIsModalVisible(false);
      setFormData({
        name: '',
        event_type: 'Fashion',
        price: '',
        duration_hours: '',
        deliverables: '',
        description: '',
      });
      loadPackages();
      Alert.alert('Success', 'Fashion package created');
    } catch (error) {
      console.error('Error adding fashion package:', error);
      Alert.alert('Error', 'Failed to save package');
    }
  };

  const renderPackage = ({ item }: { item: Package }) => (
    <View style={[styles.packageCard, { backgroundColor: colors.surface }]}>
      <View style={styles.packageHeader}>
        <Text style={[styles.packageName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.packagePrice, { color: colors.accent }]}>
          ₹{item.price?.toLocaleString()}
        </Text>
      </View>
      <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
        <Text style={[styles.typeText, { color: colors.primary }]}>FASHION</Text>
      </View>
      {item.duration_hours > 0 && (
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>{item.duration_hours} Hours Session</Text>
      )}
      {item.description && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop' }}
          style={styles.banner}
        >
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bannerGradient}>
            <Text style={styles.bannerTitle}>Fashion Packages</Text>
          </LinearGradient>
        </ImageBackground>
        <View style={styles.content}>
          <FlatList
            data={packages}
            renderItem={renderPackage}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 40 }}>No fashion packages found</Text>}
          />
        </View>
      </ScrollView>
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setIsModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>New Fashion Package</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
              </View>
              <ScrollView style={styles.formContent}>
                <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} placeholder="Package Name" value={formData.name} onChangeText={(text) => setFormData({ ...formData, name: text })} />
                <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} placeholder="Price" keyboardType="numeric" value={formData.price} onChangeText={(text) => setFormData({ ...formData, price: text })} />
                <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleAddPackage}><Text style={styles.submitButtonText}>Save Package</Text></TouchableOpacity>
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
  banner: { height: 200, width: '100%' },
  bannerGradient: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  bannerTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  content: { padding: 16 },
  packageCard: { padding: 20, borderRadius: 16, marginBottom: 12 },
  packageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  packageName: { fontSize: 18, fontWeight: '700' },
  packagePrice: { fontSize: 20, fontWeight: '700' },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  typeText: { fontSize: 10, fontWeight: '800' },
  infoText: { fontSize: 14, marginBottom: 4 },
  description: { fontSize: 14 },
  fab: { position: 'absolute', right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', maxHeight: '80%' },
  modalContent: { borderRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  formContent: { gap: 16 },
  input: { padding: 12, borderRadius: 12, fontSize: 16 },
  submitButton: { padding: 16, borderRadius: 12, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontWeight: '700' }
});
