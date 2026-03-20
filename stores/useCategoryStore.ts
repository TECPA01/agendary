import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type {
  ActivityCategoryRow,
  ActivityCategoryInsert,
  ActivityCategoryUpdate,
  SubCategoryRow,
  SubCategoryInsert,
  CurriculumTaskRow,
  CurriculumTaskInsert,
  CurriculumTaskUpdate,
  CategoryWithSubcategories,
  CategoryType,
} from '@/types/database';

// ---------------------------------------------------------------------------
// カテゴリ追加時のデフォルト内訳テンプレート
// ---------------------------------------------------------------------------

const DEFAULT_SUBCATEGORIES: Record<
  CategoryType,
  { name: string; icon: string }[]
> = {
  study: [
    { name: '講義',     icon: '📺' },
    { name: '問題演習', icon: '✏️' },
    { name: '模擬テスト', icon: '📝' },
  ],
  exercise: [
    { name: 'ウォームアップ', icon: '🔥' },
    { name: 'メイン',        icon: '⚡' },
    { name: 'クールダウン',  icon: '❄️' },
  ],
  life: [
    { name: 'ルーティン', icon: '🔁' },
  ],
};

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface CategoryState {
  /** サブカテゴリ込みのカテゴリ一覧 */
  categories: CategoryWithSubcategories[];
  /** カテゴリ別のカリキュラムタスク（categoryId → tasks） */
  curriculumTasks: Record<string, CurriculumTaskRow[]>;
  loading: boolean;
  error: string | null;

  // --- activity_categories ---
  /** 全カテゴリをサブカテゴリ付きで取得 */
  fetchCategories: () => Promise<void>;
  /**
   * カテゴリを追加し、type に応じたデフォルト内訳を自動作成する。
   * @returns 作成されたカテゴリ（サブカテゴリ込み）
   */
  addCategory: (
    data: Omit<ActivityCategoryInsert, 'user_id'>
  ) => Promise<CategoryWithSubcategories>;
  updateCategory: (id: string, updates: ActivityCategoryUpdate) => Promise<void>;
  /** ソフトデリート（is_archived = true） */
  archiveCategory: (id: string) => Promise<void>;
  /** アーカイブ解除 */
  restoreCategory: (id: string) => Promise<void>;

  // --- sub_categories ---
  addSubcategory: (
    categoryId: string,
    data: Omit<SubCategoryInsert, 'category_id'>
  ) => Promise<SubCategoryRow>;
  updateSubcategory: (
    id: string,
    updates: Partial<Pick<SubCategoryRow, 'name' | 'icon' | 'sort_order' | 'is_active'>>
  ) => Promise<void>;
  /** サブカテゴリを削除（最低1つ active が残る場合のみ削除可） */
  deleteSubcategory: (id: string, categoryId: string) => Promise<void>;
  /** トグル ON/OFF */
  toggleSubcategory: (id: string, categoryId: string) => Promise<void>;

  // --- curriculum_tasks ---
  fetchCurriculumTasks: (categoryId: string) => Promise<void>;
  addCurriculumTask: (
    data: Omit<CurriculumTaskInsert, 'user_id'>
  ) => Promise<CurriculumTaskRow>;
  /**
   * 一括連番登録。例: baseName="第", count=10, startNum=1 → "第1回"〜"第10回"
   */
  bulkAddCurriculumTasks: (
    categoryId: string,
    baseName: string,
    count: number,
    startNum?: number
  ) => Promise<void>;
  updateCurriculumTask: (
    id: string,
    updates: CurriculumTaskUpdate
  ) => Promise<void>;
  deleteCurriculumTask: (id: string, categoryId: string) => Promise<void>;

  // --- セレクター（同期） ---
  getCategoriesByType: (type: CategoryType, includeArchived?: boolean) => CategoryWithSubcategories[];
  getCategoryById: (id: string) => CategoryWithSubcategories | undefined;
  getActiveSubcategories: (categoryId: string) => SubCategoryRow[];

  clearError: () => void;
}

// ---------------------------------------------------------------------------
// ストア
// ---------------------------------------------------------------------------

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  curriculumTasks: {},
  loading: false,
  error: null,

  // =========================================================================
  // activity_categories
  // =========================================================================

  fetchCategories: async () => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('activity_categories')
        .select(`
          *,
          sub_categories (*)
        `)
        .eq('user_id', userId)
        .order('sort_order')
        .order('sort_order', { referencedTable: 'sub_categories' });

      if (error) throw error;

      // Supabase の join レスポンスを CategoryWithSubcategories にキャスト
      const categories = (data ?? []) as unknown as CategoryWithSubcategories[];

      set({ categories, loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'カテゴリの取得に失敗しました';
      set({ error: message, loading: false });
    }
  },

  // -------------------------------------------------------------------------
  addCategory: async (data) => {
    set({ loading: true, error: null });
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      // 1. カテゴリを INSERT
      const { data: category, error: catError } = await supabase
        .from('activity_categories')
        .insert({ ...data, user_id: userId })
        .select()
        .single();

      if (catError) throw catError;

      // 2. デフォルト内訳を一括 INSERT
      const defaults = DEFAULT_SUBCATEGORIES[category.type] ?? [];
      const subInserts = defaults.map((sub, i) => ({
        category_id: category.id,
        name: sub.name,
        icon: sub.icon,
        sort_order: i,
        is_active: true,
      }));

      const { data: subcategories, error: subError } = await supabase
        .from('sub_categories')
        .insert(subInserts)
        .select();

      if (subError) throw subError;

      const cat = category as unknown as ActivityCategoryRow;
      const newCategory: CategoryWithSubcategories = {
        ...cat,
        sub_categories: (subcategories ?? []) as unknown as SubCategoryRow[],
      };

      set((s) => ({
        categories: [...s.categories, newCategory],
        loading: false,
      }));

      return newCategory;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'カテゴリの追加に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  updateCategory: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('activity_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const updated = data as unknown as ActivityCategoryRow;
      set((s) => ({
        categories: s.categories.map((c) =>
          c.id === id ? { ...c, ...updated } : c
        ),
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'カテゴリの更新に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  archiveCategory: async (id) => {
    await get().updateCategory(id, { is_archived: true });
  },

  restoreCategory: async (id) => {
    await get().updateCategory(id, { is_archived: false });
  },

  // =========================================================================
  // sub_categories
  // =========================================================================

  addSubcategory: async (categoryId, data) => {
    set({ loading: true, error: null });
    try {
      const { data: sub, error } = await supabase
        .from('sub_categories')
        .insert({ ...data, category_id: categoryId })
        .select()
        .single();

      if (error) throw error;

      set((s) => ({
        categories: s.categories.map((c) =>
          c.id === categoryId
            ? { ...c, sub_categories: [...c.sub_categories, sub] }
            : c
        ),
        loading: false,
      }));

      return sub;
    } catch (e) {
      const message = e instanceof Error ? e.message : '内訳の追加に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  updateSubcategory: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('sub_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      set((s) => ({
        categories: s.categories.map((c) => ({
          ...c,
          sub_categories: c.sub_categories.map((sub) =>
            sub.id === id ? { ...sub, ...data } : sub
          ),
        })),
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : '内訳の更新に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  deleteSubcategory: async (id, categoryId) => {
    const category = get().getCategoryById(categoryId);
    const activeCount = category?.sub_categories.filter((s) => s.is_active).length ?? 0;
    const targetIsActive = category?.sub_categories.find((s) => s.id === id)?.is_active;

    // 最低1つ active が必要
    if (targetIsActive && activeCount <= 1) {
      set({ error: '最低1つの内訳をONにする必要があります' });
      throw new Error('最低1つの内訳をONにする必要があります');
    }

    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('sub_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        categories: s.categories.map((c) =>
          c.id === categoryId
            ? { ...c, sub_categories: c.sub_categories.filter((sub) => sub.id !== id) }
            : c
        ),
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : '内訳の削除に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  toggleSubcategory: async (id, categoryId) => {
    const category = get().getCategoryById(categoryId);
    const target = category?.sub_categories.find((s) => s.id === id);
    if (!target) return;

    // OFF にしようとしているとき、active が1つだけなら拒否
    if (target.is_active) {
      const activeCount = category!.sub_categories.filter((s) => s.is_active).length;
      if (activeCount <= 1) {
        set({ error: '最低1つの内訳をONにする必要があります' });
        return;
      }
    }

    await get().updateSubcategory(id, { is_active: !target.is_active });
  },

  // =========================================================================
  // curriculum_tasks
  // =========================================================================

  fetchCurriculumTasks: async (categoryId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('curriculum_tasks')
        .select('*')
        .eq('category_id', categoryId)
        .order('sort_order');

      if (error) throw error;

      set((s) => ({
        curriculumTasks: {
          ...s.curriculumTasks,
          [categoryId]: data ?? [],
        },
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'カリキュラムの取得に失敗しました';
      set({ error: message, loading: false });
    }
  },

  // -------------------------------------------------------------------------
  addCurriculumTask: async (data) => {
    set({ loading: true, error: null });
    try {
      // sort_order: 既存タスク数を末尾として追加
      const existing = get().curriculumTasks[data.category_id] ?? [];
      const sortOrder = existing.length;

      const { data: task, error } = await supabase
        .from('curriculum_tasks')
        .insert({ ...data, sort_order: sortOrder })
        .select()
        .single();

      if (error) throw error;

      set((s) => ({
        curriculumTasks: {
          ...s.curriculumTasks,
          [data.category_id]: [...(s.curriculumTasks[data.category_id] ?? []), task],
        },
        loading: false,
      }));

      return task;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'タスクの追加に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  bulkAddCurriculumTasks: async (categoryId, baseName, count, startNum = 1) => {
    set({ loading: true, error: null });
    try {
      const existing = get().curriculumTasks[categoryId] ?? [];
      const baseOrder = existing.length;

      const inserts = Array.from({ length: count }, (_, i) => ({
        category_id: categoryId,
        name: `${baseName}${startNum + i}回`,
        sort_order: baseOrder + i,
        is_completed: false,
      }));

      const { data, error } = await supabase
        .from('curriculum_tasks')
        .insert(inserts)
        .select();

      if (error) throw error;

      set((s) => ({
        curriculumTasks: {
          ...s.curriculumTasks,
          [categoryId]: [...(s.curriculumTasks[categoryId] ?? []), ...(data ?? [])],
        },
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : '一括タスク追加に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  updateCurriculumTask: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('curriculum_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      set((s) => {
        const categoryId = data.category_id;
        return {
          curriculumTasks: {
            ...s.curriculumTasks,
            [categoryId]: (s.curriculumTasks[categoryId] ?? []).map((t) =>
              t.id === id ? { ...t, ...data } : t
            ),
          },
          loading: false,
        };
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'タスクの更新に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  deleteCurriculumTask: async (id, categoryId) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('curriculum_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((s) => ({
        curriculumTasks: {
          ...s.curriculumTasks,
          [categoryId]: (s.curriculumTasks[categoryId] ?? []).filter(
            (t) => t.id !== id
          ),
        },
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'タスクの削除に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // =========================================================================
  // セレクター（同期・純粋）
  // =========================================================================

  getCategoriesByType: (type, includeArchived = false) => {
    return get().categories.filter(
      (c) => c.type === type && (includeArchived || !c.is_archived)
    );
  },

  getCategoryById: (id) => {
    return get().categories.find((c) => c.id === id);
  },

  getActiveSubcategories: (categoryId) => {
    const category = get().getCategoryById(categoryId);
    return (category?.sub_categories ?? []).filter((s) => s.is_active);
  },

  clearError: () => set({ error: null }),
}));
