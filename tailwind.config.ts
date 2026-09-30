import type { Config } from 'tailwindcss';

// Paleta BR — ver ARCHITECTURE.md §3 (psicología del color)
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lino: { DEFAULT: '#F5F0E8', 100: '#FBF8F3', 200: '#EDE5D8', 300: '#DDD1BE' },
        tinta: { DEFAULT: '#171412', 700: '#3A3431', 500: '#6B625C', 300: '#A39A92' },
        hilo: { DEFAULT: '#C2461F', 600: '#A33A18', 100: '#F6DED3' },
        bosque: { DEFAULT: '#1E3A2F', 600: '#162C23', 100: '#DCE6DF' },
        oro: { DEFAULT: '#B98A3E', 100: '#F2E6CF' }
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif']
      },
      maxWidth: { page: '84rem' },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } }
      },
      animation: {
        'slide-in': 'slide-in .28s cubic-bezier(.2,.8,.2,1)',
        marquee: 'marquee 40s linear infinite'
      }
    }
  },
  plugins: []
};

export default config;
