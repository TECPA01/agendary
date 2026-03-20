import React, { useMemo } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { parseISO } from 'date-fns';
import type { BlockWithDetails } from '@/types/database';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const SCREEN_W        = Dimensions.get('window').width;
const TIME_LABEL_W    = 28;    // 左の時刻ラベル列幅
const DAY_HEADER_H    = 46;    // 曜日ヘッダー高さ
const WEEK_COL_HEIGHT = 480;   // タイムライン列高さ
const MIN_BLOCK_H     = 3;     // ブロックの最小表示高さ

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

const UNPLANNED_BG = 'rgba(225,29,72,0.06)';

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return `rgba(148,163,184,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 分数 → タイムライン内のY座標 */
function timeToY(min: number, wakeMin: number, totalMin: number): number {
  return Math.max(Math.min((min - wakeMin) / totalMin, 1), 0) * WEEK_COL_HEIGHT;
}

/** 未計画日リストを可読文字列にフォーマット（連続日は「月〜水」形式） */
function formatUnplannedDays(dates: string[]): string {
  if (dates.length === 0) return '';

  const sorted = [...dates].sort();
  const groups: string[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1]!);
    const curr = parseISO(sorted[i]!);
    const diff = (curr.getTime() - prev.getTime()) / 86_400_000;
    if (diff === 1) {
      groups[groups.length - 1]!.push(sorted[i]!);
    } else {
      groups.push([sorted[i]!]);
    }
  }

  return groups
    .map((group) => {
      const names = group.map((d) => DAYS_JA[parseISO(d).getDay()] ?? '');
      if (names.length === 1) return `${names[0]}曜日`;
      if (names.length === 2) return `${names[0]}・${names[1]}曜日`;
      return `${names[0]}〜${names[names.length - 1]}曜日`;
    })
    .join('、');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WeekViewProps {
  weekDates: string[];                          // 7 dates (YYYY-MM-DD)
  todayStr: string;
  wakeMin: number;                              // 起床時刻（分）
  sleepMin: number;                             // 就寝時刻（分）
  getBlocksForDate: (d: string) => BlockWithDetails[];
  getScheduledMinutes: (d: string) => number;
  onDayPress?: (date: string) => void;          // 列タップ → 日次ビューへ
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export function WeekView({
  weekDates,
  todayStr,
  wakeMin,
  sleepMin,
  getBlocksForDate,
  getScheduledMinutes,
  onDayPress,
}: WeekViewProps) {
  const totalMin  = Math.max(sleepMin - wakeMin, 60);
  const wakeHour  = Math.floor(wakeMin / 60);
  const sleepHour = Math.ceil(sleepMin / 60);

  // 時刻ラベル（起床・中間・就寝の3点）
  const timeLabels = useMemo(() => {
    const mid = Math.round((wakeHour + sleepHour) / 2);
    return [...new Set([wakeHour, mid, sleepHour])].filter(
      (h) => h >= wakeHour && h <= sleepHour,
    );
  }, [wakeHour, sleepHour]);

  // 凡例（週内に登場するカテゴリ一覧）
  const legendItems = useMemo(() => {
    const seen = new Set<string>();
    const items: { id: string; name: string; color: string }[] = [];
    for (const date of weekDates) {
      for (const b of getBlocksForDate(date)) {
        const cat = b.activity_categories;
        if (cat && !seen.has(cat.id)) {
          seen.add(cat.id);
          items.push({ id: cat.id, name: cat.name, color: cat.color });
        }
      }
    }
    return items;
  }, [weekDates, getBlocksForDate]);

  // 未計画日（予定ゼロの日）
  const unplannedDates = useMemo(
    () => weekDates.filter((d) => getScheduledMinutes(d) === 0),
    [weekDates, getScheduledMinutes],
  );

  const unplannedText = useMemo(
    () => formatUnplannedDays(unplannedDates),
    [unplannedDates],
  );

  const colW = (SCREEN_W - TIME_LABEL_W) / 7;

  return (
    <View style={styles.container}>
      {/* ── タイムライングリッド ── */}
      <View style={styles.grid}>
        {/* 左の時刻ラベル列 */}
        <View style={{ width: TIME_LABEL_W }}>
          {/* 曜日ヘッダーと高さを揃えるスペーサー */}
          <View style={{ height: DAY_HEADER_H }} />
          {/* タイムライン高さに合わせたラベル列 */}
          <View style={{ height: WEEK_COL_HEIGHT, position: 'relative' }}>
            {timeLabels.map((h) => {
              const y = timeToY(h * 60, wakeMin, totalMin);
              const isBottom = h === sleepHour;
              return (
                <Text
                  key={h}
                  style={[
                    styles.timeLabel,
                    {
                      top: isBottom
                        ? Math.min(y - 11, WEEK_COL_HEIGHT - 11)
                        : Math.max(y - 6, 0),
                    },
                  ]}
                >
                  {h}
                </Text>
              );
            })}
          </View>
        </View>

        {/* 7日分のカラム */}
        {weekDates.map((date) => {
          const isToday  = date === todayStr;
          const dayDate  = parseISO(date);
          const blocks   = getBlocksForDate(date);
          const dateNum  = dayDate.getDate();
          const dayName  = DAYS_JA[dayDate.getDay()] ?? '';

          return (
            <TouchableOpacity
              key={date}
              style={{ width: colW }}
              onPress={() => onDayPress?.(date)}
              activeOpacity={0.85}
            >
              {/* 曜日ヘッダー */}
              <View
                style={[
                  styles.dayHeader,
                  isToday && styles.dayHeaderToday,
                ]}
              >
                <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                  {dayName}
                </Text>
                <View
                  style={[
                    styles.dateCircle,
                    isToday && styles.dateCircleToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateNum,
                      isToday && styles.dateNumToday,
                    ]}
                  >
                    {dateNum}
                  </Text>
                </View>
              </View>

              {/* タイムライン本体 */}
              <View
                style={[
                  styles.dayBody,
                  isToday
                    ? styles.dayBodyToday
                    : styles.dayBodyOther,
                ]}
              >
                {/* 時間グリッドライン */}
                {timeLabels.map((h) => {
                  const y = timeToY(h * 60, wakeMin, totalMin);
                  return (
                    <View
                      key={h}
                      style={[styles.weekGridLine, { top: y }]}
                      pointerEvents="none"
                    />
                  );
                })}

                {/* ブロック */}
                {blocks.map((block) => {
                  const startM = Math.max(toMin(block.start_time), wakeMin);
                  const endM   = Math.min(toMin(block.end_time), sleepMin);
                  if (endM <= startM) return null;

                  const top    = timeToY(startM, wakeMin, totalMin);
                  const height = Math.max(
                    timeToY(endM, wakeMin, totalMin) - top,
                    MIN_BLOCK_H,
                  );
                  const color   = block.activity_categories?.color ?? '#94a3b8';
                  const bgColor = hexToRgba(color, 0.88);
                  const name    = block.activity_categories?.name ?? '';
                  const showText = height >= 14;

                  return (
                    <View
                      key={block.id}
                      style={[
                        styles.weekBlock,
                        {
                          top,
                          height,
                          backgroundColor: bgColor,
                        },
                      ]}
                    >
                      {showText && (
                        <Text style={styles.weekBlockText} numberOfLines={1}>
                          {name}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── 凡例 ── */}
      {(legendItems.length > 0 || unplannedDates.length > 0) && (
        <View style={styles.legendRow}>
          {legendItems.map((item) => (
            <View key={item.id} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: item.color }]}
              />
              <Text style={styles.legendText} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
          ))}
          {unplannedDates.length > 0 && (
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: 'rgba(225,29,72,0.35)' },
                ]}
              />
              <Text style={styles.legendText}>未計画</Text>
            </View>
          )}
        </View>
      )}

      {/* ── 未計画日アラートバナー ── */}
      {unplannedDates.length > 0 && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertTitle}>! 未計画の日があります</Text>
          <Text style={styles.alertBody}>
            {unplannedText}の予定が入っていません。
          </Text>
        </View>
      )}

      {/* ── AIに残りを埋めてもらうボタン ── */}
      <TouchableOpacity
        style={styles.aiButton}
        onPress={() =>
          Alert.alert(
            'PRO機能',
            'この機能はPROプランで利用できます。\nAI週次レポートとセットでご利用いただけます。',
            [{ text: 'OK' }],
          )
        }
        activeOpacity={0.85}
      >
        <Text style={styles.aiButtonText}>✨ AIに残りを埋めてもらう</Text>
      </TouchableOpacity>

      {/* 下余白 */}
      <View style={{ height: 32 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
  },

  // グリッド
  grid: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  // 時刻ラベル
  timeLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'right',
    paddingRight: 3,
    lineHeight: 11,
  },

  // 曜日ヘッダー
  dayHeader: {
    height: DAY_HEADER_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
  },
  dayHeaderToday: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    borderRightColor: '#e2e8f0',
  },
  dayName: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  dayNameToday: {
    color: '#2563eb',
    fontWeight: '700',
  },
  dateCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCircleToday: {
    backgroundColor: '#2563eb',
  },
  dateNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  dateNumToday: {
    color: '#fff',
  },

  // タイムライン本体
  dayBody: {
    height: WEEK_COL_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
  },
  dayBodyToday: {
    backgroundColor: '#fff',
    borderLeftWidth: 1.5,
    borderLeftColor: '#2563eb',
    borderRightColor: '#dbeafe',
  },
  dayBodyOther: {
    backgroundColor: UNPLANNED_BG,
  },

  // 時間グリッドライン
  weekGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(226,232,240,0.7)',
  },

  // ブロック
  weekBlock: {
    position: 'absolute',
    left: 1,
    right: 1,
    borderRadius: 2,
    overflow: 'hidden',
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  weekBlockText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0,
  },

  // 凡例
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    maxWidth: 56,
  },

  // アラートバナー
  alertBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 3,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
  alertBody: {
    fontSize: 12,
    color: '#ef4444',
    lineHeight: 17,
  },

  // AIボタン
  aiButton: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
