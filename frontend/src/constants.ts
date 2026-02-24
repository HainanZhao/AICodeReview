export const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
];

export const SYNTAX_THEMES = [
  { value: 'default', label: 'Default' },
  { value: 'a11yDark', label: 'A11y Dark' },
  { value: 'a11yLight', label: 'A11y Light' },
  { value: 'atomDark', label: 'Atom Dark' },
  { value: 'base16AteliersulphurpoolLight', label: 'Base16 Light' },
  { value: 'cb', label: 'CB' },
  { value: 'coldarkCold', label: 'Coldark Cold' },
  { value: 'coldarkDark', label: 'Coldark Dark' },
  { value: 'coyWithoutShadows', label: 'Coy (No Shadows)' },
  { value: 'coy', label: 'Coy' },
  { value: 'darcula', label: 'Darcula' },
  { value: 'dark', label: 'Dark' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'duotoneDark', label: 'Duotone Dark' },
  { value: 'duotoneEarth', label: 'Duotone Earth' },
  { value: 'duotoneForest', label: 'Duotone Forest' },
  { value: 'duotoneLight', label: 'Duotone Light' },
  { value: 'duotoneSea', label: 'Duotone Sea' },
  { value: 'duotoneSpace', label: 'Duotone Space' },
  { value: 'funky', label: 'Funky' },
  { value: 'ghcolors', label: 'GitHub Colors' },
  { value: 'gruvboxDark', label: 'Gruvbox Dark' },
  { value: 'gruvboxLight', label: 'Gruvbox Light' },
  { value: 'holiTheme', label: 'Holi' },
  { value: 'hopscotch', label: 'Hopscotch' },
  { value: 'lucario', label: 'Lucario' },
  { value: 'materialDark', label: 'Material Dark' },
  { value: 'materialLight', label: 'Material Light' },
  { value: 'materialOceanic', label: 'Material Oceanic' },
  { value: 'nightOwl', label: 'Night Owl' },
  { value: 'nord', label: 'Nord' },
  { value: 'okaidia', label: 'Okaidia' },
  { value: 'oneDark', label: 'One Dark' },
  { value: 'oneLight', label: 'One Light' },
  { value: 'pojoaque', label: 'Pojoaque' },
  { value: 'prism', label: 'Prism' },
  { value: 'shadesOfPurple', label: 'Shades of Purple' },
  { value: 'solarizedDarkAtom', label: 'Solarized Dark Atom' },
  { value: 'solarizedlight', label: 'Solarized Light' },
  { value: 'synthwave84', label: 'Synthwave84' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'twilight', label: 'Twilight' },
  { value: 'vsDark', label: 'VS Dark' },
  { value: 'vs', label: 'Visual Studio' },
  { value: 'vscDarkPlus', label: 'VS Code Dark+' },
  { value: 'xonokai', label: 'Xonokai' },
  { value: 'zTouch', label: 'Z-Touch' },
];

// Mapping syntax themes to app themes based on their typical appearance
const DARK_SYNTAX_THEMES = new Set([
  'a11yDark',
  'atomDark',
  'coldarkDark',
  'darcula',
  'dark',
  'dracula',
  'duotoneDark',
  'duotoneSpace',
  'gruvboxDark',
  'lucario',
  'materialDark',
  'materialOceanic',
  'nightOwl',
  'nord',
  'okaidia',
  'oneDark',
  'shadesOfPurple',
  'solarizedDarkAtom',
  'synthwave84',
  'twilight',
  'vsDark',
  'vscDarkPlus',
  'xonokai',
]);

/**
 * Gets theme colors for a given syntax theme, with fallback to basic light/dark
 */
export const getThemeColors = (syntaxTheme: string) => {
  // Check if we have specific color config for this theme
  if (THEME_COLOR_CONFIGS[syntaxTheme]) {
    return THEME_COLOR_CONFIGS[syntaxTheme];
  }

  // Fallback to basic light/dark theme colors based on syntax theme name
  const isDark =
    DARK_SYNTAX_THEMES.has(syntaxTheme) ||
    syntaxTheme.toLowerCase().includes('dark') ||
    syntaxTheme.toLowerCase().includes('night');

  if (isDark) {
    return {
      background: '#0a0a0f',
      surface: '#0a0a0f',
      primary: '#00f0ff',
      text: '#ececec',
      subtle: '#a1a1aa',
      accent: '#00f0ff',
      isDark: true,
    };
  }
  return {
    background: '#ffffff',
    surface: '#fbfbfb',
    primary: '#f0f0f0',
    text: '#111111',
    subtle: '#444444',
    accent: '#1f75cb',
    isDark: false,
  };
};
const THEME_COLOR_CONFIGS: Record<
  string,
  {
    background: string;
    surface: string;
    primary: string;
    text: string;
    subtle: string;
    accent: string;
    isDark: boolean;
  }
> = {
  vscDarkPlus: {
    background: '#1e1e1e',
    surface: '#252526',
    primary: '#2d2d30',
    text: '#cccccc',
    subtle: '#858585',
    accent: '#007acc',
    isDark: true,
  },
  vs: {
    background: '#ffffff',
    surface: '#fbfbfb',
    primary: '#f0f0f0',
    text: '#1e1e1e',
    subtle: '#6a737d',
    accent: '#0366d6',
    isDark: false,
  },
  dracula: {
    background: '#282a36',
    surface: '#343746',
    primary: '#44475a',
    text: '#f8f8f2',
    subtle: '#6272a4',
    accent: '#bd93f9',
    isDark: true,
  },
  nightOwl: {
    background: '#011627',
    surface: '#0b253a',
    primary: '#1d3b53',
    text: '#d6deeb',
    subtle: '#5f7e97',
    accent: '#c792ea',
    isDark: true,
  },
  oneDark: {
    background: '#21252b',
    surface: '#282c34',
    primary: '#3e4451',
    text: '#abb2bf',
    subtle: '#5c6370',
    accent: '#61afef',
    isDark: true,
  },
  materialOceanic: {
    background: '#0f111a',
    surface: '#1a1c25',
    primary: '#2e3440',
    text: '#eeeff1',
    subtle: '#65737e',
    accent: '#82b1ff',
    isDark: true,
  },
  gruvboxDark: {
    background: '#1d2021',
    surface: '#282828',
    primary: '#3c3836',
    text: '#ebdbb2',
    subtle: '#a89984',
    accent: '#fabd2f',
    isDark: true,
  },
  solarizedDarkAtom: {
    background: '#00212b',
    surface: '#002b36',
    primary: '#073642',
    text: '#93a1a1',
    subtle: '#657b83',
    accent: '#268bd2',
    isDark: true,
  },
  atomDark: {
    background: '#1d1f21',
    surface: '#282a2e',
    primary: '#373b41',
    text: '#c5c8c6',
    subtle: '#969896',
    accent: '#81a2be',
    isDark: true,
  },
  synthwave84: {
    background: '#241b2f',
    surface: '#2a2139',
    primary: '#3b2a4a',
    text: '#ffffff',
    subtle: '#848bbd',
    accent: '#f92aad',
    isDark: true,
  },
  oneLight: {
    background: '#fafafa',
    surface: '#ffffff',
    primary: '#f0f0f0',
    text: '#383a42',
    subtle: '#a0a1a7',
    accent: '#4078f2',
    isDark: false,
  },
  gruvboxLight: {
    background: '#fbf1c7',
    surface: '#f9f5d7',
    primary: '#ebdbb2',
    text: '#3c3836',
    subtle: '#7c6f64',
    accent: '#d79921',
    isDark: false,
  },
  materialLight: {
    background: '#fafafa',
    surface: '#ffffff',
    primary: '#f5f5f5',
    text: '#2c3e50',
    subtle: '#90a4ae',
    accent: '#6182b8',
    isDark: false,
  },
};

/**
 * Theme color configurations extracted from popular syntax themes
 */

/**
 * Applies theme colors to CSS custom properties
 */
export const applyThemeColors = (colors: ReturnType<typeof getThemeColors>) => {
  const root = document.documentElement;

  // Apply custom properties for dynamic theming
  root.style.setProperty('--app-bg', colors.background);
  root.style.setProperty('--app-surface', colors.surface);
  root.style.setProperty('--app-primary', colors.primary);
  root.style.setProperty('--app-text', colors.text);
  root.style.setProperty('--app-subtle', colors.subtle);
  root.style.setProperty('--app-accent', colors.accent);

  // Update dark class for compatibility with existing Tailwind classes
  if (colors.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};
