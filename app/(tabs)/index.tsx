import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { format, addDays, parseISO, getDay, getISOWeek } from 'date-fns';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/Colors';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useUserSettingsStore } from '@/stores/useUserSettingsStore';
import { supabase } from '@/lib/supabase';
import type { BlockWithDetails } from '@/types/database';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'おはようございます';
  if (h < 18) return 'こんにちは';
  return 'こんばんは';
}

function formatDateFull(dateStr: string): string {
  const d = parseISO(dateStr);
  const week = getISOWeek(d);
  return `${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）第${week}週`;
}

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
}

function getWeekStart(dateStr: string, weekStartDay: number): string {
  const d = parseISO(dateStr);
  const diff = (getDay(d) - weekStartDay + 7) % 7;
  return format(addDays(d, -diff), 'yyyy-MM-dd');
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return `rgba(148,163,184,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// ProgressRing — SVG なしの純粋 React Native 実装
//
// 仕組み: 2 つの半円クリップを使って円弧を段階的に見せる
//   - right クリップ (右半分): 0%〜50% を担当
//   - left  クリップ (左半分): 50%〜100% を担当
// 各クリップの内側でリング全体を回転させ、見える弧の長さを制御する。
// ---------------------------------------------------------------------------

function ProgressRing({
  percent,
  color,
  size = 56,
  strokeWidth = 6,
}: {
  percent: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const r       = size / 2;
  const clamped = Math.min(Math.max(percent, 0), 100);
  const angle   = (clamped / 100) * 360;

  // 回転角: -180 (非表示) → 0 (全表示)
  const rightDeg = Math.min(angle, 180) - 180;
  const leftDeg  = Math.max(angle - 180, 0) - 180;

  const ringBase = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: r,
    borderWidth: strokeWidth,
    borderColor: color,
  };

  return (
    <View style={{ width: size, height: size }}>
      {/* トラック（グレー） */}
      <View style={{ ...ringBase, borderColor: '#e2e8f0' }} />

      {/* 右半分クリップ (0–180°) */}
      <View
        style={{ position: 'absolute', right: 0, width: r, height: size, overflow: 'hidden' }}
      >
        <View
          style={{
            ...ringBase,
            right: 0,
            transform: [{ rotate: `${rightDeg}deg` }],
          }}
        />
      </View>

      {/* 左半分クリップ (180–360°) */}
      <View
        style={{ position: 'absolute', left: 0, width: r, height: size, overflow: 'hidden' }}
      >
        <View
          style={{
            ...ringBase,
            left: 0,
            transform: [{ rotate: `${leftDeg}deg` }],
          }}
        />
      </View>

      {/* 中央テキスト */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color }}>{clamped}%</Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ホーム画面
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const router   = useRouter();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const {
    fetchBlocksForDate,
    getBlocksForDate,
    getScheduledMinutes,
    setSelectedDate,
    setViewMode,
  } = useCalendarStore();

  const { getEffectiveSchedule, getAvailableMinutes, settings } = useUserSettingsStore();

  const weekStartDay = settings?.week_start_day ?? 1;

  // ── 充填率 ──────────────────────────────────────────────────────────────

  const availableMin = getAvailableMinutes(todayStr);
  const scheduledMin = getScheduledMinutes(todayStr);
  const fillRate     = availableMin > 0
    ? Math.min(Math.round((scheduledMin / availableMin) * 100), 100)
    : 0;
  const remainMin    = Math.max(availableMin - scheduledMin, 0);

  // ── 今日のブロック ───────────────────────────────────────────────────────

  const blocks = getBlocksForDate(todayStr);

  // ── 週間ポモドーロ進捗 ───────────────────────────────────────────────────

  const [weekPomodoros, setWeekPomodoros] = useState({ actual: 0, target: 0 });

  // ── 連続日数 + アクティブ日付セット ─────────────────────────────────────

  const [streak, setStreak]         = useState(0);
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());

  // ── 週の開始/終了 ────────────────────────────────────────────────────────

  const weekStart = useMemo(
    () => getWeekStart(todayStr, weekStartDay),
    [todayStr, weekStartDay],
  );
  const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');

  // ── 次の未完了ブロック ───────────────────────────────────────────────────

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const nextBlock = useMemo<BlockWithDetails | undefined>(() => {
    const inProgress = blocks.find((b) => b.status === 'in_progress');
    if (inProgress) return inProgress;
    return blocks.find(
      (b) => b.status === 'planned' && toMin(b.start_time) >= nowMin,
    );
  }, [blocks, nowMin]);

  const nextBlockId = nextBlock?.id;

  // ── フェッチ ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchBlocksForDate(todayStr);
  }, [todayStr]);

  useEffect(() => {
    void fetchWeeklyPomodoros();
    void fetchStreakData();
  }, [weekStart]);

  async function fetchWeeklyPomodoros() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: logs }, { data: planned }] = await Promise.all([
        supabase
          .from('activity_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('timer_mode', 'pomodoro')
          .eq('status', 'completed')
          .gte('started_at', `${weekStart}T00:00:00`)
          .lte('started_at', `${weekEnd}T23:59:59`),

        supabase
          .from('calendar_blocks')
          .select('pomodoro_count')
          .eq('user_id', user.id)
          .eq('timer_mode', 'pomodoro')
          .eq('is_ghost', false)
          .neq('status', 'skipped')
          .gte('date', weekStart)
          .lte('date', weekEnd),
      ]);

      const actual = logs?.length ?? 0;
      const target = planned?.reduce(
        (sum, b) => sum + (b.pomodoro_count ?? 0),
        0,
      ) ?? 0;

      setWeekPomodoros({ actual, target });
    } catch {
      /* ignore */
    }
  }

  async function fetchStreakData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const thirtyDaysAgo = format(addDays(parseISO(todayStr), -30), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('activity_logs')
        .select('started_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('started_at', `${thirtyDaysAgo}T00:00:00`)
        .order('started_at', { ascending: false });

      if (!data || data.length === 0) {
        setStreak(0);
        setActiveDates(new Set());
        return;
      }

      const dates = new Set(data.map((l) => l.started_at.slice(0, 10)));
      setActiveDates(dates);

      // 今日から遡って連続日数を算出
      let count = 0;
      let check = todayStr;
      while (dates.has(check)) {
        count++;
        check = format(addDays(parseISO(check), -1), 'yyyy-MM-dd');
      }

      // 今日がまだ 0 なら昨日から遡る
      if (count === 0) {
        check = format(addDays(parseISO(todayStr), -1), 'yyyy-MM-dd');
        while (dates.has(check)) {
          count++;
          check = format(addDays(parseISO(check), -1), 'yyyy-MM-dd');
        }
      }

      setStreak(count);
    } catch {
      /* ignore */
    }
  }

  // ── 派生値 ───────────────────────────────────────────────────────────────

  const ringColor    = fillRate >= 100 ? '#059669' : fillRate >= 70 ? '#d97706' : '#2563eb';
  const progressRate = weekPomodoros.target > 0
    ? Math.min(weekPomodoros.actual / weekPomodoros.target, 1)
    : 0;

  // 過去 7 日のドット（直近7日、今日含む）
  const last7Days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        format(addDays(parseISO(todayStr), i - 6), 'yyyy-MM-dd'),
      ),
    [todayStr],
  );

  // ── ナビゲーション ────────────────────────────────────────────────────────

  function goToCalendar() {
    setSelectedDate(todayStr);
    setViewMode('day');
    router.push('/(tabs)/calendar');
  }

  function goToTimer() {
    router.push('/(tabs)/timer');
  }

  // ── レンダリング ──────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. フォーカスモードバナー ── */}
      <View style={styles.focusBanner}>
        <Text style={styles.focusIcon}>🔕</Text>
        <Text style={styles.focusLabel}>フォーカスモード ON</Text>
        <TouchableOpacity style={styles.focusOffBtn} activeOpacity={0.8}>
          <Text style={styles.focusOffText}>OFF</Text>
        </TouchableOpacity>
      </View>

      {/* ── 2. あいさつ + 日付 ── */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>{getGreeting()}</Text>
        <Text style={styles.dateText}>{formatDateFull(todayStr)}</Text>
      </View>

      {/* ── 3. 充填率リング ── */}
      <View style={styles.card}>
        <View style={styles.fillRow}>
          <ProgressRing percent={fillRate} color={ringColor} size={64} strokeWidth={7} />

          <View style={styles.fillInfo}>
            <Text style={styles.fillTitle}>今日の充填率</Text>
            {fillRate >= 100 ? (
              <Text style={[styles.fillStatus, { color: '#059669' }]}>
                ✓ 完璧な計画です！
              </Text>
            ) : (
              <Text style={styles.fillStatus}>
                あと
                {remainMin >= 60
                  ? `${Math.floor(remainMin / 60)}h${remainMin % 60 > 0 ? `${remainMin % 60}m` : ''}`
                  : `${remainMin}m`}{' '}
                未計画
              </Text>
            )}
            {fillRate < 100 && (
              <TouchableOpacity onPress={goToCalendar}>
                <Text style={styles.fillLink}>カレンダーで埋める →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── 4. 今日の予定一覧 ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>今日の予定</Text>
        <Text style={styles.sectionBadge}>{blocks.length}件</Text>
      </View>

      <View style={styles.card}>
        {blocks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>今日の予定はありません</Text>
            <TouchableOpacity onPress={goToCalendar}>
              <Text style={styles.fillLink}>予定を追加する →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.blockList}>
            {blocks.map((block, idx) => {
              const color   = block.activity_categories?.color ?? '#94a3b8';
              const name    = block.activity_categories?.name  ?? 'ブロック';
              const bgColor = hexToRgba(color, 0.07);
              const isNext  = block.id === nextBlockId && block.status === 'planned';

              return (
                <TouchableOpacity
                  key={block.id}
                  style={[
                    styles.blockRow,
                    { backgroundColor: bgColor },
                    idx > 0 && styles.blockRowBorder,
                  ]}
                  onPress={goToTimer}
                  activeOpacity={0.7}
                >
                  {/* カテゴリ色バー */}
                  <View style={[styles.blockBar, { backgroundColor: color }]} />

                  {/* コンテンツ */}
                  <View style={styles.blockContent}>
                    <View style={styles.blockTitleRow}>
                      <Text
                        style={[
                          styles.blockName,
                          { color },
                          block.status === 'completed' && styles.blockNameDone,
                        ]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      <Text style={styles.blockTime}>
                        {formatTimeRange(block.start_time, block.end_time)}
                      </Text>
                    </View>

                    {block.sub_categories && (
                      <Text style={styles.blockSub} numberOfLines={1}>
                        {block.sub_categories.icon} {block.sub_categories.name}
                      </Text>
                    )}

                    {block.timer_mode === 'pomodoro' && block.pomodoro_count && (
                      <Text style={styles.blockMeta}>
                        🍅 × {block.pomodoro_count}
                      </Text>
                    )}
                  </View>

                  {/* ステータスバッジ */}
                  {block.status === 'completed' && (
                    <View style={styles.badgeDone}>
                      <Text style={styles.badgeDoneText}>済</Text>
                    </View>
                  )}
                  {block.status === 'in_progress' && (
                    <View style={styles.badgeNext}>
                      <Text style={styles.badgeNextText}>進行中</Text>
                    </View>
                  )}
                  {isNext && (
                    <View style={styles.badgeNext}>
                      <Text style={styles.badgeNextText}>次</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* ── 5. 週間学習進捗 ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>今週の進捗</Text>
      </View>

      <View style={styles.card}>
        {/* 3 つのメトリクスボックス */}
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={[styles.metricValue, { color: '#059669' }]}>
              {weekPomodoros.actual}
            </Text>
            <Text style={styles.metricLabel}>完了 🍅</Text>
          </View>

          <View style={[styles.metricBox, styles.metricMid]}>
            <Text style={styles.metricValue}>{weekPomodoros.target}</Text>
            <Text style={styles.metricLabel}>目標</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={[styles.metricValue, { color: '#2563eb' }]}>
              {weekPomodoros.target > 0
                ? `${Math.round(progressRate * 100)}%`
                : '---'}
            </Text>
            <Text style={styles.metricLabel}>達成率</Text>
          </View>
        </View>

        {/* プログレスバー */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(progressRate * 100)}%` as `${number}%` },
            ]}
          />
        </View>

        <Text style={styles.progressLabel}>
          {weekPomodoros.target > 0
            ? `${weekPomodoros.actual} / ${weekPomodoros.target} ポモドーロ完了`
            : 'カテゴリの週次目標を設定すると進捗が表示されます'}
        </Text>
      </View>

      {/* ── 6. 次のセッションを開始 ── */}
      <TouchableOpacity
        style={[styles.startButton, !nextBlock && styles.startButtonDone]}
        onPress={() => nextBlock && goToTimer()}
        activeOpacity={nextBlock ? 0.85 : 1}
      >
        <Text style={styles.startButtonText}>
          {nextBlock ? '▶ 次のセッションを開始' : '✓ 今日のセッションは完了'}
        </Text>
        {nextBlock && (
          <Text style={styles.startButtonSub}>
            {nextBlock.activity_categories?.name ?? 'ブロック'} ·{' '}
            {formatTimeRange(nextBlock.start_time, nextBlock.end_time)}
          </Text>
        )}
      </TouchableOpacity>

      {/* ── 7. 連続学習日数 ── */}
      <View style={styles.card}>
        <View style={styles.streakRow}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakValue}>連続学習 {streak}日</Text>
            <Text style={styles.streakSub}>今日も継続しよう！</Text>
          </View>
        </View>

        {/* 過去 7 日ドット */}
        <View style={styles.dotRow}>
          {last7Days.map((date) => {
            const isToday  = date === todayStr;
            const hasActivity = activeDates.has(date);

            return (
              <View key={date} style={styles.dotCol}>
                <View
                  style={[
                    styles.dot,
                    hasActivity && styles.dotActive,
                    isToday && styles.dotToday,
                  ]}
                />
                <Text style={[styles.dotLabel, isToday && styles.dotLabelToday]}>
                  {DAYS_JA[parseISO(date).getDay()]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 8,
  },

  // ── フォーカスバナー ──────────────────────────────────────────────────────
  focusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#c7d2fe',
  },
  focusIcon: {
    fontSize: 16,
  },
  focusLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#4338ca',
  },
  focusOffBtn: {
    backgroundColor: '#4338ca',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  focusOffText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // ── あいさつ ──────────────────────────────────────────────────────────────
  greetingSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // ── カード共通 ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // ── セクションヘッダー ────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },

  // ── 充填率 ────────────────────────────────────────────────────────────────
  fillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  fillInfo: {
    flex: 1,
    gap: 3,
  },
  fillTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  fillStatus: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  fillLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 2,
  },

  // ── 予定一覧 ──────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  blockList: {
    // カード内リスト（ブロック間は細ボーダー）
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
    minHeight: 52,
  },
  blockRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  blockBar: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: 10,
    marginLeft: 12,
    borderRadius: 2,
  },
  blockContent: {
    flex: 1,
    gap: 2,
  },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  blockNameDone: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  blockTime: {
    fontSize: 12,
    color: COLORS.textMuted,
    flexShrink: 0,
  },
  blockSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  blockMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // バッジ
  badgeDone: {
    backgroundColor: 'rgba(5,150,105,0.12)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 6,
  },
  badgeDoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  badgeNext: {
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 6,
  },
  badgeNextText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },

  // ── 週間進捗 ──────────────────────────────────────────────────────────────
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 0,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  progressTrack: {
    height: 6,
    backgroundColor: COLORS.surfaceElevated,
    marginHorizontal: 16,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginVertical: 10,
  },

  // ── 開始ボタン ────────────────────────────────────────────────────────────
  startButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  startButtonDone: {
    backgroundColor: '#059669',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  startButtonSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  // ── ストリーク ────────────────────────────────────────────────────────────
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    paddingBottom: 12,
  },
  streakEmoji: {
    fontSize: 28,
  },
  streakValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  streakSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dotCol: {
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: 'rgba(37,99,235,0.15)',
    borderColor: '#2563eb',
  },
  dotToday: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  dotLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  dotLabelToday: {
    color: '#2563eb',
    fontWeight: '700',
  },
});
