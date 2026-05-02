import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Adal Nexus brand palette (Pakistan edition)
        primary: {
          DEFAULT: '#0A1929', // Navy
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#D4AF37', // Gold
          foreground: '#0A1929',
        },
        background: '#FFFFFF',
        foreground: '#0A1929',
        muted: {
          DEFAULT: '#F5F6F8',
          foreground: '#4A5568',
        },
        border: '#E5E7EB',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
