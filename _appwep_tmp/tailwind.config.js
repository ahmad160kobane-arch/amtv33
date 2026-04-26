/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#FFB800',
          dark: '#FF9500',
          secondary: '#FF6B00',
          success: '#34C759',
          error: '#FF3B30',
          accent: '#6366F1',
        },
        dark: {
          bg: '#0A0A0C',
          card: '#161618',
          border: '#222226',
          header: '#0E0E10',
          input: '#1C1C1E',
          divider: '#2C2C2E',
          text: '#F1F1F1',
          muted: '#8E8E93',
        },
        light: {
          bg: '#F8F8FA',
          card: '#FFFFFF',
          border: '#EBEBF0',
          header: '#F8F8FA',
          input: '#F0F0F3',
          divider: '#E5E5EA',
          text: '#1A1A1A',
          muted: '#6B6B6B',
        },
      },
      fontFamily: {
        tajawal: ['Tajawal', 'sans-serif'],
      },
      screens: {
        xs: '400px',
      },
    },
  },
  plugins: [],
};
