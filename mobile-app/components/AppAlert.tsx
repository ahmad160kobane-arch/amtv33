import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
} from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Pressable, Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';

export interface AppAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AppAlertConfig {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
}

interface AlertContextType {
  show: (config: AppAlertConfig) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const [config, setConfig] = useState<AppAlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardAnim    = useRef(new Animated.Value(0.85)).current;

  const show = useCallback((cfg: AppAlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(cardAnim, { toValue: 1, friction: 7, tension: 100, useNativeDriver: true }),
      ]).start();
    } else {
      backdropAnim.setValue(0);
      cardAnim.setValue(0.85);
    }
  }, [visible]);

  const dismiss = (onPress?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 0.88, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setConfig(null);
      onPress?.();
    });
  };

  const buttons: AppAlertButton[] = config?.buttons ?? [{ text: 'حسناً', style: 'default' }];

  return (
    <AlertContext.Provider value={{ show }}>
      {children}
      <Modal transparent visible={visible} animationType="none" onRequestClose={() => dismiss()}>
        <Pressable style={styles.backdrop} onPress={() => {
          const cancel = buttons.find(b => b.style === 'cancel');
          dismiss(cancel?.onPress);
        }}>
          <Animated.View style={[styles.backdropInner, { opacity: backdropAnim }]} />
        </Pressable>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                transform: [{ scale: cardAnim }],
                opacity: backdropAnim,
              },
            ]}
          >
            <View style={styles.cardContent}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,184,0,0.12)' }]}>
                <Text style={styles.iconEmoji}>⚠️</Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{config?.title}</Text>
              {config?.message ? (
                <Text style={[styles.message, { color: colors.textSecondary }]}>{config.message}</Text>
              ) : null}
            </View>

            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]} />

            <View style={[styles.buttonsRow, buttons.length > 2 && styles.buttonsCol]}>
              {buttons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel      = btn.style === 'cancel';
                const isLast        = i === buttons.length - 1;
                const btnColor      = isDestructive
                  ? Colors.brand.error
                  : isCancel
                  ? colors.textSecondary
                  : Colors.brand.primary;

                return (
                  <React.Fragment key={i}>
                    {i > 0 && buttons.length <= 2 && (
                      <View style={[styles.btnSeparator, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]} />
                    )}
                    <TouchableOpacity
                      style={[
                        styles.btn,
                        buttons.length > 2 && styles.btnFull,
                        !isLast && buttons.length > 2 && { borderBottomWidth: 0.5, borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' },
                      ]}
                      onPress={() => dismiss(btn.onPress)}
                      activeOpacity={0.6}
                    >
                      <Text style={[
                        styles.btnText,
                        { color: btnColor },
                        isCancel && styles.btnTextCancel,
                      ]}>
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAppAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAppAlert must be used within AppAlertProvider');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: { elevation: 20 },
    }),
  },
  cardContent: {
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 10,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconEmoji: { fontSize: 24 },
  title: {
    fontFamily: Colors.fonts.bold,
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
  },
  message: {
    fontFamily: Colors.fonts.regular,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  divider: { height: 0.5 },
  buttonsRow: { flexDirection: 'row' },
  buttonsCol: { flexDirection: 'column' },
  btn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: { flex: 0 },
  btnSeparator: { width: 0.5 },
  btnText: {
    fontFamily: Colors.fonts.bold,
    fontSize: 16,
  },
  btnTextCancel: {
    fontFamily: Colors.fonts.regular,
  },
});
