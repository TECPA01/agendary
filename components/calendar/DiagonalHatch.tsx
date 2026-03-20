import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';

interface DiagonalHatchProps {
  color?: string;
  spacing?: number;
  strokeWidth?: number;
}

/**
 * 斜線パターン背景。親の StyleSheet.absoluteFillObject を塗りつぶす。
 * overflow: 'hidden' で回転したコンテンツをクリッピング。
 */
export function DiagonalHatch({
  color = 'rgba(0,0,0,0.06)',
  spacing = 10,
  strokeWidth = 1.5,
}: DiagonalHatchProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  return (
    <View
      style={[StyleSheet.absoluteFillObject, styles.clip]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setSize({ w: width, h: height });
      }}
    >
      {size && (
        <HatchContent
          w={size.w}
          h={size.h}
          color={color}
          spacing={spacing}
          strokeWidth={strokeWidth}
        />
      )}
    </View>
  );
}

function HatchContent({
  w, h, color, spacing, strokeWidth,
}: {
  w: number;
  h: number;
  color: string;
  spacing: number;
  strokeWidth: number;
}) {
  // 対角線の長さ + マージン分の正方形でコンテンツを回転させる
  const diag = Math.ceil(Math.sqrt(w * w + h * h));
  const side = diag + spacing * 6;
  const count = Math.ceil(side / spacing) + 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: (w - side) / 2,
        top: (h - side) / 2,
        width: side,
        height: side,
        transform: [{ rotate: '-45deg' }],
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            height: strokeWidth,
            marginBottom: spacing - strokeWidth,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
