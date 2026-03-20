import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SleepZoneProps {
  /** 表示ラベル（「起床」or「就寝」） */
  label: string;
  /** 時刻文字列 "HH:MM" */
  time: string;
  /** アイコン絵文字 */
  icon?: string;
  /** 「変更」タップ時コールバック。省略時は「変更」ボタンを非表示 */
  onChangePress?: () => void;
}

export function SleepZone({ label, time, icon = '🌙', onChangePress }: SleepZoneProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.time}>{time}</Text>
      {onChangePress && (
        <TouchableOpacity style={styles.changeBtn} onPress={onChangePress}>
          <Text style={styles.changeBtnText}>変更</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontSize: 13,
    color: '#94a3b8',
  },
  time: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
  },
  changeBtnText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
