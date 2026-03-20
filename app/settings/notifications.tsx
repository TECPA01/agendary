import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useUserSettingsStore } from '@/stores/useUserSettingsStore';
import { COLORS } from '@/constants/Colors';

// ---------------------------------------------------------------------------
// SettingRow
// ---------------------------------------------------------------------------

function SwitchRow({
  icon,
  iconBg,
  label,
  sublabel,
  value,
  onChange,
  isLast,
}: {
  icon:      string;
  iconBg:    string;
  label:     string;
  sublabel?: string;
  value:     boolean;
  onChange:  (v: boolean) => void;
  isLast?:   boolean;
}) {
  return (
    <View style={[rowSt.row, isLast && rowSt.rowLast]}>
      <View style={[rowSt.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={rowSt.icon}>{icon}</Text>
      </View>
      <View style={rowSt.text}>
        <Text style={rowSt.label}>{label}</Text>
        {sublabel && <Text style={rowSt.sublabel}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.border, true: COLORS.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// ReminderSelector — n分前 を選択
// ---------------------------------------------------------------------------

const REMINDER_OPTIONS = [
  { label: 'なし',   value: null },
  { label: '5分前',  value: 5 },
  { label: '10分前', value: 10 },
  { label: '15分前', value: 15 },
  { label: '30分前', value: 30 },
  { label: '1時間前', value: 60 },
];

function ReminderSelector({
  value,
  onChange,
}: {
  value:    number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <View style={selSt.wrap}>
      {REMINDER_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={String(opt.value)}
          style={[selSt.chip, value === opt.value && selSt.chipActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
        >
          <Text style={[selSt.chipText, value === opt.value && selSt.chipTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const selSt = StyleSheet.create({
  wrap:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  chip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated },
  chipActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  chipText:      { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive:{ color: COLORS.primary },
});

const rowSt = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  rowLast:  { borderBottomWidth: 0 },
  iconWrap: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:     { fontSize: 18 },
  text:     { flex: 1, gap: 2 },
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
// パーミッション確認バナー
// ---------------------------------------------------------------------------

function PermissionBanner({ onRequest }: { onRequest: () => void }) {
  return (
    <View style={pbSt.wrap}>
      <Text style={pbSt.icon}>🔔</Text>
      <View style={pbSt.text}>
        <Text style={pbSt.title}>通知の許可が必要です</Text>
        <Text style={pbSt.desc}>リマインダーを受け取るには通知を許可してください。</Text>
      </View>
      <TouchableOpacity style={pbSt.btn} onPress={onRequest}>
        <Text style={pbSt.btnText}>許可する</Text>
      </TouchableOpacity>
    </View>
  );
}

const AMBER = '#f59e0b';

const pbSt = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fef3c7', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#fbbf24', marginBottom: 20 },
  icon: { fontSize: 22, flexShrink: 0 },
  text: { flex: 1, gap: 2 },
  title:{ fontSize: 13, fontWeight: '700', color: '#92400e' },
  desc: { fontSize: 11, color: '#b45309', lineHeight: 16 },
  btn:  { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: AMBER, borderRadius: 9 },
  btnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export default function NotificationsSettingsScreen() {
  const { settings, updateSettings } = useUserSettingsStore();

  const [permGranted,      setPermGranted]      = useState<boolean | null>(null);
  const [reminderMin,      setReminderMin]       = useState<number | null>(settings?.default_reminder_minutes ?? 10);
  const [sessionReminder,  setSessionReminder]   = useState(true);
  const [weeklyPlanRemind, setWeeklyPlanRemind]  = useState(true);
  const [streakReminder,   setStreakReminder]    = useState(false);

  // 通知パーミッション確認
  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPermGranted(status === 'granted');
    });
  }, []);

  useEffect(() => {
    if (!settings) return;
    setReminderMin(settings.default_reminder_minutes ?? 10);
  }, [settings?.id]);

  async function requestPermission() {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermGranted(status === 'granted');
    if (status !== 'granted') {
      Alert.alert('通知が拒否されました', 'システム設定から通知を許可してください。');
    }
  }

  async function handleReminderChange(v: number | null) {
    setReminderMin(v);
    try { await updateSettings({ default_reminder_minutes: v }); }
    catch { Alert.alert('エラー', '設定の保存に失敗しました。'); }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'リマインダー・通知' }} />

      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* パーミッションバナー */}
        {permGranted === false && (
          <PermissionBanner onRequest={() => void requestPermission()} />
        )}

        {/* デフォルトリマインダー */}
        <Section title="ブロック前リマインダー">
          <View style={styles.reminderLabel}>
            <Text style={styles.reminderTitle}>デフォルトのリマインド時間</Text>
            <Text style={styles.reminderSub}>
              カレンダーでブロックを追加する際のデフォルト値。ブロックごとに個別変更も可能です。
            </Text>
          </View>
          <ReminderSelector value={reminderMin} onChange={(v) => void handleReminderChange(v)} />
        </Section>

        {/* 通知種別 */}
        <Section title="通知の種類">
          <SwitchRow
            icon="⏰" iconBg="#fce7f3"
            label="セッションリマインダー"
            sublabel="ブロック開始前にリマインド通知"
            value={sessionReminder}
            onChange={setSessionReminder}
          />
          <SwitchRow
            icon="📅" iconBg="#ede9fe"
            label="週間プランリマインダー"
            sublabel="週の始まりの前日夜に通知"
            value={weeklyPlanRemind}
            onChange={setWeeklyPlanRemind}
          />
          <SwitchRow
            icon="🔥" iconBg="#fef3c7"
            label="ストリークリマインダー"
            sublabel="連続記録が途切れそうな日に通知"
            value={streakReminder}
            onChange={setStreakReminder}
            isLast
          />
        </Section>

        {/* 注意書き */}
        <View style={styles.note}>
          <Text style={styles.noteText}>
            ※ 通知はすべてローカル通知（オフライン動作）です。{'\n'}
            通知が届かない場合はシステム設定 › AGENDARY › 通知を確認してください。
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingTop: 16 },
  reminderLabel: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },
  reminderTitle: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  reminderSub:   { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },
  note: { backgroundColor: COLORS.surfaceElevated, borderRadius: 12, padding: 14 },
  noteText: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, textAlign: 'center' },
});
