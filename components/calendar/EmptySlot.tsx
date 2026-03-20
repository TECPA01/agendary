import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DiagonalHatch } from './DiagonalHatch';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmptySlotProps {
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  durationMin: number;
  heightPx: number;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export function EmptySlot({ startTime, endTime, durationMin, heightPx, onPress }: EmptySlotProps) {
  const showContent  = heightPx >= 52; // "予定を追加" テキスト表示の閾値
  const showPlus     = heightPx >= 36; // "+" ボタンのみの閾値

  return (
    <TouchableOpacity
      style={[styles.container, { height: heightPx }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {/* 斜線パターン背景 */}
      <DiagonalHatch color="rgba(0,0,0,0.05)" spacing={10} strokeWidth={1.5} />

      {/* コンテンツ */}
      {showPlus && (
        <View style={styles.content}>
          <View style={styles.plusCircle}>
            <Text style={styles.plusText}>+</Text>
          </View>
          {showContent && (
            <Text style={styles.addText}>予定を追加</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#94a3b8',
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 18,
    fontWeight: '400',
  },
  addText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
