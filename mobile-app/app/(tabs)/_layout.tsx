import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { View, Text, Pressable, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon, LiveIcon, ExploreIcon, KidsIcon, AccountIcon, BookmarkIcon } from '@/components/AppIcons';

function renderTabIcon(routeName: string, color: string, filled: boolean) {
  const size = 22;
  switch (routeName) {
    case 'index': return <HomeIcon size={size} color={color} filled={filled} />;
    case 'live': return <LiveIcon size={size} color={color} filled={filled} />;
    case 'entertainment': return <ExploreIcon size={size} color={color} filled={filled} />;
    case 'kids': return <KidsIcon size={size} color={color} filled={filled} />;
    case 'mylist': return <BookmarkIcon size={size} color={color} filled={filled} />;
    case 'account': return <AccountIcon size={size} color={color} filled={filled} />;
    default: return <HomeIcon size={size} color={color} filled={filled} />;
  }
}

function TabItem({
  routeName,
  label,
  isFocused,
  onPress,
  onLongPress,
  activeColor,
  inactiveColor,
}: {
  routeName: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  activeColor: string;
  inactiveColor: string;
}) {
  const anim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();
  }, [isFocused]);

  const iconScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const pillOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const pillScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const labelOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
    >
      <View style={styles.tabItemInner}>
        <Animated.View
          style={[
            styles.pillBg,
            { opacity: pillOpacity, transform: [{ scale: pillScale }] },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          {renderTabIcon(routeName, isFocused ? activeColor : inactiveColor, isFocused)}
        </Animated.View>
        <Animated.Text
          style={[
            styles.tabLabel,
            {
              opacity: labelOpacity,
              color: isFocused ? activeColor : inactiveColor,
              fontFamily: isFocused ? Colors.fonts.bold : Colors.fonts.regular,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor:
            colorScheme === 'dark'
              ? 'rgba(10, 10, 12, 0.96)'
              : 'rgba(248, 248, 250, 0.96)',
          borderTopColor: colors.divider,
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TabItem
            key={route.key}
            routeName={route.name}
            label={label}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            activeColor={Colors.brand.primary}
            inactiveColor={colors.tabIconDefault}
          />
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية' }} />
      <Tabs.Screen name="live" options={{ title: 'مباشر' }} />
      <Tabs.Screen name="entertainment" options={{ title: 'ترفيه' }} />
      <Tabs.Screen name="kids" options={{ title: 'أطفال' }} />
      <Tabs.Screen name="mylist" options={{ title: 'قائمتي' }} />
      <Tabs.Screen name="account" options={{ title: 'حسابي' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  pillBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 184, 0, 0.10)',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 0.1,
  },
});
