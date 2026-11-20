// Capa 1 — PALETA: valores crudos, sin significado.
//
// Es el ÚNICO fichero del proyecto donde puede aparecer un color literal
// (lo comprueba tests/theme.test.ts). Los temas eligen valores de aquí para
// rellenar la capa semántica; los componentes nunca la usan directamente.

export const palette = {
  white: '#ffffff',
  black: '#000000',

  /** Verde de acento (referencia: vuepress-theme-hope, #3eaf7c). */
  green: {
    50: '#eef8f3',
    100: '#d3efe1',
    200: '#a8dfc4',
    300: '#7fd1ae',
    400: '#55c193',
    500: '#3eaf7c',
    600: '#33966a',
    700: '#2a7d57',
    800: '#1f5c41',
    900: '#0b4d2c',
    950: '#063d22',
  },

  /** Grises claros (texto de hope: #2c3e50). */
  neutral: {
    50: '#f6f8fa',
    100: '#eef1f4',
    200: '#e2e6ea',
    300: '#d0d7de',
    400: '#7c858f',
    500: '#5f6b78',
    600: '#4e5864',
    700: '#3a4553',
    800: '#2c3e50',
    900: '#1d2330',
  },

  /** Grises oscuros (fondos del modo oscuro). */
  night: {
    950: '#0d1117',
    900: '#161b22',
    850: '#1c2128',
    800: '#262c36',
    700: '#30363d',
    600: '#6e7681',
    400: '#9198a1',
    300: '#c9d1d9',
    200: '#e6edf3',
  },

  /** Escala de gris puro para el tema de alto contraste. */
  gray: {
    50: '#f2f2f2',
    100: '#e6e6e6',
    600: '#5c5c5c',
    800: '#2b2b2b',
  },

  red: { 50: '#fdecea', 200: '#f2b8b5', 300: '#ff8a80', 700: '#c62828', 900: '#8e0000', dim: '#3d1d1d' },
  amber: { 50: '#fff4e5', 200: '#f5cf8e', 300: '#ffcc80', 400: '#ffd54a', 800: '#8a5300', 900: '#5c3a00', dim: '#3a2a12' },
  blue: { 50: '#eef3ff', 200: '#c9d7fb', 300: '#8ab4ff', 700: '#2457c5', 900: '#00308f', dim: '#172a4d' },
  violet: { 50: '#f3f0ff', 300: '#b9a6ff', 600: '#6a4fc0', 900: '#4a2a9c', dim: '#2a2147' },
  greenDim: '#16332a',

  /** Resaltado de sintaxis (paletas tipo GitHub claro/oscuro y una de contraste alto). */
  syntaxLight: {
    keyword: '#cf222e',
    string: '#0a3069',
    number: '#0550ae',
    comment: '#59636e',
    function: '#6639ba',
    type: '#953800',
    meta: '#116329',
  },
  syntaxDark: {
    keyword: '#ff7b72',
    string: '#a5d6ff',
    number: '#79c0ff',
    comment: '#9198a1',
    function: '#d2a8ff',
    type: '#ffa657',
    meta: '#7ee787',
  },
  syntaxContrast: {
    keyword: '#a40e26',
    string: '#032563',
    number: '#00377a',
    comment: '#3d3d3d',
    function: '#4b1a9c',
    type: '#6b2a00',
    meta: '#0a4d1f',
  },

  /** Sombras y velos (llevan color, así que también viven aquí). */
  shadow: {
    light1: '0 1px 3px 1px rgb(0 0 0 / 0.12), 0 1px 2px 0 rgb(0 0 0 / 0.24)',
    light2: '0 2px 6px 2px rgb(0 0 0 / 0.12), 0 1px 2px 0 rgb(0 0 0 / 0.24)',
    dark1: '0 1px 3px 1px rgb(0 0 0 / 0.5), 0 1px 2px 0 rgb(0 0 0 / 0.6)',
    dark2: '0 2px 6px 2px rgb(0 0 0 / 0.5), 0 1px 2px 0 rgb(0 0 0 / 0.6)',
    strong: '0 0 0 2px #000000',
  },
  backdrop: {
    light: 'rgb(0 0 0 / 0.35)',
    dark: 'rgb(0 0 0 / 0.6)',
  },
} as const
