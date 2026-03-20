import { create } from 'zustand';
import { format, parseISO, addDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { cancelNotification } from '@/lib/notifications';
import type {
  CalendarBlockRow,
  CalendarBlockInsert,
  CalendarBlockUpdate,
  BlockWithDetails,
  BlockStatus,
} from '@/types/database';

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** "HH:MM:SS" または "HH:MM" → 分数 */
function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return parts[0] * 60 + (parts[1] ?? 0);
}

/** ブロックの持続時間を分で返す */
function blockDurationMinutes(block: CalendarBlockRow): number {
  return Math.max(timeToMinutes(block.end_time) - timeToMinutes(block.start_time), 0);
}

/** 今日の日付文字列 YYYY-MM-DD */
const todayStr = () => format(new Date(), 'yyyy-MM-dd');

// ---------------------------------------------------------------------------
// Supabase クエリ — ブロック + JOIN
// ---------------------------------------------------------------------------

const BLOCK_SELECT = `
  *,
  activity_categories ( id, name, color, icon, type ),
  sub_categories      ( id, name, icon ),
  curriculum_tasks    ( id, name )
` as const;

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface CalendarState {
  /** 選択中の日付（YYYY-MM-DD） */
  selectedDate: string;
  viewMode: 'day' | 'week';
  /** 取得済みブロック（ゴースト含む）。key: date → blocks */
  blocksByDate: Record<string, BlockWithDetails[]>;
  loading: boolean;
  error: string | null;

  // --- 日付操作 ---
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: 'day' | 'week') => void;

  // --- フェッチ ---
  /** 指定日のブロックを Supabase から取得 */
  fetchBlocksForDate: (date: string) => Promise<void>;
  /** 週のすべての日のブロックを取得（weekStart: YYYY-MM-DD） */
  fetchBlocksForWeek: (weekStart: string) => Promise<void>;

  // --- CRUD ---
  /** ブロックを新規追加 */
  addBlock: (data: Omit<CalendarBlockInsert, 'user_id'>) => Promise<BlockWithDetails>;
  /**
   * ブロックを直接更新（将来日付の修正・軽微な編集に使う）。
   * 当日ブロックを大幅変更する場合は updateBlockWithGhost を使うこと。
   */
  updateBlock: (id: string, updates: CalendarBlockUpdate) => Promise<void>;
  /**
   * 当日ブロックのゴースト化 + 新ブロック作成。
   * - 元ブロック → is_ghost=true, changed_at=now()
   * - 新ブロック → original_block_id=元ブロックID
   * - ブロックの date が今日でない場合は通常の updateBlock にフォールバック。
   */
  updateBlockWithGhost: (
    originalId: string,
    newData: Omit<CalendarBlockInsert, 'user_id' | 'is_ghost' | 'original_block_id'>
  ) => Promise<BlockWithDetails>;
  /** ブロックを削除 */
  deleteBlock: (id: string, date: string) => Promise<void>;
  /** ブロックのステータスを更新（planned→in_progress→completed/skipped） */
  updateBlockStatus: (id: string, date: string, status: BlockStatus) => Promise<void>;

  // --- セレクター（同期） ---
  /** 指定日の非ゴーストブロック（status != skipped）。start_time 昇順 */
  getBlocksForDate: (date: string) => BlockWithDetails[];
  /** 指定日のゴーストブロック */
  getGhostBlocksForDate: (date: string) => BlockWithDetails[];
  /**
   * 充填率を返す（0〜100）。
   * @param date         対象日（YYYY-MM-DD）
   * @param availableMin 活動可能時間（分）— useUserSettingsStore.getAvailableMinutes() から取得
   */
  calculateFillRate: (date: string, availableMin: number) => number;
  /** 指定日の予定合計時間（分）。is_ghost=false & status!='skipped' */
  getScheduledMinutes: (date: string) => number;

  clearError: () => void;
}

// ---------------------------------------------------------------------------
// ストア
// ---------------------------------------------------------------------------

export const useCalendarStore = create<CalendarState>((set, get) => ({
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  viewMode: 'day',
  blocksByDate: {},
  loading: false,
  error: null,

  // =========================================================================
  // 日付・ビュー操作
  // =========================================================================

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    // 未取得の日付なら自動フェッチ
    if (!get().blocksByDate[date]) {
      get().fetchBlocksForDate(date);
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  // =========================================================================
  // フェッチ
  // =========================================================================

  fetchBlocksForDate: async (date) => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('calendar_blocks')
        .select(BLOCK_SELECT)
        .eq('user_id', userId)
        .eq('date', date)
        .order('start_time');

      if (error) throw error;

      set((s) => ({
        blocksByDate: {
          ...s.blocksByDate,
          [date]: (data ?? []) as unknown as BlockWithDetails[],
        },
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ブロックの取得に失敗しました';
      set({ error: message, loading: false });
    }
  },

  // -------------------------------------------------------------------------
  fetchBlocksForWeek: async (weekStart) => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('calendar_blocks')
        .select(BLOCK_SELECT)
        .eq('user_id', userId)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('start_time');

      if (error) throw error;

      // date ごとにグループ化
      const grouped: Record<string, BlockWithDetails[]> = {};
      for (const block of (data ?? []) as unknown as BlockWithDetails[]) {
        if (!grouped[block.date]) grouped[block.date] = [];
        grouped[block.date].push(block);
      }

      set((s) => ({
        blocksByDate: { ...s.blocksByDate, ...grouped },
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : '週間ブロックの取得に失敗しました';
      set({ error: message, loading: false });
    }
  },

  // =========================================================================
  // CRUD
  // =========================================================================

  addBlock: async (data) => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { data: block, error } = await supabase
        .from('calendar_blocks')
        .insert({ ...data, user_id: userId })
        .select(BLOCK_SELECT)
        .single();

      if (error) throw error;

      const newBlock = block as unknown as BlockWithDetails;
      set((s) => ({
        blocksByDate: {
          ...s.blocksByDate,
          [data.date]: [
            ...(s.blocksByDate[data.date] ?? []),
            newBlock,
          ].sort((a, b) => a.start_time.localeCompare(b.start_time)),
        },
        loading: false,
      }));

      return newBlock;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ブロックの追加に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  updateBlock: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('calendar_blocks')
        .update(updates)
        .eq('id', id)
        .select(BLOCK_SELECT)
        .single();

      if (error) throw error;

      const updated = data as unknown as BlockWithDetails;
      set((s) => {
        // 更新前の date を探して置き換え
        const newBlocksByDate: Record<string, BlockWithDetails[]> = {};
        for (const [date, blocks] of Object.entries(s.blocksByDate)) {
          newBlocksByDate[date] = blocks.map((b) =>
            b.id === id ? updated : b
          );
        }
        return { blocksByDate: newBlocksByDate, loading: false };
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ブロックの更新に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  updateBlockWithGhost: async (originalId, newData) => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      // 元ブロックを検索
      const allBlocks = Object.values(get().blocksByDate).flat();
      const originalBlock = allBlocks.find((b) => b.id === originalId);
      if (!originalBlock) throw new Error('元のブロックが見つかりません');

      // 元ブロックが今日のものでない場合 → 通常更新
      if (originalBlock.date !== todayStr()) {
        await get().updateBlock(originalId, newData as CalendarBlockUpdate);
        const updated = Object.values(get().blocksByDate)
          .flat()
          .find((b) => b.id === originalId);
        return updated!;
      }

      // ゴースト化トランザクション（Supabase は RPC で原子性を保証するが、
      // ここではクライアント側で順次実行しデータ整合性を保つ）
      const now = new Date().toISOString();

      // 1. 元ブロックをゴースト化
      const { error: ghostError } = await supabase
        .from('calendar_blocks')
        .update({ is_ghost: true, changed_at: now })
        .eq('id', originalId);

      if (ghostError) throw ghostError;

      // 2. 新ブロックを INSERT
      const { data: newBlock, error: insertError } = await supabase
        .from('calendar_blocks')
        .insert({
          ...newData,
          user_id: userId,
          is_ghost: false,
          original_block_id: originalId,
          changed_at: now,
        })
        .select(BLOCK_SELECT)
        .single();

      if (insertError) throw insertError;

      const created = newBlock as unknown as BlockWithDetails;

      set((s) => {
        const date = originalBlock.date;
        const existingBlocks = s.blocksByDate[date] ?? [];

        // 元ブロックをゴースト状態に更新
        const updatedBlocks = existingBlocks
          .map((b) =>
            b.id === originalId
              ? { ...b, is_ghost: true, changed_at: now }
              : b
          )
          // 新ブロックを追加
          .concat(created)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));

        return {
          blocksByDate: { ...s.blocksByDate, [date]: updatedBlocks },
          loading: false,
        };
      });

      return created;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ブロックの変更に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  deleteBlock: async (id, date) => {
    set({ loading: true, error: null });
    try {
      // 通知をキャンセル（エラーは無視）
      cancelNotification(id).catch(() => {});

      const { error } = await supabase
        .from('calendar_blocks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        blocksByDate: {
          ...s.blocksByDate,
          [date]: (s.blocksByDate[date] ?? []).filter((b) => b.id !== id),
        },
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ブロックの削除に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  updateBlockStatus: async (id, date, status) => {
    await get().updateBlock(id, { status });
  },

  // =========================================================================
  // セレクター（同期・純粋）
  // =========================================================================

  getBlocksForDate: (date) => {
    return (get().blocksByDate[date] ?? [])
      .filter((b) => !b.is_ghost && b.status !== 'skipped')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  },

  getGhostBlocksForDate: (date) => {
    return (get().blocksByDate[date] ?? [])
      .filter((b) => b.is_ghost)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  },

  getScheduledMinutes: (date) => {
    return get()
      .getBlocksForDate(date)
      .reduce((sum, b) => sum + blockDurationMinutes(b), 0);
  },

  calculateFillRate: (date, availableMin) => {
    if (availableMin <= 0) return 0;
    const scheduled = get().getScheduledMinutes(date);
    return Math.min(Math.round((scheduled / availableMin) * 100), 100);
  },

  clearError: () => set({ error: null }),
}));
