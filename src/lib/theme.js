const LIGHT_DEFAULTS = {
  page: '#edf1f7',
  bg: '#fcfdff',
  sidebar: '#edf1f7',
  surface: '#f3f6fa',
  surfaceHover: '#e8edf5',
  raised: '#ffffff',
  border: '#d9e0eb',
  borderSoft: '#e7ecf3',
  inputBorder: '#7f8ca2',
  text: '#202c40',
  muted: '#596a82',
  faint: '#5e6c83',
  accent: '#315dcc',
  accentDark: '#ffffff',
  onAccent: '#ffffff',
  accentDim: '#4669b7',
  accentSoft: '#e9effe',
  focus: '#315dcc',
  focusRing: '#315dcc',
  error: '#ae3846',
  errorSoft: '#fceef0',
  codeKeyword: '#6d49a3',
  codeString: '#2f6c4e',
  codeNumber: '#8d511c',
  codeVariable: '#226b85',
  shadowColor: '#263d60',
  shadowSoftColor: '#263d60',
  scrimColor: '#172339',
  overlayColor: '#0e1626',
  magicBlue: '#547df0',
  magicViolet: '#9371e9',
  magicCyan: '#3abbbf',
};

const DARK_DEFAULTS = {
  page: '#131820',
  bg: '#1b212c',
  sidebar: '#131820',
  surface: '#232c3a',
  surfaceHover: '#2c3749',
  raised: '#273142',
  border: '#3b475b',
  borderSoft: '#2b3545',
  inputBorder: '#7a89a2',
  text: '#eaf0fb',
  muted: '#adb9cd',
  faint: '#9eacc3',
  accent: '#a4beff',
  accentDark: '#16294f',
  onAccent: '#16294f',
  accentDim: '#a4beff',
  accentSoft: '#2b3b60',
  focus: '#a4beff',
  focusRing: '#a4beff',
  error: '#ffadb8',
  errorSoft: '#422b36',
  codeKeyword: '#c6b3f0',
  codeString: '#acd4b6',
  codeNumber: '#e5be93',
  codeVariable: '#a1d4e4',
  shadowColor: '#080e1a',
  shadowSoftColor: '#080e1a',
  scrimColor: '#080e1a',
  overlayColor: '#0e1626',
  magicBlue: '#547df0',
  magicViolet: '#9371e9',
  magicCyan: '#3abbbf',
};

export const COLOR_TOKENS = [
  { key: 'page', cssVar: '--page', label: 'Page', description: 'The outer workspace canvas.' },
  { key: 'bg', cssVar: '--bg', label: 'Workspace', description: 'The main conversation background.' },
  { key: 'sidebar', cssVar: '--sidebar', label: 'Sidebar', description: 'Chat history and navigation.' },
  { key: 'surface', cssVar: '--surface', label: 'Surface', description: 'Cards, message bubbles, and secondary panels.' },
  { key: 'surfaceHover', cssVar: '--surface-hover', label: 'Hover surface', description: 'Interactive hover and disabled surfaces.' },
  { key: 'raised', cssVar: '--raised', label: 'Raised surface', description: 'Inputs, dialogs, popovers, and elevated controls.' },
  { key: 'border', cssVar: '--border', label: 'Border', description: 'Primary dividers and control edges.' },
  { key: 'borderSoft', cssVar: '--border-soft', label: 'Soft border', description: 'Subtle separators and quiet chrome.' },
  { key: 'inputBorder', cssVar: '--input-border', label: 'Input border', description: 'High-visibility input and focus boundaries.' },
  { key: 'text', cssVar: '--text', label: 'Text', description: 'Primary readable text.' },
  { key: 'muted', cssVar: '--muted', label: 'Muted text', description: 'Secondary labels and supporting copy.' },
  { key: 'faint', cssVar: '--faint', label: 'Faint text', description: 'Hints, metadata, and low-emphasis copy.' },
  { key: 'accent', cssVar: '--accent', label: 'Accent', description: 'Sets the color for actions, surfaces, focus, and motion.' },
  { key: 'accentDark', cssVar: '--accent-dark', label: 'Accent fallback', description: 'Fallback dark accent used by older component styles.' },
  { key: 'onAccent', cssVar: '--on-accent', label: 'Text on accent', description: 'Readable text placed on accent fills.' },
  { key: 'accentDim', cssVar: '--accent-dim', label: 'Accent text', description: 'Accent shade for links, labels, and icons.' },
  { key: 'accentSoft', cssVar: '--accent-soft', label: 'Soft accent', description: 'Accent-tinted backgrounds and selected states.' },
  { key: 'focus', cssVar: '--focus', label: 'Focus', description: 'Keyboard focus outlines.' },
  { key: 'focusRing', cssVar: '--focus-ring', label: 'Focus ring', description: 'Settings and form focus rings.' },
  { key: 'error', cssVar: '--error', label: 'Error', description: 'Errors, destructive actions, and warnings.' },
  { key: 'errorSoft', cssVar: '--error-soft', label: 'Soft error', description: 'Error-tinted backgrounds.' },
  { key: 'codeKeyword', cssVar: '--code-keyword', label: 'Code keyword', description: 'Syntax-highlighted keywords and literals.' },
  { key: 'codeString', cssVar: '--code-string', label: 'Code string', description: 'Syntax-highlighted strings and attributes.' },
  { key: 'codeNumber', cssVar: '--code-number', label: 'Code number', description: 'Syntax-highlighted numbers and titles.' },
  { key: 'codeVariable', cssVar: '--code-variable', label: 'Code variable', description: 'Syntax-highlighted variables and built-ins.' },
  { key: 'shadowColor', cssVar: '--shadow-color', label: 'Shadow', description: 'Base color for large elevation shadows.' },
  { key: 'shadowSoftColor', cssVar: '--shadow-soft-color', label: 'Soft shadow', description: 'Base color for subtle elevation shadows.' },
  { key: 'scrimColor', cssVar: '--scrim-color', label: 'Scrim', description: 'Base color behind sidebars and overlays.' },
  { key: 'overlayColor', cssVar: '--overlay-color', label: 'Overlay', description: 'Base color behind dialogs.' },
  { key: 'magicBlue', cssVar: '--magic-blue', label: 'Motion one', description: 'First color in ambient and generation effects.' },
  { key: 'magicViolet', cssVar: '--magic-violet', label: 'Motion two', description: 'Second color in ambient and generation effects.' },
  { key: 'magicCyan', cssVar: '--magic-cyan', label: 'Motion three', description: 'Third color in ambient and generation effects.' },
];

export const COLOR_GROUPS = [
  {
    id: 'surfaces',
    label: 'Surfaces',
    description: 'The materials that make up the workspace.',
    tokens: ['page', 'bg', 'sidebar', 'surface', 'surfaceHover', 'raised'],
  },
  {
    id: 'borders',
    label: 'Borders & text',
    description: 'Dividers, fields, and readable hierarchy.',
    tokens: ['border', 'borderSoft', 'inputBorder', 'text', 'muted', 'faint'],
  },
  {
    id: 'accent',
    label: 'Accent & status',
    description: 'Actions, focus states, errors, and code highlights.',
    tokens: [
      'accent',
      'accentDark',
      'onAccent',
      'accentDim',
      'accentSoft',
      'focus',
      'focusRing',
      'error',
      'errorSoft',
      'codeKeyword',
      'codeString',
      'codeNumber',
      'codeVariable',
    ],
  },
  {
    id: 'effects',
    label: 'Depth & motion',
    description: 'Shadows, overlays, and the animated light field.',
    tokens: [
      'shadowColor',
      'shadowSoftColor',
      'scrimColor',
      'overlayColor',
      'magicBlue',
      'magicViolet',
      'magicCyan',
    ],
  },
];

const tokenKeys = new Set(COLOR_TOKENS.map((token) => token.key));
const settingsKeys = new Set(['mode', 'preset', 'light', 'dark']);
const hexColor = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;
const workspaceTints = COLOR_GROUPS.flatMap(({ id, tokens }) =>
  id === 'accent' ? [] : tokens,
);

const makePreset = (id, label, description, light = {}, dark = {}) => ({
  id,
  label,
  description,
  light: { ...LIGHT_DEFAULTS, ...light },
  dark: { ...DARK_DEFAULTS, ...dark },
});

const LEGACY_PRESETS = {
  hydroxide: makePreset(
    'hydroxide',
    'Hydroxide',
    'The original cool blue workspace.',
  ),
  warm: makePreset(
    'warm',
    'Ember',
    'Warm terracotta with a little rose light.',
    {
      accent: '#b84f32',
      accentDark: '#ffffff',
      onAccent: '#ffffff',
      accentDim: '#a65a44',
      accentSoft: '#fbe9e3',
      focus: '#b84f32',
      focusRing: '#b84f32',
      magicBlue: '#e2774d',
      magicViolet: '#d45c8a',
      magicCyan: '#d1a24c',
    },
    {
      accent: '#ffb18f',
      accentDark: '#3a1b14',
      onAccent: '#3a1b14',
      accentDim: '#ffb18f',
      accentSoft: '#5a3028',
      focus: '#ffb18f',
      focusRing: '#ffb18f',
      magicBlue: '#f59670',
      magicViolet: '#e58aa9',
      magicCyan: '#e1bd70',
    },
  ),
  forest: makePreset(
    'forest',
    'Forest',
    'A grounded green palette for quieter focus.',
    {
      accent: '#2f7d5b',
      accentDark: '#ffffff',
      onAccent: '#ffffff',
      accentDim: '#3d8064',
      accentSoft: '#e4f4eb',
      focus: '#2f7d5b',
      focusRing: '#2f7d5b',
      magicBlue: '#4eaa78',
      magicViolet: '#7787c9',
      magicCyan: '#58b9ad',
    },
    {
      accent: '#82d2ac',
      accentDark: '#17382b',
      onAccent: '#17382b',
      accentDim: '#82d2ac',
      accentSoft: '#234438',
      focus: '#82d2ac',
      focusRing: '#82d2ac',
      magicBlue: '#78c99e',
      magicViolet: '#a7a8e4',
      magicCyan: '#76d0c7',
    },
  ),
  lavender: makePreset(
    'lavender',
    'Lavender',
    'Soft violet with a more playful atmosphere.',
    {
      accent: '#7656c8',
      accentDark: '#ffffff',
      onAccent: '#ffffff',
      accentDim: '#745fba',
      accentSoft: '#f0ebff',
      focus: '#7656c8',
      focusRing: '#7656c8',
      magicBlue: '#7f9bf1',
      magicViolet: '#a478e7',
      magicCyan: '#5fbcc9',
    },
    {
      accent: '#c4b2ff',
      accentDark: '#2b214b',
      onAccent: '#2b214b',
      accentDim: '#c4b2ff',
      accentSoft: '#403568',
      focus: '#c4b2ff',
      focusRing: '#c4b2ff',
      magicBlue: '#a8bcff',
      magicViolet: '#d3a8ff',
      magicCyan: '#8fd7e2',
    },
  ),
  monochrome: makePreset(
    'monochrome',
    'Monochrome',
    'Neutral contrast with no chromatic accent.',
    {
      accent: '#30343b',
      accentDark: '#ffffff',
      onAccent: '#ffffff',
      accentDim: '#535a64',
      accentSoft: '#eceff2',
      focus: '#30343b',
      focusRing: '#30343b',
      magicBlue: '#6d7480',
      magicViolet: '#9299a3',
      magicCyan: '#b1b6bd',
    },
    {
      accent: '#e7ebf0',
      accentDark: '#1d2229',
      onAccent: '#1d2229',
      accentDim: '#c4cbd4',
      accentSoft: '#39414a',
      focus: '#e7ebf0',
      focusRing: '#e7ebf0',
      magicBlue: '#b4beca',
      magicViolet: '#9da8b5',
      magicCyan: '#d1d6dc',
    },
  ),
};

function rgb(hex) {
  return toPickerHex(hex).slice(1).match(/../g).map((channel) => parseInt(channel, 16));
}

function brightness([red, green, blue]) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function hexFromRgb(channels) {
  return `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(channels) {
  return brightness(channels.map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  }));
}

function readableAccent(accent, palette) {
  const backgrounds = ['sidebar', 'bg', 'surface', 'surfaceHover', 'raised', 'accentSoft'];
  const values = backgrounds.map((key) => luminance(rgb(palette[key])));
  const dark = luminance(rgb(palette.bg)) < 0.179;
  const limit = dark
    ? (Math.max(...values) + 0.05) * 4.5 - 0.05
    : (Math.min(...values) + 0.05) / 4.5 - 0.05;
  const channels = rgb(accent);
  const neutral = dark ? 255 : 0;
  for (let step = 0; step < 20; step++) {
    const shade = channels.map((channel) => Math.round(channel + (neutral - channel) * step / 20));
    const value = luminance(shade);
    if (dark ? value >= limit : value <= limit) return hexFromRgb(shade);
  }
  return dark ? '#ffffff' : '#000000';
}

function tintPalette(base, accent, keys) {
  const channels = rgb(accent);
  const center = brightness(channels);
  const spread = Math.max(...channels) - Math.min(...channels);
  const hue = channels.map((channel) => (spread ? (channel - center) / spread : 0));
  return Object.fromEntries(keys.map((key) => {
    const original = rgb(base[key]);
    const neutral = brightness(original);
    // Keep the surface hierarchy while fitting the new hue into the sRGB gamut.
    const strength = Math.min(
      Math.max(...original) - Math.min(...original),
      ...hue.map((channel) => {
        if (channel === 0) return Infinity;
        return channel < 0 ? -neutral / channel : (255 - neutral) / channel;
      }),
    );
    return [key, hexFromRgb(hue.map((channel) => neutral + strength * channel))];
  }));
}

function presetPalette(palette, id) {
  if (id === 'hydroxide') return palette;
  const keys = workspaceTints.filter((key) => !key.startsWith('magic'));
  const themed = { ...palette, ...tintPalette(palette, id === 'monochrome' ? '#808080' : palette.accent, keys) };
  return { ...themed, accentDim: readableAccent(themed.accentDim, themed) };
}

export const COLOR_PRESETS = Object.fromEntries(
  Object.entries(LEGACY_PRESETS).map(([id, preset]) => [
    id,
    { ...preset, light: presetPalette(preset.light, id), dark: presetPalette(preset.dark, id) },
  ]),
);

export const COLOR_PRESET_LIST = Object.values(COLOR_PRESETS);

export const DEFAULT_COLORS = {
  mode: 'system',
  preset: 'hydroxide',
  light: { ...COLOR_PRESETS.hydroxide.light },
  dark: { ...COLOR_PRESETS.hydroxide.dark },
};

const cloneDefaults = () => ({
  mode: DEFAULT_COLORS.mode,
  preset: DEFAULT_COLORS.preset,
  light: { ...DEFAULT_COLORS.light },
  dark: { ...DEFAULT_COLORS.dark },
});

export function isHexColor(value) {
  return typeof value === 'string' && hexColor.test(value.trim());
}

function normalizeHex(value) {
  return value.trim().toLowerCase();
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateColorSettings(value) {
  if (value === undefined) return cloneDefaults();
  if (!isRecord(value)) throw new Error('Color settings are invalid.');
  for (const key of Object.keys(value))
    if (!settingsKeys.has(key)) throw new Error(`Unknown color setting: ${key}.`);
  if (value.mode !== undefined && !['system', 'light', 'dark'].includes(value.mode))
    throw new Error('Color mode must be system, light, or dark.');
  if (value.preset !== undefined) {
    if (typeof value.preset !== 'string' || (!Object.hasOwn(COLOR_PRESETS, value.preset) && value.preset !== 'custom'))
      throw new Error('Color preset is invalid.');
  }

  const result = {
    mode: value.mode || DEFAULT_COLORS.mode,
    preset: value.preset || DEFAULT_COLORS.preset,
  };
  for (const paletteName of ['light', 'dark']) {
    const preset = COLOR_PRESETS[result.preset];
    const legacy = LEGACY_PRESETS[result.preset]?.[paletteName];
    const defaults = preset?.[paletteName] || DEFAULT_COLORS[paletteName];
    result[paletteName] = { ...defaults };
    const palette = value[paletteName];
    if (palette === undefined) continue;
    if (!isRecord(palette)) throw new Error(`The ${paletteName} color palette is invalid.`);
    for (const key of Object.keys(palette)) {
      if (!tokenKeys.has(key)) throw new Error(`Unknown ${paletteName} color token: ${key}.`);
      if (!isHexColor(palette[key])) throw new Error(`The ${paletteName} ${key} color is invalid.`);
      const color = normalizeHex(palette[key]);
      // Older named presets stored a full copy of their original default colors.
      result[paletteName][key] = color === legacy?.[key] ? defaults[key] : color;
    }
  }
  return result;
}

export function normalizeColorSettings(value) {
  try {
    return validateColorSettings(value);
  } catch {
    return cloneDefaults();
  }
}

export function createColorSettingsFromPreset(id = 'hydroxide', mode = 'system') {
  if (!Object.hasOwn(COLOR_PRESETS, id)) throw new Error(`Unknown color preset: ${id}.`);
  const preset = COLOR_PRESETS[id];
  return {
    mode: ['system', 'light', 'dark'].includes(mode) ? mode : 'system',
    preset: id,
    light: { ...preset.light },
    dark: { ...preset.dark },
  };
}

function accentPalette(paletteName, accent) {
  const base = DEFAULT_COLORS[paletteName];
  const tints = tintPalette(base, accent, [...workspaceTints, 'accentSoft']);
  const hex = normalizeHex(accent);
  const opacity = hex.length === 5 ? parseInt(hex[4].repeat(2), 16) / 255
    : hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1;
  const background = rgb(tints.bg);
  const fill = rgb(accent).map((channel, index) => channel * opacity + background[index] * (1 - opacity));
  const onAccent = luminance(fill) > 0.179 ? '#000000' : '#ffffff';
  const ink = readableAccent(accent, tints);
  return {
    ...tints,
    accent: hex,
    accentDark: onAccent,
    onAccent,
    accentDim: ink,
    focus: ink,
    focusRing: ink,
  };
}

export function updatePaletteAccent(colors, paletteName, accent) {
  const current = colors[paletteName];
  const previous = accentPalette(paletteName, current.accent);
  const preset = COLOR_PRESET_LIST.find(({ [paletteName]: palette }) => palette.accent === current.accent);
  const legacy = Object.values(LEGACY_PRESETS).find(({ [paletteName]: palette }) =>
    palette.focus === current.focus && palette.focusRing === current.focusRing &&
    palette.accentSoft === current.accentSoft,
  );
  const next = { ...current };
  // Recolor values that still follow their palette and keep individually edited colors.
  for (const [key, value] of Object.entries(accentPalette(paletteName, accent))) {
    if (
      key === 'accent' ||
      current[key] === previous[key] ||
      current[key] === preset?.[paletteName][key] ||
      current[key] === legacy?.[paletteName][key]
    ) next[key] = value;
  }
  return { ...colors, preset: 'custom', [paletteName]: next };
}

export function resolveColorPalette(value, prefersDark = false) {
  const colors = normalizeColorSettings(value);
  const mode = colors.mode === 'system' ? (prefersDark ? 'dark' : 'light') : colors.mode;
  return { mode, palette: { ...colors[mode] }, colors };
}

export function applyColorSettings(value, target = document.documentElement, prefersDark = false) {
  if (!target?.style) return resolveColorPalette(value, prefersDark);
  const resolved = resolveColorPalette(value, prefersDark);
  for (const token of COLOR_TOKENS)
    target.style.setProperty(token.cssVar, resolved.palette[token.key]);
  target.dataset.colorMode = resolved.mode;
  target.dataset.colorPreset = resolved.colors.preset;
  target.style.colorScheme = resolved.mode;
  return resolved;
}

export function clearAppliedColorSettings(target = document.documentElement) {
  if (!target?.style) return;
  for (const token of COLOR_TOKENS) target.style.removeProperty(token.cssVar);
  target.style.removeProperty('color-scheme');
  delete target.dataset.colorMode;
  delete target.dataset.colorPreset;
}

export function toPickerHex(value) {
  if (!isHexColor(value)) return '#000000';
  const clean = normalizeHex(value);
  if (clean.length === 4 || clean.length === 5)
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  return clean.length === 9 ? clean.slice(0, 7) : clean;
}

export function colorToken(key) {
  return COLOR_TOKENS.find((token) => token.key === key);
}
