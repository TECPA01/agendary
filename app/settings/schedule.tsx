import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useUserSettingsStore } from '@/stores/useUserSettingsStore';
import { COLORS } from '@/constants/Colors';

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function pad(n: number) { return String(n).padStart(2, '0'); }

function parseTime(t: string): { h: number; m: number } {
  const [hs, ms] = t.split(':');
  return { h: parseInt(hs ?? '7', 10), m: parseInt(ms ?? '0', 10) };
}

function fmtHM(h: number, m: number) { return `${pad(h)}:${pad(m)}`; }

function calcActiveMinutes(wake: string, sleep: string): number {
  const w = parseTime(wake);
  const s = parseTime(sleep);
  const wMin = w.h * 60 + w.m;
  const sMin = s.h * 60 + s.m;
  // 就寝が翌日にまたがる場合（例: 起床7時, 就寝2時 → +24h）
  return sMin > wMin ? sMin - wMin : sMin + 1440 - wMin;
}

function fmtActiveTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

const DAY_FULL  = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const DAY_SHORT = ['日', '月', '火', '水', '木', '金', '土'];

// ---------------------------------------------------------------------------
// 時刻ピッカーモーダル
// ---------------------------------------------------------------------------

function TimePicker({
  visible,
  label,
  value,
  onClose,
  onConfirm,
}: {
  visible:   boolean;
  label:     string;
  value:     string;
  onClose:   () => void;
  onConfirm: (t: string) => void;
}) {
  const init = parseTime(value);
  const [h, setH] = useState(init.h);
  const [m, setM] = useState(init.m);

  useEffect(() => {
    const p = parseTime(value);
    setH(p.h); setM(p.m);
  }, [value, visible]);

  function stepH(d: number) { setH((v) => (v + d + 24) % 24); }
  function stepM(d: number) {
    const next = m + d * 5;
    if (next < 0)       { setH((v) => (v - 1 + 24) % 24); setM(55); }
    else if (next >= 60){ setH((v) => (v + 1) % 24); setM(0); }
    else setM(next);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={tpSt.overlay}>
        <View style={tpSt.card}>
          <Text style={tpSt.title}>{label}</Text>
          <View style={tpSt.row}>
            {/* 時 */}
            <View style={tpSt.spinner}>
              <TouchableOpacity style={tpSt.btn} onPress={() => stepH(1)}>
                <Text style={tpSt.arrow}>▲</Text>
              </TouchableOpacity>
              <Text style={tpSt.num}>{pad(h)}</Text>
              <TouchableOpacity style={tpSt.btn} onPress={() => stepH(-1)}>
                <Text style={tpSt.arrow}>▼</Text>
              </TouchableOpacity>
            </View>
            <Text style={tpSt.colon}>:</Text>
            {/* 分 */}
            <View style={tpSt.spinner}>
              <TouchableOpacity style={tpSt.btn} onPress={() => stepM(1)}>
                <Text style={tpSt.arrow}>▲</Text>
              </TouchableOpacity>
              <Text style={tpSt.num}>{pad(m)}</Text>
              <TouchableOpacity style={tpSt.btn} onPress={() => stepM(-1)}>
                <Text style={tpSt.arrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={tpSt.actions}>
            <TouchableOpacity style={tpSt.cancelBtn} onPress={onClose}>
              <Text style={tpSt.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity style={tpSt.confirmBtn} onPress={() => onConfirm(fmtHM(h, m))}>
              <Text style={tpSt.confirmText}>確定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const tpSt = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  card:       { backgroundColor: COLORS.surface, borderRadius: 20, padding: 28, width: 280, alignItems: 'center', gap: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  title:      { fontSize: 16, fontWeight: '700', color: COLORS.text },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spinner:    { alignItems: 'center', gap: 8 },
  btn:        { width: 44, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceElevated, borderRadius: 10 },
  arrow:      { fontSize: 16, color: COLORS.text },
  num:        { fontSize: 38, fontWeight: '700', color: COLORS.text, minWidth: 56, textAlign: 'center' },
  colon:      { fontSize: 34, fontWeight: '300', color: COLORS.textMuted, marginBottom: 4 },
  actions:    { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn:  { flex: 1, paddingVertical: 12, backgroundColor: COLORS.surfaceElevated, borderRadius: 12, alignItems: 'center' },
  cancelText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center' },
  confirmText:{ fontSize: 15, color: '#fff', fontWeight: '700' },
});

// ---------------------------------------------------------------------------
// DefaultCard
// デフォルト起床・就寝時刻と活動時間をカード形式で表示
// ---------------------------------------------------------------------------

function DefaultCard({
  wake,
  sleep,
  onEditWake,
  onEditSleep,
}: {
  wake:        string;
  sleep:       string;
  onEditWake:  () => void;
  onEditSleep: () => void;
}) {
  const activeMin = calcActiveMinutes(wake, sleep);

  return (
    <View style={dcSt.card}>
      <TouchableOpacity style={dcSt.timeCol} onPress={onEditWake} activeOpacity={0.7}>
        <Text style={dcSt.timeIcon}>🌅</Text>
        <Text style={dcSt.timeLabel}>起床</Text>
        <Text style={dcSt.timeVal}>{wake.slice(0, 5)}</Text>
      </TouchableOpacity>

      <View style={dcSt.divider} />

      <TouchableOpacity style={dcSt.timeCol} onPress={onEditSleep} activeOpacity={0.7}>
        <Text style={dcSt.timeIcon}>🌙</Text>
        <Text style={dcSt.timeLabel}>就寝</Text>
        <Text style={dcSt.timeVal}>{sleep.slice(0, 5)}</Text>
      </TouchableOpacity>

      <View style={dcSt.divider} />

      <View style={[dcSt.timeCol, dcSt.activeCol]}>
        <Text style={dcSt.timeIcon}>⏱</Text>
        <Text style={dcSt.timeLabel}>活動時間</Text>
        <Text style={dcSt.activeVal}>{fmtActiveTime(activeMin)}</Text>
      </View>
    </View>
  );
}

const dcSt = StyleSheet.create({
  card:       { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, overflow: 'hidden' },
  timeCol:    { flex: 1, alignItems: 'center', paddingVertical: 20, gap: 6 },
  activeCol:  { },
  divider:    { width: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: 12 },
  timeIcon:   { fontSize: 20 },
  timeLabel:  { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  timeVal:    { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  activeVal:  { fontSize: 16, fontWeight: '700', color: COLORS.text },
});

// ---------------------------------------------------------------------------
// DayRow
// ---------------------------------------------------------------------------

function DayRow({
  dow,
  wakeOverride,
  sleepOverride,
  defaultWake,
  defaultSleep,
  onTap,
  onReset,
}: {
  dow:          number;
  wakeOverride:  string | null;
  sleepOverride: string | null;
  defaultWake:   string;
  defaultSleep:  string;
  onTap:         () => void;
  onReset:       () => void;
}) {
  const hasOverride = wakeOverride !== null || sleepOverride !== null;
  const wake  = wakeOverride  ?? defaultWake;
  const sleep = sleepOverride ?? defaultSleep;
  const activeMin = calcActiveMinutes(wake, sleep);

  const isWeekend = dow === 0 || dow === 6;

  return (
    <TouchableOpacity
      style={drSt.row}
      onPress={onTap}
      activeOpacity={0.7}
    >
      {/* 曜日 */}
      <View style={drSt.dayWrap}>
        <Text style={[drSt.day, isWeekend && (dow === 0 ? drSt.sun : drSt.sat)]}>
          {DAY_SHORT[dow]}
        </Text>
        {hasOverride && <View style={drSt.dot} />}
      </View>

      {/* 時刻表示 */}
      <View style={drSt.timesWrap}>
        {hasOverride ? (
          <Text style={drSt.customTime}>
            {wake.slice(0, 5)} → {sleep.slice(0, 5)}
          </Text>
        ) : (
          <Text style={drSt.defaultLabel}>デフォルト</Text>
        )}
      </View>

      {/* 活動時間（カスタム時のみ） */}
      {hasOverride ? (
        <Text style={drSt.activeTime}>{fmtActiveTime(activeMin)}</Text>
      ) : (
        <Text style={drSt.defaultActive}>{fmtActiveTime(activeMin)}</Text>
      )}

      {/* リセット or 余白 */}
      {hasOverride ? (
        <TouchableOpacity
          style={drSt.resetBtn}
          onPress={(e) => { e.stopPropagation(); onReset(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={drSt.resetText}>リセット</Text>
        </TouchableOpacity>
      ) : (
        <View style={drSt.resetPlaceholder} />
      )}

      <Text style={drSt.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const drSt = StyleSheet.create({
  row:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  dayWrap:         { width: 26, alignItems: 'center', gap: 3 },
  day:             { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sun:             { color: '#ef4444' },
  sat:             { color: '#3b82f6' },
  dot:             { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary },
  timesWrap:       { flex: 1 },
  customTime:      { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  defaultLabel:    { fontSize: 13, color: COLORS.textMuted },
  activeTime:      { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, minWidth: 56, textAlign: 'right' },
  defaultActive:   { fontSize: 12, color: COLORS.textMuted, minWidth: 56, textAlign: 'right' },
  resetBtn:        { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#fef2f2', borderRadius: 6, borderWidth: 1, borderColor: '#fca5a5' },
  resetText:       { fontSize: 11, color: COLORS.danger, fontWeight: '600' },
  resetPlaceholder:{ width: 52 },
  chevron:         { fontSize: 18, color: COLORS.textMuted, marginLeft: 2 },
});

// ---------------------------------------------------------------------------
// DayPickerModal
// 曜日の起床・就寝両方をひとつのモーダルで編集
// ---------------------------------------------------------------------------

function DayPickerModal({
  visible,
  dow,
  initWake,
  initSleep,
  onClose,
  onConfirm,
}: {
  visible:   boolean;
  dow:       number;
  initWake:  string;
  initSleep: string;
  onClose:   () => void;
  onConfirm: (wake: string, sleep: string) => void;
}) {
  const [activeField, setActiveField] = useState<'wake' | 'sleep'>('wake');

  const wakeInit  = parseTime(initWake);
  const sleepInit = parseTime(initSleep);

  const [wH, setWH] = useState(wakeInit.h);
  const [wM, setWM] = useState(wakeInit.m);
  const [sH, setSH] = useState(sleepInit.h);
  const [sM, setSM] = useState(sleepInit.m);

  useEffect(() => {
    if (!visible) return;
    const w = parseTime(initWake);
    const s = parseTime(initSleep);
    setWH(w.h); setWM(w.m);
    setSH(s.h); setSM(s.m);
    setActiveField('wake');
  }, [visible, initWake, initSleep]);

  const h = activeField === 'wake' ? wH : sH;
  const m = activeField === 'wake' ? wM : sM;
  const setH = activeField === 'wake' ? setWH : setSH;
  const setM = activeField === 'wake' ? setWM : setSM;

  function stepH(d: number) { setH((v) => (v + d + 24) % 24); }
  function stepM(d: number) {
    const next = m + d * 5;
    if (next < 0)       { setH((prev) => (prev - 1 + 24) % 24); setM(55); }
    else if (next >= 60){ setH((prev) => (prev + 1) % 24); setM(0); }
    else setM(next);
  }

  const previewWake  = fmtHM(wH, wM);
  const previewSleep = fmtHM(sH, sM);
  const activeMin    = calcActiveMinutes(previewWake, previewSleep);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dpSt.overlay}>
        <View style={dpSt.card}>
          {/* タイトル */}
          <Text style={dpSt.title}>{DAY_FULL[dow]}</Text>

          {/* フィールド切替タブ */}
          <View style={dpSt.tabs}>
            <TouchableOpacity
              style={[dpSt.tab, activeField === 'wake' && dpSt.tabActive]}
              onPress={() => setActiveField('wake')}
            >
              <Text style={dpSt.tabIcon}>🌅</Text>
              <Text style={[dpSt.tabLabel, activeField === 'wake' && dpSt.tabLabelActive]}>
                起床
              </Text>
              <Text style={[dpSt.tabTime, activeField === 'wake' && dpSt.tabTimeActive]}>
                {previewWake}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[dpSt.tab, activeField === 'sleep' && dpSt.tabActive]}
              onPress={() => setActiveField('sleep')}
            >
              <Text style={dpSt.tabIcon}>🌙</Text>
              <Text style={[dpSt.tabLabel, activeField === 'sleep' && dpSt.tabLabelActive]}>
                就寝
              </Text>
              <Text style={[dpSt.tabTime, activeField === 'sleep' && dpSt.tabTimeActive]}>
                {previewSleep}
              </Text>
            </TouchableOpacity>
          </View>

          {/* スピナー */}
          <View style={dpSt.spinnerRow}>
            <View style={dpSt.spinner}>
              <TouchableOpacity style={dpSt.btn} onPress={() => stepH(1)}>
                <Text style={dpSt.arrow}>▲</Text>
              </TouchableOpacity>
              <Text style={dpSt.num}>{pad(h)}</Text>
              <TouchableOpacity style={dpSt.btn} onPress={() => stepH(-1)}>
                <Text style={dpSt.arrow}>▼</Text>
              </TouchableOpacity>
            </View>
            <Text style={dpSt.colon}>:</Text>
            <View style={dpSt.spinner}>
              <TouchableOpacity style={dpSt.btn} onPress={() => stepM(1)}>
                <Text style={dpSt.arrow}>▲</Text>
              </TouchableOpacity>
              <Text style={dpSt.num}>{pad(m)}</Text>
              <TouchableOpacity style={dpSt.btn} onPress={() => stepM(-1)}>
                <Text style={dpSt.arrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 活動時間プレビュー */}
          <View style={dpSt.activeRow}>
            <Text style={dpSt.activeLabel}>⏱ 活動時間</Text>
            <Text style={dpSt.activeVal}>{fmtActiveTime(activeMin)}</Text>
          </View>

          {/* ボタン */}
          <View style={dpSt.actions}>
            <TouchableOpacity style={dpSt.cancelBtn} onPress={onClose}>
              <Text style={dpSt.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dpSt.confirmBtn}
              onPress={() => onConfirm(previewWake, previewSleep)}
            >
              <Text style={dpSt.confirmText}>確定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dpSt = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  card:           { backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, width: 320, gap: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  title:          { fontSize: 17, fontWeight: '700', color: COLORS.text, textAlign: 'center' },

  tabs:           { flexDirection: 'row', gap: 10 },
  tab:            { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated, gap: 3 },
  tabActive:      { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  tabIcon:        { fontSize: 16 },
  tabLabel:       { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase' },
  tabLabelActive: { color: COLORS.primary },
  tabTime:        { fontSize: 18, fontWeight: '700', color: COLORS.textSecondary },
  tabTimeActive:  { color: COLORS.primary },

  spinnerRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'center' },
  spinner:        { alignItems: 'center', gap: 8 },
  btn:            { width: 44, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceElevated, borderRadius: 10 },
  arrow:          { fontSize: 16, color: COLORS.text },
  num:            { fontSize: 38, fontWeight: '700', color: COLORS.text, minWidth: 56, textAlign: 'center' },
  colon:          { fontSize: 34, fontWeight: '300', color: COLORS.textMuted, marginBottom: 4 },

  activeRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surfaceElevated, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  activeLabel:    { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  activeVal:      { fontSize: 15, fontWeight: '700', color: COLORS.text },

  actions:        { flexDirection: 'row', gap: 12 },
  cancelBtn:      { flex: 1, paddingVertical: 13, backgroundColor: COLORS.surfaceElevated, borderRadius: 12, alignItems: 'center' },
  cancelText:     { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  confirmBtn:     { flex: 1, paddingVertical: 13, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center' },
  confirmText:    { fontSize: 15, color: '#fff', fontWeight: '700' },
});

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export default function ScheduleSettingsScreen() {
  const {
    settings,
    dailySchedules,
    fetchSettings,
    fetchDailySchedules,
    updateSettings,
    upsertDailySchedule,
    deleteDailySchedule,
  } = useUserSettingsStore();

  // デフォルト時刻はローカルにステージ → 保存するボタンで一括保存
  const [wakeLocal,  setWakeLocal]  = useState(settings?.default_wake_time  ?? '07:00');
  const [sleepLocal, setSleepLocal] = useState(settings?.default_sleep_time ?? '23:00');
  const [weekDay,    setWeekDay]    = useState(settings?.week_start_day     ?? 1);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  // デフォルト時刻用ピッカー
  const [defaultPicker, setDefaultPicker] = useState<{ field: 'wake' | 'sleep' } | null>(null);

  // 曜日別ピッカー
  const [dayPicker, setDayPicker] = useState<{ dow: number } | null>(null);

  useEffect(() => {
    void fetchSettings();
    void fetchDailySchedules();
  }, []);

  useEffect(() => {
    if (!settings) return;
    setWakeLocal(settings.default_wake_time  ?? '07:00');
    setSleepLocal(settings.default_sleep_time ?? '23:00');
    setWeekDay(settings.week_start_day ?? 1);
  }, [settings?.id]);

  // ── デフォルト時刻ピッカー確定（ローカルのみ更新、保存はボタン） ──

  function handleDefaultConfirm(time: string) {
    if (!defaultPicker) return;
    if (defaultPicker.field === 'wake')  setWakeLocal(time);
    else                                  setSleepLocal(time);
    setDefaultPicker(null);
    setSaved(false);
  }

  // ── 週の始まり変更（即時保存） ──

  async function handleWeekDay(day: number) {
    setWeekDay(day);
    try { await updateSettings({ week_start_day: day }); }
    catch { Alert.alert('エラー', '設定の保存に失敗しました。'); }
  }

  // ── 曜日別オーバーライド確定（即時保存） ──

  async function handleDayConfirm(wake: string, sleep: string) {
    if (!dayPicker) return;
    const dow = dayPicker.dow;
    setDayPicker(null);
    try {
      await upsertDailySchedule(dow, wake, sleep);
    } catch {
      Alert.alert('エラー', '設定の保存に失敗しました。');
    }
  }

  async function handleReset(dow: number) {
    Alert.alert(
      `${DAY_FULL[dow]}をリセット`,
      'デフォルト時刻に戻しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'リセット',
          style: 'destructive',
          onPress: async () => {
            try { await deleteDailySchedule(dow); }
            catch { Alert.alert('エラー', '設定のリセットに失敗しました。'); }
          },
        },
      ]
    );
  }

  // ── 保存するボタン ──

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        default_wake_time:  wakeLocal,
        default_sleep_time: sleepLocal,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert('エラー', '設定の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  const defaultActiveMin = calcActiveMinutes(wakeLocal, sleepLocal);

  return (
    <>
      <Stack.Screen options={{ title: '起床・就寝時刻' }} />

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ------------------------------------------------------------------ */}
        {/* デフォルト（平日）                                                   */}
        {/* ------------------------------------------------------------------ */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionLabel}>デフォルト（すべての曜日）</Text>

          <DefaultCard
            wake={wakeLocal}
            sleep={sleepLocal}
            onEditWake={() => setDefaultPicker({ field: 'wake' })}
            onEditSleep={() => setDefaultPicker({ field: 'sleep' })}
          />

          <View style={styles.defaultMeta}>
            <Text style={styles.defaultMetaText}>
              ⏱ 活動時間 {fmtActiveTime(defaultActiveMin)}
              {'　'}（タップで時刻を変更）
            </Text>
          </View>
        </View>

        {/* ------------------------------------------------------------------ */}
        {/* 週の始まり                                                           */}
        {/* ------------------------------------------------------------------ */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionLabel}>週の始まり</Text>
          <View style={styles.weekRow}>
            {[1, 0].map((day) => (
              <TouchableOpacity
                key={day}
                style={[styles.dayBtn, weekDay === day && styles.dayBtnActive]}
                onPress={() => void handleWeekDay(day)}
              >
                <Text style={[styles.dayBtnText, weekDay === day && styles.dayBtnTextActive]}>
                  {day === 1 ? '月曜日' : '日曜日'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ------------------------------------------------------------------ */}
        {/* 曜日別オーバーライド                                                  */}
        {/* ------------------------------------------------------------------ */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionLabel}>曜日別オーバーライド</Text>
          <View style={styles.card}>
            {[1, 2, 3, 4, 5, 6, 0].map((dow, i) => {
              const ds = dailySchedules.find((d) => d.day_of_week === dow);
              const isLast = i === 6;
              return (
                <View key={dow} style={isLast && styles.lastRow}>
                  <DayRow
                    dow={dow}
                    wakeOverride={ds?.wake_time  ?? null}
                    sleepOverride={ds?.sleep_time ?? null}
                    defaultWake={wakeLocal}
                    defaultSleep={sleepLocal}
                    onTap={() => setDayPicker({ dow })}
                    onReset={() => void handleReset(dow)}
                  />
                </View>
              );
            })}
          </View>
          <Text style={styles.overrideNote}>
            色付きで表示されている曜日はデフォルトから変更されています。
          </Text>
        </View>

        {/* ------------------------------------------------------------------ */}
        {/* 保存するボタン                                                        */}
        {/* ------------------------------------------------------------------ */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => void handleSave()}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>
            {saved ? '✓ 保存しました' : saving ? '保存中...' : '保存する'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* デフォルト時刻ピッカー */}
      <TimePicker
        visible={defaultPicker !== null}
        label={
          defaultPicker?.field === 'wake'
            ? 'デフォルト起床時刻'
            : 'デフォルト就寝時刻'
        }
        value={
          defaultPicker?.field === 'wake' ? wakeLocal : sleepLocal
        }
        onClose={() => setDefaultPicker(null)}
        onConfirm={handleDefaultConfirm}
      />

      {/* 曜日別ピッカー */}
      {dayPicker && (() => {
        const ds   = dailySchedules.find((d) => d.day_of_week === dayPicker.dow);
        const wake  = ds?.wake_time  ?? wakeLocal;
        const sleep = ds?.sleep_time ?? sleepLocal;
        return (
          <DayPickerModal
            visible
            dow={dayPicker.dow}
            initWake={wake}
            initSleep={sleep}
            onClose={() => setDayPicker(null)}
            onConfirm={(w, s) => void handleDayConfirm(w, s)}
          />
        );
      })()}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingTop: 16 },

  sectionWrap:  { marginBottom: 28, gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 },

  defaultMeta:     { paddingHorizontal: 4, marginTop: 2 },
  defaultMetaText: { fontSize: 12, color: COLORS.textMuted },

  weekRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 12,
  },
  dayBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
  },
  dayBtnActive:     { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  dayBtnText:       { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  dayBtnTextActive: { color: COLORS.primary },

  card:    { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, overflow: 'hidden' },
  lastRow: { },

  overrideNote: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 4, lineHeight: 17 },

  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});
