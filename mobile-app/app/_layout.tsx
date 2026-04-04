import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { AppAlertProvider } from '@/components/AppAlert';

SplashScreen.preventAutoHideAsync();

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [fontsLoaded] = useFonts({
    'Tajawal-Light': require('../assets/fonts/Tajawal-Light.ttf'),
    'Tajawal-Regular': require('../assets/fonts/Tajawal-Regular.ttf'),
    'Tajawal-Medium': require('../assets/fonts/Tajawal-Medium.ttf'),
    'Tajawal-Bold': require('../assets/fonts/Tajawal-Bold.ttf'),
    'Tajawal-ExtraBold': require('../assets/fonts/Tajawal-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AppAlertProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_left',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen
          name="player"
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="live"
          options={{
            headerShown: false,
            animation: 'slide_from_left',
          }}
        />
        <Stack.Screen
          name="allcontent"
          options={{
            headerShown: false,
            animation: 'slide_from_left',
          }}
        />
        <Stack.Screen name="detail" options={{ headerShown: false, animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="favorites" options={{ headerShown: false, animation: 'slide_from_left' }} />
        <Stack.Screen name="subscription" options={{ headerShown: false, animation: 'slide_from_left' }} />
        <Stack.Screen name="history" options={{ headerShown: false, animation: 'slide_from_left' }} />
        <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_left' }} />
        <Stack.Screen name="privacy" options={{ headerShown: false, animation: 'slide_from_left' }} />
        <Stack.Screen name="support" options={{ headerShown: false, animation: 'slide_from_left' }} />
        <Stack.Screen name="agent" options={{ headerShown: false, animation: 'slide_from_left' }} />
      </Stack>
      </AppAlertProvider>
    </SafeAreaProvider>
  );
}
