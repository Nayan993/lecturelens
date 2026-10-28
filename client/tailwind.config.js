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
          strong: token('accent-strong'),
        },
        success: {
          DEFAULT: token('success'),
          strong: token('success-strong'),
        },
        warning: {
          DEFAULT: token('warning'),
          strong: token('warning-strong'),
        },
        danger: token('danger'),
        info: token('info'),
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        serif: ['"Source Serif 4"', ...defaultTheme.fontFamily.serif],
      },
      fontSize: {
        eyebrow: ['0.6875rem', { lineHeight: '1rem' }], // 11px section labels
        md: ['0.9375rem', { lineHeight: '1.375rem' }], // 15px card titles, option text
        'reading-sm': ['0.96875rem', { lineHeight: '1.65' }], // 15.5px secondary serif prose
        reading: ['1.03125rem', { lineHeight: '1.7' }], // 16.5px serif reading text (.prose-lecture)
      },
      gridTemplateColumns: {
        single: 'minmax(0, 1fr)',
        workspace: 'minmax(0, 3fr) minmax(0, 2fr)', // reading view 60/40 (≥ 1280px)
        // 55/45 between 1024 and 1279px: at 60/40 the right column is too narrow for its four tabs.
        'workspace-tight': 'minmax(0, 11fr) minmax(0, 9fr)',
        segment: '3.75rem minmax(0, 1fr)', // timestamp + transcript text
        'label-value': '8rem minmax(0, 1fr)',
        preview: '1.35fr 1fr',
      },
      gridTemplateRows: {
        stack: 'auto minmax(0, 1fr)',
      },
      height: {
        // Viewport below the header: 3.5rem header + main padding (py-6 mobile, lg:py-8 desktop).
        workspace: 'calc(100dvh - 6.5rem)',
        'workspace-lg': 'calc(100dvh - 7.5rem)',
      },
      maxHeight: {
        'player-compact': '24dvh',
        dialog: 'calc(100dvh - 2rem)',
      },
      maxWidth: {
        drawer: '85vw',
        bubble: '85%',
      },
      zIndex: {
        toast: '60', // above dialogs and drawers (z-50)
      },
      content: {
        empty: "''",
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        'divider-b': 'inset 0 -1px 0 var(--border)',
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
