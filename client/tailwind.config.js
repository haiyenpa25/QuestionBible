/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"Merriweather"', 'Georgia', 'serif']
      },
      colors: {
        answer: {
          red: '#DC2626',
          blue: '#2563EB',
          amber: '#D97706',
          green: '#16A34A'
        }
      }
    }
  },
  plugins: []
};

