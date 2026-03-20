/**
 * AGENDARYデフォルト値・テンプレート定義
 */

// ポモドーロ設定デフォルト値
export const POMODORO_DEFAULTS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakAfterSessions: 4,
} as const;

// ユーザー設定デフォルト値
export const DEFAULTS = {
  wakeTime: '07:00',
  sleepTime: '23:00',
  weekStartDay: 1, // 1=月曜
  reminderMinutes: 10,

  // カテゴリテンプレート（オンボーディング表示用）
  categoryTemplates: {
    study: [
      {
        name: '民法',
        icon: '📖',
        color: '#7c3aed',
        subcategories: ['講義', '問題演習', '復習'],
      },
      {
        name: '行政法',
        icon: '📚',
        color: '#059669',
        subcategories: ['講義', '問題演習', '復習'],
      },
      {
        name: '英語',
        icon: '🗣️',
        color: '#1d4ed8',
        subcategories: ['リスニング', 'リーディング', '単語'],
      },
    ],
    exercise: [
      {
        name: 'ランニング',
        icon: '🏃',
        color: '#65a30d',
        subcategories: ['ジョギング', 'インターバル'],
      },
      {
        name: '筋トレ',
        icon: '💪',
        color: '#0891b2',
        subcategories: ['上半身', '下半身', 'コア'],
      },
      {
        name: 'ストレッチ',
        icon: '🧘',
        color: '#db2777',
        subcategories: ['ヨガ', '柔軟'],
      },
    ],
    life: [
      {
        name: '食事',
        icon: '🍽️',
        color: '#475569',
        subcategories: ['朝食', '昼食', '夕食'],
      },
      {
        name: '入浴・準備',
        icon: '🚿',
        color: '#6b7280',
        subcategories: ['入浴', '身支度'],
      },
      {
        name: '通勤・通学',
        icon: '🚃',
        color: '#78716c',
        subcategories: ['往路', '復路'],
      },
    ],
  },

  // サブカテゴリデフォルトテンプレート（タイプ別）
  subcategoryTemplates: {
    study: [
      { name: '講義', icon: '📺' },
      { name: '問題演習', icon: '✏️' },
      { name: '復習', icon: '🔄' },
      { name: 'まとめ', icon: '📝' },
    ],
    exercise: [
      { name: 'ウォームアップ', icon: '🔥' },
      { name: 'メイン', icon: '⚡' },
      { name: 'クールダウン', icon: '❄️' },
    ],
    life: [
      { name: 'ルーティン', icon: '🔁' },
    ],
  },

  // カレンダーブロック設定
  blockDefaults: {
    timerMode: 'pomodoro' as const,
    pomodoroCount: 1,
    reminderMinuteOptions: [5, 10, 15, 30, 60] as number[],
  },
} as const;

export type CategoryType = 'study' | 'exercise' | 'life';
export type TimerMode = 'pomodoro' | 'countdown';
export type BlockStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';
export type ActivityLogStatus = 'in_progress' | 'completed' | 'interrupted';
