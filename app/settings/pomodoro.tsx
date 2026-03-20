import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useUserSettingsStore } from '@/stores/useUserSettingsStore';
import { useTimerStore } from '@/stores/useTimerStore';
import { COLORS } from '@/constants/Colors';

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function Stepper({
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  value:    number;
  min:      number;
  max:      number;
  step?:    number;
  unit?:    string;
  onChange: (v: number) => void;
}) {
  return (
    <View style={stpSt.row}>
      <TouchableOpacity
        style={[stpSt.btn, value <= min && stpSt.disabled]}
        onPress={() => onChange(Math.max(value - step, min))}
        disabled={value <= min}
      >
        <Text style={stpSt.sign}>−</Text>
      </TouchableOpacity>
      <Text style={stpSt.val}>
        {value}<Text style={stpSt.unit}>{unit}</Text>
      </Text>
      <TouchableOpacity
        style={[stpSt.btn, value >= max && stpSt.disabled]}
        onPress={() => onChange(Math.min(value + step, max))}
        disabled={value >= max}
      >
        <Text style={stpSt.sign}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const stpSt = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  btn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  sign:     { fontSize: 18, color: COLORS.text, lineHeight: 20 },
  val:      { fontSize: 20, fontWeight: '700', color: COLORS.text, minWidth: 62, textAlign: 'center' },
  unit:     { fontSize: 13, fontWeight: '400', color: COLORS.textMuted },
});

// ---------------------------------------------------------------------------
// SettingRow
// ---------------------------------------------------------------------------

function SettingRow({
  label,
  sublabel,
  isLast,
  children,
}: {
  label:     string;
  sublabel?: string;
  isLast?:   boolean;
  children:  React.ReactNode;
}) {
  return (
    <View style={[rowSt.row, isLast && rowSt.rowLast]}>
      <View style={rowSt.left}>
        <Text style={rowSt.label}>{label}</Text>
        {sublabel && <Text style={rowSt.sublabel}>{sublabel}</Text>}
      </View>
      {children}
    </View>
  );
}

const rowSt = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, gap: 12 },
  rowLast:  { borderBottomWidth: 0 },
  left:     { flex: 1, gap: 2 },
  label:    { fontSize: 15, fontWeight: '500', color: COLORS.text },
  sublabel: { fontSize: 12, color: COLORS.textMuted },
});

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={scSt.wrap}>
      <Text style={scSt.label}>{title}</Text>
      <View style={scSt.card}>{children}</View>
    </View>
  );
}

const scSt = StyleSheet.create({
  wrap:  { marginBottom: 28, gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 },
  card:  { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, overflow: 'hidden' },
});

// ---------------------------------------------------------------------------
// プレビューカード
// ---------------------------------------------------------------------------

function SessionPreview({
  focusMin,
  shortMin,
  longMin,
  longAfter,
}: {
  focusMin:  number;
  shortMin:  number;
  longMin:   number;
  longAfter: number;
}) {
  // 1サイクル = longAfter セット × (集中+短休憩) - 最後の短休憩 + 長休憩
  const cycleMin = longAfter * focusMin + (longAfter - 1) * shortMin + longMin;

  const dots = Array.from({ length: longAfter }, (_, i) => i);

  return (
    <View style={pvSt.card}>
      <Text style={pvSt.title}>1サイクルのプレビュー</Text>

      <View style={pvSt.dotsRow}>
        {dots.map((i) => (
          <React.Fragment key={i}>
            <View style={[pvSt.dot, pvSt.focusDot]}>
              <Text style={pvSt.dotLabel}>{focusMin}分</Text>
            </View>
            {i < longAfter - 1 ? (
              <View style={[pvSt.dot, pvSt.shortDot]}>
                <Text style={pvSt.dotLabel}>{shortMin}分</Text>
              </View>
            ) : (
              <View style={[pvSt.dot, pvSt.longDot]}>
                <Text style={pvSt.dotLabel}>{longMin}分</Text>
              </View>
            )}
          </React.Fragment>
        ))}
      </View>

      <View style={pvSt.legend}>
        <View style={pvSt.legendItem}><View style={[pvSt.legendDot, pvSt.focusDot]} /><Text style={pvSt.legendText}>集中</Text></View>
        <View style={pvSt.legendItem}><View style={[pvSt.legendDot, pvSt.shortDot]} /><Text style={pvSt.legendText}>短休憩</Text></View>
        <View style={pvSt.legendItem}><View style={[pvSt.legendDot, pvSt.longDot]} /><Text style={pvSt.legendText}>長休憩</Text></View>
      </View>

      <Text style={pvSt.total}>合計 {cycleMin}分 / サイクル</Text>
    </View>
  );
}

const pvSt = StyleSheet.create({
  card:       { backgroundColor: COLORS.surfaceElevated, borderRadius: 14, padding: 16, gap: 14, marginTop: 8 },
  title:      { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  dotsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  dot:        { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  focusDot:   { backgroundColor: 'rgba(34,211,238,0.15)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.4)' },
  shortDot:   { backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.4)' },
  longDot:    { backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)' },
  dotLabel:   { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  legend:     { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11, color: COLORS.textMuted },
  total:      { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'right' },
});

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export default function PomodoroSettingsScreen() {
  const { settings, updateSettings } = useUserSettingsStore();
  const syncSettings = useTimerStore((s) => s.syncSettings);

  const [focusMin,      setFocusMin]      = useState(settings?.pomodoro_focus_minutes      ?? 25);
  const [shortBreakMin, setShortBreakMin] = useState(settings?.pomodoro_short_break        ?? 5);
  const [longBreakMin,  setLongBreakMin]  = useState(settings?.pomodoro_long_break         ?? 15);
  const [longAfter,     setLongAfter]     = useState(settings?.pomodoro_long_break_after   ?? 4);

  useEffect(() => {
    if (!settings) return;
    setFocusMin(settings.pomodoro_focus_minutes      ?? 25);
    setShortBreakMin(settings.pomodoro_short_break   ?? 5);
    setLongBreakMin(settings.pomodoro_long_break     ?? 15);
    setLongAfter(settings.pomodoro_long_break_after  ?? 4);
  }, [settings?.id]);

  // タイマーストアへの即時反映
  useEffect(() => {
    syncSettings({
      focusMinutes:      focusMin,
      shortBreakMinutes: shortBreakMin,
      longBreakMinutes:  longBreakMin,
      longBreakAfter:    longAfter,
    });
  }, [focusMin, shortBreakMin, longBreakMin, longAfter]);

  async function save(updates: Parameters<typeof updateSettings>[0]) {
    try { await updateSettings(updates); }
    catch { Alert.alert('エラー', '設定の保存に失敗しました。'); }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'ポモドーロ設定' }} />

      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Section title="タイマー設定">
          <SettingRow label="集中時間" sublabel="フォーカスフェーズの長さ">
            <Stepper value={focusMin} min={15} max={60} step={5} unit="分"
              onChange={(v) => { setFocusMin(v); void save({ pomodoro_focus_minutes: v }); }}
            />
          </SettingRow>
          <SettingRow label="短い休憩" sublabel="各セット後の休憩時間">
            <Stepper value={shortBreakMin} min={1} max={15} step={1} unit="分"
              onChange={(v) => { setShortBreakMin(v); void save({ pomodoro_short_break: v }); }}
            />
          </SettingRow>
          <SettingRow label="長い休憩" sublabel="Nセット後のまとめ休憩時間">
            <Stepper value={longBreakMin} min={5} max={30} step={5} unit="分"
              onChange={(v) => { setLongBreakMin(v); void save({ pomodoro_long_break: v }); }}
            />
          </SettingRow>
          <SettingRow label="長い休憩の間隔" sublabel="何セットごとに長い休憩を入れるか" isLast>
            <Stepper value={longAfter} min={2} max={8} step={1} unit="回"
              onChange={(v) => { setLongAfter(v); void save({ pomodoro_long_break_after: v }); }}
            />
          </SettingRow>
        </Section>

        {/* プレビュー */}
        <SessionPreview
          focusMin={focusMin}
          shortMin={shortBreakMin}
          longMin={longBreakMin}
          longAfter={longAfter}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingTop: 16 },
});
