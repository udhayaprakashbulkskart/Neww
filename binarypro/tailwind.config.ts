import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        orange: { DEFAULT: '#ff6a00', soft: '#ff8c33' },
        gold: { DEFAULT: '#d4af37', soft: '#f7e09a' },
      },
    },
  },
  plugins: [],
};
export default config;
