// نظام الألوان الموحّد للتطبيق كله
// استخدم الدالة دي في أي صفحة بدل ما تكتب hex codes يدوي:
//   import { getColors } from '../theme';
//   const c = getColors(isDark);

export const theme = {
  dark: {
    bg: '#0A1418',
    surface: '#111E24',
    surfaceHover: '#16262D',
    border: '#22343B',
    primary: '#14B8A6',
    primaryHover: '#0D9488',
    accent: '#F59E0B',
    text: '#E7EEF0',
    textMuted: '#8CA3AA',
    danger: '#EF4444',
    dangerBg: '#EF444422',
    success: '#22C55E',
    successBg: '#22C55E22',
    input: '#0F1B20',
  },
  light: {
    bg: '#F7FAFA',
    surface: '#FFFFFF',
    surfaceHover: '#F1F5F5',
    border: '#E2E8EA',
    primary: '#0D9488',
    primaryHover: '#0F766E',
    accent: '#D97706',
    text: '#0F1E22',
    textMuted: '#5B7278',
    danger: '#DC2626',
    dangerBg: '#DC262622',
    success: '#16A34A',
    successBg: '#16A34A22',
    input: '#FFFFFF',
  }
};

export const getColors = (isDark) => (isDark ? theme.dark : theme.light);
