/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1E3A5F',
          light: '#2E5090',
        },
        accent: {
          DEFAULT: '#1565C0',
          light: '#1E88E5',
          dark: '#1251A3',
        },
        success: {
          light: '#E8F5E9',
          DEFAULT: '#1B5E20',
          medium: '#A5D6A7',
        },
        warning: {
          light: '#FFF3E0',
          DEFAULT: '#E65100',
          medium: '#FFB74D',
        },
        danger: {
          light: '#FFEBEE',
          DEFAULT: '#B71C1C',
        },
        info: {
          light: '#E3F2FD',
          DEFAULT: '#1565C0',
        },
        bg: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E0E7EF',
        surface: {
          secondary: '#F5F5F5',
          tertiary: '#E0E7EF',
        },
        text: {
          primary: '#1E293B',
          secondary: '#64748B',
          tertiary: '#94A3B8',
        },
        pollutant: {
          co2: '#2E7D32',
          nox: '#1565C0',
          so2: '#7B1FA2',
          pm: '#E65100',
          cov: '#00897B',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        xs: '11px',
        sm: '12px',
        base: '14px',
        lg: '16px',
        xl: '18px',
        '2xl': '20px',
        '3xl': '22px',
        '4xl': '24px',
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
      },
      borderRadius: {
        card: '10px',
        pill: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.05)',
        elevated: '0 4px 6px rgba(0, 0, 0, 0.07)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-in',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
}
