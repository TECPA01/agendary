/**
 * Supabase データベース型定義
 * CLAUDE.md の全10テーブル設計に基づく
 * 本番では `npx supabase gen types typescript --project-id <id>` で自動生成すること
 *
 * NOTE: Insert/Update 型は Row から Omit を使わず独立定義することで
 *       TypeScript の循環参照エラーを回避している
 */

// ---------------------------------------------------------------------------
// 基本型
// ---------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Enum 型（SQL の CHECK 制約・ENUM 型に対応）
// ---------------------------------------------------------------------------

export type CategoryType     = 'study' | 'exercise' | 'life';
export type BlockType        = 'study' | 'exercise' | 'life' | 'rest';
export type TimerMode        = 'pomodoro' | 'countdown';
export type BlockStatus      = 'planned' | 'in_progress' | 'completed' | 'skipped';
export type LogStatus        = 'in_progress' | 'completed' | 'interrupted';
export type WeeklyPlanStatus = 'draft' | 'active' | 'completed';
export type NotificationType =
  | 'session_reminder'
  | 'weekly_plan_reminder'
  | 'weekly_report_ready'
  | 'streak_reminder';

// ---------------------------------------------------------------------------
// Database 型（createClient<Database> に渡す）
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {

      // -----------------------------------------------------------------------
      // 1. user_settings
      // -----------------------------------------------------------------------
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          default_wake_time: string;
          default_sleep_time: string;
          week_start_day: number;
          pomodoro_focus_minutes: number;
          pomodoro_short_break: number;
          pomodoro_long_break: number;
          pomodoro_long_break_after: number;
          default_reminder_minutes: number | null;
          focus_mode_auto_on: boolean;
          focus_allow_phone_calls: boolean;
          lock_mode_enabled: boolean;
          lock_mode_auto_on: boolean;
          lock_allow_emergency: boolean;
          lock_during_break: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          default_wake_time?: string;
          default_sleep_time?: string;
          week_start_day?: number;
          pomodoro_focus_minutes?: number;
          pomodoro_short_break?: number;
          pomodoro_long_break?: number;
          pomodoro_long_break_after?: number;
          default_reminder_minutes?: number | null;
          focus_mode_auto_on?: boolean;
          focus_allow_phone_calls?: boolean;
          lock_mode_enabled?: boolean;
          lock_mode_auto_on?: boolean;
          lock_allow_emergency?: boolean;
          lock_during_break?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          default_wake_time?: string;
          default_sleep_time?: string;
          week_start_day?: number;
          pomodoro_focus_minutes?: number;
          pomodoro_short_break?: number;
          pomodoro_long_break?: number;
          pomodoro_long_break_after?: number;
          default_reminder_minutes?: number | null;
          focus_mode_auto_on?: boolean;
          focus_allow_phone_calls?: boolean;
          lock_mode_enabled?: boolean;
          lock_mode_auto_on?: boolean;
          lock_allow_emergency?: boolean;
          lock_during_break?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      // 2. daily_schedules
      // -----------------------------------------------------------------------
      daily_schedules: {
        Row: {
          id: string;
          user_id: string;
          day_of_week: number;
          wake_time: string | null;
          sleep_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day_of_week: number;
          wake_time?: string | null;
          sleep_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day_of_week?: number;
          wake_time?: string | null;
          sleep_time?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      // 3. activity_categories
      // -----------------------------------------------------------------------
      activity_categories: {
        Row: {
          id: string;
          user_id: string;
          type: CategoryType;
          name: string;
          color: string;
          icon: string | null;
          sort_order: number;
          weekly_target: number | null;
          has_curriculum: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: CategoryType;
          name: string;
          color: string;
          icon?: string | null;
          sort_order?: number;
          weekly_target?: number | null;
          has_curriculum?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: CategoryType;
          name?: string;
          color?: string;
          icon?: string | null;
          sort_order?: number;
          weekly_target?: number | null;
          has_curriculum?: boolean;
          is_archived?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      // 4. sub_categories
      // -----------------------------------------------------------------------
      sub_categories: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      // 5. curriculum_tasks
      // -----------------------------------------------------------------------
      curriculum_tasks: {
        Row: {
          id: string;
          category_id: string;
          subcategory_id: string | null;
          name: string;
          sort_order: number;
          is_completed: boolean;
          completed_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          subcategory_id?: string | null;
          name: string;
          sort_order?: number;
          is_completed?: boolean;
          completed_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          subcategory_id?: string | null;
          name?: string;
          sort_order?: number;
          is_completed?: boolean;
          completed_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      // 6. calendar_blocks ⭐ 中核テーブル
      // -----------------------------------------------------------------------
      calendar_blocks: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          start_time: string;
          end_time: string;
          block_type: BlockType;
          category_id: string | null;
          subcategory_id: string | null;
          curriculum_task_id: string | null;
          timer_mode: TimerMode;
          pomodoro_count: number | null;
          memo: string | null;
          reminder_minutes: number | null;
          is_ghost: boolean;
          original_block_id: string | null;
          changed_at: string | null;
          status: BlockStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          start_time: string;
          end_time: string;
          block_type: BlockType;
          category_id?: string | null;
          subcategory_id?: string | null;
          curriculum_task_id?: string | null;
          timer_mode?: TimerMode;
          pomodoro_count?: number | null;
          memo?: string | null;
          reminder_minutes?: number | null;
          is_ghost?: boolean;
          original_block_id?: string | null;
          changed_at?: string | null;
          status?: BlockStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          start_time?: string;
          end_time?: string;
          block_type?: BlockType;
          category_id?: string | null;
          subcategory_id?: string | null;
          curriculum_task_id?: string | null;
          timer_mode?: TimerMode;
          pomodoro_count?: number | null;
          memo?: string | null;
          reminder_minutes?: number | null;
          is_ghost?: boolean;
          original_block_id?: string | null;
          changed_at?: string | null;
          status?: BlockStatus;
          updated_at?: string;
        };
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      // 7. activity_logs ⭐ 実行記録
      // -----------------------------------------------------------------------
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          block_id: string;
          category_id: string | null;
          subcategory_id: string | null;
          curriculum_task_id: string | null;
          timer_mode: TimerMode;
          started_at: string;
          completed_at: string | null;
          pomodoro_index: number | null;
          focus_duration_sec: number | null;
          break_duration_sec: number | null;
          planned_duration_sec: number | null;
          actual_duration_sec: number | null;
          status: LogStatus;
          interrupted_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          block_id: string;
          category_id?: string | null;
          subcategory_id?: string | null;
          curriculum_task_id?: string | null;
          timer_mode: TimerMode;
          started_at?: string;
          completed_at?: string | null;
          pomodoro_index?: number | null;
          focus_duration_sec?: number | null;
          break_duration_sec?: number | null;
          planned_duration_sec?: number | null;
          actual_duration_sec?: number | null;
          status?: LogStatus;
          interrupted_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          block_id?: string;
          category_id?: string | null;
          subcategory_id?: string | null;
          curriculum_task_id?: string | null;
          timer_mode?: TimerMode;
          started_at?: string;
          completed_at?: string | null;
          pomodoro_index?: number | null;
          focus_duration_sec?: number | null;
          break_duration_sec?: number | null;
          planned_duration_sec?: number | null;
          actual_duration_sec?: number | null;
          status?: LogStatus;
          interrupted_reason?: string | null;
        };
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      // 8. weekly_plans
      // -----------------------------------------------------------------------
      weekly_plans: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          status: WeeklyPlanStatus;
          ai_suggestions: Json | null;
          accepted_suggestions: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          status?: WeeklyPlanStatus;
          ai_suggestions?: Json | null;
          accepted_suggestions?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start_date?: string;
          status?: WeeklyPlanStatus;
          ai_suggestions?: Json | null;
          accepted_suggestions?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      // 9. weekly_reports
      // -----------------------------------------------------------------------
      weekly_reports: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          total_planned_pomodoros: number;
          total_actual_pomodoros: number;
          total_planned_minutes: number;
          total_actual_minutes: number;
          avg_fill_rate: number;
          plan_adherence_rate: number;
          plan_change_rate: number;
          focus_score: number;
          ai_report_text: string | null;
          ai_report_json: Json | null;
          category_breakdown: Json | null;
          subcategory_breakdown: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          total_planned_pomodoros?: number;
          total_actual_pomodoros?: number;
          total_planned_minutes?: number;
          total_actual_minutes?: number;
          avg_fill_rate?: number;
          plan_adherence_rate?: number;
          plan_change_rate?: number;
          focus_score?: number;
          ai_report_text?: string | null;
          ai_report_json?: Json | null;
          category_breakdown?: Json | null;
          subcategory_breakdown?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start_date?: string;
          total_planned_pomodoros?: number;
          total_actual_pomodoros?: number;
          total_planned_minutes?: number;
          total_actual_minutes?: number;
          avg_fill_rate?: number;
          plan_adherence_rate?: number;
          plan_change_rate?: number;
          focus_score?: number;
          ai_report_text?: string | null;
          ai_report_json?: Json | null;
          category_breakdown?: Json | null;
          subcategory_breakdown?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      // 10. notification_schedules
      // -----------------------------------------------------------------------
      notification_schedules: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          block_id: string | null;
          scheduled_at: string;
          title: string;
          body: string | null;
          is_sent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          block_id?: string | null;
          scheduled_at: string;
          title: string;
          body?: string | null;
          is_sent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          block_id?: string | null;
          scheduled_at?: string;
          title?: string;
          body?: string | null;
          is_sent?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      get_activity_minutes: {
        Args: { p_user_id: string; p_date: string };
        Returns: number;
      };
      get_available_minutes: {
        Args: { p_user_id: string; p_date: string };
        Returns: number;
      };
      get_fill_rate: {
        Args: { p_user_id: string; p_date: string };
        Returns: number;
      };
      get_week_fill_rates: {
        Args: { p_user_id: string; p_week_start: string };
        Returns: {
          day: string;
          fill_rate: number;
          activity_min: number;
          available_min: number;
        }[];
      };
    };

    Enums: {
      category_type:      CategoryType;
      block_type:         BlockType;
      timer_mode:         TimerMode;
      block_status:       BlockStatus;
      log_status:         LogStatus;
      weekly_plan_status: WeeklyPlanStatus;
      notification_type:  NotificationType;
    };
  };
}

// ---------------------------------------------------------------------------
// テーブル行型エイリアス
// ---------------------------------------------------------------------------

export type UserSettingsRow        = Database['public']['Tables']['user_settings']['Row'];
export type DailyScheduleRow       = Database['public']['Tables']['daily_schedules']['Row'];
export type ActivityCategoryRow    = Database['public']['Tables']['activity_categories']['Row'];
export type SubCategoryRow         = Database['public']['Tables']['sub_categories']['Row'];
export type CurriculumTaskRow      = Database['public']['Tables']['curriculum_tasks']['Row'];
export type CalendarBlockRow       = Database['public']['Tables']['calendar_blocks']['Row'];
export type ActivityLogRow         = Database['public']['Tables']['activity_logs']['Row'];
export type WeeklyPlanRow          = Database['public']['Tables']['weekly_plans']['Row'];
export type WeeklyReportRow        = Database['public']['Tables']['weekly_reports']['Row'];
export type NotificationScheduleRow = Database['public']['Tables']['notification_schedules']['Row'];

// Insert 型エイリアス
export type UserSettingsInsert        = Database['public']['Tables']['user_settings']['Insert'];
export type DailyScheduleInsert       = Database['public']['Tables']['daily_schedules']['Insert'];
export type ActivityCategoryInsert    = Database['public']['Tables']['activity_categories']['Insert'];
export type SubCategoryInsert         = Database['public']['Tables']['sub_categories']['Insert'];
export type CurriculumTaskInsert      = Database['public']['Tables']['curriculum_tasks']['Insert'];
export type CalendarBlockInsert       = Database['public']['Tables']['calendar_blocks']['Insert'];
export type ActivityLogInsert         = Database['public']['Tables']['activity_logs']['Insert'];
export type WeeklyPlanInsert          = Database['public']['Tables']['weekly_plans']['Insert'];
export type WeeklyReportInsert        = Database['public']['Tables']['weekly_reports']['Insert'];
export type NotificationScheduleInsert = Database['public']['Tables']['notification_schedules']['Insert'];

// Update 型エイリアス
export type UserSettingsUpdate        = Database['public']['Tables']['user_settings']['Update'];
export type DailyScheduleUpdate       = Database['public']['Tables']['daily_schedules']['Update'];
export type ActivityCategoryUpdate    = Database['public']['Tables']['activity_categories']['Update'];
export type SubCategoryUpdate         = Database['public']['Tables']['sub_categories']['Update'];
export type CurriculumTaskUpdate      = Database['public']['Tables']['curriculum_tasks']['Update'];
export type CalendarBlockUpdate       = Database['public']['Tables']['calendar_blocks']['Update'];
export type ActivityLogUpdate         = Database['public']['Tables']['activity_logs']['Update'];
export type WeeklyPlanUpdate          = Database['public']['Tables']['weekly_plans']['Update'];
export type WeeklyReportUpdate        = Database['public']['Tables']['weekly_reports']['Update'];
export type NotificationScheduleUpdate = Database['public']['Tables']['notification_schedules']['Update'];

// ---------------------------------------------------------------------------
// JOIN 結合型
// ---------------------------------------------------------------------------

export type CategoryWithSubcategories = ActivityCategoryRow & {
  sub_categories: SubCategoryRow[];
};

export type CategoryWithFull = ActivityCategoryRow & {
  sub_categories: SubCategoryRow[];
  curriculum_tasks: CurriculumTaskRow[];
};

/** calendar_blocks に activity_categories / sub_categories / curriculum_tasks を JOIN した型 */
export type BlockWithDetails = CalendarBlockRow & {
  activity_categories: Pick<ActivityCategoryRow, 'id' | 'name' | 'color' | 'icon' | 'type'> | null;
  sub_categories:      Pick<SubCategoryRow, 'id' | 'name' | 'icon'> | null;
  curriculum_tasks:    Pick<CurriculumTaskRow, 'id' | 'name'> | null;
};

export type LogWithDetails = ActivityLogRow & {
  activity_categories: ActivityCategoryRow | null;
  sub_categories:      SubCategoryRow | null;
  curriculum_tasks:    CurriculumTaskRow | null;
  calendar_blocks:     CalendarBlockRow | null;
};

export type WeeklyReportWithPlan = WeeklyReportRow & {
  weekly_plans: WeeklyPlanRow | null;
};

// ---------------------------------------------------------------------------
// JSONB フィールド内部型
// ---------------------------------------------------------------------------

export interface CategoryBreakdownItem {
  category_id:       string;
  category_name:     string;
  category_type:     CategoryType;
  category_color:    string;
  planned_pomodoros: number;
  actual_pomodoros:  number;
  planned_minutes:   number;
  actual_minutes:    number;
  fill_rate:         number;
}

export interface SubcategoryBreakdownItem {
  subcategory_id:   string;
  subcategory_name: string;
  category_id:      string;
  planned_minutes:  number;
  actual_minutes:   number;
  pomodoro_count:   number;
}

export interface AiSuggestion {
  id:                      string;
  type:                    'increase_study' | 'reduce_overload' | 'rebalance_categories' | 'improve_schedule' | 'general';
  title:                   string;
  description:             string;
  category_id?:            string;
  suggested_delta_minutes?: number;
  priority:                'high' | 'medium' | 'low';
}

export interface AiReportJson {
  summary:    string;
  strengths:  string[];
  improvements: string[];
  focus_analysis: {
    score:                number;
    interruption_count:   number;
    avg_session_minutes:  number;
  };
  adherence_analysis: {
    rate:                      number;
    ghost_count:               number;
    common_change_patterns:    string[];
  };
  next_week_suggestions: AiSuggestion[];
}

// ---------------------------------------------------------------------------
// UI 向けビュー型
// ---------------------------------------------------------------------------

export interface DailySummary {
  date:               string;
  wakeTime:           string;
  sleepTime:          string;
  activeMinutes:      number;
  scheduledMinutes:   number;
  fillRate:           number;
  completedPomodoros: number;
  plannedPomodoros:   number;
  blocksByType:       Record<BlockType, number>;
}
