import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * Every colour points at a CSS custom property in src/styles/tokens.css.
 * color-mix keeps Tailwind opacity modifiers working (e.g. bg-brand/10)
 * even though the tokens are plain hex values.
 */
const token = (name) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          1: token('ink-1'),
          2: token('ink-2'),
          3: token('ink-3'),
        },
        surface: token('surface'),
        bg: token('bg'),
        border: token('border'),
        brand: {
          DEFAULT: token('brand'),
          hover: token('brand-hover'),
          soft: token('brand-soft'),
        },
        accent: {
          DEFAULT: token('accent'),
          soft: token('accent-soft'),
        },
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        serif: ['"Source Serif 4"', ...defaultTheme.fontFamily.serif],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        indeterminate: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        indeterminate: 'indeterminate 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
