import type { Config } from 'tailwindcss';

/**
 * HelpTrust design tokens. Premium black surfaces, neon mint primary,
 * emerald highlights and pastel campaign cards. No purple/violet anywhere.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#050706',
          900: '#0A0F0D',
          850: '#0E1513',
          800: '#131B18',
          700: '#1B2622',
          600: '#26332E',
          500: '#34443D',
        },
        mint: {
          DEFAULT: '#5CFFB1',
          300: '#8DFFCB',
          400: '#5CFFB1',
          500: '#33E896',
          600: '#1FBF7A',
        },
        emerald: {
          DEFAULT: '#1FBF80',
          400: '#3DDC9A',
          500: '#1FBF80',
          700: '#0F7A52',
        },
        pastel: {
          yellow: '#FBEFB0',
          pink: '#F9D3E3',
          mint: '#CDF5DF',
          sky: '#CFE9F7',
        },
        tp: {
          navy: '#101536',
          navy2: '#1A2150',
          purple: '#6D4DF2',
          purpleDark: '#5635D6',
          lilac: '#EFEBFF',
          canvas: '#F5F4FB',
          ink: '#1C1B3A',
          muted: '#7B7D98',
          line: '#E8E6F4',
        },
        ui: {
          text: '#F3F7F5',
          muted: '#8E9B95',
          subtle: '#5F6D66',
          line: 'rgba(255,255,255,0.07)',
          danger: '#FF7A7A',
          warning: '#FFD36E',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 40px -18px rgba(0,0,0,0.7)',
        glow: '0 0 0 1px rgba(92,255,177,0.35), 0 10px 40px -10px rgba(92,255,177,0.45)',
        'glow-soft': '0 8px 30px -12px rgba(92,255,177,0.35)',
      },
      backgroundImage: {
        'mint-gradient': 'linear-gradient(135deg, #8DFFCB 0%, #5CFFB1 45%, #1FBF80 100%)',
        'surface-gradient': 'linear-gradient(180deg, #151F1B 0%, #0E1513 100%)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseMint: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(92,255,177,0.45)' },
          '50%': { boxShadow: '0 0 0 10px rgba(92,255,177,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        rise: 'rise 0.45s cubic-bezier(0.22,1,0.36,1) both',
        pulseMint: 'pulseMint 2.2s ease-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
