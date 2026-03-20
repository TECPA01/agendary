import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StepIndicator } from '@/components/common/StepIndicator';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useUserSettingsStore } from '@/stores/useUserSettingsStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import {
  requestPermissions,
  scheduleWeeklyPlanReminder,
  scheduleWeeklyReportReminder,
} from '@/lib/notifications';

const ONBOARDING_KEY = '@agendary:onboarded';

export default function CompleteScreen() {
  const [saving, setSaving] = useState(false);

  const { wakeTime, sleepTime, weekStartDay, getSelectedCategories, reset } =
    useOnboardingStore();
  const updateSettings = useUserSettingsStore((s) => s.updateSettings);
  const addCategory = useCategoryStore((s) => s.addCategory);

  const selectedCategories = getSelectedCategories();

  const weekDayLabel = ['日', '月', '火', '水', '木', '金', '土'][weekStartDay] ?? '月';

  /** 活動時間（分）を "X時間" フォーマットに変換 */
  const activityLabel = (() => {
    const [wh, wm] = wakeTime.split(':').map(Number);
    const [sh, sm] = sleepTime.split(':').map(Number);
    const mins = ((sh ?? 23) * 60 + (sm ?? 0)) - ((wh ?? 7) * 60 + (wm ?? 0));
    const h = Math.floor(Math.max(mins, 0) / 60);
    return `${h}時間`;
  })();

  const handleStart = async () => {
    setSaving(true);
    try {
      // 1. user_settings を更新
      await updateSettings({
        default_wake_time: wakeTime,
        default_sleep_time: sleepTime,
        week_start_day: weekStartDay,
      });

      // 2. 選択カテゴリを activity_categories に追加
      const byType: Record<string, number> = {};
      for (const cat of selectedCategories) {
        const order = byType[cat.type] ?? 0;
        byType[cat.type] = order + 1;
        await addCategory({
          type: cat.type,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          sort_order: order,
        });
      }

      // 3. オンボーディング完了フラグを保存
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

      // 4. 通知権限リクエスト + 週間リマインド登録
      const granted = await requestPermissions();
      if (granted) {
        await scheduleWeeklyPlanReminder(weekStartDay);
        await scheduleWeeklyReportReminder(weekStartDay);
      }

      // 5. ストアをリセット
      reset();

      // 6. メインタブへ遷移
      router.replace('/(tabs)');
    } catch (err) {
      // 認証前など Supabase 保存に失敗しても完了扱いにする
      console.warn('[onboarding] save error:', err);
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      reset();
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <StepIndicator current={3} total={3} />

      <Text style={styles.title}>準備完了 🎉</Text>
      <Text style={styles.subtitle}>
        以下の設定でAGENDARYをスタートします
      </Text>

      {/* 設定サマリー */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>スケジュール</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryIcon}>⏰</Text>
          <Text style={styles.summaryText}>
            {wakeTime} 起床 → {sleepTime} 就寝（活動時間 {activityLabel}）
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryIcon}>📅</Text>
          <Text style={styles.summaryText}>
            週の始まり: {weekDayLabel}曜日
          </Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          カテゴリ（{selectedCategories.length}件）
        </Text>
        {selectedCategories.map((cat) => (
          <View key={`${cat.type}-${cat.name}`} style={styles.catRow}>
            <View style={[styles.catDot, { backgroundColor: cat.color }]} />
            <Text style={styles.catIcon}>{cat.icon}</Text>
            <Text style={styles.catName}>{cat.name}</Text>
            <Text style={styles.catType}>
              {cat.type === 'study' ? '学習' : cat.type === 'exercise' ? '運動' : '生活'}
            </Text>
          </View>
        ))}
      </View>

      {/* 機能説明 */}
      <View style={styles.featureCard}>
        <Text style={styles.featureItem}>📊 充填率で1日の密度を可視化</Text>
        <Text style={styles.featureItem}>🍅 ポモドーロタイマーで集中力アップ</Text>
        <Text style={styles.featureItem}>📈 週次レポートでPDCAを回す</Text>
      </View>

      <TouchableOpacity
        style={[styles.startBtn, saving && styles.startBtnDisabled]}
        onPress={handleStart}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.startText}>AGENDARYを始める</Text>
        )}
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
    paddingBottom: 48,
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
    lineHeight: 20,
    marginBottom: 28,
  },
  summaryCard: {
    backgroundColor: '#f5f3ed',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  summaryIcon: {
    fontSize: 15,
    marginTop: 1,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catIcon: {
    fontSize: 16,
  },
  catName: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  catType: {
    fontSize: 11,
    color: '#94a3b8',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  featureCard: {
    backgroundColor: '#ede9fe',
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
    gap: 10,
  },
  featureItem: {
    fontSize: 14,
    color: '#4c1d95',
    lineHeight: 20,
  },
  startBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  startBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
  startText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
