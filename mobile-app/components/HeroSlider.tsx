import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { VideoIcon, TvIcon, StarIcon, PlayIcon } from '@/components/AppIcons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const { width } = Dimensions.get('window');
const HERO_HEIGHT = width * 0.64;

export interface HeroItem {
  id: string;
  title: string;
  poster: string;
  vod_type?: string;
  imdb_id?: string;
  tmdb_id?: string;
  year?: string;
  rating?: string;
  genres?: string[];
}

interface HeroSliderProps {
  items: HeroItem[];
  onItemPress?: (item: HeroItem) => void;
}

function HeroSlider({ items, onItemPress }: HeroSliderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      const next = (activeIndex + 1) % items.length;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }, 4500);
    return () => clearInterval(timer);
  }, [activeIndex, items.length]);

  if (!items.length) return null;

  const renderItem = useCallback(({ item }: { item: HeroItem }) => {
    const ratingVal = item.rating ? parseFloat(item.rating) : 0;
    return (
      <TouchableOpacity activeOpacity={0.92} onPress={() => onItemPress?.(item)} style={styles.heroItem}>
        <Image source={{ uri: item.poster }} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.7)', colors.background]}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.gradient}
        />
        <View style={styles.heroInfo}>
          {/* Meta pills row */}
          <View style={styles.metaPills}>
            {item.vod_type && (
              <View style={[styles.pill, { backgroundColor: item.vod_type === 'movie' ? 'rgba(255,184,0,0.18)' : 'rgba(99,102,241,0.18)', borderColor: item.vod_type === 'movie' ? 'rgba(255,184,0,0.5)' : 'rgba(99,102,241,0.5)' }]}>
                {item.vod_type === 'movie' ? <VideoIcon size={10} color={Colors.brand.primary} /> : <TvIcon size={10} color="#6366F1" />}
                <Text style={[styles.pillText, { color: item.vod_type === 'movie' ? Colors.brand.primary : '#6366F1' }]}>
                  {item.vod_type === 'movie' ? 'فيلم' : 'مسلسل'}
                </Text>
              </View>
            )}
            {ratingVal > 0 && (
              <View style={[styles.pill, { backgroundColor: 'rgba(255,184,0,0.12)', borderColor: 'rgba(255,184,0,0.4)' }]}>
                <StarIcon size={10} color="#FFB800" />
                <Text style={[styles.pillText, { color: '#FFB800' }]}>{ratingVal.toFixed(1)}</Text>
              </View>
            )}
            {item.year ? (
              <View style={[styles.pill, { backgroundColor: 'rgba(0,0,0,0.40)', borderColor: 'rgba(255,255,255,0.25)' }]}>
                <Text style={[styles.pillText, { color: '#fff' }]}>{item.year}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.heroTitle} numberOfLines={2}>{item.title}</Text>

          {/* Genres */}
          {item.genres && item.genres.length > 0 && (
            <Text style={styles.heroGenres} numberOfLines={1}>
              {item.genres.slice(0, 3).join(' · ')}
            </Text>
          )}

          {/* Play button */}
          <TouchableOpacity style={styles.playBtn} onPress={() => onItemPress?.(item)} activeOpacity={0.85}>
            <LinearGradient colors={Colors.brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.playBtnGradient}>
              <PlayIcon size={14} color="#fff" />
              <Text style={styles.playBtnText}>شاهد الآن</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [onItemPress, colors.background]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(idx);
        }}
        removeClippedSubviews
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />
      {items.length > 1 && (
        <View style={styles.pagination}>
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
          ))}
        </View>
      )}
    </View>
  );
}

export default React.memo(HeroSlider);

const styles = StyleSheet.create({
  container: { marginBottom: 22 },
  heroItem: { width, height: HERO_HEIGHT },
  heroImage: { width: '100%', height: '100%' },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.82,
  },
  heroInfo: {
    position: 'absolute',
    bottom: 18,
    right: 16,
    left: 16,
    alignItems: 'flex-start',
  },
  metaPills: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: { fontFamily: Colors.fonts.bold, fontSize: 10 },
  heroTitle: {
    fontFamily: Colors.fonts.extraBold,
    fontSize: 24,
    color: '#fff',
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    marginBottom: 8,
    alignSelf: 'stretch',
    lineHeight: 32,
  },
  heroGenres: {
    fontFamily: Colors.fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'right',
    marginBottom: 14,
  },
  playBtn: { alignSelf: 'flex-start', borderRadius: 22, overflow: 'hidden' },
  playBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  playBtnText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 14 },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    gap: 5,
  },
  dot: { height: 3, borderRadius: 1.5 },
  dotActive: { backgroundColor: Colors.brand.primary, width: 22 },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.2)', width: 8 },
});
