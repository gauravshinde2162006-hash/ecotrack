/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        eco: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        carbon: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          850: '#1e1e21',
          900: '#18181b',
          950: '#09090b',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        rose: {
          400: '#fb7185',
          500: '#f43f5e',
        },
        sky: {
          400: '#38bdf8',
          500: '#0ea5e9',
        },
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in':     'fadeIn 0.4s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'pulse-eco':   'pulseEco 2s ease-in-out infinite',
        'shimmer':     'shimmer 1.5s infinite',
        'spin-slow':   'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'typewriter':  'typewriter 0.05s steps(1) infinite',
        'glow':        'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseEco:  { '0%, 100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4)' }, '50%': { boxShadow: '0 0 0 12px rgba(34, 197, 94, 0)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        glow:      { '0%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' }, '100%': { boxShadow: '0 0 40px rgba(34, 197, 94, 0.6)' } },
      },
      backgroundImage: {
        'gradient-eco':  'linear-gradient(135deg, #052e16 0%, #14532d 50%, #166534 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        'gradient-glow': 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.15) 0%, transparent 70%)',
        'shimmer-bg':    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
