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
  Image,
  Linking,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeStore } from '../src/store/themeStore';
import * as locationsService from '../src/api/services/locations';
import * as locationImagesService from '../src/api/services/locationImages';
import * as appOptionsService from '../src/api/services/appOptions';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height: screenHeight } = Dimensions.get('window');

interface Location {
  id: number;
  name: string;
  type: string;
  city: string;
  is_paid: number;
  price: number;
  address: string;
  venue_name: string;
  landmark: string;
  google_maps_url: string;
  notes: string;
  usage_count: number;
  images?: string[];
}

const LOCATION_TYPES = [
  'Studio',
  'Outdoor',
  'Venue',
  'Resort',
  'Cafe/Restaurant',
  'Hotel',
  'Historical',
  'Nature',
  'Other'
];

type SortOption = 'none' | 'name_asc' | 'price_asc' | 'price_desc' | 'usage_desc';

interface LocationFilter {
  type: string;
  city: string;
  is_paid: string;
  minPrice: string;
  maxPrice: string;
  venue_name: string;
  landmark: string;
}

export default function LocationGalleryPage() {
  const { colors } = useThemeStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('None');
  const [sortBy, setSortBy] = useState<SortOption>('none');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<LocationFilter>({
    type: 'all',
    city: '',
    is_paid: 'all',
    minPrice: '',
    maxPrice: '',
    venue_name: '',
    landmark: ''
  });
  const [locationTypes, setLocationTypes] = useState<string[]>(LOCATION_TYPES);
  const [addTypeModalVisible, setAddTypeModalVisible] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [addingType, setAddingType] = useState(false);
  const realtimeRefreshTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'Studio',
    city: '',
    is_paid: false,
    price: '',
    address: '',
    venue_name: '',
    landmark: '',
    google_maps_url: '',
    notes: '',
    images: [] as string[]
  });

  const loadLocations = useCallback(async (reason = 'manual') => {
    try {
      console.log(`[Locations] Loading data (${reason})...`);
      const locs = (await locationsService.getAll())
        .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
      const allImages = await locationImagesService.getAll();
      const locationsWithImages = await Promise.all(locs.map(async (loc: any) => {
        const imgs = allImages.filter((img: any) => img.location_id === loc.id);
        return { ...loc, images: imgs.map((i: any) => i.image_path) };
      }));
      setLocations(locationsWithImages as Location[]);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadLocationTypes = useCallback(async () => {
    try {
      const allOptions = await appOptionsService.getAll();
      const types = allOptions
        .filter((option) => option.type === 'location_type')
        .map((option) => String(option.label ?? '').trim())
        .filter(Boolean);

      if (types.length > 0) {
        const unique = Array.from(new Set(types)).sort((a, b) => a.localeCompare(b));
        setLocationTypes(unique);
      } else {
        setLocationTypes(LOCATION_TYPES);
      }
    } catch (e) {
      setLocationTypes(LOCATION_TYPES);
    }
  }, []);

  useEffect(() => {
    void loadLocations('mount');
  }, [loadLocations]);

  useFocusEffect(
    useCallback(() => {
      void loadLocations('focus');
      return () => {};
    }, [loadLocations])
  );

  useEffect(() => {
    const unsubscribeLocations = locationsService.subscribeToLocationChanges(() => {
      if (realtimeRefreshTimeoutRef.current) clearTimeout(realtimeRefreshTimeoutRef.current);
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        void loadLocations('realtime-locations');
      }, 250);
    });

    const unsubscribeImages = locationImagesService.subscribeToLocationImageChanges(() => {
      if (realtimeRefreshTimeoutRef.current) clearTimeout(realtimeRefreshTimeoutRef.current);
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        void loadLocations('realtime-location-images');
      }, 250);
    });

    const unsubscribeOptions = appOptionsService.subscribeToAppOptionChanges(() => {
      void loadLocationTypes();
    });

    return () => {
      if (realtimeRefreshTimeoutRef.current) clearTimeout(realtimeRefreshTimeoutRef.current);
      unsubscribeLocations();
      unsubscribeImages();
      unsubscribeOptions();
    };
  }, [loadLocations, loadLocationTypes]);


  useEffect(() => {
    loadLocationTypes();
  }, [loadLocationTypes]);

  const handleAddLocationType = async () => {
    const label = newTypeName.trim();
    if (!label) {
      Alert.alert('Validation Error', 'Category name is required.');
      return;
    }

    try {
      setAddingType(true);
      const createdOrExisting = await appOptionsService.createIfNotExists('location_type', label);
      await loadLocationTypes();

      const selected = String(createdOrExisting?.label ?? label);
      setFormData((prev) => ({ ...prev, type: selected }));
      setAddTypeModalVisible(false);
      setNewTypeName('');
    } catch (error) {
      console.error('Error adding location type:', error);
      Alert.alert('Error', 'Failed to add category.');
    } finally {
      setAddingType(false);
    }
  };

  const stats = useMemo(() => {
    const total = locations.length;
    const paid = locations.filter(l => l.is_paid === 1).length;
    const free = total - paid;
    const mostUsed = [...locations].sort((a, b) => b.usage_count - a.usage_count)[0]?.name || 'None';
    return { total, paid, free, mostUsed };
  }, [locations]);

  const processedLocations = useMemo(() => {
    let result = locations.filter(l => {
      // Basic search filter
      const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           l.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           l.venue_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           l.landmark?.toLowerCase().includes(searchQuery.toLowerCase());

      // Simple filter (top row chips)
      const matchesSimpleFilter = filterType === 'None' || filterType === 'All' ||
                           (filterType === 'Paid' && l.is_paid === 1) ||
                           (filterType === 'Free' && l.is_paid === 0) ||
                           l.type === filterType;

      // Advanced filters
      const matchesType = filters.type === 'all' || l.type === filters.type;
      const matchesCity = !filters.city || l.city.toLowerCase().includes(filters.city.toLowerCase());
      const matchesPaid = filters.is_paid === 'all' || 
                         (filters.is_paid === 'paid' && l.is_paid === 1) ||
                         (filters.is_paid === 'free' && l.is_paid === 0);
      const matchesMinPrice = !filters.minPrice || l.price >= parseFloat(filters.minPrice);
      const matchesMaxPrice = !filters.maxPrice || l.price <= parseFloat(filters.maxPrice);
      const matchesVenue = !filters.venue_name || l.venue_name?.toLowerCase().includes(filters.venue_name.toLowerCase());
      const matchesLandmark = !filters.landmark || l.landmark?.toLowerCase().includes(filters.landmark.toLowerCase());

      return matchesSearch && matchesSimpleFilter && matchesType && matchesCity && 
             matchesPaid && matchesMinPrice && matchesMaxPrice && matchesVenue && matchesLandmark;
    });

    if (sortBy !== 'none') {
      result.sort((a, b) => {
        switch (sortBy) {
          case 'price_asc': return a.price - b.price;
          case 'price_desc': return b.price - a.price;
          case 'usage_desc': return b.usage_count - a.usage_count;
          case 'name_asc':
          default: return a.name.localeCompare(b.name);
        }
      });
    }

    return result;
  }, [locations, searchQuery, filterType, sortBy, filters]);

  const handleSave = async () => {
    // Validation rules
    if (!formData.name || formData.name.trim() === '') {
      Alert.alert('Validation Error', 'Please enter a Location Name.');
      return;
    }
    if (!formData.city || formData.city.trim() === '') {
      Alert.alert('Validation Error', 'Please enter a City.');
      return;
    }
    if (formData.is_paid && (!formData.price || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0)) {
      Alert.alert('Validation Error', 'Please enter a valid price for a paid location.');
      return;
    }
    if (formData.google_maps_url && !/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(formData.google_maps_url)) {
      Alert.alert('Validation Error', 'Please enter a valid Google Maps URL.');
      return;
    }

    try {
      if (editingLocation) {
        await locationsService.update(String(editingLocation.id), {
          name: formData.name,
          type: formData.type,
          city: formData.city,
          is_paid: formData.is_paid ? 1 : 0,
          price: parseFloat(formData.price) || 0,
          address: formData.address,
          venue_name: formData.venue_name,
          landmark: formData.landmark,
          google_maps_url: formData.google_maps_url,
          notes: formData.notes,
        });
        const allImages = await locationImagesService.getAll();
        const existing = allImages.filter((img: any) => img.location_id === editingLocation.id);
        await Promise.all(existing.map((img: any) => locationImagesService.delete(String(img.id))));
        for (const img of formData.images) {
          await locationImagesService.create({ location_id: editingLocation.id, image_path: img });
        }
      } else {
        const result: any = await locationsService.create({
          name: formData.name,
          type: formData.type,
          city: formData.city,
          is_paid: formData.is_paid ? 1 : 0,
          price: parseFloat(formData.price) || 0,
          address: formData.address,
          venue_name: formData.venue_name,
          landmark: formData.landmark,
          google_maps_url: formData.google_maps_url,
          notes: formData.notes,
        });
        const newId = result.id;
        for (const img of formData.images) {
          await locationImagesService.create({ location_id: newId, image_path: img });
        }
      }
      setEditModalVisible(false);
      await loadLocations();
    } catch (e) {
      console.error(e);
    }
  };

  const openEditModal = (location?: Location) => {
    if (location) {
      setEditingLocation(location);
      setFormData({
        name: location.name,
        type: location.type || 'Studio',
        city: location.city || '',
        is_paid: location.is_paid === 1,
        price: location.price?.toString() || '0',
        address: location.address || '',
        venue_name: location.venue_name || '',
        landmark: location.landmark || '',
        google_maps_url: location.google_maps_url || '',
        notes: location.notes || '',
        images: location.images || []
      });
    } else {
      setEditingLocation(null);
      setFormData({
        name: '', type: 'Studio', city: '', is_paid: false, price: '',
        address: '', venue_name: '', landmark: '', google_maps_url: '', notes: '',
        images: []
      });
    }
    setEditModalVisible(true);
  };

  const openDetails = (location: Location) => {
    setSelectedLocation(location);
    setDetailsModalVisible(true);
  };

  const pickImages = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', multiple: true });
      if (!result.canceled) {
        const newImages = result.assets.map(a => a.uri);
        setFormData({ ...formData, images: [...formData.images, ...newImages] });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...formData.images];
    newImages.splice(index, 1);
    setFormData({ ...formData, images: newImages });
  };

  const openNavigation = (url: string) => {
    if (url) {
      Linking.openURL(url).catch(err => Alert.alert('Error', 'Cannot open maps'));
    } else {
      Alert.alert('Notice', 'Google Maps URL not provided');
    }
  };

  const isTablet = width > 768;
  const numColumns = isTablet ? 3 : 1;
  const cardWidth = isTablet ? (width - 60) / 3 : (width - 40);

  const StatCard = ({ title, value, icon, gradient }: any) => (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.statCard, { flex: 1 }]}
    >
      <View style={styles.summaryContent}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryCount}>{value}</Text>
          <Text style={styles.summaryTitle} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.summaryIconContainer}>
          <Ionicons name={icon} size={24} color="#fff" />
        </View>
      </View>
    </LinearGradient>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.statsContainer}>
        <StatCard title="Total Locations" value={stats.total} gradient={['#4c669f', '#3b5998', '#192f6a']} icon="location-outline" />
        <StatCard title="Paid Locations" value={stats.paid} gradient={['#D32F2F', '#C62828', '#B71C1C']} icon="card-outline" />
        <StatCard title="Free Locations" value={stats.free} gradient={['#388E3C', '#2E7D32', '#1B5E20']} icon="gift-outline" />
        <StatCard title="Most Used" value={stats.mostUsed} gradient={['#0288D1', '#0277BD', '#01579B']} icon="trending-up-outline" />
      </View>

      <View style={styles.filtersSection}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              placeholder="Search locations..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setSortModalVisible(true)}
          >
            <Ionicons name="swap-vertical" size={20} color={sortBy !== 'none' ? colors.primary : colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setIsFilterModalVisible(true)}
          >
            <Ionicons name="funnel-outline" size={20} color={Object.values(filters).some(v => v !== 'all' && v !== '') ? colors.primary : colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => openEditModal()}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add New Location</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {['None', 'Paid', 'Free', 'Studio', 'Outdoor', 'Venue', 'Resort'].map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setFilterType(t)}
              style={[styles.filterChip, filterType === t && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.chipText, { color: filterType === t ? '#fff' : colors.textSecondary }]}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={processedLocations}
        keyExtractor={item => item.id.toString()}
        numColumns={numColumns}
        key={numColumns} // Force re-render when column count changes
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => openDetails(item)}
            style={[styles.galleryCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
          >
            <View style={styles.cardImageContainer}>
              {item.images && item.images.length > 0 ? (
                <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.background }]}>
                  <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
                </View>
              )}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.imageOverlay} />
              <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={styles.typeBadgeText}>{item.type.toUpperCase()}</Text>
              </View>
              <View style={[styles.paidBadge, { backgroundColor: item.is_paid ? colors.error : colors.success }]}>
                <Text style={styles.typeBadgeText}>{item.is_paid ? `₹${item.price}` : 'FREE'}</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <View style={styles.cardLocationRow}>
                <Ionicons name="location-outline" size={14} color={colors.primary} />
                <Text style={[styles.cardCity, { color: colors.textSecondary }]} numberOfLines={1}>{item.city || 'Unknown City'}</Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openDetails(item)} style={[styles.galleryActionBtn, { backgroundColor: colors.primary + '15' }]}>
                   <Ionicons name="eye-outline" size={18} color={colors.primary} />
                   <Text style={[styles.galleryActionText, { color: colors.primary }]}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openNavigation(item.google_maps_url)} style={[styles.galleryActionBtn, { backgroundColor: colors.info + '15' }]}>
                  <Ionicons name="map-outline" size={18} color={colors.info} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEditModal(item)} style={[styles.galleryActionBtn, { backgroundColor: colors.textSecondary + '10' }]}>
                  <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Sort Modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSortModalVisible(false)}>
          <View style={[styles.sortContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sortTitle, { color: colors.text }]}>Sort Locations</Text>
            {[
              { label: 'None', value: 'none' as SortOption },
              { label: 'Name (A-Z)', value: 'name_asc' as SortOption },
              { label: 'Price (Lowest First)', value: 'price_asc' as SortOption },
              { label: 'Price (Highest First)', value: 'price_desc' as SortOption },
              { label: 'Most Used', value: 'usage_desc' as SortOption },
            ].map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sortItem, sortBy === opt.value && { backgroundColor: colors.primary + '15' }]}
                onPress={() => { setSortBy(opt.value); setSortModalVisible(false); }}
              >
                <Text style={[styles.sortItemText, { color: sortBy === opt.value ? colors.primary : colors.text }]}>{opt.label}</Text>
                {sortBy === opt.value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Details Panel Modal */}
      <Modal visible={detailsModalVisible} animationType="slide" transparent>
        <View style={styles.detailOverlay}>
          <View style={[styles.detailPanel, { backgroundColor: colors.surface }]}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)} style={styles.closeDetailsBtn}>
                <Ionicons name="chevron-down" size={30} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.detailTitleContainer}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>{selectedLocation?.name}</Text>
                <Text style={[styles.detailSub, { color: colors.textSecondary }]}>{selectedLocation?.type} • {selectedLocation?.city}</Text>
              </View>
              <TouchableOpacity onPress={() => { setDetailsModalVisible(false); openEditModal(selectedLocation!); }} style={styles.detailEditBtn}>
                <Ionicons name="create-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} pagingEnabled style={styles.detailImagesContainer}>
                {selectedLocation?.images && selectedLocation.images.length > 0 ? (
                  selectedLocation.images.map((img, i) => (
                    <Image key={i} source={{ uri: img }} style={styles.detailHeroImage} />
                  ))
                ) : (
                  <View style={[styles.detailHeroImage, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="image-outline" size={60} color={colors.textTertiary} />
                  </View>
                )}
              </ScrollView>

              <View style={styles.detailContent}>
                <View style={styles.detailStatsRow}>
                   <View style={styles.detailStat}>
                      <Text style={[styles.detailStatLabel, { color: colors.textTertiary }]}>STATUS</Text>
                      <View style={[styles.statusBadgeLarge, { backgroundColor: selectedLocation?.is_paid ? colors.error + '20' : colors.success + '20' }]}>
                        <Text style={[styles.statusBadgeTextLarge, { color: selectedLocation?.is_paid ? colors.error : colors.success }]}>
                          {selectedLocation?.is_paid ? 'PAID' : 'FREE'}
                        </Text>
                      </View>
                   </View>
                   {selectedLocation?.is_paid === 1 && (
                     <View style={styles.detailStat}>
                        <Text style={[styles.detailStatLabel, { color: colors.textTertiary }]}>PRICE</Text>
                        <Text style={[styles.detailStatValue, { color: colors.text }]}>₹{selectedLocation?.price}</Text>
                     </View>
                   )}
                   <View style={styles.detailStat}>
                      <Text style={[styles.detailStatLabel, { color: colors.textTertiary }]}>USAGE</Text>
                      <Text style={[styles.detailStatValue, { color: colors.text }]}>{selectedLocation?.usage_count} Times</Text>
                   </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <Text style={[styles.detailLabelLarge, { color: colors.textTertiary }]}>LOCATION DETAILS</Text>
                <Text style={[styles.venueTitle, { color: colors.text }]}>{selectedLocation?.venue_name || selectedLocation?.name}</Text>
                <Text style={[styles.addressText, { color: colors.textSecondary }]}>{selectedLocation?.address}</Text>
                {selectedLocation?.landmark && (
                  <View style={styles.landmarkRow}>
                    <Ionicons name="navigate-circle-outline" size={18} color={colors.primary} />
                    <Text style={[styles.landmarkText, { color: colors.textTertiary }]}>Near {selectedLocation?.landmark}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => selectedLocation && openNavigation(selectedLocation.google_maps_url)}
                  style={[styles.bigNavBtn, { backgroundColor: colors.primary }]}
                >
                  <Ionicons name="navigate" size={20} color="#fff" />
                  <Text style={styles.bigNavBtnText}>Open in Google Maps</Text>
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <Text style={[styles.detailLabelLarge, { color: colors.textTertiary }]}>SCOUTING NOTES</Text>
                <Text style={[styles.notesBody, { color: colors.textSecondary }]}>{selectedLocation?.notes || 'No notes available for this location.'}</Text>

                <View style={{ height: 100 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={isFilterModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1, width: '100%' }} onPress={() => setIsFilterModalVisible(false)} />
          <View style={{ backgroundColor: colors.surface, width: '90%', borderRadius: 24, overflow: 'hidden', maxHeight: '80%', minHeight: '50%', alignSelf: 'center' }}>
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Filter Locations</Text>
              <TouchableOpacity onPress={() => {
                setFilters({
                  type: 'all',
                  city: '',
                  is_paid: 'all',
                  minPrice: '',
                  maxPrice: '',
                  venue_name: '',
                  landmark: ''
                });
                setFilterType('None');
              }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView nestedScrollEnabled={true} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={true}>
              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginBottom: 10 }]}>Location Type</Text>
              <View style={styles.filterSourceGrid}>
                <TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.type === 'all' ? colors.primary : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, type: 'all' })}>
                  <Text style={{ color: filters.type === 'all' ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>All</Text>
                </TouchableOpacity>
                {locationTypes.map(type => (
                  <TouchableOpacity key={type} style={[styles.filterChip, { backgroundColor: filters.type === type ? colors.primary : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, type })}>
                    <Text style={{ color: filters.type === type ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>{type}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.filterChip, { backgroundColor: colors.surfaceLight, borderColor: colors.primary }]}
                  onPress={() => {
                    setNewTypeName('');
                    setAddTypeModalVisible(true);
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>+ Add Category</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 10 }]}>Payment Status</Text>
              <View style={styles.filterSourceGrid}>
                <TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.is_paid === 'all' ? colors.primary : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, is_paid: 'all' })}>
                  <Text style={{ color: filters.is_paid === 'all' ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.is_paid === 'paid' ? colors.primary : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, is_paid: 'paid' })}>
                  <Text style={{ color: filters.is_paid === 'paid' ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>Paid</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, { backgroundColor: filters.is_paid === 'free' ? colors.primary : colors.surfaceLight, borderColor: colors.borderLight }]} onPress={() => setFilters({ ...filters, is_paid: 'free' })}>
                  <Text style={{ color: filters.is_paid === 'free' ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>Free</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 10 }]}>City</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, padding: 10, borderRadius: 8, marginBottom: 16 }]}
                value={filters.city}
                onChangeText={(text) => setFilters({ ...filters, city: text })}
                placeholder="Search city..."
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 10 }]}>Venue Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, padding: 10, borderRadius: 8, marginBottom: 16 }]}
                value={filters.venue_name}
                onChangeText={(text) => setFilters({ ...filters, venue_name: text })}
                placeholder="Search venue name..."
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 10 }]}>Landmark</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, padding: 10, borderRadius: 8, marginBottom: 16 }]}
                value={filters.landmark}
                onChangeText={(text) => setFilters({ ...filters, landmark: text })}
                placeholder="Search landmark..."
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 10 }]}>Price Range (₹)</Text>
              <View style={styles.rangeRow}>
                <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, padding: 10, borderRadius: 8 }]} value={filters.minPrice} onChangeText={(text) => setFilters({ ...filters, minPrice: text })} placeholder="Min" keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, paddingHorizontal: 8, fontSize: 12 }}>to</Text>
                <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, padding: 10, borderRadius: 8 }]} value={filters.maxPrice} onChangeText={(text) => setFilters({ ...filters, maxPrice: text })} placeholder="Max" keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
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
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editingLocation ? 'Edit Location' : 'New Location'}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Location Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Enter Location Name"
                placeholderTextColor={colors.textTertiary}
                value={formData.name}
                onChangeText={t => setFormData({ ...formData, name: t })}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelectRow}>
                    {locationTypes.map(type => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setFormData({...formData, type})}
                        style={[styles.typeOption, formData.type === type && { backgroundColor: colors.primary, borderColor: colors.primary }, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.typeOptionText, { color: formData.type === type ? '#fff' : colors.textSecondary }]}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => {
                        setNewTypeName('');
                        setAddTypeModalVisible(true);
                      }}
                      style={[styles.typeOption, { borderColor: colors.primary }]}
                    >
                      <Text style={[styles.typeOptionText, { color: colors.primary }]}>+ Add Category</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>City</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="e.g. Hyderabad" placeholderTextColor={colors.textTertiary} value={formData.city} onChangeText={t => setFormData({ ...formData, city: t })} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Venue Name (if any)</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} placeholder="e.g. Taj Falaknuma" placeholderTextColor={colors.textTertiary} value={formData.venue_name} onChangeText={t => setFormData({ ...formData, venue_name: t })} />
                </View>
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="card-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0, marginBottom: 0 }]}>Paid Location</Text>
                </View>
                <Switch
                  value={formData.is_paid}
                  onValueChange={v => setFormData({ ...formData, is_paid: v })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              {formData.is_paid && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Price (₹)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    keyboardType="numeric"
                    placeholder="Enter Price"
                    placeholderTextColor={colors.textTertiary}
                    value={formData.price}
                    onChangeText={t => setFormData({ ...formData, price: t })}
                  />
                </View>
              )}

              <Text style={[styles.label, { color: colors.textSecondary }]}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Full Address"
                placeholderTextColor={colors.textTertiary}
                multiline
                value={formData.address}
                onChangeText={t => setFormData({ ...formData, address: t })}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Landmark</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. Near Hitech City"
                placeholderTextColor={colors.textTertiary}
                value={formData.landmark}
                onChangeText={t => setFormData({ ...formData, landmark: t })}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Google Maps URL</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="https://maps.google.com/..."
                placeholderTextColor={colors.textTertiary}
                value={formData.google_maps_url}
                onChangeText={t => setFormData({ ...formData, google_maps_url: t })}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Scouting Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Light conditions, crowd, etc."
                placeholderTextColor={colors.textTertiary}
                multiline
                value={formData.notes}
                onChangeText={t => setFormData({ ...formData, notes: t })}
              />

              <View style={styles.imageSection}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Photos & References</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                  <TouchableOpacity style={[styles.uploadBox, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={pickImages}>
                    <Ionicons name="add-circle-outline" size={30} color={colors.primary} />
                    <Text style={{ fontSize: 10, color: colors.textTertiary }}>Upload</Text>
                  </TouchableOpacity>
                  {formData.images.map((img, index) => (
                    <View key={index} style={styles.imagePreviewBox}>
                      <Image source={{ uri: img }} style={styles.previewImage} />
                      <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(index)}>
                        <Ionicons name="close-circle" size={20} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={styles.submitBtnText}>{editingLocation ? 'Update Location' : 'Create Location'}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={addTypeModalVisible} transparent animationType="fade" onRequestClose={() => setAddTypeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, width: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Category</Text>
              <TouchableOpacity onPress={() => setAddTypeModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="Category Name"
                placeholderTextColor={colors.textTertiary}
                value={newTypeName}
                onChangeText={setNewTypeName}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.iconBtn, { flex: 1, borderColor: colors.border }]}
                  onPress={() => setAddTypeModalVisible(false)}
                  disabled={addingType}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 1, backgroundColor: colors.primary, marginTop: 0 }]}
                  onPress={handleAddLocationType}
                  disabled={addingType}
                >
                  {addingType ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Add</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 15,
    paddingBottom: 10,
    gap: 10,
  },
  statCard: {
    borderRadius: 15,
    height: 100,
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
  },
  summaryCount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
  },
  summaryIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersSection: { paddingHorizontal: 20, marginBottom: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, height: 48 },
  searchInput: { flex: 1, height: 48, marginLeft: 8, fontSize: 14 },
  iconBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12, paddingHorizontal: 16, gap: 8 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  chipScroll: { paddingBottom: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  chipText: { fontSize: 11, fontWeight: '700' },

  galleryCard: { borderRadius: 25, marginBottom: 20, overflow: 'hidden', borderWidth: 1, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10 },
  cardImageContainer: { height: 200, width: '100%', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  imageOverlay: { ...StyleSheet.absoluteFillObject },
  typeBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  paidBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  cardContent: { padding: 15 },
  cardName: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 },
  cardCity: { fontSize: 13, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 10 },
  galleryActionBtn: { flex: 1, height: 40, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  galleryActionText: { fontSize: 12, fontWeight: '700' },

  sortContent: { width: '80%', borderRadius: 25, padding: 20 },
  sortTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  sortItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, borderRadius: 12, marginBottom: 5 },
  sortItemText: { fontSize: 16, fontWeight: '600' },

  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  detailPanel: { height: '92%', borderTopLeftRadius: 35, borderTopRightRadius: 35, overflow: 'hidden' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  closeDetailsBtn: { width: 44, height: 44, justifyContent: 'center' },
  detailTitleContainer: { flex: 1, marginLeft: 10 },
  detailTitle: { fontSize: 22, fontWeight: '800' },
  detailSub: { fontSize: 13, fontWeight: '600' },
  detailEditBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  detailImagesContainer: { height: 450, backgroundColor: '#000' },
  detailHeroImage: { width: width, height: 450, resizeMode: 'contain' },
  detailContent: { padding: 20 },
  detailStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  detailStat: { flex: 1 },
  detailStatLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 5 },
  detailStatValue: { fontSize: 18, fontWeight: '700' },
  statusBadgeLarge: { alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  statusBadgeTextLarge: { fontSize: 14, fontWeight: '800' },

  divider: { height: 1, marginVertical: 20, opacity: 0.1 },
  detailLabelLarge: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  venueTitle: { fontSize: 20, fontWeight: '800', marginBottom: 5 },
  addressText: { fontSize: 15, lineHeight: 22, marginBottom: 15 },
  landmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 25 },
  landmarkText: { fontSize: 14, fontWeight: '600' },

  bigNavBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, gap: 10, elevation: 4 },
  bigNavBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  notesBody: { fontSize: 15, lineHeight: 24 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '95%', maxHeight: '90%', borderRadius: 30, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  input: { height: 50, borderRadius: 15, borderWidth: 1, paddingHorizontal: 15, fontSize: 15 },
  textArea: { height: 80, paddingVertical: 12, textAlignVertical: 'top' },
  formRow: { flexDirection: 'row', marginBottom: 0 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingHorizontal: 5 },
  typeSelectRow: { marginVertical: 5 },
  typeOption: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginRight: 10 },
  typeOptionText: { fontSize: 12, fontWeight: '700' },
  imageSection: { marginTop: 10 },
  imageScroll: { flexDirection: 'row', marginTop: 10 },
  uploadBox: { width: 80, height: 80, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  imagePreviewBox: { width: 80, height: 80, borderRadius: 15, marginRight: 10, position: 'relative' },
  previewImage: { width: '100%', height: '100%', borderRadius: 15 },
  removeImageBtn: { position: 'absolute', top: -5, right: -5 },
  submitBtn: { padding: 18, borderRadius: 18, alignItems: 'center', marginTop: 30, marginBottom: 20 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  inputGroup: { marginTop: 0 },

  // Filter modal styles
  filterSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  filterSourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' },
  rangeRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  submitButton: { padding: 18, borderRadius: 18, alignItems: 'center', marginTop: 30, marginBottom: 20 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
