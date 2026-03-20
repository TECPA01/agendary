import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface AuthState {
  user: User | null;
  session: Session | null;
  /** 初期セッション確認中 or 認証操作中 */
  loading: boolean;
  error: string | null;

  /**
   * アプリ起動時に呼ぶ。現在のセッションを取得し、認証状態変化を監視する。
   * @returns onAuthStateChange のアンサブスクライブ関数
   */
  initialize: () => Promise<() => void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// ストア
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  // -------------------------------------------------------------------------
  // initialize
  // -------------------------------------------------------------------------
  initialize: async () => {
    set({ loading: true, error: null });

    // 既存セッションの取得（AsyncStorage から復元）
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      set({ error: error.message, loading: false });
    } else {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    }

    // 認証状態変化の監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        set({
          session,
          user: session?.user ?? null,
          // セッション変化後は loading を落とす
          loading: false,
        });
      }
    );

    // クリーンアップ関数を返す（呼び出し元でアンマウント時に実行）
    return () => subscription.unsubscribe();
  },

  // -------------------------------------------------------------------------
  // signUp
  // -------------------------------------------------------------------------
  signUp: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // user/session は onAuthStateChange 経由でセットされる
      set({ loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : '登録に失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  // signIn
  // -------------------------------------------------------------------------
  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      set({
        user: data.user,
        session: data.session,
        loading: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ログインに失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  // -------------------------------------------------------------------------
  // signOut
  // -------------------------------------------------------------------------
  signOut: async () => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null, session: null, loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ログアウトに失敗しました';
      set({ error: message, loading: false });
      throw e;
    }
  },

  clearError: () => set({ error: null }),
}));
