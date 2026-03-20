import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { COLORS } from '@/constants/Colors';

interface LoadingOverlayProps {
  /** true: 画面全体を覆うオーバーレイ、false: インライン中央寄せ（デフォルト: false） */
  fullScreen?: boolean;
  color?: string;
}

/**
 * ローディングインジケーター。
 * - fullScreen=true: 半透明オーバーレイで全体をブロック
 * - fullScreen=false: flex:1 の中央に表示（インライン用）
 */
export function LoadingOverlay({ fullScreen = false, color }: LoadingOverlayProps) {
  const indicatorColor = color ?? COLORS.primary;

  if (fullScreen) {
    return (
      <View style={styles.overlay}>
        <ActivityIndicator size="large" color={indicatorColor} />
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      <ActivityIndicator size="large" color={indicatorColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  inline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});
