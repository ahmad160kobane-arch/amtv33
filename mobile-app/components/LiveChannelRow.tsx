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
import { RadioIcon, ChevronIcon } from '@/components/AppIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { FreeChannel } from '@/constants/Api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.37;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

interface LiveChannelCardProps {
  item: FreeChannel;
  cardWidth: number;
  cardHeight: number;
  onPress?: (item: FreeChannel) => void;
  inputBg: string;
  textSecondary: string;
}

const LiveChannelCard = memo(({ item, cardWidth, cardHeight, onPress, inputBg, textSecondary }: LiveChannelCardProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [imgError, setImgError] = useState(false);
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return (
  <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
  <TouchableOpacity
    style={[styles.card, { width: cardWidth, height: cardHeight }]}
    activeOpacity={0.9}
    onPress={() => onPress?.(item)}
    onPressIn={onPressIn}
    onPressOut={onPressOut}
  >
    <View style={[styles.logoBg, { backgroundColor: inputBg }]}>
      {item.logo && !imgError ? (
        <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" onError={() => setImgError(true)} />
      ) : (
        <RadioIcon size={36} color={textSecondary} />
      )}
    </View>

    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.92)']}
      locations={[0.35, 0.65, 1]}
      style={styles.gradient}
    />

    {/* مباشر badge */}
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveBadgeText}>مباشر</Text>
    </View>

    {/* Category badge */}
    {item.group ? (
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText} numberOfLines={1}>{item.group}</Text>
      </View>
    ) : null}

    <View style={styles.cardBottom}>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
    </View>
  </TouchableOpacity>
  </Animated.View>
  );
});

interface LiveChannelRowProps {
  title: string;
  channels: FreeChannel[];
  onChannelPress?: (channel: FreeChannel) => void;
  onSeeAll?: () => void;
  cardWidth?: number;
  cardHeight?: number;
}

function LiveChannelRow({
  title,
  channels,
  onChannelPress,
  onSeeAll,
  cardWidth = CARD_WIDTH,
  cardHeight = CARD_HEIGHT,
}: LiveChannelRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const renderItem = useCallback(({ item }: { item: FreeChannel }) => (
    <LiveChannelCard
      item={item}
      cardWidth={cardWidth}
      cardHeight={cardHeight}
      onPress={onChannelPress}
      inputBg={colors.inputBackground}
      textSecondary={colors.textSecondary}
    />
  ), [cardWidth, cardHeight, onChannelPress, colors.inputBackground, colors.textSecondary]);

  if (!channels.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.accentBar} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          <View style={styles.headerLiveDot} />
        </View>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.seeAllText}>المزيد</Text>
            <ChevronIcon size={13} color={Colors.brand.primary} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={channels}
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

export default React.memo(LiveChannelRow);

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
  headerLiveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand.success,
    shadowColor: Colors.brand.success, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 4,
  },
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
  logoBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  logo: { width: '70%', height: '55%' },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '68%',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,199,89,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#34C759' },
  liveBadgeText: { fontFamily: Colors.fonts.bold, fontSize: 10, color: '#34C759' },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: { fontFamily: Colors.fonts.medium, color: 'rgba(255,255,255,0.85)', fontSize: 10 },
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
});
