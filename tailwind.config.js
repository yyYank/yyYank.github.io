/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a24',
          600: '#24242f',
          500: '#2e2e3a',
        },
        accent: {
          cyan: '#00d4ff',
          purple: '#a855f7',
          green: '#10b981',
          pink: '#f472b6',
        },
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            code: {
              backgroundColor: theme('colors.dark.600'),
              color: theme('colors.accent.cyan'),
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '400'
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' }
          }
        },
        invert: {
          css: {
            '--tw-prose-body': theme('colors.gray.300'),
            '--tw-prose-headings': theme('colors.white'),
            '--tw-prose-links': theme('colors.accent.cyan'),
            '--tw-prose-bold': theme('colors.white'),
            '--tw-prose-counters': theme('colors.gray.400'),
            '--tw-prose-bullets': theme('colors.gray.400'),
            '--tw-prose-hr': theme('colors.dark.500'),
            '--tw-prose-quotes': theme('colors.gray.300'),
            '--tw-prose-quote-borders': theme('colors.accent.purple'),
            '--tw-prose-captions': theme('colors.gray.400'),
            '--tw-prose-code': theme('colors.accent.cyan'),
            '--tw-prose-pre-code': theme('colors.gray.200'),
            '--tw-prose-pre-bg': theme('colors.dark.700'),
            '--tw-prose-th-borders': theme('colors.dark.500'),
            '--tw-prose-td-borders': theme('colors.dark.600'),
          }
        }
      }),
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #1a1a24 50%, #12121a 100%)',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.3)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.3)',
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
};
