import React, { memo, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FilmIcon, StarIcon, ChevronIcon } from '@/components/AppIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.37;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

export interface ContentItem {
  id: string;
  title: string;
  poster: string;
  vod_type?: string;
  category?: string;
  year?: string;
  rating?: string;
  token?: string;
  imdb_id?: string;
  tmdb_id?: string;
}

interface ContentRowProps {
  title: string;
  items: ContentItem[];
  onItemPress?: (item: ContentItem) => void;
  onSeeAll?: () => void;
  cardWidth?: number;
  cardHeight?: number;
  showBadge?: boolean;
}

interface CardProps {
  item: ContentItem;
  cardWidth: number;
  cardHeight: number;
  showBadge: boolean;
  onItemPress?: (item: ContentItem) => void;
  inputBg: string;
  textSecondary: string;
}

const ContentCard = memo(({ item, cardWidth, cardHeight, showBadge, onItemPress, inputBg, textSecondary }: CardProps) => {
  const ratingVal = item.rating ? parseFloat(item.rating) : 0;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [imgError, setImgError] = useState(false);
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
    <TouchableOpacity
      style={[styles.card, { width: cardWidth, height: cardHeight }]}
      activeOpacity={0.9}
      onPress={() => onItemPress?.(item)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {item.poster && !imgError ? (
        <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" onError={() => setImgError(true)} />
      ) : (
        <View style={[styles.noPoster, { backgroundColor: inputBg }]}>
          <FilmIcon size={28} color={textSecondary} />
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
        locations={[0.38, 0.68, 1]}
        style={styles.posterGradient}
      />

      {showBadge && item.vod_type && (
        <View style={[styles.typeBadge, {
          backgroundColor: item.vod_type === 'movie' ? 'rgba(255,184,0,0.92)' : 'rgba(99,102,241,0.92)',
        }]}>
          <Text style={styles.typeBadgeText}>{item.vod_type === 'movie' ? 'فيلم' : 'مسلسل'}</Text>
        </View>
      )}

      {ratingVal > 0 && (
        <View style={styles.ratingBadge}>
          <StarIcon size={8} color="#FFB800" />
          <Text style={styles.ratingBadgeText}>{ratingVal.toFixed(1)}</Text>
        </View>
      )}

      <View style={styles.cardBottom}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        {item.year ? <Text style={styles.cardYear}>{item.year}</Text> : null}
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
});

function ContentRow({
  title,
  items,
  onItemPress,
  onSeeAll,
  cardWidth = CARD_WIDTH,
  cardHeight = CARD_HEIGHT,
  showBadge = false,
}: ContentRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const renderItem = useCallback(({ item }: { item: ContentItem }) => (
    <ContentCard
      item={item}
      cardWidth={cardWidth}
      cardHeight={cardHeight}
      showBadge={showBadge}
      onItemPress={onItemPress}
      inputBg={colors.inputBackground}
      textSecondary={colors.textSecondary}
    />
  ), [cardWidth, cardHeight, showBadge, onItemPress, colors.inputBackground, colors.textSecondary]);

  if (!items.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.accentBar} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        </View>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.seeAllText}>المزيد</Text>
            <ChevronIcon size={13} color={Colors.brand.primary} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        removeClippedSubviews
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        getItemLayout={(_, index) => ({
          length: cardWidth + 8,
          offset: (cardWidth + 8) * index + 12,
          index,
        })}
      />
    </View>
  );
}

export default React.memo(ContentRow);

const styles = StyleSheet.create({
  container: { marginBottom: 28 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accentBar: { width: 3, height: 17, borderRadius: 2, backgroundColor: Colors.brand.primary },
  sectionTitle: { fontFamily: Colors.fonts.bold, fontSize: 16, letterSpacing: 0.2 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  seeAllText: { fontFamily: Colors.fonts.medium, fontSize: 13, color: Colors.brand.primary },
  list: { paddingHorizontal: 12, gap: 8 },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  poster: { width: '100%', height: '100%', position: 'absolute' },
  noPoster: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  posterGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '68%',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 10, letterSpacing: 0.3 },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingBadgeText: { fontFamily: Colors.fonts.bold, color: '#FFB800', fontSize: 10 },
  cardBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    paddingBottom: 12,
  },
  cardTitle: {
    fontFamily: Colors.fonts.bold,
    color: '#fff',
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 17,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardYear: {
    fontFamily: Colors.fonts.regular,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 3,
  },
});
