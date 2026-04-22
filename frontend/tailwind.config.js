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
        // Soften aggressive white as per Bleached Stone plan
        white: '#F9F8F7', 

        // Bleached Stone Baseline Palette
        'app-bg': '#F9F8F7',
        'surface': '#FFFFFF',
        'surface-raised': '#F3F2F1',
        'border-subtle': '#E7E5E4',
        'border-strong': '#D6D3D1',
        'text-primary': '#1C1917',
        'text-muted': '#78716C',
        'accent': '#D97706',
        'accent-soft': '#FEF3C7',

        // CO2 Semantic Colors
        'co2-good': '#16A34A',
        'co2-good-bg': '#DCFCE7',
        'co2-fair': '#D97706',
        'co2-fair-bg': '#FEF3C7',
        'co2-poor': '#EA580C',
        'co2-poor-bg': '#FFEDD5',
        'co2-critical': '#DC2626',
        'co2-critical-bg': '#FEE2E2',

        // Legacy compatibility / Background colors
        background: {
          DEFAULT: '#F9F8F7',
          surface: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
