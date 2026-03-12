import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { getDatabase } from '../src/database/db';
import * as DocumentPicker from 'expo-document-picker';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = width > 768 ? 4 : 2;
const ITEM_WIDTH = (width - (COLUMN_COUNT + 1) * 16) / COLUMN_COUNT;
// Updated to use environment variable or your specific server IP for mobile connectivity
const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.10:8000';

interface PortfolioItem {
  id: number;
  title: string;
  media_type: 'image' | 'video';
  file_path: string;
  thumbnail_path?: string;
  category: string;
  description: string;
  tags: string;
  featured: number;
  created_at: string;
}

const VideoPlayerItem = ({ uri, style }: { uri: string, style: any }) => {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.play();
  });

  return (
    <VideoView
      style={style}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
      contentFit="contain"
    />
  );
};

interface CardProps {
  item: PortfolioItem;
  index: number;
  colors: any;
  activeItemActions: number | null;
  setActiveItemActions: (id: number | null) => void;
  openViewer: (index: number) => void;
  toggleFeatured: (item: PortfolioItem) => void;
  handleDelete: (id: number) => void;
}

const PortfolioCard = ({
  item,
  index,
  colors,
  activeItemActions,
  setActiveItemActions,
  openViewer,
  toggleFeatured,
  handleDelete
}: CardProps) => {
  const lastTap = useRef<number>(0);

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (lastTap.current && (now - lastTap.current) < DOUBLE_TAP_DELAY) {
      // Double tap detected
      openViewer(index);
      setActiveItemActions(null);
      lastTap.current = 0; // Reset
    } else {
      // Single tap
      setActiveItemActions(activeItemActions === item.id ? null : item.id);
      lastTap.current = now;
    }
  };

  const showActions = activeItemActions === item.id;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Image
        source={item.media_type === 'image' ? item.file_path : item.thumbnail_path || item.file_path}
        style={styles.cardImage}
        contentFit="cover"
        allowDownscaling={false}
        transition={200}
      />
      {item.media_type === 'video' && !showActions && (
        <View style={styles.playIconContainer}><Ionicons name="play" size={32} color="#fff" /></View>
      )}
      {item.featured === 1 && (
        <View style={[styles.featuredBadge, { backgroundColor: colors.primary }]}><Ionicons name="star" size={12} color="#fff" /></View>
      )}
      {showActions && (
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.cardOverlay}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => toggleFeatured(item)} style={styles.actionBtn}>
              <Ionicons name={item.featured ? "star" : "star-outline"} size={18} color={item.featured ? colors.primary : "#fff"} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openViewer(index)} style={styles.actionBtn}>
              <Ionicons name="expand-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
};

export default function CommercialPortfolio() {
  const { colors } = useThemeStore();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const imageListRef = useRef<FlatList>(null);
  const [activeItemActions, setActiveItemActions] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const db = getDatabase();
      const result = await db.getAllAsync(
        "SELECT * FROM portfolio WHERE category = 'Commercial' ORDER BY created_at DESC"
      );
      setItems(result as PortfolioItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesTab = item.media_type === activeTab;
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (item.tags && item.tags.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [items, activeTab, searchQuery]);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: activeTab === 'image' ? 'image/*' : 'video/*',
        multiple: true
      });

      if (!result.canceled) {
        setIsUploading(true);
        const db = getDatabase();

        for (const asset of result.assets) {
          let finalUri = asset.uri;

          if (activeTab === 'image') {
            const manipResult = await ImageManipulator.manipulateAsync(
              asset.uri,
              [{ resize: { width: 2560 } }],
              { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );
            finalUri = manipResult.uri;
          }

          const formData = new FormData();
          formData.append('file', {
            uri: finalUri,
            name: asset.name,
            type: asset.mimeType || (activeTab === 'image' ? 'image/jpeg' : 'video/mp4'),
          } as any);

          try {
            const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 8000 // Fast fail for fallback
            });

            const serverUrl = `${API_BASE_URL}${response.data.url}`;
            const thumbUrl = response.data.thumbnail_url ? `${API_BASE_URL}${response.data.thumbnail_url}` : null;

            await db.runAsync(
              'INSERT INTO portfolio (title, media_type, file_path, thumbnail_path, category, featured) VALUES (?, ?, ?, ?, ?, ?)',
              [asset.name, activeTab, serverUrl, thumbUrl, 'Commercial', 0]
            );
          } catch (uploadErr) {
            console.log("Server upload failed, using local storage fallback", uploadErr);
            await db.runAsync(
              'INSERT INTO portfolio (title, media_type, file_path, category, featured) VALUES (?, ?, ?, ?, ?)',
              [asset.name, activeTab, finalUri, 'Commercial', 0]
            );
          }
        }
        loadItems();
        setIsUploading(false);
        Alert.alert('Success', `${result.assets.length} items processed`);
      }
    } catch (e) {
      setIsUploading(false);
      console.error(e);
      Alert.alert('Error', 'Upload failed');
    }
  };

  const toggleFeatured = async (item: PortfolioItem) => {
    try {
      const db = getDatabase();
      await db.runAsync('UPDATE portfolio SET featured = ? WHERE id = ?', [item.featured ? 0 : 1, item.id]);
      loadItems();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Media', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const db = getDatabase();
          await db.runAsync('DELETE FROM portfolio WHERE id = ?', [id]);
          loadItems();
          setActiveItemActions(null);
        } catch (e) { console.error(e); }
      }}
    ]);
  };

  const openViewer = (index: number) => {
    setCurrentIndex(index);
    setViewerVisible(true);
  };

  const navigateMedia = (direction: 'next' | 'prev') => {
    let newIndex = currentIndex;
    if (direction === 'next' && currentIndex < filteredItems.length - 1) {
      newIndex = currentIndex + 1;
    } else if (direction === 'prev' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    }

    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      if (activeTab === 'image' && imageListRef.current) {
        imageListRef.current.scrollToIndex({ index: newIndex, animated: true });
      }
    }
  };

  const ViewerModal = () => {
    const currentItem = filteredItems[currentIndex];
    if (!currentItem) return null;

    return (
      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerContainer}>
          <StatusBar barStyle="light-content" />
          <TouchableOpacity style={styles.closeViewer} onPress={() => setViewerVisible(false)}>
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          <View style={styles.viewerContent}>
            {activeTab === 'image' ? (
              <FlatList
                ref={imageListRef}
                data={filteredItems}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id.toString()}
                initialScrollIndex={currentIndex}
                getItemLayout={(_, index) => ({
                  length: dimensions.width,
                  offset: dimensions.width * index,
                  index,
                })}
                onMomentumScrollEnd={(e) => {
                  const newIndex = Math.round(e.nativeEvent.contentOffset.x / dimensions.width);
                  setCurrentIndex(newIndex);
                }}
                renderItem={({ item }) => (
                  <View style={{ width: dimensions.width, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                    <Image
                      source={item.file_path}
                      style={{ width: dimensions.width, height: '100%' }}
                      contentFit="contain"
                      allowDownscaling={false}
                      cachePolicy="memory-disk"
                      priority="high"
                    />
                  </View>
                )}
              />
            ) : (
              <View style={{ width: dimensions.width, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                <VideoPlayerItem uri={currentItem.file_path} style={{ width: dimensions.width, height: '100%' }} />

                <View style={styles.navigationArrows} pointerEvents="box-none">
                  <TouchableOpacity
                    style={[styles.navArrow, currentIndex === 0 && { opacity: 0 }]}
                    onPress={() => navigateMedia('prev')}
                    disabled={currentIndex === 0}
                  >
                    <BlurView intensity={20} tint="light" style={styles.arrowBlur}>
                      <Ionicons name="chevron-back" size={32} color="#fff" />
                    </BlurView>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.navArrow, currentIndex === filteredItems.length - 1 && { opacity: 0 }]}
                    onPress={() => navigateMedia('next')}
                    disabled={currentIndex === filteredItems.length - 1}
                  >
                    <BlurView intensity={20} tint="light" style={styles.arrowBlur}>
                      <Ionicons name="chevron-forward" size={32} color="#fff" />
                    </BlurView>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
          <View style={styles.viewerFooter}>
            <Text style={styles.viewerTitle}>{currentItem.title}</Text>
            <Text style={styles.viewerCounter}>{currentIndex + 1} / {filteredItems.length}</Text>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isUploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: '#fff', marginTop: 10 }}>Uploading High Quality Media...</Text>
        </View>
      )}
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="Search Commercial..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.primary }]} onPress={handleUpload}>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.tabBar}>
          <TouchableOpacity onPress={() => { setActiveTab('image'); setCurrentIndex(0); }} style={[styles.tab, activeTab === 'image' && { borderBottomColor: colors.primary }]}>
            <Text style={{ color: activeTab === 'image' ? colors.primary : colors.textSecondary }}>Images</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setActiveTab('video'); setCurrentIndex(0); }} style={[styles.tab, activeTab === 'video' && { borderBottomColor: colors.primary }]}>
            <Text style={{ color: activeTab === 'video' ? colors.primary : colors.textSecondary }}>Videos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} /> : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item, index }) => (
            <PortfolioCard
              item={item}
              index={index}
              colors={colors}
              activeItemActions={activeItemActions}
              setActiveItemActions={setActiveItemActions}
              openViewer={openViewer}
              toggleFeatured={toggleFeatured}
              handleDelete={handleDelete}
            />
          )}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.gridContent}
        />
      )}

      <ViewerModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: { flex: 1, height: 48, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1 },
  uploadBtn: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', marginTop: 16 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  gridContent: { padding: 8 },
  card: { width: ITEM_WIDTH, height: ITEM_WIDTH, borderRadius: 16, margin: 8, overflow: 'hidden', borderWidth: 1 },
  cardImage: { width: '100%', height: '100%' },
  playIconContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  featuredBadge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
  cardTitle: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { padding: 4 },
  viewerContainer: { flex: 1, backgroundColor: '#000' },
  closeViewer: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
  viewerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navigationArrows: { position: 'absolute', width: '100%', top: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, zIndex: 5 },
  navArrow: { padding: 10 },
  arrowBlur: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  viewerFooter: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20, zIndex: 5 },
  viewerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  viewerCounter: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 8 },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, justifyContent: 'center', alignItems: 'center' },
});
