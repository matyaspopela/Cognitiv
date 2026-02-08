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
        // Soften aggressive white
        white: '#ebebeb', // Zinc-200ish, much softer than #ffffff

        // Monochrome / Zinc palette
        background: {
          DEFAULT: '#09090b', // Zinc 950
          surface: '#18181b', // Zinc 900
        },
        border: {
          subtle: '#27272a', // Zinc 800
          muted: '#3f3f46',  // Zinc 700
        },
        // Zinc Scale (Explicitly needed if using zinc-* classes, but Tailwind includes them by default. 
        // We add them here to map 'primary' etc if needed, but let's stick to 'zinc' in code or variables)

        // Remove 'scifi' object completely.
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      // Remove scifi-gradient
    },
  },
  plugins: [],
}
