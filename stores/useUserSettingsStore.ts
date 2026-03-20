import { create } from 'zustand';
import { getDay, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type {
  UserSettingsRow,
  UserSettingsUpdate,
  DailyScheduleRow,
} from '@/types/database';
import { DEFAULTS, POMODORO_DEFAULTS } from '@/constants/defaults';

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

/** "HH:MM:SS" または "HH:MM" → 分数 */
function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return parts[0] * 60 + (parts[1] ?? 0);
}

/** 認証済みユーザーIDを取得（未認証なら null） */
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface UserSettingsState {
  settings: UserSettingsRow | null;
  dailySchedules: DailyScheduleRow[];
  loading: boolean;
  error: string | null;

  /** user_settings を Supabase からロード（サインイン後に呼ぶ） */
  fetchSettings: () => Promise<void>;
  /** user_settings を部分更新 */
  updateSettings: (updates: UserSettingsUpdate) => Promise<void>;
  /** daily_schedules を全件ロード */
  fetchDailySchedules: () => Promise<void>;
  /**
   * 曜日別スケジュールを追加/更新。
   * wakeTime / sleepTime に null を渡すとデフォルトに戻す（行ごと削除）。
   */
  upsertDailySchedule: (
    dayOfWeek: number,
    wakeTime: string | null,
    sleepTime: string | null
  ) => Promise<void>;
  /** 曜日別スケジュールのオーバーライドを削除（デフォルトに戻す） */
  deleteDailySchedule: (dayOfWeek: number) => Promise<void>;
  /**
   * 指定日の有効な起床・就寝時刻を返す。
   * daily_schedules のオーバーライドがあればそれを、なければ user_settings のデフォルトを使う。
   */
  getEffectiveSchedule: (date: string | Date) => { wakeTime: string; sleepTime: string };
  /**
   * 指定日の活動可能時間（分）を返す。
   * 活動可能時間 = 就寝時刻 - 起床時刻
   */
  getAvailableMinutes: (date: string | Date) => number;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// ストア
// ---------------------------------------------------------------------------

export const useUserSettingsStore = create<UserSettingsState>((set, get) => ({
  settings: null,
  dailySchedules: [],
  loading: false,
  error: null,

  // -------------------------------------------------------------------------
  // fetchSettings
  // -------------------------------------------------------------------------
  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      set({ settings: data, loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : '設定の取得に失敗しました';
      set({ error: message, loading: false });
    }
  },

  // -------------------------------------------------------------------------
  // updateSettings
  // -------------------------------------------------------------------------
  updateSettings: async (updates) => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      set({ settings: data, loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : '設定の更新に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  // fetchDailySchedules
  // -------------------------------------------------------------------------
  fetchDailySchedules: async () => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('daily_schedules')
        .select('*')
        .eq('user_id', userId)
        .order('day_of_week');

      if (error) throw error;
      set({ dailySchedules: data ?? [], loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : '曜日別スケジュールの取得に失敗しました';
      set({ error: message, loading: false });
    }
  },

  // -------------------------------------------------------------------------
  // upsertDailySchedule
  // -------------------------------------------------------------------------
  upsertDailySchedule: async (dayOfWeek, wakeTime, sleepTime) => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      // どちらも null ならオーバーライドを削除してデフォルトに戻す
      if (wakeTime === null && sleepTime === null) {
        await get().deleteDailySchedule(dayOfWeek);
        return;
      }

      const { data, error } = await supabase
        .from('daily_schedules')
        .upsert(
          {
            user_id: userId,
            day_of_week: dayOfWeek,
            wake_time: wakeTime,
            sleep_time: sleepTime,
          },
          { onConflict: 'user_id,day_of_week' }
        )
        .select()
        .single();

      if (error) throw error;

      set((s) => {
        const rest = s.dailySchedules.filter((d) => d.day_of_week !== dayOfWeek);
        const sorted = [...rest, data].sort((a, b) => a.day_of_week - b.day_of_week);
        return { dailySchedules: sorted, loading: false };
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'スケジュールの保存に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  // deleteDailySchedule
  // -------------------------------------------------------------------------
  deleteDailySchedule: async (dayOfWeek) => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('daily_schedules')
        .delete()
        .eq('user_id', userId)
        .eq('day_of_week', dayOfWeek);

      if (error) throw error;

      set((s) => ({
        dailySchedules: s.dailySchedules.filter((d) => d.day_of_week !== dayOfWeek),
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'スケジュールの削除に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  // getEffectiveSchedule — 純粋計算（同期）
  // -------------------------------------------------------------------------
  getEffectiveSchedule: (date) => {
    const { settings, dailySchedules } = get();
    const defaultWake  = settings?.default_wake_time  ?? DEFAULTS.wakeTime;
    const defaultSleep = settings?.default_sleep_time ?? DEFAULTS.sleepTime;

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const dow = getDay(dateObj); // 0=日〜6=土

    const override = dailySchedules.find((d) => d.day_of_week === dow);
    return {
      wakeTime:  override?.wake_time  ?? defaultWake,
      sleepTime: override?.sleep_time ?? defaultSleep,
    };
  },

  // -------------------------------------------------------------------------
  // getAvailableMinutes — 純粋計算（同期）
  // -------------------------------------------------------------------------
  getAvailableMinutes: (date) => {
    const { wakeTime, sleepTime } = get().getEffectiveSchedule(date);
    return Math.max(timeToMinutes(sleepTime) - timeToMinutes(wakeTime), 0);
  },

  clearError: () => set({ error: null }),
}));
