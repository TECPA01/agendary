import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '@/constants/Colors';
import { DEFAULTS } from '@/constants/defaults';
import { TimeWheel } from '@/components/common/WheelPicker';
import { StepIndicator } from '@/components/common/StepIndicator';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

const WEEK_DAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** "HH:MM" → 分 */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 活動時間を "X時間Y分" フォーマット */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

export default function WakeSleepScreen() {
  const { setSchedule } = useOnboardingStore();

  const [wakeTime, setWakeTime] = useState<string>(DEFAULTS.wakeTime);
  const [sleepTime, setSleepTime] = useState<string>(DEFAULTS.sleepTime);
  const [weekStart, setWeekStart] = useState<number>(DEFAULTS.weekStartDay);

  const activityMinutes = Math.max(toMinutes(sleepTime) - toMinutes(wakeTime), 0);

  const handleNext = () => {
    setSchedule(wakeTime, sleepTime, weekStart);
    router.push('/onboarding/categories');
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <StepIndicator current={1} total={3} />

      <Text style={styles.title}>生活リズムを設定</Text>
      <Text style={styles.subtitle}>
        起床・就寝時刻と週の始まりを設定してください
      </Text>

      {/* 起床時刻 */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>起床時刻</Text>
        <TimeWheel value={wakeTime} onChange={setWakeTime} />
      </View>

      {/* 就寝時刻 */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>就寝時刻</Text>
        <TimeWheel value={sleepTime} onChange={setSleepTime} />
      </View>

      {/* 活動時間の表示 */}
      {activityMinutes > 0 && (
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>⏰</Text>
          <Text style={styles.infoText}>
            活動時間 {formatDuration(activityMinutes)}
          </Text>
        </View>
      )}

      {/* 週の始まり */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>週の始まり</Text>
        <View style={styles.weekRow}>
          {WEEK_DAYS.map((day, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.dayBtn, weekStart === i && styles.dayBtnActive]}
              onPress={() => setWeekStart(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayText, weekStart === i && styles.dayTextActive]}>
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
        <Text style={styles.nextText}>次へ</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 28,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#f5f3ed',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  weekRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#e8e5dc',
  },
  dayBtnActive: {
    backgroundColor: '#7c3aed',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  dayTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  nextBtn: {
    marginTop: 28,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
