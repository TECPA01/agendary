-- =============================================================================
-- AGENDARY 初期スキーマ
-- CLAUDE.md の全10テーブル設計に基づく
-- =============================================================================

-- UUID 拡張を有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Enum 型定義
-- =============================================================================

CREATE TYPE category_type     AS ENUM ('study', 'exercise', 'life');
CREATE TYPE block_type        AS ENUM ('study', 'exercise', 'life', 'rest');
CREATE TYPE timer_mode        AS ENUM ('pomodoro', 'countdown');
CREATE TYPE block_status      AS ENUM ('planned', 'in_progress', 'completed', 'skipped');
CREATE TYPE log_status        AS ENUM ('in_progress', 'completed', 'interrupted');
CREATE TYPE weekly_plan_status AS ENUM ('draft', 'active', 'completed');
CREATE TYPE notification_type  AS ENUM (
  'session_reminder',
  'weekly_plan_reminder',
  'weekly_report_ready',
  'streak_reminder'
);

-- =============================================================================
-- updated_at 自動更新トリガー関数
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- テーブル 1: user_settings
-- ユーザーごとの基本設定。1ユーザー1レコード。
-- =============================================================================

CREATE TABLE user_settings (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_wake_time         TIME NOT NULL DEFAULT '07:00:00',
  default_sleep_time        TIME NOT NULL DEFAULT '23:00:00',
  week_start_day            SMALLINT NOT NULL DEFAULT 1
                              CHECK (week_start_day BETWEEN 0 AND 6),
  pomodoro_focus_minutes    SMALLINT NOT NULL DEFAULT 25
                              CHECK (pomodoro_focus_minutes > 0),
  pomodoro_short_break      SMALLINT NOT NULL DEFAULT 5
                              CHECK (pomodoro_short_break > 0),
  pomodoro_long_break       SMALLINT NOT NULL DEFAULT 15
                              CHECK (pomodoro_long_break > 0),
  pomodoro_long_break_after SMALLINT NOT NULL DEFAULT 4
                              CHECK (pomodoro_long_break_after > 0),
  default_reminder_minutes  SMALLINT,
  focus_mode_auto_on        BOOLEAN NOT NULL DEFAULT FALSE,
  focus_allow_phone_calls   BOOLEAN NOT NULL DEFAULT TRUE,
  lock_mode_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  lock_mode_auto_on         BOOLEAN NOT NULL DEFAULT FALSE,
  lock_allow_emergency      BOOLEAN NOT NULL DEFAULT TRUE,
  lock_during_break         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_settings_user_id_unique UNIQUE (user_id),
  CONSTRAINT sleep_after_wake CHECK (default_sleep_time > default_wake_time)
);

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- テーブル 2: daily_schedules
-- 曜日別の起床就寝オーバーライド。null = デフォルト使用。
-- =============================================================================

CREATE TABLE daily_schedules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  wake_time    TIME,
  sleep_time   TIME,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT daily_schedules_user_day_unique UNIQUE (user_id, day_of_week),
  CONSTRAINT daily_sleep_after_wake CHECK (
    wake_time IS NULL OR sleep_time IS NULL OR sleep_time > wake_time
  )
);

CREATE TRIGGER daily_schedules_updated_at
  BEFORE UPDATE ON daily_schedules
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- テーブル 3: activity_categories
-- 学習科目・運動種目・生活ルーティンを統合管理。
-- =============================================================================

CREATE TABLE activity_categories (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type           category_type NOT NULL,
  name           TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  color          TEXT NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  icon           TEXT,
  sort_order     SMALLINT NOT NULL DEFAULT 0,
  weekly_target  SMALLINT CHECK (weekly_target > 0),
  has_curriculum BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER activity_categories_updated_at
  BEFORE UPDATE ON activity_categories
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_activity_categories_user_id
  ON activity_categories(user_id);
CREATE INDEX idx_activity_categories_user_type
  ON activity_categories(user_id, type)
  WHERE is_archived = FALSE;

-- =============================================================================
-- テーブル 4: sub_categories
-- カテゴリの内訳。全項目にON/OFFトグル。最低1つON必須。
-- =============================================================================

CREATE TABLE sub_categories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id  UUID NOT NULL REFERENCES activity_categories(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  icon         TEXT,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER sub_categories_updated_at
  BEFORE UPDATE ON sub_categories
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_sub_categories_category_id
  ON sub_categories(category_id);

-- =============================================================================
-- テーブル 5: curriculum_tasks
-- 事前登録タスク（オプション機能）。
-- =============================================================================

CREATE TABLE curriculum_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id     UUID NOT NULL REFERENCES activity_categories(id) ON DELETE CASCADE,
  subcategory_id  UUID REFERENCES sub_categories(id) ON DELETE SET NULL,
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_date  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER curriculum_tasks_updated_at
  BEFORE UPDATE ON curriculum_tasks
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_curriculum_tasks_category_id
  ON curriculum_tasks(category_id);
CREATE INDEX idx_curriculum_tasks_is_completed
  ON curriculum_tasks(category_id, is_completed);

-- =============================================================================
-- テーブル 6: calendar_blocks ⭐ 中核テーブル
-- カレンダーの予定ブロック。充填率計算元。
-- =============================================================================

CREATE TABLE calendar_blocks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  block_type          block_type NOT NULL,
  category_id         UUID REFERENCES activity_categories(id) ON DELETE SET NULL,
  subcategory_id      UUID REFERENCES sub_categories(id) ON DELETE SET NULL,
  curriculum_task_id  UUID REFERENCES curriculum_tasks(id) ON DELETE SET NULL,
  timer_mode          timer_mode NOT NULL DEFAULT 'pomodoro',
  pomodoro_count      SMALLINT CHECK (pomodoro_count > 0),
  memo                TEXT CHECK (char_length(memo) <= 500),
  reminder_minutes    SMALLINT CHECK (reminder_minutes > 0),
  is_ghost            BOOLEAN NOT NULL DEFAULT FALSE,
  original_block_id   UUID REFERENCES calendar_blocks(id) ON DELETE SET NULL,
  changed_at          TIMESTAMPTZ,
  status              block_status NOT NULL DEFAULT 'planned',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT end_after_start CHECK (end_time > start_time),
  CONSTRAINT pomodoro_mode_count CHECK (
    timer_mode != 'pomodoro' OR pomodoro_count IS NOT NULL
  ),
  CONSTRAINT ghost_has_original CHECK (
    is_ghost = FALSE OR original_block_id IS NOT NULL
  ),
  CONSTRAINT ghost_changed_at CHECK (
    is_ghost = FALSE OR changed_at IS NOT NULL
  )
);

CREATE TRIGGER calendar_blocks_updated_at
  BEFORE UPDATE ON calendar_blocks
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_calendar_blocks_user_date
  ON calendar_blocks(user_id, date);
CREATE INDEX idx_calendar_blocks_user_date_ghost
  ON calendar_blocks(user_id, date, is_ghost)
  WHERE status != 'skipped';
CREATE INDEX idx_calendar_blocks_status
  ON calendar_blocks(user_id, status)
  WHERE status = 'in_progress';
CREATE INDEX idx_calendar_blocks_original
  ON calendar_blocks(original_block_id)
  WHERE original_block_id IS NOT NULL;

-- =============================================================================
-- テーブル 7: activity_logs ⭐ 実行記録
-- ポモドーロ1セット or カウントダウン1実行の記録。
-- =============================================================================

CREATE TABLE activity_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_id            UUID NOT NULL REFERENCES calendar_blocks(id) ON DELETE RESTRICT,
  -- 非正規化（ブロック削除後もログ保持のために冗長に持つ）
  category_id         UUID REFERENCES activity_categories(id) ON DELETE SET NULL,
  subcategory_id      UUID REFERENCES sub_categories(id) ON DELETE SET NULL,
  curriculum_task_id  UUID REFERENCES curriculum_tasks(id) ON DELETE SET NULL,
  timer_mode          timer_mode NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  pomodoro_index      SMALLINT CHECK (pomodoro_index > 0),   -- ポモドーロ時: 何セット目（1始まり）
  focus_duration_sec  INT CHECK (focus_duration_sec >= 0),   -- 集中フェーズ実績秒数
  break_duration_sec  INT CHECK (break_duration_sec >= 0),   -- 休憩フェーズ実績秒数
  planned_duration_sec INT CHECK (planned_duration_sec > 0), -- カウントダウン: 計画秒数
  actual_duration_sec  INT CHECK (actual_duration_sec >= 0), -- カウントダウン: 実績秒数
  status              log_status NOT NULL DEFAULT 'in_progress',
  interrupted_reason  TEXT,                                  -- "emergency_unlock", "app_switch" 等
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT log_completed_at_check CHECK (
    status = 'in_progress' OR completed_at IS NOT NULL
  ),
  CONSTRAINT pomodoro_log_fields CHECK (
    timer_mode != 'pomodoro' OR pomodoro_index IS NOT NULL
  ),
  CONSTRAINT countdown_log_fields CHECK (
    timer_mode != 'countdown' OR planned_duration_sec IS NOT NULL
  ),
  CONSTRAINT interrupted_has_reason CHECK (
    status != 'interrupted' OR interrupted_reason IS NOT NULL
  )
);

CREATE INDEX idx_activity_logs_user_id
  ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_block_id
  ON activity_logs(block_id);
CREATE INDEX idx_activity_logs_user_started
  ON activity_logs(user_id, started_at DESC);
CREATE INDEX idx_activity_logs_category
  ON activity_logs(user_id, category_id, started_at DESC);
CREATE INDEX idx_activity_logs_status
  ON activity_logs(user_id, status)
  WHERE status = 'in_progress';

-- =============================================================================
-- テーブル 8: weekly_plans
-- 週間プランのメタデータ。AI提案の保存先。
-- =============================================================================

CREATE TABLE weekly_plans (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date      DATE NOT NULL,
  status               weekly_plan_status NOT NULL DEFAULT 'draft',
  ai_suggestions       JSONB,
  accepted_suggestions JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT weekly_plans_user_week_unique UNIQUE (user_id, week_start_date)
);

CREATE TRIGGER weekly_plans_updated_at
  BEFORE UPDATE ON weekly_plans
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_weekly_plans_user_week
  ON weekly_plans(user_id, week_start_date DESC);

-- =============================================================================
-- テーブル 9: weekly_reports
-- 週次レポート（Check）。AI分析結果と集計値。
-- =============================================================================

CREATE TABLE weekly_reports (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date       DATE NOT NULL,
  total_planned_pomodoros SMALLINT NOT NULL DEFAULT 0,
  total_actual_pomodoros  SMALLINT NOT NULL DEFAULT 0,
  total_planned_minutes   INT NOT NULL DEFAULT 0,
  total_actual_minutes    INT NOT NULL DEFAULT 0,
  avg_fill_rate           NUMERIC(5,2) NOT NULL DEFAULT 0
                            CHECK (avg_fill_rate BETWEEN 0 AND 100),
  plan_adherence_rate     NUMERIC(5,2) NOT NULL DEFAULT 0
                            CHECK (plan_adherence_rate BETWEEN 0 AND 100),
  plan_change_rate        NUMERIC(5,2) NOT NULL DEFAULT 0
                            CHECK (plan_change_rate BETWEEN 0 AND 100),
  focus_score             SMALLINT NOT NULL DEFAULT 0
                            CHECK (focus_score BETWEEN 0 AND 100),
  ai_report_text          TEXT,
  ai_report_json          JSONB,
  category_breakdown      JSONB,
  subcategory_breakdown   JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT weekly_reports_user_week_unique UNIQUE (user_id, week_start_date)
);

CREATE TRIGGER weekly_reports_updated_at
  BEFORE UPDATE ON weekly_reports
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_weekly_reports_user_week
  ON weekly_reports(user_id, week_start_date DESC);

-- =============================================================================
-- テーブル 10: notification_schedules
-- ローカル通知のスケジュール管理。
-- =============================================================================

CREATE TABLE notification_schedules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         notification_type NOT NULL,
  block_id     UUID REFERENCES calendar_blocks(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  body         TEXT CHECK (char_length(body) <= 300),
  is_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER notification_schedules_updated_at
  BEFORE UPDATE ON notification_schedules
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE INDEX idx_notification_schedules_user_scheduled
  ON notification_schedules(user_id, scheduled_at)
  WHERE is_sent = FALSE;
CREATE INDEX idx_notification_schedules_block
  ON notification_schedules(block_id)
  WHERE block_id IS NOT NULL;

-- =============================================================================
-- ヘルパー関数
-- =============================================================================

-- -----------------------------------------------------------------------------
-- get_activity_minutes(p_user_id, p_date)
-- 指定日のアクティブブロック合計時間（分）を返す
-- is_ghost=false かつ status!='skipped' のブロックのみ集計
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_activity_minutes(
  p_user_id UUID,
  p_date    DATE
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    SUM(
      EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    )::INTEGER,
    0
  )
  FROM calendar_blocks
  WHERE user_id = p_user_id
    AND date     = p_date
    AND is_ghost = FALSE
    AND status  != 'skipped';
$$;

-- -----------------------------------------------------------------------------
-- get_available_minutes(p_user_id, p_date)
-- 指定日の活動可能時間（起床〜就寝、分）を返す
-- daily_schedules のオーバーライドを考慮する
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_available_minutes(
  p_user_id UUID,
  p_date    DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_wake_time  TIME;
  v_sleep_time TIME;
  v_dow        SMALLINT;
BEGIN
  v_dow := EXTRACT(DOW FROM p_date)::SMALLINT;

  -- daily_schedules のオーバーライドを優先、なければ user_settings のデフォルト
  SELECT
    COALESCE(ds.wake_time,  us.default_wake_time),
    COALESCE(ds.sleep_time, us.default_sleep_time)
  INTO v_wake_time, v_sleep_time
  FROM user_settings us
  LEFT JOIN daily_schedules ds
    ON ds.user_id = us.user_id AND ds.day_of_week = v_dow
  WHERE us.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(
    EXTRACT(EPOCH FROM (v_sleep_time - v_wake_time)) / 60,
    0
  )::INTEGER;
END;
$$;

-- -----------------------------------------------------------------------------
-- get_fill_rate(p_user_id, p_date)
-- 指定日の充填率（0.00〜100.00）を返す
-- 活動時間 / 活動可能時間 × 100
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_fill_rate(
  p_user_id UUID,
  p_date    DATE
)
RETURNS NUMERIC(5,2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_activity_min  INTEGER;
  v_available_min INTEGER;
BEGIN
  v_activity_min  := get_activity_minutes(p_user_id, p_date);
  v_available_min := get_available_minutes(p_user_id, p_date);

  IF v_available_min = 0 THEN
    RETURN 0.00;
  END IF;

  RETURN LEAST(
    ROUND((v_activity_min::NUMERIC / v_available_min) * 100, 2),
    100.00
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- get_week_fill_rates(p_user_id, p_week_start)
-- 週の各日の充填率を配列で返す（週次レポート集計用）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_week_fill_rates(
  p_user_id    UUID,
  p_week_start DATE
)
RETURNS TABLE (
  day         DATE,
  fill_rate   NUMERIC(5,2),
  activity_min INTEGER,
  available_min INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.day::DATE,
    get_fill_rate(p_user_id, d.day::DATE),
    get_activity_minutes(p_user_id, d.day::DATE),
    get_available_minutes(p_user_id, d.day::DATE)
  FROM generate_series(p_week_start, p_week_start + 6, INTERVAL '1 day') AS d(day);
END;
$$;

-- =============================================================================
-- Row Level Security（RLS）
-- すべてのテーブルで「自分のデータのみ参照・操作可能」を強制
-- =============================================================================

ALTER TABLE user_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_blocks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- user_settings ポリシー
-- -----------------------------------------------------------------------
CREATE POLICY "user_settings: own record only" ON user_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- daily_schedules ポリシー
-- -----------------------------------------------------------------------
CREATE POLICY "daily_schedules: own records only" ON daily_schedules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- activity_categories ポリシー
-- -----------------------------------------------------------------------
CREATE POLICY "activity_categories: own records only" ON activity_categories
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- sub_categories ポリシー
-- category_id 経由で自分のカテゴリに属するもののみ
-- -----------------------------------------------------------------------
CREATE POLICY "sub_categories: own categories only" ON sub_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM activity_categories ac
      WHERE ac.id = sub_categories.category_id
        AND ac.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activity_categories ac
      WHERE ac.id = sub_categories.category_id
        AND ac.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------
-- curriculum_tasks ポリシー
-- -----------------------------------------------------------------------
CREATE POLICY "curriculum_tasks: own categories only" ON curriculum_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM activity_categories ac
      WHERE ac.id = curriculum_tasks.category_id
        AND ac.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activity_categories ac
      WHERE ac.id = curriculum_tasks.category_id
        AND ac.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------
-- calendar_blocks ポリシー
-- -----------------------------------------------------------------------
CREATE POLICY "calendar_blocks: own records only" ON calendar_blocks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- activity_logs ポリシー
-- -----------------------------------------------------------------------
CREATE POLICY "activity_logs: own records only" ON activity_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- weekly_plans ポリシー
-- -----------------------------------------------------------------------
CREATE POLICY "weekly_plans: own records only" ON weekly_plans
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- weekly_reports ポリシー
-- -----------------------------------------------------------------------
CREATE POLICY "weekly_reports: own records only" ON weekly_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- notification_schedules ポリシー
-- -----------------------------------------------------------------------
CREATE POLICY "notification_schedules: own records only" ON notification_schedules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 新規ユーザー登録時に user_settings を自動作成するトリガー
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- コメント（ER図生成ツール向け）
-- =============================================================================

COMMENT ON TABLE user_settings          IS 'ユーザーごとの基本設定（1ユーザー1レコード）';
COMMENT ON TABLE daily_schedules        IS '曜日別の起床就寝オーバーライド';
COMMENT ON TABLE activity_categories    IS '学習科目・運動種目・生活ルーティン';
COMMENT ON TABLE sub_categories         IS 'カテゴリの内訳（ON/OFFトグル付き）';
COMMENT ON TABLE curriculum_tasks       IS '事前登録タスク（カリキュラム機能）';
COMMENT ON TABLE calendar_blocks        IS 'カレンダーの予定ブロック（中核テーブル）';
COMMENT ON TABLE activity_logs          IS 'ポモドーロ/カウントダウンの実行記録';
COMMENT ON TABLE weekly_plans           IS '週間プランメタデータ・AI提案保存先';
COMMENT ON TABLE weekly_reports         IS '週次レポート・AI分析結果・集計値';
COMMENT ON TABLE notification_schedules IS 'ローカル通知スケジュール管理';

COMMENT ON COLUMN calendar_blocks.is_ghost          IS '当日変更時の元の予定フラグ';
COMMENT ON COLUMN calendar_blocks.original_block_id IS 'ゴーストブロックの元ブロックID（自己参照）';
COMMENT ON COLUMN activity_logs.category_id         IS '非正規化（ブロック削除後もログ保持）';
COMMENT ON COLUMN activity_logs.pomodoro_index      IS '何セット目か（1始まり）';
COMMENT ON COLUMN weekly_reports.avg_fill_rate      IS '週の充填率平均（0.00〜100.00）';
COMMENT ON COLUMN weekly_reports.plan_change_rate   IS 'ゴースト発生率（0.00〜100.00）';
