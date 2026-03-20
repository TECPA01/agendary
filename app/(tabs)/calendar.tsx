import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { format, addDays, addWeeks, subWeeks, parseISO, getDay } from 'date-fns';
import { COLORS } from '@/constants/Colors';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useUserSettingsStore } from '@/stores/useUserSettingsStore';
import { FillMeter } from '@/components/calendar/FillMeter';
import { SleepZone } from '@/components/calendar/SleepZone';
import { TimeBlock } from '@/components/calendar/TimeBlock';
import { GhostBlock } from '@/components/calendar/GhostBlock';
import { EmptySlot } from '@/components/calendar/EmptySlot';
import { BlockAddSheet } from '@/components/calendar/BlockAddSheet';
import { WeekView } from '@/components/calendar/WeekView';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import type { BlockWithDetails } from '@/types/database';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const HOUR_HEIGHT  = 60;   // 1時間 = 60px（1px/分）
const LABEL_WIDTH  = 48;   // 時刻ラベル列の幅
const BLOCK_LEFT   = LABEL_WIDTH + 4;
const BLOCK_RIGHT  = 8;
const MIN_SLOT_MIN = 10;   // 表示する空きスロットの最小時間（分）
const MIN_HEIGHT   = 36;   // ブロック・スロットの最小表示高さ

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function toStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** 起床時刻からの経過分数 → Y座標 */
function posY(min: number, wakeMin: number): number {
  return ((min - wakeMin) / 60) * HOUR_HEIGHT;
}

/** 持続時間（分）→ 表示高さ（最小値あり） */
function blockH(durationMin: number): number {
  return Math.max((durationMin / 60) * HOUR_HEIGHT, MIN_HEIGHT);
}

function formatDateHeader(dateStr: string): string {
  const d = parseISO(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）`;
}

/** 週の開始日を計算（weekStartDay: 0=日〜6=土） */
function getWeekStart(dateStr: string, weekStartDay: number): string {
  const d = parseISO(dateStr);
  const dayOfWeek = getDay(d);
  const diff = (dayOfWeek - weekStartDay + 7) % 7;
  return format(addDays(d, -diff), 'yyyy-MM-dd');
}

function formatWeekHeader(weekStart: string, weekEnd: string): string {
  const s = parseISO(weekStart);
  const e = parseISO(weekEnd);
  return `${s.getMonth() + 1}/${s.getDate()}〜${e.getMonth() + 1}/${e.getDate()}`;
}

// ---------------------------------------------------------------------------
// セグメント計算
// ---------------------------------------------------------------------------

interface Segment {
  type: 'block' | 'empty';
  startMin: number;
  endMin: number;
  block?: BlockWithDetails;
}

function computeSegments(
  blocks: BlockWithDetails[],
  wakeMin: number,
  sleepMin: number,
): Segment[] {
  const segs: Segment[] = [];
  let cursor = wakeMin;

  for (const b of blocks) {
    const s = Math.max(toMin(b.start_time), wakeMin);
    const e = Math.min(toMin(b.end_time), sleepMin);
    if (s >= sleepMin || e <= wakeMin) continue;

    const gap = s - cursor;
    if (gap >= MIN_SLOT_MIN) {
      segs.push({ type: 'empty', startMin: cursor, endMin: s });
    }

    segs.push({ type: 'block', startMin: s, endMin: e, block: b });
    cursor = Math.max(cursor, e);
  }

  const tail = sleepMin - cursor;
  if (tail >= MIN_SLOT_MIN) {
    segs.push({ type: 'empty', startMin: cursor, endMin: sleepMin });
  }

  return segs;
}

// ---------------------------------------------------------------------------
// 画面
// ---------------------------------------------------------------------------

export default function CalendarScreen() {
  const {
    selectedDate,
    viewMode,
    setSelectedDate,
    setViewMode,
    fetchBlocksForDate,
    fetchBlocksForWeek,
    getBlocksForDate,
    getGhostBlocksForDate,
    getScheduledMinutes,
    deleteBlock,
    loading: calendarLoading,
    error: calendarError,
    clearError: clearCalendarError,
  } = useCalendarStore();

  const { getEffectiveSchedule, getAvailableMinutes, settings } = useUserSettingsStore();

  const weekStartDay = settings?.week_start_day ?? 1;

  // ブロック追加/編集/ゴーストシートの状態
  type AddSheetState =
    | { mode: 'add'; startTime: string; endTime: string }
    | { mode: 'edit'; block: BlockWithDetails }
    | { mode: 'ghost'; block: BlockWithDetails };

  const [addSheet, setAddSheet] = useState<AddSheetState | null>(null);

  // コンテキストメニューの状態（長押しブロック）
  const [contextBlock, setContextBlock] = useState<BlockWithDetails | null>(null);

  // ── 日次ビュー用 ──────────────────────────────────────────────────────────

  const schedule     = getEffectiveSchedule(selectedDate);
  const wakeMin      = toMin(schedule.wakeTime);
  const sleepMin     = toMin(schedule.sleepTime);
  const availableMin = getAvailableMinutes(selectedDate);

  const blocks       = getBlocksForDate(selectedDate);
  const ghostBlocks  = getGhostBlocksForDate(selectedDate);
  const scheduledMin = getScheduledMinutes(selectedDate);
  const fillRate     = availableMin > 0
    ? Math.min(Math.round((scheduledMin / availableMin) * 100), 100)
    : 0;

  const segments = useMemo(
    () => computeSegments(blocks, wakeMin, sleepMin),
    [blocks, wakeMin, sleepMin],
  );

  const wakeHour  = Math.floor(wakeMin / 60);
  const sleepHour = Math.ceil(sleepMin / 60);
  const hourList  = Array.from(
    { length: sleepHour - wakeHour + 1 },
    (_, i) => wakeHour + i,
  );
  const totalHeight   = ((sleepMin - wakeMin) / 60) * HOUR_HEIGHT;
  const activityHours = Math.floor(availableMin / 60);

  // ── 週次ビュー用 ──────────────────────────────────────────────────────────

  const weekStart = useMemo(
    () => getWeekStart(selectedDate, weekStartDay),
    [selectedDate, weekStartDay],
  );

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) =>
      format(addDays(parseISO(weekStart), i), 'yyyy-MM-dd')
    ),
    [weekStart],
  );

  const weekEnd = weekDates[6]!;

  // 週の充填率（全日の平均）
  const weekFillData = useMemo(() => {
    let totalScheduled = 0;
    let totalAvailable = 0;
    for (const date of weekDates) {
      totalScheduled += getScheduledMinutes(date);
      totalAvailable += getAvailableMinutes(date);
    }
    const avgRate = totalAvailable > 0
      ? Math.min(Math.round((totalScheduled / totalAvailable) * 100), 100)
      : 0;
    return { totalScheduled, totalAvailable, avgRate };
  }, [weekDates, getScheduledMinutes, getAvailableMinutes]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isToday  = selectedDate === todayStr;

  // ── フェッチ ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (viewMode === 'day') {
      fetchBlocksForDate(selectedDate);
    }
  }, [selectedDate, viewMode]);

  useEffect(() => {
    if (viewMode === 'week') {
      fetchBlocksForWeek(weekStart);
    }
  }, [weekStart, viewMode]);

  // ── ナビゲーション ────────────────────────────────────────────────────────

  const goToPrev = () => {
    if (viewMode === 'day') {
      setSelectedDate(format(addDays(parseISO(selectedDate), -1), 'yyyy-MM-dd'));
    } else {
      const prevWeekStart = format(subWeeks(parseISO(weekStart), 1), 'yyyy-MM-dd');
      setSelectedDate(prevWeekStart);
    }
  };

  const goToNext = () => {
    if (viewMode === 'day') {
      setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'));
    } else {
      const nextWeekStart = format(addWeeks(parseISO(weekStart), 1), 'yyyy-MM-dd');
      setSelectedDate(nextWeekStart);
    }
  };

  const goToToday = () =>
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));

  // ── ヘッダータイトル ──────────────────────────────────────────────────────

  const headerTitle = viewMode === 'day'
    ? formatDateHeader(selectedDate)
    : formatWeekHeader(weekStart, weekEnd);

  const headerSubtitle = viewMode === 'day'
    ? (!isToday ? 'タップで今日に戻る' : undefined)
    : undefined;

  return (
    <View style={styles.root}>
      {/* ── エラーバナー ── */}
      {calendarError && (
        <ErrorBanner
          message={calendarError}
          onDismiss={clearCalendarError}
        />
      )}

      {/* ── ローディングオーバーレイ ── */}
      {calendarLoading && <LoadingOverlay fullScreen />}

      {/* ── ヘッダー ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.arrowBtn} onPress={goToPrev}>
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goToToday}>
            <Text style={styles.dateText}>{headerTitle}</Text>
            {headerSubtitle && (
              <Text style={styles.todayHint}>{headerSubtitle}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.arrowBtn} onPress={goToNext}>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.activityText}>活動 {activityHours}h</Text>
      </View>

      {/* ── 日 / 週 ビュー切替 ── */}
      <View style={styles.viewToggleBar}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'day' && styles.toggleBtnActive]}
            onPress={() => setViewMode('day')}
          >
            <Text style={[styles.toggleText, viewMode === 'day' && styles.toggleTextActive]}>
              日
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'week' && styles.toggleBtnActive]}
            onPress={() => setViewMode('week')}
          >
            <Text style={[styles.toggleText, viewMode === 'week' && styles.toggleTextActive]}>
              週
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 充填率バー ── */}
      {viewMode === 'day' ? (
        <FillMeter
          fillRate={fillRate}
          scheduledMin={scheduledMin}
          availableMin={availableMin}
        />
      ) : (
        <FillMeter
          fillRate={weekFillData.avgRate}
          scheduledMin={weekFillData.totalScheduled}
          availableMin={weekFillData.totalAvailable}
        />
      )}

      {/* ── コンテンツ ── */}
      {viewMode === 'week' ? (
        /* ── 週次ビュー ── */
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <WeekView
            weekDates={weekDates}
            todayStr={todayStr}
            wakeMin={wakeMin}
            sleepMin={sleepMin}
            getBlocksForDate={getBlocksForDate}
            getScheduledMinutes={getScheduledMinutes}
            onDayPress={(date) => {
              setSelectedDate(date);
              setViewMode('day');
            }}
          />
        </ScrollView>
      ) : (
        /* ── 日次ビュー ── */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 就寝ゾーン（上 — 起床時刻） */}
          <SleepZone
            label="起床"
            time={schedule.wakeTime.slice(0, 5)}
            icon="☀️"
          />

          {/* タイムライン本体 */}
          <View style={[styles.timeline, { height: totalHeight }]}>
            {/* 時間グリッドライン + ラベル */}
            {hourList.map((h) => {
              const y = posY(h * 60, wakeMin);
              if (y < 0) return null;
              return (
                <View
                  key={h}
                  style={[styles.hourRow, { top: y }]}
                  pointerEvents="none"
                >
                  <Text
                    style={[
                      styles.hourLabel,
                      h === wakeHour && styles.wakeHourLabel,
                    ]}
                  >
                    {h}:00
                  </Text>
                  <View style={styles.gridLine} />
                </View>
              );
            })}

            {/* ゴーストブロック（通常ブロックの後ろに描画） */}
            {ghostBlocks.map((ghost) => {
              const s = Math.max(toMin(ghost.start_time), wakeMin);
              const e = Math.min(toMin(ghost.end_time), sleepMin);
              if (s >= sleepMin || e <= wakeMin) return null;
              const top    = posY(s, wakeMin);
              const height = blockH(e - s);
              return (
                <View
                  key={`ghost-${ghost.id}`}
                  style={[styles.segWrap, { top, height, left: BLOCK_LEFT, right: BLOCK_RIGHT }]}
                  pointerEvents="none"
                >
                  <GhostBlock block={ghost} heightPx={height} />
                </View>
              );
            })}

            {/* ブロック・空きスロット */}
            {segments.map((seg, i) => {
              const top      = posY(seg.startMin, wakeMin);
              const duration = seg.endMin - seg.startMin;
              const height   = blockH(duration);

              if (seg.type === 'block' && seg.block) {
                return (
                  <View
                    key={seg.block.id}
                    style={[
                      styles.segWrap,
                      { top, height, left: BLOCK_LEFT, right: BLOCK_RIGHT },
                    ]}
                  >
                    <TimeBlock
                      block={seg.block}
                      heightPx={height}
                      onPress={() => setContextBlock(seg.block!)}
                      onLongPress={() => setContextBlock(seg.block!)}
                    />
                  </View>
                );
              }

              return (
                <View
                  key={`empty-${i}`}
                  style={[
                    styles.segWrap,
                    { top, height, left: BLOCK_LEFT, right: BLOCK_RIGHT },
                  ]}
                >
                  <EmptySlot
                    startTime={toStr(seg.startMin)}
                    endTime={toStr(seg.endMin)}
                    durationMin={duration}
                    heightPx={height}
                    onPress={() => setAddSheet({
                      mode:      'add',
                      startTime: toStr(seg.startMin),
                      endTime:   toStr(seg.endMin),
                    })}
                  />
                </View>
              );
            })}
          </View>

          {/* 就寝ゾーン（下） */}
          <SleepZone
            label="就寝"
            time={schedule.sleepTime.slice(0, 5)}
            icon="🌙"
            onChangePress={() => {
              // TODO: 設定画面の起床就寝時刻セクションへ誘導
            }}
          />

          {/* スクロール末尾の余白 */}
          <View style={styles.bottomPad} />
        </ScrollView>
      )}

      {/* ── ブロック追加 / 編集 / ゴーストシート ── */}
      <BlockAddSheet
        visible={!!addSheet}
        onClose={() => setAddSheet(null)}
        date={selectedDate}
        mode={addSheet?.mode ?? 'add'}
        initialStartTime={addSheet?.mode === 'add' ? addSheet.startTime : undefined}
        initialEndTime={addSheet?.mode === 'add'   ? addSheet.endTime   : undefined}
        presetBlock={addSheet?.mode !== 'add' ? addSheet?.block : undefined}
        editBlockId={addSheet?.mode === 'edit' ? addSheet.block.id : undefined}
        originalBlockId={addSheet?.mode === 'ghost' ? addSheet.block.id : undefined}
      />

      {/* ── コンテキストメニュー（長押し） ── */}
      <Modal
        visible={!!contextBlock}
        transparent
        animationType="fade"
        onRequestClose={() => setContextBlock(null)}
      >
        <TouchableOpacity
          style={ctxSt.overlay}
          activeOpacity={1}
          onPress={() => setContextBlock(null)}
        >
          <View style={ctxSt.sheet}>
            {/* ブロック情報 */}
            <View style={ctxSt.info}>
              <View
                style={[
                  ctxSt.colorBar,
                  { backgroundColor: contextBlock?.activity_categories?.color ?? '#94a3b8' },
                ]}
              />
              <View style={ctxSt.infoText}>
                <Text style={ctxSt.infoName} numberOfLines={1}>
                  {contextBlock?.activity_categories?.name ?? 'ブロック'}
                </Text>
                <Text style={ctxSt.infoTime}>
                  {contextBlock?.start_time.slice(0, 5)} 〜 {contextBlock?.end_time.slice(0, 5)}
                </Text>
              </View>
            </View>

            <View style={ctxSt.divider} />

            {/* 編集 */}
            <TouchableOpacity
              style={ctxSt.action}
              onPress={() => {
                const b = contextBlock!;
                setContextBlock(null);
                setAddSheet({ mode: 'edit', block: b });
              }}
            >
              <Text style={ctxSt.actionIcon}>✏️</Text>
              <Text style={ctxSt.actionLabel}>編集</Text>
            </TouchableOpacity>

            {/* 変更（ゴースト化）— 当日のみ有効 */}
            <TouchableOpacity
              style={[ctxSt.action, contextBlock?.date !== todayStr && ctxSt.actionDisabled]}
              onPress={() => {
                if (contextBlock?.date !== todayStr) return;
                const b = contextBlock!;
                setContextBlock(null);
                setAddSheet({ mode: 'ghost', block: b });
              }}
            >
              <Text style={ctxSt.actionIcon}>🔄</Text>
              <View style={ctxSt.actionLabelWrap}>
                <Text style={ctxSt.actionLabel}>変更（当日のみ）</Text>
                {contextBlock?.date !== todayStr && (
                  <Text style={ctxSt.actionSub}>今日のブロックのみ利用可</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* 削除 */}
            <TouchableOpacity
              style={ctxSt.action}
              onPress={() => {
                const b = contextBlock!;
                setContextBlock(null);
                Alert.alert(
                  'ブロックを削除',
                  `「${b.activity_categories?.name ?? 'ブロック'}」を削除しますか？`,
                  [
                    { text: 'キャンセル', style: 'cancel' },
                    {
                      text: '削除',
                      style: 'destructive',
                      onPress: () => void deleteBlock(b.id, b.date),
                    },
                  ]
                );
              }}
            >
              <Text style={ctxSt.actionIcon}>🗑</Text>
              <Text style={[ctxSt.actionLabel, ctxSt.actionDanger]}>削除</Text>
            </TouchableOpacity>

            {/* キャンセル */}
            <View style={ctxSt.divider} />
            <TouchableOpacity style={ctxSt.cancelAction} onPress={() => setContextBlock(null)}>
              <Text style={ctxSt.cancelText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
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

  // ヘッダー
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 26,
    color: COLORS.primary,
    lineHeight: 30,
  },
  dateText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  todayHint: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 1,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },

  // ビュー切替
  viewToggleBar: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: COLORS.surface,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    padding: 3,
    alignSelf: 'flex-start',
  },
  toggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  toggleTextActive: {
    color: '#fff',
  },

  // スクロール
  scroll: {
    flex: 1,
  },
  scrollContent: {
    // 内容に合わせて自動伸張
  },

  // タイムライン
  timeline: {
    position: 'relative',
  },

  // 時間グリッドライン行
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    width: LABEL_WIDTH,
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'right',
    paddingRight: 8,
    marginTop: -9,
  },
  wakeHourLabel: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 11,
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },

  // ブロック・スロット共通ラッパー
  segWrap: {
    position: 'absolute',
  },

  bottomPad: {
    height: 32,
  },
});

// ---------------------------------------------------------------------------
// コンテキストメニュースタイル
// ---------------------------------------------------------------------------

const ctxSt = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    overflow: 'hidden',
  },

  // ブロック情報ヘッダー
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  colorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  infoText: {
    flex: 1,
    gap: 3,
  },
  infoName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  infoTime: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginHorizontal: 0,
  },

  // アクション行
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 14,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionIcon: {
    fontSize: 20,
    width: 26,
    textAlign: 'center',
  },
  actionLabelWrap: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  actionSub: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  actionDanger: {
    color: COLORS.danger,
  },

  // キャンセル
  cancelAction: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
