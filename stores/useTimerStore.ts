import { create } from 'zustand';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type {
  CalendarBlockRow,
  ActivityLogRow,
  ActivityLogInsert,
  TimerMode,
} from '@/types/database';
import { POMODORO_DEFAULTS } from '@/constants/defaults';

// ---------------------------------------------------------------------------
// タイマーフェーズ型
// ---------------------------------------------------------------------------

export type TimerPhase = 'idle' | 'focus' | 'shortBreak' | 'longBreak';

// ---------------------------------------------------------------------------
// インターバル管理（Zustand state に置くと非シリアライザブルなのでモジュール変数で管理）
// ---------------------------------------------------------------------------

let _intervalId: ReturnType<typeof setInterval> | null = null;

function clearTimer() {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** タイマー開始時刻を記録する（フェーズ持続時間の計算に使う） */
let _phaseStartedAt: Date | null = null;

/** フェーズ開始からの経過秒数を返す */
function elapsedSeconds(): number {
  if (!_phaseStartedAt) return 0;
  return Math.floor((Date.now() - _phaseStartedAt.getTime()) / 1000);
}

// ---------------------------------------------------------------------------
// アクティブブロック情報（タイマー開始時に設定）
// ---------------------------------------------------------------------------

export interface ActiveBlockInfo {
  id: string;
  categoryId: string | null;
  subcategoryId: string | null;
  curriculumTaskId: string | null;
  timerMode: TimerMode;
  pomodoroCount: number;  // ポモドーロモード時の総セット数
  plannedDurationSec: number; // カウントダウンモード時の計画秒数
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface TimerState {
  // --- 設定（useUserSettingsStore から同期） ---
  focusSeconds: number;
  shortBreakSeconds: number;
  longBreakSeconds: number;
  longBreakAfter: number;

  // --- タイマー状態 ---
  mode: TimerMode;
  phase: TimerPhase;
  isRunning: boolean;
  secondsRemaining: number;
  /** ポモドーロ: 現在のセット番号（1始まり） */
  currentSession: number;
  /** ポモドーロ: 総セット数（ブロックの pomodoro_count） */
  totalSessions: number;

  // --- アクティブブロック ---
  activeBlock: ActiveBlockInfo | null;
  /** 現在進行中の activity_log の ID */
  currentLogId: string | null;

  loading: boolean;
  error: string | null;

  // --- 設定同期 ---
  syncSettings: (settings: {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    longBreakAfter: number;
  }) => void;

  // --- ポモドーロ操作 ---
  /**
   * ポモドーロタイマーを開始する。
   * activity_logs に in_progress レコードを INSERT し、インターバルを開始。
   */
  startPomodoro: (block: ActiveBlockInfo) => Promise<void>;
  /**
   * ポモドーロを一時停止。
   * インターバルを止めるだけで log は変更しない（中断ではない）。
   */
  pausePomodoro: () => void;
  /**
   * 一時停止から再開。
   */
  resumePomodoro: () => void;
  /**
   * フェーズ完了（focus 終了 or 休憩終了）。
   * - focus 完了: log に focus_duration_sec を更新、休憩フェーズへ移行
   * - 休憩完了: log に break_duration_sec を更新し status='completed'、
   *             次セッションへ or 全完了処理
   */
  completePhase: () => Promise<void>;
  /**
   * ポモドーロを中断。
   * log を status='interrupted' に更新し、タイマーをリセット。
   */
  interruptPomodoro: (reason: string) => Promise<void>;

  // --- カウントダウン操作 ---
  /**
   * カウントダウンタイマーを開始。
   * activity_logs に in_progress レコードを INSERT。
   */
  startCountdown: (block: ActiveBlockInfo) => Promise<void>;
  pauseCountdown: () => void;
  resumeCountdown: () => void;
  /** カウントダウン完了。log を status='completed' に更新。 */
  completeCountdown: () => Promise<void>;
  /** カウントダウン中断。 */
  interruptCountdown: (reason: string) => Promise<void>;

  /** タイマーを完全リセット（idle 状態に戻す） */
  reset: () => void;
  /** 1秒ティック（インターバルから呼ばれる） */
  tick: () => void;

  /**
   * バックグラウンドから復帰後に経過秒数分タイマーを補正する。
   * AppState リスナーから呼ぶこと。
   */
  adjustAfterBackground: (elapsedSecs: number) => void;

  clearError: () => void;
}

// ---------------------------------------------------------------------------
// ストア
// ---------------------------------------------------------------------------

export const useTimerStore = create<TimerState>((set, get) => ({
  // --- 設定 ---
  focusSeconds:       POMODORO_DEFAULTS.focusMinutes * 60,
  shortBreakSeconds:  POMODORO_DEFAULTS.shortBreakMinutes * 60,
  longBreakSeconds:   POMODORO_DEFAULTS.longBreakMinutes * 60,
  longBreakAfter:     POMODORO_DEFAULTS.longBreakAfterSessions,

  // --- タイマー状態 ---
  mode: 'pomodoro',
  phase: 'idle',
  isRunning: false,
  secondsRemaining: POMODORO_DEFAULTS.focusMinutes * 60,
  currentSession: 1,
  totalSessions: 1,

  // --- アクティブブロック ---
  activeBlock: null,
  currentLogId: null,

  loading: false,
  error: null,

  // =========================================================================
  // 設定同期
  // =========================================================================

  syncSettings: ({ focusMinutes, shortBreakMinutes, longBreakMinutes, longBreakAfter }) => {
    set({
      focusSeconds:      focusMinutes * 60,
      shortBreakSeconds: shortBreakMinutes * 60,
      longBreakSeconds:  longBreakMinutes * 60,
      longBreakAfter,
    });
  },

  // =========================================================================
  // ポモドーロ
  // =========================================================================

  startPomodoro: async (block) => {
    const { focusSeconds, currentSession } = get();
    set({ loading: true, error: null });
    try {
      clearTimer();
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const startedAt = new Date().toISOString();

      // activity_log を INSERT
      const { data: log, error } = await supabase
        .from('activity_logs')
        .insert({
          user_id:        userId,
          block_id:       block.id,
          category_id:    block.categoryId,
          subcategory_id: block.subcategoryId,
          curriculum_task_id: block.curriculumTaskId,
          timer_mode:     'pomodoro',
          started_at:     startedAt,
          pomodoro_index: currentSession,
          status:         'in_progress',
        } satisfies ActivityLogInsert)
        .select()
        .single();

      if (error) throw error;

      _phaseStartedAt = new Date();

      set({
        mode: 'pomodoro',
        phase: 'focus',
        isRunning: true,
        secondsRemaining: focusSeconds,
        totalSessions: block.pomodoroCount,
        activeBlock: block,
        currentLogId: log.id,
        loading: false,
      });

      // インターバル開始
      _intervalId = setInterval(() => {
        useTimerStore.getState().tick();
      }, 1000);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'タイマー開始に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  pausePomodoro: () => {
    clearTimer();
    set({ isRunning: false });
  },

  // -------------------------------------------------------------------------
  resumePomodoro: () => {
    set({ isRunning: true });
    _intervalId = setInterval(() => {
      useTimerStore.getState().tick();
    }, 1000);
  },

  // -------------------------------------------------------------------------
  completePhase: async () => {
    const {
      phase,
      currentSession,
      totalSessions,
      longBreakAfter,
      shortBreakSeconds,
      longBreakSeconds,
      focusSeconds,
      currentLogId,
      activeBlock,
    } = get();

    clearTimer();
    set({ loading: true, error: null });

    try {
      const now = new Date().toISOString();
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      // ------ 集中フェーズ完了 ------
      if (phase === 'focus') {
        const focusDuration = elapsedSeconds();
        _phaseStartedAt = new Date();

        // log に focus_duration_sec を記録（まだ completed にしない）
        if (currentLogId) {
          await supabase
            .from('activity_logs')
            .update({ focus_duration_sec: focusDuration })
            .eq('id', currentLogId);
        }

        const isLongBreak = currentSession % longBreakAfter === 0;
        const breakSeconds = isLongBreak ? longBreakSeconds : shortBreakSeconds;

        set({
          phase: isLongBreak ? 'longBreak' : 'shortBreak',
          isRunning: true,
          secondsRemaining: breakSeconds,
          loading: false,
        });

        // 休憩インターバル開始
        _intervalId = setInterval(() => {
          useTimerStore.getState().tick();
        }, 1000);

      // ------ 休憩フェーズ完了 ------
      } else if (phase === 'shortBreak' || phase === 'longBreak') {
        const breakDuration = elapsedSeconds();

        // log を completed に更新
        if (currentLogId) {
          await supabase
            .from('activity_logs')
            .update({
              break_duration_sec: breakDuration,
              completed_at:       now,
              status:             'completed',
            })
            .eq('id', currentLogId);
        }

        const isLastSession = currentSession >= totalSessions;

        if (isLastSession) {
          // ---- 全セッション完了 ----
          // ブロックのステータスを completed に更新
          if (activeBlock?.id) {
            await supabase
              .from('calendar_blocks')
              .update({ status: 'completed' })
              .eq('id', activeBlock.id);
          }

          // カリキュラムタスクの完了を記録
          if (activeBlock?.curriculumTaskId) {
            await supabase
              .from('curriculum_tasks')
              .update({
                is_completed:   true,
                completed_date: format(new Date(), 'yyyy-MM-dd'),
              })
              .eq('id', activeBlock.curriculumTaskId);
          }

          set({
            phase: 'idle',
            isRunning: false,
            currentSession: 1,
            secondsRemaining: focusSeconds,
            currentLogId: null,
            activeBlock: null,
            loading: false,
          });
        } else {
          // ---- 次のセッションを開始 ----
          const nextSession = currentSession + 1;
          _phaseStartedAt = new Date();

          if (!activeBlock) throw new Error('activeBlock が null です');

          // 次セッションの log を INSERT
          const { data: nextLog, error: logError } = await supabase
            .from('activity_logs')
            .insert({
              user_id:        userId,
              block_id:       activeBlock.id,
              category_id:    activeBlock.categoryId,
              subcategory_id: activeBlock.subcategoryId,
              curriculum_task_id: activeBlock.curriculumTaskId,
              timer_mode:     'pomodoro',
              started_at:     now,
              pomodoro_index: nextSession,
              status:         'in_progress',
            } satisfies ActivityLogInsert)
            .select()
            .single();

          if (logError) throw logError;

          set({
            phase: 'focus',
            isRunning: true,
            currentSession: nextSession,
            secondsRemaining: focusSeconds,
            currentLogId: nextLog.id,
            loading: false,
          });

          _intervalId = setInterval(() => {
            useTimerStore.getState().tick();
          }, 1000);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'フェーズ完了処理に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  interruptPomodoro: async (reason) => {
    const { currentLogId, focusSeconds, phase } = get();
    clearTimer();
    set({ loading: true, error: null });

    try {
      if (currentLogId) {
        const updatePayload: Partial<ActivityLogRow> = {
          completed_at:      new Date().toISOString(),
          status:            'interrupted',
          interrupted_reason: reason,
        };

        // 集中中に中断した場合は経過時間を記録
        if (phase === 'focus') {
          updatePayload.focus_duration_sec = elapsedSeconds();
        } else {
          updatePayload.break_duration_sec = elapsedSeconds();
        }

        await supabase
          .from('activity_logs')
          .update(updatePayload)
          .eq('id', currentLogId);
      }

      _phaseStartedAt = null;

      set({
        phase: 'idle',
        isRunning: false,
        currentSession: 1,
        secondsRemaining: focusSeconds,
        currentLogId: null,
        activeBlock: null,
        loading: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : '中断処理に失敗しました';
      set({ error: message, loading: false });
    }
  },

  // =========================================================================
  // カウントダウン
  // =========================================================================

  startCountdown: async (block) => {
    set({ loading: true, error: null });
    try {
      clearTimer();
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const startedAt = new Date().toISOString();

      const { data: log, error } = await supabase
        .from('activity_logs')
        .insert({
          user_id:             userId,
          block_id:            block.id,
          category_id:         block.categoryId,
          subcategory_id:      block.subcategoryId,
          curriculum_task_id:  block.curriculumTaskId,
          timer_mode:          'countdown',
          started_at:          startedAt,
          planned_duration_sec: block.plannedDurationSec,
          status:              'in_progress',
        } satisfies ActivityLogInsert)
        .select()
        .single();

      if (error) throw error;

      _phaseStartedAt = new Date();

      set({
        mode: 'countdown',
        phase: 'focus',
        isRunning: true,
        secondsRemaining: block.plannedDurationSec,
        totalSessions: 1,
        currentSession: 1,
        activeBlock: block,
        currentLogId: log.id,
        loading: false,
      });

      _intervalId = setInterval(() => {
        useTimerStore.getState().tick();
      }, 1000);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'タイマー開始に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  pauseCountdown: () => {
    clearTimer();
    set({ isRunning: false });
  },

  // -------------------------------------------------------------------------
  resumeCountdown: () => {
    set({ isRunning: true });
    _intervalId = setInterval(() => {
      useTimerStore.getState().tick();
    }, 1000);
  },

  // -------------------------------------------------------------------------
  completeCountdown: async () => {
    const { currentLogId, activeBlock, focusSeconds } = get();
    clearTimer();
    set({ loading: true, error: null });

    try {
      const actualDuration = elapsedSeconds();
      const now = new Date().toISOString();

      if (currentLogId) {
        await supabase
          .from('activity_logs')
          .update({
            actual_duration_sec: actualDuration,
            completed_at:        now,
            status:              'completed',
          })
          .eq('id', currentLogId);
      }

      // ブロックを completed に更新
      if (activeBlock?.id) {
        await supabase
          .from('calendar_blocks')
          .update({ status: 'completed' })
          .eq('id', activeBlock.id);
      }

      // カリキュラムタスクの完了を記録
      if (activeBlock?.curriculumTaskId) {
        await supabase
          .from('curriculum_tasks')
          .update({
            is_completed:   true,
            completed_date: format(new Date(), 'yyyy-MM-dd'),
          })
          .eq('id', activeBlock.curriculumTaskId);
      }

      _phaseStartedAt = null;

      set({
        phase: 'idle',
        isRunning: false,
        currentSession: 1,
        secondsRemaining: focusSeconds,
        currentLogId: null,
        activeBlock: null,
        loading: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : '完了処理に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  interruptCountdown: async (reason) => {
    const { currentLogId, focusSeconds } = get();
    clearTimer();
    set({ loading: true, error: null });

    try {
      if (currentLogId) {
        await supabase
          .from('activity_logs')
          .update({
            actual_duration_sec: elapsedSeconds(),
            completed_at:        new Date().toISOString(),
            status:              'interrupted',
            interrupted_reason:  reason,
          })
          .eq('id', currentLogId);
      }

      _phaseStartedAt = null;

      set({
        phase: 'idle',
        isRunning: false,
        currentSession: 1,
        secondsRemaining: focusSeconds,
        currentLogId: null,
        activeBlock: null,
        loading: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : '中断処理に失敗しました';
      set({ error: message, loading: false });
    }
  },

  // =========================================================================
  // tick — インターバルから1秒ごとに呼ばれる
  // =========================================================================

  tick: () => {
    const { isRunning, secondsRemaining, mode } = get();
    if (!isRunning) return;

    if (secondsRemaining <= 1) {
      set({ secondsRemaining: 0, isRunning: false });
      clearTimer();
      if (mode === 'countdown') {
        void get().completeCountdown();
      } else {
        void get().completePhase();
      }
      return;
    }

    set({ secondsRemaining: secondsRemaining - 1 });
  },

  // =========================================================================
  // reset
  // =========================================================================

  reset: () => {
    clearTimer();
    _phaseStartedAt = null;
    set((s) => ({
      phase: 'idle',
      isRunning: false,
      currentSession: 1,
      secondsRemaining: s.focusSeconds,
      currentLogId: null,
      activeBlock: null,
    }));
  },

  // =========================================================================
  // adjustAfterBackground
  // =========================================================================

  adjustAfterBackground: (elapsedSecs) => {
    const { isRunning, secondsRemaining, mode } = get();
    if (!isRunning) return;

    const newRemaining = Math.max(secondsRemaining - elapsedSecs, 0);

    if (newRemaining === 0) {
      clearTimer();
      set({ secondsRemaining: 0, isRunning: false });
      if (mode === 'countdown') {
        void get().completeCountdown();
      } else {
        void get().completePhase();
      }
    } else {
      set({ secondsRemaining: newRemaining });
    }
  },

  clearError: () => set({ error: null }),
}));
