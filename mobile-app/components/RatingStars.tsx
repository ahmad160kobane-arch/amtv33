import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fetchRating, submitRating, RatingInfo, isLoggedIn } from '@/constants/Api';

interface Props {
  vodId: string;
  compact?: boolean;
}

export default function RatingStars({ vodId, compact }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [info, setInfo] = useState<RatingInfo>({ average: 0, count: 0, userScore: 0 });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRating(vodId).then(setInfo);
  }, [vodId]);

  const handleRate = async (score: number) => {
    const loggedIn = await isLoggedIn();
    if (!loggedIn || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitRating(vodId, score);
      setInfo(result);
    } catch {}
    setSubmitting(false);
  };

  if (compact) {
    return (
      <View style={styles.compactRow}>
        <Ionicons name="star" size={12} color="#FFB800" />
        <Text style={[styles.compactText, { color: colors.textSecondary }]}>
          {info.average > 0 ? info.average.toFixed(1) : '—'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity key={s} onPress={() => handleRate(s)} activeOpacity={0.6} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <Ionicons
              name={s <= info.userScore ? 'star' : s <= Math.round(info.average) ? 'star-half' : 'star-outline'}
              size={20}
              color={s <= info.userScore ? '#FFB800' : '#FFB800'}
            />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
        {info.average > 0 ? `${info.average.toFixed(1)}` : '—'} ({info.count})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  starsRow: { flexDirection: 'row', gap: 2 },
  ratingText: { fontFamily: Colors.fonts.regular, fontSize: 12 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  compactText: { fontFamily: Colors.fonts.medium, fontSize: 11 },
});
