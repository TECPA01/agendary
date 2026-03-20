import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { COLORS } from '@/constants/Colors';

export default function CategoriesSettingsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'カテゴリ管理' }} />
      <View style={styles.root}>
        <Text style={styles.icon}>📂</Text>
        <Text style={styles.title}>カテゴリ管理</Text>
        <Text style={styles.sub}>
          学習・運動・生活カテゴリの追加・編集・アーカイブ機能は近日公開予定です。
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  icon:  { fontSize: 52 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  sub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 21 },
});
