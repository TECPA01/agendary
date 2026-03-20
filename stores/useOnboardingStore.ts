import { create } from 'zustand';
import { DEFAULTS } from '@/constants/defaults';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export interface CategoryDraft {
  type: 'study' | 'exercise' | 'life';
  name: string;
  icon: string;
  color: string;
  selected: boolean;
}

interface OnboardingState {
  wakeTime: string;
  sleepTime: string;
  weekStartDay: number;
  categories: CategoryDraft[];

  setSchedule: (wakeTime: string, sleepTime: string, weekStartDay: number) => void;
  toggleCategory: (name: string, type: string) => void;
  reset: () => void;
  getSelectedCategories: () => CategoryDraft[];
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function buildDefaultCategories(): CategoryDraft[] {
  const result: CategoryDraft[] = [];
  const types = ['study', 'exercise', 'life'] as const;
  for (const type of types) {
    for (const t of DEFAULTS.categoryTemplates[type]) {
      result.push({ type, name: t.name, icon: t.icon, color: t.color, selected: true });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// ストア
// ---------------------------------------------------------------------------

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  wakeTime: DEFAULTS.wakeTime,
  sleepTime: DEFAULTS.sleepTime,
  weekStartDay: DEFAULTS.weekStartDay,
  categories: buildDefaultCategories(),

  setSchedule: (wakeTime, sleepTime, weekStartDay) => {
    set({ wakeTime, sleepTime, weekStartDay });
  },

  toggleCategory: (name, type) => {
    set((s) => ({
      categories: s.categories.map((c) =>
        c.name === name && c.type === type ? { ...c, selected: !c.selected } : c
      ),
    }));
  },

  reset: () =>
    set({
      wakeTime: DEFAULTS.wakeTime,
      sleepTime: DEFAULTS.sleepTime,
      weekStartDay: DEFAULTS.weekStartDay,
      categories: buildDefaultCategories(),
    }),

  getSelectedCategories: () => get().categories.filter((c) => c.selected),
}));
