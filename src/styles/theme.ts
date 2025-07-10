import {
  createTheme,
  MantineColorsTuple,
  virtualColor,
  rgba,
} from '@mantine/core';

// Define custom color tuples (10 shades each) - centered around #FFD700
const goldTuple: MantineColorsTuple = [
  '#FFFBF0', // 0 - lightest
  '#FFF6D9', // 1
  '#FFEFB3', // 2
  '#FFE680', // 3
  '#FFDD4D', // 4
  '#FFD700', // 5 - main golden yellow (#FFD700)
  '#E6C200', // 6
  '#CCAD00', // 7
  '#B39800', // 8
  '#998200', // 9 - darkest
];

const coralTuple: MantineColorsTuple = [
  '#FFF0ED', // 0 - lightest
  '#FFE1DA', // 1
  '#FFC2B5', // 2
  '#FF9D85', // 3
  '#FF7A55', // 4 - main coral/orange
  '#FF5722', // 5
  '#E6471A', // 6
  '#CC3A12', // 7
  '#B32E0A', // 8
  '#992302', // 9 - darkest
];

const cloudTuple: MantineColorsTuple = [
  '#FFFFFF', // 0 - pure white
  '#F8F9FA', // 1
  '#F1F3F4', // 2
  '#E8EAED', // 3
  '#DADCE0', // 4
  '#BDC1C6', // 5
  '#9AA0A6', // 6
  '#80868B', // 7
  '#5F6368', // 8
  '#3C4043', // 9 - darkest
];

// Create virtual color for dynamic theming
const primaryVirtual = virtualColor({
  name: 'primary',
  dark: 'gold',
  light: 'gold',
});

export const theme = createTheme({
  // Color configuration
  colors: {
    gold: goldTuple,
    coral: coralTuple,
    cloud: cloudTuple,
    primary: primaryVirtual,
  },

  primaryColor: 'gold',
  primaryShade: { light: 5, dark: 5 },

  // Auto contrast for better accessibility
  autoContrast: true,
  luminanceThreshold: 0.3,

  // Typography
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    fontWeight: '600',
  },

  // Layout
  defaultRadius: 'md',
  cursorType: 'pointer',

  // Focus and active states
  focusRing: 'auto',

  // Default gradient for gradient variants
  defaultGradient: {
    from: 'gold.4',
    to: 'gold.6',
    deg: 135,
  },

  // Component customizations
  components: {
    Button: {
      defaultProps: {
        variant: 'primary',
      },
      styles: {
        root: {
          height: '50px',
          lineHeight: '22px',
          letterSpacing: '1%',
          fontWeight: '500',
          fontSize: '16px',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          border: '2px solid #D4AF37',
        },
      },
      vars: (
        theme: { colors: { gold: unknown[]; dark: unknown[] } },
        props: { variant: string; color: string }
      ) => {
        if (props.variant === 'secondary') {
          return {
            root: {
              '--button-bg': `#2F2F2F`,
              '--button-hover': `linear-gradient(135deg, ${theme.colors.dark[3]} 0%, ${theme.colors.dark[5]} 100%)`,
              '--button-color': theme.colors.dark[8],
              color: 'white',
              border: '2px solid #3D3D3D',
            },
          };
        }

        if (props.variant === 'primary') {
          return {
            root: {
              '--button-bg': `linear-gradient(135deg, ${theme.colors.gold[4]} 0%, ${theme.colors.gold[6]} 100%)`,
              '--button-hover': `linear-gradient(135deg, ${theme.colors.gold[3]} 0%, ${theme.colors.gold[5]} 100%)`,
              '--button-color': theme.colors.dark[8],
            },
          };
        }
        return {};
      },
    },

    Paper: {
      styles: {
        root: {
          backgroundColor:
            'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
          border:
            '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-6))',
        },
      },
    },

    TextInput: {
      styles: {
        input: {
          backgroundColor:
            'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
          borderColor:
            'light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-5))',
          color:
            'light-dark(var(--mantine-color-dark-9), var(--mantine-color-cloud-0))',
          '&:focus': {
            borderColor: 'var(--mantine-color-gold-5)',
            boxShadow: `0 0 0 2px ${rgba('#FFD700', 0.2)}`,
          },
        },
        label: {
          color:
            'light-dark(var(--mantine-color-dark-6), var(--mantine-color-cloud-2))',
          fontWeight: '500',
        },
      },
    },

    PasswordInput: {
      styles: {
        input: {
          backgroundColor:
            'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
          borderColor:
            'light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-5))',
          color:
            'light-dark(var(--mantine-color-dark-9), var(--mantine-color-cloud-0))',
          '&:focus': {
            borderColor: 'var(--mantine-color-gold-5)',
            boxShadow: `0 0 0 2px ${rgba('#FFD700', 0.2)}`,
          },
        },
        label: {
          color:
            'light-dark(var(--mantine-color-dark-6), var(--mantine-color-cloud-2))',
          fontWeight: '500',
        },
      },
    },

    Card: {
      styles: {
        root: {
          backgroundColor:
            'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
          border:
            '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-6))',
        },
      },
    },

    Title: {
      styles: {
        root: {
          color:
            'light-dark(var(--mantine-color-dark-9), var(--mantine-color-cloud-0))',
        },
      },
    },

    Text: {
      styles: {
        root: {
          color:
            'light-dark(var(--mantine-color-dark-7), var(--mantine-color-cloud-1))',
        },
      },
    },

    Anchor: {
      styles: {
        root: {
          color: 'var(--mantine-color-gold-5)',
          textDecoration: 'none',
          '&:hover': {
            color: 'var(--mantine-color-gold-4)',
            textDecoration: 'underline',
          },
        },
      },
    },

    Loader: {
      defaultProps: {
        color: 'gold',
      },
    },

    Notification: {
      styles: {
        root: {
          backgroundColor:
            'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
          border:
            '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-6))',
        },
        title: {
          color:
            'light-dark(var(--mantine-color-dark-9), var(--mantine-color-cloud-0))',
        },
        description: {
          color:
            'light-dark(var(--mantine-color-dark-6), var(--mantine-color-cloud-2))',
        },
      },
    },
  },

  // Custom properties for additional theming
  other: {
    // Custom spacing values
    spacings: {
      xs: 8,
      sm: 12,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 48,
    },

    // Gradient definitions
    gradients: {
      primary:
        'linear-gradient(135deg, var(--mantine-color-gold-4) 0%, var(--mantine-color-gold-6) 100%)',
      accent:
        'linear-gradient(135deg, var(--mantine-color-coral-4) 0%, var(--mantine-color-coral-5) 100%)',
      background:
        'linear-gradient(180deg, var(--mantine-color-dark-8) 0%, var(--mantine-color-dark-9) 100%)',
    },

    // Animation keyframes
    animations: {
      sparkle: {
        '0%, 100%': { opacity: 0.3, transform: 'scale(0.8)' },
        '50%': { opacity: 1, transform: 'scale(1.2)' },
      },
    },
  },
});

// CSS-in-JS classes for animations
export const sparkleClass = {
  animation: 'sparkle 2s ease-in-out infinite',

  '&:nth-child(2)': {
    animationDelay: '0.5s',
  },

  '&:nth-child(3)': {
    animationDelay: '1s',
  },
};
