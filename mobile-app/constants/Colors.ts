const tintColorLight = '#FF9500';
const tintColorDark = '#FFB800';

const Colors = {
  light: {
    text: '#1A1A1A',
    textSecondary: '#6B6B6B',
    background: '#F8F8FA',
    cardBackground: '#FFFFFF',
    cardBorder: '#EBEBF0',
    tint: tintColorLight,
    tabIconDefault: '#B0B0B0',
    tabIconSelected: tintColorLight,
    headerBackground: '#F8F8FA',
    inputBackground: '#F0F0F3',
    divider: '#E5E5EA',
    overlay: 'rgba(0,0,0,0.3)',
    glass: 'rgba(255,255,255,0.7)',
    glassBorder: 'rgba(255,255,255,0.5)',
  },
  dark: {
    text: '#F1F1F1',
    textSecondary: '#8E8E93',
    background: '#0A0A0C',
    cardBackground: '#161618',
    cardBorder: '#222226',
    tint: tintColorDark,
    tabIconDefault: '#48484A',
    tabIconSelected: tintColorDark,
    headerBackground: '#0E0E10',
    inputBackground: '#1C1C1E',
    divider: '#2C2C2E',
    overlay: 'rgba(0,0,0,0.65)',
    glass: 'rgba(255,255,255,0.06)',
    glassBorder: 'rgba(255,255,255,0.08)',
  },
  brand: {
    primary: '#FFB800',
    primaryDark: '#FF9500',
    secondary: '#FF6B00',
    gradient: ['#FFB800', '#FF8C00'] as const,
    gradientDark: ['#FF9500', '#FF6B00'] as const,
    gold: '#FFD700',
    success: '#34C759',
    error: '#FF3B30',
    warning: '#FF9500',
    accent: '#6366F1',
  },
  fonts: {
    light: 'Tajawal-Light',
    regular: 'Tajawal-Regular',
    medium: 'Tajawal-Medium',
    bold: 'Tajawal-Bold',
    extraBold: 'Tajawal-ExtraBold',
  },
};

export default Colors;
