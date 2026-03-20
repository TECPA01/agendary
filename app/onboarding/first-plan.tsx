import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '@/constants/Colors';

export default function FirstPlanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.step}>ステップ 3 / 3</Text>
      <Text style={styles.title}>最初の週間プランを作成</Text>
      <Text style={styles.subtitle}>今週の学習・運動・生活のブロックを配置しましょう</Text>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>📅</Text>
        <Text style={styles.cardText}>カレンダーにブロックをタップして追加できます</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>🍅</Text>
        <Text style={styles.cardText}>ポモドーロか時間指定でタイマーを選択できます</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>📊</Text>
        <Text style={styles.cardText}>充填率で1日の密度を可視化します</Text>
      </View>

      <TouchableOpacity
        style={styles.startBtn}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.startText}>はじめる</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
    justifyContent: 'center',
  },
  step: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  startBtn: {
    marginTop: 32,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
