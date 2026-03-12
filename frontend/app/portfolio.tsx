import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function PortfolioPage() {
  const { colors } = useThemeStore();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();

  // Calculate banner height to fit 4 banners on screen
  const availableHeight = screenHeight - (Platform.OS === 'ios' ? 180 : 160);
  const bannerHeight = Math.max(availableHeight / 4, 140);

  const CategoryBanner = ({ title, desc, tag, image, route }: any) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push(route)}
      style={[styles.bannerContainer, { height: bannerHeight }]}
    >
      <ImageBackground
        source={{ uri: image }}
        style={styles.bannerImage}
        imageStyle={{ borderRadius: 20 }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.bannerGradient}
        >
          <View>
            <Text style={styles.bannerTag}>{tag}</Text>
            <Text style={styles.bannerTitle}>{title}</Text>
            <Text style={styles.bannerDesc}>{desc}</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={32} color="#fff" />
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <CategoryBanner
            title="Wedding Portfolio"
            desc="Explore our premium wedding collections"
            tag="FEATURED"
            image="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop"
            route="/wedding-portfolio"
          />

          <CategoryBanner
            title="Fashion"
            desc="Studio & Outdoor Portfolio"
            tag="MODELING"
            image="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
            route="/fashion-portfolio"
          />

          <CategoryBanner
            title="Event"
            desc="Birthday, Parties & Functions"
            tag="CELEBRATION"
            image="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2069&auto=format&fit=crop"
            route="/event-portfolio"
          />

          <CategoryBanner
            title="Commercial"
            desc="Corporate & Branding Shoots"
            tag="BUSINESS"
            image="https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop"
            route="/commercial-portfolio"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    gap: 12,
  },
  bannerContainer: {
    width: '100%',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  bannerImage: {
    flex: 1,
    width: '100%',
  },
  bannerGradient: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bannerTag: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  bannerDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
});
