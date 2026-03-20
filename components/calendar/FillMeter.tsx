import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DiagonalHatch } from './DiagonalHatch';

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

interface FillMeterProps {
  fillRate: number;      // 0-100
  scheduledMin: number;  // 計画済み分数
  availableMin: number;  // 活動可能時間（分）
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function getBarColor(rate: number): string {
  if (rate >= 100) return '#059669'; // green
  if (rate >= 70)  return '#d97706'; // amber
  return '#dc4a2d';                   // coral-red
}

function formatRemaining(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

function getMessage(fillRate: number, availableMin: number, scheduledMin: number): {
  text: string;
  color: string;
} {
  if (fillRate >= 100) {
    return { text: '✓ 完璧な計画です', color: '#059669' };
  }
  if (fillRate >= 70) {
    const remaining = formatRemaining(availableMin - scheduledMin);
    return { text: `あと${remaining}で100%です`, color: '#d97706' };
  }
  const unplannedPct = 100 - fillRate;
  return {
    text: `⚠ 活動時間の${unplannedPct}%が未計画です`,
    color: '#dc2626',
  };
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export function FillMeter({ fillRate, scheduledMin, availableMin }: FillMeterProps) {
  const [barWidth, setBarWidth] = useState(0);
  const barColor = getBarColor(fillRate);
  const { text: msgText, color: msgColor } = getMessage(fillRate, availableMin, scheduledMin);
  const clampedRate = Math.min(Math.max(fillRate, 0), 100);
  const filledPx = barWidth > 0 ? (barWidth * clampedRate) / 100 : 0;

  return (
    <View style={styles.container}>
      {/* ラベル行 */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>活動時間の充填率</Text>
        <Text style={[styles.percent, { color: barColor }]}>{clampedRate}%</Text>
      </View>

      {/* プログレスバー */}
      <View
        style={styles.barContainer}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {/* 未充填部分（斜線パターン）*/}
        <View style={[StyleSheet.absoluteFillObject, styles.unfilledBg]} />
        <DiagonalHatch color="rgba(0,0,0,0.06)" spacing={8} strokeWidth={1.5} />

        {/* 充填部分（ソリッドカラー） */}
        {barWidth > 0 && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                width: filledPx,
                backgroundColor: barColor,
                borderTopLeftRadius: 6,
                borderBottomLeftRadius: 6,
                borderTopRightRadius: clampedRate >= 100 ? 6 : 2,
                borderBottomRightRadius: clampedRate >= 100 ? 6 : 2,
              },
            ]}
          />
        )}
      </View>

      {/* メッセージ */}
      <Text style={[styles.message, { color: msgColor }]}>{msgText}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  percent: {
    fontSize: 14,
    fontWeight: '700',
  },
  barContainer: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    marginBottom: 6,
  },
  unfilledBg: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
  message: {
    fontSize: 12,
    fontWeight: '500',
  },
});
