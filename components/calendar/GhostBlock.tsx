import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BlockWithDetails } from '@/types/database';

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GhostBlockProps {
  block: BlockWithDetails;
  heightPx: number;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export function GhostBlock({ block, heightPx }: GhostBlockProps) {
  const color   = block.activity_categories?.color ?? '#94a3b8';
  const name    = block.activity_categories?.name  ?? 'ブロック';
  const bgColor = hexToRgba(color, 0.06);

  const showDetails = heightPx >= 56;

  return (
    <View
      style={[
        styles.container,
        {
          height:          heightPx,
          backgroundColor: bgColor,
          borderColor:     color,
        },
      ]}
    >
      {/* 「元の予定」バッジ */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>元の予定</Text>
      </View>

      {/* 科目名 */}
      <Text style={[styles.name, { color }]} numberOfLines={1}>
        {name}
      </Text>

      {/* 内訳（十分な高さがある場合のみ） */}
      {showDetails && block.sub_categories && (
        <Text style={styles.subText} numberOfLines={1}>
          {block.sub_categories.icon} {block.sub_categories.name}
        </Text>
      )}
    </View>
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
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 4,
    overflow: 'hidden',
    opacity: 0.55,
    gap: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(148,163,184,0.35)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
  },
  subText: {
    fontSize: 10,
    color: '#94a3b8',
  },
});
