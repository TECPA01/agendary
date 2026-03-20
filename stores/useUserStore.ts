import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { POMODORO_DEFAULTS, DEFAULTS } from '@/constants/defaults';

interface UserSettings {
  defaultWakeTime: string;
  defaultSleepTime: string;
  weekStartDay: number;
  pomodoroFocusMinutes: number;
  pomodoroShortBreak: number;
  pomodoroLongBreak: number;
  pomodoroLongBreakAfter: number;
  defaultReminderMinutes: number | null;
  focusModeAutoOn: boolean;
  lockModeEnabled: boolean;
}

interface UserState {
  user: User | null;
  settings: UserSettings;
  isOnboarded: boolean;
  setUser: (user: User | null) => void;
  setSettings: (settings: Partial<UserSettings>) => void;
  setIsOnboarded: (value: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  settings: {
    defaultWakeTime: DEFAULTS.wakeTime,
    defaultSleepTime: DEFAULTS.sleepTime,
    weekStartDay: DEFAULTS.weekStartDay,
    pomodoroFocusMinutes: POMODORO_DEFAULTS.focusMinutes,
    pomodoroShortBreak: POMODORO_DEFAULTS.shortBreakMinutes,
    pomodoroLongBreak: POMODORO_DEFAULTS.longBreakMinutes,
    pomodoroLongBreakAfter: POMODORO_DEFAULTS.longBreakAfterSessions,
    defaultReminderMinutes: DEFAULTS.reminderMinutes,
    focusModeAutoOn: false,
    lockModeEnabled: false,
  },
  isOnboarded: false,
  setUser: (user) => set({ user }),
  setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
  setIsOnboarded: (value) => set({ isOnboarded: value }),
}));
