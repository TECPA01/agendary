import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatDuration(durationMin: number): string {
  const h = Math.floor(durationMin / 60);
  const m = durationMin % 60;
  if (h > 0 && m > 0) return `${h}h${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimeBlockProps {
  block: BlockWithDetails;
  heightPx: number;
  onPress?: () => void;
  onLongPress?: () => void;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export function TimeBlock({ block, heightPx, onPress, onLongPress }: TimeBlockProps) {
  const color = block.activity_categories?.color ?? '#94a3b8';
  const name  = block.activity_categories?.name  ?? 'ブロック';
  const bgColor = hexToRgba(color, 0.1);

  const durationMin = toMin(block.end_time) - toMin(block.start_time);

  const durationLabel =
    block.timer_mode === 'pomodoro' && block.pomodoro_count
      ? `${block.pomodoro_count}🍅`
      : formatDuration(durationMin);

  // ステータスに応じた追加スタイル
  const isCompleted  = block.status === 'completed';
  const isInProgress = block.status === 'in_progress';

  // 詳細情報を表示できる最低高さ
  const showDetails  = heightPx >= 52;

  const isChanged = !!block.original_block_id;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          height: heightPx,
          backgroundColor: bgColor,
          borderLeftColor: color,
          opacity: isCompleted ? 0.65 : 1,
        },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.8}
    >
      {/* 進行中インジケーター */}
      {isInProgress && (
        <View style={[styles.inProgressDot, { backgroundColor: color }]} />
      )}

      {/* メインコンテンツ */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.name, { color }, isCompleted && styles.strikethrough]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {isChanged && (
            <View style={[styles.changeBadge, { backgroundColor: color + '22', borderColor: color + '66' }]}>
              <Text style={[styles.changeBadgeText, { color }]}>変更</Text>
            </View>
          )}
          <Text style={styles.duration}>{durationLabel}</Text>
        </View>

        {showDetails && (
          <View style={styles.details}>
            {block.sub_categories && (
              <Text style={styles.subText} numberOfLines={1}>
                {block.sub_categories.icon} {block.sub_categories.name}
              </Text>
            )}
            {block.curriculum_tasks && (
              <Text style={styles.subText} numberOfLines={1}>
                📋 {block.curriculum_tasks.name}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* 完了チェックマーク */}
      {isCompleted && (
        <Text style={styles.checkmark}>✓</Text>
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
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  inProgressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    marginRight: 4,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  duration: {
    fontSize: 11,
    color: '#64748b',
    flexShrink: 0,
  },
  details: {
    gap: 1,
  },
  subText: {
    fontSize: 11,
    color: '#64748b',
  },
  checkmark: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '700',
    marginLeft: 4,
    marginTop: 2,
  },
  changeBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  changeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
