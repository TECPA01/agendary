import React, { useRef, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const OFFSET = Math.floor(VISIBLE_ITEMS / 2); // 2

// ---------------------------------------------------------------------------
// WheelPickerColumn — 単一列のスクロールホイール
// ---------------------------------------------------------------------------

interface WheelPickerColumnProps {
  items: string[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  width?: number;
}

export function WheelPickerColumn({
  items,
  selectedIndex,
  onIndexChange,
  width = 72,
}: WheelPickerColumnProps) {
  const scrollRef = useRef<ScrollView>(null);
  const hasScrolled = useRef(false);

  const paddedItems = [...Array(OFFSET).fill(''), ...items, ...Array(OFFSET).fill('')];

  // コンテンツがレンダリングされたら初期位置へスクロール
  const onContentSizeChange = useCallback(() => {
    if (!hasScrolled.current) {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
      hasScrolled.current = true;
    }
  }, [selectedIndex]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      onIndexChange(clamped);
    },
    [items.length, onIndexChange]
  );

  return (
    <View style={[styles.container, { width }]}>
      {/* 選択インジケーター */}
      <View style={styles.selectedOverlay} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onContentSizeChange={onContentSizeChange}
        scrollEventThrottle={16}
      >
        {paddedItems.map((label, i) => {
          const realIdx = i - OFFSET;
          const isSelected = realIdx === selectedIndex;
          return (
            <View key={i} style={styles.item}>
              <Text
                style={[
                  styles.label,
                  isSelected ? styles.labelSelected : styles.labelMuted,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// TimeWheel — 時刻選択（時・分の2カラム）
// ---------------------------------------------------------------------------

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

interface TimeWheelProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
}

export function TimeWheel({ value, onChange }: TimeWheelProps) {
  const [hStr, mStr] = value.split(':');
  const hourIndex = Math.min(parseInt(hStr ?? '7', 10), 23);
  const rawMinIdx = MINUTES.indexOf((mStr ?? '00').padStart(2, '0'));
  const minuteIndex = rawMinIdx === -1 ? 0 : rawMinIdx;

  const handleHourChange = useCallback(
    (i: number) => {
      onChange(`${HOURS[i]}:${MINUTES[minuteIndex]}`);
    },
    [minuteIndex, onChange]
  );

  const handleMinuteChange = useCallback(
    (i: number) => {
      onChange(`${HOURS[hourIndex]}:${MINUTES[i]}`);
    },
    [hourIndex, onChange]
  );

  return (
    <View style={styles.timeRow}>
      <WheelPickerColumn
        items={HOURS}
        selectedIndex={hourIndex}
        onIndexChange={handleHourChange}
        width={68}
      />
      <Text style={styles.colon}>:</Text>
      <WheelPickerColumn
        items={MINUTES}
        selectedIndex={minuteIndex}
        onIndexChange={handleMinuteChange}
        width={68}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
  },
  selectedOverlay: {
    position: 'absolute',
    top: ITEM_HEIGHT * OFFSET,
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#7c3aed',
    borderRadius: 4,
    zIndex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 22,
  },
  labelSelected: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e293b',
  },
  labelMuted: {
    color: '#94a3b8',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  colon: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    width: 16,
    textAlign: 'center',
  },
});
