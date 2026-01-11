/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Linear-inspired dark palette
        background: {
          DEFAULT: '#08090A',
          surface: 'rgba(24, 24, 27, 0.5)', // zinc-900/50
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.1)', // white/10
          muted: 'rgb(39, 39, 42)', // zinc-800
        },
        // Sci-Fi / Clean Tech palette
        scifi: {
          navy: {
            center: '#1a1c29',
            outer: '#0b0c15',
          },
          co2: {
            safe: '#00f2ea',      // Cyan / Electric Teal
            warning: '#ffc107',   // Amber / Gold
            danger: '#ff0055',    // Magenta / Hot Pink
          },
          text: {
            primary: '#ffffff',
            secondary: '#9ca3af',
          },
        },
      },
      backgroundImage: {
        'scifi-gradient': 'radial-gradient(circle at center, #1a1c29 0%, #0b0c15 100%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      letterSpacing: {
        tight: '-0.02em',
        wide: '0.05em',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glow: '0 0 20px rgba(59, 130, 246, 0.15)',
        'glow-emerald': '0 0 8px rgba(16, 185, 129, 0.5)',
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
