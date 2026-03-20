/**
 * AGENDARYカラーパレット
 * CLAUDE.mdのデザインガイドライン準拠
 */

// 学習科目カラー
export const STUDY_COLORS = {
  purple: '#7c3aed',
  green: '#059669',
  coral: '#dc4a2d',
  amber: '#b45309',
  blue: '#1d4ed8',
  rose: '#be185d',
  teal: '#0f766e',
  indigo: '#4338ca',
} as const;

// 運動カラー
export const EXERCISE_COLORS = {
  lime: '#65a30d',
  cyan: '#0891b2',
  pink: '#db2777',
  orange: '#c2410c',
} as const;

// 生活・その他カラー
export const LIFE_COLORS = {
  slate: '#475569',
  gray: '#6b7280',
  stone: '#78716c',
} as const;

// UIカラー（ライトモード基準）
export const COLORS = {
  // 背景
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceElevated: '#f1f5f9',
  border: '#e2e8f0',

  // テキスト
  text: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#94a3b8',

  // アクセント
  primary: '#7c3aed',
  primaryLight: '#ede9fe',
  success: '#059669',
  warning: '#b45309',
  danger: '#dc2626',

  // タイマー画面（ダークネイビー）
  timerBackground: '#0f172a',
  timerSurface: '#1e293b',
  timerText: '#f1f5f9',
  timerRingPomodoro: '#22d3ee',
  timerRingCountdown: '#fb923c',

  // 充填率
  fillLow: '#f97316',
  fillMid: '#ef4444',
  fillFull: '#10b981',

  // 就寝ゾーン
  sleepZoneStart: '#1e293b',
  sleepZoneEnd: '#334155',

  // ゴーストブロック
  ghost: 'rgba(148, 163, 184, 0.4)',
  ghostBorder: '#94a3b8',
} as const;

export type ColorKey = keyof typeof COLORS;
export type StudyColorKey = keyof typeof STUDY_COLORS;
export type ExerciseColorKey = keyof typeof EXERCISE_COLORS;

export const CATEGORY_COLOR_OPTIONS = {
  study: Object.values(STUDY_COLORS),
  exercise: Object.values(EXERCISE_COLORS),
  life: Object.values(LIFE_COLORS),
} as const;

// Expo テンプレートの Themed.tsx / EditScreenInfo.tsx との後方互換性のためのデフォルトエクスポート
const LegacyColors = {
  light: {
    text:            COLORS.text,
    background:      COLORS.background,
    tint:            COLORS.primary,
    tabIconDefault:  COLORS.textMuted,
    tabIconSelected: COLORS.primary,
  },
  dark: {
    text:            '#f1f5f9',
    background:      '#0f172a',
    tint:            COLORS.timerRingPomodoro,
    tabIconDefault:  COLORS.textMuted,
    tabIconSelected: COLORS.timerRingPomodoro,
  },
} as const;

export default LegacyColors;
