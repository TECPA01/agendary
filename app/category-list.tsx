import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { COLORS } from '@/constants/Colors';
import { useCategoryStore } from '@/stores/useCategoryStore';
import type { CategoryWithSubcategories } from '@/types/database';
import type { CategoryType } from '@/types/database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROW_H = 88;

const TAB_ITEMS: { key: CategoryType; label: string }[] = [
  { key: 'study', label: '📚 学習' },
  { key: 'exercise', label: '🏋️ 運動' },
  { key: 'life', label: '🏠 生活' },
];

// ---------------------------------------------------------------------------
// DraggableRow
// ---------------------------------------------------------------------------

interface DraggableRowProps {
  item: CategoryWithSubcategories;
  index: number;
  count: number;
  activeIdx: SharedValue<number>;
  activeTY: SharedValue<number>;
  overIdx: SharedValue<number>;
  onDragStart: (index: number) => void;
  onDragEnd: (from: number, to: number) => void;
  onPress: (item: CategoryWithSubcategories) => void;
  onArchive: (id: string) => void;
}

function DraggableRow({
  item,
  index,
  count,
  activeIdx,
  activeTY,
  overIdx,
  onDragStart,
  onDragEnd,
  onPress,
  onArchive,
}: DraggableRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  const animStyle = useAnimatedStyle(() => {
    const isActive = activeIdx.value === index;

    if (isActive) {
      return {
        transform: [
          { translateY: activeTY.value },
          { scale: withTiming(1.02, { duration: 150 }) },
        ],
        zIndex: 999,
        shadowOpacity: withTiming(0.18, { duration: 150 }),
        shadowRadius: withTiming(8, { duration: 150 }),
        elevation: 8,
      };
    }

    let shift = 0;
    const ov = overIdx.value;
    const ai = activeIdx.value;

    if (ai >= 0 && ov >= 0 && ai !== index) {
      if (ai < index && index <= ov) {
        shift = -ROW_H;
      } else if (ov <= index && index < ai) {
        shift = ROW_H;
      }
    }

    return {
      transform: [
        { translateY: withSpring(shift, { damping: 20, stiffness: 200 }) },
        { scale: withTiming(1, { duration: 150 }) },
      ],
      zIndex: 1,
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    };
  });

  const dragGesture = Gesture.Pan()
    .activateAfterLongPress(200)
    .onBegin(() => {
      activeIdx.value = index;
      activeTY.value = 0;
    })
    .onUpdate((e) => {
      activeTY.value = e.translationY;
    })
    .onEnd(() => {
      const from = activeIdx.value;
      const to = Math.max(0, Math.min(Math.round((from * ROW_H + activeTY.value) / ROW_H), count - 1));
      activeIdx.value = -1;
      activeTY.value = 0;
      if (from !== to) {
        runOnJS(onDragEnd)(from, to);
      }
    });

  const activeSubs = item.sub_categories.filter((s) => s.is_active);
  const totalSubs = item.sub_categories.length;
  const weeklyTarget = item.weekly_target ?? 0;

  function renderLeftActions() {
    return (
      <View style={styles.swipeActionLeft}>
        <TouchableOpacity
          style={styles.archiveBtn}
          onPress={() => {
            swipeableRef.current?.close();
            Alert.alert(
              'アーカイブ',
              `「${item.name}」をアーカイブしますか？`,
              [
                { text: 'キャンセル', style: 'cancel' },
                {
                  text: 'アーカイブ',
                  style: 'destructive',
                  onPress: () => onArchive(item.id),
                },
              ]
            );
          }}
        >
          <Text style={styles.archiveBtnText}>アーカイブ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.rowWrapper,
        { top: index * ROW_H, height: ROW_H },
        animStyle,
      ]}
    >
      <ReanimatedSwipeable
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        leftThreshold={60}
        friction={2}
      >
        <TouchableOpacity
          style={styles.rowInner}
          onPress={() => onPress(item)}
          activeOpacity={0.7}
        >
          {/* Drag handle */}
          <GestureDetector gesture={dragGesture}>
            <View style={styles.dragHandle}>
              <Text style={styles.dragHandleIcon}>⠿</Text>
            </View>
          </GestureDetector>

          {/* Color bar */}
          <View style={[styles.colorBar, { backgroundColor: item.color }]} />

          {/* Content */}
          <View style={styles.rowContent}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {totalSubs}内訳
              {item.type === 'study'
                ? ` · 今週${weeklyTarget}🍅`
                : weeklyTarget > 0
                ? ` · 今週${weeklyTarget}分`
                : ''}
              {item.has_curriculum ? ' · タスク管理' : ''}
            </Text>
            {totalSubs > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.subChipScroll}
                contentContainerStyle={styles.subChipContainer}
              >
                {item.sub_categories.slice(0, 6).map((sub) => (
                  <View
                    key={sub.id}
                    style={[
                      styles.subChip,
                      !sub.is_active && styles.subChipInactive,
                    ]}
                  >
                    {sub.icon ? (
                      <Text style={styles.subChipIcon}>{sub.icon}</Text>
                    ) : null}
                    <Text
                      style={[
                        styles.subChipText,
                        !sub.is_active && styles.subChipTextInactive,
                      ]}
                      numberOfLines={1}
                    >
                      {sub.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Chevron */}
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// ArchivedRow
// ---------------------------------------------------------------------------

interface ArchivedRowProps {
  item: CategoryWithSubcategories;
  onPress: (item: CategoryWithSubcategories) => void;
  onRestore: (id: string) => void;
}

function ArchivedRow({ item, onPress, onRestore }: ArchivedRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  function renderRightActions() {
    return (
      <View style={styles.swipeActionRight}>
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={() => {
            swipeableRef.current?.close();
            onRestore(item.id);
          }}
        >
          <Text style={styles.restoreBtnText}>元に戻す</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={60}
      friction={2}
    >
      <TouchableOpacity
        style={[styles.rowInner, styles.archivedRowInner]}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.colorBar, { backgroundColor: item.color, opacity: 0.4 }]} />
        <View style={styles.rowContent}>
          <Text style={[styles.rowName, styles.archivedText]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.archivedBadge}>
            <Text style={styles.archivedBadgeText}>アーカイブ済み</Text>
          </View>
        </View>
        <Text style={[styles.chevron, styles.archivedText]}>›</Text>
      </TouchableOpacity>
    </ReanimatedSwipeable>
  );
}

// ---------------------------------------------------------------------------
// DraggableList
// ---------------------------------------------------------------------------

interface DraggableListProps {
  items: CategoryWithSubcategories[];
  onReorder: (reordered: CategoryWithSubcategories[]) => void;
  onPress: (item: CategoryWithSubcategories) => void;
  onArchive: (id: string) => void;
}

function DraggableList({ items, onReorder, onPress, onArchive }: DraggableListProps) {
  const activeIdx = useSharedValue(-1);
  const activeTY = useSharedValue(0);
  const count = items.length;

  const overIdx = useDerivedValue(() => {
    if (activeIdx.value < 0) return -1;
    const absY = activeIdx.value * ROW_H + activeTY.value;
    return Math.max(0, Math.min(Math.round(absY / ROW_H), count - 1));
  });

  const handleDragEnd = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const reordered = [...items];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      onReorder(reordered);
    },
    [items, onReorder]
  );

  if (items.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>カテゴリがありません</Text>
      </View>
    );
  }

  return (
    <View style={{ height: items.length * ROW_H, position: 'relative' }}>
      {items.map((item, index) => (
        <DraggableRow
          key={item.id}
          item={item}
          index={index}
          count={count}
          activeIdx={activeIdx}
          activeTY={activeTY}
          overIdx={overIdx}
          onDragStart={() => {}}
          onDragEnd={handleDragEnd}
          onPress={onPress}
          onArchive={onArchive}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CategoryListScreen() {
  const router = useRouter();
  const {
    fetchCategories,
    getCategoriesByType,
    archiveCategory,
    restoreCategory,
    updateCategory,
    loading,
  } = useCategoryStore();

  const [activeTab, setActiveTab] = useState<CategoryType>('study');
  const [orderedIds, setOrderedIds] = useState<Record<CategoryType, string[]>>({
    study: [],
    exercise: [],
    life: [],
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  // Sync orderedIds when categories change
  const allForTab = getCategoriesByType(activeTab, true);
  useEffect(() => {
    const active = allForTab
      .filter((c) => !c.is_archived)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => c.id);

    setOrderedIds((prev) => {
      const existing = prev[activeTab];
      // Only reset if the id sets differ (new item added/removed)
      const existingSet = new Set(existing);
      const newSet = new Set(active);
      const same =
        existing.length === active.length &&
        active.every((id) => existingSet.has(id));
      if (same) return prev;
      return { ...prev, [activeTab]: active };
    });
  }, [allForTab.map((c) => c.id + c.is_archived).join(','), activeTab]);

  const allCategories = getCategoriesByType(activeTab, true);
  const categoryById = Object.fromEntries(allCategories.map((c) => [c.id, c]));

  const activeItems: CategoryWithSubcategories[] = orderedIds[activeTab]
    .map((id) => categoryById[id])
    .filter((c): c is CategoryWithSubcategories => !!c && !c.is_archived);

  const archivedItems: CategoryWithSubcategories[] = allCategories.filter((c) => c.is_archived);

  function handleAddPress() {
    Alert.alert('カテゴリの種類を選択', '', [
      {
        text: '📚 学習',
        onPress: () => router.push('/category-edit?type=study'),
      },
      {
        text: '🏋️ 運動',
        onPress: () => router.push('/category-edit?type=exercise'),
      },
      {
        text: '🏠 生活',
        onPress: () => router.push('/category-edit?type=life'),
      },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  }

  function handleRowPress(item: CategoryWithSubcategories) {
    router.push(`/category-edit?id=${item.id}`);
  }

  function handleArchive(id: string) {
    archiveCategory(id);
  }

  function handleRestore(id: string) {
    restoreCategory(id);
  }

  function handleReorder(reordered: CategoryWithSubcategories[]) {
    const newIds = reordered.map((c) => c.id);
    setOrderedIds((prev) => ({ ...prev, [activeTab]: newIds }));

    reordered.forEach((item, index) => {
      if (item.sort_order !== index) {
        updateCategory(item.id, { sort_order: index });
      }
    });
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'カテゴリ管理',
          headerRight: () => (
            <TouchableOpacity onPress={handleAddPress} style={styles.headerAddBtn}>
              <Text style={styles.headerAddText}>+ 追加</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TAB_ITEMS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.key && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && activeItems.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Active draggable list */}
            <DraggableList
              items={activeItems}
              onReorder={handleReorder}
              onPress={handleRowPress}
              onArchive={handleArchive}
            />

            {/* Archived section */}
            {archivedItems.length > 0 && (
              <View style={styles.archivedSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>アーカイブ済み</Text>
                </View>
                {archivedItems.map((item) => (
                  <View key={item.id} style={styles.archivedRowOpacity}>
                    <ArchivedRow
                      item={item}
                      onPress={handleRowPress}
                      onRestore={handleRestore}
                    />
                  </View>
                ))}
              </View>
            )}

            <View style={styles.bottomPadding} />
          </ScrollView>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  headerAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerAddText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },

  // Row wrapper (absolute positioning for drag)
  rowWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },

  // Row inner
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingRight: 12,
  },
  archivedRowInner: {
    opacity: 0.55,
  },

  // Drag handle
  dragHandle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleIcon: {
    fontSize: 20,
    color: COLORS.textMuted,
  },

  // Color bar
  colorBar: {
    width: 4,
    height: ROW_H - 16,
    borderRadius: 2,
    marginRight: 12,
  },

  // Row content
  rowContent: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },

  // Sub-category chips
  subChipScroll: {
    flexGrow: 0,
  },
  subChipContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingRight: 8,
  },
  subChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 3,
  },
  subChipInactive: {
    opacity: 0.45,
  },
  subChipIcon: {
    fontSize: 11,
  },
  subChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    maxWidth: 80,
  },
  subChipTextInactive: {
    color: COLORS.textMuted,
  },

  // Chevron
  chevron: {
    fontSize: 22,
    color: COLORS.textMuted,
    marginLeft: 8,
  },
  archivedText: {
    opacity: 0.6,
  },
  archivedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  archivedBadgeText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },

  // Swipeable archive action
  swipeActionLeft: {
    width: 140,
    justifyContent: 'center',
  },
  archiveBtn: {
    flex: 1,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // Swipeable restore action
  swipeActionRight: {
    width: 140,
    justifyContent: 'center',
  },
  restoreBtn: {
    flex: 1,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restoreBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // Archived section
  archivedSection: {
    marginTop: 24,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  archivedRowOpacity: {
    backgroundColor: COLORS.surface,
  },

  // Empty / Loading
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomPadding: {
    height: 40,
  },
});
