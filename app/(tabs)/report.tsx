import React, { useCallback, useEffect, useState } from 'react';

const AMBER = '#f59e0b';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { addDays, addWeeks, format, getDay, subWeeks } from 'date-fns';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserSettingsStore } from '@/stores/useUserSettingsStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { COLORS } from '@/constants/Colors';
import type { CalendarBlockRow, ActivityLogRow } from '@/types/database';

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex?.startsWith('#') || hex.length < 7) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getWeekStart(date: Date, weekStartDay: number): Date {
  const dow  = getDay(date);
  const diff = (dow - weekStartDay + 7) % 7;
  const d    = new Date(date);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// データ型
// ---------------------------------------------------------------------------

type BlockWithCat = CalendarBlockRow & {
  activity_categories: { id: string; name: string; color: string; icon: string | null } | null;
};

type LogWithCat = ActivityLogRow & {
  activity_categories: { id: string; name: string; color: string; icon: string | null } | null;
  sub_categories:      { id: string; name: string; icon: string | null } | null;
};

interface CategoryStat {
  id:               string;
  name:             string;
  color:            string;
  icon:             string | null;
  plannedPomodoros: number;
  actualPomodoros:  number;
  plannedMinutes:   number;
  actualMinutes:    number;
}

interface SubcategoryStat {
  name:          string;
  actualMinutes: number;
  color:         string;
}

interface WeekStats {
  categoryStats:    CategoryStat[];
  subcategoryStats: SubcategoryStat[];
  avgFillRate:      number;
  planAdherence:    number;
  focusScore:       number;
  ghostRate:        number;
  totalActualMin:   number;
  totalPlannedMin:  number;
}

// ---------------------------------------------------------------------------
// Act — ダミーデータ
// ---------------------------------------------------------------------------

interface Proposal {
  id:          string;
  title:       string;
  description: string;
}

const DUMMY_PROPOSALS: Proposal[] = [
  {
    id: '1',
    title: '民法を週10回に増量',
    description: '今週は8回でしたが、試験まで残り4週のため週10回を推奨します。',
  },
  {
    id: '2',
    title: '商法を火・木の午前に固定配置',
    description: '集中力が高い午前中に配置することで定着率の向上が期待できます。',
  },
  {
    id: '3',
    title: '演習比率を50%以上に引き上げ',
    description: '今週は講義45%・演習35%でした。演習を増やして記憶定着を強化しましょう。',
  },
  {
    id: '4',
    title: '土曜に総復習ブロックを追加',
    description: '週末に1時間の振り返りブロックを設けることで知識の定着が向上します。',
  },
];

interface AllocationChange {
  name:   string;
  color:  string;
  icon:   string;
  before: number;
  after:  number;
  unit:   string;
}

const DUMMY_ALLOCATION: AllocationChange[] = [
  { name: '民法',   color: '#7c3aed', icon: '📖', before: 8,  after: 10, unit: '🍅' },
  { name: '商法',   color: '#059669', icon: '📚', before: 3,  after: 4,  unit: '🍅' },
  { name: '行政法', color: '#dc4a2d', icon: '📝', before: 6,  after: 6,  unit: '🍅' },
  { name: '英語',   color: '#1d4ed8', icon: '🗣️', before: 4,  after: 3,  unit: '🍅' },
];

// ---------------------------------------------------------------------------
// 集計ロジック
// ---------------------------------------------------------------------------

function buildStats(
  blocks: BlockWithCat[],
  logs: LogWithCat[],
  allBlocks: BlockWithCat[],
  getAvailableMinutes: (date: string) => number,
  weekDates: Date[],
): WeekStats {
  const catMap = new Map<string, CategoryStat>();

  for (const b of blocks) {
    if (!b.category_id || !b.activity_categories) continue;
    if (!catMap.has(b.category_id)) {
      catMap.set(b.category_id, {
        id: b.category_id,
        name:  b.activity_categories.name,
        color: b.activity_categories.color,
        icon:  b.activity_categories.icon,
        plannedPomodoros: 0, actualPomodoros: 0,
        plannedMinutes: 0,   actualMinutes: 0,
      });
    }
    const s = catMap.get(b.category_id)!;
    if (b.timer_mode === 'pomodoro') s.plannedPomodoros += b.pomodoro_count ?? 1;
    s.plannedMinutes += timeToMin(b.end_time) - timeToMin(b.start_time);
  }

  for (const l of logs) {
    if (!l.category_id) continue;
    const s = catMap.get(l.category_id);
    if (!s) continue;
    if (l.timer_mode === 'pomodoro') s.actualPomodoros += 1;
    s.actualMinutes += l.timer_mode === 'pomodoro'
      ? (l.focus_duration_sec ?? 0) / 60
      : (l.actual_duration_sec ?? 0) / 60;
  }

  const categoryStats = Array.from(catMap.values())
    .sort((a, b) => b.plannedMinutes - a.plannedMinutes);

  const subMap = new Map<string, SubcategoryStat>();
  for (const l of logs) {
    const key   = l.sub_categories?.name ?? '未分類';
    const color = l.activity_categories?.color ?? '#94a3b8';
    const mins  = l.timer_mode === 'pomodoro'
      ? (l.focus_duration_sec ?? 0) / 60
      : (l.actual_duration_sec ?? 0) / 60;
    if (!subMap.has(key)) subMap.set(key, { name: key, actualMinutes: 0, color });
    subMap.get(key)!.actualMinutes += mins;
  }

  const subcategoryStats = Array.from(subMap.values())
    .sort((a, b) => b.actualMinutes - a.actualMinutes);

  const fillRates = weekDates.map((d) => {
    const ds    = format(d, 'yyyy-MM-dd');
    const avail = getAvailableMinutes(ds);
    if (avail === 0) return null;
    const sched = blocks
      .filter((b) => b.date === ds)
      .reduce((sum, b) => sum + timeToMin(b.end_time) - timeToMin(b.start_time), 0);
    return Math.min((sched / avail) * 100, 100);
  }).filter((r): r is number => r !== null);

  const avgFillRate     = fillRates.length ? Math.round(fillRates.reduce((s, r) => s + r, 0) / fillRates.length) : 0;
  const completedBlocks = blocks.filter((b) => b.status === 'completed').length;
  const planAdherence   = blocks.length ? Math.round((completedBlocks / blocks.length) * 100) : 0;
  const focusScore      = logs.length > 0 ? Math.min(Math.round((logs.length / Math.max(logs.length, 1)) * 100), 100) : 0;
  const ghostCount      = allBlocks.filter((b) => b.is_ghost).length;
  const ghostRate       = allBlocks.length ? Math.round((ghostCount / allBlocks.length) * 100) : 0;
  const totalActualMin  = Math.round(logs.reduce((s, l) => s + (l.timer_mode === 'pomodoro' ? (l.focus_duration_sec ?? 0) / 60 : (l.actual_duration_sec ?? 0) / 60), 0));
  const totalPlannedMin = Math.round(blocks.reduce((s, b) => s + timeToMin(b.end_time) - timeToMin(b.start_time), 0));

  return { categoryStats, subcategoryStats, avgFillRate, planAdherence, focusScore, ghostRate, totalActualMin, totalPlannedMin };
}

// ===========================================================================
// CHECK セクション コンポーネント
// ===========================================================================

// ---------------------------------------------------------------------------
// CategoryBarChart
// ---------------------------------------------------------------------------

const MAX_BAR_H = 100;
const SUB_COLORS = [COLORS.primary, COLORS.success, '#f97316', '#0891b2', '#db2777', '#78716c'];

function CategoryBarChart({ stats }: { stats: CategoryStat[] }) {
  if (stats.length === 0) {
    return <View style={bcSt.empty}><Text style={bcSt.emptyText}>今週の実績データがありません</Text></View>;
  }

  const hasPomo = stats.some((s) => s.plannedPomodoros > 0);
  const maxVal  = hasPomo
    ? Math.max(...stats.flatMap((s) => [s.plannedPomodoros, s.actualPomodoros]), 1)
    : Math.max(...stats.flatMap((s) => [s.plannedMinutes,   s.actualMinutes]),   1);

  return (
    <View>
      <View style={bcSt.legend}>
        <View style={bcSt.legendItem}>
          <View style={[bcSt.legendDot, { backgroundColor: 'rgba(124,58,237,0.3)' }]} />
          <Text style={bcSt.legendText}>計画</Text>
        </View>
        <View style={bcSt.legendItem}>
          <View style={[bcSt.legendDot, { backgroundColor: COLORS.primary }]} />
          <Text style={bcSt.legendText}>実績</Text>
        </View>
      </View>

      <View style={bcSt.chartArea}>
        {stats.map((s) => {
          const pVal = hasPomo ? s.plannedPomodoros : s.plannedMinutes;
          const aVal = hasPomo ? s.actualPomodoros  : s.actualMinutes;
          const pH   = maxVal > 0 ? Math.max((pVal / maxVal) * MAX_BAR_H, pVal > 0 ? 3 : 0) : 0;
          const aH   = maxVal > 0 ? Math.max((aVal / maxVal) * MAX_BAR_H, aVal > 0 ? 3 : 0) : 0;

          return (
            <View key={s.id} style={bcSt.group}>
              <View style={[bcSt.barBase, { height: MAX_BAR_H }]}>
                <View style={bcSt.barPair}>
                  <View style={bcSt.barSlot}>
                    {pH > 0 && <View style={[bcSt.bar, { height: pH, backgroundColor: hexToRgba(s.color, 0.28), borderColor: hexToRgba(s.color, 0.55) }]} />}
                  </View>
                  <View style={bcSt.barSlot}>
                    {aH > 0 && <View style={[bcSt.bar, { height: aH, backgroundColor: s.color }]} />}
                  </View>
                </View>
              </View>
              <Text style={bcSt.label} numberOfLines={2}>{s.icon ? `${s.icon}\n` : ''}{s.name}</Text>
              <Text style={[bcSt.valText, { color: s.color }]}>
                {hasPomo ? `${s.actualPomodoros}🍅` : formatHours(Math.round(s.actualMinutes))}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const bcSt = StyleSheet.create({
  legend:     { flexDirection: 'row', gap: 16, marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12, color: COLORS.textMuted },
  chartArea:  { flexDirection: 'row', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap' },
  group:      { alignItems: 'center', gap: 6, minWidth: 52 },
  barBase:    { justifyContent: 'flex-end', width: '100%' },
  barPair:    { flexDirection: 'row', gap: 3, alignItems: 'flex-end' },
  barSlot:    { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:        { width: 16, borderRadius: 4, borderWidth: 1, borderColor: 'transparent' },
  label:      { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 14, maxWidth: 52 },
  valText:    { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  empty:      { alignItems: 'center', paddingVertical: 32 },
  emptyText:  { fontSize: 13, color: COLORS.textMuted },
});

// ---------------------------------------------------------------------------
// BreakdownBar
// ---------------------------------------------------------------------------

function BreakdownBar({ stats }: { stats: SubcategoryStat[] }) {
  const total = stats.reduce((s, c) => s + c.actualMinutes, 0);
  if (total === 0) {
    return <View style={bkSt.empty}><Text style={bkSt.emptyText}>実績データがありません</Text></View>;
  }

  const top5      = stats.slice(0, 5);
  const othersMin = stats.slice(5).reduce((s, c) => s + c.actualMinutes, 0);
  const items = [
    ...top5.map((s, i) => ({ name: s.name, min: s.actualMinutes, color: SUB_COLORS[i] ?? s.color })),
    ...(othersMin > 0 ? [{ name: 'その他', min: othersMin, color: COLORS.textMuted }] : []),
  ];

  return (
    <View style={bkSt.wrap}>
      <View style={bkSt.bar}>
        {items.map((item, i) => (
          <View
            key={i}
            style={[bkSt.segment, {
              flex: item.min,
              backgroundColor: item.color,
              borderTopLeftRadius:     i === 0 ? 6 : 0,
              borderBottomLeftRadius:  i === 0 ? 6 : 0,
              borderTopRightRadius:    i === items.length - 1 ? 6 : 0,
              borderBottomRightRadius: i === items.length - 1 ? 6 : 0,
            }]}
          />
        ))}
      </View>
      <View style={bkSt.legend}>
        {items.map((item, i) => (
          <View key={i} style={bkSt.legendItem}>
            <View style={[bkSt.dot, { backgroundColor: item.color }]} />
            <Text style={bkSt.name} numberOfLines={1}>{item.name}</Text>
            <Text style={[bkSt.pct, { color: item.color }]}>
              {Math.round((item.min / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const bkSt = StyleSheet.create({
  wrap:       { gap: 12 },
  bar:        { flexDirection: 'row', height: 18, borderRadius: 6, overflow: 'hidden' },
  segment:    { height: '100%' },
  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  name:       { fontSize: 12, color: COLORS.textSecondary, maxWidth: 60 },
  pct:        { fontSize: 12, fontWeight: '700' },
  empty:      { alignItems: 'center', paddingVertical: 20 },
  emptyText:  { fontSize: 13, color: COLORS.textMuted },
});

// ---------------------------------------------------------------------------
// CheckAiBanner
// ---------------------------------------------------------------------------

const AI_MESSAGES = [
  '講義45%でインプット偏重。演習+テストを50%以上に増やすことで定着率が向上します。',
  '計画遵守率が高い週です。充填率をさらに高めるため、空きスロットに短い復習ブロックを追加してみましょう。',
  '休憩の取り忘れが見られます。ポモドーロの休憩を省略しないことで集中の持続力が上がります。',
];

function CheckAiBanner({ text }: { text: string }) {
  return (
    <View style={caiBst.wrap}>
      <View style={caiBst.iconWrap}><Text style={caiBst.icon}>🤖</Text></View>
      <View style={caiBst.body}>
        <Text style={caiBst.label}>AI 分析 · 今週の改善ポイント</Text>
        <Text style={caiBst.text}>{text}</Text>
      </View>
    </View>
  );
}

const caiBst = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: '#1e3a5f', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)', marginBottom: 20 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(96,165,250,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:     { fontSize: 22 },
  body:     { flex: 1, gap: 5 },
  label:    { fontSize: 11, fontWeight: '700', color: 'rgba(147,197,253,0.8)', letterSpacing: 0.4 },
  text:     { fontSize: 14, color: '#bfdbfe', lineHeight: 20 },
});

// ---------------------------------------------------------------------------
// MetricCard
// ---------------------------------------------------------------------------

function MetricCard({ label, value, unit, color, sub }: {
  label: string; value: number | null; unit: string; color: string; sub?: string;
}) {
  return (
    <View style={mcSt.card}>
      <Text style={[mcSt.value, { color }]}>
        {value !== null ? value : '–'}
        <Text style={mcSt.unit}>{value !== null ? unit : ''}</Text>
      </Text>
      {sub && <Text style={mcSt.sub}>{sub}</Text>}
      <Text style={mcSt.label}>{label}</Text>
    </View>
  );
}

const mcSt = StyleSheet.create({
  card:  { flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, alignItems: 'center', gap: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  value: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  unit:  { fontSize: 13, fontWeight: '600' },
  sub:   { fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  label: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', fontWeight: '500', lineHeight: 15 },
});

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={scSt.wrap}>
      <Text style={scSt.title}>{title}</Text>
      <View style={scSt.card}>{children}</View>
    </View>
  );
}

const scSt = StyleSheet.create({
  wrap:  { marginBottom: 20, gap: 8 },
  title: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 },
  card:  { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, padding: 16 },
});

// ===========================================================================
// ACT セクション コンポーネント
// ===========================================================================

// ---------------------------------------------------------------------------
// ActAiBanner — オレンジ背景
// ---------------------------------------------------------------------------

function ActAiBanner() {
  return (
    <View style={actAiSt.wrap}>
      <View style={actAiSt.iconWrap}><Text style={actAiSt.icon}>✨</Text></View>
      <View style={actAiSt.body}>
        <Text style={actAiSt.label}>AI 改善提案</Text>
        <Text style={actAiSt.text}>
          今週のCheckをもとに改善案を作りました。採用する提案にチェックを入れてください。
        </Text>
      </View>
    </View>
  );
}

const actAiSt = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: '#431407', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(251,146,60,0.4)', marginBottom: 8 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(251,146,60,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:     { fontSize: 22 },
  body:     { flex: 1, gap: 5 },
  label:    { fontSize: 11, fontWeight: '700', color: 'rgba(253,186,116,0.9)', letterSpacing: 0.4 },
  text:     { fontSize: 14, color: '#fed7aa', lineHeight: 20 },
});

// ---------------------------------------------------------------------------
// ProposalRow
// ---------------------------------------------------------------------------

function ProposalRow({
  item,
  checked,
  onToggle,
}: {
  item:     Proposal;
  checked:  boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[prpSt.row, checked && prpSt.rowChecked]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <View style={[prpSt.checkbox, checked && prpSt.checkboxChecked]}>
        {checked && <Text style={prpSt.checkMark}>✓</Text>}
      </View>
      <View style={prpSt.body}>
        <Text style={[prpSt.title, checked && prpSt.titleChecked]}>{item.title}</Text>
        <Text style={prpSt.desc} numberOfLines={2}>{item.description}</Text>
      </View>
    </TouchableOpacity>
  );
}

const prpSt = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowChecked: { backgroundColor: '#fffbeb' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
    backgroundColor: COLORS.surface,
  },
  checkboxChecked: { backgroundColor: AMBER, borderColor: AMBER },
  checkMark: { fontSize: 13, color: '#fff', fontWeight: '800', lineHeight: 16 },
  body:  { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '600', color: COLORS.text, lineHeight: 19 },
  titleChecked: { color: AMBER },
  desc:  { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },
});

// ---------------------------------------------------------------------------
// AllocationRow — 変更後の科目配分
// ---------------------------------------------------------------------------

function AllocationRow({ item, maxVal }: { item: AllocationChange; maxVal: number }) {
  const changed   = item.before !== item.after;
  const increased = item.after > item.before;
  const barPct    = maxVal > 0 ? (item.after / maxVal) : 0;

  return (
    <View style={alcSt.row}>
      <View style={alcSt.left}>
        <Text style={alcSt.icon}>{item.icon}</Text>
        <Text style={alcSt.name} numberOfLines={1}>{item.name}</Text>
      </View>

      <View style={alcSt.right}>
        {changed ? (
          <View style={alcSt.changeWrap}>
            <Text style={alcSt.beforeVal}>{item.before}{item.unit}</Text>
            <Text style={alcSt.arrow}>→</Text>
            <Text style={[alcSt.afterVal, { color: increased ? '#dc2626' : COLORS.success }]}>
              {item.after}{item.unit}
            </Text>
            <Text style={[alcSt.delta, { color: increased ? '#dc2626' : COLORS.success }]}>
              {increased ? `+${item.after - item.before}` : `${item.after - item.before}`}
            </Text>
          </View>
        ) : (
          <Text style={alcSt.noChange}>{item.after}{item.unit}（変更なし）</Text>
        )}
      </View>

      {/* プログレスバー */}
      <View style={alcSt.barBg}>
        <View
          style={[alcSt.barFill, {
            width: `${Math.round(barPct * 100)}%` as `${number}%`,
            backgroundColor: changed ? (increased ? hexToRgba('#dc2626', 0.7) : hexToRgba(COLORS.success, 0.7)) : hexToRgba(item.color, 0.4),
          }]}
        />
      </View>
    </View>
  );
}

const alcSt = StyleSheet.create({
  row:       { paddingVertical: 12, paddingHorizontal: 16, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  left:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon:      { fontSize: 16, width: 22, textAlign: 'center' },
  name:      { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1 },
  right:     { flexDirection: 'row', alignItems: 'center' },
  changeWrap:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  beforeVal: { fontSize: 13, color: COLORS.textMuted, textDecorationLine: 'line-through' },
  arrow:     { fontSize: 12, color: COLORS.textMuted },
  afterVal:  { fontSize: 15, fontWeight: '800' },
  delta:     { fontSize: 12, fontWeight: '700' },
  noChange:  { fontSize: 12, color: COLORS.textMuted },
  barBg:     { height: 5, backgroundColor: COLORS.surfaceElevated, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: 5, borderRadius: 3 },
});

// ===========================================================================
// メインコンポーネント
// ===========================================================================

type TabKey = 'check' | 'act';

export default function ReportScreen() {
  const router = useRouter();
  const { setSelectedDate, setViewMode } = useCalendarStore();
  const { settings, getAvailableMinutes } = useUserSettingsStore();
  const weekStartDay = settings?.week_start_day ?? 1;

  // ── タブ ──
  const [tab, setTab] = useState<TabKey>('check');

  // ── Check: 週ナビ ──
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStart(new Date(), weekStartDay)
  );
  const [stats,   setStats]   = useState<WeekStats | null>(null);
  const [loading, setLoading] = useState(false);

  const weekDates    = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd      = weekDates[6]!;
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr   = format(weekEnd,   'yyyy-MM-dd');

  // ── Act: 提案チェック状態 ──
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() =>
    new Set(DUMMY_PROPOSALS.slice(0, 2).map((p) => p.id))
  );

  // ── Act: 来週の日付 ──
  const nextWeekStart = addWeeks(getWeekStart(new Date(), weekStartDay), 1);
  const nextWeekEnd   = addDays(nextWeekStart, 6);

  // =========================================================================
  // Check データフェッチ
  // =========================================================================

  const fetchWeekStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: allBlocksRaw } = await supabase
        .from('calendar_blocks')
        .select('id, is_ghost, date')
        .eq('user_id', user.id)
        .gte('date', weekStartStr)
        .lte('date', weekEndStr);

      const { data: blocksRaw } = await supabase
        .from('calendar_blocks')
        .select('*, activity_categories ( id, name, color, icon )')
        .eq('user_id', user.id)
        .eq('is_ghost', false)
        .neq('status', 'skipped')
        .gte('date', weekStartStr)
        .lte('date', weekEndStr);

      const { data: logsRaw } = await supabase
        .from('activity_logs')
        .select('*, activity_categories ( id, name, color, icon ), sub_categories ( id, name, icon )')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('started_at', `${weekStartStr}T00:00:00`)
        .lte('started_at', `${weekEndStr}T23:59:59`);

      setStats(buildStats(
        (blocksRaw    ?? []) as unknown as BlockWithCat[],
        (logsRaw      ?? []) as unknown as LogWithCat[],
        (allBlocksRaw ?? []) as unknown as BlockWithCat[],
        getAvailableMinutes,
        weekDates,
      ));
    } finally {
      setLoading(false);
    }
  }, [weekStartStr, weekEndStr]);

  useEffect(() => { void fetchWeekStats(); }, [fetchWeekStats]);

  // =========================================================================
  // ハンドラ
  // =========================================================================

  const isCurrentWeek = weekStartStr === format(getWeekStart(new Date(), weekStartDay), 'yyyy-MM-dd');

  function toggleProposal(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleApplyToCalendar() {
    const count = checkedIds.size;
    if (count === 0) {
      Alert.alert('提案を選択してください', '1つ以上の提案にチェックを入れてください。');
      return;
    }
    Alert.alert(
      'カレンダーに反映しますか？',
      `選択した${count}件の提案をもとに、来週（${format(nextWeekStart, 'M/d')}〜${format(nextWeekEnd, 'M/d')}）のブロックを自動生成します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '反映する',
          onPress: () => {
            // Phase 3で実際のブロック生成ロジックを実装
            Alert.alert('完了', '来週のプランをカレンダーに反映しました。（モック）');
          },
        },
      ],
    );
  }

  function handleManualAdjust() {
    setSelectedDate(format(nextWeekStart, 'yyyy-MM-dd'));
    setViewMode('week');
    router.push('/(tabs)/calendar');
  }

  // =========================================================================
  // 派生値
  // =========================================================================

  const aiMsg         = AI_MESSAGES[Math.abs(weekStart.getDate()) % AI_MESSAGES.length]!;
  const maxAllocVal   = Math.max(...DUMMY_ALLOCATION.map((a) => a.after), 1);
  const checkedCount  = checkedIds.size;

  const scoreColor = (v: number | null) =>
    v === null ? COLORS.textMuted : v >= 80 ? COLORS.success : v >= 50 ? COLORS.fillLow : COLORS.danger;

  // =========================================================================
  // レンダリング
  // =========================================================================

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── ヘッダー ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>週次レポート</Text>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        </View>
        {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
      </View>

      {/* ── セグメントコントロール ────────────────────────────────────────── */}
      <View style={styles.segWrap}>
        {(['check', 'act'] as TabKey[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.segBtn, tab === t && styles.segBtnActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.75}
          >
            <Text style={[styles.segText, tab === t && styles.segTextActive]}>
              {t === 'check' ? '📊 Check（振り返り）' : '🎯 Act（来週プラン）'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ================================================================== */}
      {/* CHECK タブ                                                          */}
      {/* ================================================================== */}

      {tab === 'check' && (
        <>
          {/* 週ナビゲーション */}
          <View style={styles.weekNav}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setWeekStart((w) => subWeeks(w, 1))}>
              <Text style={styles.navIcon}>‹</Text>
            </TouchableOpacity>
            <View style={styles.weekLabelWrap}>
              <Text style={styles.weekText}>{format(weekStart, 'M/d')} 〜 {format(weekEnd, 'M/d')}</Text>
              {isCurrentWeek && (
                <View style={styles.currentChip}>
                  <Text style={styles.currentChipText}>今週</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.navBtn, isCurrentWeek && styles.navBtnOff]}
              onPress={() => { const n = addWeeks(weekStart, 1); if (n <= new Date()) setWeekStart(n); }}
              disabled={isCurrentWeek}
            >
              <Text style={[styles.navIcon, isCurrentWeek && styles.navIconOff]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* 計画 vs 実績 */}
          <Section title="計画 vs 実績">
            {loading && !stats
              ? <View style={styles.loadingBox}><ActivityIndicator color={COLORS.primary} /></View>
              : <CategoryBarChart stats={stats?.categoryStats ?? []} />
            }
          </Section>

          {/* 内訳バランス */}
          <Section title="内訳バランス">
            {loading && !stats
              ? <View style={styles.loadingBox}><ActivityIndicator color={COLORS.primary} /></View>
              : <BreakdownBar stats={stats?.subcategoryStats ?? []} />
            }
          </Section>

          {/* AI 分析バナー */}
          <CheckAiBanner text={aiMsg} />

          {/* メトリクス3列 */}
          <View style={styles.metricsRow}>
            <MetricCard label={'充填率\n平均'} value={stats?.avgFillRate ?? null} unit="%" color={scoreColor(stats?.avgFillRate ?? null)} />
            <MetricCard label={'計画\n遵守率'} value={stats?.planAdherence ?? null} unit="%" color={scoreColor(stats?.planAdherence ?? null)} />
            <MetricCard label={'集中\nスコア'} value={stats?.focusScore ?? null} unit="" color={scoreColor(stats?.focusScore ?? null)} />
          </View>

          {/* ゴーストノート */}
          {stats !== null && (
            <View style={styles.ghostNote}>
              <Text style={styles.ghostText}>
                👻 ゴースト率（計画変更）: {stats.ghostRate}%{'  '}·{'  '}
                実績 {formatHours(stats.totalActualMin)} / 計画 {formatHours(stats.totalPlannedMin)}
              </Text>
            </View>
          )}
        </>
      )}

      {/* ================================================================== */}
      {/* ACT タブ                                                            */}
      {/* ================================================================== */}

      {tab === 'act' && (
        <>
          {/* 来週のプランヘッダー */}
          <View style={actSt.planHeader}>
            <View>
              <Text style={actSt.planTitle}>来週のプラン</Text>
              <Text style={actSt.planRange}>
                {format(nextWeekStart, 'M月d日')} 〜 {format(nextWeekEnd, 'M月d日')}
              </Text>
            </View>
            <View style={actSt.nextChip}>
              <Text style={actSt.nextChipText}>来週</Text>
            </View>
          </View>

          {/* AI改善提案バナー */}
          <ActAiBanner />

          {/* 提案リスト */}
          <Section title={`改善提案 · ${checkedCount}件選択中`}>
            <View style={{ marginHorizontal: -16, marginVertical: -16 }}>
              {DUMMY_PROPOSALS.map((p) => (
                <ProposalRow
                  key={p.id}
                  item={p}
                  checked={checkedIds.has(p.id)}
                  onToggle={() => toggleProposal(p.id)}
                />
              ))}
            </View>
          </Section>

          {/* 変更後の科目配分 */}
          <Section title="変更後の科目配分">
            <View style={{ marginHorizontal: -16, marginVertical: -16 }}>
              {DUMMY_ALLOCATION.map((item) => (
                <AllocationRow key={item.name} item={item} maxVal={maxAllocVal} />
              ))}
            </View>
            <View style={actSt.allocNote}>
              <Text style={actSt.allocNoteText}>
                赤色＝増量　緑色＝減量
              </Text>
            </View>
          </Section>

          {/* カレンダーに反映ボタン */}
          <TouchableOpacity
            style={[actSt.applyBtn, checkedCount === 0 && actSt.applyBtnOff]}
            onPress={handleApplyToCalendar}
            activeOpacity={0.8}
          >
            <Text style={actSt.applyBtnIcon}>📅</Text>
            <View>
              <Text style={actSt.applyBtnText}>カレンダーに反映する</Text>
              <Text style={actSt.applyBtnSub}>
                {checkedCount > 0
                  ? `${checkedCount}件の提案を来週のブロックに反映`
                  : '提案を選択してください'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 手動で調整リンク */}
          <TouchableOpacity style={actSt.manualLink} onPress={handleManualAdjust} activeOpacity={0.6}>
            <Text style={actSt.manualLinkText}>手動で調整する</Text>
            <Text style={actSt.manualLinkArrow}> →</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Act専用スタイル
// ---------------------------------------------------------------------------

const actSt = StyleSheet.create({
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  planTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  planRange: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  nextChip:  { backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#fbbf24' },
  nextChipText: { fontSize: 12, fontWeight: '700', color: '#92400e' },

  allocNote: { paddingTop: 12, alignItems: 'flex-end' },
  allocNoteText: { fontSize: 11, color: COLORS.textMuted },

  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: AMBER,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 22,
    marginBottom: 12,
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  applyBtnOff:  { opacity: 0.5, shadowOpacity: 0 },
  applyBtnIcon: { fontSize: 26 },
  applyBtnText: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  applyBtnSub:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  manualLinkText:  { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  manualLinkArrow: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
});

// ---------------------------------------------------------------------------
// 共通スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingTop: 8, paddingBottom: 32 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingTop: 12, paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  proBadge:    { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#fbbf24' },
  proBadgeText:{ fontSize: 11, fontWeight: '800', color: '#92400e', letterSpacing: 0.5 },

  // セグメント
  segWrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segText:       { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  segTextActive: { color: COLORS.text },

  // 週ナビ
  weekNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    paddingVertical: 8, paddingHorizontal: 8, marginBottom: 20,
  },
  navBtn:        { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.surfaceElevated },
  navBtnOff:     { opacity: 0.35 },
  navIcon:       { fontSize: 22, color: COLORS.text, lineHeight: 26 },
  navIconOff:    { color: COLORS.textMuted },
  weekLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekText:      { fontSize: 15, fontWeight: '700', color: COLORS.text },
  currentChip:   { backgroundColor: COLORS.primaryLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  currentChipText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  loadingBox: { height: 80, alignItems: 'center', justifyContent: 'center' },
  ghostNote:  { alignItems: 'center', paddingVertical: 4, marginBottom: 4 },
  ghostText:  { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 },
});
